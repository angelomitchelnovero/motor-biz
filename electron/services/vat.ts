// VAT breakdown for PH sales.
// - Default mode: VAT-inclusive (prices on the shelf include 12% VAT).
// - Per line: vatable = total / 1.12, vat = total - vatable (rounded to centavos).
// - SC/PWD discount reduces VATable sale (configurable, default 20% SC / 5% PWD).
//   The discount itself is VAT-inclusive in PH practice — i.e., subtract from the
//   VAT-inclusive amount and recompute vatable/vat from the remainder.

export type VatType = 'vatable' | 'exempt' | 'zero';

export interface LineInput {
  line_total: number;
  vat_type: VatType;
}

export interface VatBreakdown {
  vatable_sale: number;
  vat_exempt: number;
  zero_rated: number;
  vat_amount: number;
}

const VAT_RATE = 0.12;

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function computeVat(lines: LineInput[], scPwdDiscount: number, scPwdOn: boolean): VatBreakdown {
  let vatableInc = 0;
  let exempt = 0;
  let zero = 0;

  for (const l of lines) {
    if (l.vat_type === 'vatable') vatableInc += l.line_total;
    else if (l.vat_type === 'exempt') exempt += l.line_total;
    else zero += l.line_total;
  }

  // Apply SC/PWD discount to VATable portion only (PH rule).
  let discountApplied = 0;
  if (scPwdOn && scPwdDiscount > 0) {
    discountApplied = round2(Math.min(vatableInc, scPwdDiscount));
    vatableInc = round2(vatableInc - discountApplied);
  }

  const vatableSale = round2(vatableInc / (1 + VAT_RATE));
  const vatAmount = round2(vatableInc - vatableSale);

  return {
    vatable_sale: vatableSale,
    vat_exempt: round2(exempt),
    zero_rated: round2(zero),
    vat_amount: vatAmount,
  };
}

// Apply SC/PWD discount to the cart. Returns the discount amount in pesos.
export function applyScPwd(
  lines: { line_total: number; vat_type: VatType }[],
  pct: number,
): number {
  const vatableInc = lines
    .filter((l) => l.vat_type === 'vatable')
    .reduce((s, l) => s + l.line_total, 0);
  return round2(vatableInc * (pct / 100));
}
