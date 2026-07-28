// Copies electron/migrations to dist-electron/migrations after `build:main`.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'electron', 'migrations');
const dst = path.join(root, 'dist-electron', 'migrations');

fs.mkdirSync(dst, { recursive: true });
for (const file of fs.readdirSync(src)) {
  if (file.endsWith('.sql')) {
    fs.copyFileSync(path.join(src, file), path.join(dst, file));
  }
}
console.log('[migrations] copied to dist-electron/migrations');
