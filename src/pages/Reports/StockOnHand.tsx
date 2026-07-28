import { useEffect, useState } from 'react';

export default function StockOnHand() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { window.api.reports.stockOnHand().then(setRows); }, []);
  const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0);
  const below = rows.filter((r) => r.below_reorder);
  return (
    <>
      <div className="page-title">
        <h1>Stock on Hand</h1>
        <div style={{ color: 'var(--muted)' }}>Total value: ₱{totalValue.toFixed(2)} · {below.length} below reorder</div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th>SKU</th><th>Name</th><th>Category</th>
            <th className="num">On Hand</th><th className="num">Cost</th><th className="num">Value</th>
            <th className="num">Reorder Pt</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item_id} style={{ background: r.below_reorder ? 'var(--warn-light)' : undefined }}>
                <td>{r.sku}</td><td>{r.name}</td><td>{r.category ?? '—'}</td>
                <td className="num">{r.qty}</td>
                <td className="num">₱{r.cost?.toFixed(2)}</td>
                <td className="num">₱{r.value?.toFixed(2)}</td>
                <td className="num">{r.reorder_point}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}