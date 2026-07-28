// Dev orchestrator: starts Vite, waits for it, compiles main TS, launches Electron.
// Watches main TS for changes and restarts Electron on each rebuild.

const { spawn } = require('node:child_process');
const path = require('node:path');

const root = __dirname.replace(/scripts$/, '');
process.chdir(root);

const procs = [];

function start(name, cmd, args, color) {
  const p = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  p.stdout.on('data', (d) => process.stdout.write(`\x1b[${color}m[${name}]\x1b[0m ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`\x1b[${color}m[${name}]\x1b[0m ${d}`));
  p.on('exit', (code) => {
    process.stdout.write(`\x1b[${color}m[${name}]\x1b[0m exited with ${code}\n`);
    if (!shuttingDown) {
      shuttingDown = true;
      procs.forEach((q) => { try { q.kill('SIGTERM'); } catch {} });
      process.exit(code ?? 0);
    }
  });
  procs.push(p);
  return p;
}

let shuttingDown = false;

process.on('SIGINT', () => {
  shuttingDown = true;
  procs.forEach((p) => { try { p.kill('SIGTERM'); } catch {} });
  process.exit(0);
});

// 1. Vite dev server
start('vite', 'npx', ['vite'], '36');

// 2. Wait for Vite, then compile + run Electron with file-watching
const waitOn = spawn('npx', ['wait-on', 'tcp:5173'], { shell: true, stdio: 'inherit' });
waitOn.on('exit', (code) => {
  if (code !== 0) return;

  let mainProc = null;
  const rebuildAndStart = () => {
    const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], { shell: true, stdio: 'inherit' });
    tsc.on('exit', (c) => {
      if (c !== 0) {
        process.stdout.write('\x1b[31m[main]\x1b[0m build failed — waiting for next change\n');
        return;
      }
      if (mainProc) { try { mainProc.kill('SIGTERM'); } catch {} }
      mainProc = spawn('npx', ['electron', '.'], { shell: true, stdio: 'inherit' });
      mainProc.on('exit', () => { mainProc = null; });
    });
  };
  rebuildAndStart();

  const watcher = spawn('npx', ['tsc', '-p', 'tsconfig.main.json', '--watch'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';
  watcher.stdout.on('data', (d) => {
    buffer += d.toString();
    if (buffer.includes('Found 0 errors')) {
      buffer = '';
      process.stdout.write('\x1b[35m[watch]\x1b[0m changes detected — restarting Electron\n');
      rebuildAndStart();
    }
    if (buffer.length > 4096) buffer = '';
  });
});
