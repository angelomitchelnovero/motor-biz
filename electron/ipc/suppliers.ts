import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';

function hydrate(row: any) { return { ...row, active: !!row.active }; }

export function registerSupplierHandlers(): void {
  ipcMain.handle('suppliers:list', () => {
    const u = requireUser();
    assertCan(u.role, 'supplier.read');
    return getDb().prepare(`SELECT * FROM suppliers WHERE active = 1 ORDER BY name`).all().map(hydrate);
  });

  ipcMain.handle('suppliers:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'supplier.read');
    const row = getDb().prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id);
    if (!row) throw new Error('Supplier not found');
    return hydrate(row);
  });

  ipcMain.handle('suppliers:create', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'supplier.create');
    if (!input.name) throw new Error('name is required');
    const db = getDb();
    const info = db.prepare(`INSERT INTO suppliers (name, tin, contact, address, terms, active) VALUES (?, ?, ?, ?, ?, 1)`)
      .run(input.name, input.tin ?? null, input.contact ?? null, input.address ?? null, input.terms ?? 'cash');
    record(db, u.id, 'create_supplier', 'suppliers', info.lastInsertRowid as number, null, input);
    return hydrate(db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(info.lastInsertRowid));
  });

  ipcMain.handle('suppliers:update', (_e, id: number, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'supplier.update');
    const db = getDb();
    const before = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id);
    if (!before) throw new Error('Supplier not found');
    const fields = ['name','tin','contact','address','terms','active'];
    const sets: string[] = [];
    const vals: any[] = [];
    for (const f of fields) {
      if (input[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(typeof input[f] === 'boolean' ? (input[f] ? 1 : 0) : input[f]);
      }
    }
    if (sets.length > 0) {
      vals.push(id);
      db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
    record(db, u.id, 'update_supplier', 'suppliers', id, before, input);
    return hydrate(db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id));
  });
}