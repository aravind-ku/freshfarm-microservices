const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || "http://localhost:5005";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

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
    console.error("MySQL connection failed:");
    console.error(error.message);
    return;
  }

  console.log("Order Service connected to MySQL");
});

// ========================================
// TEST ROUTE
// ========================================

app.get("/", (req, res) => {
  res.send("Fresh Farm Order Service is running");
});

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

app.post("/orders", verifyToken, async (req, res) => {
  const userId = req.user.id;

  const {
    customerName,
    phone,
    address,
    milkType,
    quantity,
    productType = "MILK",
    productId = null,
  } = req.body;

  // ========================================
  // BASIC VALIDATION
  // ========================================

  if (!customerName || !phone || !address || !quantity) {
    return res.status(400).json({
      message: "All order fields are required",
    });
  }

  const orderQuantity = Number(quantity);

  if (!Number.isFinite(orderQuantity) || orderQuantity <= 0) {
    return res.status(400).json({
      message: "Quantity must be greater than zero",
    });
  }

  const normalizedProductType = String(productType).toUpperCase();

  let finalProductName = milkType;
  let finalProductId = null;
  let unitPrice = 60;

  let inventoryProductId = null;
  let inventoryReduced = false;

  const inventoryServiceUrl = process.env.INVENTORY_SERVICE_URL;

  // ========================================
  // COMPENSATION FUNCTION
  // ========================================

  async function restoreInventory() {
    if (!inventoryReduced || !inventoryProductId) {
      return;
    }

    try {
      const restoreResponse = await fetch(
        `${inventoryServiceUrl}/inventory/${normalizedProductType}/${inventoryProductId}/increase`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            quantity: orderQuantity,
          }),
        },
      );

      if (!restoreResponse.ok) {
        const restoreBody = await restoreResponse.text();

        console.error(
          "CRITICAL: Inventory compensation failed:",
          restoreResponse.status,
          restoreBody,
        );

        return;
      }

      console.log(
        `Inventory restored: ${normalizedProductType}/${inventoryProductId} +${orderQuantity}`,
      );

      inventoryReduced = false;
    } catch (restoreError) {
      console.error(
        "CRITICAL: Inventory compensation error:",
        restoreError.message,
      );
    }
  }

  try {
    // ========================================
    // DAIRY PRODUCT
    // ========================================

    if (normalizedProductType === "DAIRY") {
      if (!productId) {
        return res.status(400).json({
          message: "Dairy product ID is required",
        });
      }

      console.log(`Fetching dairy product ${productId} from Go Dairy Service`);

      const dairyResponse = await fetch(
        `${process.env.DAIRY_SERVICE_URL}/products/${productId}`,
      );

      if (!dairyResponse.ok) {
        return res.status(400).json({
          message: "Dairy product not found",
        });
      }

      const dairyProduct = await dairyResponse.json();

      if (!dairyProduct.available) {
        return res.status(400).json({
          message: "This dairy product is currently unavailable",
        });
      }

      finalProductName = dairyProduct.name;
      finalProductId = dairyProduct.id;
      unitPrice = Number(dairyProduct.price);

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(500).json({
          message: "Invalid dairy product price",
        });
      }

      inventoryProductId = Number(dairyProduct.id);

      console.log(
        `Dairy product verified: ${finalProductName} - ₹${unitPrice}`,
      );
    }

    // ========================================
    // NORMAL MILK
    // ========================================
    else if (normalizedProductType === "MILK") {
      if (!milkType) {
        return res.status(400).json({
          message: "Milk type is required",
        });
      }

      unitPrice = 60;

      const normalizedMilkType = milkType.trim().toLowerCase();

      if (normalizedMilkType.includes("cow")) {
        inventoryProductId = 1;
      } else if (normalizedMilkType.includes("buffalo")) {
        inventoryProductId = 2;
      } else {
        return res.status(400).json({
          message: "Invalid milk type for inventory",
        });
      }
    }

    // ========================================
    // INVALID PRODUCT TYPE
    // ========================================
    else {
      return res.status(400).json({
        message: "Invalid product type",
      });
    }

    const totalAmount = Number((unitPrice * orderQuantity).toFixed(2));

    // ========================================
    // INVENTORY CHECK
    // ========================================

    const inventoryResponse = await fetch(
      `${inventoryServiceUrl}/inventory/${normalizedProductType}/${inventoryProductId}`,
    );

    if (!inventoryResponse.ok) {
      return res.status(400).json({
        message: "Product inventory not found",
      });
    }

    const inventory = await inventoryResponse.json();

    if (inventory.quantityAvailable < orderQuantity) {
      return res.status(400).json({
        message: "Insufficient stock",
        available: inventory.quantityAvailable,
        requested: orderQuantity,
      });
    }

    // ========================================
    // REDUCE INVENTORY
    // ========================================

    const reduceResponse = await fetch(
      `${inventoryServiceUrl}/inventory/${normalizedProductType}/${inventoryProductId}/reduce`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          quantity: orderQuantity,
        }),
      },
    );

    if (!reduceResponse.ok) {
      const reduceError = await reduceResponse.json();

      return res.status(400).json({
        message: reduceError.message || "Unable to reduce inventory",
      });
    }

    inventoryReduced = true;

    console.log(
      `Inventory reduced: ${normalizedProductType}/${inventoryProductId} -${orderQuantity}`,
    );

    // ========================================
    // INSERT ORDER
    // ========================================

    const query = `
      INSERT INTO orders
      (
        user_id,
        customer_name,
        phone,
        address,
        milk_type,
        quantity,
        product_type,
        product_id,
        unit_price,
        total_amount,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      query,
      [
        userId,
        customerName,
        phone,
        address,
        finalProductName,
        orderQuantity,
        normalizedProductType,
        finalProductId,
        unitPrice,
        totalAmount,
        "PAYMENT_PENDING",
      ],
      async (error, result) => {
        // ========================================
        // ORDER INSERT FAILED
        // RESTORE INVENTORY
        // ========================================

        if (error) {
          console.error("Create Order DB Error:", error);

          await restoreInventory();

          return res.status(500).json({
            message: "Unable to place order. Inventory was restored.",
          });
        }

        const newOrderId = result.insertId;

        // Order exists now, so the reserved stock
        // belongs to this order.
        inventoryReduced = false;

        // ========================================
        // ORDER PLACED NOTIFICATION
        // ========================================

        try {
          const notificationResponse = await fetch(
            `${process.env.NOTIFICATION_SERVICE_URL}/notifications`,
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",

                Authorization: req.headers["authorization"],
              },

              body: JSON.stringify({
                orderId: newOrderId,

                type: "ORDER_PLACED",

                message: `Your Fresh Farm ${
                  normalizedProductType === "DAIRY" ? "dairy product" : "milk"
                } order #${newOrderId} has been placed successfully`,
              }),
            },
          );

          if (!notificationResponse.ok) {
            console.error(
              "Notification creation failed:",
              notificationResponse.status,
              await notificationResponse.text(),
            );
          }
        } catch (notificationError) {
          // Notification failure should NOT
          // cancel an already-created order.
          console.error(
            "Notification Service Error:",
            notificationError.message,
          );
        }

        // ========================================
        // SUCCESS RESPONSE
        // ========================================

        return res.status(201).json({
          message: "Order placed successfully",

          orderId: newOrderId,

          product: finalProductName,

          productType: normalizedProductType,

          productId: finalProductId,

          quantity: orderQuantity,

          unitPrice,

          totalAmount,

          status: "PAYMENT_PENDING",
        });
      },
    );
  } catch (error) {
    console.error("Order Processing Error:", error);

    // If something fails AFTER inventory
    // reduction but BEFORE successful order
    // creation, restore stock.
    await restoreInventory();

    return res.status(500).json({
      message: "Unable to process order",
    });
  }
});

