import { useId, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  DAY_TEMPLATE_NAME_MAX,
  dayTemplateProblem,
  hhmm,
  MAX_TEMPLATE_SLOTS,
  minuteOf,
  parseSlots,
  RELATIONSHIPS,
  slotLength,
  spanLabel,
  templateColor,
  type BlockColor,
  type DayTemplate,
  type RelationshipKey,
  type TimeBlock,
} from '@kreators/shared';
import { Button } from '../Button';
import { FieldLabel } from '../Field';
import { ErrorLine } from '../ErrorLine';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { MoreMenu, type MoreMenuItem } from '../MoreMenu';
import { FIELD, FIELD_LINE, LABEL } from '../../lib/ui';
import { SwatchPicker } from './SwatchPicker';
import { clockOf } from '../../lib/date';

interface SlotDraft {
  /** A made id, so a row keeps its key while the list changes (never the index). */
  key: string;
  blockId: string;
  start: string;
  end: string;
}
export interface TemplateDraft {
  name: string;
  lead: RelationshipKey;
  second: RelationshipKey | null;
  /** Its own colour, the one every view of this kind of day wears (`templateColor`). */
  color: BlockColor;
  slots: { blockId: string; start: string; end: string }[];
}

let made = 0;
const nextKey = () => `slot-${++made}`;
const draftSlots = (t: DayTemplate): SlotDraft[] => t.slots.map((s) => ({ key: nextKey(), blockId: s.blockId, start: hhmm(s.start), end: hhmm(s.end) }));

/**
 * One day template's editor, inline under its row: the name, the pillar that leads and the second (By context reads them), its colour
 * (the block form's picker; a template with none picked opens on its longest block's, which Save then keeps), and the slots,
 * each a block from a start to an end (an end before the start crosses midnight). The slots are checked as they are typed with the
 * server's own rule (`parseSlots`: no overlap, no empty slot); nothing is saved until Save, so removing a slot here asks nothing.
 */
