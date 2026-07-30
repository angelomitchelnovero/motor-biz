// POS checkout — atomic across sale, sale_lines, stock_movements.

import { ipcMain, app } from 'electron';
import path from 'node:path';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';
import { recordMovement, hasStockForSale } from '../services/stockLedger';
import { lineTotal } from '../services/pricing';
import { renderReceiptPdf } from '../services/receiptPdf';

type PaymentMethod = 'cash' | 'gcash' | 'card' | 'other';

interface CheckoutLine {
  item_id?: number | null;
  description: string;
  qty: number;
  unit_price: number;
  line_discount?: number;
}

interface CheckoutInput {
  lines: CheckoutLine[];
  payment_method: PaymentMethod;
  tendered: number;
  customer_name?: string | null;
}

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:checkout', async (_e, input: CheckoutInput) => {
    const u = requireUser();
    assertCan(u.role, 'pos.checkout');
    if (!input.lines?.length) throw new Error('Cart is empty');
    if (input.tendered == null || input.tendered < 0) throw new Error('Tendered amount required');

    const db = getDb();
    const total = computeTotal(input.lines);
    if (input.tendered < total - 0.01) throw new Error('Insufficient payment');
    const change_due = Math.max(0, Math.round((input.tendered - total) * 100) / 100);

    const result = db.transaction(() => {
      // 1. insert sale (sale_number derived from id)
      const saleInfo = db.prepare(`
        INSERT INTO sales (sale_number, cashier_id, payment_method, tendered, total, change_due, status)
        VALUES (?, ?, ?, ?, ?, ?, 'completed')
      `).run(
        'TEMP', // placeholder; replaced after we know the id
        u.id,
        input.payment_method,
        input.tendered,
        total,
        change_due,
      );
      const saleId = saleInfo.lastInsertRowid as number;
      const sale_number = formatSaleNumber(saleId);

      // 2. update sale_number now that we have id
      db.prepare(`UPDATE sales SET sale_number = ? WHERE id = ?`).run(sale_number, saleId);

      // 3. insert sale_lines + stock movements for parts
      const insLine = db.prepare(`
        INSERT INTO sale_lines (sale_id, item_id, description, qty, unit_price, line_discount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of input.lines) {
        const qty = l.qty ?? 1;
        const unit_price = l.unit_price ?? 0;
        const line_discount = l.line_discount ?? 0;
        if (l.item_id) {
          if (!hasStockForSale(db, l.item_id, qty)) {
            throw new Error(`Insufficient stock for: ${l.description}`);
          }
        }
        insLine.run(saleId, l.item_id ?? null, l.description, qty, unit_price, line_discount, lineTotal(qty, unit_price, line_discount));
      }

      // 4. stock movements for parts
      for (const l of input.lines) {
        if (l.item_id) {
          recordMovement(db, {
            item_id: l.item_id,
            type: 'sold',
            qty: l.qty ?? 1,
            unit_cost: 0,
            reference_type: 'sale',
            reference_id: saleId,
            reason: `Sale ${sale_number}`,
            user_id: u.id,
          });
        }
      }

      record(db, u.id, 'checkout', 'sales', saleId, null, {
        sale_number, total, lines: input.lines.length,
      });

      return { saleId, sale_number, total, change_due };
    })();

    // 5. render PDF outside the txn
    const settings = readReceiptSettings(db);
    const fullSale = db.prepare(`
      SELECT s.sale_number, s.created_at, s.payment_method, s.tendered, s.total, s.change_due,
             u.full_name AS cashier_name
      FROM sales s
      JOIN users u ON u.id = s.cashier_id
      WHERE s.id = ?
    `).get(result.saleId) as any;

    const saleLines = db.prepare(`SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY id`).all(result.saleId) as any[];

    const pdfPath = await renderReceiptPdf({
      sale_number: result.sale_number,
      created_at: fullSale.created_at,
      cashier_name: fullSale.cashier_name,
      customer_name: input.customer_name ?? null,
      lines: saleLines.map((l) => ({
        description: l.description,
        qty: l.qty,
        unit_price: l.unit_price,
        line_discount: l.line_discount,
        line_total: l.line_total,
      })),
      total: result.total,
      payment_method: input.payment_method,
      tendered: input.tendered,
      change_due: result.change_due,
      settings,
    });

    return {
      id: result.saleId,
      sale_number: result.sale_number,
      total: result.total,
      change_due: result.change_due,
      receipt_pdf_path: pdfPath,
    };
  });

  ipcMain.handle('sales:void', (_e, sale_id: number, reason: string) => {
    const u = requireUser();
    assertCan(u.role, 'sale.void');
    if (!reason) throw new Error('Void reason is required');
    const db = getDb();
    const tx = db.transaction(() => {
      const sale = db.prepare(`SELECT status FROM sales WHERE id = ?`).get(sale_id) as { status: string } | undefined;
      if (!sale) throw new Error('Sale not found');
      if (sale.status !== 'completed') throw new Error('Sale is not in completed state');
      const lines = db.prepare(`SELECT * FROM sale_lines WHERE sale_id = ? AND item_id IS NOT NULL`).all(sale_id);
      for (const l of lines as any[]) {
        recordMovement(db, {
          item_id: l.item_id,
          type: 'refund_in',
          qty: l.qty,
          unit_cost: 0,
          reference_type: 'sale',
          reference_id: sale_id,
          reason: `Void: ${reason}`,
          user_id: u.id,
        });
      }
      db.prepare(`UPDATE sales SET status = 'voided', void_reason = ? WHERE id = ?`).run(reason, sale_id);
      record(db, u.id, 'void_sale', 'sales', sale_id, null, { reason });
    });
    tx();
  });

  ipcMain.handle('sales:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'sale.read');
    const db = getDb();
    const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id);
    const lines = db.prepare(`SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY id`).all(id);
    return { sale, lines };
  });

  ipcMain.handle('sales:previewReceipt', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'sale.read');
    const db = getDb();
    const sale = db.prepare(`SELECT sale_number FROM sales WHERE id = ?`).get(id) as { sale_number: string } | undefined;
    if (!sale) throw new Error('Sale not found');
    return path.join(app.getPath('userData'), 'receipts', `${sale.sale_number}.pdf`);
  });
}

// ---------- total computation ----------

function computeTotal(lines: CheckoutLine[]): number {
  let total = 0;
  for (const l of lines) {
    total += lineTotal(l.qty ?? 1, l.unit_price ?? 0, l.line_discount ?? 0);
  }
  return Math.round(total * 100) / 100;
}

function formatSaleNumber(id: number): string {
  return `INV-${String(id).padStart(7, '0')}`;
}

function readReceiptSettings(db: any): { business_name: string; address1: string; address2: string } {
  const read = (k: string, fallback: string) => {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(k) as { value: string } | undefined;
    if (!row) return fallback;
    try {
      const parsed = JSON.parse(row.value);
      return typeof parsed === 'string' ? parsed : fallback;
    } catch {
      return row.value || fallback;
    }
  };
  return {
    business_name: read('business_name', 'My Motor Shop'),
    address1: read('address1', ''),
    address2: read('address2', ''),
  };
}