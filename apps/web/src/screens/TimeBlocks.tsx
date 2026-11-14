import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tbClass, tbStyle } from '../lib/blockColor';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Star, Trash2 } from 'lucide-react';
import {
  DAY_TEMPLATE_NAME_MAX,
  MAX_DAY_TEMPLATES,
  MAX_TIME_BLOCKS,
  mondayOf,
  periodFor,
  periodLabel,
  periodShift,
  templateColor,
  weekDates,
  weekdayOf,
  type DayTemplate,
  type ResolvedDay,
  type TimeBlock,
  type TimeBlocksResponse,
} from '@kreators/shared';
import { Screen } from '../components/Screen';
import { AppCover } from '../components/AppCover';
import { Section } from '../components/Section';
import { Button } from '../components/Button';
import { Fold } from '../components/Fold';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { StatusTag } from '../components/StatusTag';
import { CheckRow } from '../components/CheckRow';
import { Segmented } from '../components/fx/Segmented';
import { SortableList } from '../components/SortableList';
import { STICKY_CLOSE_LANE, StickyClose, useTallOpen } from '../components/StickyClose';
import { ToggleChevron } from '../components/ToggleMark';
import { HowItWorks } from '../components/HowTo';
import { Skeleton } from '../components/Skeleton';
import { ErrorLine } from '../components/ErrorLine';
import { TapTwiceIcon } from '../components/TapTwiceIcon';
import { useTapTwice } from '../lib/useTapTwice';
import { BlockEditor, type BlockDraft } from '../components/timeblocks/BlockEditor';
import { TemplateEditor, type TemplateDraft } from '../components/timeblocks/TemplateEditor';
import { AreaTag, DayStrip, DayTimeline, PillarTag, SourceText, useTimeBlocksRefresh } from '../components/timeblocks/parts';
import { api } from '../lib/api';
import { useTimeBlocks } from '../lib/useTimeBlocks';
import { useSession } from '../lib/store';
import { KindsSlot } from '../components/EmergenceSlot';
import { useParamState } from '../lib/useParamState';
import { dayLabel, shortDay, todayLocal, weekday } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { FIELD, LABEL, SELECT_SM } from '../lib/ui';
import { evenGrid, evenTile } from '../lib/bento';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// The week's days: stacked on a phone, four columns on a tablet (three days, then four, in even rows: lib/bento.ts), the whole week on a laptop.
const WEEK_COLS = { base: 1, md: 4, lg: 7 } as const;
const APPLY_COLS = { base: 1, sm: 2 } as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "Shoot day and Plan and post day", "Edit, Shoot and Post". */
const andList = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** What Bring back the starting set did, in words, and plainly which ones did not fit under the most you can keep, and why. */
function restoreLine(added: { blocks: number; templates: number; leftOut?: { blocks: string[]; templates: string[] } }): string {
  const out = [...(added.leftOut?.templates ?? []), ...(added.leftOut?.blocks ?? [])];
  const head = added.blocks + added.templates === 0 ? (out.length ? 'Nothing came back.' : 'Nothing was missing from the starting set.') : `Brought back ${plural(added.blocks, 'block')} and ${plural(added.templates, 'template')}.`;
  if (out.length === 0) return head;
  return `${head} ${andList(out)} did not fit: you can keep up to ${MAX_TIME_BLOCKS} blocks and ${MAX_DAY_TEMPLATES} templates. Delete one to make room.`;
}
/** A name the person does not have yet: "My day", then "My day 2" and on. */
function freeName(base: string, taken: readonly string[]): string {
  const have = new Set(taken.map((t) => t.trim().toLowerCase()));
  const root = base.slice(0, DAY_TEMPLATE_NAME_MAX - 3);
  if (!have.has(root.toLowerCase())) return root;
  for (let i = 2; i < 100; i++) if (!have.has(`${root} ${i}`.toLowerCase())) return `${root} ${i}`;
  return root;
}
type Doomed = { kind: 'block' | 'template'; id: string };

/**
 * Time blocks (2026-11-06, the founder's ask; docs/time-blocks.md): a page inside the app, not an app of its own. The week first, its days
 * clickable to show that day's blocks on the clock and its kind of day (a day template); then the person's usual week, their day
 * templates (each edited in place), and their blocks (a name, a tag, a colour from the swatches, an area and a pillar). Owner only and
 * core like Daily; every write goes through /time-blocks and refreshes Daily, Plan my week and the old kind of day.
 */
