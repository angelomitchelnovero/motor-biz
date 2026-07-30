// Renderer-side mirror of the role/action matrix. Kept in sync manually with
// electron/services/permissions.ts — the IPC enforcement in main is the source
// of truth, this is just for hiding UI.

export type Role = 'owner' | 'manager' | 'cashier' | 'stock_clerk';

export type Action =
  | 'item.create' | 'item.read' | 'item.update' | 'item.delete'
  | 'stock.receive' | 'stock.adjust' | 'stock.read'
  | 'pos.checkout' | 'sale.read' | 'sale.void' | 'sale.refund'
  | 'report.daily_sales'
  | 'user.create' | 'user.read' | 'user.update'
  | 'settings.read' | 'settings.write';

const NONE: Action[] = [];

const R: Record<Role, Action[]> = {
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

for (const r of Object.keys(R) as Role[]) {
  const set = new Set(R[r] as Action[]);
  for (const a of NONE) set.delete(a);
  R[r] = Array.from(set) as Action[];
}

export function can(role: Role, action: Action): boolean {
  return R[role]?.includes(action) ?? false;
}