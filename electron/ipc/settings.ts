import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';

const SETTING_KEYS = ['business_name', 'address1', 'address2'] as const;

function readSettings(): Record<string, any> {
  const db = getDb();
  const out: any = {};
  for (const k of SETTING_KEYS) {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(k) as { value: string } | undefined;
    out[k] = row ? safeParse(row.value) : '';
  }
  return out;
}

function safeParse(v: string): any {
  try { return JSON.parse(v); } catch { return v; }
}

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
    for (const k of SETTING_KEYS) {
      if (input[k] !== undefined) upd.run(JSON.stringify(input[k]), k);
    }
    record(db, u.id, 'update_settings', 'settings', null, before, input);
    return readSettings();
  });
}