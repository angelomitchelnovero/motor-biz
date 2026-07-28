import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { assertCan } from '../services/permissions';

export function registerReportHandlers(): void {
  ipcMain.handle('reports:dailySales', (_e, filters: { from?: string; to?: string; document_type?: string }) => {
    const u = requireUser();
    assertCan(u.role, 'report.daily_sales');
    const db = getDb();
    const where: string[] = [`s.status != 'voided'`];
    const params: any[] = [];
    if (filters.from) { where.push('s.created_at >= ?'); params.push(filters.from); }
    if (filters.to) { where.push('s.created_at <= ?'); params.push(filters.to); }
    if (filters.document_type && filters.document_type !== 'all') { where.push('s.document_type = ?'); params.push(filters.document_type); }
    return db.prepare(`
      SELECT
        date(s.created_at) AS date,
        COUNT(*) AS sales_count,
        ROUND(SUM(s.total), 2) AS gross,
        ROUND(SUM(s.vatable_sale), 2) AS vatable,
        ROUND(SUM(s.vat_exempt), 2) AS vat_exempt,
        ROUND(SUM(s.zero_rated), 2) AS zero_rated,
        ROUND(SUM(s.vat_amount), 2) AS vat_amount,
        ROUND(SUM(s.discount_total + s.sc_pwd_discount), 2) AS discount_total,
        SUM(CASE WHEN s.status = 'voided' THEN 1 ELSE 0 END) AS void_count,
        ROUND(SUM(CASE WHEN s.status = 'voided' THEN s.total ELSE 0 END), 2) AS void_amount
      FROM sales s
      WHERE ${where.join(' AND ')}
      GROUP BY date(s.created_at)
      ORDER BY date DESC
    `).all(...params);
  });

  ipcMain.handle('reports:stockOnHand', () => {
    const u = requireUser();
    assertCan(u.role, 'report.stock');
    const db = getDb();
    return db.prepare(`
      SELECT
        i.id AS item_id, i.sku, i.name, i.category, i.unit,
        COALESCE(SUM(CASE
          WHEN m.type IN ('receive','transfer_in','refund_in') THEN m.qty
          WHEN m.type IN ('sold','used_in_jo','transfer_out','return_supplier','damaged') THEN -m.qty
          WHEN m.type = 'adjust' THEN m.qty
          ELSE 0
        END), 0) AS qty,
        i.cost,
        CASE WHEN COALESCE(SUM(CASE
          WHEN m.type IN ('receive','transfer_in','refund_in') THEN m.qty
          WHEN m.type IN ('sold','used_in_jo','transfer_out','return_supplier','damaged') THEN -m.qty
          WHEN m.type = 'adjust' THEN m.qty
          ELSE 0
        END), 0) <= i.reorder_point THEN 1 ELSE 0 END AS below_reorder
      FROM items i
      LEFT JOIN stock_movements m ON m.item_id = i.id
      WHERE i.active = 1
      GROUP BY i.id
      ORDER BY i.name
    `).all().map((r: any) => ({ ...r, below_reorder: !!r.below_reorder, value: (r.qty || 0) * r.cost }));
  });

  ipcMain.handle('reports:mechanicCommission', (_e, filters: { from?: string; to?: string; mechanic_id?: number }) => {
    const u = requireUser();
    assertCan(u.role, 'report.commission');
    const db = getDb();
    const where: string[] = [];
    const params: any[] = [];
    if (filters.from) { where.push(`datetime(j.created_at) >= datetime(?)`); params.push(filters.from); }
    if (filters.to) { where.push(`datetime(j.created_at) <= datetime(?)`); params.push(filters.to); }
    if (filters.mechanic_id) { where.push(`m.id = ?`); params.push(filters.mechanic_id); }
    if (u.role === 'mechanic') { where.push(`m.id = ?`); params.push(u.id); }
    return db.prepare(`
      SELECT
        m.id AS mechanic_id,
        m.full_name AS mechanic_name,
        ROUND(SUM(l.line_total), 2) AS labor_amount,
        COUNT(DISTINCT l.jo_id) AS jo_count,
        ROUND(SUM(l.line_total) * 0.10, 2) AS commission_amount
      FROM jo_lines l
      JOIN job_orders j ON j.id = l.jo_id
      JOIN users m ON m.id = COALESCE(l.mechanic_id, j.primary_mechanic_id)
      WHERE l.kind = 'service'
        ${where.length ? 'AND ' + where.join(' AND ') : ''}
      GROUP BY m.id
      ORDER BY labor_amount DESC
    `).all(...params);
  });

  ipcMain.handle('reports:birExport', (_e, filters: { from?: string; to?: string; document_type?: string }) => {
    const u = requireUser();
    assertCan(u.role, 'report.bir_export');
    const db = getDb();
    const where: string[] = [`s.status = 'completed'`];
    const params: any[] = [];
    if (filters.from) { where.push(`s.created_at >= ?`); params.push(filters.from); }
    if (filters.to) { where.push(`s.created_at <= ?`); params.push(filters.to); }
    if (filters.document_type && filters.document_type !== 'all') { where.push(`s.document_type = ?`); params.push(filters.document_type); }
    return db.prepare(`
      SELECT
        s.created_at AS date,
        s.sale_number,
        s.document_type,
        COALESCE(c.tin, '') AS tin,
        COALESCE(c.name, '') AS customer_name,
        s.vatable_sale,
        s.vat_exempt,
        s.zero_rated,
        s.vat_amount,
        s.total
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at
    `).all(...params);
  });
}