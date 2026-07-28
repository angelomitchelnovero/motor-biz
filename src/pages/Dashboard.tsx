import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface StockAlert { item_id: number; sku: string; name: string; qty: number; reorder_point: number; }
interface DailyRow { date: string; sales_count: number; gross: number; void_count: number; }

export default function Dashboard() {
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [lowStock, setLowStock] = useState<StockAlert[]>([]);
  const [todaySales, setTodaySales] = useState<DailyRow[]>([]);
  const [openJos, setOpenJos] = useState<number>(0);

  useEffect(() => {
    window.api.stock.stockOnHand().then((rows: any[]) => {
      setLowStock(rows.filter((r) => r.below_reorder).slice(0, 10));
    });
    window.api.reports.dailySales({ from: today, to: today + ' 23:59:59' }).then((rows: any[]) => {
      setTodaySales(rows);
    });
    window.api.jobOrders.list('all').then((rows: any[]) => {
      setOpenJos(rows.filter((r) => !['released','cancelled'].includes(r.status)).length);
    });
  }, []);

  const gross = todaySales.reduce((s, r) => s + (r.gross || 0), 0);
  const count = todaySales.reduce((s, r) => s + (r.sales_count || 0), 0);

  return (
    <>
      <div className="page-title"><h1>Dashboard</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card title="Today's Sales" value={`₱${gross.toFixed(2)}`} sub={`${count} transactions`} />
        <Card title="Open Job Orders" value={openJos.toString()} sub="queued / in-progress / awaiting / ready" />
        <Card title="Low Stock" value={lowStock.length.toString()} sub="items at/below reorder point" danger={lowStock.length > 0} />
        <Card title="Date" value={today} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Quick actions</h2>
        <div className="row">
          <button className="btn primary" onClick={() => nav('/pos')}>Open POS</button>
          <button className="btn" onClick={() => nav('/job-orders/new')}>New Job Order</button>
          <button className="btn" onClick={() => nav('/inventory/receive')}>Receive Stock</button>
          <button className="btn" onClick={() => nav('/vehicles')}>Plate Lookup</button>
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