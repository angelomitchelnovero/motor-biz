import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import type { CartLine, PaymentLine, Vehicle, ReceiptSeries, SaleResult } from '../preload-types';

const peso = (n: number) => '₱' + (Math.round(n * 100) / 100).toFixed(2);

export default function Pos() {
  const nav = useNavigate();
  const loc = useLocation();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [plateInput, setPlateInput] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [odometer, setOdometer] = useState<number | null>(null);
  const [showPlateLookup, setShowPlateLookup] = useState(false);
  const [series, setSeries] = useState<ReceiptSeries[]>([]);
  const [docType, setDocType] = useState<'SI' | 'OR'>('OR');
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: 'cash', amount: 0 }]);
  const [scPwd, setScPwd] = useState<{ kind: 'SC' | 'PWD'; id_no: string; name: string } | null>(null);
  const [showScPwd, setShowScPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [settings, setSettings] = useState<any>(null);

  // pre-fill from JO if ?jo=ID
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const joId = params.get('jo');
    if (joId) {
      window.api.jobOrders.get(Number(joId)).then((jo: any) => {
        if (jo) {
          setCart(jo.lines.map((l: any) => ({
            kind: l.kind,
            item_id: l.item_id ?? undefined,
            description: l.description,
            qty: l.qty,
            unit_price: l.unit_price,
            line_discount: l.line_discount,
            vat_type: 'vatable',
            mechanic_id: l.mechanic_id,
          })));
          window.api.vehicles.get(jo.vehicle_id).then((v: any) => {
            setVehicle(v);
            setCustomerName(v.customer_name ?? '');
            setPlateInput(v.plate_number);
            setOdometer(v.current_odometer);
          });
        }
      });
    }
  }, [loc.search]);

  useEffect(() => {
    window.api.items.list().then(setItems);
    window.api.settings.listSeries().then((rows: any[]) => {
      setSeries(rows);
      const active = rows.find((r) => r.document_type === docType && r.active);
      if (active) setSeriesId(active.id);
    });
    window.api.settings.get().then(setSettings);
  }, [docType]);

  useEffect(() => {
    if (!search) { setItems([]); return; }
    const t = setTimeout(() => {
      window.api.items.list(search).then(setItems);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  // barcode lookup on Enter
  async function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const found = await window.api.items.lookupByBarcode(search);
      if (found) {
        addItemToCart(found);
        setSearch('');
      }
    }
  }

  function addItemToCart(item: any) {
    if (item.stock_on_hand <= 0 && item.unit !== 'pc' /* services are added as free text */) {
      // still allow services etc; for parts, warn below
    }
    setCart((c) => {
      const existing = c.find((l) => l.kind === 'part' && l.item_id === item.id);
      if (existing) return c.map((l) => l === existing ? { ...l, qty: l.qty + 1 } : l);
      return [...c, {
        kind: 'part', item_id: item.id, description: item.name, qty: 1,
        unit_price: item.price, line_discount: 0, vat_type: 'vatable',
      }];
    });
  }

  function addServiceLine() {
    const desc = prompt('Service description (e.g., PMS Labor)');
    if (!desc) return;
    const priceStr = prompt('Price (₱)');
    if (!priceStr) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) return;
    setCart((c) => [...c, { kind: 'service', description: desc, qty: 1, unit_price: price, line_discount: 0, vat_type: 'vatable' }]);
  }

  function updateLine(i: number, patch: Partial<CartLine>) {
    setCart((c) => c.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function removeLine(i: number) { setCart((c) => c.filter((_, idx) => idx !== i)); }

  async function lookupPlate() {
    if (!plateInput.trim()) return;
    const v = await window.api.vehicles.lookupByPlate(plateInput);
    if (v) {
      setVehicle(v);
      setCustomerName(v.customer_name ?? '');
      setOdometer(v.current_odometer);
      showToast({ text: `Found ${v.plate_number} — ${v.customer_name}` });
    } else {
      showToast({ kind: 'warn', text: 'Plate not found. Create a customer + vehicle first.' });
    }
  }

  const totals = useMemo(() => computeTotals(cart, scPwd, settings), [cart, scPwd, settings]);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const changeDue = Math.max(0, totalPaid - totals.total);

  async function checkout() {
    if (cart.length === 0) return showToast({ kind: 'warn', text: 'Cart is empty' });
    if (totalPaid < totals.total - 0.01) return showToast({ kind: 'warn', text: 'Insufficient payment' });
    if (!seriesId) return showToast({ kind: 'warn', text: 'No active receipt series configured' });
    setBusy(true);
    try {
      const params = new URLSearchParams(loc.search);
      const joId = params.get('jo');
      const r = await window.api.sales.checkout({
        jo_id: joId ? Number(joId) : null,
        customer_id: vehicle?.customer_id ?? null,
        vehicle_id: vehicle?.id ?? null,
        document_type: docType,
        series_id: seriesId,
        lines: cart,
        payments: payments.filter((p) => p.amount > 0),
        sc_pwd: scPwd,
        odometer: odometer,
      });
      setResult(r);
      setCart([]);
      setPayments([{ method: 'cash', amount: 0 }]);
      setVehicle(null);
      setCustomerName('');
      setPlateInput('');
      setOdometer(null);
      setScPwd(null);
      showToast({ text: `Sale ${r.sale_number} recorded` });
    } catch (e: any) {
      showToast({ kind: 'error', text: e?.message ?? 'Checkout failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <div className="page-title"><h1>POS</h1></div>
    <div className="pos-layout">
      <div className="pos-catalog">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Search by name / SKU / part #  — or scan barcode + Enter"
            value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} autoFocus />
          <div className="actions">
            <button className="btn" onClick={addServiceLine}>+ Service</button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty">{search ? 'No matches' : 'Start typing to search items'}</div>
        ) : (
          <div className="item-grid">
            {items.map((i) => (
              <div key={i.id} className="item-tile" onClick={() => addItemToCart(i)}
                style={{ opacity: i.active ? 1 : 0.5, borderColor: i.stock_on_hand <= 0 ? 'var(--danger)' : undefined }}>
                <div className="name">{i.name}</div>
                <div className="price">{peso(i.price)}</div>
                <div className="stock">{i.stock_on_hand} {i.unit} in stock</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pos-cart">
        <h3 style={{ margin: '0 0 8px 0' }}>Cart</h3>

        <div style={{ background: '#fafbfc', border: '1px solid var(--border)', padding: 8, borderRadius: 6, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Vehicle (optional)</div>
          <div className="row">
            <input className="input" placeholder="Plate #" value={plateInput}
              onChange={(e) => setPlateInput(e.target.value.toUpperCase())} onBlur={lookupPlate} />
            <div className="actions"><button className="btn" onClick={() => setShowPlateLookup(true)}>Lookup</button></div>
          </div>
          {vehicle && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div><strong>{vehicle.plate_number}</strong> — {vehicle.make} {vehicle.model}</div>
              <div>{customerName} · odometer {odometer} km</div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {cart.length === 0 ? (
            <div className="empty">Cart is empty</div>
          ) : cart.map((l, i) => {
            const lineTotal = Math.max(0, l.qty * l.unit_price - l.line_discount);
            const stockWarn = l.kind === 'part' && l.item_id && items.find((x) => x.id === l.item_id)?.stock_on_hand < l.qty;
            return (
              <div key={i} className="cart-line">
                <div className="desc">
                  {l.description}
                  <small>{peso(l.unit_price)} / {l.kind}{stockWarn ? ' · ⚠ stock' : ''}</small>
                </div>
                <input type="number" className="input" min="1" value={l.qty}
                  onChange={(e) => updateLine(i, { qty: Math.max(1, +e.target.value || 1) })} />
                <input type="number" className="input" min="0" step="0.01" value={l.line_discount}
                  onChange={(e) => updateLine(i, { line_discount: Math.max(0, +e.target.value || 0) })} title="discount" />
                <button className="btn" onClick={() => removeLine(i)}>×</button>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Subtotal</span><span>{peso(totals.subtotal)}</span>
          </div>
          {totals.scPwdDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--warn)' }}>
              <span>{scPwd?.kind} {scPwd?.kind === 'SC' ? settings?.sc_discount_pct : settings?.pwd_discount_pct}%</span>
              <span>-{peso(totals.scPwdDiscount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>VATable</span><span>{peso(totals.vatable_sale)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>VAT 12%</span><span>{peso(totals.vat_amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 6 }}>
            <span>Total</span><span>{peso(totals.total)}</span>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Document</div>
          <div className="row" style={{ marginBottom: 8 }}>
            <select className="select" value={docType} onChange={(e) => setDocType(e.target.value as any)}>
              <option value="OR">Official Receipt</option>
              <option value="SI">Sales Invoice</option>
            </select>
            <select className="select" value={seriesId ?? ''} onChange={(e) => setSeriesId(Number(e.target.value) || null)}>
              <option value="">— select series —</option>
              {series.filter((s) => s.document_type === docType && s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.prefix} @ {s.branch}/{s.terminal}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Payments (split tender)</div>
          {payments.map((p, i) => (
            <div key={i} className="row" style={{ marginBottom: 4 }}>
              <select className="select" value={p.method} onChange={(e) => {
                const m = e.target.value;
                setPayments((cur) => cur.map((x, idx) => idx === i ? { ...x, method: m as any } : x));
              }}>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="charge">Charge Account</option>
              </select>
              <input type="number" className="input" min="0" step="0.01" value={p.amount}
                onChange={(e) => {
                  const a = +e.target.value || 0;
                  setPayments((cur) => cur.map((x, idx) => idx === i ? { ...x, amount: a } : x));
                }} />
              <div className="actions">
                <button className="btn" onClick={() => setPayments((c) => c.filter((_, idx) => idx !== i))}>×</button>
              </div>
            </div>
          ))}
          <button className="btn" onClick={() => setPayments((p) => [...p, { method: 'cash', amount: 0 }])} style={{ marginBottom: 8 }}>
            + Add payment method
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Tendered</span><span>{peso(totalPaid)}</span>
          </div>
          {changeDue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--accent)' }}>
              <span>Change due</span><span>{peso(changeDue)}</span>
            </div>
          )}

          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="btn" onClick={() => setShowScPwd(true)}>{scPwd ? `${scPwd.kind}: ${scPwd.name}` : 'SC/PWD'}</button>
            <button className="btn primary" onClick={checkout} disabled={busy || cart.length === 0}
              style={{ flex: 1 }}>{busy ? 'Processing…' : `Charge ${peso(totals.total)}`}</button>
          </div>
        </div>
      </div>

      <Modal open={!!result} title={`Sale ${result?.sale_number} complete`}
        onClose={() => setResult(null)}
        footer={
          <>
            <button className="btn" onClick={async () => {
              if (result) await openReceipt(result.receipt_pdf_path);
            }}>Open receipt</button>
            <button className="btn primary" onClick={() => setResult(null)}>Done</button>
          </>
        }
      >
        {result && (
          <>
            <p>Receipt PDF saved to:</p>
            <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{result.receipt_pdf_path}</code>
            <p style={{ marginTop: 12 }}>Total: <strong>{peso(result.total)}</strong> · VAT: {peso(result.vat_amount)}</p>
          </>
        )}
      </Modal>

      <Modal open={showPlateLookup} title="Plate Lookup" onClose={() => setShowPlateLookup(false)}>
        <p>Type a partial plate — search updates as you type.</p>
        <input className="input" autoFocus placeholder="e.g. ABC 12" value={plateInput}
          onChange={(e) => setPlateInput(e.target.value.toUpperCase())} onBlur={lookupPlate} />
      </Modal>

      <Modal open={showScPwd} title={scPwd ? `Edit ${scPwd.kind} discount` : 'Senior / PWD discount'} onClose={() => setShowScPwd(false)}
        footer={<>
          <button className="btn" onClick={() => { setScPwd(null); setShowScPwd(false); }}>Remove</button>
          <button className="btn primary" onClick={() => setShowScPwd(false)}>Apply</button>
        </>}
      >
        <ScPwdForm value={scPwd} onChange={setScPwd} />
      </Modal>
    </div>
    </>
  );
}

function ScPwdForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value ?? { kind: 'SC', id_no: '', name: '' };
  return (
    <>
      <div className="field"><label>Type</label>
        <select className="select" value={v.kind} onChange={(e) => onChange({ ...v, kind: e.target.value })}>
          <option value="SC">Senior Citizen (20%)</option>
          <option value="PWD">PWD (5%)</option>
        </select>
      </div>
      <div className="field"><label>ID No.</label>
        <input className="input" value={v.id_no} onChange={(e) => onChange({ ...v, id_no: e.target.value })} />
      </div>
      <div className="field"><label>Name</label>
        <input className="input" value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value })} />
      </div>
    </>
  );
}

async function openReceipt(path: string) {
  await window.api.shell.openPath(path);
}

function computeTotals(cart: CartLine[], scPwd: any, settings: any) {
  const VAT_RATE = 0.12;
  const subtotal = cart.reduce((s, l) => s + Math.max(0, l.qty * l.unit_price - l.line_discount), 0);
  const vatableInc = cart.filter((l) => l.vat_type === 'vatable').reduce((s, l) => s + Math.max(0, l.qty * l.unit_price - l.line_discount), 0);
  let scPwdDiscount = 0;
  if (scPwd) {
    const pct = scPwd.kind === 'SC' ? Number(settings?.sc_discount_pct ?? 20) : Number(settings?.pwd_discount_pct ?? 5);
    scPwdDiscount = Math.round(vatableInc * (pct / 100) * 100) / 100;
  }
  const vatableNet = Math.max(0, vatableInc - scPwdDiscount);
  const vatable_sale = Math.round((vatableNet / (1 + VAT_RATE)) * 100) / 100;
  const vat_amount = Math.round((vatableNet - vatable_sale) * 100) / 100;
  const vat_exempt = cart.filter((l) => l.vat_type === 'exempt').reduce((s, l) => s + Math.max(0, l.qty * l.unit_price - l.line_discount), 0);
  const zero_rated = cart.filter((l) => l.vat_type === 'zero').reduce((s, l) => s + Math.max(0, l.qty * l.unit_price - l.line_discount), 0);
  const total = Math.round((vatable_sale + vat_amount + vat_exempt + zero_rated) * 100) / 100;
  return { subtotal, scPwdDiscount, vatable_sale, vat_amount, vat_exempt, zero_rated, total };
}