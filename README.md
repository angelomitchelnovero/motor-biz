# InvApp — Motor-Shop POS + Inventory

Offline-first Electron desktop app for a Philippine motor-shop. Parts + services, job orders, BIR-formatted receipts, multi-user roles with audit log.

## Stack

- Electron (main + preload + renderer split, contextIsolation on)
- React 18 + Vite + TypeScript (renderer)
- better-sqlite3 (local storage, single file in `userData/`)
- pdfkit for receipt PDFs
- electron-builder for Windows .exe

## First run

```bash
npm install
npm run dev        # Vite + Electron together, HMR
# OR
npm run dist       # build Windows installer in release/
```

Default login: `admin` / `admin123` (forced to change on first run).

## Layout

- `electron/` — main process, IPC handlers, services
- `electron/migrations/` — SQL migrations applied at startup
- `src/` — React renderer (pages, components, hooks, store)
- `scripts/dev.js` — orchestrates Vite + tsc --watch + Electron

## BIR notes

- Receipts include business TIN, BIR-ATP serial, configurable SI/OR series per branch+terminal, 12% VAT breakdown, SC/PWD discount block.
- E-invoicing API integration is a deferred phase-2 drop-in (see `electron/services/receiptPdf.ts`).
