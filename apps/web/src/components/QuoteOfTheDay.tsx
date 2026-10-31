import { lineForDay } from '@kreators/shared';

/**
 * The line of the day, drawn like a tooltip: the same pale card as every tip, with a small point at the top that aims at the section above it
 * (Water and reminders). One line a day from a philosopher, with their name, or from the app, with none, the same for everyone on the same day, and none comes back until
 * every line has been shown. Nothing is stored, and there is nothing to tap.
 */
export function QuoteOfTheDay({ date }: { date: string }) {
  const line = lineForDay(date);
  return (
    <aside className="span-all relative mt-md" aria-label="Line of the day">
      <span className="tip-card absolute -top-[6px] left-lg block size-[12px] rotate-45 border-t border-l border-line" aria-hidden="true" />
      <figure className="tip-card relative m-0 rounded-tile border border-line p-sm shadow-toy-soft">
        <figcaption className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Line of the day</figcaption>
        <blockquote className="m-0 mt-xs">
          <p className="m-0 text-pretty text-[16px] font-semibold leading-snug">“{line.text}”</p>
          {line.by && <footer className="mt-xs text-[14px] font-bold text-ink-soft">{line.by}</footer>}
        </blockquote>
      </figure>
    </aside>
  );
}
