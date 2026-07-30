// Role-based permission matrix. Single source of truth — both renderer route guards
// and IPC handlers use it. Renderer is for hiding UI; IPC enforcement is mandatory.

export type Role = 'owner' | 'manager' | 'cashier' | 'stock_clerk';

export type Action =
  // items / inventory
  | 'item.create' | 'item.read' | 'item.update' | 'item.delete'
  | 'stock.receive' | 'stock.adjust' | 'stock.read'
  // sales
  | 'pos.checkout' | 'sale.read' | 'sale.void' | 'sale.refund'
  // reports
  | 'report.daily_sales'
  // admin
  | 'user.create' | 'user.read' | 'user.update'
  | 'settings.read' | 'settings.write';

const ROLE_ACTIONS: Record<Role, Action[]> = {
  owner: [
    'item.create','item.read','item.update','item.delete',
    'stock.receive','stock.adjust','stock.read',
    'pos.checkout','sale.read','sale.void','sale.refund',
    'report.daily_sales',
    'user.create','user.read','user.update',
    'settings.read','settings.write',
  ],
  manager: [
    'item.create','item.read','item.update',
    'stock.receive','stock.adjust','stock.read',
    'pos.checkout','sale.read','sale.void','sale.refund',
    'report.daily_sales',
    'user.read',
    'settings.read',
  ],
  cashier: [
    'item.read','stock.read',
    'pos.checkout','sale.read','sale.void',
    'report.daily_sales',
  ],
  stock_clerk: [
    'item.create','item.read','item.update',
    'stock.receive','stock.adjust','stock.read',
    'report.daily_sales',
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