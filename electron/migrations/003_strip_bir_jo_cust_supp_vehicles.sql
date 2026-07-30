-- 003_strip_bir_jo_cust_supp_vehicles.sql
-- Beginner-friendly refactor: drop BIR / JO / mechanic / supplier / vehicle / customer /
-- multi-tender. Keep login + roles + items + sales + stock + settings (trimmed).
-- Upgrades an existing inv-app.db in place. Idempotent via guarded rebuilds.
--
-- Run wrapped by the migration runner in PRAGMA foreign_keys = OFF; BEGIN; ... COMMIT;
-- (see db.ts). The runner also takes a per-migration transaction around db.exec(),
-- which gives us one all-or-nothing upgrade.

-- =============================================================================
-- 1. DROP legacy tables (FK-safe leaf-first order)
-- =============================================================================
DROP TABLE IF EXISTS jo_status_log;       -- refs job_orders
DROP TABLE IF EXISTS jo_lines;            -- refs job_orders, items, users
DROP TABLE IF EXISTS job_orders;          -- refs customers, vehicles, users
DROP TABLE IF EXISTS item_suppliers;      -- refs items, suppliers
DROP TABLE IF EXISTS receipt_series;      -- no FKs but standalone
DROP TABLE IF EXISTS payments;            -- subsumed into sales.payment_method + tendered
DROP TABLE IF EXISTS vehicles;            -- refs customers
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;

-- =============================================================================
-- 2. sales — rebuild into the slim shape
-- Old: document_type, series_id, vehicle_id, jo_id, customer_id, sc_pwd_*,
--      vatable_sale, vat_exempt, zero_rated, vat_amount, discount_total,
--      six tender_* columns.
-- New: payment_method + tendered (collapsed from payments + old tender_* rollups)
-- =============================================================================
CREATE TABLE sales_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_number     TEXT NOT NULL UNIQUE,
  cashier_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN ('cash','gcash','card','other')),
  tendered        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  change_due      REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed','voided')),
  void_reason     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Indexes on _new tables are skipped; they are recreated after RENAME below.

-- Back-fill from legacy rows. Collapse the six tender_* columns into a single
-- method + amount. Pick the most common method that contributed > 0; tie-break
-- to the earliest non-cash. Fall back to 'cash' if nothing was recorded.
INSERT INTO sales_new (
  id, sale_number, cashier_id, payment_method, tendered,
  total, change_due, status, void_reason, created_at
)
SELECT
  s.id,
  -- preserve old sale_number (looks like 'OR-000000001' from BIR series).
  -- It is unique per the old schema, so we keep it as-is. New sales will use SALE-<id>.
  s.sale_number,
  s.cashier_id,
  CASE
    WHEN s.tender_cash   > 0 THEN 'cash'
    WHEN s.tender_gcash  > 0 THEN 'gcash'
    WHEN s.tender_maya   > 0 THEN 'gcash'
    WHEN s.tender_card   > 0 THEN 'card'
    WHEN s.tender_bank   > 0 THEN 'other'
    WHEN s.tender_charge > 0 THEN 'other'
    ELSE 'cash'
  END,
  -- tendered = first non-zero tender for that legacy sale (most shops used one)
  COALESCE(
    NULLIF(s.tender_cash,0),
    NULLIF(s.tender_gcash,0),
    NULLIF(s.tender_maya,0),
    NULLIF(s.tender_card,0),
    NULLIF(s.tender_bank,0),
    NULLIF(s.tender_charge,0),
    s.total
  ),
  s.total,
  s.change_due,
  CASE WHEN s.status = 'refunded' THEN 'voided' ELSE s.status END,
  s.void_reason,
  s.created_at
FROM sales s;

DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;
-- Indices on the new table are dropped with the table itself; recreate them.
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);

-- =============================================================================
-- 3. sale_lines — drop kind/vat_type/mechanic_id
-- All surviving lines come from catalog items (item_id NOT NULL).
-- Old free-text 'service' lines had no item_id; we drop those (they were JO labor
-- and the JO flow is gone).
-- =============================================================================
CREATE TABLE sale_lines_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id       INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id       INTEGER REFERENCES items(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  qty           REAL NOT NULL DEFAULT 1,
  unit_price    REAL NOT NULL DEFAULT 0,
  line_discount REAL NOT NULL DEFAULT 0,
  line_total    REAL NOT NULL DEFAULT 0
);
-- Indexes on _new tables are skipped; they are recreated after RENAME below.

-- Back-fill: only 'part' lines attached to a real item survive.
INSERT INTO sale_lines_new (
  id, sale_id, item_id, description, qty, unit_price, line_discount, line_total
)
SELECT id, sale_id, item_id, description, qty, unit_price, line_discount, line_total
FROM sale_lines
WHERE kind = 'part' AND item_id IS NOT NULL;

