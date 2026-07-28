import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { getDb, closeDb } from './db';
import { registerAuthHandlers, getCurrentUser } from './ipc/auth';
import { registerItemHandlers } from './ipc/items';
import { registerStockHandlers } from './ipc/stock';
import { registerCustomerHandlers } from './ipc/customers';
import { registerVehicleHandlers } from './ipc/vehicles';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerJobOrderHandlers } from './ipc/jobOrders';
import { registerSalesHandlers } from './ipc/sales';
import { registerReportHandlers } from './ipc/reports';
import { registerSettingsHandlers } from './ipc/settings';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'InvApp — Motor-Shop POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    autoHideMenuBar: true,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) mainWindow?.webContents.openDevTools({ mode: 'detach' });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  getDb(); // initialize + migrate
  registerAuthHandlers();
  registerItemHandlers();
  registerStockHandlers();
  registerCustomerHandlers();
  registerVehicleHandlers();
  registerSupplierHandlers();
  registerJobOrderHandlers();
  registerSalesHandlers();
  registerReportHandlers();
  registerSettingsHandlers();

  ipcMain.handle('app:currentUser', () => getCurrentUser());
  ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb();
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDb();
});