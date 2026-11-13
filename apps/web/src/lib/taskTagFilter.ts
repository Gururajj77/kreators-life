import { createContext, useContext } from 'react';
import { LIFE_AREAS, RELATIONSHIP_BY_KEY, TASK_TAG_FLAGS, TASK_TAG_FLAG_WORDS, openTag, parseLifeArea, priorityTag, type TaskTagCut, type TemplateSlot } from '@kreators/shared';

/**
 * Tap a tag to filter the list (2026-11-13, the founder: "apply click for those tags and make filters from them"; he chose: filter this list).
 * A list that can be cut by its tags (Daily's Tasks, a pillar page's Tasks to do) puts one of these round its rows; a task row inside it
 * draws each tag that has a filter (a token `parseTaskTags` in shared reads, plus `area:<key>` for the Area filter) as a real button raised over the card's
 * stretched control, pressed while that filter is on. A row anywhere else (the month sheet, Hidden tasks, a coach's view, Emerging, Time
 * blocks) has no provider, so its tags stay the plain marks they always were.
 */
export interface TagFilter {
  /** Whether the filter a token names is on now. */
  on: (token: string) => boolean;
  /** Turns a tag's filter on, or off when it is on (`words` the tag's own words, for the status line). */
  toggle: (token: string, words: string) => void;
  /** The day's slots, so a task's time names the block it falls in (Daily); empty where there is no day plan (a pillar page). */
  slots: readonly TemplateSlot[];
  /** Whether the pillar tag filters (Daily: yes; a pillar's own page shows none). */
  pillar: boolean;
  /** Whether the time chip filters by the block it falls in (Daily only). */
  time: boolean;
}

export const TagFilterContext = createContext<TagFilter | null>(null);

/**
 * What a tag drawn as a filter button needs: its tap, whether it is pressed, and a name only where the words it shows are not the whole of it
 * (the time chip names its block). Its name is otherwise its own words, so a row's description still reads its tags ("Remember, Habit",
 * never "Filter: Remember"; review 2026-11-13), and what a tap does is its description (`TAG_FILTER_HINT_ID`) and its pressed state.
 */
export interface TagPress {
  onPress: () => void;
  pressed: boolean;
  label?: string;
}

/** The one hidden line every tag button points `aria-describedby` at, drawn once by the list that filters (`TagFilterHint`). */
export const TAG_FILTER_HINT_ID = 'tag-filter-hint';

/**
 * The tag-to-button maker for the list a row sits in, or null outside one. `press(token, words)` gives a tag's `TagPress`; `name` is the
 * button's whole name when the visible words are not the tag's (the time chip), else none, so its words name it.
 */
export function useTagFilter(): { filter: TagFilter; press: (token: string, words: string, name?: string) => TagPress } | null {
  const filter = useContext(TagFilterContext);
  if (!filter) return null;
  return {
    filter,
    press: (token, words, name) => ({ onPress: () => filter.toggle(token, words), pressed: filter.on(token), label: name }),
  };
}

/** One filter that is on, as a chip above the list: its token (`pillar:family`, `remember`, `area:physical` …) and its words. */
export interface TagChip {
  token: string;
  words: string;
}

/**
 * The chips for what is on, in the order the tags read on a row: the area (Daily's Area filter, '' for every area, 'none' for no area),
 * then the pillar, the priority, the flags, the kind of open business and the time block (`blockName` finds a block's name; one not found
 * reads "Time block").
 */
export function tagChips(cut: TaskTagCut, area: string, blockName: (id: string) => string | undefined): TagChip[] {
  const out: TagChip[] = [];
  const a = area === 'none' ? 'none' : parseLifeArea(area);
  if (a) out.push({ token: `area:${a}`, words: a === 'none' ? 'No area' : LIFE_AREAS[a].name });
  if (cut.pillar) out.push({ token: `pillar:${cut.pillar}`, words: RELATIONSHIP_BY_KEY[cut.pillar].name });
  if (cut.priority !== null) out.push({ token: `pri:${cut.priority}`, words: priorityTag(cut.priority) });
  for (const f of TASK_TAG_FLAGS) if (cut[f]) out.push({ token: f, words: TASK_TAG_FLAG_WORDS[f] });
  if (cut.kind) out.push({ token: `kind:${cut.kind}`, words: openTag(cut.kind) });
  if (cut.block) out.push({ token: `block:${cut.block}`, words: blockName(cut.block) ?? 'Time block' });
  return out;
}

/** What the status line says once the filters change: "Showing tasks tagged Family and Remember.", or that none is on. */
export function tagSentence(chips: readonly TagChip[]): string {
  if (chips.length === 0) return 'Filters cleared. Showing every task.';
  const words = chips.map((c) => c.words);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return `Showing tasks tagged ${list}.`;
}
