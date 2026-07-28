import { useEffect, useState } from 'react';

export default function DailySales() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    window.api.reports.dailySales({ from: from + ' 00:00:00', to: to + ' 23:59:59' }).then(setRows);
  }, [from, to]);

  return (
    <>
      <div className="page-title"><h1>Daily Sales</h1></div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="field"><label>From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th>Date</th><th className="num">Count</th><th className="num">Gross</th>
            <th className="num">VATable</th><th className="num">VAT</th>
            <th className="num">Discount</th><th className="num">Voids</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td className="num">{r.sales_count}</td>
                <td className="num">₱{r.gross?.toFixed(2)}</td>
                <td className="num">₱{r.vatable?.toFixed(2)}</td>
                <td className="num">₱{r.vat_amount?.toFixed(2)}</td>
                <td className="num">₱{r.discount_total?.toFixed(2)}</td>
                <td className="num">{r.void_count > 0 ? <span className="badge danger">{r.void_count}</span> : 0}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="empty">No sales in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}