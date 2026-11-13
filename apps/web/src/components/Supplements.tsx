import { WEEKDAY_NAMES, weekdaysLabel } from '@kreators/shared';
import {
  MAX_SUPPLEMENTS,
  SUPPLEMENT_AMOUNT_MAX,
  SUPPLEMENT_BEFORE,
  SUPPLEMENT_CAUTION,
  SUPPLEMENT_KIND_META,
  SUPPLEMENT_KINDS,
  SUPPLEMENT_NAME_MAX,
  SUPPLEMENT_NOOTROPIC_LINE,
  SUPPLEMENT_PRIVATE_LINE,
  SUPPLEMENT_TIME_META,
  SUPPLEMENT_TIMES,
  supplementListText,
  type SupplementInput,
  type SupplementKind,
  type SupplementSettings,
  type SupplementTime,
} from '@kreators/shared/fitness';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { api } from '../lib/api';
import { useCopy } from '../lib/clipboard';
import { todayLocal } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useAuthed } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { AppIcon } from './AppIcon';
import { Button } from './Button';
import { WeekDots } from './Charts';
import { CheckRow } from './CheckRow';
import { ConfirmDelete } from './ConfirmDelete';
import { ErrorLine } from './ErrorLine';
import { FieldLabel } from './Field';
import { Fold } from './Fold';
import { Icon } from './Icon';
import { MoreMenu } from './MoreMenu';
import { Section } from './Section';
import { SkeletonList } from './Skeleton';
import { StatusTag } from './StatusTag';
import { Toggle } from './Toggle';

const pill = (on: boolean) => `toy min-h-[44px] min-w-0 rounded-tile border-2 px-sm text-caption ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`;
const NEW: SupplementInput = { name: '', kind: 'vitamin', amount: '', time: 'morning', days: [1, 2, 3, 4, 5, 6, 7] };
/** The quiet one-line caution, in the Nudge look (12px, soft), with no link: it is not about what pays. */
const Caution = ({ className = '' }: { className?: string }) => <p className={`m-0 text-caption text-ink-soft ${className}`}>{SUPPLEMENT_CAUTION}</p>;

