import { GETTING_STARTED_DAYS, type BriefLine } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';
import { useAuthed, useMe } from '../lib/queries';
import { ToggleChevron } from './ToggleMark';

const TONE: Record<BriefLine['tone'], string> = { good: 'var(--color-r4)', watch: 'var(--color-r1)', neutral: 'var(--color-line)' };

function Lines({ title, lines, label }: { title: string; lines: BriefLine[]; label: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-sm">
      <p className="m-0 text-eyebrow uppercase text-ink-soft">{title}</p>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-label={label}>
        {lines.map((l) => {
          const inner = (
            <>
              {/* The dot sits on the middle of the first line (a box one line tall), not 8px down, where it hung below the words. */}
              <span className="flex h-[1lh] shrink-0 items-center text-subhead" aria-hidden="true">
                <span className="size-[10px] rounded-pill" style={{ background: TONE[l.tone] }} />
              </span>
              <span className="min-w-0 flex-1 text-subhead">{l.text}</span>
            </>
          );
          return (
            <li key={l.key}>
              {l.to ? (
                // 44px at least: one line of the tighter subhead (19px) and its padding came to 43, a pixel under a tap target.
                <Link to={l.to} className="toy toy-soft flex min-h-[44px] items-start gap-sm rounded-tile bg-paper p-sm">
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

// Whether the brief is folded, on this device only and per person (a viewer's convenience, like the set-aside Emerging cards in
// lib/insightsHidden.ts): open unless this person folded it here. Storage that refuses (a private window) leaves it open, folding still
// works for the visit.
const foldKey = (userId: string | undefined) => (userId ? `kreators.briefFolded:${userId}` : null);
function readFolded(userId: string | undefined): boolean {
  const key = foldKey(userId);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeFolded(userId: string | undefined, folded: boolean) {
  const key = foldKey(userId);
  if (!key) return;
  try {
    if (folded) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Kept for this visit only.
  }
}

/**
 * The daily brief, then the first-week checklist while it is open. Both are worked out on the server from the
 * person's own numbers (briefFor and gettingStarted in shared), so there is nothing to tick here: doing the thing
 * ticks it.
 */
export function DailyBrief({ date, hour }: { date: string; hour: number }) {
  const q = useAuthed(['brief', date, hour], () => api.brief(date, hour));
  const fold = useMutation({ mutationFn: (folded: boolean) => api.foldGettingStarted(folded), onSuccess: () => void q.refetch() });
  const userId = useMe().data?.user.id;
  // The brief is a toggle (the founder, 2026-11-13): open by default, its folded state kept on the device for this person.
  const [briefFold, setBriefFold] = useState<boolean | null>(null);
  const briefFolded = briefFold ?? readFolded(userId);
  const toggleBrief = () => {
    const next = !briefFolded;
    setBriefFold(next);
    writeFolded(userId, next);
  };
  const d = q.data;
  // While it loads, a block about the brief's own height keeps its place, so Home does not jump when it lands.
  // A block of its own after Breathe and focus's last line (or the line of the day), so it sits a section's 32px away; Getting
  // started under it stays close, as its pair.
  // It waits for the account too, so a person who folded it never sees it drawn open and then fold (review 2026-11-13). The brief is read
  // even while folded: Getting started under it comes in the same answer.
  if (q.isPending || !userId) return <Skeleton className={`span-all mt-lg rounded-card ${userId && briefFolded ? 'h-[68px]' : 'h-[232px]'}`} />;
  if (!d) return null;
  const g = d.gettingStarted;
  return (
    <>
      {/* A toggle like Getting started under it: the heading is the button, so the brief folds away and opens again. */}
      <section className="span-all mt-lg rounded-card bg-card p-sm shadow-toy-soft" aria-labelledby="brief-heading">
        <h2 className="m-0">
          <button type="button" aria-expanded={!briefFolded} aria-controls={briefFolded ? undefined : 'brief-body'} onClick={toggleBrief} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile px-sm text-left">
            <span id="brief-heading" className="text-headline">
              Your daily brief
            </span>
            <span className="flex shrink-0 items-center text-ink-soft">
              <ToggleChevron open={!briefFolded} size={14} strokeWidth={3} />
            </span>
          </button>
        </h2>
        {!briefFolded && (
          <div id="brief-body" className="px-sm pb-sm">
            <p className="m-0 text-subhead text-ink-soft">Three things that changed, and three next steps, from your own numbers.</p>
            <Lines title="What changed" lines={d.brief.signals} label="What changed" />
            <Lines title="Next steps" lines={d.brief.actions} label="Next steps" />
            {d.brief.coach && <Lines title="Your students" lines={d.brief.coach} label="Your students" />}
            {d.brief.team && <Lines title="For the team" lines={d.brief.team} label="For the team" />}
          </div>
        )}
      </section>
      {g.show && (
        <section className="span-all mt-md rounded-card bg-card p-sm shadow-toy-soft" aria-labelledby="start-heading">
          {/* A small toggle: the heading is the button, so the list can be folded away and opened again. */}
          <button type="button" aria-expanded={!g.folded} aria-controls="start-list" onClick={() => fold.mutate(!g.folded)} disabled={fold.isPending} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile px-sm text-left">
            <span id="start-heading" className="text-headline">
              Getting started
            </span>
            <span className="flex shrink-0 items-center gap-xs text-subhead text-ink-soft">
              {g.done} of {g.items.length}
              <ToggleChevron open={!g.folded} size={14} strokeWidth={3} />
            </span>
          </button>
          {!g.folded && (
            <div id="start-list" className="px-sm pb-sm">
              <p className="m-0 text-subhead text-ink-soft">Your first {GETTING_STARTED_DAYS} days. Each one ticks itself when you do it.</p>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <Link to={i.to} className={`toy toy-soft flex items-center gap-sm rounded-tile p-sm ${i.done ? 'bg-paper text-ink-soft' : 'bg-paper'}`}>
                      <span className={`flex size-[24px] shrink-0 items-center justify-center rounded-pill border-2 ${i.done ? 'border-r4 bg-r4 text-on-fill' : 'border-line'}`} aria-hidden="true">
                        {i.done ? <Icon icon={Check} size={14} strokeWidth={3} /> : ''}
                      </span>
                      <span className={`min-w-0 flex-1 text-body ${i.done ? 'line-through' : ''}`}>{i.label}</span>
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