DROP TABLE sale_lines;
ALTER TABLE sale_lines_new RENAME TO sale_lines;
CREATE INDEX idx_sale_lines_sale ON sale_lines(sale_id);

-- =============================================================================
-- 4. items — drop part_number, oem_ref, markup_pct, reorder_qty,
--              preferred_supplier_id. Add stock_on_hand as a denormalized cache.
-- =============================================================================
CREATE TABLE items_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sku            TEXT NOT NULL UNIQUE,
  barcode        TEXT UNIQUE,
  name           TEXT NOT NULL,
  category       TEXT,
  brand          TEXT,
  unit           TEXT NOT NULL DEFAULT 'pc'
                 CHECK (unit IN ('pc','set','L','ml','g')),
  cost           REAL NOT NULL DEFAULT 0,
  price          REAL NOT NULL DEFAULT 0,
  reorder_point  INTEGER NOT NULL DEFAULT 0,
  location       TEXT,
  stock_on_hand  REAL NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Indexes on _new tables are skipped; they are recreated after RENAME below.

INSERT INTO items_new (
  id, sku, barcode, name, category, brand, unit,
  cost, price, reorder_point, location,
  stock_on_hand, active, created_at
)
SELECT
  i.id, i.sku, i.barcode, i.name,
  COALESCE(i.category, ''), COALESCE(i.brand, ''), COALESCE(i.unit, 'pc'),
  COALESCE(i.cost, 0),    COALESCE(i.price, 0),
  COALESCE(i.reorder_point, 0),
  COALESCE(i.location, ''),
  -- back-fill stock_on_hand from the ledger (excluding removed movement types).
  COALESCE((
    SELECT SUM(
      CASE
        WHEN m.type IN ('receive','refund_in') THEN m.qty
        WHEN m.type IN ('sold')                THEN -m.qty
        WHEN m.type = 'adjust'                 THEN m.qty
        ELSE 0
      END
    )
    FROM stock_movements m
    WHERE m.item_id = i.id
  ), 0),
  i.active, i.created_at
FROM items i;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
CREATE INDEX idx_items_name    ON items(name);
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_sku     ON items(sku);
CREATE INDEX idx_items_category ON items(category);

-- =============================================================================
-- 5. stock_movements — drop enum values used only by JO/Supplier flows
-- =============================================================================
CREATE TABLE stock_movements_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id        INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  type           TEXT NOT NULL
                 CHECK (type IN ('receive','adjust','sold','refund_in')),
  qty            REAL NOT NULL,
  unit_cost      REAL NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id   INTEGER,
  reason         TEXT,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Indexes on _new tables are skipped; they are recreated after RENAME below.

-- Back-fill only the surviving types. Rows with other types are dropped
-- (transfer_out/in, return_supplier, damaged, used_in_jo — all JO/Supplier only).
INSERT INTO stock_movements_new (
  id, item_id, type, qty, unit_cost,
  reference_type, reference_id, reason, user_id, created_at
)
SELECT id, item_id, type, qty, COALESCE(unit_cost, 0),
       reference_type, reference_id, reason, user_id, created_at
FROM stock_movements
WHERE type IN ('receive','adjust','sold','refund_in');

DROP TABLE stock_movements;
ALTER TABLE stock_movements_new RENAME TO stock_movements;
CREATE INDEX idx_stock_mov_item ON stock_movements(item_id, created_at);
CREATE INDEX idx_stock_mov_ref  ON stock_movements(reference_type, reference_id);

