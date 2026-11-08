import { INSIGHT_BASIS_TAIL, type CoachPattern, type CoachPatternsAnswer, type CoachSuggestion, type TagTone } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { evenGrid, evenTile } from '../lib/bento';
import { longDate } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { InsightChartView } from './Emergence';
import { ErrorLine } from './ErrorLine';
import { Skeleton } from './Skeleton';
import { StatusTag } from './StatusTag';
import { TileGroups } from './TileGroups';

/** Patterns: one to a row on a phone, two from the tablet, in even rows. */
const PATTERN_COLS = { base: 1, md: 2 } as const;
const isHabit = (p: CoachPattern) => p.key === 'habit' || p.key === 'habit-tie';
const SUGGESTION_TONE: Record<CoachSuggestion['tone'], { tone: TagTone; word: string }> = { good: { tone: 'good', word: 'Say well done' }, warn: { tone: 'warn', word: 'Worth a look' }, info: { tone: 'calm', word: 'A thought' } };

function patternTag(p: CoachPattern): { tone: TagTone; word: string } {
  if (p.verdict === 'good') return { tone: 'good', word: 'Good habit' };
  if (p.verdict === 'bad') return { tone: 'bad', word: 'Bad habit' };
  if (p.key === 'habit') return { tone: 'calm', word: 'Comes back' };
  if (p.key === 'pillar-balance') return { tone: 'calm', word: 'Balance' };
  if (p.key === 'best-hours') return { tone: 'calm', word: 'Their hours' };
  if (p.key === 'streak-weekday') return { tone: 'warm', word: 'Streak' };
  if (p.key === 'move-weekday') return { tone: 'calm', word: 'Their week' };
  return { tone: 'calm', word: 'Same days' };
}

function SuggestionCard({ s, onNote, onTask }: { s: CoachSuggestion; onNote: (text: string) => void; onTask: (t: NonNullable<CoachSuggestion['task']>) => void }) {
  const look = SUGGESTION_TONE[s.tone];
  return (
    <div className="flex h-full flex-col gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 flex-1 text-callout">{s.text}</p>
      <div className="flex flex-wrap items-center justify-between gap-xs">
        <StatusTag tone={look.tone}>{look.word}</StatusTag>
        <span className="flex flex-wrap justify-end gap-xs">
          <Button size="sm" variant="outline" onClick={() => onNote(s.note)}>
            Leave a note
          </Button>
          {s.task && (
            <Button size="sm" variant="outline" onClick={() => s.task && onTask(s.task)}>
              Add a task
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}

function PatternCard({ p }: { p: CoachPattern }) {
  const tag = patternTag(p);
  return (
    <article className="flex h-full w-full flex-col gap-sm rounded-tile bg-card p-sm shadow-toy-soft" aria-label={p.text}>
      <div className="flex items-center justify-between gap-sm">
        <p className={`m-0 min-w-0 tabular-nums ${p.headline.length > 10 ? 'text-title2' : 'text-title1'}`}>{p.headline}</p>
        <StatusTag tone={tag.tone}>{tag.word}</StatusTag>
      </div>
      <p className="m-0 text-balance text-callout">{p.text}</p>
      {p.chart && (
        <div className="flex flex-1 flex-col justify-center">
          <InsightChartView chart={p.chart} insight={{ relationship: p.relationship, key: p.key }} />
        </div>
      )}
      {p.basis && <p className="m-0 text-caption text-ink-soft">{p.basis}</p>}
    </article>
  );
}

/** Off on this link: say so plainly, and one tap asks them (an inbox note, once a week; the choice stays theirs). */
function AskCard({ studentId, data, name, onDone }: { studentId: string; data: CoachPatternsAnswer; name: string; onDone: () => void }) {
  const ask = useMutation({ mutationFn: () => api.coachAskPatterns(studentId), onSuccess: onDone });
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-callout">{name} has not switched on Patterns for you.</p>
      {data.askAgainFrom ? (
        <p className="mt-xs m-0 text-subhead text-ink-soft">You asked{data.askedAt ? ` on ${longDate(data.askedAt)}` : ''}. You can ask again from {longDate(data.askAgainFrom)}.</p>
      ) : (
        <div className="mt-sm flex flex-wrap items-center justify-between gap-sm">
          <p className="m-0 min-w-[60%] flex-1 text-subhead text-ink-soft">Ask once a week. It lands in their inbox, and the choice stays theirs.</p>
          <Button size="sm" variant="outline" disabled={ask.isPending} onClick={() => ask.mutate()}>
            Ask to see patterns
          </Button>
        </div>
      )}
      <ErrorLine e={ask.error} className="mt-sm" />
    </div>
  );
}

/**
 * Patterns and suggestions for one student. Rules only, no model, stored nowhere: the server works them out on read, from what this student shares. A
 * suggestion's two actions are prefilled, and the coach edits before anything is sent.
 */
export function CoachPatterns({ studentId, name, enabled, onNote, onTask }: { studentId: string; name: string; enabled: boolean; onNote: (text: string) => void; onTask: (t: NonNullable<CoachSuggestion['task']>) => void }) {
  const q = useAuthed(['coach-patterns', studentId], () => api.coachPatterns(studentId), enabled);
  if (q.isError) return <ErrorLine e={q.error} />;
  const d = q.data;
  if (!d) return <Skeleton className="h-[160px] rounded-tile" />;
  return (
    <div className="flex flex-col gap-md">
      <div>
        <h3 className="m-0 text-headline">Suggestions</h3>
        {d.suggestions.length === 0 ? (
          <p className="mt-xs m-0 text-subhead text-ink-soft">Nothing stands out right now.</p>
        ) : (
          <ul className={`mt-xs m-0 grid list-none gap-xs p-0 ${evenGrid(d.suggestions.length, PATTERN_COLS)}`}>
            {d.suggestions.map((s, i) => (
              <li key={s.id} className={evenTile(i, d.suggestions.length, PATTERN_COLS)}>
                <SuggestionCard s={s} onNote={onNote} onTask={onTask} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="m-0 text-headline">Patterns</h3>
        {!d.on ? (
          <div className="mt-xs">
            <AskCard studentId={studentId} data={d} name={name} onDone={() => void q.refetch()} />
          </div>
        ) : d.patterns.length === 0 ? (
          <p className="mt-xs m-0 text-subhead text-ink-soft">{d.forming > 0 ? `No pattern is ready yet. ${d.forming} still forming.` : 'No pattern is ready yet.'}</p>
        ) : (
          <>
            {/* Strongest first; past ten, the habits apart from the rest (TileGroups). */}
            <TileGroups
              className="mt-xs"
              cols={PATTERN_COLS}
              flat={d.patterns}
              groups={[
                { key: 'habits', name: 'Habits', tiles: d.patterns.filter(isHabit) },
                { key: 'days', name: 'Across their days', tiles: d.patterns.filter((p) => !isHabit(p)) },
              ]}
              render={(p, className) => (
                <div key={p.id} className={`flex ${className}`}>
                  <PatternCard p={p} />
                </div>
              )}
            />
            <p className="mt-xs m-0 text-caption text-ink-soft">
              {INSIGHT_BASIS_TAIL}
              {d.forming > 0 ? ` ${d.forming} more still forming.` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
