// Preload — exposes `window.api.*` to the renderer. Every method is a thin wrapper
// around ipcRenderer.invoke; no business logic lives here.

import { contextBridge, ipcRenderer } from 'electron';

const invoke = (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args);

const api = {
  auth: {
    login: (username: string, password: string) => invoke('auth:login', username, password),
    logout: () => invoke('auth:logout'),
    currentUser: () => invoke('auth:currentUser'),
    changePassword: (oldPassword: string, newPassword: string) => invoke('auth:changePassword', oldPassword, newPassword),
    listUsers: () => invoke('auth:listUsers'),
    createUser: (input: any) => invoke('auth:createUser', input),
    setUserActive: (id: number, active: boolean) => invoke('auth:setUserActive', id, active),
  },
  items: {
    list: (q?: string) => invoke('items:list', q),
    get: (id: number) => invoke('items:get', id),
    create: (input: any) => invoke('items:create', input),
    update: (id: number, input: any) => invoke('items:update', id, input),
    lookupByBarcode: (barcode: string) => invoke('items:lookupByBarcode', barcode),
  },
  stock: {
    receive: (input: any) => invoke('stock:receive', input),
    adjust: (input: any) => invoke('stock:adjust', input),
    listMovements: (item_id: number, limit?: number) => invoke('stock:listMovements', item_id, limit),
    stockOnHand: () => invoke('stock:stockOnHand'),
  },
  sales: {
    checkout: (input: any) => invoke('sales:checkout', input),
    void: (sale_id: number, reason: string) => invoke('sales:void', sale_id, reason),
    get: (id: number) => invoke('sales:get', id),
    previewReceipt: (id: number) => invoke('sales:previewReceipt', id),
  },
  reports: {
    dailySales: (filters: any) => invoke('reports:dailySales', filters),
    stockOnHand: () => invoke('reports:stockOnHand'),
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (input: any) => invoke('settings:update', input),
  },
  shell: {
    openPath: (p: string) => invoke('shell:openPath', p),
  },
};

contextBridge.exposeInMainWorld('api', api);