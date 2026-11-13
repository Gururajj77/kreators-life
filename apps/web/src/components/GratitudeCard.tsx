import { addDays } from '@kreators/shared';
import {
  GRATITUDE_GROUPS,
  GRATITUDE_GROUP_NAMES,
  GRATITUDE_LINES,
  GRATITUDE_LINE_MAX,
  gratitudePromptByKey,
  gratitudePromptsForDay,
  gratitudeWritten,
  type GratitudeDay,
  type GratitudeGroup,
  type GratitudeLine,
} from '@kreators/shared/gratitude';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { todayLocal, fullDay } from '../lib/date';
import { chip, FIELD } from '../lib/ui';
import { useAutosave } from '../lib/useAutosave';
import { IconButton } from './IconButton';
import { ErrorLine, errorText } from './ErrorLine';
import { SkeletonList } from './Skeleton';
import { ToggleChevron } from './ToggleMark';

type GratitudeAnswer = { gratitude: GratitudeDay | null; prompts?: string[]; usual?: GratitudeGroup[] | null };

/** The colour of a group: the colour of its pillar, or the quiet ink for the day itself. */
const groupColor = (g: GratitudeGroup) => (g === 'day' ? 'var(--color-ink-mute)' : `var(--color-r${GRATITUDE_GROUPS.indexOf(g) + 1})`);
const freshLines = (day: string): GratitudeLine[] => gratitudePromptsForDay(day).map((p) => ({ prompt: p.key, text: '' }));
const dayName = fullDay;
/** The lines the card edits: the prompts of the day for this person, with the words already written in their places. */
const linesFrom = (d: GratitudeAnswer, day: string): GratitudeLine[] =>
  d.prompts ? d.prompts.map((prompt, i) => ({ prompt, text: d.gratitude?.lines[i]?.text ?? '' })) : (d.gratitude?.lines ?? freshLines(day));

/** The words of the heading for a day: today, yesterday, or the date. */
export function gratitudeTitle(day: string, today = todayLocal()): string {
  if (day === today) return 'Gratitude for today';
  if (day === addDays(today, -1)) return 'Gratitude for yesterday';
  return `Gratitude for ${dayName(day)}`;
}

/**
 * Gratitude for the day, on Journal (2026-11-07): three short lines, each under its own prompt from one of the seven pillars or the day
 * itself. The prompts are per person (migration 0106): the server keeps the three of each day, so a reload or another device shows the
 * same, and a prompt they wrote under or skipped does not come back until they have seen the rest of that pillar. It saves as the
 * person types, one save 800 ms after the last change (`useAutosave`), so there is no Save button; today and yesterday can change, an
 * older day is shown as it was written. On an empty line the name of the pillar is a picker and the round arrows give another prompt.
 * Journal data: only the person ever sees it.
 */
export const GratitudeCard = forwardRef<HTMLHeadingElement, { day: string; onDay: (day: string) => void }>(function GratitudeCard({ day, onDay }, ref) {
  const today = todayLocal();
  return (
    <section className="mt-lg" aria-labelledby="gratitude-heading">
      <div className="flex flex-wrap-reverse items-start justify-between gap-sm">
        <div className="min-w-0 flex-[1_1_60%]">
          <h2 id="gratitude-heading" ref={ref} tabIndex={-1} className="text-title2 outline-none">
            {gratitudeTitle(day, today)}
          </h2>
          <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">Three short lines on what went right. Only you see them, unless you share the Gratitude table with a life coach or AI chat.</p>
        </div>
        {day !== today && (
          <button type="button" onClick={() => onDay(today)} className="toy toy-flat inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-sm text-subhead font-semibold">
            Back to today
          </button>
        )}
      </div>
      {/* One body per day, so unsaved words are sent for their own day as the next one opens. */}
      <GratitudeBody key={day} day={day} editable={day === today || day === addDays(today, -1)} />
    </section>
  );
});

