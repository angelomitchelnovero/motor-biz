import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { can } from '../permissions';
import { useAuth } from '../hooks/useAuth';

export default function Vehicles() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [lookup, setLookup] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ plate_number: '', customer_id: 0, make: '', model: '' });

  useEffect(() => {
    const t = setTimeout(async () => {
      const list = await window.api.vehicles.list(search);
      setRows(list);
      if (search && search.replace(/\s/g, '').length >= 2) {
        const v = await window.api.vehicles.lookupByPlate(search);
        setLookup(v);
      } else setLookup(null);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { window.api.customers.list().then(setCustomers); }, []);

  async function create() {
    if (!draft.plate_number || !draft.customer_id) { showToast({ kind: 'warn', text: 'Plate + customer required' }); return; }
    try {
      await window.api.vehicles.create(draft);
      showToast({ text: `Added ${draft.plate_number}` });
      setShowNew(false);
      setDraft({ plate_number: '', customer_id: 0, make: '', model: '' });
      window.api.vehicles.list(search).then(setRows);
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  return (
    <>
      <div className="page-title">
        <h1>Vehicles · Plate Lookup</h1>
        <div>{user && can(user.role, 'vehicle.create') && <button className="btn primary" onClick={() => setShowNew(true)}>+ New Vehicle</button>}</div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Type or scan plate #…" value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())} autoFocus style={{ fontSize: 18, padding: 12 }} />
      </div>

      {lookup && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{lookup.plate_number}</div>
          <div>{lookup.make} {lookup.model} {lookup.year ?? ''} · {lookup.color}</div>
          <div style={{ marginTop: 4 }}>Owner: <strong>{lookup.customer_name}</strong></div>
          <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 13 }}>
            Last service: {lookup.last_service?.slice(0, 16) ?? 'no recorded service'}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Plate</th><th>Customer</th><th>Vehicle</th><th>Color</th><th className="num">Odometer</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.plate_number}</strong></td>
                <td>{v.customer_name}</td>
                <td>{v.make} {v.model} {v.year ?? ''}</td>
                <td>{v.color ?? '—'}</td>
                <td className="num">{v.current_odometer} km</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No vehicles</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showNew} title="New Vehicle" onClose={() => setShowNew(false)}
        footer={<><button className="btn" onClick={() => setShowNew(false)}>Cancel</button><button className="btn primary" onClick={create}>Create</button></>}
      >
        <div className="field"><label>Plate #</label><input className="input" value={draft.plate_number} onChange={(e) => setDraft({ ...draft, plate_number: e.target.value.toUpperCase() })} /></div>
        <div className="field"><label>Owner (customer)</label>
          <select className="select" value={draft.customer_id} onChange={(e) => setDraft({ ...draft, customer_id: +e.target.value })}>
            <option value="0">— select customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field"><label>Make</label><input className="input" value={draft.make ?? ''} onChange={(e) => setDraft({ ...draft, make: e.target.value })} /></div>
          <div className="field"><label>Model</label><input className="input" value={draft.model ?? ''} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></div>
          <div className="field"><label>Year</label><input className="input" type="number" value={draft.year ?? ''} onChange={(e) => setDraft({ ...draft, year: +e.target.value || null })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Color</label><input className="input" value={draft.color ?? ''} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></div>
          <div className="field"><label>Engine #</label><input className="input" value={draft.engine_no ?? ''} onChange={(e) => setDraft({ ...draft, engine_no: e.target.value })} /></div>
          <div className="field"><label>Chassis #</label><input className="input" value={draft.chassis_no ?? ''} onChange={(e) => setDraft({ ...draft, chassis_no: e.target.value })} /></div>
        </div>
        <div className="field"><label>Current odometer (km)</label><input className="input" type="number" value={draft.current_odometer ?? 0} onChange={(e) => setDraft({ ...draft, current_odometer: +e.target.value || 0 })} /></div>
      </Modal>
    </>
  );
}