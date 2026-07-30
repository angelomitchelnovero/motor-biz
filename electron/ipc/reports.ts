import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { assertCan } from '../services/permissions';

interface PaymentBreakdown {
  cash: number;
  gcash: number;
  card: number;
  other: number;
}

interface DailySalesRow {
  date: string;
  sales_count: number;
  gross: number;
  payment_breakdown: PaymentBreakdown;
  void_count: number;
  void_amount: number;
}

interface StockOnHandRow {
  item_id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  cost: number;
  reorder_point: number;
  below_reorder: boolean;
  value: number;
}

export function registerReportHandlers(): void {
  ipcMain.handle('reports:dailySales', (_e, filters: { from?: string; to?: string }) => {
    const u = requireUser();
    assertCan(u.role, 'report.daily_sales');
    const db = getDb();
    const where: string[] = [];
    const params: any[] = [];
    if (filters.from) { where.push('created_at >= ?'); params.push(filters.from); }
    if (filters.to) { where.push('created_at <= ?'); params.push(filters.to); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT
        date(created_at) AS date,
        payment_method,
        status,
        total
      FROM sales
      ${whereClause}
    `).all(...params) as Array<{ date: string; payment_method: string; status: string; total: number }>;

    // Group by date in JS so we can produce the payment_breakdown column.
    const byDate = new Map<string, DailySalesRow>();
    for (const r of rows) {
      const row = byDate.get(r.date) ?? {
        date: r.date,
        sales_count: 0,
        gross: 0,
        payment_breakdown: { cash: 0, gcash: 0, card: 0, other: 0 },
        void_count: 0,
        void_amount: 0,
      };
      if (r.status === 'voided') {
        row.void_count += 1;
        row.void_amount = Math.round((row.void_amount + r.total) * 100) / 100;
      } else {
        row.sales_count += 1;
        row.gross = Math.round((row.gross + r.total) * 100) / 100;
        if (r.payment_method === 'cash' || r.payment_method === 'gcash' || r.payment_method === 'card' || r.payment_method === 'other') {
          row.payment_breakdown[r.payment_method] = Math.round((row.payment_breakdown[r.payment_method] + r.total) * 100) / 100;
        } else {
          row.payment_breakdown.other = Math.round((row.payment_breakdown.other + r.total) * 100) / 100;
        }
      }
      byDate.set(r.date, row);
    }
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  });

  ipcMain.handle('reports:stockOnHand', () => {
    const u = requireUser();
    assertCan(u.role, 'report.daily_sales'); // stock report viewable by anyone with daily_sales
    return stockOnHandRows();
  });
}

export function stockOnHandRows(): StockOnHandRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      i.id AS item_id, i.sku, i.name, i.category, i.unit,
      COALESCE(SUM(CASE
        WHEN m.type IN ('receive','refund_in') THEN m.qty
        WHEN m.type = 'sold' THEN -m.qty
        WHEN m.type = 'adjust' THEN m.qty
        ELSE 0
      END), 0) AS qty,
      i.cost, i.reorder_point,
      CASE WHEN COALESCE(SUM(CASE
        WHEN m.type IN ('receive','refund_in') THEN m.qty
        WHEN m.type = 'sold' THEN -m.qty
        WHEN m.type = 'adjust' THEN m.qty
        ELSE 0
      END), 0) <= i.reorder_point THEN 1 ELSE 0 END AS below_reorder
    FROM items i
    LEFT JOIN stock_movements m ON m.item_id = i.id
    WHERE i.active = 1
    GROUP BY i.id
    ORDER BY i.name
  `).all().map((r: any) => ({
    item_id: r.item_id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    qty: r.qty || 0,
    cost: r.cost,
    reorder_point: r.reorder_point,
    below_reorder: !!r.below_reorder,
    value: Math.round((r.qty || 0) * r.cost * 100) / 100,
  }));
}