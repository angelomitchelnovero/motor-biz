import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { can } from '../../permissions';
import { useAuth } from '../../hooks/useAuth';

const COLS: { key: string; label: string }[] = [
  { key: 'queued', label: 'Queued' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_parts', label: 'Awaiting Parts' },
  { key: 'ready', label: 'Ready' },
  { key: 'released', label: 'Released' },
];

const STATUS_BADGE: Record<string, string> = {
  queued: 'muted', in_progress: 'warn', awaiting_parts: 'warn', ready: 'ok', released: 'muted', cancelled: 'danger',
};

export default function JoBoard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await window.api.jobOrders.list('all');
    setRows(r);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-title">
        <h1>Job Orders</h1>
        <div>
          {user && can(user.role, 'jo.create') && (
            <button className="btn primary" onClick={() => nav('/job-orders/new')}>+ New Job Order</button>
          )}
        </div>
      </div>
      {loading ? <div className="empty">Loading…</div> : (
        <div className="kanban">
          {COLS.map((col) => {
            const colRows = rows.filter((r) => r.status === col.key);
            return (
              <div key={col.key} className="kanban-col">
                <h3>{col.label} ({colRows.length})</h3>
                {colRows.map((r) => (
                  <div key={r.id} className="kanban-card" onClick={() => nav(`/job-orders/${r.id}`)}>
                    <div className="plate">{r.plate_number}</div>
                    <div>{r.customer_name}</div>
                    <div className="meta">{r.vehicle_label} · {r.primary_mechanic_name ?? 'no mechanic'}</div>
                    <div className="meta">JO {r.jo_number}</div>
                  </div>
                ))}
                {colRows.length === 0 && <div className="meta" style={{ padding: 8, color: 'var(--muted)' }}>—</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>All open + recent</h2>
        <table className="table">
          <thead><tr>
            <th>JO #</th><th>Plate</th><th>Customer</th><th>Vehicle</th>
            <th>Mechanic</th><th>Status</th><th>Created</th>
          </tr></thead>
          <tbody>
            {rows.slice(0, 30).map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/job-orders/${r.id}`)}>
                <td>{r.jo_number}</td>
                <td>{r.plate_number}</td>
                <td>{r.customer_name}</td>
                <td>{r.vehicle_label}</td>
                <td>{r.primary_mechanic_name ?? '—'}</td>
                <td><span className={`badge ${STATUS_BADGE[r.status] ?? 'muted'}`}>{r.status.replace('_', ' ')}</span></td>
                <td>{(r.created_at ?? '').slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}