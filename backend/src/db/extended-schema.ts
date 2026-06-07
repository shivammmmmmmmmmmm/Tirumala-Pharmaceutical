import { query, run, getActiveDriver } from './index.js'

const EXTENDED_TABLES_SQLITE = `
  CREATE TABLE IF NOT EXISTS sp_territories (
    id TEXT PRIMARY KEY,
    sp_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    address TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    doc_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  CREATE INDEX IF NOT EXISTS idx_products_ingredients ON products(ingredients);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    order_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    requires_action INTEGER NOT NULL DEFAULT 0,
    action_type TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

  CREATE TABLE IF NOT EXISTS stock_adjustments (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT,
    admin_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS backup_history (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    table_counts TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`

const EXTENDED_TABLES_MYSQL = `
  CREATE TABLE IF NOT EXISTS sp_territories (
    id VARCHAR(36) PRIMARY KEY,
    sp_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    notes TEXT NULL,
    is_active TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sp_territories_sp (sp_id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NULL,
    entity_id VARCHAR(36) NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_created (created_at)
  );

  CREATE TABLE IF NOT EXISTS areas (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    is_active TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_documents (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    is_active TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cart (user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    order_id VARCHAR(36) NULL,
    is_read TINYINT NOT NULL DEFAULT 0,
    requires_action TINYINT NOT NULL DEFAULT 0,
    action_type VARCHAR(50) NULL,
    metadata TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user (user_id, created_at)
  );

  CREATE TABLE IF NOT EXISTS stock_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    delta INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reason TEXT NULL,
    admin_id VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backup_history (
    id VARCHAR(36) PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    table_counts TEXT NULL,
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`

const AREA_COLS_SQLITE = ['latitude REAL', 'longitude REAL', 'source_mode TEXT']
const AREA_COLS_MYSQL = ['latitude DECIMAL(10,7) NULL', 'longitude DECIMAL(10,7) NULL', "source_mode ENUM('ONLINE','OFFLINE') NULL"]

const USER_COLUMNS = [
  `approval_status TEXT DEFAULT 'APPROVED'`,
  `area_id TEXT`,
  `aadhaar_url TEXT`,
  `photo_url TEXT`,
  `bank_account TEXT`,
  `bank_ifsc TEXT`,
  `bank_name TEXT`,
  `oauth_provider TEXT`,
  `oauth_provider_id TEXT`,
  `sp_referral_code TEXT`,
  `billing_address TEXT`,
  `shipping_address TEXT`,
  `latitude REAL`,
  `longitude REAL`,
  `referred_by_sp_code TEXT`,
  `rejection_remark TEXT`,
  `sp_commission_pct REAL`,
  `sp_commission_type TEXT DEFAULT 'PERCENTAGE'`,
  `sp_commission_value REAL`,
]

const USER_COLUMNS_MYSQL = [
  `approval_status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'APPROVED'`,
  `area_id VARCHAR(36) NULL`,
  `aadhaar_url VARCHAR(500) NULL`,
  `photo_url VARCHAR(500) NULL`,
  `bank_account VARCHAR(50) NULL`,
  `bank_ifsc VARCHAR(20) NULL`,
  `bank_name VARCHAR(100) NULL`,
  `oauth_provider VARCHAR(50) NULL`,
  `oauth_provider_id VARCHAR(255) NULL`,
  `sp_referral_code VARCHAR(20) NULL`,
  `billing_address TEXT NULL`,
  `shipping_address TEXT NULL`,
  `latitude DECIMAL(10,7) NULL`,
  `longitude DECIMAL(10,7) NULL`,
  `referred_by_sp_code VARCHAR(20) NULL`,
  `rejection_remark TEXT NULL`,
  `sp_commission_pct DECIMAL(5,2) NULL`,
  `sp_commission_type ENUM('PERCENTAGE','FIXED') DEFAULT 'PERCENTAGE'`,
  `sp_commission_value DECIMAL(12,2) NULL`,
]

