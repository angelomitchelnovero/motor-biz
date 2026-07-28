import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { app } from 'electron';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'inv-app.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  runMigrations(_db);
  return _db;
}

export function closeDb(): void {
  if (_db) { _db.close(); _db = null; }
}

// ---------- Migrations ----------

interface Migration { id: number; name: string; sql: string; }

function loadMigrations(): Migration[] {
  // migrations folder is copied/symlinked into dist-electron by the build, but in dev
  // we read directly from source so changes are picked up immediately.
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.join(process.cwd(), 'electron', 'migrations'),
  ];
  let dir: string | null = null;
  for (const c of candidates) { if (fs.existsSync(c)) { dir = c; break; } }
  if (!dir) throw new Error('migrations folder not found');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  return files.map((file) => ({
    id: parseInt(file.split('_')[0], 10),
    name: file,
    sql: fs.readFileSync(path.join(dir!, file), 'utf-8'),
  }));
}

function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT NOT NULL)`);
  const applied = new Set(db.prepare<[], { id: number }>('SELECT id FROM _migrations').all().map((r) => r.id));
  const migrations = loadMigrations();
  const insertMigration = db.prepare('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)');
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    const tx = db.transaction(() => {
      db.exec(m.sql);
      insertMigration.run(m.id, m.name, new Date().toISOString());
    });
    tx();
  }
  seedAdminIfMissing(db);
}

function seedAdminIfMissing(db: Database.Database): void {
  const exists = db.prepare("SELECT 1 FROM users WHERE username = 'admin'").get();
  if (exists) return;
  db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name, must_change_password, active)
    VALUES (?, ?, 'owner', 'Administrator', 1, 1)
  `).run('admin', hashPassword('admin123'));
}

// ---------- Password hashing (scrypt — no extra dep) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const got = crypto.scryptSync(password, salt, 64).toString('hex');
  // constant-time compare
  const a = Buffer.from(got, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
