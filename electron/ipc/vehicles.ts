import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';

function hydrate(row: any) {
  return {
    ...row,
    active: !!row.active,
    current_odometer: row.current_odometer ?? 0,
    customer_name: row.customer_name ?? null,
  };
}

export function registerVehicleHandlers(): void {
  ipcMain.handle('vehicles:list', (_e, q?: string) => {
    const u = requireUser();
    assertCan(u.role, 'vehicle.read');
    const db = getDb();
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      return db.prepare(`
        SELECT v.*, c.name AS customer_name FROM vehicles v
        JOIN customers c ON c.id = v.customer_id
        WHERE v.active = 1 AND (v.plate_number LIKE ? OR c.name LIKE ? OR v.make LIKE ? OR v.model LIKE ?)
        ORDER BY v.plate_number LIMIT 100
      `).all(like, like, like, like).map(hydrate);
    }
    return db.prepare(`
      SELECT v.*, c.name AS customer_name FROM vehicles v
      JOIN customers c ON c.id = v.customer_id
      WHERE v.active = 1 ORDER BY v.plate_number LIMIT 100
    `).all().map(hydrate);
  });

  ipcMain.handle('vehicles:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'vehicle.read');
    const row = getDb().prepare(`
      SELECT v.*, c.name AS customer_name FROM vehicles v
      JOIN customers c ON c.id = v.customer_id WHERE v.id = ?
    `).get(id);
    if (!row) throw new Error('Vehicle not found');
    return hydrate(row);
  });

  ipcMain.handle('vehicles:lookupByPlate', (_e, plate: string) => {
    const u = requireUser();
    assertCan(u.role, 'vehicle.read');
    const norm = plate.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!norm) return null;
    const row = getDb().prepare(`
      SELECT v.*, c.name AS customer_name,
        (SELECT MAX(created_at) FROM job_orders j WHERE j.vehicle_id = v.id) AS last_service
      FROM vehicles v JOIN customers c ON c.id = v.customer_id
      WHERE UPPER(REPLACE(v.plate_number,' ','')) LIKE UPPER(REPLACE(?,' ','')) || '%'
      LIMIT 1
    `).get(norm);
    return row ? hydrate(row) : null;
  });

  ipcMain.handle('vehicles:create', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'vehicle.create');
    const db = getDb();
    if (!input.plate_number) throw new Error('plate_number is required');
    if (!input.customer_id) throw new Error('customer_id is required');
    const exists = db.prepare(`SELECT 1 FROM vehicles WHERE plate_number = ?`).get(input.plate_number);
    if (exists) throw new Error('Plate number already exists');
    const info = db.prepare(`
      INSERT INTO vehicles (customer_id, plate_number, make, model, year, color, engine_no, chassis_no, current_odometer, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      input.customer_id, input.plate_number,
      input.make ?? null, input.model ?? null, input.year ?? null,
      input.color ?? null, input.engine_no ?? null, input.chassis_no ?? null,
      input.current_odometer ?? 0,
    );
    record(db, u.id, 'create_vehicle', 'vehicles', info.lastInsertRowid as number, null, input);
    return hydrate(db.prepare(`SELECT v.*, c.name AS customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = ?`).get(info.lastInsertRowid));
  });

  ipcMain.handle('vehicles:update', (_e, id: number, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'vehicle.update');
    const db = getDb();
    const before = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id);
    if (!before) throw new Error('Vehicle not found');
    const fields = ['customer_id','plate_number','make','model','year','color','engine_no','chassis_no','current_odometer','active'];
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
      db.prepare(`UPDATE vehicles SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
    record(db, u.id, 'update_vehicle', 'vehicles', id, before, input);
    return hydrate(db.prepare(`SELECT v.*, c.name AS customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = ?`).get(id));
  });

  ipcMain.handle('vehicles:serviceHistory', (_e, vehicle_id: number) => {
    const u = requireUser();
    assertCan(u.role, 'jo.read');
    return getDb().prepare(`
      SELECT j.*, v.plate_number, c.name AS customer_name,
        (v.make || ' ' || v.model) AS vehicle_label,
        u.full_name AS primary_mechanic_name
      FROM job_orders j
      JOIN vehicles v ON v.id = j.vehicle_id
      JOIN customers c ON c.id = j.customer_id
      LEFT JOIN users u ON u.id = j.primary_mechanic_id
      WHERE j.vehicle_id = ?
      ORDER BY j.created_at DESC
      LIMIT 20
    `).all(vehicle_id);
  });
}