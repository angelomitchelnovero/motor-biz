// Receipt-series allocator. MUST be called inside a DB transaction — it does an
// immediate SELECT/UPDATE; concurrent transactions block on the row lock.
//
// On exhaustion (current_no > end_no), throws an error so the sale cannot proceed.

import type Database from 'better-sqlite3';

export class ReceiptSeriesExhaustedError extends Error {
  code = 'RECEIPT_SERIES_EXHAUSTED';
  constructor(public seriesId: number) {
    super(`Receipt series ${seriesId} has no numbers remaining`);
  }
}

export function allocate(db: Database.Database, seriesId: number): { prefix: string; number: number; seriesId: number } {
  const row = db.prepare(`SELECT id, prefix, start_no, end_no, current_no FROM receipt_series WHERE id = ? AND active = 1`).get(seriesId) as
    | { id: number; prefix: string; start_no: number; end_no: number; current_no: number }
    | undefined;
  if (!row) throw new Error(`Receipt series ${seriesId} not found or inactive`);
  if (row.current_no >= row.end_no) throw new ReceiptSeriesExhaustedError(seriesId);
  const next = row.current_no + 1;
  db.prepare(`UPDATE receipt_series SET current_no = ? WHERE id = ?`).run(next, row.id);
  return { prefix: row.prefix, number: next, seriesId: row.id };
}

export function formatSaleNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(9, '0')}`;
}
