import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

/**
 * State that outlives a screen. The chats (the strategy session and the assistant) keep their lines, the
 * open card, the step they are on and the answers in a slot here instead of in the component, so moving to
 * another screen and back picks up where you were. The setters are the same function on every mount, so a
 * card or a chip made before you left still writes to the chat you come back to, and a line still being
 * typed lands while you are away. It lives for the tab: a reload starts the chat from what the server holds.
 * Sign out clears it all.
 */

interface Slot {
  value: unknown;
  init: () => unknown;
  listeners: Set<() => void>;
  subscribe: (cb: () => void) => () => void;
  get: () => unknown;
  set: Dispatch<SetStateAction<unknown>>;
}

const slots = new Map<string, Slot>();
const refs = new Map<string, { current: unknown }>();
const keyOf = (scope: string, name: string) => `${scope}|${name}`;

function slotFor(key: string, init: () => unknown): Slot {
  const found = slots.get(key);
  if (found) return found;
  const s: Slot = {
    value: init(),
    init,
    listeners: new Set(),
    subscribe: (cb) => {
      s.listeners.add(cb);
      return () => s.listeners.delete(cb);
    },
    get: () => s.value,
    set: (next) => {
      const value = typeof next === 'function' ? (next as (v: unknown) => unknown)(s.value) : next;
      if (Object.is(value, s.value)) return;
      s.value = value;
      for (const l of [...s.listeners]) l();
    },
  };
  slots.set(key, s);
  return s;
}

/** Like useState, but kept under `scope` for the life of the tab. */
export function useKept<T>(scope: string, name: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const s = slotFor(keyOf(scope, name), () => (typeof initial === 'function' ? (initial as () => T)() : initial));
  const value = useSyncExternalStore(s.subscribe, s.get, s.get);
  return [value as T, s.set as Dispatch<SetStateAction<T>>];
}

/** Like useRef, but kept under `scope` for the life of the tab. */
export function useKeptRef<T>(scope: string, name: string, initial: T): { current: T } {
  const key = keyOf(scope, name);
  let r = refs.get(key);
  if (!r) {
    r = { current: initial };
    refs.set(key, r);
  }
  return r as { current: T };
}

/** Starts a scope over: every value back to where it began, every ref dropped. Without a scope, everything. */
export function forgetKept(scope?: string): void {
  const hit = (key: string) => scope === undefined || key.startsWith(`${scope}|`);
  for (const [key, r] of refs) {
    if (!hit(key)) continue;
    // Pending lines of a chat are timers; stop them so a forgotten chat never types again.
    if (key.endsWith('|timers') && Array.isArray(r.current)) for (const t of r.current as number[]) window.clearTimeout(t);
    refs.delete(key);
  }
  for (const [key, s] of slots) if (hit(key)) s.set(s.init());
}
