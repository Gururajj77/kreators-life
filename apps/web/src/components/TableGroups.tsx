import { MODULE_GROUP_ACCENT, MODULE_GROUP_ORDER, RELATIONSHIP_BY_KEY, type ModuleGroup } from '@kreators/shared';
import { andList, type TableListGroup } from '@kreators/shared/dataTables';
import { useId, type ReactNode } from 'react';
import { useKept } from '../lib/kept';
import { useMe } from '../lib/queries';
import { GroupAccordion } from './GroupAccordion';
import { Phrases } from './Phrases';

/** A list's categories under the app group each is drawn in, in MODULE_GROUP_ORDER; an app group with no category to show goes. */
export function byAppGroup(groups: readonly TableListGroup[]): { group: ModuleGroup; categories: TableListGroup[] }[] {
  return MODULE_GROUP_ORDER.map((group) => ({ group, categories: groups.filter((g) => g.appGroup === group && g.tables.length > 0) })).filter((x) => x.categories.length > 0);
}

/**
 * "Reviews, Body and mind, and Journal": what one accordion holds, in words a coach or an admin can read too (`andList` keeps each name one thing).
 * Each part up to a comma is kept whole (`Phrases`), so a phone's narrow header breaks only between names, on purpose ("People," over "Community
 * and Party"), never leaving a short last line (the rectangle rule; the rag probe found "People, Community / and Party" at 390).
 */
const namesOf = (categories: readonly TableListGroup[]): ReactNode => <Phrases text={andList(categories.map((c) => c.name))} at={/(?<=,) /} />;

/**
 * Every list of tables, drawn the way the Apps page draws apps (2026-11-14, the founder: "put them in toggles based on categories in every place
 * they occur for both coaches, admins and the user themselves, in the same ways apps are in toggles"): one accordion per app group in its pillar's
 * colour (GroupAccordion, the Apps page's own look), its line naming the categories inside, a count in its pill, and inside each category's tables
 * under a quiet eyebrow. Every group starts closed (2026-11-14, the founder: "keep all the tables hidden state by default, not follow this from
 * profile"), whatever the viewer's app prefs say for the Apps page, and what was opened is kept
 * for the tab and the viewer, one memory per place (`place`: the person's own list, a student's, a member's, a share list), as AppGroups keeps its.
 * A group is a plain labelled group, never a region, since Profile draws these group names again beside Features (the review, 2026-11-14); a
 * page whose groups are its sections passes `heading`, and each group's toggle sits in a heading of that level, each category's name one under it.
 */
export function TableGroups({
  groups,
  place,
  count,
  mood,
  note,
  heading,
  children,
}: {
  groups: readonly TableListGroup[];
  /** Which list this is, so each remembers its own open groups: 'own', `coach:<id>`, `admin:<id>`, `share-coach:<link>`, 'share-ai'. */
  place: string;
  /** The words in a group's pill, from the tables it holds ("4 tables", "2 of 9 shared"). */
  count: (categories: readonly TableListGroup[]) => ReactNode;
  mood: (categories: readonly TableListGroup[]) => 'happy' | 'sleepy';
  /** Words after a category's name in its eyebrow ("2 of 9"), when the list has some. */
  note?: (category: TableListGroup) => ReactNode;
  /** The heading level of each group on a page whose groups are its sections (All tables); a share list inside a fold leaves it out. */
  heading?: 2;
  /** One category's tables: a list of links, or a card of switches. */
  children: (category: TableListGroup, group: ModuleGroup) => ReactNode;
}) {
  const me = useMe();
  const scope = `tablegroups:${me.data?.user.id ?? 'anon'}:${place}`;
  return (
    <div className="flex flex-col gap-sm">
      {byAppGroup(groups).map(({ group, categories }) => (
        <Group key={group} group={group} categories={categories} scope={scope} count={count(categories)} mood={mood(categories)} note={note} heading={heading}>
          {children}
        </Group>
      ))}
    </div>
  );
}

function Group({
  group,
  categories,
  scope,
  count,
  mood,
  note,
  heading,
  children,
}: {
  group: ModuleGroup;
  categories: TableListGroup[];
  scope: string;
  count: ReactNode;
  mood: 'happy' | 'sleepy';
  note?: (category: TableListGroup) => ReactNode;
  heading?: 2;
  children: (category: TableListGroup, group: ModuleGroup) => ReactNode;
}) {
  // Closed until opened, never from Profile's "Starts open" picks; what was opened is remembered for this tab and this person (lib/kept.ts).
  const [open, setOpen] = useKept<boolean>(scope, group, false);
  const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[group]];
  return (
    <GroupAccordion group={group} open={open} onToggle={() => setOpen((o) => !o)} count={count} mood={mood} blurb={namesOf(categories)} region={false} heading={heading}>
      {categories.map((cat) => (
        <Category key={cat.key} name={cat.name} note={note?.(cat)} deep={`var(--deep-${rel.key})`} heading={Boolean(heading)}>
          {children(cat, group)}
        </Category>
      ))}
    </GroupAccordion>
  );
}

/**
 * One category inside a group: its name as a quiet eyebrow in the group's deep colour, and its tables under it. Under a group in a heading
 * (`heading`) the eyebrow is the next heading down, in the same look, so heading by heading still finds each category.
 */
function Category({ name, note, deep, heading, children }: { name: string; note?: ReactNode; deep: string; heading: boolean; children: ReactNode }) {
  const id = useId();
  const Name = heading ? 'h3' : 'p';
  return (
    // .fx-inset sets its own margins to 0, so the room either side and under each category comes from this wrapper, as in AppGroups.
    <div role="group" aria-labelledby={id} className="mx-sm mb-sm">
      <Name id={id} className="m-0 mb-xs text-eyebrow uppercase" style={{ color: deep }}>
        {name}
        {note !== undefined && note !== null && (
          <>
            <span className="sr-only">:</span> {note}
          </>
        )}
      </Name>
      {children}
    </div>
  );
}
