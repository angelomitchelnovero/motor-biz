import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';
import { recordMovement, stockOnHand } from '../services/stockLedger';

export function registerStockHandlers(): void {
  ipcMain.handle('stock:receive', (_e, input: { item_id: number; qty: number; unit_cost: number; supplier_id?: number | null; reason?: string }) => {
    const u = requireUser();
    assertCan(u.role, 'stock.receive');
    if (input.qty <= 0) throw new Error('qty must be > 0');
    const db = getDb();
    const item = db.prepare(`SELECT id FROM items WHERE id = ?`).get(input.item_id);
    if (!item) throw new Error('Item not found');
    const movId = recordMovement(db, {
      item_id: input.item_id,
      type: 'receive',
      qty: input.qty,
      unit_cost: input.unit_cost ?? 0,
      reference_type: input.supplier_id ? 'supplier' : null,
      reference_id: input.supplier_id ?? null,
      reason: input.reason ?? null,
      user_id: u.id,
    });
    record(db, u.id, 'stock_receive', 'items', input.item_id, null, { qty: input.qty, unit_cost: input.unit_cost });
    return db.prepare(`
      SELECT m.*, i.name as item_name, u.full_name as user_name
      FROM stock_movements m
      LEFT JOIN items i ON i.id = m.item_id
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(movId);
  });

  ipcMain.handle('stock:adjust', (_e, input: { item_id: number; qty_delta: number; reason: string }) => {
    const u = requireUser();
    assertCan(u.role, 'stock.adjust');
    if (!input.reason) throw new Error('Adjustment reason is required');
    if (input.qty_delta === 0) throw new Error('qty_delta cannot be 0');
    const db = getDb();
    const current = stockOnHand(db, input.item_id);
    if (current + input.qty_delta < 0) throw new Error('Adjustment would push stock negative');
    const movId = recordMovement(db, {
      item_id: input.item_id,
      type: 'adjust',
      qty: input.qty_delta,
      reason: input.reason,
      user_id: u.id,
    });
    record(db, u.id, 'stock_adjust', 'items', input.item_id, null, { delta: input.qty_delta, reason: input.reason });
    return db.prepare(`
      SELECT m.*, i.name as item_name, u.full_name as user_name
      FROM stock_movements m
      LEFT JOIN items i ON i.id = m.item_id
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(movId);
  });

  ipcMain.handle('stock:listMovements', (_e, item_id: number, limit = 50) => {
    const u = requireUser();
    assertCan(u.role, 'stock.read');
    const db = getDb();
    return db.prepare(`
      SELECT m.*, i.name as item_name, u.full_name as user_name
      FROM stock_movements m
      LEFT JOIN items i ON i.id = m.item_id
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.item_id = ?
      ORDER BY m.id DESC
      LIMIT ?
    `).all(item_id, limit);
  });

  ipcMain.handle('stock:stockOnHand', () => {
    const u = requireUser();
    assertCan(u.role, 'stock.read');
    const db = getDb();
    return db.prepare(`
      SELECT
        i.id AS item_id, i.sku, i.name, i.category, i.unit,
        COALESCE(SUM(CASE
          WHEN m.type IN ('receive','transfer_in','refund_in') THEN m.qty
          WHEN m.type IN ('sold','used_in_jo','transfer_out','return_supplier','damaged') THEN -m.qty
          WHEN m.type = 'adjust' THEN m.qty
          ELSE 0
        END), 0) AS qty,
        i.cost, i.reorder_point,
        CASE WHEN COALESCE(SUM(CASE
          WHEN m.type IN ('receive','transfer_in','refund_in') THEN m.qty
          WHEN m.type IN ('sold','used_in_jo','transfer_out','return_supplier','damaged') THEN -m.qty
          WHEN m.type = 'adjust' THEN m.qty
          ELSE 0
        END), 0) <= i.reorder_point THEN 1 ELSE 0 END AS below_reorder
      FROM items i
      LEFT JOIN stock_movements m ON m.item_id = i.id
      WHERE i.active = 1
      GROUP BY i.id
      ORDER BY i.name
    `).all().map((r: any) => ({ ...r, qty: r.qty || 0, value: (r.qty || 0) * r.cost, below_reorder: !!r.below_reorder }));
  });
}