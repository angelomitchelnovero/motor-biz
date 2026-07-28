import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../../components/Toast';
import { can } from '../../permissions';
import { useAuth } from '../../hooks/useAuth';

const peso = (n: number) => '₱' + (Math.round(n * 100) / 100).toFixed(2);

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveCost, setReceiveCost] = useState(0);
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('');

  async function load() {
    const it = await window.api.items.get(Number(id));
    setItem(it);
    setDraft(it);
  }
  useEffect(() => { load(); }, [id]);

  if (!item) return <div className="empty">Loading…</div>;

  async function save() {
    try {
      await window.api.items.update(item.id, draft);
      showToast({ text: 'Saved' });
      setEditing(false);
      load();
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  async function receive() {
    if (receiveQty <= 0) return;
    try {
      await window.api.stock.receive({ item_id: item.id, qty: receiveQty, unit_cost: receiveCost });
      showToast({ text: `Received ${receiveQty}` });
      setReceiveQty(0);
      load();
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  async function adjust() {
    if (adjQty === 0 || !adjReason) { showToast({ kind: 'warn', text: 'qty and reason required' }); return; }
    try {
      await window.api.stock.adjust({ item_id: item.id, qty_delta: adjQty, reason: adjReason });
      showToast({ text: 'Adjusted' });
      setAdjQty(0); setAdjReason('');
      load();
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  return (
    <>
      <div className="page-title">
        <h1>{item.name}</h1>
        <div>
          <button className="btn" onClick={() => nav('/inventory')}>Back</button>
          {user && can(user.role, 'item.update') && !editing && <button className="btn primary" onClick={() => setEditing(true)} style={{ marginLeft: 8 }}>Edit</button>}
        </div>
      </div>

      <div className="card">
        <table className="table" style={{ width: 'auto' }}>
          <tbody>
            <Field label="SKU" value={item.sku} edit={editing} v={draft.sku} onV={(v) => setDraft({ ...draft, sku: v })} />
            <Field label="Barcode" value={item.barcode ?? ''} edit={editing} v={draft.barcode ?? ''} onV={(v) => setDraft({ ...draft, barcode: v || null })} />
            <Field label="Part #" value={item.part_number ?? ''} edit={editing} v={draft.part_number ?? ''} onV={(v) => setDraft({ ...draft, part_number: v })} />
            <Field label="Name" value={item.name} edit={editing} v={draft.name} onV={(v) => setDraft({ ...draft, name: v })} />
            <Field label="Category" value={item.category ?? ''} edit={editing} v={draft.category ?? ''} onV={(v) => setDraft({ ...draft, category: v })} />
            <Field label="Brand" value={item.brand ?? ''} edit={editing} v={draft.brand ?? ''} onV={(v) => setDraft({ ...draft, brand: v })} />
            <Field label="Unit" value={item.unit} edit={editing} v={draft.unit} onV={(v) => setDraft({ ...draft, unit: v })} />
            <Field label="Cost" value={peso(item.cost)} edit={editing} v={String(draft.cost)} onV={(v) => setDraft({ ...draft, cost: +v || 0 })} numeric />
            <Field label="Price" value={peso(item.price)} edit={editing} v={String(draft.price)} onV={(v) => setDraft({ ...draft, price: +v || 0 })} numeric />
            <Field label="Reorder pt" value={item.reorder_point} edit={editing} v={String(draft.reorder_point)} onV={(v) => setDraft({ ...draft, reorder_point: +v || 0 })} numeric />
            <Field label="Reorder qty" value={item.reorder_qty} edit={editing} v={String(draft.reorder_qty)} onV={(v) => setDraft({ ...draft, reorder_qty: +v || 0 })} numeric />
            <Field label="Location" value={item.location ?? ''} edit={editing} v={draft.location ?? ''} onV={(v) => setDraft({ ...draft, location: v })} />
            <tr><td colSpan={2}><strong>Stock on hand:</strong> {item.stock_on_hand} {item.unit} ({peso(item.stock_value ?? 0)})</td></tr>
          </tbody>
        </table>
        {editing && (
          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => { setEditing(false); setDraft(item); }}>Cancel</button>
            <button className="btn primary" onClick={save}>Save</button>
          </div>
        )}
      </div>

      {user && can(user.role, 'stock.receive') && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Receive stock</h3>
          <div className="row">
            <div className="field"><label>Qty</label><input className="input" type="number" min="0" step="0.01" value={receiveQty} onChange={(e) => setReceiveQty(+e.target.value || 0)} /></div>
            <div className="field"><label>Unit cost (₱)</label><input className="input" type="number" min="0" step="0.01" value={receiveCost} onChange={(e) => setReceiveCost(+e.target.value || 0)} /></div>
            <div className="actions" style={{ alignSelf: 'flex-end' }}><button className="btn primary" onClick={receive}>Receive</button></div>
          </div>
        </div>
      )}

      {user && can(user.role, 'stock.adjust') && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Adjust stock</h3>
          <div className="row">
            <div className="field"><label>Qty delta (±)</label><input className="input" type="number" step="0.01" value={adjQty} onChange={(e) => setAdjQty(+e.target.value || 0)} /></div>
            <div className="field"><label>Reason</label><input className="input" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} /></div>
            <div className="actions" style={{ alignSelf: 'flex-end' }}><button className="btn warn" onClick={adjust}>Adjust</button></div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, edit, v, onV, numeric }: { label: string; value: any; edit: boolean; v: any; onV: (v: any) => void; numeric?: boolean }) {
  return (
    <tr>
      <td style={{ width: 140, fontWeight: 600, color: 'var(--muted)' }}>{label}</td>
      <td>{edit ? <input className="input" type={numeric ? 'number' : 'text'} value={v} onChange={(e) => onV(e.target.value)} /> : value}</td>
    </tr>
  );
}