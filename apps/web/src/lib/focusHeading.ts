import { dialogOpen } from './useDialogFocus';
import { sayStatus } from './sayStatus';

/** Moves focus to a block's heading (made focusable for the moment, never a tab stop), when the control that had it is about to go. */
export function focusHeading(id: string | undefined, options?: FocusOptions) {
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus(options);
}

/**
 * The same for a row that left the list or a sheet that was just told to close: the keyboard's place moves to the heading without moving the
 * page. It waits until no dialog holds focus, since a modal one pulls stray focus back and a closing one hands it to a control that is about
 * to go. A big screen can take several frames to commit the close, so this looks each frame, for a second and a half at most.
 */
export function focusHeadingAfter(id: string | undefined) {
  const until = performance.now() + 1500;
  const go = () => {
    if (dialogOpen() && performance.now() < until) requestAnimationFrame(go);
    else focusHeading(id, { preventScroll: true });
  };
  requestAnimationFrame(go);
}

/**
 * Hidden tasks (2026-11-12, the founder: "let me pick each time"): the keyboard's place after a hide or an unhide on Daily, where the row
 * leaves its list. It waits for `done` (the lists read again), then goes to the Hidden tasks fold's toggle once it is drawn (it shows from
 * the first hidden task; after a hide it may still be downloading, so it is looked for each frame, two seconds at most), else to Tasks'
 * heading; after an unhide that left none hidden the fold goes, so it goes straight to the heading. A frame after focusing the fold it
 * looks again, and a fold that went in the meantime hands over to the heading too. Never moves the page. A pillar page (2026-11-13) names its
 * own fold and heading (`fold`, `heading`, their ids); Daily's are the defaults.
 */
export function focusAfterHide(done: Promise<unknown>, hidden: boolean, { fold: foldId = 'hidden-tasks', heading: headingId = 'tasks-heading' }: { fold?: string; heading?: string } = {}) {
  const heading = () => focusHeading(headingId, { preventScroll: true });
  const fold = () => document.querySelector<HTMLButtonElement>(`#${foldId} > button[aria-expanded]`);
  void done
    .catch(() => undefined)
    .then(() => {
      // Two frames after the answer, so the lists drawn from it are on the page.
      const until = performance.now() + 2000;
      let frames = 0;
      const go = () => {
        frames += 1;
        const f = frames >= 2 ? fold() : null;
        if (f) {
          f.focus({ preventScroll: true });
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!f.isConnected && (document.activeElement === document.body || document.activeElement === null)) heading();
          }));
        } else if (frames < 2 || (hidden && performance.now() < until)) requestAnimationFrame(go);
        else heading();
      };
      requestAnimationFrame(go);
    });
}

/**
 * After a second tap removes a row (review 2026-11-13): the control the keyboard was on goes with the row, so its place moves to the heading
 * of the block the row sat in and the removal is said. Read when the second tap lands (the focused control is the remove button), and
 * called once the remove is done. Inside a popup it only says it: the popup hands focus back itself.
 */
export function afterRemove(words: string): () => void {
  let id: string | undefined;
  let inDialog = false;
  for (let a = (document.activeElement as HTMLElement | null)?.parentElement ?? null; a && a !== document.body; a = a.parentElement) {
    if (a.matches('[role="dialog"]')) {
      inDialog = true;
      break;
    }
    if (a.matches('section, [aria-labelledby]')) {
      const h = a.querySelector<HTMLElement>('h2[id], h3[id]');
      const named = h?.id ?? a.getAttribute('aria-labelledby')?.split(' ')[0];
      if (named) {
        id = named;
        break;
      }
    }
  }
  return () => {
    sayStatus(words);
    if (!inDialog && id) focusHeadingAfter(id);
  };
}
