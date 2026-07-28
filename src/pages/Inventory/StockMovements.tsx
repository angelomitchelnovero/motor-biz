import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function StockMovements() {
  const { id } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { window.api.stock.listMovements(Number(id), 200).then(setRows); }, [id]);
  return (
    <>
      <div className="page-title"><h1>Stock Movements</h1></div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th>When</th><th>Type</th><th className="num">Qty</th><th>Unit cost</th><th>Reason</th><th>By</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at?.slice(0, 19)}</td>
                <td><span className="badge muted">{r.type}</span></td>
                <td className="num">{r.qty}</td>
                <td className="num">₱{(r.unit_cost ?? 0).toFixed(2)}</td>
                <td>{r.reason ?? '—'}</td>
                <td>{r.user_name ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="empty">No movements</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}