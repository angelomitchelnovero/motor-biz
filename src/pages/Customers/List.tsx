import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { can } from '../../permissions';
import { useAuth } from '../../hooks/useAuth';

export default function Customers() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<any>({ name: '', contact: '', type: 'retail' });

  useEffect(() => {
    const t = setTimeout(() => window.api.customers.list(search).then(setRows), 200);
    return () => clearTimeout(t);
  }, [search]);

  async function create() {
    if (!draft.name) { showToast({ kind: 'warn', text: 'Name is required' }); return; }
    try {
      const c = await window.api.customers.create(draft);
      showToast({ text: `Created ${c.name}` });
      setShowNew(false);
      setDraft({ name: '', contact: '', type: 'retail' });
      window.api.customers.list(search).then(setRows);
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  return (
    <>
      <div className="page-title">
        <h1>Customers</h1>
        <div>{user && can(user.role, 'customer.create') && (
          <button className="btn primary" onClick={() => setShowNew(true)}>+ New Customer</button>
        )}</div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>TIN</th><th>Type</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/customers/${c.id}`)}>
                <td>{c.code}</td><td>{c.name}</td><td>{c.contact ?? '—'}</td>
                <td>{c.tin ?? '—'}</td><td><span className="badge muted">{c.type}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No customers</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showNew} title="New Customer" onClose={() => setShowNew(false)}
        footer={<><button className="btn" onClick={() => setShowNew(false)}>Cancel</button><button className="btn primary" onClick={create}>Create</button></>}
      >
        <div className="field"><label>Name</label><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></div>
        <div className="field"><label>Contact</label><input className="input" value={draft.contact ?? ''} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} /></div>
        <div className="field"><label>Address</label><input className="input" value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
        <div className="field"><label>TIN</label><input className="input" value={draft.tin ?? ''} onChange={(e) => setDraft({ ...draft, tin: e.target.value })} /></div>
        <div className="field"><label>Type</label>
          <select className="select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <option value="retail">Retail</option><option value="fleet">Fleet</option>
          </select>
        </div>
        <div className="field"><label>Credit limit (₱)</label><input className="input" type="number" step="0.01" value={draft.credit_limit ?? 0} onChange={(e) => setDraft({ ...draft, credit_limit: +e.target.value || 0 })} /></div>
      </Modal>
    </>
  );
}