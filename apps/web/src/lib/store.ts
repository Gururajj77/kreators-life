import { forgetKept } from './kept';
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
  persist(
    (set) => ({
      token: null,
      setToken: (token) => {
        // Signing out, or a session the server no longer knows, forgets every kept chat.
        if (!token) forgetKept();
        set({ token });
      },
    }),
    { name: 'kreators.session' },
  ),
);

/**
 * Which model the assistant runs on, picked in its panel while models are being tried out. Kept in this browser
 * only; null means the server's default. The server takes only a model from its own list.
 */
export const useAssistantModel = create<{ model: string | null; setModel: (model: string | null) => void }>()(
  persist(
    (set) => ({
      model: null,
      setModel: (model) => set({ model }),
    }),
    { name: 'kreators.assistant-model' },
  ),
);

