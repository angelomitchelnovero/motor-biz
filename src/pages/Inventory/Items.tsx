import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { can } from '../../permissions';
import { useAuth } from '../../hooks/useAuth';

const peso = (n: number) => '₱' + (Math.round(n * 100) / 100).toFixed(2);

export default function Items() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [create, setCreate] = useState<any>({ sku: '', name: '', unit: 'pc', cost: 0, price: 0 });

  useEffect(() => {
    const t = setTimeout(() => window.api.items.list(search).then(setItems), 200);
    return () => clearTimeout(t);
  }, [search]);

  async function createItem() {
    if (!create.sku || !create.name) { showToast({ kind: 'warn', text: 'SKU and name required' }); return; }
    try {
      const it = await window.api.items.create(create);
      showToast({ text: `Created ${it.sku}` });
      setShowNew(false);
      setCreate({ sku: '', name: '', unit: 'pc', cost: 0, price: 0 });
      window.api.items.list(search).then(setItems);
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  return (
    <>
      <div className="page-title">
        <h1>Items</h1>
        <div>{user && can(user.role, 'item.create') && (
          <button className="btn primary" onClick={() => setShowNew(true)}>+ New Item</button>
        )}</div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Search by name, SKU, part #, barcode…" value={search}
          onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th>SKU</th><th>Name</th><th>Category</th><th>Unit</th>
            <th className="num">Cost</th><th className="num">Price</th>
            <th className="num">Stock</th><th className="num">Value</th>
          </tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/inventory/${i.id}`)}>
                <td>{i.sku}</td>
                <td>{i.name}</td>
                <td>{i.category}</td>
                <td>{i.unit}</td>
                <td className="num">{peso(i.cost)}</td>
                <td className="num">{peso(i.price)}</td>
                <td className="num">
                  {i.stock_on_hand <= 0 ? <span className="badge danger">0</span>
                    : i.stock_on_hand <= i.reorder_point ? <span className="badge warn">{i.stock_on_hand}</span>
                    : i.stock_on_hand}
                </td>
                <td className="num">{peso(i.stock_value ?? 0)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="empty">No items</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showNew} title="New Item" onClose={() => setShowNew(false)}
        footer={<>
          <button className="btn" onClick={() => setShowNew(false)}>Cancel</button>
          <button className="btn primary" onClick={createItem}>Create</button>
        </>}
      >
        <div className="row">
          <div className="field"><label>SKU</label><input className="input" value={create.sku} onChange={(e) => setCreate({ ...create, sku: e.target.value })} /></div>
          <div className="field"><label>Barcode</label><input className="input" value={create.barcode ?? ''} onChange={(e) => setCreate({ ...create, barcode: e.target.value })} /></div>
        </div>
        <div className="field"><label>Name</label><input className="input" value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label>Category</label><input className="input" value={create.category ?? ''} onChange={(e) => setCreate({ ...create, category: e.target.value })} /></div>
          <div className="field"><label>Brand</label><input className="input" value={create.brand ?? ''} onChange={(e) => setCreate({ ...create, brand: e.target.value })} /></div>
          <div className="field"><label>Unit</label>
            <select className="select" value={create.unit} onChange={(e) => setCreate({ ...create, unit: e.target.value })}>
              <option value="pc">pc</option><option value="set">set</option>
              <option value="L">L</option><option value="ml">ml</option><option value="g">g</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Cost (₱)</label><input className="input" type="number" step="0.01" value={create.cost} onChange={(e) => setCreate({ ...create, cost: +e.target.value || 0 })} /></div>
          <div className="field"><label>Price (₱)</label><input className="input" type="number" step="0.01" value={create.price} onChange={(e) => setCreate({ ...create, price: +e.target.value || 0 })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Reorder point</label><input className="input" type="number" value={create.reorder_point ?? 0} onChange={(e) => setCreate({ ...create, reorder_point: +e.target.value || 0 })} /></div>
          <div className="field"><label>Location</label><input className="input" value={create.location ?? ''} onChange={(e) => setCreate({ ...create, location: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  );
}