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
  customers: {
    list: (q?: string) => invoke('customers:list', q),
    get: (id: number) => invoke('customers:get', id),
    create: (input: any) => invoke('customers:create', input),
    update: (id: number, input: any) => invoke('customers:update', id, input),
  },
  vehicles: {
    list: (q?: string) => invoke('vehicles:list', q),
    get: (id: number) => invoke('vehicles:get', id),
    create: (input: any) => invoke('vehicles:create', input),
    update: (id: number, input: any) => invoke('vehicles:update', id, input),
    lookupByPlate: (plate: string) => invoke('vehicles:lookupByPlate', plate),
    serviceHistory: (vehicle_id: number) => invoke('vehicles:serviceHistory', vehicle_id),
  },
  suppliers: {
    list: () => invoke('suppliers:list'),
    get: (id: number) => invoke('suppliers:get', id),
    create: (input: any) => invoke('suppliers:create', input),
    update: (id: number, input: any) => invoke('suppliers:update', id, input),
  },
  jobOrders: {
    list: (status?: string) => invoke('jobOrders:list', status),
    get: (id: number) => invoke('jobOrders:get', id),
    create: (input: any) => invoke('jobOrders:create', input),
    updateStatus: (id: number, status: string, note?: string) => invoke('jobOrders:updateStatus', id, status, note),
    assignMechanic: (id: number, mechanic_id: number | null) => invoke('jobOrders:assignMechanic', id, mechanic_id),
    addLine: (jo_id: number, line: any) => invoke('jobOrders:addLine', jo_id, line),
    removeLine: (jo_id: number, line_id: number) => invoke('jobOrders:removeLine', jo_id, line_id),
  },
  sales: {
    checkout: (input: any) => invoke('sales:checkout', input),
    void: (sale_id: number, reason: string) => invoke('sales:void', sale_id, reason),
    refund: (sale_id: number, reason: string) => invoke('sales:refund', sale_id, reason),
    get: (id: number) => invoke('sales:get', id),
    previewReceipt: (sale_id: number) => invoke('sales:previewReceipt', sale_id),
  },
  reports: {
    dailySales: (filters: any) => invoke('reports:dailySales', filters),
    stockOnHand: () => invoke('reports:stockOnHand'),
    mechanicCommission: (filters: any) => invoke('reports:mechanicCommission', filters),
    birExport: (filters: any) => invoke('reports:birExport', filters),
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (input: any) => invoke('settings:update', input),
    listSeries: () => invoke('settings:listSeries'),
    createSeries: (input: any) => invoke('settings:createSeries', input),
    setSeriesActive: (id: number, active: boolean) => invoke('settings:setSeriesActive', id, active),
  },
  shell: {
    openPath: (p: string) => invoke('shell:openPath', p),
  },
};

contextBridge.exposeInMainWorld('api', api);
