import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../../components/Toast';

const STATUSES = ['queued','in_progress','awaiting_parts','ready','released','cancelled'];

const STATUS_BADGE: Record<string, string> = {
  queued: 'muted', in_progress: 'warn', awaiting_parts: 'warn', ready: 'ok', released: 'muted', cancelled: 'danger',
};

export default function JoDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [jo, setJo] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await window.api.jobOrders.get(Number(id));
    setJo(r);
  }
  useEffect(() => { load(); }, [id]);

  if (!jo) return <div className="empty">Loading…</div>;

  async function setStatus(s: string) {
    setBusy(true);
    try {
      await window.api.jobOrders.updateStatus(jo.id, s);
      await load();
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
    setBusy(false);
  }

  const total = (jo.lines || []).reduce((s: number, l: any) => s + l.line_total, 0);

  return (
    <>
      <div className="page-title">
        <h1>{jo.jo_number}</h1>
        <div>
          <span className={`badge ${STATUS_BADGE[jo.status]}`}>{jo.status.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{jo.plate_number} · {jo.vehicle_label}</div>
            <div>{jo.customer_name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Odometer: {jo.current_odometer} km · Mechanic: {jo.primary_mechanic_name ?? '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Created {jo.created_at?.slice(0, 16)} by {jo.created_by_name}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {STATUSES.filter((s) => s !== jo.status && s !== 'released').map((s) => (
              <button key={s} className="btn" onClick={() => setStatus(s)} disabled={busy}>{s.replace('_', ' ')}</button>
            ))}
          </div>
        </div>
        {jo.complaint && (
          <div style={{ marginTop: 12, padding: 8, background: '#fafbfc', borderRadius: 6 }}>
            <strong>Complaint:</strong> {jo.complaint}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Lines</h3>
        <table className="table">
          <thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Mechanic</th><th>Total</th></tr></thead>
          <tbody>
            {(jo.lines || []).map((l: any) => (
              <tr key={l.id}>
                <td><span className={`badge ${l.kind === 'part' ? 'ok' : 'muted'}`}>{l.kind}</span></td>
                <td>{l.description}</td>
                <td>{l.qty}</td>
                <td className="num">₱{l.unit_price?.toFixed(2)}</td>
                <td className="num">₱{l.line_discount?.toFixed(2)}</td>
                <td>{l.mechanic_name ?? '—'}</td>
                <td className="num">₱{l.line_total?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={6} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td><td className="num" style={{ fontWeight: 700 }}>₱{total.toFixed(2)}</td></tr></tfoot>
        </table>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {jo.status === 'ready' && (
            <button className="btn primary" onClick={() => nav(`/pos?jo=${jo.id}`)}>Release &amp; Charge</button>
          )}
          <button className="btn" onClick={() => nav('/job-orders')}>Back</button>
        </div>
      </div>
    </>
  );
}