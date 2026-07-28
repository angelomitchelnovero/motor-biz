// Renderer-side mirror of the role/action matrix. Kept in sync manually with
// electron/services/permissions.ts — the IPC enforcement in main is the source
// of truth, this is just for hiding UI.

export type Role = 'owner' | 'manager' | 'cashier' | 'mechanic' | 'inv_clerk' | 'accountant' | 'auditor';

export type Action =
  | 'item.create' | 'item.read' | 'item.update' | 'item.delete'
  | 'stock.receive' | 'stock.adjust' | 'stock.read'
  | 'customer.create' | 'customer.read' | 'customer.update'
  | 'vehicle.create' | 'vehicle.read' | 'vehicle.update'
  | 'supplier.create' | 'supplier.read' | 'supplier.update'
  | 'jo.create' | 'jo.read' | 'jo.update' | 'jo.change_status' | 'jo.assign'
  | 'pos.checkout' | 'sale.read' | 'sale.void' | 'sale.refund'
  | 'report.daily_sales' | 'report.stock' | 'report.commission' | 'report.bir_export'
  | 'user.create' | 'user.read' | 'user.update'
  | 'settings.read' | 'settings.write' | 'settings.series';

const ALL: Action[] = [
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
];

const NONE: Action[] = [];

const R: Record<Role, Action[]> = {
  owner: ALL,
  manager: ALL.filter((a) => a !== 'item.delete' && a !== 'user.create' && a !== 'user.update' && a !== 'settings.write'),
  cashier: ['item.read','stock.read','customer.create','customer.read','customer.update','vehicle.create','vehicle.read','vehicle.update','jo.read','pos.checkout','sale.read','sale.void','report.daily_sales'],
  mechanic: ['item.read','stock.read','customer.read','vehicle.read','jo.read','jo.update','jo.change_status','jo.assign','report.commission'],
  inv_clerk: ['item.create','item.read','item.update','stock.receive','stock.adjust','stock.read','customer.read','supplier.create','supplier.read','supplier.update','jo.read','report.stock'],
  accountant: ['item.read','stock.read','customer.read','vehicle.read','supplier.read','jo.read','sale.read','report.daily_sales','report.stock','report.commission','report.bir_export','user.read','settings.read'],
  auditor: ['item.read','stock.read','customer.read','vehicle.read','supplier.read','jo.read','sale.read','report.daily_sales','report.stock','report.commission','report.bir_export','user.read','settings.read'],
};

for (const r of Object.keys(R) as Role[]) {
  const set = new Set(R[r] as Action[]);
  for (const a of NONE) set.delete(a);
  R[r] = Array.from(set) as Action[];
}

export function can(role: Role, action: Action): boolean {
  return R[role]?.includes(action) ?? false;
}