// ========================================
// GET LOGGED-IN USER ORDERS
// ========================================

app.get("/orders", verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
  SELECT
    id,
    customer_name,
    phone,
    address,
    milk_type,
    quantity,
    product_type,
    product_id,
    unit_price,
    total_amount,
    status,
    created_at
  FROM orders
  WHERE user_id = ?
  ORDER BY created_at DESC
`;

  db.query(query, [userId], (error, results) => {
    if (error) {
      console.error(error);

      return res.status(500).json({
        message: "Unable to fetch orders",
      });
    }

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: results,
    });
  });
});

// ========================================
// GET SINGLE ORDER
// Used by Payment Service
// ========================================

app.get("/orders/:id", verifyToken, (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  const query = `
    SELECT
      id,
      user_id,
      milk_type,
      quantity,
      product_type,
      product_id,
      unit_price,
      total_amount,
      status
    FROM orders
    WHERE id = ?
    AND user_id = ?
  `;

  db.query(query, [orderId, userId], (error, results) => {
    if (error) {
      console.error("Get Single Order Error:", error);

      return res.status(500).json({
        message: "Unable to fetch order",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.status(200).json({
      order: results[0],
    });
  });
});

// ========================================
// CANCEL ORDER
// ========================================

app.delete("/orders/:id", verifyToken, (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  const checkQuery = `
    SELECT *
    FROM orders
    WHERE id = ?
    AND user_id = ?
  `;

  db.query(checkQuery, [orderId, userId], async (error, results) => {
    if (error) {
      console.error("Cancel order lookup error:", error);

      return res.status(500).json({
        message: "Database error",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = results[0];

    // ========================================
    // PREVENT INVALID CANCELLATION
    // ========================================

    if (order.status === "DELIVERED") {
      return res.status(400).json({
        message: "Delivered order cannot be cancelled",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        message: "Order already cancelled",
      });
    }

    // ========================================
    // DETERMINE INVENTORY PRODUCT ID
    // ========================================

    let inventoryProductId = order.product_id;

    if (order.product_type === "MILK") {
      const normalizedMilkType = String(order.milk_type).trim().toLowerCase();

      if (normalizedMilkType.includes("cow")) {
        inventoryProductId = 1;
      } else if (normalizedMilkType.includes("buffalo")) {
        inventoryProductId = 2;
      } else {
        return res.status(400).json({
          message: "Unable to identify milk inventory item",
        });
      }
    }

    if (!inventoryProductId) {
      return res.status(400).json({
        message: "Inventory product ID not found",
      });
    }

    // ========================================
    // RESTORE INVENTORY FIRST
    // ========================================

    let inventoryRestored = false;

    try {
      const restoreResponse = await fetch(
        `${process.env.INVENTORY_SERVICE_URL}/inventory/${order.product_type}/${inventoryProductId}/increase`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            quantity: Number(order.quantity),
          }),
        },
      );

      if (!restoreResponse.ok) {
        const restoreError = await restoreResponse.text();

        console.error(
          "Inventory restore failed:",
          restoreResponse.status,
          restoreError,
        );

        return res.status(503).json({
          message: "Unable to restore inventory. Order was not cancelled.",
        });
      }

      inventoryRestored = true;

      console.log(
        `Inventory restored for cancelled order #${orderId}: ` +
          `${order.product_type}/${inventoryProductId} +${order.quantity}`,
      );
    } catch (inventoryError) {
      console.error(
        "Inventory Service Error during cancellation:",
        inventoryError.message,
      );

      return res.status(503).json({
        message: "Inventory Service unavailable. Order was not cancelled.",
      });
    }

    // ========================================
    // UPDATE ORDER STATUS
    // ========================================

    const updateQuery = `
      UPDATE orders
      SET status = 'CANCELLED'
      WHERE id = ?
      AND user_id = ?
    `;

    db.query(updateQuery, [orderId, userId], async (updateError) => {
      if (updateError) {
        console.error("Cancel order update error:", updateError);

        // Compensation:
        // inventory was restored, but DB update failed.
        // Reduce stock again to return system to previous state.
        if (inventoryRestored) {
          try {
            const rollbackResponse = await fetch(
              `${process.env.INVENTORY_SERVICE_URL}/inventory/${order.product_type}/${inventoryProductId}/reduce`,
              {
                method: "PATCH",

                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  quantity: Number(order.quantity),
                }),
              },
            );

            if (!rollbackResponse.ok) {
              console.error(
                "CRITICAL: Cancellation inventory rollback failed",
                rollbackResponse.status,
                await rollbackResponse.text(),
              );
            } else {
              console.log(`Inventory rollback completed for order #${orderId}`);
            }
          } catch (rollbackError) {
            console.error(
              "CRITICAL: Cancellation inventory rollback error:",
              rollbackError.message,
            );
          }
        }

        return res.status(500).json({
          message: "Unable to cancel order",
        });
      }

      // ========================================
      // SEND CANCELLATION NOTIFICATION
      // ========================================

      try {
        const notificationResponse = await fetch(
          `${process.env.NOTIFICATION_SERVICE_URL}/notifications`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers["authorization"],
            },

            body: JSON.stringify({
              orderId: orderId,
              type: "ORDER_CANCELLED",
              message: `Your Fresh Farm order #${orderId} has been cancelled`,
            }),
          },
        );

        if (!notificationResponse.ok) {
          console.error(
            "Cancellation notification failed:",
            notificationResponse.status,
            await notificationResponse.text(),
          );
        }
      } catch (notificationError) {
        console.error("Notification Service Error:", notificationError.message);
      }

      return res.status(200).json({
        message: "Order cancelled successfully and inventory restored",
      });
    });
  });
});

// ========================================
// UPDATE PAYMENT STATUS
// ========================================

app.patch("/orders/:id/payment-status", verifyToken, (req, res) => {
  const orderId = req.params.id;

  const userId = req.user.id;

  const { status } = req.body;

  if (status !== "PAID") {
    return res.status(400).json({
      message: "Invalid payment status",
    });
  }

  const checkQuery = `
      SELECT *
      FROM orders
      WHERE id = ?
      AND user_id = ?
    `;

  db.query(checkQuery, [orderId, userId], (error, results) => {
    if (error) {
      console.error(error);

      return res.status(500).json({
        message: "Database error",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = results[0];

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        message: "Cancelled order cannot be paid",
      });
    }

    if (order.status === "PAID") {
      return res.status(200).json({
        message: "Order already marked as paid",
      });
    }

    const updateQuery = `
          UPDATE orders
          SET status = 'PAID'
          WHERE id = ?
          AND user_id = ?
        `;

    db.query(updateQuery, [orderId, userId], (error) => {
      if (error) {
        console.error(error);

        return res.status(500).json({
          message: "Unable to update payment status",
        });
      }

      res.status(200).json({
        message: "Order payment status updated",
      });
    });
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`Order Service running on http://localhost:${PORT}`);
});
