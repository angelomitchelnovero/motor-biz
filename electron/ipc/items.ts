import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';
import { stockOnHand, stockValue } from '../services/stockLedger';

interface ItemRow {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  brand: string;
  unit: string;
  cost: number;
  price: number;
  reorder_point: number;
  location: string;
  active: number;
}

function hydrateItem(row: ItemRow) {
  const db = getDb();
  return {
    ...row,
    active: !!row.active,
    stock_on_hand: stockOnHand(db, row.id),
    stock_value: stockValue(db, row.id),
  };
}

const UPDATABLE = ['barcode','name','category','brand','unit','cost','price','reorder_point','location','active'] as const;

export function registerItemHandlers(): void {
  ipcMain.handle('items:list', (_e, q?: string) => {
    const u = requireUser();
    assertCan(u.role, 'item.read');
    const db = getDb();
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      const rows = db.prepare(
        `SELECT * FROM items
         WHERE active = 1 AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
         ORDER BY name LIMIT 100`,
      ).all(like, like, like) as ItemRow[];
      return rows.map(hydrateItem);
    }
    const rows = db.prepare(`SELECT * FROM items WHERE active = 1 ORDER BY name LIMIT 100`).all() as ItemRow[];
    return rows.map(hydrateItem);
  });

  ipcMain.handle('items:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'item.read');
    const db = getDb();
    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as ItemRow | undefined;
    if (!row) throw new Error('Item not found');
    return hydrateItem(row);
  });

  ipcMain.handle('items:lookupByBarcode', (_e, barcode: string) => {
    const u = requireUser();
    assertCan(u.role, 'item.read');
    const db = getDb();
    const row = db.prepare(`SELECT * FROM items WHERE barcode = ? AND active = 1`).get(barcode) as ItemRow | undefined;
    return row ? hydrateItem(row) : null;
  });

  ipcMain.handle('items:create', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'item.create');
    const db = getDb();
    const exists = db.prepare(`SELECT 1 FROM items WHERE sku = ?`).get(input.sku);
    if (exists) throw new Error('SKU already exists');
    const info = db.prepare(`
      INSERT INTO items (sku, barcode, name, category, brand, unit,
                         cost, price, reorder_point, location, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.sku,
      input.barcode ?? null,
      input.name,
      input.category ?? '',
      input.brand ?? '',
      input.unit ?? 'pc',
      input.cost ?? 0,
      input.price ?? 0,
      input.reorder_point ?? 0,
      input.location ?? '',
      1,
    );
    const id = info.lastInsertRowid as number;
    record(db, u.id, 'create_item', 'items', id, null, input);
    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as ItemRow;
    return hydrateItem(row);
  });

  ipcMain.handle('items:update', (_e, id: number, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'item.update');
    const db = getDb();
    const before = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as ItemRow | undefined;
    if (!before) throw new Error('Item not found');
    const sets: string[] = [];
    const vals: any[] = [];
    for (const f of UPDATABLE) {
      if (input[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(input[f]);
      }
    }
    if (sets.length === 0) return hydrateItem(before);
    vals.push(id);
    db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    record(db, u.id, 'update_item', 'items', id, before, input);
    const after = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as ItemRow;
    return hydrateItem(after);
  });
}