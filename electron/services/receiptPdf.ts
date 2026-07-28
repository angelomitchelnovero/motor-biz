// BIR-formatted receipt PDF renderer. Same template spec as thermal.
// Writes to app.getPath('userData')/receipts/<sale_number>.pdf

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface Settings {
  business_name: string;
  address1: string;
  address2: string;
  tin: string;
  vat_reg_tin: string;
  bir_atp_sn: string;
  bir_atp_min: string;
  bir_atp_date: string;
  vat_mode: 'inclusive' | 'exclusive';
  sc_discount_pct: number;
  pwd_discount_pct: number;
  default_branch: string;
  default_terminal: string;
}

export interface ReceiptLine {
  description: string;
  qty: number;
  unit_price: number;
  line_discount: number;
  vat_type: 'vatable' | 'exempt' | 'zero';
  line_total: number;
}

export interface ReceiptData {
  sale_number: string;
  document_type: 'SI' | 'OR';
  series_prefix: string;
  series_number: number;
  created_at: string;
  cashier_name: string;
  customer_name: string | null;
  vehicle_plate: string | null;
  vehicle_label: string | null;
  lines: ReceiptLine[];
  subtotal: number;
  discount_total: number;
  sc_pwd_kind: string | null;
  sc_pwd_discount: number;
  sc_pwd_id_no: string | null;
  sc_pwd_name: string | null;
  vatable_sale: number;
  vat_exempt: number;
  zero_rated: number;
  vat_amount: number;
  total: number;
  tender_cash: number;
  tender_gcash: number;
  tender_maya: number;
  tender_card: number;
  tender_bank: number;
  tender_charge: number;
  change_due: number;
  settings: Settings;
}

function peso(n: number): string {
  return '₱' + (Math.round(n * 100) / 100).toFixed(2);
}

export async function renderReceiptPdf(data: ReceiptData): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'receipts');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${data.sale_number}.pdf`);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: [240, 1000], margin: 8 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const s = data.settings;
    doc.fontSize(10).font('Helvetica-Bold').text(s.business_name, { align: 'center' });
    doc.fontSize(7).font('Helvetica').text(s.address1, { align: 'center' });
    if (s.address2) doc.text(s.address2, { align: 'center' });
    doc.text(`TIN: ${s.tin}`, { align: 'center' });
    doc.text(`VAT Reg. TIN: ${s.vat_reg_tin}`, { align: 'center' });
    doc.text(`SN: ${s.bir_atp_sn}`, { align: 'center' });
    doc.text(`Min: ${s.bir_atp_min}  Dated: ${s.bir_atp_date}`, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(9).font('Helvetica-Bold').text(data.document_type === 'OR' ? 'OFFICIAL RECEIPT' : 'SALES INVOICE', { align: 'center' });
    doc.fontSize(8).font('Helvetica').text(`No. ${data.series_prefix}-${String(data.series_number).padStart(9, '0')}`, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica').text(`Date: ${data.created_at}`);
    doc.text(`Cashier: ${data.cashier_name}`);
    if (data.customer_name) doc.text(`Customer: ${data.customer_name}`);
    if (data.vehicle_plate) doc.text(`Plate: ${data.vehicle_plate}${data.vehicle_label ? '  ' + data.vehicle_label : ''}`);
    doc.moveDown(0.3);

    // line table
    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('Qty  Description                        Price');
    doc.font('Helvetica');
    for (const l of data.lines) {
      const desc = l.description.length > 28 ? l.description.slice(0, 28) + '…' : l.description;
      doc.text(`${l.qty.toString().padEnd(5)}${desc.padEnd(35)}${peso(l.line_total).padStart(8)}`);
    }
    doc.moveDown(0.3);

    // totals
    doc.fontSize(7).font('Helvetica');
    const row = (label: string, value: string, bold = false) => {
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.text(`${label.padEnd(28)}${value.padStart(8)}`);
    };
    row('Subtotal', peso(data.subtotal));
    if (data.discount_total > 0) row('Discount', '-' + peso(data.discount_total));
    if (data.sc_pwd_discount > 0) row(`${data.sc_pwd_kind} Disc (${data.sc_pwd_kind === 'SC' ? s.sc_discount_pct : s.pwd_discount_pct}%)`, '-' + peso(data.sc_pwd_discount));
    row('VATable Sale', peso(data.vatable_sale));
    if (data.vat_exempt > 0) row('VAT-Exempt', peso(data.vat_exempt));
    if (data.zero_rated > 0) row('Zero-Rated', peso(data.zero_rated));
    row('VAT Amount (12%)', peso(data.vat_amount), true);
    row('TOTAL', peso(data.total), true);

    doc.moveDown(0.3);
    if (data.tender_cash > 0)    row('Cash',    peso(data.tender_cash));
    if (data.tender_gcash > 0)   row('GCash',   peso(data.tender_gcash));
    if (data.tender_maya > 0)    row('Maya',    peso(data.tender_maya));
    if (data.tender_card > 0)    row('Card',    peso(data.tender_card));
    if (data.tender_bank > 0)    row('Bank',    peso(data.tender_bank));
    if (data.tender_charge > 0)  row('Charge',  peso(data.tender_charge));
    if (data.change_due > 0)     row('Change',  peso(data.change_due));

    if (data.sc_pwd_kind) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(`${data.sc_pwd_kind} Discount Block:`);
      doc.font('Helvetica').text(`Name: ${data.sc_pwd_name ?? ''}`);
      doc.text(`ID No.: ${data.sc_pwd_id_no ?? ''}`);
      doc.text('Signature: ____________________');
    }

    doc.moveDown(0.5);
    doc.fontSize(6).text(`This serves as your ${data.document_type}. Thank you!`, { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
