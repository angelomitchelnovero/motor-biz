// Simple cash-register receipt PDF. Writes to
// app.getPath('userData')/receipts/<sale_number>.pdf

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ReceiptSettings {
  business_name: string;
  address1: string;
  address2: string;
}

export interface ReceiptLine {
  description: string;
  qty: number;
  unit_price: number;
  line_discount: number;
  line_total: number;
}

export interface ReceiptData {
  sale_number: string;
  created_at: string;
  cashier_name: string;
  customer_name: string | null;
  lines: ReceiptLine[];
  total: number;
  payment_method: string;
  tendered: number;
  change_due: number;
  settings: ReceiptSettings;
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
    doc.moveDown(0.3);

    doc.fontSize(9).font('Helvetica-Bold').text('RECEIPT', { align: 'center' });
    doc.fontSize(8).font('Helvetica').text(`No. ${data.sale_number}`, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(7).font('Helvetica').text(`Date: ${data.created_at}`);
    doc.text(`Cashier: ${data.cashier_name}`);
    if (data.customer_name) doc.text(`Customer: ${data.customer_name}`);
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
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text(`${'TOTAL'.padEnd(28)}${peso(data.total).padStart(8)}`);

    doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica');
    doc.text(`${'Paid (' + data.payment_method + ')'.padEnd(28)}${peso(data.tendered).padStart(8)}`);
    if (data.change_due > 0) doc.text(`${'Change'.padEnd(28)}${peso(data.change_due).padStart(8)}`);

    doc.moveDown(0.5);
    doc.fontSize(6).text('Thank you!', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}