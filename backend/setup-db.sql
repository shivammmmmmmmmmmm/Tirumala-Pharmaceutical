-- Medical Distribution System — MySQL Setup
-- Run this in phpMyAdmin or MySQL CLI:
--   mysql -u root -p < setup-db.sql

CREATE DATABASE IF NOT EXISTS medical_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medical_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'SALES_PERSON', 'USER') NOT NULL DEFAULT 'USER',
  organization_name VARCHAR(255),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login DATETIME,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100),
  manufacturer VARCHAR(255),
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category),
  FULLTEXT INDEX idx_products_search (name, description, manufacturer)
) ENGINE=InnoDB;

-- Product Pricing table
CREATE TABLE IF NOT EXISTS product_pricing (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  role ENUM('ADMIN', 'SALES_PERSON', 'USER') NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  min_quantity INT NOT NULL DEFAULT 1,
  max_quantity INT,
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_pricing_product (product_id),
  INDEX idx_pricing_role (role)
) ENGINE=InnoDB;

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  changes JSON,
  ip_address VARCHAR(45),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_resource (resource_id),
  INDEX idx_audit_time (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin user
-- Password: Admin@123
INSERT IGNORE INTO users (id, email, password_hash, name, role, organization_name, is_active)
VALUES (
  'admin-001',
  'admin@medical.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'System Admin',
  'ADMIN',
  'Medical Distribution Co.',
  1
);

-- Sample products
INSERT IGNORE INTO products (id, name, description, sku, category, manufacturer, quantity, reorder_level, is_active) VALUES
('prod-001', 'Paracetamol 500mg', 'Analgesic and antipyretic tablet. Used for fever and mild to moderate pain.', 'PARA-500-001', 'Analgesics', 'Sun Pharma', 10000, 1000, 1),
('prod-002', 'Amoxicillin 250mg', 'Broad-spectrum antibiotic capsule for bacterial infections.', 'AMOX-250-001', 'Antibiotics', 'Cipla', 5000, 500, 1),
('prod-003', 'Metformin 500mg', 'Oral antidiabetic medication for type 2 diabetes management.', 'METF-500-001', 'Antidiabetics', 'Dr. Reddys', 8000, 800, 1),
('prod-004', 'Atorvastatin 10mg', 'Cholesterol-lowering statin tablet for cardiovascular health.', 'ATOR-010-001', 'Cardiovascular', 'Lupin', 6000, 600, 1),
('prod-005', 'Omeprazole 20mg', 'Proton pump inhibitor capsule for acid reflux and ulcers.', 'OMEP-020-001', 'Gastrointestinal', 'Zydus', 7000, 700, 1),
('prod-006', 'Cetirizine 10mg', 'Antihistamine tablet for allergic rhinitis and urticaria.', 'CETI-010-001', 'Antihistamines', 'Mankind', 9000, 900, 1),
('prod-007', 'Azithromycin 500mg', 'Macrolide antibiotic tablet for respiratory and skin infections.', 'AZIT-500-001', 'Antibiotics', 'Cipla', 4000, 400, 1),
('prod-008', 'Pantoprazole 40mg', 'Proton pump inhibitor tablet for gastric acid disorders.', 'PANT-040-001', 'Gastrointestinal', 'Sun Pharma', 5500, 550, 1);

SELECT 'Database setup complete!' as status;
SELECT 'Admin login: admin@medical.com / Admin@123' as credentials;
