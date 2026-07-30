// Stock ledger helpers. Reads are computed from `stock_movements` so we don't
// store a stale `qty_on_hand` column that can drift.

import type Database from 'better-sqlite3';

export type StockMovementType = 'receive' | 'adjust' | 'sold' | 'refund_in';

export function stockOnHand(db: Database.Database, itemId: number): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(
      CASE
        WHEN type IN ('receive','refund_in') THEN qty
        WHEN type = 'sold' THEN -qty
        WHEN type = 'adjust' THEN qty  -- signed already
        ELSE 0
      END
    ), 0) AS qty
    FROM stock_movements WHERE item_id = ?
  `).get(itemId) as { qty: number } | undefined;
  return row?.qty ?? 0;
}

// FIFO-ish value: weighted-average cost from recent receives (cheap and good enough for MVP).
export function stockValue(db: Database.Database, itemId: number): number {
  const qty = stockOnHand(db, itemId);
  if (qty <= 0) return 0;
  const row = db.prepare(`
    SELECT CASE WHEN SUM(qty) = 0 THEN 0
                ELSE SUM(qty * unit_cost) / SUM(qty)
           END AS wacost
    FROM stock_movements
    WHERE item_id = ?
      AND type IN ('receive','refund_in')
      AND id >= COALESCE((SELECT id FROM stock_movements WHERE item_id = ? AND type IN ('receive','refund_in') ORDER BY id DESC LIMIT 1 OFFSET 30), 0)
  `).get(itemId, itemId) as { wacost: number | null } | undefined;
  const unit = row?.wacost ?? 0;
  return Math.round(qty * unit * 100) / 100;
}

export function recordMovement(
  db: Database.Database,
  args: {
    item_id: number;
    type: StockMovementType;
    qty: number;        // for 'adjust', may be negative; for others, positive magnitude
    unit_cost?: number;
    reference_type?: string | null;
    reference_id?: number | null;
    reason?: string | null;
    user_id: number | null;
  },
): number {
  const info = db.prepare(`
    INSERT INTO stock_movements (item_id, type, qty, unit_cost, reference_type, reference_id, reason, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    args.item_id,
    args.type,
    args.qty,
    args.unit_cost ?? 0,
    args.reference_type ?? null,
    args.reference_id ?? null,
    args.reason ?? null,
    args.user_id,
  );
  return info.lastInsertRowid as number;
}

export function hasStockForSale(db: Database.Database, itemId: number, qty: number): boolean {
  return stockOnHand(db, itemId) >= qty;
}