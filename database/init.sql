CREATE DATABASE IF NOT EXISTS freshfarm;

USE freshfarm;


-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- ORDERS
-- Supports both MILK and DAIRY products
-- =========================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address VARCHAR(500) NOT NULL,

    milk_type VARCHAR(100) NOT NULL,

    quantity INT NOT NULL,

    product_type VARCHAR(20) NOT NULL DEFAULT 'MILK',
    product_id INT NULL,

    unit_price DECIMAL(10,2) NOT NULL DEFAULT 60.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    status VARCHAR(50) DEFAULT 'PAYMENT_PENDING',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,

    razorpay_order_id VARCHAR(100) NOT NULL,
    razorpay_payment_id VARCHAR(100) NOT NULL,

    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(30) DEFAULT 'SUCCESS',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_razorpay_payment (razorpay_payment_id)
);


-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id INT,

    type VARCHAR(50) NOT NULL,
    message VARCHAR(500) NOT NULL,
    status VARCHAR(30) DEFAULT 'UNREAD',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- INVENTORY
-- Used by Java Spring Boot Inventory Service
-- =========================================================
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,

    product_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    product_type VARCHAR(20) NOT NULL,

    quantity_available INT NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    reorder_level INT NOT NULL DEFAULT 10,

    status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_inventory_product (product_type, product_id)
);


-- =========================================================
-- INITIAL INVENTORY
-- =========================================================

INSERT IGNORE INTO inventory
(product_id, product_name, product_type, quantity_available, unit, reorder_level, status)
VALUES
(1, 'Cow Milk',       'MILK',  100, 'LITRE', 20, 'IN_STOCK'),
(2, 'Buffalo Milk',   'MILK',   80, 'LITRE', 20, 'IN_STOCK'),

(1, 'Fresh Paneer',   'DAIRY',  50, 'PACK',   10, 'IN_STOCK'),
(2, 'Fresh Curd',     'DAIRY',  60, 'PACK',   10, 'IN_STOCK'),
(3, 'Pure Ghee',      'DAIRY',  30, 'BOTTLE',  5, 'IN_STOCK'),
(4, 'Fresh Butter',   'DAIRY',  40, 'PACK',   10, 'IN_STOCK'),
(5, 'Milk Peda',      'DAIRY',  35, 'PACK',   10, 'IN_STOCK'),
(6, 'Kalakand',       'DAIRY',  25, 'PACK',    8, 'IN_STOCK'),
(7, 'Rasgulla',       'DAIRY',  45, 'PACK',   10, 'IN_STOCK'),
(8, 'Gulab Jamun',    'DAIRY',  45, 'PACK',   10, 'IN_STOCK'),
(9, 'Milk Cake',      'DAIRY',  25, 'PACK',    8, 'IN_STOCK'),
(10, 'Khoa',          'DAIRY',  30, 'PACK',    8, 'IN_STOCK');