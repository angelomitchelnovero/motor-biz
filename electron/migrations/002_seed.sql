-- 002_seed.sql — minimum data for first run.
-- Idempotent: uses WHERE NOT EXISTS guards so re-runs are safe.

-- Default receipt series: 1 SI + 1 OR per branch MAIN / terminal 01.
-- Series prefixes and ranges can be reconfigured in Settings.
INSERT INTO receipt_series (document_type, branch, terminal, prefix, start_no, end_no, current_no, active)
SELECT 'OR', 'MAIN', '01', 'OR', 1, 999999999, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM receipt_series WHERE document_type = 'OR' AND branch = 'MAIN' AND terminal = '01');

INSERT INTO receipt_series (document_type, branch, terminal, prefix, start_no, end_no, current_no, active)
SELECT 'SI', 'MAIN', '01', 'SI', 1, 999999999, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM receipt_series WHERE document_type = 'SI' AND branch = 'MAIN' AND terminal = '01');

-- Default settings.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('business_name', '"My Motor Shop"'),
  ('address1', '"123 Mabini Street"'),
  ('address2', '"Quezon City, Metro Manila"'),
  ('tin', '"000-000-000-000"'),
  ('vat_reg_tin', '"000-000-000-000"'),
  ('bir_atp_sn', '"ATP-XXX-0000000000-00000"'),
  ('bir_atp_min', '"0000000000"'),
  ('bir_atp_date', '"2026-01-01"'),
  ('vat_mode', '"inclusive"'),
  ('sc_discount_pct', '20'),
  ('pwd_discount_pct', '5'),
  ('default_branch', '"MAIN"'),
  ('default_terminal', '"01"');

-- Sample items — motor-shop staples.
INSERT OR IGNORE INTO items (sku, barcode, part_number, oem_ref, name, category, brand, unit, cost, price, markup_pct, reorder_point, reorder_qty, location)
VALUES
  ('OIL-10W40-1L', '4800000000001', 'YAM-10W40-1L', 'YAM-LUB-10W40', 'Yamaha Engine Oil 10W40 1L', 'Lubricant', 'Yamalube', 'L', 180, 280, 55.56, 10, 24, 'A1'),
  ('OIL-20W40-1L', '4800000000002', 'HON-20W40-1L', 'HON-LUB-20W40', 'Honda Engine Oil 20W40 1L', 'Lubricant', 'Honda', 'L', 165, 260, 57.58, 10, 24, 'A1'),
  ('BRK-PAD-FR',  '4800000000003', 'BRK-FR-001', 'OEM-FR-PAD',  'Front Brake Pad (Universal)', 'Brake', 'Aftermarket', 'set', 120, 250, 108.33, 5, 20, 'B1'),
  ('BRK-PAD-RR',  '4800000000004', 'BRK-RR-001', 'OEM-RR-PAD',  'Rear Brake Pad (Universal)', 'Brake', 'Aftermarket', 'set', 90, 200, 122.22, 5, 20, 'B1'),
  ('TIRE-90-80-17',  '4800000000005', 'TR-908017', 'TR-908017-OEM', 'Tire 90/80-17', 'Tire', 'IRC', 'pc', 950, 1450, 52.63, 4, 12, 'C1'),
  ('TIRE-110-70-17', '4800000000006', 'TR-1107017','TR-1107017-OEM','Tire 110/70-17', 'Tire', 'IRC', 'pc', 1100, 1700, 54.55, 4, 12, 'C1'),
  ('BAT-12V-5AH',   '4800000000007', 'BAT-12V5', 'BAT-12V5-OEM',  'Battery 12V 5Ah (YTX5L-BS)', 'Battery', 'Motolite', 'pc', 950, 1450, 52.63, 3, 10, 'D1'),
  ('SPARK-NGK-CR7HSA', '4800000000008', 'NGK-CR7HSA','NGK-CR7HSA','Spark Plug NGK CR7HSA', 'Engine', 'NGK', 'pc', 85, 160, 88.24, 20, 50, 'A2'),
  ('AIR-FILT-XRM',  '4800000000009', 'AF-XRM-125','HON-AF-XRM','Air Filter Element (XRM 125)', 'Engine', 'Honda', 'pc', 110, 220, 100, 5, 15, 'A2'),
  ('CHAIN-428H-110L','4800000000010', 'CH-428-110','CH-428-110-OEM','Chain 428H 110L', 'Drive', 'DID', 'pc', 380, 650, 71.05, 3, 10, 'B2'),
  ('SPROCKET-FR-15T','4800000000011','SP-FR-15','SP-FR-15-OEM','Front Sprocket 15T (428)', 'Drive', 'Aftermarket', 'pc', 95, 200, 110.53, 5, 15, 'B2'),
  ('SPROCKET-RR-45T','4800000000012','SP-RR-45','SP-RR-45-OEM','Rear Sprocket 45T (428)', 'Drive', 'Aftermarket', 'pc', 220, 420, 90.91, 5, 15, 'B2'),
  ('BULB-H4-12V',   '4800000000013', 'BL-H4-12V','BL-H4-12V-OEM','Headlight Bulb H4 12V', 'Electrical', 'Philips', 'pc', 75, 150, 100, 10, 30, 'E1'),
  ('CABLE-THROTTLE','4800000000014', 'CB-THR-UNI','CB-THR-UNI-OEM','Throttle Cable (Universal)', 'Control', 'Aftermarket', 'pc', 60, 130, 116.67, 5, 15, 'B3'),
  ('GREASE-MP-3',   '4800000000015', 'GR-MP3','GR-MP3-OEM','Multi-Purpose Grease 500g', 'Lubricant', 'Caltex', 'g', 95, 180, 89.47, 8, 20, 'A3'),
  ('RAGS-PKG',      '4800000000016', 'RG-PKG','RG-PKG-OEM','Shop Rags (1 kg pack)', 'Supplies', 'Generic', 'set', 50, 90, 80, 10, 30, 'F1'),
  ('CLEANER-BRAKE', '4800000000017', 'CL-BRK','CL-BRK-OEM','Brake Cleaner Spray 500ml', 'Supplies', 'CRC', 'pc', 130, 240, 84.62, 5, 20, 'F2'),
  ('OIL-SEAL-FR',   '4800000000018', 'OS-FR-UNI','OS-FR-UNI-OEM','Fork Oil Seal (Universal)', 'Suspension', 'Athena', 'pc', 85, 180, 111.76, 4, 12, 'C2'),
  ('FUEL-FILT-UNI', '4800000000019', 'FF-UNI','FF-UNI-OEM','Fuel Filter (Universal)', 'Engine', 'Generic', 'pc', 35, 90, 157.14, 10, 30, 'A2'),
  ('BATT-TERMINAL','4800000000020','BT-TER','BT-TER-OEM','Battery Terminal Pair', 'Electrical', 'Generic', 'set', 45, 100, 122.22, 5, 15, 'E1');
