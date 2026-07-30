import { useEffect, useState } from 'react';
import type { DailySalesRow, PaymentBreakdown } from '../../preload-types';

export default function DailySales() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<DailySalesRow[]>([]);

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
            <th>Date</th>
            <th className="num">Count</th>
            <th className="num">Gross</th>
            <th>Payment breakdown</th>
            <th className="num">Voids</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td className="num">{r.sales_count}</td>
                <td className="num">₱{(r.gross ?? 0).toFixed(2)}</td>
                <td><PaymentCell breakdown={r.payment_breakdown} /></td>
                <td className="num">{r.void_count > 0 ? <span className="badge danger">{r.void_count}</span> : 0}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No sales in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PaymentCell({ breakdown }: { breakdown: PaymentBreakdown }) {
  const parts: string[] = [];
  if (breakdown.cash) parts.push(`Cash ₱${breakdown.cash.toFixed(2)}`);
  if (breakdown.gcash) parts.push(`GCash ₱${breakdown.gcash.toFixed(2)}`);
  if (breakdown.card) parts.push(`Card ₱${breakdown.card.toFixed(2)}`);
  if (breakdown.other) parts.push(`Other ₱${breakdown.other.toFixed(2)}`);
  return <span style={{ fontSize: 12 }}>{parts.length ? parts.join(' · ') : '—'}</span>;
}