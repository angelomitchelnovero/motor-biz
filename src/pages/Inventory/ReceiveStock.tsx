import { useEffect, useState } from 'react';
import { showToast } from '../../components/Toast';

interface Line { item_id: number; sku: string; name: string; qty: number; unit_cost: number; }

export default function ReceiveStock() {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!search) { setMatches([]); return; }
    const t = setTimeout(() => window.api.items.list(search).then(setMatches), 200);
    return () => clearTimeout(t);
  }, [search]);

  function addLine(item: any) {
    if (lines.find((l) => l.item_id === item.id)) return;
    setLines((l) => [...l, { item_id: item.id, sku: item.sku, name: item.name, qty: 0, unit_cost: item.cost }]);
    setSearch('');
    setMatches([]);
  }
  function updateLine(item_id: number, patch: Partial<Line>) {
    setLines((l) => l.map((x) => x.item_id === item_id ? { ...x, ...patch } : x));
  }
  function removeLine(item_id: number) { setLines((l) => l.filter((x) => x.item_id !== item_id)); }

  async function submit() {
    const ok = lines.filter((l) => l.qty > 0);
    if (ok.length === 0) { showToast({ kind: 'warn', text: 'Add qty > 0 on at least one line' }); return; }
    for (const l of ok) {
      try {
        await window.api.stock.receive({ item_id: l.item_id, qty: l.qty, unit_cost: l.unit_cost });
      } catch (e: any) { showToast({ kind: 'error', text: `${l.sku}: ${e.message}` }); return; }
    }
    showToast({ text: `Received ${ok.length} line(s)` });
    setLines([]);
  }

  return (
    <>
      <div className="page-title"><h1>Receive Stock</h1></div>
      <div className="card">
        <input className="input" placeholder="Search SKU or name…" value={search}
          onChange={(e) => setSearch(e.target.value)} autoFocus />
        {matches.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {matches.slice(0, 10).map((m) => (
              <button key={m.id} className="btn" onClick={() => addLine(m)}>+ {m.name}</button>
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Unit cost</th><th className="num">Line total</th><th></th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.item_id}>
                  <td>{l.sku}</td>
                  <td>{l.name}</td>
                  <td><input className="input" type="number" min="0" step="0.01" value={l.qty} onChange={(e) => updateLine(l.item_id, { qty: +e.target.value || 0 })} style={{ width: 80 }} /></td>
                  <td><input className="input" type="number" min="0" step="0.01" value={l.unit_cost} onChange={(e) => updateLine(l.item_id, { unit_cost: +e.target.value || 0 })} style={{ width: 100 }} /></td>
                  <td className="num">₱{(l.qty * l.unit_cost).toFixed(2)}</td>
                  <td><button className="btn" onClick={() => removeLine(l.item_id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={submit}>Receive All</button>
          </div>
        </div>
      )}
    </>
  );
}