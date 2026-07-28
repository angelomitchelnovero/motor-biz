// Role-based permission matrix. Single source of truth — both renderer route guards
// and IPC handlers use it. Renderer is for hiding UI; IPC enforcement is mandatory.

export type Role = 'owner' | 'manager' | 'cashier' | 'mechanic' | 'inv_clerk' | 'accountant' | 'auditor';

export type Action =
  // items / inventory
  | 'item.create' | 'item.read' | 'item.update' | 'item.delete'
  | 'stock.receive' | 'stock.adjust' | 'stock.read'
  // customers / vehicles / suppliers
  | 'customer.create' | 'customer.read' | 'customer.update'
  | 'vehicle.create' | 'vehicle.read' | 'vehicle.update'
  | 'supplier.create' | 'supplier.read' | 'supplier.update'
  // job orders
  | 'jo.create' | 'jo.read' | 'jo.update' | 'jo.change_status' | 'jo.assign'
  // sales
  | 'pos.checkout' | 'sale.read' | 'sale.void' | 'sale.refund'
  // reports
  | 'report.daily_sales' | 'report.stock' | 'report.commission' | 'report.bir_export'
  // admin
  | 'user.create' | 'user.read' | 'user.update'
  | 'settings.read' | 'settings.write' | 'settings.series';

const ROLE_ACTIONS: Record<Role, Action[]> = {
  owner: [
    'item.create','item.read','item.update','item.delete',
    'stock.receive','stock.adjust','stock.read',
    'customer.create','customer.read','customer.update',
    'vehicle.create','vehicle.read','vehicle.update',
    'supplier.create','supplier.read','supplier.update',
    'jo.create','jo.read','jo.update','jo.change_status','jo.assign',
    'pos.checkout','sale.read','sale.void','sale.refund',
    'report.daily_sales','report.stock','report.commission','report.bir_export',
    'user.create','user.read','user.update',
    'settings.read','settings.write','settings.series',
  ],
  manager: [
    'item.create','item.read','item.update',
    'stock.receive','stock.adjust','stock.read',
    'customer.create','customer.read','customer.update',
    'vehicle.create','vehicle.read','vehicle.update',
    'supplier.create','supplier.read','supplier.update',
    'jo.create','jo.read','jo.update','jo.change_status','jo.assign',
    'pos.checkout','sale.read','sale.void','sale.refund',
    'report.daily_sales','report.stock','report.commission','report.bir_export',
    'user.read',
    'settings.read',
  ],
  cashier: [
    'item.read','stock.read',
    'customer.create','customer.read','customer.update',
    'vehicle.create','vehicle.read','vehicle.update',
    'jo.read',
    'pos.checkout','sale.read','sale.void',
    'report.daily_sales',
  ],
  mechanic: [
    'item.read','stock.read',
    'customer.read','vehicle.read',
    'jo.read','jo.update','jo.change_status','jo.assign',
    'report.commission', // own only — filtered in handler
  ],
  inv_clerk: [
    'item.create','item.read','item.update',
    'stock.receive','stock.adjust','stock.read',
    'customer.read','supplier.create','supplier.read','supplier.update',
    'jo.read',
    'report.stock',
  ],
  accountant: [
    'item.read','stock.read',
    'customer.read','vehicle.read','supplier.read',
    'jo.read',
    'sale.read',
    'report.daily_sales','report.stock','report.commission','report.bir_export',
    'user.read','settings.read',
  ],
  auditor: [
    'item.read','stock.read',
    'customer.read','vehicle.read','supplier.read',
    'jo.read','sale.read',
    'report.daily_sales','report.stock','report.commission','report.bir_export',
    'user.read','settings.read',
  ],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_ACTIONS[role]?.includes(action) ?? false;
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    const e: any = new Error(`Forbidden: role '${role}' cannot '${action}'`);
    e.code = 'FORBIDDEN';
    throw e;
  }
}
