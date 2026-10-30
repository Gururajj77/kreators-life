import { GETTING_STARTED_DAYS, type BriefLine } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

const TONE: Record<BriefLine['tone'], string> = { good: 'var(--color-r4)', watch: 'var(--color-r1)', neutral: 'var(--color-line)' };

function Lines({ title, lines, label }: { title: string; lines: BriefLine[]; label: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-sm">
      <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</p>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-label={label}>
        {lines.map((l) => {
          const inner = (
            <>
              <span className="mt-xs size-[10px] shrink-0 rounded-pill" style={{ background: TONE[l.tone] }} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-[14px] font-bold">{l.text}</span>
            </>
          );
          return (
            <li key={l.key}>
              {l.to ? (
                <Link to={l.to} className="toy toy-soft flex items-start gap-sm rounded-tile bg-paper p-sm">
                  {inner}
                </Link>
              ) : (
                <span className="flex items-start gap-sm rounded-tile bg-paper p-sm">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The daily brief, then the first-week checklist while it is open. Both are worked out on the server from the
 * person's own numbers (briefFor and gettingStarted in shared), so there is nothing to tick here: doing the thing
 * ticks it.
 */
export function DailyBrief({ date, hour }: { date: string; hour: number }) {
  const q = useAuthed(['brief', date, hour], () => api.brief(date, hour));
  const fold = useMutation({ mutationFn: (folded: boolean) => api.foldGettingStarted(folded), onSuccess: () => void q.refetch() });
  const d = q.data;
  if (!d) return null;
  const g = d.gettingStarted;
  return (
    <>
      <section className="span-all mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="brief-heading">
        <h2 id="brief-heading" className="text-[20px]">
          Your daily brief
        </h2>
        <p className="m-0 text-[12px] font-bold text-ink-soft">Three things that changed, and three next steps, from your own numbers.</p>
        <Lines title="What changed" lines={d.brief.signals} label="What changed" />
        <Lines title="Next steps" lines={d.brief.actions} label="Next steps" />
        {d.brief.coach && <Lines title="Your students" lines={d.brief.coach} label="Your students" />}
        {d.brief.team && <Lines title="For the team" lines={d.brief.team} label="For the team" />}
      </section>
      {g.show && (
        <section className="span-all mt-md rounded-card bg-card p-sm shadow-toy-soft" aria-labelledby="start-heading">
          {/* A small toggle: the heading is the button, so the list can be folded away and opened again. */}
          <button type="button" aria-expanded={!g.folded} aria-controls="start-list" onClick={() => fold.mutate(!g.folded)} disabled={fold.isPending} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile px-sm text-left">
            <span id="start-heading" className="text-[16px] font-extrabold">
              Getting started
            </span>
            <span className="flex shrink-0 items-center gap-xs text-[14px] font-extrabold text-ink-soft">
              {g.done} of {g.items.length}
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={g.folded ? '' : 'rotate-180'}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          {!g.folded && (
            <div id="start-list" className="px-sm pb-sm">
              <p className="m-0 text-[12px] font-bold text-ink-soft">Your first {GETTING_STARTED_DAYS} days. Each one ticks itself when you do it.</p>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <Link to={i.to} className={`toy toy-soft flex items-center gap-sm rounded-tile p-sm ${i.done ? 'bg-paper text-ink-soft' : 'bg-paper'}`}>
                      <span className={`flex size-[24px] shrink-0 items-center justify-center rounded-pill border-2 text-[14px] font-extrabold ${i.done ? 'border-r4 bg-r4 text-on-fill' : 'border-line'}`} aria-hidden="true">
                        {i.done ? '✓' : ''}
                      </span>
                      <span className={`min-w-0 flex-1 text-[14px] font-bold ${i.done ? 'line-through' : ''}`}>{i.label}</span>
                      <span className="sr-only">{i.done ? 'done' : 'not yet'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </>
  );
}
