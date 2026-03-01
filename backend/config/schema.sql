CREATE DATABASE IF NOT EXISTS smartshelfx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE smartshelfx;

CREATE TABLE IF NOT EXISTS users (
  id        BIGINT       AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  username  VARCHAR(100) UNIQUE,
  email     VARCHAR(100) NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,
  role      ENUM('ADMIN','MANAGER','VENDOR') NOT NULL DEFAULT 'MANAGER',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id            BIGINT        AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  sku           VARCHAR(50)   NOT NULL UNIQUE,
  category      VARCHAR(100)  NOT NULL,
  vendor_id     BIGINT,
  reorder_level INT           NOT NULL DEFAULT 10,
  current_stock INT           NOT NULL DEFAULT 0,
  unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  expiry_date   DATE,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sku      (sku),
  INDEX idx_category (category),
  INDEX idx_vendor   (vendor_id)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id         BIGINT   AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT   NOT NULL,
  quantity   INT      NOT NULL,
  type       ENUM('IN','OUT') NOT NULL,
  timestamp  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_by BIGINT,
  notes      TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (handled_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_product_time (product_id, timestamp),
  INDEX idx_type         (type)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id         BIGINT   AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT   NOT NULL,
  vendor_id  BIGINT,
  quantity   INT      NOT NULL,
  status     ENUM('PENDING','APPROVED','DISPATCHED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  notes      TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id)  REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_status    (status),
  INDEX idx_vendor_po (vendor_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id         BIGINT     AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT,
  type       ENUM('LOW_STOCK','OUT_OF_STOCK','EXPIRY','RESTOCK_SUGGESTED') NOT NULL,
  message    TEXT       NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_is_read    (is_read),
  INDEX idx_alert_type (type)
);

CREATE TABLE IF NOT EXISTS forecast_results (
  id            BIGINT   AUTO_INCREMENT PRIMARY KEY,
  product_id    BIGINT   NOT NULL,
  forecast_date DATE     NOT NULL,
  predicted_qty FLOAT    NOT NULL DEFAULT 0,
  confidence    FLOAT    NOT NULL DEFAULT 0,
  risk_level    ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_date (product_id, forecast_date),
  INDEX idx_risk_level (risk_level)
);



INSERT IGNORE INTO products (name, sku, category, vendor_id, reorder_level, current_stock, unit_price) VALUES
('Laptop Stand Pro',   'SKU-001', 'Electronics', 3, 15, 5,   29.99),
('Ergonomic Chair',    'SKU-002', 'Furniture',   4, 10, 42,  299.00),
('USB-C Hub 7-in-1',   'SKU-042', 'Electronics', 3, 20, 2,   49.99),
('Wireless Keyboard',  'SKU-087', 'Electronics', 5, 25, 8,   79.99),
('Monitor 27 Inch 4K', 'SKU-103', 'Electronics', 3, 5,  0,   599.00),
('A4 Paper 500pk',     'SKU-120', 'Supplies',    4, 50, 200, 12.99),
('Mechanical Mouse',   'SKU-156', 'Electronics', 5, 30, 11,  59.99),
('Standing Desk',      'SKU-177', 'Furniture',   4, 8,  15,  459.00),
('Thermal Label Roll', 'SKU-201', 'Supplies',    4, 10, 3,   24.99),
('Barcode Scanner',    'SKU-244', 'Electronics', 3, 10, 18,  189.00);

INSERT IGNORE INTO stock_transactions (product_id, quantity, type, handled_by, timestamp, notes) VALUES
(1, 50,  'IN',  2, DATE_SUB(NOW(), INTERVAL 30 DAY), 'Initial stock from PO-2019'),
(1, 30,  'OUT', 2, DATE_SUB(NOW(), INTERVAL 20 DAY), 'Dispatched batch #1'),
(1, 15,  'OUT', 2, DATE_SUB(NOW(), INTERVAL 10 DAY), 'Dispatched batch #2'),
(3, 100, 'IN',  2, DATE_SUB(NOW(), INTERVAL 28 DAY), 'Shipment from TechSupplies'),
(3, 60,  'OUT', 2, DATE_SUB(NOW(), INTERVAL 18 DAY), 'Customer orders'),
(3, 38,  'OUT', 2, DATE_SUB(NOW(), INTERVAL 8 DAY),  'Customer orders'),
(4, 50,  'IN',  2, DATE_SUB(NOW(), INTERVAL 25 DAY), 'Restock from LogiVendor'),
(4, 42,  'OUT', 2, DATE_SUB(NOW(), INTERVAL 7 DAY),  'Sales dispatch'),
(5, 10,  'IN',  2, DATE_SUB(NOW(), INTERVAL 22 DAY), 'Initial stock'),
(5, 10,  'OUT', 2, DATE_SUB(NOW(), INTERVAL 5 DAY),  'Sold out'),
(6, 300, 'IN',  2, DATE_SUB(NOW(), INTERVAL 35 DAY), 'Bulk order'),
(6, 100, 'OUT', 2, DATE_SUB(NOW(), INTERVAL 15 DAY), 'Office dispatch');

INSERT IGNORE INTO alerts (product_id, type, message, is_read) VALUES
(1, 'LOW_STOCK',         'Laptop Stand Pro (SKU-001): only 5 units left (reorder: 15)',   0),
(3, 'LOW_STOCK',         'USB-C Hub 7-in-1 (SKU-042): only 2 units left (reorder: 20)',   0),
(5, 'OUT_OF_STOCK',      'Monitor 27 Inch 4K (SKU-103): completely out of stock!',         0),
(9, 'LOW_STOCK',         'Thermal Label Roll (SKU-201): only 3 units left (reorder: 10)', 0),
(1, 'RESTOCK_SUGGESTED', 'AI suggests restocking Laptop Stand Pro — forecasted demand: 42 units this week', 0);