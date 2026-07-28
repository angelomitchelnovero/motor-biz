import { ReactNode } from 'react';

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number; }

export function Modal({ open, title, onClose, children, footer, width }: Props) {
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn" onClick={onClose}>×</button>
        </div>
        <div>{children}</div>
        {footer && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}