/** Add or change one: the name on the label, its kind, an amount as typed, when and the days. Nothing here is suggested or checked. */
function SupplementForm({ initial, saveLabel, onSave, onDone, onCancel }: { initial: SupplementInput; saveLabel: string; onSave: (s: SupplementInput) => Promise<unknown>; onDone: () => void; onCancel?: () => void }) {
  const [s, setS] = useState<SupplementInput>(initial);
  const save = useMutation({ mutationFn: () => onSave(s), onSuccess: onDone });
  const set = (patch: Partial<SupplementInput>) => setS((x) => ({ ...x, ...patch }));
  return (
    <form
      className="grid gap-md"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <FieldLabel label="Name">
        {/* A form in the page, never a dialog: it opens where the row's menu was, so the keyboard's place moves into it. */}
        <input value={s.name} onChange={(e) => set({ name: e.target.value })} maxLength={SUPPLEMENT_NAME_MAX} placeholder="Name on the label" className={FIELD} autoFocus required />
      </FieldLabel>
      <div>
        <p className="m-0 text-subhead font-semibold">Kind</p>
        <div className="fill-row-all mt-xs flex flex-wrap gap-xs" role="group" aria-label="Kind">
          {SUPPLEMENT_KINDS.map((k: SupplementKind) => (
            <button key={k} type="button" aria-pressed={s.kind === k} onClick={() => set({ kind: k })} className={`${pill(s.kind === k)} inline-flex items-center justify-center gap-xs`}>
              <AppIcon name={SUPPLEMENT_KIND_META[k].icon} size={14} />
              {SUPPLEMENT_KIND_META[k].name}
            </button>
          ))}
        </div>
        {s.kind === 'nootropic' && (
          <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
            {SUPPLEMENT_NOOTROPIC_LINE}
          </p>
        )}
      </div>
      <FieldLabel label="Amount" hint="Optional. As it says on the label, like 1 tablet.">
        <input value={s.amount} onChange={(e) => set({ amount: e.target.value })} maxLength={SUPPLEMENT_AMOUNT_MAX} className={FIELD} />
      </FieldLabel>
      <div>
        <p className="m-0 text-subhead font-semibold">When</p>
        <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-4" role="group" aria-label="When">
          {SUPPLEMENT_TIMES.map((t) => (
            <button key={t} type="button" aria-pressed={s.time === t} onClick={() => set({ time: t })} className={`${pill(s.time === t)} inline-flex items-center justify-center gap-xs`}>
              <AppIcon name={SUPPLEMENT_TIME_META[t].icon} size={14} />
              {SUPPLEMENT_TIME_META[t].name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="m-0 text-subhead font-semibold">Days</p>
        <div role="group" aria-label="Days" className="mt-xs grid grid-cols-7 gap-xs">
          {WEEKDAY_NAMES.map((n, i) => {
            const d = i + 1;
            const on = s.days.includes(d);
            return (
              <button key={n} type="button" aria-pressed={on} aria-label={n} onClick={() => set({ days: on ? s.days.filter((y) => y !== d) : [...s.days, d].sort((a, b) => a - b) })} className={`${pill(on)} px-0 relative before:absolute before:-inset-x-[6px] before:-inset-y-[2px] before:content-['']`}>
                <span className="sm:hidden">{n.slice(0, 2)}</span>
                <span className="hidden sm:inline">{n}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-xs m-0 text-caption text-ink-soft">{s.days.length ? weekdaysLabel(s.days) : 'Pick at least one day.'}</p>
      </div>
      <Caution />
      <ErrorLine e={save.error} />
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="outline" className="flex-1" disabled={save.isPending || !s.name.trim() || s.days.length === 0}>
          {save.isPending ? 'Saving' : saveLabel}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** A reminder for one part of the day: off, or a time. One inbox note, only on a day something there is not marked. */
function ReminderRow({ time, at, onSet }: { time: SupplementTime; at: string | undefined; onSet: (v: string | null) => void }) {
  const name = SUPPLEMENT_TIME_META[time].name;
  return (
    <div className="grid gap-xs">
      <Toggle compact on={Boolean(at)} label={name} onChange={(on) => onSet(on ? SUPPLEMENT_TIME_META[time].remind : null)} />
      {at && (
        <FieldLabel label={`${name} reminder time`}>
          <input type="time" value={at} onChange={(e) => e.target.value && onSet(e.target.value)} className={FIELD} />
        </FieldLabel>
      )}
    </div>
  );
}

/**
 * Supplements on Fitness (2026-11-07): hidden until the person switches on Track supplements (the consent, off by default), then their own
 * list by part of the day, each with today's tick and the last seven days for a doctor's visit. Adding is a Fold with `adds`; changing a
 * row opens in place; Remove asks first and offers Pause instead. Show on Daily and the reminders are off until switched on. The app never
 * suggests one, never checks an amount or a mix, and nothing here pays.
 */
export function SupplementsSection() {
  const qc = useQueryClient();
  const today = todayLocal();
  const q = useAuthed(['supplements', today], () => api.supplements(today));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [clearAll, setClearAll] = useState(false);
  const { copy, said } = useCopy();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['supplements'] }), qc.invalidateQueries({ queryKey: ['supplements-today'] })]);
  const settings = useMutation({ mutationFn: (body: Partial<SupplementSettings>) => api.supplementSettings(body), onSuccess: refresh });
  const tick = useMutation({ mutationFn: (v: { id: string; taken: boolean }) => api.tickSupplement(v.id, today, v.taken), onSuccess: refresh });
  const group = useMutation({ mutationFn: (t: SupplementTime) => api.tickSupplementGroup(today, t), onSuccess: refresh });
  const edit = useMutation({ mutationFn: (v: { id: string; paused?: boolean }) => api.editSupplement(v.id, { paused: v.paused }), onSuccess: refresh });
  const move = useMutation({ mutationFn: (v: { id: string; dir: 'up' | 'down' }) => api.moveSupplement(v.id, v.dir), onSuccess: refresh });
  // A removed row takes the keyboard's place with it, so it moves to the section's heading.
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSupplement(id),
    onSuccess: () => {
      focusHeadingAfter('supplements');
      return refresh();
    },
  });
  const removeAll = useMutation({
    mutationFn: () => api.deleteAllSupplements(),
    onSuccess: () => {
      setClearAll(false);
      focusHeadingAfter('supplements');
      return refresh();
    },
  });
  // The form in a row closes (saved, Cancel or Escape): back to that row's menu, the control that opened it.
  const closeEdit = (id: string) => {
    setEditing(null);
    requestAnimationFrame(() => document.getElementById(`supp-${id}`)?.querySelector<HTMLElement>('[aria-haspopup="dialog"]')?.focus({ preventScroll: true }));
  };

  const d = q.data;
  const on = d?.settings.on ?? false;
  const items = d?.items ?? [];
  const full = items.length >= MAX_SUPPLEMENTS;

  return (
    <Section
      id="supplements"
      title="Supplements"
      lede={on ? 'Your own list. Tick what you took today.' : 'Keep your own list, if you take any.'}
      action={
        on && items.length > 0 ? (
          <MoreMenu
            label="More for your supplement list"
            items={[
              { key: 'copy', label: 'Copy my list', icon: Copy, hint: 'Name, amount and when, to show a doctor or pharmacist.', onSelect: () => void copy(supplementListText(items, weekdaysLabel)) },
              { key: 'clear', label: 'Remove the whole list', icon: Trash2, destructive: true, onSelect: () => setClearAll(true) },
            ]}
          />
        ) : undefined
      }
    >
      {q.isPending && <SkeletonList count={1} lines={2} label="Loading your supplements" />}
      {d && (
        // The tinted panel holds the list; while tracking is off it would hold only the switch's own card, a box in a box, so the switch
        // then stands alone (the spacing pass, 2026-11-07).
        <div data-pillar="self" className={on ? 'grid gap-md rounded-card p-md' : 'grid gap-md'} style={on ? { background: 'var(--tint-sky)' } : undefined}>
          <Toggle on={on} label="Track supplements" hint={SUPPLEMENT_PRIVATE_LINE} disabled={settings.isPending} onChange={(v) => settings.mutate({ on: v })} />
          {said && (
            <p role="status" className="m-0 text-caption text-ink-soft">
              {said}
            </p>
          )}
          <ErrorLine e={settings.error ?? tick.error ?? group.error ?? edit.error ?? move.error} />
          {on && (
            <>
              {items.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing on your list yet. Add the ones you already take.</p>}
              {SUPPLEMENT_TIMES.map((t) => {
                const rows = items.filter((s) => s.time === t);
                if (!rows.length) return null;
                const open = rows.filter((s) => s.dueToday && !s.takenToday).length;
                return (
                  <div key={t}>
                    <div className="flex flex-wrap items-center justify-between gap-xs">
                      <h3 className="m-0 inline-flex items-center gap-xs text-headline">
                        <AppIcon name={SUPPLEMENT_TIME_META[t].icon} size={18} />
                        {SUPPLEMENT_TIME_META[t].name}
                      </h3>
                      {open > 0 && (
                        <button type="button" disabled={group.isPending} onClick={() => group.mutate(t)} className="inline-flex min-h-[44px] items-center text-caption font-semibold underline underline-offset-4 hover:text-ink">
                          Mark all taken
                        </button>
                      )}
                    </div>
                    <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                      {rows.map((s) => {
                        const i = items.indexOf(s);
                        // Beside a tick row the menu is a full-height side tile, the look of the edit tile on Daily's task rows.
                        const menu = (
                          <MoreMenu
                            label={`More for ${s.name}`}
                            trigger={
                              s.dueToday
                                ? (open) => (
                                    <button type="button" onClick={open} aria-label={`More for ${s.name}`} aria-haspopup="dialog" className="toy toy-soft flex w-[48px] shrink-0 items-center justify-center rounded-tile bg-card text-ink-soft hover:text-ink">
                                      <Icon icon={MoreHorizontal} size={20} />
                                    </button>
                                  )
                                : undefined
                            }
                            items={[
                              { key: 'edit', label: 'Change', icon: Pencil, onSelect: () => setEditing(s.id) },
                              { key: 'pause', label: s.paused ? 'Resume' : 'Pause', icon: s.paused ? Play : Pause, hint: s.paused ? undefined : 'Leaves Daily and the reminders. Keeps its history.', onSelect: () => edit.mutate({ id: s.id, paused: !s.paused }) },
                              ...(i > 0 ? [{ key: 'up', label: 'Move up', icon: ArrowUp, onSelect: () => move.mutate({ id: s.id, dir: 'up' as const }) }] : []),
                              ...(i < items.length - 1 ? [{ key: 'down', label: 'Move down', icon: ArrowDown, onSelect: () => move.mutate({ id: s.id, dir: 'down' as const }) }] : []),
                              { key: 'remove', label: 'Remove', icon: Trash2, destructive: true, hint: s.paused ? undefined : 'Pause keeps it instead', confirm: 'Tap again to remove it and its ticks', onSelect: () => (remove.reset(), remove.mutate(s.id)) },
                            ]}
                          />
                        );
                        // Each fact kept whole and ended with a comma, so a phone breaks only between facts (never inside "Omega-3"), on purpose.
                        const parts = [s.amount, SUPPLEMENT_KIND_META[s.kind].name, weekdaysLabel(s.days)].filter(Boolean);
                        const facts = parts.map((p, k) => (
                          <Fragment key={k}>
                            <span className="inline-block">{k < parts.length - 1 ? `${p},` : p}</span>{' '}
                          </Fragment>
                        ));
                        const week = <WeekDots days={s.week} color="var(--color-r5)" label={`Taken on ${s.takenDays} of the last ${s.dueDays || 7} days it was on your list`} />;
                        return (
                          <li key={s.id} id={`supp-${s.id}`}>
                            {editing === s.id ? (
                              <div className="rounded-tile bg-card p-sm shadow-toy-soft">
                                <SupplementForm
                                  initial={{ name: s.name, kind: s.kind, amount: s.amount, time: s.time, days: s.days }}
                                  saveLabel="Save the change"
                                  onSave={(body) => api.editSupplement(s.id, body)}
                                  onDone={() => {
                                    closeEdit(s.id);
                                    void refresh();
                                  }}
                                  onCancel={() => closeEdit(s.id)}
                                />
                              </div>
                            ) : s.dueToday ? (
                              <CheckRow
                                checked={s.takenToday}
                                busy={tick.isPending && tick.variables?.id === s.id}
                                onToggle={() => tick.mutate({ id: s.id, taken: !s.takenToday })}
                                title={s.name}
                                subtitle={facts}
                                marks={
                                  <span className="inline-flex items-center gap-xs text-caption text-ink-soft">
                                    {week}
                                    <span className="whitespace-nowrap">
                                      Taken on {s.takenDays} of {s.dueDays} {s.dueDays === 1 ? 'day' : 'days'}
                                    </span>
                                  </span>
                                }
                                aside={menu}
                              />
                            ) : (
                              <div className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                                <span className="min-w-0 flex-1">
                                  <span className={`block text-row-title ${s.paused ? 'text-ink-soft' : ''}`}>{s.name}</span>
                                  <span className="block text-card-note text-ink-soft">{facts}</span>
                                </span>
                                <StatusTag tone="neutral">{s.paused ? 'Paused' : 'Not today'}</StatusTag>
                                {menu}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              {full ? (
                <p className="m-0 text-caption text-ink-soft">Your list holds up to {MAX_SUPPLEMENTS}. Remove one to add another.</p>
              ) : (
                <Fold adds title="Add a supplement" open={adding} onOpenChange={setAdding}>
                  <div className="pt-sm">
                    <SupplementForm key={adding ? 'open' : 'shut'} initial={NEW} saveLabel="Add it" onSave={(body) => api.addSupplement(body)} onDone={() => (setAdding(false), void refresh())} />
                  </div>
                </Fold>
              )}
              <Fold title="Before you add one">
                <ul className="m-0 grid list-disc gap-xs pl-md pt-sm text-subhead">
                  {SUPPLEMENT_BEFORE.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Fold>
              {items.length > 0 && (
                <>
                  <Toggle on={d.settings.daily} label="Show on Daily" hint="Today's list as a fold on Daily. Nothing else changes there." disabled={settings.isPending} onChange={(v) => settings.mutate({ daily: v })} />
                  <Fold title="Reminders" hint={Object.keys(d.settings.remind).length ? `${Object.keys(d.settings.remind).length} on` : 'Off'}>
                    <div className="grid gap-sm pt-sm">
                      <p className="m-0 text-caption text-ink-soft">One inbox note at that time, only on a day something there is not marked.</p>
                      {SUPPLEMENT_TIMES.filter((t) => items.some((s) => s.time === t)).map((t) => (
                        <ReminderRow key={t} time={t} at={d.settings.remind[t]} onSet={(v) => settings.mutate({ remind: { [t]: v } as SupplementSettings['remind'] })} />
                      ))}
                    </div>
                  </Fold>
                </>
              )}
              {items.length > 0 && <Caution />}
              <p className="m-0 text-caption text-ink-soft">Switching it off hides the list and stops its reminders. Nothing is deleted until you remove it.</p>
            </>
          )}
        </div>
      )}

      {remove.isError && <ErrorLine e={remove.error} className="mt-xs" />}
      <ConfirmDelete
        open={clearAll}
        title="Remove your whole list?"
        body="Every supplement and every day you ticked one. This cannot be undone. You can switch Track supplements off instead and keep the list."
        pending={removeAll.isPending}
        failed={removeAll.isError}
        yes="Yes, remove all of it"
        onYes={() => removeAll.mutate()}
        onClose={() => {
          setClearAll(false);
          removeAll.reset();
        }}
      />
    </Section>
  );
}
