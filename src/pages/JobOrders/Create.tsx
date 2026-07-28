import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/Toast';

interface VehicleOpt { id: number; plate_number: string; customer_id: number; customer_name: string; make: string; model: string; }
interface ItemOpt { id: number; name: string; price: number; sku: string; }

export default function JoCreate() {
  const nav = useNavigate();
  const [plateInput, setPlateInput] = useState('');
  const [vehicle, setVehicle] = useState<VehicleOpt | null>(null);
  const [mechanicId, setMechanicId] = useState<number | null>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [odometer, setOdometer] = useState(0);
  const [complaint, setComplaint] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.auth.listUsers().then((u: any[]) => setMechanics(u.filter((x) => x.role === 'mechanic' && x.active)));
  }, []);

  useEffect(() => {
    if (!itemSearch) { setItems([]); return; }
    const t = setTimeout(() => window.api.items.list(itemSearch).then((r: any) => setItems(r)), 200);
    return () => clearTimeout(t);
  }, [itemSearch]);

  async function lookup() {
    if (!plateInput.trim()) return;
    const v = await window.api.vehicles.lookupByPlate(plateInput);
    if (v) {
      setVehicle(v as any);
      setOdometer((v as any).current_odometer ?? 0);
      setPlateInput(v.plate_number);
    } else showToast({ kind: 'warn', text: 'Plate not found' });
  }

  function addPart(item: ItemOpt) {
    setLines((l) => [...l, {
      kind: 'part', item_id: item.id, description: item.name, qty: 1, unit_price: item.price, line_discount: 0,
      mechanic_id: mechanicId,
    }]);
  }
  function addService() {
    const desc = prompt('Service description'); if (!desc) return;
    const pStr = prompt('Price (₱)'); if (!pStr) return;
    const price = parseFloat(pStr); if (isNaN(price)) return;
    setLines((l) => [...l, { kind: 'service', description: desc, qty: 1, unit_price: price, line_discount: 0, mechanic_id: mechanicId }]);
  }
  function updateLine(i: number, patch: any) { setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x)); }
  function removeLine(i: number) { setLines((l) => l.filter((_, idx) => idx !== i)); }

  async function save(status: 'queued' | 'ready') {
    if (!vehicle) { showToast({ kind: 'warn', text: 'Lookup a plate first' }); return; }
    if (lines.length === 0) { showToast({ kind: 'warn', text: 'Add at least one part or service' }); return; }
    setBusy(true);
    try {
      const jo = await window.api.jobOrders.create({
        vehicle_id: vehicle.id, customer_id: vehicle.customer_id,
        complaint, current_odometer: odometer, primary_mechanic_id: mechanicId, lines,
      });
      if (status === 'ready') {
        await window.api.jobOrders.updateStatus((jo as any).id, 'in_progress');
        await window.api.jobOrders.updateStatus((jo as any).id, 'ready');
      }
      showToast({ text: `Created ${(jo as any).jo_number}` });
      nav(`/job-orders/${(jo as any).id}`);
    } catch (e: any) {
      showToast({ kind: 'error', text: e?.message ?? 'Failed' });
    } finally { setBusy(false); }
  }

  const total = lines.reduce((s, l) => s + Math.max(0, l.qty * l.unit_price - l.line_discount), 0);

  return (
    <>
      <div className="page-title"><h1>New Job Order</h1></div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vehicle</h3>
        <div className="row">
          <input className="input" placeholder="Plate #" value={plateInput}
            onChange={(e) => setPlateInput(e.target.value.toUpperCase())} onBlur={lookup} />
          <div className="actions"><button className="btn" onClick={lookup}>Find</button></div>
        </div>
        {vehicle && (
          <div style={{ marginTop: 12, padding: 8, background: '#fafbfc', borderRadius: 6 }}>
            <strong>{vehicle.plate_number}</strong> — {vehicle.make} {vehicle.model}
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{vehicle.customer_name}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Job details</h3>
        <div className="row">
          <div className="field">
            <label>Primary mechanic</label>
            <select className="select" value={mechanicId ?? ''} onChange={(e) => setMechanicId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— none —</option>
              {mechanics.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Current odometer (km)</label>
            <input className="input" type="number" min="0" value={odometer} onChange={(e) => setOdometer(+e.target.value || 0)} />
          </div>
        </div>
        <div className="field">
          <label>Complaint</label>
          <textarea className="textarea" rows={3} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Customer complaint, observed issues…" />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Parts & Services</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Search parts to add…" value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)} />
          <div className="actions"><button className="btn" onClick={addService}>+ Service</button></div>
        </div>
        {items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {items.slice(0, 8).map((i) => (
              <button key={i.id} className="btn" onClick={() => addPart(i)}>+ {i.name}</button>
            ))}
          </div>
        )}

        <table className="table">
          <thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const t = Math.max(0, l.qty * l.unit_price - l.line_discount);
              return (
                <tr key={i}>
                  <td><span className={`badge ${l.kind === 'part' ? 'ok' : 'muted'}`}>{l.kind}</span></td>
                  <td><input className="input" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} /></td>
                  <td><input className="input" type="number" min="1" value={l.qty} onChange={(e) => updateLine(i, { qty: Math.max(1, +e.target.value || 1) })} style={{ width: 60 }} /></td>
                  <td><input className="input" type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: +e.target.value || 0 })} style={{ width: 90 }} /></td>
                  <td><input className="input" type="number" min="0" step="0.01" value={l.line_discount} onChange={(e) => updateLine(i, { line_discount: +e.target.value || 0 })} style={{ width: 80 }} /></td>
                  <td className="num">₱{t.toFixed(2)}</td>
                  <td><button className="btn" onClick={() => removeLine(i)}>×</button></td>
                </tr>
              );
            })}
            {lines.length === 0 && <tr><td colSpan={7} className="empty">No lines yet</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td><td className="num" style={{ fontWeight: 700 }}>₱{total.toFixed(2)}</td><td></td></tr></tfoot>
        </table>

        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={() => save('queued')} disabled={busy}>Save as Queued</button>
          <button className="btn primary" onClick={() => save('ready')} disabled={busy}>Save & Mark Ready</button>
        </div>
      </div>
    </>
  );
}