import { useEffect, useState } from 'react';

export default function MechanicCommission() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    window.api.reports.mechanicCommission({ from, to: to + ' 23:59:59' }).then(setRows);
  }, [from, to]);

  const totalLabor = rows.reduce((s, r) => s + r.labor_amount, 0);
  const totalComm = rows.reduce((s, r) => s + r.commission_amount, 0);

  return (
    <>
      <div className="page-title"><h1>Mechanic Commission</h1></div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="field"><label>From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Mechanic</th><th className="num">JOs</th><th className="num">Labor</th><th className="num">Commission (10%)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mechanic_id}>
                <td>{r.mechanic_name}</td>
                <td className="num">{r.jo_count}</td>
                <td className="num">₱{r.labor_amount?.toFixed(2)}</td>
                <td className="num">₱{r.commission_amount?.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="empty">No labor recorded in this range</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr>
              <td style={{ fontWeight: 600 }}>Total</td>
              <td></td>
              <td className="num" style={{ fontWeight: 700 }}>₱{totalLabor.toFixed(2)}</td>
              <td className="num" style={{ fontWeight: 700 }}>₱{totalComm.toFixed(2)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </>
  );
}