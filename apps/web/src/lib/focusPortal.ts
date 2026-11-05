// Where FocusRounds' panel actually draws, so the one living instance in FocusRoundsHost (mounted once, for good, by Shell) can portal its
// JSX into a page's own layout while that page is the screen showing, and draw nothing at all everywhere else. Mindful and Home (2026-11-06,
// the founder: Breathe and focus on Home, above the daily brief) each register a slot on mount and clear it on unmount; `page` says which,
// since only Mindful takes the laptop's shortcut keys. Nothing else reads or writes this.
import { create } from 'zustand';

export type FocusPage = 'mindful' | 'home';

interface FocusPortalState {
  target: HTMLDivElement | null;
  page: FocusPage | null;
  /** The panel's last measured height, which a slot keeps as its least height until the panel is inside it, so Back's restored scroll
   *  position is not pushed down when the panel arrives a moment after the page. */
  height: number;
  setTarget: (el: HTMLDivElement | null, page: FocusPage) => void;
  setHeight: (h: number) => void;
}

export const useFocusPortal = create<FocusPortalState>((set, get) => ({
  target: null,
  page: null,
  height: 0,
  setHeight: (h) => {
    if (h > 0 && Math.abs(h - get().height) > 1) set({ height: h });
  },
  // A page clearing its slot clears only its own (the next page may already have set one).
  setTarget: (el, page) => {
    if (el) set({ target: el, page });
    else if (get().page === page) set({ target: null, page: null });
  },
}));
