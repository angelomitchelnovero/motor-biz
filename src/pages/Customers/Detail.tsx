import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    window.api.customers.get(Number(id)).then(setC);
    // vehicles for this customer
    window.api.vehicles.list().then((vs: any[]) => setVehicles(vs.filter((v: any) => v.customer_id === Number(id))));
  }, [id]);

  if (!c) return <div className="empty">Loading…</div>;
  return (
    <>
      <div className="page-title"><h1>{c.name}</h1>
        <button className="btn" onClick={() => nav('/customers')}>Back</button>
      </div>
      <div className="card">
        <table className="table" style={{ width: 'auto' }}>
          <tbody>
            <tr><td style={{ width: 140, color: 'var(--muted)' }}>Code</td><td>{c.code}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Contact</td><td>{c.contact ?? '—'}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Address</td><td>{c.address ?? '—'}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>TIN</td><td>{c.tin ?? '—'}</td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Type</td><td><span className="badge muted">{c.type}</span></td></tr>
            <tr><td style={{ color: 'var(--muted)' }}>Credit limit</td><td>₱{c.credit_limit?.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <h3 style={{ padding: 16, margin: 0 }}>Vehicles</h3>
        <table className="table">
          <thead><tr><th>Plate</th><th>Make / Model</th><th>Color</th><th>Engine #</th><th>Chassis #</th><th className="num">Odometer</th></tr></thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => nav('/vehicles')}>
                <td>{v.plate_number}</td><td>{v.make} {v.model}</td><td>{v.color ?? '—'}</td>
                <td>{v.engine_no ?? '—'}</td><td>{v.chassis_no ?? '—'}</td>
                <td className="num">{v.current_odometer} km</td>
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={6} className="empty">No vehicles</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}