export function TemplateEditor({
  template,
  blocks,
  pending,
  error,
  onSave,
  onSaveAsNew,
  menu,
}: {
  template: DayTemplate;
  blocks: readonly TimeBlock[];
  pending: boolean;
  error: unknown;
  onSave: (d: TemplateDraft) => void;
  onSaveAsNew: (d: TemplateDraft) => void;
  menu: MoreMenuItem[];
}) {
  const [name, setName] = useState(template.name);
  const [lead, setLead] = useState<RelationshipKey>(template.lead);
  const [second, setSecond] = useState<RelationshipKey | null>(template.second);
  const [color, setColor] = useState<BlockColor>(() => templateColor(template, blocks) ?? 'indigo');
  const colourId = useId();
  const addSlotId = useId();
  const [slots, setSlots] = useState<SlotDraft[]>(() => draftSlots(template));
  const ids = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);
  const names = useMemo(() => Object.fromEntries(blocks.map((b) => [b.id, b.name])) as Record<string, string>, [blocks]);
  const plain = slots.map(({ blockId, start, end }) => ({ blockId, start, end }));
  const checked = parseSlots(plain, ids, names);
  const problem = dayTemplateProblem({ name, lead, second }, false) ?? ('problem' in checked ? checked.problem : null);
  const draft: TemplateDraft = { name: name.trim(), lead, second: second === lead ? null : second, color, slots: plain };
  const put = (key: string, patch: Partial<SlotDraft>) => setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const add = () => {
    const last = slots[slots.length - 1];
    const from = last ? (minuteOf(last.end) ?? 0) : 7 * 60;
    setSlots((list) => [...list, { key: nextKey(), blockId: blocks[0]?.id ?? '', start: hhmm(from), end: hhmm(from + 60) }]);
  };
  return (
    <form
      className="flex flex-col gap-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem) onSave(draft);
      }}
    >
      <FieldLabel label="Name" hint="What this kind of day is called in your week and on Daily.">
        <input className={FIELD} value={name} maxLength={DAY_TEMPLATE_NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </FieldLabel>
      <div className="grid gap-sm sm:grid-cols-2">
        <FieldLabel label="Pillar that leads" hint="By context puts its tasks first.">
          <select className={FIELD} value={lead} onChange={(e) => setLead(e.target.value as RelationshipKey)}>
            {RELATIONSHIPS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Second pillar" hint="Its tasks come next.">
          <select className={FIELD} value={second ?? ''} onChange={(e) => setSecond((e.target.value || null) as RelationshipKey | null)}>
            <option value="">None</option>
            {RELATIONSHIPS.filter((r) => r.key !== lead).map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <div>
        <p id={colourId} className={`m-0 ${LABEL}`}>
          Colour
        </p>
        <p className="m-0 text-caption text-ink-soft">This kind of day wears it in your week, the month calendar and Emerging.</p>
        <div className="mt-xs">
          <SwatchPicker value={color} onChange={setColor} label={`Colour for ${name.trim() || 'this template'}`} />
        </div>
      </div>
      <div>
        <p className="m-0 text-subhead font-semibold">Slots</p>
        <p className="m-0 text-caption text-ink-soft">An end before the start runs past midnight, like Sleep from 23:00 to 07:00.</p>
        {slots.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">No slots yet. The whole day shows as free.</p>}
        <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
          {slots.map((s, i) => {
            const st = minuteOf(s.start);
            const en = minuteOf(s.end);
            const len = st !== null && en !== null && st !== en ? spanLabel(slotLength({ start: st, end: en })) : '';
            const blockName = names[s.blockId] ?? 'this slot';
            return (
              <li key={s.key} className="flex flex-wrap items-end gap-xs rounded-tile bg-paper p-xs">
                <label className="min-w-[160px] flex-[1_1_160px]">
                  <span className="sr-only">Block for slot {i + 1}</span>
                  <select className={FIELD_LINE} value={s.blockId} onChange={(e) => put(s.key, { blockId: e.target.value })}>
                    {!ids.has(s.blockId) && <option value="">Pick a block</option>}
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                {/* The two times share the rest of the row and grow with it (the founder, 2026-11-06: "dynamically fit the full width"). */}
                <span className="order-3 flex min-w-0 basis-full items-center gap-xs sm:order-2 sm:flex-[2_1_240px] sm:basis-auto">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">{blockName} starts</span>
                    <input type="time" step={300} className={FIELD_LINE} value={s.start} onChange={(e) => put(s.key, { start: e.target.value })} />
                  </label>
                  <span className="text-footnote text-ink-soft" aria-hidden="true">
                    to
                  </span>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">{blockName} ends</span>
                    <input type="time" step={300} className={FIELD_LINE} value={s.end} onChange={(e) => put(s.key, { end: e.target.value })} />
                  </label>
                </span>
                {/* On a phone the length and the remove sit beside the block, and the two times take the next line in full. */}
                <span className="order-2 ml-auto flex shrink-0 items-center gap-xs sm:order-3">
                  {len && <span className="whitespace-nowrap text-footnote text-ink-soft">{len}</span>}
                  {/* The row and this button go, so the keyboard's place moves to Add a slot, under the list. */}
                  <IconButton
                    icon={Trash2}
                    label={`Remove ${blockName} from ${clockOf(s.start)} to ${clockOf(s.end)}`}
                    tip="br"
                    onClick={() => {
                      setSlots((list) => list.filter((x) => x.key !== s.key));
                      document.getElementById(addSlotId)?.focus({ preventScroll: true });
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-xs">
          <Button id={addSlotId} type="button" variant="outline" size="sm" full onClick={add} disabled={slots.length >= MAX_TEMPLATE_SLOTS || blocks.length === 0}>
            <Icon icon={Plus} size={16} />
            Add a slot
          </Button>
        </div>
      </div>
      {problem && <ErrorLine e={problem} warning />}
      {error ? <ErrorLine e={error} /> : null}
      <div className="flex flex-wrap items-center gap-xs">
        <Button type="submit" className="flex-1" disabled={pending || Boolean(problem)}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" disabled={pending || Boolean(problem)} onClick={() => onSaveAsNew(draft)}>
          Save as new
        </Button>
        <MoreMenu items={menu} label={`More for ${template.name}`} title={template.name} />
      </div>
    </form>
  );
}
