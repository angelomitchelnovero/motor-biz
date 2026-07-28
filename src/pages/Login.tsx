import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setCachedUser } from '../hooks/useAuth';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const nav = useNavigate();
  const loc = useLocation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const u = await window.api.auth.login(username, password);
      setCachedUser(u);
      if (u.must_change_password) {
        setMustChange(true);
        setOldPw(password);
      } else {
        const to = (loc.state as any)?.from ?? '/';
        nav(to, { replace: true });
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newPw1 !== newPw2) { setErr('Passwords do not match'); return; }
    if (newPw1.length < 6) { setErr('New password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await window.api.auth.changePassword(oldPw, newPw1);
      const u = await window.api.auth.currentUser();
      setCachedUser(u);
      showToast({ text: 'Password changed' });
      nav('/', { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>InvApp</h1>
        <div className="subtitle">Motor-Shop POS · Sign in</div>
        {err && <div className="error">{err}</div>}
        {!mustChange ? (
          <form onSubmit={submit}>
            <div className="field">
              <label>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>Sign in</button>
            <p style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
              First run: <span className="kbd">admin</span> / <span className="kbd">admin123</span>
            </p>
          </form>
        ) : (
          <form onSubmit={changePw}>
            <p>You must change your password before continuing.</p>
            <div className="field"><label>New password</label><input type="password" className="input" value={newPw1} onChange={(e) => setNewPw1(e.target.value)} autoFocus /></div>
            <div className="field"><label>Confirm</label><input type="password" className="input" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} /></div>
            <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>Set password</button>
          </form>
        )}
      </div>
    </div>
  );
}