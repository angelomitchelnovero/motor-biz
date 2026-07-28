// POS checkout — atomic across sale, sale_lines, payments, stock_movements, JO status.

import { ipcMain } from 'electron';
import { getDb } from '../db';
import { requireUser } from './auth';
import { record } from '../services/audit';
import { assertCan } from '../services/permissions';
import { allocate, formatSaleNumber, ReceiptSeriesExhaustedError } from '../services/receiptNumber';
import { recordMovement, stockOnHand, hasStockForSale } from '../services/stockLedger';
import { lineTotal } from '../services/pricing';
import { computeVat, applyScPwd } from '../services/vat';
import { renderReceiptPdf } from '../services/receiptPdf';

interface CheckoutInput {
  jo_id?: number | null;
  customer_id?: number | null;
  vehicle_id?: number | null;
  document_type: 'SI' | 'OR';
  series_id: number;
  lines: any[];
  payments: any[];
  sc_pwd?: { kind: 'SC' | 'PWD'; id_no: string; name: string } | null;
  odometer?: number | null;
}

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:checkout', async (_e, input: CheckoutInput) => {
    const u = requireUser();
    assertCan(u.role, 'pos.checkout');
    if (!input.lines?.length) throw new Error('Cart is empty');
    if (!input.payments?.length) throw new Error('No payments');

    const db = getDb();
    const totals = computeTotals(input);
    if (totals.totalPaid < totals.total - 0.01) throw new Error('Insufficient payment');

    const result = db.transaction(() => {
      // 1. allocate receipt number (must be in this txn for the lock to hold)
      let allocated;
      try {
        allocated = allocate(db, input.series_id);
      } catch (e) {
        if (e instanceof ReceiptSeriesExhaustedError) throw e;
        throw e;
      }
      const sale_number = formatSaleNumber(allocated.prefix, allocated.number);

      // 2. insert sale
      const change_due = Math.max(0, Math.round((totals.totalPaid - totals.total) * 100) / 100);
      const saleInfo = db.prepare(`
        INSERT INTO sales (
          sale_number, document_type, series_id, vehicle_id, jo_id, customer_id, cashier_id,
          subtotal, discount_total, sc_pwd_discount, sc_pwd_kind, sc_pwd_id_no, sc_pwd_name,
          vatable_sale, vat_exempt, zero_rated, vat_amount, total,
          tender_cash, tender_gcash, tender_maya, tender_card, tender_bank, tender_charge,
          change_due, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, 'completed'
        )
      `).run(
        sale_number, input.document_type, input.series_id, input.vehicle_id ?? null, input.jo_id ?? null, input.customer_id ?? null, u.id,
        totals.subtotal, totals.discountTotal, totals.scPwdDiscount,
        input.sc_pwd?.kind ?? null, input.sc_pwd?.id_no ?? null, input.sc_pwd?.name ?? null,
        totals.vat.vatable_sale, totals.vat.vat_exempt, totals.vat.zero_rated, totals.vat.vat_amount, totals.total,
        totals.byMethod.cash, totals.byMethod.gcash, totals.byMethod.maya, totals.byMethod.card, totals.byMethod.bank, totals.byMethod.charge,
        change_due,
      );
      const saleId = saleInfo.lastInsertRowid as number;

      // 3. insert sale_lines + stock movements for parts
      const insLine = db.prepare(`
        INSERT INTO sale_lines (sale_id, kind, item_id, description, qty, unit_price, line_discount, vat_type, line_total, mechanic_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of input.lines) {
        if (l.kind === 'part' && l.item_id) {
          if (!hasStockForSale(db, l.item_id, l.qty)) {
            throw new Error(`Insufficient stock for: ${l.description}`);
          }
        }
        insLine.run(
          saleId, l.kind ?? 'service', l.item_id ?? null, l.description,
          l.qty ?? 1, l.unit_price ?? 0, l.line_discount ?? 0,
          l.vat_type ?? 'vatable',
          lineTotal(l.qty ?? 1, l.unit_price ?? 0, l.line_discount ?? 0),
          l.mechanic_id ?? null,
        );
      }

      // 4. stock movements (parts sold = 'sold', JO-released parts = 'used_in_jo')
      const isFromJo = !!input.jo_id;
      for (const l of input.lines) {
        if (l.kind === 'part' && l.item_id) {
          recordMovement(db, {
            item_id: l.item_id,
            type: isFromJo ? 'used_in_jo' : 'sold',
            qty: l.qty,
            unit_cost: 0,
            reference_type: isFromJo ? 'job_order' : 'sale',
            reference_id: isFromJo ? (input.jo_id as number) : saleId,
            reason: isFromJo ? `JO ${input.jo_id} → sale` : `Sale ${sale_number}`,
            user_id: u.id,
          });
        }
      }

      // 5. payments
      const insPay = db.prepare(`INSERT INTO payments (sale_id, method, amount, reference_no) VALUES (?, ?, ?, ?)`);
      for (const p of input.payments) {
        if (!p.amount || p.amount <= 0) continue;
        insPay.run(saleId, p.method, p.amount, p.reference_no ?? null);
      }

      // 6. transition JO if applicable
      if (input.jo_id) {
        db.prepare(`UPDATE job_orders SET status = 'released', released_at = datetime('now') WHERE id = ? AND status IN ('ready','awaiting_parts','in_progress','queued')`)
          .run(input.jo_id);
        db.prepare(`INSERT INTO jo_status_log (jo_id, status, changed_by, note) VALUES (?, 'released', ?, ?)`)
          .run(input.jo_id, u.id, `Charged via sale ${sale_number}`);
      }

      // 7. vehicle odometer update
      if (input.vehicle_id && input.odometer != null) {
        db.prepare(`UPDATE vehicles SET current_odometer = ? WHERE id = ?`).run(input.odometer, input.vehicle_id);
      }

      record(db, u.id, 'checkout', 'sales', saleId, null, {
        sale_number, total: totals.total, lines: input.lines.length,
      });

      return { saleId, sale_number, allocated, totals, change_due };
    })();

    // 8. render PDF outside the txn
    const settings = JSON.parse((getDb().prepare(`SELECT value FROM settings WHERE key = 'business_name'`).get() as any).value);
    const settingsRow = (key: string) => JSON.parse(((getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any)?.value) ?? '""');
    const settingsObj = {
      business_name: settingsRow('business_name'),
      address1: settingsRow('address1'),
      address2: settingsRow('address2'),
      tin: settingsRow('tin'),
      vat_reg_tin: settingsRow('vat_reg_tin'),
      bir_atp_sn: settingsRow('bir_atp_sn'),
      bir_atp_min: settingsRow('bir_atp_min'),
      bir_atp_date: settingsRow('bir_atp_date'),
      vat_mode: settingsRow('vat_mode'),
      sc_discount_pct: settingsRow('sc_discount_pct'),
      pwd_discount_pct: settingsRow('pwd_discount_pct'),
      default_branch: settingsRow('default_branch'),
      default_terminal: settingsRow('default_terminal'),
    };

    const fullSale = getDb().prepare(`
      SELECT s.*, c.name AS customer_name, v.plate_number AS vehicle_plate,
        (v.make || ' ' || COALESCE(v.model,'')) AS vehicle_label,
        cb.full_name AS cashier_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN vehicles v ON v.id = s.vehicle_id
      LEFT JOIN users cb ON cb.id = s.cashier_id
      WHERE s.id = ?
    `).get(result.saleId);

    const saleLines = getDb().prepare(`SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY id`).all(result.saleId);

    const pdfPath = await renderReceiptPdf({
      sale_number: result.sale_number,
      document_type: input.document_type,
      series_prefix: result.allocated.prefix,
      series_number: result.allocated.number,
      created_at: (fullSale as any).created_at,
      cashier_name: (fullSale as any).cashier_name,
      customer_name: (fullSale as any).customer_name,
      vehicle_plate: (fullSale as any).vehicle_plate,
      vehicle_label: (fullSale as any).vehicle_label,
      lines: saleLines as any,
      subtotal: result.totals.subtotal,
      discount_total: result.totals.discountTotal,
      sc_pwd_kind: input.sc_pwd?.kind ?? null,
      sc_pwd_discount: result.totals.scPwdDiscount,
      sc_pwd_id_no: input.sc_pwd?.id_no ?? null,
      sc_pwd_name: input.sc_pwd?.name ?? null,
      vatable_sale: result.totals.vat.vatable_sale,
      vat_exempt: result.totals.vat.vat_exempt,
      zero_rated: result.totals.vat.zero_rated,
      vat_amount: result.totals.vat.vat_amount,
      total: result.totals.total,
      tender_cash: result.totals.byMethod.cash,
      tender_gcash: result.totals.byMethod.gcash,
      tender_maya: result.totals.byMethod.maya,
      tender_card: result.totals.byMethod.card,
      tender_bank: result.totals.byMethod.bank,
      tender_charge: result.totals.byMethod.charge,
      change_due: result.change_due,
      settings: settingsObj,
    });

    return {
      id: result.saleId,
      sale_number: result.sale_number,
      document_type: input.document_type,
      total: result.totals.total,
      vat_amount: result.totals.vat.vat_amount,
      vatable_sale: result.totals.vat.vatable_sale,
      vat_exempt: result.totals.vat.vat_exempt,
      zero_rated: result.totals.vat.zero_rated,
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
      const lines = db.prepare(`SELECT * FROM sale_lines WHERE sale_id = ? AND kind = 'part' AND item_id IS NOT NULL`).all(sale_id);
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

  ipcMain.handle('sales:refund', (_e, sale_id: number, reason: string) => {
    const u = requireUser();
    assertCan(u.role, 'sale.refund');
    if (!reason) throw new Error('Refund reason is required');
    const db = getDb();
    const tx = db.transaction(() => {
      const sale = db.prepare(`SELECT status FROM sales WHERE id = ?`).get(sale_id) as { status: string } | undefined;
      if (!sale) throw new Error('Sale not found');
      if (sale.status !== 'completed') throw new Error('Sale is not in completed state');
      const lines = db.prepare(`SELECT * FROM sale_lines WHERE sale_id = ? AND kind = 'part' AND item_id IS NOT NULL`).all(sale_id);
      for (const l of lines as any[]) {
        recordMovement(db, {
          item_id: l.item_id,
          type: 'refund_in',
          qty: l.qty,
          unit_cost: 0,
          reference_type: 'sale',
          reference_id: sale_id,
          reason: `Refund: ${reason}`,
          user_id: u.id,
        });
      }
      db.prepare(`UPDATE sales SET status = 'refunded', void_reason = ? WHERE id = ?`).run(reason, sale_id);
      record(db, u.id, 'refund_sale', 'sales', sale_id, null, { reason });
    });
    tx();
  });

  ipcMain.handle('sales:get', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'sale.read');
    const db = getDb();
    const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id);
    const lines = db.prepare(`SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY id`).all(id);
    const payments = db.prepare(`SELECT * FROM payments WHERE sale_id = ? ORDER BY id`).all(id);
    return { sale, lines, payments };
  });

  ipcMain.handle('sales:previewReceipt', (_e, id: number) => {
    const u = requireUser();
    assertCan(u.role, 'sale.read');
    const db = getDb();
    const sale = db.prepare(`SELECT sale_number FROM sales WHERE id = ?`).get(id) as { sale_number: string } | undefined;
    if (!sale) throw new Error('Sale not found');
    const path = require('node:path').join(require('electron').app.getPath('userData'), 'receipts', `${sale.sale_number}.pdf`);
    return path;
  });
}

// ---------- total computation ----------

function computeTotals(input: CheckoutInput) {
  const lineTotals = input.lines.map((l) => ({
    line_total: lineTotal(l.qty ?? 1, l.unit_price ?? 0, l.line_discount ?? 0),
    vat_type: l.vat_type ?? 'vatable',
  }));

  const subtotal = Math.round(lineTotals.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
  const discountTotal = 0;

  let scPwdDiscount = 0;
  if (input.sc_pwd) {
    const pct = input.sc_pwd.kind === 'SC' ? readSettingNumber('sc_discount_pct') : readSettingNumber('pwd_discount_pct');
    scPwdDiscount = applyScPwd(lineTotals, pct);
  }
  const vat = computeVat(lineTotals, scPwdDiscount, !!input.sc_pwd);
  const total = Math.round((vat.vatable_sale + vat.vat_amount + vat.vat_exempt + vat.zero_rated) * 100) / 100;

  const byMethod = { cash: 0, gcash: 0, maya: 0, card: 0, bank: 0, charge: 0 };
  let totalPaid = 0;
  for (const p of input.payments) {
    if (p.amount > 0) {
      (byMethod as any)[p.method] = (byMethod as any)[p.method] + p.amount;
      totalPaid += p.amount;
    }
  }
  totalPaid = Math.round(totalPaid * 100) / 100;

  return { subtotal, discountTotal, scPwdDiscount, vat, total, byMethod, totalPaid };
}

function readSettingNumber(key: string): number {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  if (!row) return 0;
  try { return JSON.parse(row.value); } catch { return 0; }
}