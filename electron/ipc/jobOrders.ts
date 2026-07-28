import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';
import { recordMovement } from '../services/stockLedger';
import { lineTotal } from '../services/pricing';

function nextJoNumber(db: ReturnType<typeof getDb>): string {
  const row = db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM job_orders`).get() as { n: number };
  return `JO-${String(row.n).padStart(6, '0')}`;
}

function hydrateJo(row: any) {
  return {
    ...row,
    lines: undefined,
  };
}

export function registerJobOrderHandlers(): void {
  ipcMain.handle('jobOrders:list', (_e, status?: string) => {
    const u = requireUser();
    assertCan(u.role, 'jo.read');
    const db = getDb();
    const where: string[] = [];
    const params: any[] = [];
    if (status && status !== 'all') { where.push('j.status = ?'); params.push(status); }
    if (u.role === 'mechanic') { where.push('j.primary_mechanic_id = ?'); params.push(u.id); }
    const sql = `
      SELECT j.*, v.plate_number, c.name AS customer_name,
        (v.make || ' ' || COALESCE(v.model,'')) AS vehicle_label,
        m.full_name AS primary_mechanic_name,
        cb.full_name AS created_by_name
      FROM job_orders j
      JOIN vehicles v ON v.id = j.vehicle_id
      JOIN customers c ON c.id = j.customer_id
      LEFT JOIN users m ON m.id = j.primary_mechanic_id
      LEFT JOIN users cb ON cb.id = j.created_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY j.created_at DESC LIMIT 200
    `;
    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('jobOrders:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'jo.read');
    const db = getDb();
    const jo = db.prepare(`
      SELECT j.*, v.plate_number, c.name AS customer_name,
        (v.make || ' ' || COALESCE(v.model,'')) AS vehicle_label,
        m.full_name AS primary_mechanic_name,
        cb.full_name AS created_by_name
      FROM job_orders j
      JOIN vehicles v ON v.id = j.vehicle_id
      JOIN customers c ON c.id = j.customer_id
      LEFT JOIN users m ON m.id = j.primary_mechanic_id
      LEFT JOIN users cb ON cb.id = j.created_by
      WHERE j.id = ?
    `).get(id);
    if (!jo) throw new Error('Job order not found');
    if (u.role === 'mechanic' && (jo as any).primary_mechanic_id !== u.id) {
      const e: any = new Error('Forbidden'); e.code = 'FORBIDDEN'; throw e;
    }
    const lines = db.prepare(`
      SELECT l.*, m.full_name AS mechanic_name
      FROM jo_lines l
      LEFT JOIN users m ON m.id = l.mechanic_id
      WHERE l.jo_id = ?
      ORDER BY l.id
    `).all(id);
    return { ...jo, lines };
  });

  ipcMain.handle('jobOrders:create', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'jo.create');
    const db = getDb();
    if (!input.vehicle_id || !input.customer_id) throw new Error('vehicle_id and customer_id required');
    if (!Array.isArray(input.lines) || input.lines.length === 0) throw new Error('At least one line required');

    const jo_number = nextJoNumber(db);
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO job_orders (jo_number, vehicle_id, customer_id, complaint, current_odometer, primary_mechanic_id, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')
      `).run(
        jo_number, input.vehicle_id, input.customer_id,
        input.complaint ?? '', input.current_odometer ?? 0,
        input.primary_mechanic_id ?? null, u.id,
      );
      const joId = info.lastInsertRowid as number;

      const insLine = db.prepare(`
        INSERT INTO jo_lines (jo_id, kind, item_id, description, qty, unit_price, line_discount, mechanic_id, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of input.lines) {
        insLine.run(
          joId, l.kind ?? 'service', l.item_id ?? null, l.description,
          l.qty ?? 1, l.unit_price ?? 0, l.line_discount ?? 0, l.mechanic_id ?? null,
          lineTotal(l.qty ?? 1, l.unit_price ?? 0, l.line_discount ?? 0),
        );
      }

      db.prepare(`INSERT INTO jo_status_log (jo_id, status, changed_by, note) VALUES (?, 'queued', ?, ?)`).run(joId, u.id, 'Created');
      record(db, u.id, 'create_jo', 'job_orders', joId, null, { jo_number, lines: input.lines.length });
      return joId;
    });
    const id = tx();
    return db.prepare(`SELECT * FROM job_orders WHERE id = ?`).get(id);
  });

  ipcMain.handle('jobOrders:updateStatus', (_e, id: number, status: string, note?: string) => {
    const u = requireUser();
    assertCan(u.role, 'jo.change_status');
    const valid = ['queued','in_progress','awaiting_parts','ready','released','cancelled'];
    if (!valid.includes(status)) throw new Error('invalid status');
    const db = getDb();
    const before = db.prepare(`SELECT status FROM job_orders WHERE id = ?`).get(id) as { status: string } | undefined;
    if (!before) throw new Error('JO not found');
    if (u.role === 'mechanic') {
      const owner = db.prepare(`SELECT primary_mechanic_id FROM job_orders WHERE id = ?`).get(id) as { primary_mechanic_id: number | null };
      if (owner.primary_mechanic_id !== u.id) { const e: any = new Error('Forbidden'); e.code = 'FORBIDDEN'; throw e; }
    }
    const completedAt = status === 'ready' ? new Date().toISOString() : null;
    db.prepare(`UPDATE job_orders SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?`)
      .run(status, completedAt, id);
    db.prepare(`INSERT INTO jo_status_log (jo_id, status, changed_by, note) VALUES (?, ?, ?, ?)`)
      .run(id, status, u.id, note ?? null);
    record(db, u.id, 'jo_change_status', 'job_orders', id, { status: before.status }, { status, note });
    return db.prepare(`SELECT * FROM job_orders WHERE id = ?`).get(id);
  });

  ipcMain.handle('jobOrders:assignMechanic', (_e, id: number, mechanic_id: number | null) => {
    const u = requireUser();
    assertCan(u.role, 'jo.assign');
    const db = getDb();
    const before = db.prepare(`SELECT primary_mechanic_id FROM job_orders WHERE id = ?`).get(id) as { primary_mechanic_id: number | null } | undefined;
    if (!before) throw new Error('JO not found');
    db.prepare(`UPDATE job_orders SET primary_mechanic_id = ? WHERE id = ?`).run(mechanic_id, id);
    record(db, u.id, 'jo_assign', 'job_orders', id, before, { mechanic_id });
    return db.prepare(`SELECT * FROM job_orders WHERE id = ?`).get(id);
  });

  ipcMain.handle('jobOrders:addLine', (_e, jo_id: number, line: any) => {
    const u = requireUser();
    assertCan(u.role, 'jo.update');
    const db = getDb();
    const jo = db.prepare(`SELECT status FROM job_orders WHERE id = ?`).get(jo_id);
    if (!jo) throw new Error('JO not found');
    if ((jo as any).status === 'released' || (jo as any).status === 'cancelled') throw new Error('Cannot modify released/cancelled JO');
    const info = db.prepare(`
      INSERT INTO jo_lines (jo_id, kind, item_id, description, qty, unit_price, line_discount, mechanic_id, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jo_id, line.kind ?? 'service', line.item_id ?? null, line.description,
      line.qty ?? 1, line.unit_price ?? 0, line.line_discount ?? 0, line.mechanic_id ?? null,
      lineTotal(line.qty ?? 1, line.unit_price ?? 0, line.line_discount ?? 0),
    );
    record(db, u.id, 'jo_add_line', 'job_orders', jo_id, null, line);
    return db.prepare(`SELECT * FROM jo_lines WHERE id = ?`).get(info.lastInsertRowid);
  });

  ipcMain.handle('jobOrders:removeLine', (_e, jo_id: number, line_id: number) => {
    const u = requireUser();
    assertCan(u.role, 'jo.update');
    const db = getDb();
    db.prepare(`DELETE FROM jo_lines WHERE id = ? AND jo_id = ?`).run(line_id, jo_id);
    record(db, u.id, 'jo_remove_line', 'job_orders', jo_id, null, { line_id });
  });
}