import { dialogOpen } from './useDialogFocus';

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
