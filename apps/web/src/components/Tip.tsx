import { TERMS } from '@kreators/shared';
import { useEffect, useId, useState, type ReactNode } from 'react';

/**
 * A word with a short explanation that opens on hover, keyboard focus or tap and closes on Escape or a tap
 * elsewhere. Every tip in the app wears the same pale purple card with ink text, so it reads as help and
 * never as a button or a warning; in dark mode the tint turns deep purple by itself.
 */
export function Tip({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element | null)?.closest?.(`[data-tip="${CSS.escape(id)}"]`)) setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [open, id]);
  return (
    <span data-tip={id} className={`relative inline-block ${className}`} onPointerEnter={(e) => e.pointerType !== 'touch' && setOpen(true)} onPointerLeave={(e) => e.pointerType !== 'touch' && setOpen(false)}>
      <button
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
      {open && (
        <span id={id} role="tooltip" className="tip-card absolute bottom-full left-0 z-30 mb-xs block w-[min(280px,80vw)] rounded-tile border border-line p-sm text-left text-[14px] font-semibold normal-case shadow-toy-soft">
          {text}
        </span>
      )}
    </span>
  );
}

/** A word from the glossary: the word itself, with its meaning from `TERMS` in a tip. */
export function Term({ word, children }: { word: string; children?: ReactNode }) {
  const meaning = TERMS[word];
  return meaning ? <Tip text={meaning}>{children ?? word}</Tip> : <>{children ?? word}</>;
}
