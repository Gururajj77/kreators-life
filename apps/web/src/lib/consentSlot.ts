import { useSyncExternalStore } from 'react';

// The public site's place for the privacy card on a phone (SiteLayout sets it under its header), so there the card takes its own room
// in the page instead of covering the hero's pitch and Start free (the founder, 2026-11-05: "make space for the privacy card").
let slot: HTMLElement | null = null;
const subs = new Set<() => void>();

export const setConsentSlot = (el: HTMLElement | null): void => {
  if (slot === el) return;
  slot = el;
  for (const f of subs) f();
};

export const useConsentSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => slot,
    () => null,
  );
