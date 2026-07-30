import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailySalesRow, StockOnHandRow } from '../preload-types';

export default function Dashboard() {
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [lowStock, setLowStock] = useState<StockOnHandRow[]>([]);
  const [todaySales, setTodaySales] = useState<DailySalesRow[]>([]);

  useEffect(() => {
    window.api.stock.stockOnHand().then((rows: StockOnHandRow[]) => {
      setLowStock(rows.filter((r) => r.below_reorder).slice(0, 10));
    });
    window.api.reports.dailySales({ from: today, to: today + ' 23:59:59' }).then((rows: DailySalesRow[]) => {
      setTodaySales(rows);
    });
  }, []);

  const gross = todaySales.reduce((s, r) => s + (r.gross || 0), 0);
  const count = todaySales.reduce((s, r) => s + (r.sales_count || 0), 0);
  const voids = todaySales.reduce((s, r) => s + (r.void_count || 0), 0);

  return (
    <>
      <div className="page-title"><h1>Dashboard</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card title="Today's Sales" value={`₱${gross.toFixed(2)}`} sub={`${count} transactions`} />
        <Card title="Low Stock" value={lowStock.length.toString()} sub="items at/below reorder point" danger={lowStock.length > 0} />
        <Card title="Voids Today" value={voids.toString()} sub={voids > 0 ? 'review in Daily Sales' : 'none'} />
        <Card title="Date" value={today} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Quick actions</h2>
        <div className="row">
          <button className="btn primary" onClick={() => nav('/pos')}>Open POS</button>
          <button className="btn" onClick={() => nav('/inventory/receive')}>Receive Stock</button>
          <button className="btn" onClick={() => nav('/inventory')}>View Inventory</button>
          <button className="btn" onClick={() => nav('/reports/daily-sales')}>Daily Sales</button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card">
          <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Low stock</h2>
          <table className="table">
            <thead><tr><th>SKU</th><th>Item</th><th className="num">On Hand</th><th className="num">Reorder Point</th></tr></thead>
            <tbody>
              {lowStock.map((r) => (
                <tr key={r.item_id}>
                  <td>{r.sku}</td>
                  <td>{r.name}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{r.reorder_point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Card({ title, value, sub, danger }: { title: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${danger ? 'var(--danger)' : 'var(--accent)'}` }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}