-- =============================================================================
-- 6. users — collapse Role enum (drop mechanic/inv_clerk/accountant/auditor)
-- Pre-existing users in those roles get reclassified:
--   mechanic     → stock_clerk
--   inv_clerk    → stock_clerk
--   accountant   → manager
--   auditor      → manager
-- This is the smallest surprise for owners who had set those roles.
-- =============================================================================
CREATE TABLE users_new (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL
                       CHECK (role IN ('owner','manager','cashier','stock_clerk')),
  full_name            TEXT NOT NULL,
  active               INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at        TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (
  id, username, password_hash, role, full_name,
  active, must_change_password, last_login_at, created_at
)
SELECT
  id, username, password_hash,
  CASE role
    WHEN 'mechanic'   THEN 'stock_clerk'
    WHEN 'inv_clerk'  THEN 'stock_clerk'
    WHEN 'accountant' THEN 'manager'
    WHEN 'auditor'    THEN 'manager'
    ELSE role
  END,
  full_name, active, must_change_password, last_login_at, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- =============================================================================
-- 7. settings — strip BIR / discount / branch keys. Re-seed shop info.
-- =============================================================================
DELETE FROM settings WHERE key IN (
  'tin', 'vat_reg_tin',
  'bir_atp_sn', 'bir_atp_min', 'bir_atp_date',
  'vat_mode',
  'sc_discount_pct', 'pwd_discount_pct',
  'default_branch', 'default_terminal'
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('business_name', '"My Motor Shop"'),
  ('address1',      '"123 Mabini Street"'),
  ('address2',      '"Quezon City, Metro Manila"');

-- =============================================================================
-- 8. Re-seed sample items (in the new schema, no supplier fields)
-- The 20 motor-shop staples survive in the slim column set.
-- =============================================================================
INSERT OR IGNORE INTO items
  (sku, barcode, name, category, brand, unit, cost, price, reorder_point, location, stock_on_hand)
VALUES
  ('OIL-10W40-1L',    '4800000000001', 'Yamaha Engine Oil 10W40 1L',  'Lubricant',  'Yamalube',    'L',   180,  280, 10, 'A1', 0),
  ('OIL-20W40-1L',    '4800000000002', 'Honda Engine Oil 20W40 1L',   'Lubricant',  'Honda',       'L',   165,  260, 10, 'A1', 0),
  ('BRK-PAD-FR',      '4800000000003', 'Front Brake Pad (Universal)', 'Brake',      'Aftermarket', 'set', 120,  250,  5, 'B1', 0),
  ('BRK-PAD-RR',      '4800000000004', 'Rear Brake Pad (Universal)',  'Brake',      'Aftermarket', 'set',  90,  200,  5, 'B1', 0),
  ('TIRE-90-80-17',   '4800000000005', 'Tire 90/80-17',               'Tire',       'IRC',         'pc',  950, 1450,  4, 'C1', 0),
  ('TIRE-110-70-17',  '4800000000006', 'Tire 110/70-17',              'Tire',       'IRC',         'pc', 1100, 1700,  4, 'C1', 0),
  ('BAT-12V-5AH',     '4800000000007', 'Battery 12V 5Ah (YTX5L-BS)',  'Battery',    'Motolite',    'pc',  950, 1450,  3, 'D1', 0),
  ('SPARK-NGK-CR7HSA','4800000000008', 'Spark Plug NGK CR7HSA',       'Engine',     'NGK',         'pc',   85,  160, 20, 'A2', 0),
  ('AIR-FILT-XRM',    '4800000000009', 'Air Filter Element (XRM 125)','Engine',     'Honda',       'pc',  110,  220,  5, 'A2', 0),
  ('CHAIN-428H-110L', '4800000000010', 'Chain 428H 110L',             'Drive',      'DID',         'pc',  380,  650,  3, 'B2', 0),
  ('SPROCKET-FR-15T', '4800000000011', 'Front Sprocket 15T (428)',    'Drive',      'Aftermarket', 'pc',   95,  200,  5, 'B2', 0),
  ('SPROCKET-RR-45T', '4800000000012', 'Rear Sprocket 45T (428)',     'Drive',      'Aftermarket', 'pc',  220,  420,  5, 'B2', 0),
  ('BULB-H4-12V',     '4800000000013', 'Headlight Bulb H4 12V',       'Electrical', 'Philips',     'pc',   75,  150, 10, 'E1', 0),
  ('CABLE-THROTTLE',  '4800000000014', 'Throttle Cable (Universal)',  'Control',    'Aftermarket', 'pc',   60,  130,  5, 'B3', 0),
  ('GREASE-MP-3',     '4800000000015', 'Multi-Purpose Grease 500g',   'Lubricant',  'Caltex',      'g',    95,  180,  8, 'A3', 0),
  ('RAGS-PKG',        '4800000000016', 'Shop Rags (1 kg pack)',       'Supplies',   'Generic',     'set',  50,   90, 10, 'F1', 0),
  ('CLEANER-BRAKE',   '4800000000017', 'Brake Cleaner Spray 500ml',   'Supplies',   'CRC',         'pc',  130,  240,  5, 'F2', 0),
  ('OIL-SEAL-FR',     '4800000000018', 'Fork Oil Seal (Universal)',   'Suspension', 'Athena',      'pc',   85,  180,  4, 'C2', 0),
  ('FUEL-FILT-UNI',   '4800000000019', 'Fuel Filter (Universal)',     'Engine',     'Generic',     'pc',   35,   90, 10, 'A2', 0),
  ('BATT-TERMINAL',   '4800000000020', 'Battery Terminal Pair',       'Electrical', 'Generic',     'set',  45,  100,  5, 'E1', 0);
