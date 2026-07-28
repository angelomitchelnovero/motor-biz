import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';

export default function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({});
  const [showNew, setShowNew] = useState(false);
  const [serDraft, setSerDraft] = useState<any>({ document_type: 'OR', branch: 'MAIN', terminal: '01', prefix: 'OR', start_no: 1, end_no: 999999999 });

  useEffect(() => {
    window.api.settings.get().then((x: any) => { setS(x); setDraft(x); });
    window.api.settings.listSeries().then(setSeries);
  }, []);

  async function save() {
    try {
      const next = await window.api.settings.update(draft);
      setS(next); setDraft(next);
      showToast({ text: 'Saved' });
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  async function createSer() {
    try {
      await window.api.settings.createSeries(serDraft);
      showToast({ text: 'Series created' });
      setShowNew(false);
      window.api.settings.listSeries().then(setSeries);
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  if (!s) return <div className="empty">Loading…</div>;

  return (
    <>
      <div className="page-title"><h1>Settings</h1></div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Business & BIR</h3>
        <div className="row">
          <div className="field"><label>Business name</label><input className="input" value={draft.business_name ?? ''} onChange={(e) => setDraft({ ...draft, business_name: e.target.value })} /></div>
          <div className="field"><label>TIN</label><input className="input" value={draft.tin ?? ''} onChange={(e) => setDraft({ ...draft, tin: e.target.value })} /></div>
          <div className="field"><label>VAT Reg. TIN</label><input className="input" value={draft.vat_reg_tin ?? ''} onChange={(e) => setDraft({ ...draft, vat_reg_tin: e.target.value })} /></div>
        </div>
        <div className="field"><label>Address line 1</label><input className="input" value={draft.address1 ?? ''} onChange={(e) => setDraft({ ...draft, address1: e.target.value })} /></div>
        <div className="field"><label>Address line 2</label><input className="input" value={draft.address2 ?? ''} onChange={(e) => setDraft({ ...draft, address2: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label>BIR-ATP SN</label><input className="input" value={draft.bir_atp_sn ?? ''} onChange={(e) => setDraft({ ...draft, bir_atp_sn: e.target.value })} /></div>
          <div className="field"><label>BIR-ATP Min</label><input className="input" value={draft.bir_atp_min ?? ''} onChange={(e) => setDraft({ ...draft, bir_atp_min: e.target.value })} /></div>
          <div className="field"><label>BIR-ATP Date</label><input className="input" type="date" value={draft.bir_atp_date ?? ''} onChange={(e) => setDraft({ ...draft, bir_atp_date: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Discounts</h3>
        <div className="row">
          <div className="field"><label>Senior Citizen %</label><input className="input" type="number" min="0" max="100" value={draft.sc_discount_pct ?? 20} onChange={(e) => setDraft({ ...draft, sc_discount_pct: +e.target.value || 0 })} /></div>
          <div className="field"><label>PWD %</label><input className="input" type="number" min="0" max="100" value={draft.pwd_discount_pct ?? 5} onChange={(e) => setDraft({ ...draft, pwd_discount_pct: +e.target.value || 0 })} /></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Branch / Terminal</h3>
        <div className="row">
          <div className="field"><label>Default branch</label><input className="input" value={draft.default_branch ?? 'MAIN'} onChange={(e) => setDraft({ ...draft, default_branch: e.target.value })} /></div>
          <div className="field"><label>Default terminal</label><input className="input" value={draft.default_terminal ?? '01'} onChange={(e) => setDraft({ ...draft, default_terminal: e.target.value })} /></div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={save}>Save settings</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Receipt series</h3>
          <button className="btn primary" onClick={() => setShowNew(true)}>+ New Series</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>BIR requires consecutive, gap-free numbering. Set up one SI and one OR series per branch + terminal.</p>
        <table className="table">
          <thead><tr><th>Type</th><th>Branch</th><th>Terminal</th><th>Prefix</th><th className="num">Start</th><th className="num">End</th><th className="num">Next</th><th>Active</th></tr></thead>
          <tbody>
            {series.map((r) => {
              const remaining = r.end_no - r.current_no;
              return (
                <tr key={r.id}>
                  <td>{r.document_type}</td>
                  <td>{r.branch}</td>
                  <td>{r.terminal}</td>
                  <td>{r.prefix}</td>
                  <td className="num">{r.start_no}</td>
                  <td className="num">{r.end_no}</td>
                  <td className="num">{r.current_no + 1} <span style={{ color: remaining < 100 ? 'var(--danger)' : 'var(--muted)', fontSize: 11 }}>({remaining} left)</span></td>
                  <td>{r.active ? <span className="badge ok">active</span> : <span className="badge muted">inactive</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showNew} title="New receipt series" onClose={() => setShowNew(false)}
        footer={<><button className="btn" onClick={() => setShowNew(false)}>Cancel</button><button className="btn primary" onClick={createSer}>Create</button></>}
      >
        <div className="row">
          <div className="field"><label>Document type</label>
            <select className="select" value={serDraft.document_type} onChange={(e) => setSerDraft({ ...serDraft, document_type: e.target.value })}>
              <option value="OR">OR</option><option value="SI">SI</option>
            </select>
          </div>
          <div className="field"><label>Branch</label><input className="input" value={serDraft.branch} onChange={(e) => setSerDraft({ ...serDraft, branch: e.target.value })} /></div>
          <div className="field"><label>Terminal</label><input className="input" value={serDraft.terminal} onChange={(e) => setSerDraft({ ...serDraft, terminal: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Prefix</label><input className="input" value={serDraft.prefix} onChange={(e) => setSerDraft({ ...serDraft, prefix: e.target.value })} /></div>
          <div className="field"><label>Start #</label><input className="input" type="number" value={serDraft.start_no} onChange={(e) => setSerDraft({ ...serDraft, start_no: +e.target.value || 1 })} /></div>
          <div className="field"><label>End #</label><input className="input" type="number" value={serDraft.end_no} onChange={(e) => setSerDraft({ ...serDraft, end_no: +e.target.value || 1 })} /></div>
        </div>
      </Modal>
    </>
  );
}