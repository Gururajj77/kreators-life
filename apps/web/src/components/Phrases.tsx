import { Fragment } from 'react';

/**
 * A line kept in whole parts after a colon or semicolon (or the marks `at` names), each part an inline-block, so a narrow box breaks
 * there on purpose ("Mindfulness:" over "breathe, then focus", "Step three:" over "the scorecard and her real day") and never in the
 * middle of a part when the part fits. The space between parts stays outside them, so a wide box reads as one line. Text is a rectangle
 * (CLAUDE.md): a break after punctuation is one the founder asked for, and the rag probe counts it as made on purpose.
 */
export function Phrases({ text, at = /(?<=[:;]) / }: { text: string; at?: RegExp }) {
  const parts = text.split(at);
  if (parts.length < 2) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          <span className="inline-block">{part}</span>
        </Fragment>
      ))}
    </>
  );
}
