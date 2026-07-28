import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { can } from '../permissions';
import { useAuth } from '../hooks/useAuth';

export default function Suppliers() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<any>({ name: '', terms: 'cash' });

  useEffect(() => { window.api.suppliers.list().then(setRows); }, []);

  async function create() {
    if (!draft.name) return showToast({ kind: 'warn', text: 'name required' });
    try {
      await window.api.suppliers.create(draft);
      showToast({ text: 'Created' });
      setShowNew(false);
      setDraft({ name: '', terms: 'cash' });
      window.api.suppliers.list().then(setRows);
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  return (
    <>
      <div className="page-title">
        <h1>Suppliers</h1>
        <div>{user && can(user.role, 'supplier.create') && <button className="btn primary" onClick={() => setShowNew(true)}>+ New Supplier</button>}</div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Name</th><th>TIN</th><th>Contact</th><th>Terms</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.tin ?? '—'}</td><td>{s.contact ?? '—'}</td>
                <td><span className="badge muted">{s.terms}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="empty">No suppliers</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={showNew} title="New Supplier" onClose={() => setShowNew(false)}
        footer={<><button className="btn" onClick={() => setShowNew(false)}>Cancel</button><button className="btn primary" onClick={create}>Create</button></>}
      >
        <div className="field"><label>Name</label><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></div>
        <div className="field"><label>TIN</label><input className="input" value={draft.tin ?? ''} onChange={(e) => setDraft({ ...draft, tin: e.target.value })} /></div>
        <div className="field"><label>Contact</label><input className="input" value={draft.contact ?? ''} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} /></div>
        <div className="field"><label>Address</label><input className="input" value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
        <div className="field"><label>Terms</label>
          <select className="select" value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })}>
            <option value="cash">Cash</option><option value="net30">Net 30</option><option value="net60">Net 60</option>
          </select>
        </div>
      </Modal>
    </>
  );
}