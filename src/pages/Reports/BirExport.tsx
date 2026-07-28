import { useEffect, useState } from 'react';
import { showToast } from '../../components/Toast';

function downloadCsv(filename: string, rows: any[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function BirExport() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [docType, setDocType] = useState<'SI' | 'OR' | 'all'>('all');
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const r = await window.api.reports.birExport({ from, to: to + ' 23:59:59', document_type: docType });
    setRows(r);
  }
  useEffect(() => { load(); }, [from, to, docType]);

  return (
    <>
      <div className="page-title">
        <h1>BIR Export</h1>
        <div>
          <button className="btn primary" onClick={() => {
            downloadCsv(`bir-${from}-to-${to}.csv`, rows);
            showToast({ text: `Exported ${rows.length} rows` });
          }}>Download CSV</button>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="field"><label>From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="field"><label>Document</label>
          <select className="select" value={docType} onChange={(e) => setDocType(e.target.value as any)}>
            <option value="all">All</option>
            <option value="OR">Official Receipt</option>
            <option value="SI">Sales Invoice</option>
          </select>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th>Date</th><th>#</th><th>Doc</th><th>TIN</th><th>Customer</th>
            <th className="num">VATable</th><th className="num">VAT-Exempt</th>
            <th className="num">Zero</th><th className="num">VAT</th><th className="num">Total</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.date?.slice(0, 16)}</td>
                <td>{r.sale_number}</td>
                <td><span className="badge muted">{r.document_type}</span></td>
                <td>{r.tin || '—'}</td>
                <td>{r.customer_name || 'walk-in'}</td>
                <td className="num">₱{r.vatable_sale?.toFixed(2)}</td>
                <td className="num">₱{r.vat_exempt?.toFixed(2)}</td>
                <td className="num">₱{r.zero_rated?.toFixed(2)}</td>
                <td className="num">₱{r.vat_amount?.toFixed(2)}</td>
                <td className="num">₱{r.total?.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="empty">No sales in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}