export function TimeBlocks() {
  const today = todayLocal();
  const [weekRaw, setWeek] = useParamState('week', '');
  const [dayRaw, setDay] = useParamState('day', '');
  const monday = DAY_RE.test(weekRaw) ? mondayOf(weekRaw) : mondayOf(today);
  const dates = weekDates(monday);
  const picked = dates.includes(dayRaw) ? dayRaw : dates.includes(today) ? today : monday;
  const q = useTimeBlocks(monday);

  const page = (by: number) => {
    const next = periodShift(periodFor('week', monday), by).start;
    setWeek(next === mondayOf(today) ? '' : next);
    setDay(weekDates(next)[weekdayOf(picked) - 1] ?? next);
  };

  return (
    <Screen howTo={false}>
      <AppCover back={{ to: '/today', label: 'Daily' }} cover="today" title="Time blocks" lede="Shape each day, then let tasks fall into place." />
      {q.isLoading || !q.data ? (
        q.error ? (
          <ErrorLine e={q.error} className="mt-lg" />
        ) : (
          <div className="mt-lg grid gap-sm" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-[96px]" />
            <Skeleton className="h-[240px]" />
            <Skeleton className="h-[96px]" />
          </div>
        )
      ) : (
        <Loaded data={q.data} stale={q.isPlaceholderData} today={today} picked={picked} onPick={setDay} onPage={page} />
      )}
      <KindsSlot here />
      <HowItWorks page={{ key: 'timeBlocks', name: 'Time blocks' }} />
    </Screen>
  );
}

/** What is open for editing: one at a time, so only one solid button (Apply, a Save or Add the block) is ever on screen. */
type Editing = 'apply' | 'add' | `tpl:${string}` | `block:${string}` | null;

