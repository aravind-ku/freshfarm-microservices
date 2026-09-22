const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mysql = require("mysql2");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5002;

// ========================================
// MYSQL CONNECTION
// ========================================

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

db.connect((error) => {
  if (error) {
    console.error("Payment Service MySQL connection failed:");
    console.error(error.message);
    return;
  }

  console.log("Payment Service connected to MySQL");
});

// ========================================
// RAZORPAY CONFIGURATION
// ========================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ========================================
// TEST ROUTE
// ========================================

app.get("/", (req, res) => {
  res.send("Fresh Farm Payment Service is running");
});

// ========================================
// JWT MIDDLEWARE
// ========================================

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(403).json({
        message: "Invalid or expired token",
      });
    }

    req.user = decoded;

    next();
  });
}

// ========================================
// CREATE RAZORPAY PAYMENT ORDER
// ========================================

app.post("/create-payment-order", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        message: "orderId is required",
      });
    }

    const authHeader = req.headers["authorization"];

    // Get the real order amount from Order Service
    const orderResponse = await fetch(
      `${process.env.ORDER_SERVICE_URL}/orders/${orderId}`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      },
    );

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}));

      return res.status(orderResponse.status).json({
        message: errorData.message || "Unable to retrieve order details",
      });
    }

    const orderData = await orderResponse.json();
    const order = orderData.order;

    if (order.status !== "PAYMENT_PENDING") {
      return res.status(400).json({
        message: `Payment cannot be created for order with status ${order.status}`,
      });
    }

    const amount = Number(order.total_amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Invalid order amount",
      });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `freshfarm_${orderId}`,

      notes: {
        freshfarmOrderId: String(orderId),
        userId: String(req.user.id),
        productType: String(order.product_type),
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    return res.status(201).json({
      message: "Payment order created successfully",
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,

      // Useful for frontend/debugging
      freshfarmOrderId: order.id,
      product: order.milk_type,
      productType: order.product_type,
      totalAmount: amount,
    });
  } catch (error) {
    console.error("Create Razorpay Payment Order Error:", error);

    return res.status(500).json({
      message: "Unable to create payment order",
    });
  }
});

// ========================================
// VERIFY RAZORPAY PAYMENT
// ========================================

app.post("/verify-payment", verifyToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !orderId
    ) {
      return res.status(400).json({
        message: "Payment verification details are required",
      });
    }

    // --------------------------------
    // Create expected Razorpay signature
    // --------------------------------

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    // --------------------------------
    // Compare signatures
    // --------------------------------

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Payment verification failed",
      });
    }

    // --------------------------------
    // Verify Razorpay order belongs
    // to this Fresh Farm order/user
    // --------------------------------

    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);

    if (String(razorpayOrder.notes.freshfarmOrderId) !== String(orderId)) {
      return res.status(400).json({
        message: "Order verification failed",
      });
    }

    if (String(razorpayOrder.notes.userId) !== String(req.user.id)) {
      return res.status(403).json({
        message: "Payment does not belong to this user",
      });
    }

    // --------------------------------
    // Tell Order Service to mark PAID
    // --------------------------------

    const authHeader = req.headers["authorization"];

    const orderResponse = await fetch(
      `${process.env.ORDER_SERVICE_URL}/orders/${orderId}/payment-status`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },

        body: JSON.stringify({
          status: "PAID",
        }),
      },
    );

    if (!orderResponse.ok) {
      const errorBody = await orderResponse.text();

      console.error(
        "Order Service payment update failed:",
        orderResponse.status,
        errorBody,
      );

      throw new Error("Unable to update order payment status");
    }

    const orderData = await orderResponse.json();

    console.log("Order updated:", orderData);

    // --------------------------------
    // SAVE PAYMENT IN MYSQL
    // --------------------------------

    const insertPaymentQuery = `
  INSERT INTO payments
  (
    order_id,
    user_id,
    razorpay_order_id,
    razorpay_payment_id,
    amount,
    currency,
    status
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

    const amountInRupees = razorpayOrder.amount / 100;

    db.query(
      insertPaymentQuery,
      [
        orderId,
        req.user.id,
        razorpay_order_id,
        razorpay_payment_id,
        amountInRupees,
        razorpayOrder.currency,
        "SUCCESS",
      ],
      async (error, result) => {
        if (error) {
          console.error("Payment DB Error:", error);

          return res.status(500).json({
            message: "Payment verified but unable to save payment record",
          });
        }

        try {
          const notificationResponse = await fetch(
            `${process.env.NOTIFICATION_SERVICE_URL}/notifications`,
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
              },

              body: JSON.stringify({
                type: "PAYMENT_SUCCESS",
                message: `Payment successful for Fresh Farm order #${orderId}. Amount paid: INR ${amountInRupees}`,
                orderId: Number(orderId),
              }),
            },
          );

          if (!notificationResponse.ok) {
            const notificationError = await notificationResponse.text();

            console.error(
              "Payment notification failed:",
              notificationResponse.status,
              notificationError,
            );
          } else {
            console.log(
              `PAYMENT_SUCCESS notification created for order #${orderId}`,
            );
          }
        } catch (notificationError) {
          console.error(
            "Notification Service Error:",
            notificationError.message,
          );
        }

        res.status(200).json({
          message: "Payment verified successfully",

          paymentId: razorpay_payment_id,

          orderId: orderId,

          paymentRecordId: result.insertId,
        });
      },
    );
  } catch (error) {
    console.error("Payment Verification Error:", error);

    res.status(500).json({
      message: "Unable to verify payment",
    });
  }
});

// ========================================
// GET PAYMENT HISTORY
// ========================================

app.get("/payments", verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      id,
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      currency,
      status,
      created_at
    FROM payments
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.query(query, [userId], (error, results) => {
    if (error) {
      console.error("Payment History DB Error:", error);

      return res.status(500).json({
        message: "Unable to fetch payment history",
      });
    }

    res.status(200).json({
      message: "Payment history fetched successfully",
      payments: results,
    });
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`Payment Service running on http://localhost:${PORT}`);
});
