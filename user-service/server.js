const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ========================================
// MYSQL DATABASE CONNECTION
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

  console.log("Connected to MySQL database");
});

// ========================================
// TEST API
// ========================================

app.get("/", (req, res) => {
  res.send("Fresh Farm User Service is running");
});

// ========================================
// REGISTER API
// ========================================

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // Check whether email already exists

    const checkEmailQuery = "SELECT * FROM users WHERE email = ?";

    db.query(checkEmailQuery, [email], async (error, results) => {
      if (error) {
        console.error(error);

        return res.status(500).json({
          message: "Database error",
        });
      }

      if (results.length > 0) {
        return res.status(409).json({
          message: "Email already registered",
        });
      }

      // Hash password

      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user

      const insertQuery = `
                    INSERT INTO users
                    (name, email, password)
                    VALUES (?, ?, ?)
                `;

      db.query(insertQuery, [name, email, hashedPassword], (error, result) => {
        if (error) {
          console.error(error);

          return res.status(500).json({
            message: "Unable to register user",
          });
        }

        res.status(201).json({
          message: "User registered successfully",

          user: {
            id: result.insertId,
            name: name,
            email: email,
          },
        });
      });
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ========================================
// LOGIN API
// ========================================

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  const query = "SELECT * FROM users WHERE email = ?";

  db.query(query, [email], async (error, results) => {
    if (error) {
      console.error(error);

      return res.status(500).json({
        message: "Database error",
      });
    }

    // User doesn't exist

    if (results.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = results[0];

    // Compare entered password
    // with hashed password in MySQL

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );

    res.status(200).json({
      message: "Login successful",

      token: token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  });
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

app.get("/profile", verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
        SELECT id, name, email, created_at
        FROM users
        WHERE id = ?
    `;

  db.query(query, [userId], (error, results) => {
    if (error) {
      console.error(error);

      return res.status(500).json({
        message: "Database error",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "Profile fetched successfully",
      user: results[0],
    });
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`User Service running on http://localhost:${PORT}`);
});
