import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';

function hydrateCustomer(row: any) {
  return { ...row, active: !!row.active, credit_limit: row.credit_limit ?? 0 };
}

export function registerCustomerHandlers(): void {
  ipcMain.handle('customers:list', (_e, q?: string) => {
    const u = requireUser();
    assertCan(u.role, 'customer.read');
    const db = getDb();
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      return db.prepare(`SELECT * FROM customers WHERE active = 1 AND (name LIKE ? OR code LIKE ? OR contact LIKE ?) ORDER BY name LIMIT 100`)
        .all(like, like, like).map(hydrateCustomer);
    }
    return db.prepare(`SELECT * FROM customers WHERE active = 1 ORDER BY name LIMIT 100`).all().map(hydrateCustomer);
  });

  ipcMain.handle('customers:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'customer.read');
    const row = getDb().prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    if (!row) throw new Error('Customer not found');
    return hydrateCustomer(row);
  });

  ipcMain.handle('customers:create', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'customer.create');
    const db = getDb();
    if (!input.name) throw new Error('name is required');
    if (!input.code) {
      const next = (db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM customers`).get() as any).n;
      input.code = `C${String(next).padStart(5, '0')}`;
    }
    const info = db.prepare(`
      INSERT INTO customers (code, name, contact, address, tin, birthdate, type, credit_limit, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      input.code, input.name,
      input.contact ?? null, input.address ?? null, input.tin ?? null,
      input.birthdate ?? null, input.type ?? 'retail', input.credit_limit ?? 0,
    );
    record(db, u.id, 'create_customer', 'customers', info.lastInsertRowid as number, null, input);
    return hydrateCustomer(db.prepare(`SELECT * FROM customers WHERE id = ?`).get(info.lastInsertRowid));
  });

  ipcMain.handle('customers:update', (_e, id: number, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'customer.update');
    const db = getDb();
    const before = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    if (!before) throw new Error('Customer not found');
    const fields = ['name','contact','address','tin','birthdate','type','credit_limit','active'];
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
      db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
    record(db, u.id, 'update_customer', 'customers', id, before, input);
    return hydrateCustomer(db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id));
  });
}