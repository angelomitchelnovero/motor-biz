// Auth IPC handlers. Session is held in the main process as `currentUser` —
// there's only ever one logged-in user per Electron window by design (single-terminal MVP).

import { ipcMain, app } from 'electron';
import { getDb, verifyPassword, hashPassword } from '../db';
import { record } from '../services/audit';
import { assertCan, type Role } from '../services/permissions';

let currentUser: {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  must_change_password: boolean;
} | null = null;

export function getCurrentUser() { return currentUser; }

export function requireUser() {
  if (!currentUser) {
    const e: any = new Error('Not logged in');
    e.code = 'UNAUTHENTICATED';
    throw e;
  }
  return currentUser;
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', (_e, username: string, password: string) => {
    const db = getDb();
    const row = db.prepare<[string], { id: number; username: string; password_hash: string; role: Role; full_name: string; must_change_password: number; active: number }>(
      `SELECT id, username, password_hash, role, full_name, must_change_password, active FROM users WHERE username = ?`,
    ).get(username);
    if (!row) throw new Error('Invalid username or password');
    if (!row.active) throw new Error('Account is inactive');
    if (!verifyPassword(password, row.password_hash)) throw new Error('Invalid username or password');
    db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(row.id);
    record(db, row.id, 'login', 'users', row.id, null, { username: row.username });
    currentUser = {
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      role: row.role,
      must_change_password: !!row.must_change_password,
    };
    return currentUser;
  });

  ipcMain.handle('auth:logout', () => {
    const u = currentUser;
    if (u) record(getDb(), u.id, 'logout', 'users', u.id, null, null);
    currentUser = null;
  });

  ipcMain.handle('auth:currentUser', () => currentUser);

  ipcMain.handle('auth:changePassword', (_e, oldPassword: string, newPassword: string) => {
    const u = requireUser();
    const db = getDb();
    const row = db.prepare<[number], { password_hash: string }>(`SELECT password_hash FROM users WHERE id = ?`).get(u.id);
    if (!row || !verifyPassword(oldPassword, row.password_hash)) throw new Error('Current password is incorrect');
    if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters');
    db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(hashPassword(newPassword), u.id);
    record(db, u.id, 'change_password', 'users', u.id, null, null);
    currentUser!.must_change_password = false;
  });

  ipcMain.handle('auth:listUsers', () => {
    const u = requireUser();
    assertCan(u.role, 'user.read');
    return getDb().prepare(`SELECT id, username, full_name, role, active, must_change_password, last_login_at FROM users ORDER BY username`).all();
  });

  ipcMain.handle('auth:createUser', (_e, input: { username: string; password: string; full_name: string; role: Role }) => {
    const u = requireUser();
    assertCan(u.role, 'user.create');
    if (!input.username || !input.password || !input.full_name) throw new Error('username, password, full_name are required');
    if (input.password.length < 6) throw new Error('Password must be at least 6 characters');
    const db = getDb();
    const exists = db.prepare(`SELECT 1 FROM users WHERE username = ?`).get(input.username);
    if (exists) throw new Error('Username already taken');
    const info = db.prepare(`INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)`).run(
      input.username, hashPassword(input.password), input.role, input.full_name,
    );
    record(db, u.id, 'create_user', 'users', info.lastInsertRowid as number, null, input);
    return db.prepare(`SELECT id, username, full_name, role, active, must_change_password FROM users WHERE id = ?`).get(info.lastInsertRowid);
  });

  ipcMain.handle('auth:setUserActive', (_e, id: number, active: boolean) => {
    const u = requireUser();
    assertCan(u.role, 'user.update');
    const db = getDb();
    if (id === u.id && !active) throw new Error('Cannot deactivate yourself');
    db.prepare(`UPDATE users SET active = ? WHERE id = ?`).run(active ? 1 : 0, id);
    record(db, u.id, active ? 'activate_user' : 'deactivate_user', 'users', id, null, { active });
  });
}
