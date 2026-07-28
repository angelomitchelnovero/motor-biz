const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

app.whenReady().then(() => {
  const db = new Database(path.join(process.env.APPDATA, 'inv-app', 'inv-app.db'), { readonly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  console.log('Tables:', tables.join(', '));
  console.log('Users:', db.prepare('SELECT username, role, must_change_password FROM users').all());
  const itemCount = db.prepare('SELECT COUNT(*) as c FROM items').get();
  console.log('Items:', itemCount.c, 'rows');
  console.log('Receipt series:', db.prepare('SELECT document_type, prefix, current_no, end_no, active FROM receipt_series').all());
  console.log('Settings keys:', db.prepare('SELECT key FROM settings ORDER BY key').all().map(r => r.key).join(', '));
  console.log('Migrations:', db.prepare('SELECT id, name, applied_at FROM _migrations').all());
  db.close();
  app.quit();
});