function GratitudeBody({ day, editable }: { day: string; editable: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['gratitude', day], queryFn: () => api.gratitude(day) });
  const [lines, setLines] = useState<GratitudeLine[] | null>(null);
  // The line whose pillar list is open, the line waiting on the server, and a quiet line on what a tap did.
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; quiet?: boolean }>({ text: '' });
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  // Whether the server holds words for this day: the mark on the calendar and the period count change only when that flips.
  const held = useRef(false);
  const resetRef = useRef<(v: GratitudeLine[], version: string) => void>(() => undefined);
  const { refetch } = q;

  /** The prompts the server holds for the day go on every empty line; a written line keeps its own. */
  const adopt = useCallback((prompts: readonly string[]) => {
    setLines((prev) => {
      if (!prev || prompts.length !== prev.length) return prev;
      const next = prev.map((l, i) => (l.text.trim() || l.prompt === prompts[i] ? l : { prompt: prompts[i]!, text: '' }));
      return next.some((l, i) => l !== prev[i]) ? next : prev;
    });
  }, []);
  const remember = useCallback((patch: Partial<GratitudeAnswer>) => qc.setQueryData<GratitudeAnswer>(['gratitude', day], (old) => (old ? { ...old, ...patch } : old)), [qc, day]);

  const save = useCallback(
    async (value: GratitudeLine[], version: string) => {
      const r = await api.saveGratitude(day, value, version);
      // The day panel reads the same day.
      remember({ gratitude: r.gratitude, ...(r.prompts ? { prompts: r.prompts } : {}) });
      if (held.current !== Boolean(r.gratitude)) {
        held.current = Boolean(r.gratitude);
        void qc.invalidateQueries({ queryKey: ['journal-days'] });
        void qc.invalidateQueries({ queryKey: ['reviews'] });
      }
      return r.gratitude?.updatedAt ?? '';
    },
    [day, qc, remember],
  );
  // Another tab saved this day first: take what the server holds now.
  const onConflict = useCallback(() => {
    void refetch().then((r) => {
      if (!r.data) return;
      const l = linesFrom(r.data, day);
      held.current = Boolean(r.data.gratitude);
      resetRef.current(l, r.data.gratitude?.updatedAt ?? '');
      setLines(l);
    });
  }, [refetch, day]);
  const auto = useAutosave<GratitudeLine[]>({ value: lines, save, restore: setLines, onConflict, enabled: editable && lines !== null });
  const { reset } = auto;
  resetRef.current = reset;

  // The first answer fills the lines; later answers (the saves of this card) never write over what is being typed.
  useEffect(() => {
    if (lines !== null || !q.data) return;
    const l = linesFrom(q.data, day);
    held.current = Boolean(q.data.gratitude);
    reset(l, q.data.gratitude?.updatedAt ?? '');
    setLines(l);
  }, [q.data, lines, day, reset]);
  // A later read (another tab picked or skipped) moves the prompts of the empty lines only.
  const served = q.data?.prompts?.join(',');
  useEffect(() => {
    if (served) adopt(served.split(','));
  }, [served, adopt]);

  /** Sends a change of prompts: Another prompt or a pillar picked. The server answers with the prompts of the day, also when it refused. */
  const change = useCallback(
    async (index: number, run: () => Promise<{ prompts: string[] }>, done: (prompts: string[]) => { text: string; quiet?: boolean }) => {
      setBusy(index);
      setNotice({ text: '' });
      try {
        // Any words cleared from the line reach the server first, so it sees the line as empty.
        await auto.flush();
        const r = await run();
        adopt(r.prompts);
        remember({ prompts: r.prompts });
        setNotice(done(r.prompts));
      } catch (e) {
        const prompts = e instanceof ApiError && Array.isArray(e.data.prompts) ? (e.data.prompts as string[]) : null;
        if (prompts) {
          adopt(prompts);
          remember({ prompts });
        }
        setNotice({ text: e instanceof ApiError && e.message === 'changed' ? 'Changed in another tab. The prompts are up to date now.' : errorText(e) });
      } finally {
        setBusy(null);
      }
    },
    [auto, adopt, remember],
  );

  if (q.isError) return <ErrorLine e={q.error} className="mt-sm" />;
  if (!lines) return <SkeletonList className="mt-sm" count={1} lines={3} label="Opening your gratitude" />;

  if (!editable) return <GratitudeRead day={day} saved={q.data?.gratitude ?? null} />;

  const written = gratitudeWritten(lines);
  const groups = lines.map((l) => gratitudePromptByKey(l.prompt)?.group ?? null);
  const usual = q.data?.usual ?? null;
  const isUsual = Boolean(usual && usual.join() === groups.join());
  const closePicker = (i: number) => {
    setPicking(null);
    window.requestAnimationFrame(() => triggers.current[i]?.focus());
  };
  const pinUsual = async () => {
    setNotice({ text: '' });
    const next = isUsual ? null : (groups.filter(Boolean) as GratitudeGroup[]);
    try {
      const r = await api.saveGratitudeUsual(next && next.length === GRATITUDE_LINES ? next : null);
      remember({ usual: r.usual });
      setNotice({ text: r.usual ? 'Saved. Each new day starts with these three pillars.' : 'Done. Each new day mixes the pillars again.' });
    } catch (e) {
      setNotice({ text: errorText(e) });
    }
  };
  return (
    <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
      <ol className="m-0 flex list-none flex-col gap-md p-0">
        {lines.map((line, i) => {
          const p = gratitudePromptByKey(line.prompt);
          const id = `gratitude-${day}-${i}`;
          const empty = !line.text.trim();
          const open = empty && picking === i;
          const name = p ? GRATITUDE_GROUP_NAMES[p.group] : '';
          return (
            // By place on purpose: three fixed lines that never reorder, and a prompt changing under an empty line must keep its field and focus.
            <li key={i}>
              <div className="flex items-end justify-between gap-sm">
                <div className="min-w-0 flex-1">
                  {/* The name of the pillar picks another pillar while the line is empty; once it has words, it is a plain label. */}
                  {empty && p ? (
                    <button
                      type="button"
                      ref={(el) => {
                        triggers.current[i] = el;
                      }}
                      aria-expanded={open}
                      aria-controls={`${id}-pillars`}
                      aria-label={`Pillar for line ${i + 1}: ${name}. ${open ? 'Close the list' : 'Pick another'}`}
                      disabled={busy !== null}
                      onClick={() => setPicking(open ? null : i)}
                      className="relative inline-flex items-center gap-xs rounded-pill text-eyebrow uppercase text-ink-soft before:absolute before:-inset-x-[8px] before:-inset-y-[15px] before:content-[''] hover:text-ink"
                    >
                      <span className="block size-[8px] shrink-0 rounded-pill" style={{ background: groupColor(p.group) }} aria-hidden="true" />
                      {name}
                      <ToggleChevron open={open} size={12} />
                    </button>
                  ) : (
                    <span className="flex items-center gap-xs text-eyebrow uppercase text-ink-soft">
                      <span className="block size-[8px] shrink-0 rounded-pill" style={{ background: p ? groupColor(p.group) : 'var(--color-ink-mute)' }} aria-hidden="true" />
                      {name}
                    </span>
                  )}
                  {open && (
                    <div
                      id={`${id}-pillars`}
                      onKeyDown={(e) => {
                        if (e.key !== 'Escape') return;
                        e.stopPropagation();
                        closePicker(i);
                      }}
                    >
                      <div role="group" aria-label={`Pillar for line ${i + 1}`} className="mt-sm grid grid-cols-2 gap-xs sm:grid-cols-4">
                        {GRATITUDE_GROUPS.map((g) => {
                          const j = groups.indexOf(g);
                          // A pillar on another line swaps with this one, unless that line is written.
                          const locked = j >= 0 && j !== i && Boolean(lines[j]?.text.trim());
                          return (
                            <button
                              key={g}
                              type="button"
                              aria-pressed={g === p?.group}
                              disabled={locked || busy !== null}
                              title={locked ? 'On a line you wrote' : undefined}
                              onClick={() => {
                                if (g === p?.group) return closePicker(i);
                                void change(i, () => api.gratitudePick(day, i, g, line.prompt), () => ({ text: `Picked ${GRATITUDE_GROUP_NAMES[g]}.` })).then(() => closePicker(i));
                              }}
                              className={`${chip(g === p?.group)} min-w-0 justify-center gap-xs`}
                            >
                              <span className="block size-[8px] shrink-0 rounded-pill" style={{ background: groupColor(g) }} aria-hidden="true" />
                              {GRATITUDE_GROUP_NAMES[g]}
                              {locked && <span className="sr-only">, on a line you wrote</span>}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-xs m-0 text-caption text-ink-soft">A pillar on another line swaps places with this one.</p>
                    </div>
                  )}
                  <label htmlFor={id} className="mt-xs block text-subhead font-semibold">
                    {p?.text ?? 'What went well?'}
                  </label>
                </div>
                {/* Another prompt keeps the pillar of the line; it shows only while the line is empty, so words never sit under a prompt they did not answer. */}
                {empty && (
                  <IconButton
                    icon={RefreshCw}
                    label="Another prompt"
                    tip="br"
                    disabled={busy !== null}
                    onClick={() => void change(i, () => api.gratitudeAnother(day, i, line.prompt), (next) => ({ text: `New prompt: ${gratitudePromptByKey(next[i] ?? '')?.text ?? ''}`, quiet: true }))}
                  />
                )}
              </div>
              <input
                id={id}
                value={line.text}
                maxLength={GRATITUDE_LINE_MAX}
                autoComplete="off"
                enterKeyHint={i < GRATITUDE_LINES - 1 ? 'next' : 'done'}
                onChange={(e) => {
                  const text = e.target.value;
                  setLines((prev) => (prev ? prev.map((l, j) => (j === i ? { ...l, text } : l)) : prev));
                }}
                onBlur={() => void auto.flush()}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const nextField = document.getElementById(`gratitude-${day}-${i + 1}`);
                  if (nextField) nextField.focus();
                  else void auto.flush();
                }}
                className={FIELD}
              />
            </li>
          );
        })}
      </ol>
      <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-x-sm">
        <p className="m-0 text-footnote text-ink-soft" role="status">
          {written} of {GRATITUDE_LINES} written{auto.words ? `. ${auto.words}.` : '.'}
          {notice.text ? <span className={notice.quiet ? 'sr-only' : undefined}> {notice.text}</span> : null}
        </p>
        {/* The usual three: each new day starts with these pillars instead of the mix. */}
        {groups.every(Boolean) && (
          <button type="button" onClick={() => void pinUsual()} className="toy toy-flat inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-sm text-subhead font-semibold">
            {isUsual ? 'Stop my usual three' : 'Make these my usual three'}
          </button>
        )}
      </div>
    </div>
  );
}

/** A day that can no longer change: the lines as they were written, under the prompts they answered. */
function GratitudeRead({ day, saved }: { day: string; saved: GratitudeDay | null }) {
  const lines = (saved?.lines ?? []).filter((l) => l.text.trim());
  if (!lines.length) return <p className="mt-sm m-0 text-subhead text-ink-soft">No gratitude written on {dayName(day)}.</p>;
  return (
    <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
      <GratitudeLines lines={lines} />
      <p className="mt-sm m-0 text-footnote text-ink-soft">Only today and yesterday can change. Older days stay as you wrote them.</p>
    </div>
  );
}

/** Written lines under their prompts, read only: the card for an older day and the day panel on the calendar. */
export function GratitudeLines({ lines }: { lines: readonly GratitudeLine[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-sm p-0">
      {lines.map((l) => {
        const p = gratitudePromptByKey(l.prompt);
        return (
          <li key={l.prompt}>
            <span className="flex items-center gap-xs text-footnote text-ink-soft">
              <span className="block size-[8px] shrink-0 rounded-pill" style={{ background: p ? groupColor(p.group) : 'var(--color-ink-mute)' }} aria-hidden="true" />
              {p?.text ?? ''}
            </span>
            <span className="mt-xs block text-body">{l.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
