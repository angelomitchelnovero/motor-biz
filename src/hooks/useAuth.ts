import { useEffect, useState } from 'react';
import type { SessionUser } from '../preload-types';

let cached: SessionUser | null | undefined;
const listeners = new Set<() => void>();

export function setCachedUser(u: SessionUser | null) {
  cached = u;
  listeners.forEach((l) => l());
}

export async function fetchUser(): Promise<SessionUser | null> {
  const u = await window.api.auth.currentUser();
  cached = u ?? null;
  return cached;
}

export function useAuth(): { user: SessionUser | null; loading: boolean } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    if (cached === undefined) {
      fetchUser().then(() => l());
    }
    return () => { listeners.delete(l); };
  }, []);
  return { user: cached ?? null, loading: cached === undefined };
}