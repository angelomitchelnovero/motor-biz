import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import type { CartLine, SaleResult } from '../preload-types';

const peso = (n: number) => '₱' + (Math.round(n * 100) / 100).toFixed(2);

export default function Pos() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'card' | 'other'>('cash');
  const [tendered, setTendered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);

  useEffect(() => { window.api.items.list().then(setItems); }, []);

  useEffect(() => {
    if (!search) { setItems([]); return; }
    const t = setTimeout(() => { window.api.items.list(search).then(setItems); }, 200);
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
    setCart((c) => {
      const existing = c.find((l) => l.item_id === item.id);
      if (existing) return c.map((l) => l.item_id === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...c, {
        item_id: item.id,
        description: item.name,
        qty: 1,
        unit_price: item.price,
        line_discount: 0,
      }];
    });
  }

  function updateLine(i: number, patch: Partial<CartLine>) {
    setCart((c) => c.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function removeLine(i: number) { setCart((c) => c.filter((_, idx) => idx !== i)); }

  const total = useMemo(() => {
    return Math.round(cart.reduce((s, l) => s + Math.max(0, l.qty * l.unit_price - l.line_discount), 0) * 100) / 100;
  }, [cart]);
  const changeDue = Math.max(0, Math.round((tendered - total) * 100) / 100);

  async function checkout() {
    if (cart.length === 0) return showToast({ kind: 'warn', text: 'Cart is empty' });
    if (tendered < total - 0.01) return showToast({ kind: 'warn', text: 'Insufficient payment' });
    setBusy(true);
    try {
      const r = await window.api.sales.checkout({
        lines: cart,
        payment_method: paymentMethod,
        tendered,
        customer_name: customerName.trim() || null,
      });
      setResult(r);
      setCart([]);
      setTendered(0);
      setCustomerName('');
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
          <div style={{ marginBottom: 12 }}>
            <input className="input" placeholder="Search by name / SKU — or scan barcode + Enter"
              value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} autoFocus />
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
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Customer (optional)</div>
            <input className="input" placeholder="Walk-in name" value={customerName}
              onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {cart.length === 0 ? (
              <div className="empty">Cart is empty</div>
            ) : cart.map((l, i) => {
              const lineTotal = Math.max(0, l.qty * l.unit_price - l.line_discount);
              const stockWarn = l.item_id && items.find((x) => x.id === l.item_id)?.stock_on_hand < l.qty;
              return (
                <div key={i} className="cart-line">
                  <div className="desc">
                    {l.description}
                    <small>{peso(l.unit_price)} each{stockWarn ? ' · ⚠ stock' : ''}</small>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
              <span>Total</span><span>{peso(total)}</span>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Payment</label>
                <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Tendered</label>
                <input className="input" type="number" min="0" step="0.01" value={tendered}
                  onChange={(e) => setTendered(+e.target.value || 0)} />
              </div>
            </div>

            {changeDue > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>
                <span>Change due</span><span>{peso(changeDue)}</span>
              </div>
            )}

            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button className="btn primary" onClick={checkout} disabled={busy || cart.length === 0}
                style={{ flex: 1 }}>{busy ? 'Processing…' : `Charge ${peso(total)}`}</button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!result} title={`Sale ${result?.sale_number} complete`}
        onClose={() => setResult(null)}
        footer={
          <>
            <button className="btn" onClick={async () => { if (result) await openReceipt(result.receipt_pdf_path); }}>Open receipt</button>
            <button className="btn primary" onClick={() => setResult(null)}>Done</button>
          </>
        }
      >
        {result && (
          <>
            <p>Receipt PDF saved to:</p>
            <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{result.receipt_pdf_path}</code>
            <p style={{ marginTop: 12 }}>Total: <strong>{peso(result.total)}</strong></p>
            {result.change_due > 0 && <p>Change: <strong>{peso(result.change_due)}</strong></p>}
          </>
        )}
      </Modal>
    </>
  );
}

async function openReceipt(path: string) {
  await window.api.shell.openPath(path);
}