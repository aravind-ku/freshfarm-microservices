const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5003;

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
    console.error("Notification Service MySQL connection failed:");

    console.error(error.message);

    return;
  }

  console.log("Notification Service connected to MySQL");
});

// ========================================
// TEST ROUTE
// ========================================

app.get("/", (req, res) => {
  res.send("Fresh Farm Notification Service is running");
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
// CREATE NOTIFICATION
// ========================================

app.post("/notifications", verifyToken, (req, res) => {
  const userId = req.user.id;

  const { orderId, type, message } = req.body;

  if (!type || !message) {
    return res.status(400).json({
      message: "Notification type and message are required",
    });
  }

  const query = `
      INSERT INTO notifications
      (
        user_id,
        order_id,
        type,
        message,
        status
      )
      VALUES (?, ?, ?, ?, ?)
    `;

  db.query(
    query,
    [userId, orderId || null, type, message, "UNREAD"],
    (error, result) => {
      if (error) {
        console.error("Notification DB Error:", error);

        return res.status(500).json({
          message: "Unable to create notification",
        });
      }

      res.status(201).json({
        message: "Notification created successfully",

        notificationId: result.insertId,
      });
    },
  );
});

// ========================================
// GET USER NOTIFICATIONS
// ========================================

app.get("/notifications", verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
      SELECT
        id,
        order_id,
        type,
        message,
        status,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;

  db.query(query, [userId], (error, results) => {
    if (error) {
      console.error("Notification History Error:", error);

      return res.status(500).json({
        message: "Unable to fetch notifications",
      });
    }

    res.status(200).json({
      message: "Notifications fetched successfully",

      notifications: results,
    });
  });
});

// ========================================
// MARK NOTIFICATION AS READ
// ========================================

app.patch("/notifications/:id/read", verifyToken, (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.id;

  const query = `
      UPDATE notifications
      SET status = 'READ'
      WHERE id = ?
      AND user_id = ?
    `;

  db.query(query, [notificationId, userId], (error, result) => {
    if (error) {
      console.error("Mark Notification Read Error:", error);

      return res.status(500).json({
        message: "Unable to update notification",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.status(200).json({
      message: "Notification marked as read",
    });
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`Notification Service running on http://localhost:${PORT}`);
});
