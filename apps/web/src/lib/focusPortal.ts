// Where FocusRounds' panel actually draws, so the one living instance in FocusRoundsHost (mounted once, for good, by Shell) can portal its
// JSX into Mindful's own layout while Mindful is the screen showing, and draw nothing at all everywhere else. Mindful registers its slot
// on mount and clears it on unmount; nothing else reads or writes this.
import { create } from 'zustand';

interface FocusPortalState {
  target: HTMLDivElement | null;
  setTarget: (el: HTMLDivElement | null) => void;
}

export const useFocusPortal = create<FocusPortalState>((set) => ({
  target: null,
  setTarget: (el) => set({ target: el }),
}));
