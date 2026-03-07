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


