import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { can } from '../permissions';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['owner','manager','cashier','stock_clerk'];

export default function Users() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<any>({ username: '', password: '', full_name: '', role: 'cashier' });

  function load() { window.api.auth.listUsers().then(setRows); }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!draft.username || !draft.password || !draft.full_name) return showToast({ kind: 'warn', text: 'All fields required' });
    if (!ROLES.includes(draft.role)) return showToast({ kind: 'warn', text: 'invalid role' });
    try {
      await window.api.auth.createUser(draft);
      showToast({ text: 'Created' });
      setShowNew(false);
      setDraft({ username: '', password: '', full_name: '', role: 'cashier' });
      load();
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  async function toggleActive(u: any) {
    try {
      await window.api.auth.setUserActive(u.id, !u.active);
      load();
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  return (
    <>
      <div className="page-title">
        <h1>Users</h1>
        <div>{user && can(user.role, 'user.create') && <button className="btn primary" onClick={() => setShowNew(true)}>+ New User</button>}</div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Username</th><th>Full name</th><th>Role</th><th>Active</th><th>Last login</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.username}</td>
                <td>{r.full_name}</td>
                <td><span className="badge muted">{r.role}</span></td>
                <td>{r.active ? <span className="badge ok">active</span> : <span className="badge muted">inactive</span>}</td>
                <td>{r.last_login_at?.slice(0, 16) ?? '—'}</td>
                <td><button className="btn" onClick={() => toggleActive(r)}>{r.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showNew} title="New User" onClose={() => setShowNew(false)}
        footer={<><button className="btn" onClick={() => setShowNew(false)}>Cancel</button><button className="btn primary" onClick={create}>Create</button></>}
      >
        <div className="field"><label>Username</label><input className="input" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} autoFocus /></div>
        <div className="field"><label>Full name</label><input className="input" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></div>
        <div className="field"><label>Password</label><input type="password" className="input" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></div>
        <div className="field"><label>Role</label>
          <select className="select" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </Modal>
    </>
  );
}
