import {
  blockMinutes,
  minutesLabel,
  parseRoutineBlocks,
  ROUTINE_NOTE_MAX,
  ROUTINE_STEP_MAX,
  ROUTINE_STEP_MINUTES_MAX,
  ROUTINE_STEPS_MAX,
  stepsMinutes,
  type DayType,
  type RoutineBlock,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorText } from '../lib/api';
import { FIELD } from '../lib/ui';
import { useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { chip } from './Chat';
import { Icon } from './Icon';
import { Pencil, X } from 'lucide-react';


/**
 * The routine on the life map, for a general day and for an exceptional one: each block with its times and how
 * long it runs, and the morning steps with their minutes and what they add up to. "Edit my routine" changes the
 * times, adds, renames or removes morning steps and their minutes, and rewrites the note of a block. The same check
 * as the server (parseRoutineBlocks) runs before it saves, through PATCH /session/routine.
 */
export function RoutinePanel({ general, exceptional, date }: { general: RoutineBlock[]; exceptional: RoutineBlock[]; date: string }) {
  const [day, setDay] = useState<DayType>('general');
  const blocks = day === 'general' ? general : exceptional;
  const [draft, setDraft] = useState<RoutineBlock[] | null>(null);
  const refresh = useRefreshAll();
  const save = useMutation({
    mutationFn: (next: RoutineBlock[]) => api.updateRoutine(day === 'general' ? { date, general: next } : { date, exceptional: next }),
    onSuccess: async () => {
      await refresh();
      setDraft(null);
    },
  });
  const edit = (key: RoutineBlock['key'], change: Partial<RoutineBlock>) => setDraft((d) => d && d.map((b) => (b.key === key ? { ...b, ...change } : b)));
  const start = () =>
    setDraft(
      blocks.map((b) => ({
        ...b,
        steps: [...b.steps],
        minutes: b.steps.map((_, i) => b.minutes?.[i] ?? 0),
      })),
    );

  return (
    <div>
      {/* The day to show, and editing beside it at the top, so it is found before the whole day is scrolled past. */}
      <div className="flex flex-wrap items-center gap-xs">
        <div className="contents" role="group" aria-label="Which day">
          {(['general', 'exceptional'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={day === t}
              className={chip(day === t)}
              onClick={() => {
                setDay(t);
                setDraft(null);
              }}
            >
              {t === 'general' ? 'General day' : 'Exceptional day'}
            </button>
          ))}
        </div>
        {!draft && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={start} aria-label="Edit my routine">
            <Icon icon={Pencil} size={16} strokeWidth={2.4} />
            Edit
          </Button>
        )}
      </div>

      {!draft ? (
        <>
          <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
            {blocks.map((b) => (
              <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 flex items-baseline justify-between gap-sm text-subhead font-semibold">
                  <span>{b.name}</span>
                  <span className="shrink-0 text-caption text-ink-soft">
                    {b.start} to {b.end} · {minutesLabel(blockMinutes(b))}
                  </span>
                </p>
                {b.steps.length > 0 && (
                  <>
                    <ul className="mt-xs m-0 flex list-none flex-col gap-[2px] p-0">
                      {b.steps.map((st, i) => (
                        <li key={st} className="flex items-baseline justify-between gap-sm text-caption text-ink-soft">
                          <span>{st}</span>
                          {b.minutes?.[i] ? <span className="shrink-0">{minutesLabel(b.minutes[i]!)}</span> : null}
                        </li>
                      ))}
                    </ul>
                    {stepsMinutes(b) > 0 && <p className="mt-xs m-0 text-caption">The steps take {minutesLabel(stepsMinutes(b))} in all.</p>}
                  </>
                )}
                {b.note && <p className="mt-xs m-0 text-caption text-ink-soft">{b.note}</p>}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="mt-sm m-0 text-subhead text-ink-soft">Change the times, add or remove morning steps, and say how many minutes each one takes. Then save.</p>
          <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
            {draft.map((b) => (
              <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 flex items-baseline justify-between gap-sm text-subhead font-semibold">
                  <span>{b.name}</span>
                  <span className="shrink-0 text-caption text-ink-soft">Runs {minutesLabel(blockMinutes(b))}</span>
                </p>
                <div className="mt-xs grid grid-cols-2 gap-xs">
                  <label className="block text-caption text-ink-soft">
                    Starts
                    <input type="time" value={b.start} onChange={(e) => edit(b.key, { start: e.target.value })} className={`${FIELD} text-ink`} />
                  </label>
                  <label className="block text-caption text-ink-soft">
                    Ends
                    <input type="time" value={b.end} onChange={(e) => edit(b.key, { end: e.target.value })} className={`${FIELD} text-ink`} />
                  </label>
                </div>
                {b.key === 'morning' ? (
                  <div className="mt-sm">
                    <p className="m-0 text-caption text-ink-soft">The steps, and the minutes each one takes</p>
                    <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                      {b.steps.map((st, i) => (
                        <li key={i} className="flex items-center gap-xs">
                          <input
                            value={st}
                            onChange={(e) =>
                              edit(b.key, {
                                steps: b.steps.map((x, j) => (j === i ? e.target.value : x)),
                              })
                            }
                            maxLength={ROUTINE_STEP_MAX}
                            placeholder="A step, like a glass of water"
                            aria-label={`Step ${i + 1}`}
                            className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-body text-ink"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={ROUTINE_STEP_MINUTES_MAX}
                            value={b.minutes?.[i] ?? 0}
                            onChange={(e) =>
                              edit(b.key, {
                                minutes: b.steps.map((_, j) => (j === i ? Number(e.target.value) : (b.minutes?.[j] ?? 0))),
                              })
                            }
                            aria-label={`Minutes for step ${i + 1}`}
                            className="w-[64px] shrink-0 rounded-tile border-2 border-line bg-paper px-xs py-sm text-center text-body text-ink"
                          />
                          <span className="shrink-0 text-caption text-ink-soft" aria-hidden="true">
                            min
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              edit(b.key, {
                                steps: b.steps.filter((_, j) => j !== i),
                                minutes: (b.minutes ?? []).filter((_, j) => j !== i),
                              })
                            }
                            disabled={b.steps.length <= 1}
                            aria-label={`Remove step ${i + 1}`}
                            className="toy toy-soft flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-card text-ink-soft hover:text-ink disabled:opacity-40"
                          >
                            <Icon icon={X} size={16} strokeWidth={2.8} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {b.steps.length < ROUTINE_STEPS_MAX && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-xs"
                        onClick={() =>
                          edit(b.key, {
                            steps: [...b.steps, ''],
                            minutes: [...b.steps.map((_, j) => b.minutes?.[j] ?? 0), 5],
                          })
                        }
                      >
                        Add a step
                      </Button>
                    )}
                    <p className="mt-xs m-0 text-caption">The steps take {minutesLabel(stepsMinutes(b))} in all.</p>
                  </div>
                ) : (
                  <label className="mt-sm block text-caption text-ink-soft">
                    What happens here
                    <input value={b.note} onChange={(e) => edit(b.key, { note: e.target.value })} maxLength={ROUTINE_NOTE_MAX} className={`${FIELD} text-ink`} />
                  </label>
                )}
              </li>
            ))}
          </ol>
          {save.isError && (
            <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead font-semibold">
              That did not save. {errorText(save.error, 'Try again.')}
            </p>
          )}
          <div className="mt-sm flex flex-wrap items-center gap-sm">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button className="ml-auto" onClick={() => save.mutate(parseRoutineBlocks(draft, blocks))} disabled={save.isPending}>
              Save my routine
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
