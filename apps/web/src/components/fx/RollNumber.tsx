import { formatCount } from '@kreators/shared';
import gsap from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './env';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
// Inline so the rest of the page's CSS stays untouched. The column takes the size of its final digit (a hidden copy), so the last frame
// lines up with the plain text that replaces it. Each cell carries 0.25em above and below so a neighbouring digit never peeks into the clip.
const COL = { position: 'relative', display: 'inline-block' } as const;
const GHOST = { visibility: 'hidden' } as const;
const CLIP = { position: 'absolute', left: 0, right: 0, top: '-0.25em', bottom: '-0.25em', clipPath: 'inset(0 -0.5em)' } as const;
const STRIP = { position: 'absolute', left: 0, right: 0, top: 0, display: 'block', willChange: 'transform' } as const;
const CELL = { display: 'block', padding: '0.25em 0', textAlign: 'center', whiteSpace: 'nowrap' } as const;

const isDigit = (ch: string | undefined): ch is string => ch !== undefined && ch >= '0' && ch <= '9';

/** One rolling change: the text it ends on and, for each of its characters, the digit it rolls from (null for a comma or a digit that stays). */
type Roll = { id: number; text: string; from: (number | null)[] };

/**
 * A number that rolls to its new value when it changes, like a counter on a dial: each digit is a column that slides (transform only) from
 * the old digit to the new one, lined up from the right so units roll onto units. The first render shows the value as plain text, at rest it is
 * plain text again (the same look as before), screen readers get the final number at once, and reduced motion swaps it without moving.
 * Learned from the roll style of count-up numbers; our own code.
 */
export function RollNumber({ value, format = formatCount, duration = 0.6, className = '' }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const text = format(value);
  const [last, setLast] = useState(text);
  const [roll, setRoll] = useState<Roll | null>(null);
  const box = useRef<HTMLSpanElement>(null);

  // Start a roll when the shown text changes after the first render.
  if (last !== text) {
    const before = last;
    setLast(text);
    if (typeof window !== 'undefined' && !prefersReducedMotion()) {
      const from = text.split('').map((ch, i) => {
        if (!isDigit(ch)) return null;
        const old = before[before.length - (text.length - i)];
        const d = isDigit(old) ? Number(old) : 0;
        return d === Number(ch) && before.length === text.length ? null : d;
      });
      if (from.some((d) => d !== null)) setRoll({ id: (roll?.id ?? 0) + 1, text, from });
      else if (roll) setRoll(null);
    } else if (roll) setRoll(null);
  }

  useLayoutEffect(() => {
    if (!roll || !box.current) return;
    const strips = Array.from(box.current.querySelectorAll<HTMLElement>('[data-roll-strip]'));
    const tl = gsap.timeline({ onComplete: () => setRoll((r) => (r && r.id === roll.id ? null : r)) });
    strips.forEach((el, i) => {
      const from = Number(el.dataset.from);
      const to = Number(el.dataset.to);
      gsap.set(el, { y: 0, yPercent: -from * 10 });
      tl.fromTo(el, { yPercent: -from * 10 }, { yPercent: -to * 10, duration, ease: 'power3.out' }, (strips.length - 1 - i) * 0.05);
    });
    return () => {
      tl.kill();
    };
  }, [roll, duration]);

  const shown = roll && roll.text === text ? roll : null;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {shown ? (
        <span ref={box} aria-hidden="true">
          {text.split('').map((ch, i) => {
            const from = shown.from[i];
            if (from === null || from === undefined) return <span key={i}>{ch}</span>;
            return (
              <span key={i} style={COL}>
                <span style={GHOST}>{ch}</span>
                <span style={CLIP}>
                  {/* No inline transform: GSAP would read a percent as pixels in `y` and add it under `yPercent`. The layout effect sets the start before paint. */}
                  <span data-roll-strip="" data-from={from} data-to={ch} style={STRIP}>
                    {DIGITS.map((d) => (
                      <span key={d} style={CELL}>
                        {d}
                      </span>
                    ))}
                  </span>
                </span>
              </span>
            );
          })}
        </span>
      ) : (
        <span aria-hidden="true">{text}</span>
      )}
    </span>
  );
}
