-- 001_init.sql — full schema for InvApp MVP
-- All tables include created_at; soft-delete via `active` flag where it makes sense.

-- ---------- USERS ----------
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','cashier','mechanic','inv_clerk','accountant','auditor')),
  full_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- CUSTOMERS ----------
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  tin TEXT,
  birthdate TEXT,
  type TEXT NOT NULL DEFAULT 'retail' CHECK (type IN ('retail','fleet')),
  credit_limit REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_customers_name ON customers(name);

-- ---------- VEHICLES ----------
CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  plate_number TEXT NOT NULL UNIQUE,
  make TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,
  engine_no TEXT,
  chassis_no TEXT,
  current_odometer INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);

-- ---------- SUPPLIERS ----------
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tin TEXT,
  contact TEXT,
  address TEXT,
  terms TEXT NOT NULL DEFAULT 'cash' CHECK (terms IN ('cash','net30','net60')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- ITEMS ----------
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  part_number TEXT,
  oem_ref TEXT,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'pc' CHECK (unit IN ('pc','set','L','ml','g')),
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  markup_pct REAL NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  reorder_qty INTEGER NOT NULL DEFAULT 0,
  preferred_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  location TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_category ON items(category);

CREATE TABLE item_suppliers (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku TEXT,
  supplier_cost REAL NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  is_preferred INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, supplier_id)
);

-- ---------- STOCK MOVEMENTS (immutable ledger) ----------
CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('receive','adjust','transfer_out','transfer_in','return_supplier','damaged','used_in_jo','sold','refund_in')),
  qty REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id INTEGER,
  reason TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stock_mov_item ON stock_movements(item_id, created_at);
CREATE INDEX idx_stock_mov_ref ON stock_movements(reference_type, reference_id);

-- ---------- JOB ORDERS ----------
CREATE TABLE job_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jo_number TEXT NOT NULL UNIQUE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  complaint TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','awaiting_parts','ready','released','cancelled')),
  current_odometer INTEGER NOT NULL DEFAULT 0,
  primary_mechanic_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  released_at TEXT
);
CREATE INDEX idx_jo_status ON job_orders(status);
CREATE INDEX idx_jo_vehicle ON job_orders(vehicle_id);
CREATE INDEX idx_jo_mechanic ON job_orders(primary_mechanic_id);

CREATE TABLE jo_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jo_id INTEGER NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('part','service')),
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  line_discount REAL NOT NULL DEFAULT 0,
  mechanic_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_jo_lines_jo ON jo_lines(jo_id);

CREATE TABLE jo_status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jo_id INTEGER NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

-- ---------- RECEIPT SERIES (BIR — atomic per txn) ----------
CREATE TABLE receipt_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type TEXT NOT NULL CHECK (document_type IN ('SI','OR')),
  branch TEXT NOT NULL DEFAULT 'MAIN',
  terminal TEXT NOT NULL DEFAULT '01',
  prefix TEXT NOT NULL,
  start_no INTEGER NOT NULL,
  end_no INTEGER NOT NULL,
  current_no INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_no >= start_no),
  CHECK (current_no >= start_no - 1)
);

-- ---------- SALES ----------
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_number TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL CHECK (document_type IN ('SI','OR')),
  series_id INTEGER NOT NULL REFERENCES receipt_series(id) ON DELETE RESTRICT,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  jo_id INTEGER REFERENCES job_orders(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  sc_pwd_discount REAL NOT NULL DEFAULT 0,
  sc_pwd_kind TEXT,
  sc_pwd_id_no TEXT,
  sc_pwd_name TEXT,
  vatable_sale REAL NOT NULL DEFAULT 0,
  vat_exempt REAL NOT NULL DEFAULT 0,
  zero_rated REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  tender_cash REAL NOT NULL DEFAULT 0,
  tender_gcash REAL NOT NULL DEFAULT 0,
  tender_maya REAL NOT NULL DEFAULT 0,
  tender_card REAL NOT NULL DEFAULT 0,
  tender_bank REAL NOT NULL DEFAULT 0,
  tender_charge REAL NOT NULL DEFAULT 0,
  change_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided','refunded')),
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);

CREATE TABLE sale_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('part','service')),
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  line_discount REAL NOT NULL DEFAULT 0,
  vat_type TEXT NOT NULL DEFAULT 'vatable' CHECK (vat_type IN ('vatable','exempt','zero')),
  line_total REAL NOT NULL DEFAULT 0,
  mechanic_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_sale_lines_sale ON sale_lines(sale_id);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash','gcash','maya','card','bank','charge')),
  amount REAL NOT NULL,
  reference_no TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_payments_sale ON payments(sale_id);

-- ---------- AUDIT LOG ----------
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ---------- SETTINGS (key/value JSON) ----------
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
