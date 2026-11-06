import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

/**
 * Home only: Emergence's `useHidden` keeps Not now in its own state, so when the last ready card is set aside the block draws
 * nothing and `EmergenceSlot` would not hear of it. A hidden sentinel beside the block (no wrapper, so the grid's `> .span-all` still
 * holds) watches the screen's direct children; once the block's section has been seen and then goes, it re-renders the slot,
 * which reads the set-aside ids again and shows the light section with See all. Its own small chunk (2026-11-06), downloaded only
 * beside the block, so Home's first download stays inside its budget.
 */
export function EmptyWatch({ id, onEmpty }: { id: string; /** The slot's own state setter, steady across renders. */ onEmpty: Dispatch<SetStateAction<number>> }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || typeof MutationObserver === 'undefined') return;
    const here = () => Boolean(parent.querySelector(`:scope > section[aria-labelledby="${id}"]`));
    let seen = here();
    const watch = new MutationObserver(() => {
      if (here()) seen = true;
      else if (seen) {
        seen = false;
        onEmpty((n) => n + 1);
      }
    });
    watch.observe(parent, { childList: true });
    return () => watch.disconnect();
  }, [id, onEmpty]);
  return <span ref={ref} hidden aria-hidden="true" />;
}
