import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from './env';

/**
 * One stretch of the line. `em` renders it in an <em> (the quiet half of a headline), `br` ends the line. A `br` with a `className`
 * (`hidden md:inline`) breaks only where that class shows it, with a space before it so the words still part where it is hidden.
 */
export type RevealPart = { text: string; em?: boolean; br?: never; className?: never } | { br: true; text?: never; em?: never; className?: string };

/**
 * A headline whose words (or letters) rise in one after another. The text stays real text in the page for screen readers, search and
 * anyone whose script has not run; every word keeps its place from the first paint (only opacity and transform move), so nothing shifts.
 * Plays once on mount, so use it only above the fold. Reduced motion shows the words at once.
 */
export function TextReveal({ parts, by = 'word', delay = 0, step = 55, className = '' }: { parts: RevealPart[]; by?: 'word' | 'char'; delay?: number; step?: number; className?: string }) {
  const [on, setOn] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (on) return;
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [on]);

  let n = 0;
  const unit = (s: string, key: number) => {
    const i = n++;
    const style = { '--fx-i': i, '--fx-delay': `${delay}ms`, '--fx-step': `${step}ms` } as CSSProperties;
    return (
      <span key={key} className="fx-word" style={style}>
        {s}
      </span>
    );
  };
  const words = (text: string) =>
    text.split(' ').map((w, wi, all) => (
      <Fragment key={wi}>
        {by === 'char' ? (
          <span className="inline-block whitespace-nowrap">{Array.from(w).map((c, ci) => unit(c, ci))}</span>
        ) : (
          unit(w, 0)
        )}
        {wi < all.length - 1 ? ' ' : ''}
      </Fragment>
    ));

  return (
    <span className={`fx-text ${className}`} data-on={on ? '' : undefined}>
      {parts.map((p, i) => {
        const gap = i > 0 && !parts[i - 1]?.br && !p.br ? ' ' : '';
        if (p.br) return p.className ? <Fragment key={i}>{' '}<br className={p.className} /></Fragment> : <br key={i} />;
        return (
          <Fragment key={i}>
            {gap}
            {p.em ? <em>{words(p.text)}</em> : words(p.text)}
          </Fragment>
        );
      })}
    </span>
  );
}
