import { useEffect, useState } from 'react';
import { showToast } from '../components/Toast';
import type { Settings } from '../preload-types';

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>({ business_name: '', address1: '', address2: '' });

  useEffect(() => {
    window.api.settings.get().then((x: Settings) => { setS(x); setDraft(x); });
  }, []);

  async function save() {
    try {
      const next = await window.api.settings.update(draft);
      setS(next); setDraft(next);
      showToast({ text: 'Saved' });
    } catch (e: any) { showToast({ kind: 'error', text: e?.message }); }
  }

  if (!s) return <div className="empty">Loading…</div>;

  return (
    <>
      <div className="page-title"><h1>Settings</h1></div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Business</h3>
        <div className="field">
          <label>Business name</label>
          <input className="input" value={draft.business_name ?? ''}
            onChange={(e) => setDraft({ ...draft, business_name: e.target.value })} />
        </div>
        <div className="field">
          <label>Address line 1</label>
          <input className="input" value={draft.address1 ?? ''}
            onChange={(e) => setDraft({ ...draft, address1: e.target.value })} />
        </div>
        <div className="field">
          <label>Address line 2</label>
          <input className="input" value={draft.address2 ?? ''}
            onChange={(e) => setDraft({ ...draft, address2: e.target.value })} />
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={save}>Save settings</button>
      </div>
    </>
  );
}