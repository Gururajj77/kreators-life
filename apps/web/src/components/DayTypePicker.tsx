import { RELATIONSHIP_BY_KEY, mondayOf, templateColor, weekdayOf, type DayFrom, type DayPlan, type DayTemplate, type TimeBlock, type TimeBlocksResponse } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { SELECT_SM } from '../lib/ui';
import { useTimeBlocksRefresh } from '../lib/timeBlocksRefresh';
import { tbClass, tbStyle } from '../lib/blockColor';

// The kind of day is a day template since 2026-11-06 (docs/time-blocks.md): one picker on Daily, the person's own templates (the old
// book kinds are starting templates they can change, copy or delete), and "Follow your week" for the template the weekly pattern gives.

/** The template a day uses, in the shape both answers share (`DayPlan.template`, a `DayTemplate`). */
export type DayTemplateFace = Pick<DayTemplate, 'id' | 'name' | 'lead' | 'second' | 'why' | 'source'>;

/**
 * The day template for `date` (the person's own day), read from the week's time blocks, and a setter that shows the change at once and
 * saves it as a change to that date only (`PUT /time-blocks/days`; null follows the week again). Until the week has loaded, `fallback`
 * (the day's plan on GET /today) stands in.
 */
export function useDayTemplate(date: string, fallback?: DayPlan) {
  const qc = useQueryClient();
  const refresh = useTimeBlocksRefresh();
  const monday = mondayOf(date);
  const key = ['timeBlocks', monday] as const;
  const q = useAuthed(key, () => api.timeBlocks(monday));
  const save = useMutation({
    mutationFn: (templateId: string | null) => api.setDayTemplates([date], templateId),
    onMutate: async (templateId) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<TimeBlocksResponse>(key);
      if (before) {
        const wd = weekdayOf(date);
        const exists = (id: string | null | undefined) => Boolean(id && before.templates.some((t) => t.id === id));
        const week = before.pattern[wd - 1];
        const next: { templateId: string; from: DayFrom } = templateId ? { templateId, from: 'date' } : exists(week) ? { templateId: week!, from: 'week' } : { templateId: before.defaultTemplateId, from: 'default' };
        qc.setQueryData<TimeBlocksResponse>(key, {
          ...before,
          days: before.days.map((d) => (d.date === date ? { ...d, ...next } : d)),
          overrides: [...before.overrides.filter((o) => o.date !== date), ...(templateId ? [{ date, templateId }] : [])],
        });
      }
      return { before };
    },
    onError: (_e, _k, ctx) => qc.setQueryData(key, ctx?.before),
    // The server picks which tasks Daily shows by the day's template, so a P0 is never left out; read again everything a day's kind
    // feeds (the day, the week, the month calendar, Your kinds of day and the Reviews tile), the same set as any time-blocks write.
    onSettled: refresh,
  });
  const data = q.data;
  const templates = data?.templates ?? [];
  const byId = (id: string | null | undefined) => (id ? (templates.find((t) => t.id === id) ?? null) : null);
  const resolved = data?.days.find((d) => d.date === date) ?? null;
  const week = data?.pattern[weekdayOf(date) - 1];
  const follow = byId(week) ?? byId(data?.defaultTemplateId);
  const template: DayTemplateFace | null = resolved ? byId(resolved.templateId) : (fallback?.template ?? null);
  const from: DayFrom | null = resolved?.from ?? fallback?.from ?? null;
  // By context leads the order when the day was changed on purpose: a date change, or a weekday whose template is not the default (the
  // server's own rule on GET /today), so a plain day still sorts by the day. Until the week loads, the server's own answer stands in, so
  // the six it picked are not shown by day first and then re-sorted under the reader.
  const contextual = resolved && data ? resolved.from === 'date' || (resolved.from === 'week' && resolved.templateId !== data.defaultTemplateId) : (fallback?.contextual ?? from === 'date');
  return {
    loaded: Boolean(data),
    templates,
    /** The week's blocks, for a template's colour through `templateColor`. */
    blocks: data?.blocks ?? [],
    template,
    from,
    /** The template picked for this date alone, or '' when it follows the week. */
    picked: resolved?.from === 'date' ? resolved.templateId : '',
    follow,
    contextual,
    set: (id: string | null) => save.mutate(id),
    failed: save.isError,
  };
}

/**
 * "Kind of day" on Daily: one dropdown of the person's day templates, "Follow your week" first (the template the weekly pattern or the
 * default gives this weekday). Picking one changes this date only.
 */
export function DayTemplateSelect({ templates, blocks, picked, follow, onPick }: { templates: readonly DayTemplate[]; blocks: readonly TimeBlock[]; picked: string; follow: DayTemplate | null; onPick: (id: string | null) => void }) {
  const id = useId();
  // The kind's colour as a small dot beside the label, by the one rule (`templateColor`: its own colour, else its longest block's), so
  // Daily agrees with the Time blocks page, the month calendar, Emerging and Reviews; with neither, no dot.
  const t = picked ? templates.find((x) => x.id === picked) : follow;
  const shown = t ? templateColor(t, blocks) : null;
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-xs">
      <label htmlFor={id} className={`flex shrink-0 items-center gap-xs text-subhead text-ink-soft ${tbClass(shown)}`} style={tbStyle(shown)}>
        {shown && <span className="tb-dot" aria-hidden="true" />}
        Kind of day
      </label>
      <select id={id} value={picked} onChange={(e) => onPick(e.target.value || null)} disabled={templates.length === 0} className={`${SELECT_SM} min-w-0 flex-1`}>
        <option value="">{follow ? `Follow your week (${follow.name})` : 'Follow your week'}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A source line with each page or page range kept whole ("p. 168", "197–198"), so a line never breaks inside one ("197–" over "198").
 * The words themselves are unchanged: only nowrap spans around the numbers.
 */
function wholeRanges(source: string) {
  return source.split(/(p\. \d+(?:–\d+)?|\d+–\d+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** The quiet line under the day and sort controls: why the order is what it is, the template's line and where it comes from, and the way to the Time blocks page. */
export function DayTypeNote({ template, contextual, failed, ownSort }: { template: DayTemplateFace | null; contextual: boolean; failed?: boolean; ownSort: string | null }) {
  const lead = template ? RELATIONSHIP_BY_KEY[template.lead] : null;
  const why = template?.why ? ` ${template.why}` : '';
  const text = !template || !lead ? '' : ownSort ? `Sorted by ${ownSort}, as you chose. Pick By context to put the ${lead.name} pillar first.` : contextual ? `${template.name}: sorted by context. P0 stays on top.${why}` : `${template.name}.${why}`;
  return (
    <>
      {/* The line on the left and "Edit kind of day" at its bottom right, level with the row's right edge (the founder, 2026-11-06); the
          link's 44px tap area is its ::after, so it adds no height to the line. */}
      {text && (
        <div className="mt-xs flex flex-wrap items-end justify-between gap-x-sm">
          <p className="m-0 min-w-0 flex-[1_1_240px] text-caption text-ink-soft" aria-live="polite">
            {text}
            {template?.source ? <span className="text-ink-mute"> Source: {wholeRanges(template.source)}.</span> : null}
          </p>
          <Link to="/time-blocks" className="relative ml-auto whitespace-nowrap text-caption font-semibold text-ink underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']">
            Edit kind of day
          </Link>
        </div>
      )}
      {failed && (
        <p className="mt-xs m-0 text-caption text-ink-soft" role="alert">
          Could not save that. Try again.
        </p>
      )}
    </>
  );
}
