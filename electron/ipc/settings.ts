import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';

const SETTING_KEYS = ['business_name','address1','address2','tin','vat_reg_tin','bir_atp_sn','bir_atp_min','bir_atp_date','vat_mode','sc_discount_pct','pwd_discount_pct','default_branch','default_terminal'];

function readSettings(): Record<string, any> {
  const db = getDb();
  const out: any = {};
  for (const k of SETTING_KEYS) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(k) as { value: string } | undefined;
    out[k] = row ? safeParse(row.value) : null;
  }
  return out;
}
function safeParse(v: string): any { try { return JSON.parse(v); } catch { return v; } }

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    const u = requireUser();
    assertCan(u.role, 'settings.read');
    return readSettings();
  });

  ipcMain.handle('settings:update', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'settings.write');
    const db = getDb();
    const before = readSettings();
    const upd = db.prepare(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`);
    for (const [k, v] of Object.entries(input)) {
      if (!SETTING_KEYS.includes(k)) continue;
      upd.run(JSON.stringify(v), k);
    }
    record(db, u.id, 'update_settings', 'settings', null, before, input);
    return readSettings();
  });

  ipcMain.handle('settings:listSeries', () => {
    const u = requireUser();
    assertCan(u.role, 'settings.series');
    return getDb().prepare(`SELECT * FROM receipt_series ORDER BY document_type, branch, terminal`).all();
  });

  ipcMain.handle('settings:createSeries', (_e, input: any) => {
    const u = requireUser();
    assertCan(u.role, 'settings.series');
    if (!input.document_type || !['SI','OR'].includes(input.document_type)) throw new Error('document_type must be SI or OR');
    if (!input.prefix || !input.start_no || !input.end_no || input.end_no < input.start_no) throw new Error('invalid range');
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO receipt_series (document_type, branch, terminal, prefix, start_no, end_no, current_no, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(input.document_type, input.branch ?? 'MAIN', input.terminal ?? '01', input.prefix, input.start_no, input.end_no, input.start_no - 1);
    record(db, u.id, 'create_series', 'receipt_series', info.lastInsertRowid as number, null, input);
    return getDb().prepare(`SELECT * FROM receipt_series WHERE id = ?`).get(info.lastInsertRowid);
  });

  ipcMain.handle('settings:setSeriesActive', (_e, id: number, active: boolean) => {
    const u = requireUser();
    assertCan(u.role, 'settings.series');
    getDb().prepare(`UPDATE receipt_series SET active = ? WHERE id = ?`).run(active ? 1 : 0, id);
    record(getDb(), u.id, active ? 'activate_series' : 'deactivate_series', 'receipt_series', id, null, { active });
  });
}