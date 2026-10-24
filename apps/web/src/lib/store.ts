import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  token: string | null;
  setToken: (token: string | null) => void;
}

const REF_KEY = 'kreators.ref';

/** Remember an affiliate or referral code from a ?ref= link, for the next sign-up or checkout. */
export function captureRef(search: string): void {
  try {
    const ref = new URLSearchParams(search).get('ref');
    if (ref) localStorage.setItem(REF_KEY, ref.toUpperCase().slice(0, 12));
  } catch {
    // ignore
  }
}

export function storedRef(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

export const useSession = create<SessionState>()(
  persist((set) => ({ token: null, setToken: (token) => set({ token }) }), { name: 'kreators.session' }),
);
