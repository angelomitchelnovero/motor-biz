import { ReactNode, useState } from 'react';

interface ConfirmProps {
  trigger: ReactNode;
  title: string;
  message?: string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

export function Confirm({ trigger, title, message, danger, confirmLabel = 'Confirm', onConfirm }: ConfirmProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'inline-block' }}>{trigger}</span>
      {open && (
        <div className="modal-bg" onClick={() => !busy && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{title}</h2>
            {message && <p>{message}</p>}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              <button
                className={`btn ${danger ? 'danger' : 'primary'}`}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try { await onConfirm(); setOpen(false); } finally { setBusy(false); }
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}