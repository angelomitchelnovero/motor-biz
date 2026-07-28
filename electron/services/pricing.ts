// Pricing math helpers — applied at sale write-time so prices on items stay
// the source of truth, and the sale records what was actually charged.

export function computeMarkup(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return Math.round(((price - cost) / cost) * 10000) / 100; // pct, 2 decimals
}

export function priceFromMarkup(cost: number, markupPct: number): number {
  return Math.round(cost * (1 + markupPct / 100) * 100) / 100;
}

export function lineTotal(qty: number, unitPrice: number, lineDiscount: number): number {
  const gross = qty * unitPrice;
  const net = Math.max(0, gross - lineDiscount);
  return Math.round(net * 100) / 100;
}
