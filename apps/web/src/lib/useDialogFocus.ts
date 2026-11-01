import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/** The controls inside a box that the Tab key can reach, in order, skipping anything hidden. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
}

/** Dialogs open right now, the last one on top: Escape and the Tab trap belong to the top one only. */
const open: symbol[] = [];

interface Options {
  /** A modal dialog keeps focus inside until it closes. A panel the page stays usable beside (the assistant, the reminders bubble) only wraps Tab at its ends. */
  modal?: boolean;
  /** Move focus in when it opens. Off for a panel that was already open when the page loaded, so it never steals focus on a new page. */
  focusIn?: boolean;
  onEscape?: () => void;
}

/**
 * The keyboard half of a dialog, one rule for every one of them:
 * focus moves into it when it opens (the control marked data-autofocus, else the first control, else the box itself),
 * Tab and Shift+Tab wrap at its ends (and a modal one pulls stray focus back in), Escape closes the top one only,
 * and when it closes focus returns to the control that opened it.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, { modal = true, focusIn = true, onEscape }: Options = {}) {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const me = Symbol('dialog');
    open.push(me);
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    if (focusIn && !root.contains(document.activeElement)) {
      const target = root.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)') ?? focusablesIn(root)[0] ?? root;
      if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    const top = () => open[open.length - 1] === me;
    const onKey = (e: KeyboardEvent) => {
      if (!top() || e.defaultPrevented || e.isComposing) return;
      if (e.key === 'Escape') {
        if (escape.current) {
          e.preventDefault();
          escape.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusablesIn(root);
      const here = document.activeElement;
      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (!root.contains(here)) {
        if (modal) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (e.shiftKey && (here === first || here === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && here === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!modal || !top() || !(e.target instanceof Node) || root.contains(e.target)) return;
      (focusablesIn(root)[0] ?? root).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      const i = open.indexOf(me);
      if (i >= 0) open.splice(i, 1);
      // Back to the control that opened it, unless focus has already been put somewhere on purpose.
      const now = document.activeElement;
      if (opener && opener.isConnected && (!now || now === document.body || root.contains(now))) opener.focus({ preventScroll: true });
    };
  }, [active, ref, modal, focusIn]);
}
