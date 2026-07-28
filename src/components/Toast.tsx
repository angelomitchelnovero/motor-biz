import { useEffect, useState } from 'react';

export interface ToastMessage { kind?: 'info' | 'error' | 'warn'; text: string }

let setter: ((t: ToastMessage | null) => void) | null = null;
let timer: any = null;

export function showToast(msg: ToastMessage) {
  if (!setter) return;
  setter(msg);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => setter?.(null), 3500);
}

export function ToastHost() {
  const [t, setT] = useState<ToastMessage | null>(null);
  useEffect(() => { setter = setT; return () => { setter = null; }; }, []);
  if (!t) return null;
  return <div className={`toast ${t.kind ?? ''}`}>{t.text}</div>;
}