export async function ensureExtendedSchema(): Promise<void> {
  const driver = getActiveDriver()
  if (driver === 'sqlite') {
    for (const stmt of EXTENDED_TABLES_SQLITE.split(';').map(s => s.trim()).filter(Boolean)) {
      try {
        await run(stmt)
      } catch {
        /* ignore */
      }
    }
    for (const col of USER_COLUMNS) {
      const name = col.split(' ')[0]
      try {
        await run(`ALTER TABLE users ADD COLUMN ${col}`)
      } catch {
        /* exists */
      }
    }
    // Add missing orders columns
    const ordersCols = [
      'gst_amount REAL',
      'tracking_code TEXT',
      'delivery_notes TEXT',
      'packed_at TEXT',
      'receipt_status TEXT DEFAULT "PENDING"',
      'receipt_notified_at TEXT',
      'receipt_confirmed_at TEXT',
      'receipt_remark TEXT',
      'payment_screenshot_url TEXT',
      'delivery_screenshot_url TEXT',
      'customer_delivery_status TEXT DEFAULT "NONE"',
      'delivery_message_sent_at TEXT',
      'remark_from_customer TEXT',
      // New workflow columns
      'payment_verified_at TEXT',
      'payment_verified_by TEXT',
      'dispatch_requested_at TEXT',
    ]
    for (const col of ordersCols) {
      try {
        await run(`ALTER TABLE orders ADD COLUMN ${col}`)
      } catch {
        /* exists */
      }
    }
  } else {
    for (const stmt of EXTENDED_TABLES_MYSQL.split(';').map(s => s.trim()).filter(Boolean)) {
      try {
        await run(stmt)
      } catch {
        /* ignore */
      }
    }
    for (const col of USER_COLUMNS_MYSQL) {
      try {
        await run(`ALTER TABLE users ADD COLUMN ${col}`)
      } catch {
        /* exists */
      }
    }
    // Add missing orders columns for MySQL
    const ordersCols = [
      'gst_amount DECIMAL(12,2) DEFAULT 0',
      'tracking_code VARCHAR(100) NULL',
      'delivery_notes TEXT NULL',
      'packed_at DATETIME NULL',
      "receipt_status ENUM('PENDING','AWAITING_CUSTOMER','CONFIRMED','DISPUTED') DEFAULT 'PENDING'",
      'receipt_notified_at DATETIME NULL',
      'receipt_confirmed_at DATETIME NULL',
      'receipt_remark TEXT NULL',
      'payment_screenshot_url VARCHAR(500) NULL',
      'delivery_screenshot_url VARCHAR(500) NULL',
      "customer_delivery_status ENUM('NONE','AWAITING_RESPONSE','CONFIRMED','DISPUTED') DEFAULT 'NONE'",
      'delivery_message_sent_at DATETIME NULL',
      'remark_from_customer TEXT NULL',
      // New workflow columns
      'payment_verified_at DATETIME NULL',
      'payment_verified_by VARCHAR(36) NULL',
      'dispatch_requested_at DATETIME NULL',
    ]
    for (const col of ordersCols) {
      try {
        await run(`ALTER TABLE orders ADD COLUMN ${col}`)
      } catch {
        /* exists */
      }
    }
  }

  // Seed default areas if empty
  const areaCount = await query<{ c: number }>('SELECT COUNT(*) as c FROM areas')
  if (Number(areaCount[0]?.c ?? 0) === 0) {
    const areas = [
      ['area-north', 'North Zone'],
      ['area-south', 'South Zone'],
      ['area-east', 'East Zone'],
      ['area-west', 'West Zone'],
    ]
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    for (const [id, name] of areas) {
      await run(
        `INSERT INTO areas (id, name, is_active, created_at, updated_at) VALUES (?,?,1,?,?)`,
        [id, name, ts, ts]
      )
    }
  }

  // Backfill product ingredients for search demo
  const updates: [string, string][] = [
    ['prod-001', 'Paracetamol'],
    ['prod-002', 'Amoxicillin'],
    ['prod-003', 'Metformin'],
    ['prod-004', 'Atorvastatin'],
    ['prod-005', 'Omeprazole'],
    ['prod-006', 'Cetirizine'],
    ['prod-007', 'Azithromycin'],
    ['prod-008', 'Pantoprazole'],
    ['prod-009', 'Amlodipine'],
    ['prod-010', 'Montelukast'],
  ]
  const PRODUCT_COLS = ['expiry_date TEXT', 'gst_pct REAL DEFAULT 12', 'batch_number TEXT']
  const PRODUCT_COLS_MYSQL = [
    'expiry_date DATE NULL',
    'gst_pct DECIMAL(5,2) DEFAULT 12',
    'batch_number VARCHAR(50) NULL',
  ]
  const ORDER_COLS = [
    'gst_amount REAL DEFAULT 0',
    'tracking_code TEXT',
    'delivery_notes TEXT',
    'payment_screenshot_url TEXT',
    'receipt_status TEXT DEFAULT "NONE"',
    'receipt_remark TEXT',
    'receipt_confirmed_at TEXT',
    'receipt_notified_at TEXT',
    'delivery_screenshot_url TEXT',
    'customer_delivery_status TEXT DEFAULT "NONE"',
    'delivery_message_sent_at TEXT',
    'remark_from_customer TEXT',
  ]
  const ORDER_COLS_MYSQL = [
    'gst_amount DECIMAL(12,2) DEFAULT 0',
    'tracking_code VARCHAR(100) NULL',
    'delivery_notes TEXT NULL',
    'payment_screenshot_url VARCHAR(500) NULL',
    "receipt_status ENUM('NONE','AWAITING_CUSTOMER','CONFIRMED','DISPUTED') DEFAULT 'NONE'",
    'receipt_remark TEXT NULL',
    'receipt_confirmed_at DATETIME NULL',
    'receipt_notified_at DATETIME NULL',
    'delivery_screenshot_url VARCHAR(500) NULL',
    "customer_delivery_status ENUM('NONE','AWAITING_RESPONSE','CONFIRMED','DISPUTED') DEFAULT 'NONE'",
    'delivery_message_sent_at DATETIME NULL',
    'remark_from_customer TEXT NULL',
  ]

  const pCols = driver === 'sqlite' ? PRODUCT_COLS : PRODUCT_COLS_MYSQL
  const oCols = driver === 'sqlite' ? ORDER_COLS : ORDER_COLS_MYSQL
  const aCols = driver === 'sqlite' ? AREA_COLS_SQLITE : AREA_COLS_MYSQL
  for (const col of pCols) {
    try {
      await run(`ALTER TABLE products ADD COLUMN ${col}`)
    } catch {
      /* exists */
    }
  }
  for (const col of oCols) {
    try {
      await run(`ALTER TABLE orders ADD COLUMN ${col}`)
    } catch {
      /* exists */
    }
  }
  for (const col of aCols) {
    try {
      await run(`ALTER TABLE areas ADD COLUMN ${col}`)
    } catch {
      /* exists */
    }
  }

  // Seed categories from products if empty
  const catCount = await query<{ c: number }>('SELECT COUNT(*) as c FROM categories')
  if (Number(catCount[0]?.c ?? 0) === 0) {
    const distinct = await query<{ category: string }>(
      "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != ''"
    )
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    for (const row of distinct) {
      try {
        await run(
          'INSERT INTO categories (id, name, is_active, created_at, updated_at) VALUES (?,?,1,?,?)',
          [`cat-${row.category.toLowerCase().replace(/\s+/g, '-')}`, row.category, ts, ts]
        )
      } catch {
        /* duplicate */
      }
    }
  }

  // Backfill sales person referral codes
  const spsWithoutCode = await query<{ id: string }>(
    "SELECT id FROM users WHERE role='SALES_PERSON' AND (sp_referral_code IS NULL OR sp_referral_code = '')"
  )
  for (const sp of spsWithoutCode) {
    const code = `SP-${sp.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
    try {
      await run('UPDATE users SET sp_referral_code=? WHERE id=?', [code, sp.id])
    } catch {
      /* ignore */
    }
  }

  for (const [id, ing] of updates) {
    try {
      await run(
        `UPDATE products SET ingredients = COALESCE(ingredients, ?), strength = COALESCE(strength, '500mg') WHERE id = ?`,
        [ing, id]
      )
    } catch {
      /* ignore */
    }
  }
}
