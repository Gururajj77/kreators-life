import { CONSENT_VERSION, NO_CONSENT, parseConsent, type ConsentChoices } from '@kreators/shared';
import { create } from 'zustand';

/**
 * What this device knows about the person's privacy choices. A signed-in person's choices live on their account (and follow them to every
 * device); this copy is what a visitor has before signing in, and what stops the popup flashing while the account's answer loads.
 */
const KEY = 'kreators.consent';

interface Stored {
  v: number;
  decided: boolean;
  choices: ConsentChoices;
}

function read(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stored> | null;
    if (raw && typeof raw.v === 'number' && raw.v >= CONSENT_VERSION) return { v: raw.v, decided: raw.decided === true, choices: parseConsent(raw.choices) };
  } catch {
    // no storage or a broken value: ask again
  }
  return { v: CONSENT_VERSION, decided: false, choices: { ...NO_CONSENT } };
}

/** Whether the browser asked sites not to sell or share data (Global Privacy Control). */
export const globalPrivacyControl = (): boolean => typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

/** The one cookie the server reads (`kc_attr`): the person's answer about the tracked-link cookie. It is how the server knows before the page loads. */
function writeCookies(choices: ConsentChoices): void {
  try {
    const yes = choices.attribution && !globalPrivacyControl();
    document.cookie = `kc_attr=${yes ? 1 : 0}; Max-Age=31536000; Path=/; SameSite=Lax`;
    if (!yes) document.cookie = 'kl_click=; Max-Age=0; Path=/; SameSite=Lax';
  } catch {
    // cookies blocked: nothing to write
  }
}

interface ConsentState extends Stored {
  /** The footer's "Privacy choices" button asks for the popup again. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Keep an answer on this device. */
  keep: (choices: ConsentChoices) => void;
}

export const useConsent = create<ConsentState>((set) => ({
  ...read(),
  open: false,
  setOpen: (open) => set({ open }),
  keep: (choices) => {
    const next: Stored = { v: CONSENT_VERSION, decided: true, choices };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // the answer still holds for this visit
    }
    writeCookies(choices);
    set({ ...next, open: false });
  },
}));
