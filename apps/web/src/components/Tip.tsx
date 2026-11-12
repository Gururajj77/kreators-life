import { TERMS } from '@kreators/shared';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** How long the card waits after the pointer leaves the word, so it can be reached and read (WCAG 1.4.13). */
const GRACE = 120;

/**
 * A word with a short explanation that opens on hover, keyboard focus or tap and closes on Escape or a tap elsewhere. Every tip in
 * the app wears the same pale purple card with ink text, so it reads as help and never as a button or a warning; in dark mode the tint
 * turns deep purple by itself. The card is drawn at the top of the page and placed by the smart tips' rule (lib/tipGeometry.ts,
 * 2026-11-12): in the empty room nearest the word, never over words, a control or a picture, inside the window, so a cover's clip
 * never cuts it. It stays open while the pointer is on it.
 */
export function Tip({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const stay = () => window.clearTimeout(timer.current);
  const leave = () => {
    stay();
    timer.current = window.setTimeout(() => setOpen(false), GRACE);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => t instanceof Node && (Boolean((t as Element).closest?.(`[data-term-tip="${CSS.escape(id)}"]`)) || Boolean(card.current?.contains(t)));
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !inside(e.target)) setOpen(false);
    };
    // A scroll or a new window size would leave the card behind its word: it closes.
    const gone = (e: Event) => {
      if (!inside(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', gone, { capture: true, passive: true });
    window.addEventListener('resize', gone, { passive: true });
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', gone, true);
      window.removeEventListener('resize', gone);
    };
  }, [open, id]);
  // Placed before it is painted; the rule is fetched with the card's first opening, so until it lands the card waits hidden.
  useLayoutEffect(() => {
    const b = button.current;
    const c = card.current;
    if (!open || !b || !c) return;
    let gone = false;
    c.style.visibility = 'hidden';
    void import('../lib/tipGeometry').then((m) => {
      if (gone || !button.current || !card.current) return;
      m.placeTip(button.current, card.current, [
        ['top', 'start'],
        ['bottom', 'start'],
      ]);
      card.current.style.visibility = '';
    });
    return () => {
      gone = true;
    };
  }, [open]);
  return (
    <span data-term-tip={id} className={`relative inline-block ${className}`} onPointerEnter={(e) => e.pointerType !== 'touch' && (stay(), setOpen(true))} onPointerLeave={(e) => e.pointerType !== 'touch' && leave()}>
      <button
        ref={button}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setOpen(true)}
        onBlur={() => setOpen(false)}
        className="cursor-help rounded-tile border-0 bg-transparent p-0 font-[inherit] text-inherit underline decoration-dotted decoration-2 underline-offset-4"
      >
        {children}
      </button>
      {open &&
        createPortal(
          <span
            ref={card}
            id={id}
            role="tooltip"
            onPointerEnter={stay}
            onPointerLeave={(e) => e.pointerType !== 'touch' && leave()}
            className="tip-card smart-tip-card block w-[min(280px,80vw)] rounded-tile border border-line p-sm text-left text-subhead normal-case shadow-toy-soft"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** A word from the glossary: the word itself, with its meaning from `TERMS` in a tip. */
export function Term({ word, children }: { word: string; children?: ReactNode }) {
  const meaning = TERMS[word];
  return meaning ? <Tip text={meaning}>{children ?? word}</Tip> : <>{children ?? word}</>;
}