function Loaded({
  data,
  stale,
  today,
  picked,
  onPick,
  onPage,
}: {
  data: TimeBlocksResponse;
  /** True while the week on screen is still the last one and the picked week is loading: nothing that writes a date is offered. */
  stale: boolean;
  today: string;
  picked: string;
  onPick: (d: string) => void;
  onPage: (by: number) => void;
}) {
  const refresh = useTimeBlocksRefresh();
  const blocks = useMemo(() => new Map(data.blocks.map((b) => [b.id, b])), [data.blocks]);
  const templates = useMemo(() => new Map(data.templates.map((t) => [t.id, t])), [data.templates]);
  const fallback = templates.get(data.defaultTemplateId) ?? data.templates[0];
  const tplOf = (id: string) => templates.get(id) ?? fallback;
  // A kind of day's colour, the one rule (`templateColor`: its own, else its longest block's).
  const colorOf = (t: DayTemplate | undefined) => (t ? templateColor(t, data.blocks) : null);
  const day = data.days.find((d) => d.date === picked) ?? data.days[0]!;
  const [editing, setEditing] = useState<Editing>(null);
  const openTpl = editing?.startsWith('tpl:') ? editing.slice(4) : null;
  const openBlock = editing?.startsWith('block:') ? editing.slice(6) : null;
  const setOpenTpl = (id: string | null) => setEditing(id ? `tpl:${id}` : null);
  const setOpenBlock = (id: string | null) => setEditing(id ? `block:${id}` : null);
  const [arranging, setArranging] = useState(false);
  const [note, setNote] = useState('');
  // A template opened from elsewhere on the page (Edit, New template, Copy, Save as new) is scrolled to once its card is drawn: a new
  // one only arrives with the refetch after the write, so the scroll waits for it instead of running in the next frame.
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(`tpl-${scrollTo}`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    // The keyboard's place goes with the page, to the card's own toggle, so Tab carries on into the form it opened.
    el.querySelector('button')?.focus({ preventScroll: true });
    setScrollTo(null);
  }, [scrollTo, data.templates]);
  // A save folds the form the focused button sits in, so focus goes back to the row's toggle that opened it.
  const backToToggle = (panel: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-controls="${panel}"]`)?.focus({ preventScroll: true }));

  const openTemplate = (id: string) => {
    setOpenTpl(id);
    setScrollTo(id);
  };

  // ---- writes (each refreshes everything that reads blocks) ----
  const saveDay = useMutation({ mutationFn: (v: { dates: string[]; id: string | null }) => api.setDayTemplates(v.dates, v.id), onSuccess: refresh });
  const savePattern = useMutation({ mutationFn: (v: { weekdays: number[]; id: string | null }) => api.setWeekPattern(v.weekdays, v.id), onSuccess: refresh });
  const makeDefault = useMutation({ mutationFn: (id: string) => api.updateDayTemplate(id, { isDefault: true }), onSuccess: refresh });
  const saveTpl = useMutation({
    mutationFn: (v: { id: string; d: TemplateDraft }) => api.updateDayTemplate(v.id, v.d),
    onSuccess: (r, v) => {
      refresh();
      setOpenTpl(null);
      setNote(`Saved ${r.template.name}.`);
      backToToggle(`tpl-body-${v.id}`);
    },
  });
  const newTpl = useMutation({
    mutationFn: (body: Parameters<typeof api.createDayTemplate>[0]) => api.createDayTemplate(body),
    onSuccess: (r) => {
      refresh();
      setNote(`Made ${r.template.name}.`);
      openTemplate(r.template.id);
    },
  });
  const addBlock = useMutation({
    mutationFn: (d: BlockDraft) => api.createTimeBlock(d),
    onSuccess: (r) => {
      refresh();
      setEditing(null);
      setNote(`Added ${r.block.name}.`);
    },
  });
  const saveBlock = useMutation({
    mutationFn: (v: { id: string; d: BlockDraft }) => api.updateTimeBlock(v.id, v.d),
    onSuccess: (r, v) => {
      refresh();
      setOpenBlock(null);
      setNote(`Saved ${r.block.name}.`);
      backToToggle(`blk-${v.id}`);
    },
  });
  const order = useMutation({ mutationFn: (ids: string[]) => api.orderTimeBlocks(ids), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: async (c: Doomed): Promise<void> => {
      if (c.kind === 'block') await api.deleteTimeBlock(c.id);
      else await api.deleteDayTemplate(c.id);
    },
    onSuccess: (_r, c) => {
      refresh();
      if (c.kind === 'block') setOpenBlock(null);
      else setOpenTpl(null);
      setNote(c.kind === 'block' ? 'Block deleted.' : 'Template deleted.');
      // Its row goes with it, so the keyboard's place moves to the list's heading.
      focusHeadingAfter(c.kind === 'block' ? 'tb-blocks' : 'tb-templates');
    },
  });
  const restore = useMutation({
    mutationFn: () => api.restoreTimeBlocks(),
    onSuccess: (r) => {
      refresh();
      setNote(restoreLine(r.added));
    },
  });

  const names = data.templates.map((t) => t.name);
  const weekNames = data.days.map((d) => weekday(d.date, 'long'));
  const weekTemplate = (d: ResolvedDay) => tplOf(data.pattern[d.weekday - 1] ?? data.defaultTemplateId);

  // A saved template or block is a small, recoverable remove (tasks keep their place, and "Bring back the starting set" restores a
  // starting one): a second tap in its menu, never a popup (the founder, 2026-11-13).
  const deleteTemplate = (t: DayTemplate) => {
    remove.reset();
    remove.mutate({ kind: 'template', id: t.id });
  };
  const blockAsk = useTapTwice<string>();
  // What deleting a template changes, as its menu item's hint: the weekdays set to it go back to the default.
  const templateLoss = (t: DayTemplate) => {
    const weekNamesShort = data.days.map((d) => weekday(d.date, 'long'));
    const weekdays = data.pattern.map((id, i) => (id === t.id ? weekNamesShort[i] : null)).filter((x): x is string => Boolean(x));
    return weekdays.length ? `${weekdays.join(', ')} go back to your default` : 'Its days go back to your week';
  };
  // What deleting a block changes, on the control itself (review 2026-11-13: the sheet that said it went with the second tap): tasks keep,
  // they lose the block, and the templates that use it lose its slots.
  const blockLoss = (b: TimeBlock) => {
    const n = data.templates.filter((t) => t.slots.some((s) => s.blockId === b.id)).length;
    return `Delete ${b.name}. Tasks lose this block${n ? `, and ${n === 1 ? '1 template loses' : `${n} templates lose`} its slots` : ''}.`;
  };
  const deleteBlock = (b: TimeBlock) => {
    remove.reset();
    remove.mutate({ kind: 'block', id: b.id });
  };
  const tplMenu = (t: DayTemplate): MoreMenuItem[] => [
    ...(t.isDefault ? [] : [{ key: 'default', label: 'Make it the default', icon: Star, onSelect: () => makeDefault.mutate(t.id) }]),
    {
      key: 'copy',
      label: 'Copy',
      icon: Copy,
      disabled: data.templates.length >= MAX_DAY_TEMPLATES,
      onSelect: () => newTpl.mutate({ name: freeName(`${t.name} copy`, names), fromId: t.id }),
    },
    { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, disabled: t.isDefault, hint: t.isDefault ? 'Make another the default first' : templateLoss(t), confirm: `Tap again to delete ${t.name}`, onSelect: () => deleteTemplate(t) },
  ];

  const dayTpl = tplOf(day.templateId);
  const ordered = [...data.blocks].sort((a, b) => a.sort - b.sort);
  const arrange = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length) return;
    const ids = ordered.map((b) => b.id);
    const [moved] = ids.splice(from, 1);
    if (moved) ids.splice(to, 0, moved);
    order.mutate(ids);
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {note}
      </p>

      <ThisMonth today={today} />

      <Section
        id="tb-week"
        title="This week"
        lede={periodLabel(periodFor('week', data.week))}
        tools={
          <div className="flex items-center gap-xs">
            <IconButton icon={ChevronLeft} label="The week before" tip="tr" onClick={() => onPage(-1)} />
            <IconButton icon={ChevronRight} label="The week after" tip="br" onClick={() => onPage(1)} />
          </div>
        }
      >
        <ul className={`m-0 grid list-none gap-xs p-0 ${evenGrid(data.days.length, WEEK_COLS)}`} aria-busy={stale || undefined}>
          {data.days.map((d, i) => {
            const t = tplOf(d.templateId);
            const isToday = d.date === today;
            return (
              <li key={d.date} className={`flex ${evenTile(i, data.days.length, WEEK_COLS)}`}>
                <button
                  type="button"
                  aria-pressed={d.date === picked}
                  disabled={stale}
                  onClick={() => onPick(d.date)}
                  className={`toy toy-soft flex min-h-[56px] w-full items-center justify-between gap-sm rounded-tile bg-card px-sm py-xs text-left aria-pressed:bg-line md:flex-col md:items-start md:justify-start ${isToday ? 'ring-2 ring-ink/40' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block text-headline">
                      {weekday(d.date)} <span className="whitespace-nowrap">{shortDay(d.date)}</span>
                    </span>
                    {isToday && <span className="block text-caption text-ink-soft">Today</span>}
                  </span>
                  <span className="flex min-w-0 flex-col items-end gap-xs md:items-start">
                    <span className={`flex max-w-full items-center gap-xs text-footnote text-ink-soft ${tbClass(colorOf(t))}`} style={tbStyle(colorOf(t))}>
                      {colorOf(t) && <span className="tb-dot shrink-0" aria-hidden="true" />}
                      <span className="min-w-0 break-words">{t?.name}</span>
                    </span>
                    {d.from === 'date' && <StatusTag tone="calm">Changed</StatusTag>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {dayTpl && (
          <div className={`mt-sm rounded-card bg-card p-md shadow-toy-soft ${stale ? 'opacity-60' : ''}`} aria-busy={stale || undefined}>
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <div className="min-w-0">
                <h3 className="text-title3">{dayLabel(day.date)}</h3>
                <p className="mt-[2px] m-0 text-subhead text-ink-soft">
                  {dayTpl.name}
                  {day.from === 'date' ? ', for this date only' : day.from === 'week' ? ', from your week' : ', your default'}
                </p>
              </div>
              <PillarTag pillar={dayTpl.lead} lead="Leads with " />
            </div>
            <div className="mt-sm">
              <DayStrip slots={dayTpl.slots} blocks={blocks} />
            </div>
            <div className="mt-sm">
              <DayTimeline slots={dayTpl.slots} blocks={blocks} />
            </div>
            {/* The select on the left and "Edit <template>" at the right end of the same row, bottom-aligned (the founder, 2026-11-06);
                the button keeps its own outline look. The row wraps: where a long template name leaves the select under 220px,
                the button drops under it, still at the right (`ml-auto`), so the select is never squeezed and nothing passes the card. */}
            <div className="mt-md flex flex-wrap items-end justify-between gap-sm">
              <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-xs sm:flex-row sm:items-center">
                <span className={`flex shrink-0 items-center gap-xs text-subhead text-ink-soft ${tbClass(colorOf(dayTpl))}`} style={tbStyle(colorOf(dayTpl))}>
                  {colorOf(dayTpl) && <span className="tb-dot" aria-hidden="true" />}
                  Kind of day
                </span>
                <select
                  className={`${SELECT_SM} min-w-0 sm:flex-1`}
                  value={day.from === 'date' ? day.templateId : ''}
                  disabled={saveDay.isPending || stale}
                  onChange={(e) => saveDay.mutate({ dates: [day.date], id: e.target.value || null })}
                >
                  <option value="">Follow your week ({weekTemplate(day)?.name})</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => openTemplate(dayTpl.id)}>
                Edit {dayTpl.name}
              </Button>
            </div>
            {saveDay.error ? <ErrorLine e={saveDay.error} className="mt-xs" /> : null}
            <ApplyFold
              key={`${day.date}:${dayTpl.id}`}
              data={data}
              day={day}
              templateId={dayTpl.id}
              stale={stale}
              open={editing === 'apply'}
              onOpenChange={(o) => setEditing(o ? 'apply' : null)}
              onDone={(n) => setNote(n)}
            />
          </div>
        )}
      </Section>

      <Section id="tb-usual" title="Your usual week" lede="Each weekday’s template. A change to one date leaves it alone.">
        {/* The hint may wrap (Fold keeps a hint on one line), so a long template name never runs off the card on a narrow phone. */}
        <Fold title="Set each weekday" hint={fallback ? <span className="whitespace-normal break-words">Default: {fallback.name}</span> : undefined}>
          <div className="flex flex-col gap-xs">
            <label className="flex flex-wrap items-center justify-between gap-xs rounded-tile bg-card px-sm py-xs">
              <span className="text-headline">Default for every day</span>
              <select
                className={`${SELECT_SM} min-w-0 flex-1 sm:w-[240px] sm:flex-none`}
                value={data.defaultTemplateId}
                disabled={makeDefault.isPending}
                onChange={(e) => makeDefault.mutate(e.target.value, { onSuccess: () => setNote('Saved the default.') })}
              >
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {weekNames.map((name, i) => (
              <label key={name} className="flex flex-wrap items-center justify-between gap-xs rounded-tile bg-card px-sm py-xs">
                <span className="text-body">{name}</span>
                <select
                  className={`${SELECT_SM} min-w-0 flex-1 sm:w-[240px] sm:flex-none`}
                  value={data.pattern[i] && templates.has(data.pattern[i]!) ? data.pattern[i]! : ''}
                  disabled={savePattern.isPending}
                  onChange={(e) => savePattern.mutate({ weekdays: [i + 1], id: e.target.value || null }, { onSuccess: () => setNote(`Saved ${name}.`) })}
                >
                  <option value="">Default ({fallback?.name})</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {savePattern.error || makeDefault.error ? <ErrorLine e={savePattern.error ?? makeDefault.error} /> : null}
            {(savePattern.isSuccess || makeDefault.isSuccess) && (
              <p className="m-0 text-caption text-ink-soft" aria-live="polite">
                Saved.
              </p>
            )}
          </div>
        </Fold>
      </Section>

      <Section
        id="tb-templates"
        title="Day templates"
        lede="A kind of day: its blocks on the clock and the pillar that leads. The starting ones are yours to change."
        tools={
          <Button
            variant="outline"
            size="sm"
            disabled={newTpl.isPending || data.templates.length >= MAX_DAY_TEMPLATES}
            onClick={() => newTpl.mutate({ name: freeName('My day', names), fromId: dayTpl?.id })}
          >
            New template
          </Button>
        }
      >
        {newTpl.error ? <ErrorLine e={newTpl.error} className="mb-xs" /> : null}
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {data.templates.map((t) => {
            const open = openTpl === t.id;
            return (
              <TemplateCard key={t.id} template={t} color={colorOf(t)} blocks={blocks} open={open} onToggle={() => setOpenTpl(open ? null : t.id)} onClose={() => setOpenTpl(null)}>
                {(t.why || t.source) && (
                  <p className="m-0 mb-sm text-footnote text-ink-soft">
                    {t.why}
                    {t.source ? (
                      <span className="block text-caption text-ink-mute">
                        <SourceText text={t.source} />
                      </span>
                    ) : null}
                  </p>
                )}
                <TemplateEditor
                  template={t}
                  blocks={ordered}
                  pending={saveTpl.isPending || newTpl.isPending}
                  error={saveTpl.error ?? newTpl.error ?? makeDefault.error}
                  onSave={(d) => saveTpl.mutate({ id: t.id, d })}
                  onSaveAsNew={(d) => newTpl.mutate({ ...d, name: d.name.toLowerCase() === t.name.toLowerCase() ? freeName(`${d.name} copy`, names) : freeName(d.name, names) })}
                  menu={tplMenu(t)}
                />
              </TemplateCard>
            );
          })}
        </ul>
      </Section>

      <Section
        id="tb-blocks"
        title="Blocks"
        lede="The stretches a day is made of. Their area and pillar help suggest a block for a task."
        action={
          data.blocks.length > 1 ? (
            <Button variant="outline" size="sm" aria-pressed={arranging} onClick={() => setArranging((a) => !a)}>
              {arranging ? 'Done' : 'Arrange'}
            </Button>
          ) : undefined
        }
      >
        {arranging ? (
          <SortableList items={ordered} keyOf={(b) => b.id} onMove={arrange} className="fx-inset m-0 list-none p-0">
            {(b, i, handle) => <ArrangeRow block={b} index={i} count={ordered.length} handle={handle} onMove={arrange} />}
          </SortableList>
        ) : (
          <ul className="fx-inset m-0 list-none p-0">
            {ordered.map((b) => {
              const open = openBlock === b.id;
              return (
                <BlockRow key={b.id} block={b} open={open} onToggle={() => setOpenBlock(open ? null : b.id)} onClose={() => setOpenBlock(null)}>
                  <BlockEditor
                    block={b}
                    pending={saveBlock.isPending}
                    error={saveBlock.error}
                    onSave={(d) => saveBlock.mutate({ id: b.id, d })}
                    aside={
                      // One action, so one round button (as MoreMenu draws a lone item); it asks twice in place.
                      <TapTwiceIcon armed={blockAsk.isArmed(b.id)} onClick={() => blockAsk.tap(b.id, () => deleteBlock(b))} disabled={remove.isPending} label={blockLoss(b)} tip={blockLoss(b)} className="mf-round toy shrink-0 disabled:opacity-50">
                        <Icon icon={Trash2} size={20} />
                      </TapTwiceIcon>
                    }
                  />
                </BlockRow>
              );
            })}
          </ul>
        )}
        {order.error ? <ErrorLine e={order.error} className="mt-xs" /> : null}
        <div className="mt-sm">
          {data.blocks.length >= MAX_TIME_BLOCKS ? (
            <p className="m-0 text-subhead text-ink-soft">You have the most blocks you can keep ({MAX_TIME_BLOCKS}). Delete one to add another.</p>
          ) : (
            <Fold title="Add a block" adds open={editing === 'add'} onOpenChange={(o) => setEditing(o ? 'add' : null)}>
              <div className="rounded-card bg-card p-md shadow-toy-soft">
                <BlockEditor pending={addBlock.isPending} error={addBlock.error} onSave={(d) => addBlock.mutate(d)} saveLabel="Add the block" />
              </div>
            </Fold>
          )}
        </div>
      </Section>

      <div className="mt-lg flex flex-col items-start gap-xs">
        <Button variant="outline" disabled={restore.isPending} onClick={() => restore.mutate()}>
          Bring back the starting set
        </Button>
        <p className="m-0 text-caption text-ink-soft">Adds back any starting block or template you deleted. Yours stay as they are.</p>
        {restore.data && (
          <p className="m-0 text-subhead text-ink-soft" aria-live="polite">
            {restoreLine(restore.data.added)}
          </p>
        )}
        {restore.error ? <ErrorLine e={restore.error} /> : null}
      </div>

      {remove.error ? <ErrorLine e={remove.error} /> : null}
    </>
  );
}

/**
 * A day template's card: its name is the toggle, the pillars and the day's strip always sit under it, and the why, its book and the editor
 * (`children`) only once it is open. Open and taller than the room the window has, its close stays in view beside it (`StickyClose`,
 * 2026-11-14, the founder: "the close buttons that need one to scroll back top need the close button to be sticky outside the toggle
 * tab"): in the margin at the card's right where there is one, else down the card's own right edge, where the strip and the editor keep a
 * lane for it; the chevron keeps its slot unseen meanwhile, and Escape anywhere in the card closes it too. A short card is as it was.
 */
function TemplateCard({
  template: t,
  color,
  blocks,
  open,
  onToggle,
  onClose,
  children,
}: {
  template: DayTemplate;
  color: ReturnType<typeof templateColor>;
  blocks: ReadonlyMap<string, TimeBlock>;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLLIElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const railOn = useTallOpen(root, open);
  const bodyId = `tpl-body-${t.id}`;
  return (
    <li ref={root} id={`tpl-${t.id}`} data-sticky-close-root="" className="scroll-mt-xl rounded-card bg-card shadow-toy-soft">
      {/* The button holds only the name and the chevron, so its name is the template's; the tags (Default with the pillars)
          and the strip sit under it, and the why and its book only once the card is open. */}
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle} className="toy toy-flat flex min-h-[44px] w-full items-start justify-between gap-sm rounded-card px-md pt-md pb-xs text-left">
        <span className={`flex min-w-0 items-center gap-xs text-headline ${tbClass(color)}`} style={tbStyle(color)}>
          {color && <span className="tb-dot shrink-0" aria-hidden="true" />}
          <span className="min-w-0">{t.name}</span>
        </span>
        {/* While the sticky close shows, the chevron keeps its slot unseen, as a task card's edit button does. */}
        <ToggleChevron open={open} className={`shrink-0 text-ink-soft ${railOn ? 'invisible' : ''}`} />
      </button>
      {railOn && <StickyClose onClose={onClose} label={`Close ${t.name}`} opener={() => toggle.current} />}
      {/* The tags and the strip keep the lane too, so a close running down the card's edge never sits on a tag's words. */}
      <div className={`flex flex-col gap-xs px-md pb-md ${STICKY_CLOSE_LANE}`}>
        <span className="fill-row flex flex-wrap items-center gap-xs">
          <PillarTag pillar={t.lead} lead="Leads with " />
          {t.second && <PillarTag pillar={t.second} lead="Then " />}
          {t.isDefault && <StatusTag tone="info">Default</StatusTag>}
        </span>
        <DayStrip slots={t.slots} blocks={blocks} className="w-full" />
      </div>
      {open && (
        <div id={bodyId} className={`border-t border-line p-md ${STICKY_CLOSE_LANE}`}>
          {children}
        </div>
      )}
    </li>
  );
}

/**
 * A block's row in the list: its name, tag, area and pillar are the toggle, and the editor (`children`) opens under it. Open and taller
 * than the room the window has, its close stays in view down the row's right edge (`StickyClose`, 2026-11-14), the editor keeping a lane
 * for it and the chevron its slot unseen. The list (`.fx-inset`) clips its rows to its rounded corners with `overflow: hidden`, which also
 * makes it a scroll box, where a sticky close would never stick and a close in the margin would be cut off; while a row is open the list
 * clips with `overflow: clip` instead (the same corners, at rest and open alike, and no scroll box), so the close runs down the row's own
 * edge and sticks under the top bar.
 */
function BlockRow({ block: b, open, onToggle, onClose, children }: { block: TimeBlock; open: boolean; onToggle: () => void; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLLIElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const railOn = useTallOpen(root, open);
  // Set in the commit that opens the row, so the close measures the list as it will be when it mounts in the next one. Only one row is
  // open at a time, and a row that closes puts the list back before the next one opens (layout cleanups run before layout effects).
  useLayoutEffect(() => {
    const list = root.current?.parentElement;
    if (!open || !list) return;
    const was = list.style.overflow;
    list.style.overflow = 'clip';
    return () => {
      list.style.overflow = was;
    };
  }, [open]);
  return (
    <li ref={root} data-sticky-close-root="">
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={`blk-${b.id}`} onClick={onToggle} className={`fx-row ${tbClass(b.color)}`} style={tbStyle(b.color)}>
        <span className="flex size-[48px] shrink-0 items-center justify-center" aria-hidden="true">
          <span className="tb-dot" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline">{b.name}</span>
          <span className="mt-[2px] flex flex-wrap items-center gap-xs">
            {b.tag && <span className="text-footnote text-ink-soft">{b.tag}</span>}
            {b.area && <AreaTag area={b.area} />}
            {b.pillar && <PillarTag pillar={b.pillar} />}
          </span>
        </span>
        {/* While the sticky close shows, the chevron keeps its slot unseen, as a task card's edit button does. */}
        <ToggleChevron open={open} className={`text-ink-soft ${railOn ? 'invisible' : ''}`} />
      </button>
      {railOn && <StickyClose onClose={onClose} label={`Close ${b.name}`} opener={() => toggle.current} />}
      {open && (
        <div id={`blk-${b.id}`} className={`px-sm pb-md ${STICKY_CLOSE_LANE}`}>
          {children}
        </div>
      )}
    </li>
  );
}

/**
 * "Use it on more days": put a template on other weekdays, every week (the pattern) or only this week (those dates). It opens in place
 * under the day, starting with the picked day's template and weekday; nothing is written until Apply.
 */
function ApplyFold({
  data,
  day,
  templateId,
  stale,
  open,
  onOpenChange,
  onDone,
}: {
  data: TimeBlocksResponse;
  day: ResolvedDay;
  templateId: string;
  stale: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (note: string) => void;
}) {
  const refresh = useTimeBlocksRefresh();
  const [tpl, setTpl] = useState(templateId);
  const [weekdays, setWeekdays] = useState<number[]>([day.weekday]);
  const [scope, setScope] = useState<'week' | 'once'>('week');
  const name = data.templates.find((t) => t.id === tpl)?.name ?? 'it';
  const apply = useMutation({
    mutationFn: async (): Promise<void> => {
      if (scope === 'week') {
        await api.setWeekPattern(weekdays, tpl === data.defaultTemplateId ? null : tpl);
        return;
      }
      await api.setDayTemplates(
        data.days.filter((d) => weekdays.includes(d.weekday)).map((d) => d.date),
        tpl,
      );
    },
    onSuccess: () => {
      refresh();
      onDone(`${name} is on ${plural(weekdays.length, 'day')} ${scope === 'week' ? 'every week' : 'this week'}.`);
    },
  });
  const toggle = (w: number) => setWeekdays((list) => (list.includes(w) ? list.filter((x) => x !== w) : [...list, w].sort((a, b) => a - b)));
  return (
    <Fold title="Use it on more days" className="mt-sm" open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-sm">
        <label className="block">
          <span className={LABEL}>Template</span>
          <select className={FIELD} value={tpl} onChange={(e) => setTpl(e.target.value)}>
            {data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="How long"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'week', label: 'Every week' },
            { value: 'once', label: 'This week only' },
          ]}
        />
        <div className={`grid gap-xs ${evenGrid(data.days.length, APPLY_COLS)}`}>
          {data.days.map((d, i) => (
            <div key={d.weekday} className={evenTile(i, data.days.length, APPLY_COLS)}>
              <CheckRow checked={weekdays.includes(d.weekday)} onToggle={() => toggle(d.weekday)} title={weekday(d.date, 'long')} />
            </div>
          ))}
        </div>
        {apply.error ? <ErrorLine e={apply.error} /> : null}
        {apply.isSuccess && (
          <p className="m-0 text-caption text-ink-soft" aria-live="polite">
            Done. {name} is on {plural(weekdays.length, 'day')} {scope === 'week' ? 'every week' : 'this week'}.
          </p>
        )}
        <Button full disabled={apply.isPending || stale || weekdays.length === 0} onClick={() => apply.mutate()}>
          {apply.isPending ? 'Applying…' : `Apply to ${plural(weekdays.length, 'day')}`}
        </Button>
      </div>
    </Fold>
  );
}

/**
 * This month so far (2026-11-06): how many days of each kind from the 1st to today, each day the template set for it or given by your
 * week (`GET /time-blocks/month`, the shared `kindsOfDays`). Days on the default template have no kind and are not counted.
 */
function ThisMonth({ today }: { today: string }) {
  const token = useSession((s) => s.token);
  const q = useQuery({ queryKey: ['timeBlocks', 'month', today], queryFn: () => api.timeBlocksMonth(today), enabled: Boolean(token) });
  if (!q.data) return null;
  const { kinds } = q.data;
  return (
    <div className="mt-lg flex flex-wrap items-center gap-xs" role="group" aria-label="This month so far">
      <span className="mr-xs text-subhead font-semibold">This month</span>
      {kinds.length === 0 ? (
        <span className="text-subhead text-ink-soft">No kind of day yet. Pick one for a day below, or set your usual week.</span>
      ) : (
        <ul className="fill-row m-0 flex list-none flex-wrap gap-xs p-0">
          {kinds.map((k) => (
            <li key={k.templateId} className={`inline-flex min-h-[32px] items-center gap-xs rounded-pill bg-card px-sm text-footnote ${tbClass(k.color)}`} style={tbStyle(k.color)}>
              <span className="tb-dot" aria-hidden="true" />
              <span>
                {k.name}: <span className="tabular-nums font-semibold">{plural(k.days, 'day')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArrangeRow({ block, index, count, handle, onMove }: { block: TimeBlock; index: number; count: number; handle: ReactNode; onMove: (from: number, to: number) => void }) {
  const arrow = 'toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink disabled:opacity-40 disabled:pointer-events-none';
  return (
    <div className={`fx-row ${tbClass(block.color)} items-center gap-xs text-ink`} style={tbStyle(block.color)}>
      {handle}
      <span className="tb-dot" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-headline">{block.name}</span>
      <button type="button" aria-label={`Move ${block.name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)} className={arrow}>
        <Icon icon={ArrowUp} size={18} />
      </button>
      <button type="button" aria-label={`Move ${block.name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className={arrow}>
        <Icon icon={ArrowDown} size={18} />
      </button>
    </div>
  );
}
