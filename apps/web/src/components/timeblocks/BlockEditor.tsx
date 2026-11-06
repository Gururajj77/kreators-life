import { useId, useState, type ReactNode } from 'react';
import { BLOCK_NAME_MAX, BLOCK_TAG_MAX, LIFE_AREA_ORDER, LIFE_AREAS, RELATIONSHIPS, TIME_BLOCK_TAGS, timeBlockProblem, type LifeAreaKey, type RelationshipKey, type BlockColor, type TimeBlock } from '@kreators/shared';
import { Button } from '../Button';
import { FieldLabel } from '../Field';
import { ErrorLine } from '../ErrorLine';
import { FIELD, LABEL } from '../../lib/ui';
import { SwatchPicker } from './SwatchPicker';

export interface BlockDraft {
  name: string;
  tag: string;
  color: BlockColor;
  area: LifeAreaKey | null;
  pillar: RelationshipKey | null;
}
export const draftOfBlock = (b?: TimeBlock): BlockDraft => ({ name: b?.name ?? '', tag: b?.tag ?? '', color: b?.color ?? 'sky', area: b?.area ?? null, pillar: b?.pillar ?? null });

/**
 * One block's form, inline under its row (or in "Add a block"): the name, a tag (any words, with the usual ones offered), the colour from
 * the swatches, and an optional area of life and pillar, which Plan my week uses to suggest a block for a task. Nothing saves until Save.
 */
export function BlockEditor({ block, pending, error, onSave, saveLabel = 'Save', aside }: { block?: TimeBlock; pending: boolean; error: unknown; onSave: (d: BlockDraft) => void; saveLabel?: string; /** Beside Save at its right (a block's delete). */ aside?: ReactNode }) {
  const id = useId();
  const [d, setD] = useState<BlockDraft>(() => draftOfBlock(block));
  const problem = timeBlockProblem(d, false);
  const set = <K extends keyof BlockDraft>(k: K, v: BlockDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="flex flex-col gap-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem) onSave({ ...d, name: d.name.trim(), tag: d.tag.trim() });
      }}
    >
      <div className="grid gap-sm sm:grid-cols-2">
        {/* Every field has its one quiet line under its label (the founder, 2026-11-06: "either have helper text under each or none"). */}
        <FieldLabel label="Name" hint="What it is called on Daily and in your week.">
          <input className={FIELD} value={d.name} maxLength={BLOCK_NAME_MAX} onChange={(e) => set('name', e.target.value)} placeholder="Deep work" />
        </FieldLabel>
        <FieldLabel label="Tag" hint="A word or two that groups blocks, like Focus.">
          <input className={FIELD} value={d.tag} maxLength={BLOCK_TAG_MAX} list={`${id}-tags`} onChange={(e) => set('tag', e.target.value)} />
          <datalist id={`${id}-tags`}>
            {TIME_BLOCK_TAGS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </FieldLabel>
      </div>
      <div className="grid gap-sm sm:grid-cols-2">
        <FieldLabel label="Area of life" hint="Tasks in this area are suggested here.">
          <select className={FIELD} value={d.area ?? ''} onChange={(e) => set('area', (e.target.value || null) as LifeAreaKey | null)}>
            <option value="">No area</option>
            {LIFE_AREA_ORDER.map((a) => (
              <option key={a} value={a}>
                {LIFE_AREAS[a].name}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Pillar" hint="Tasks of this pillar are suggested here.">
          <select className={FIELD} value={d.pillar ?? ''} onChange={(e) => set('pillar', (e.target.value || null) as RelationshipKey | null)}>
            <option value="">No pillar</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <div>
        <p id={`${id}-colour`} className={`m-0 ${LABEL}`}>
          Colour
        </p>
        <p className="m-0 text-caption text-ink-soft">Its boxes and bands wear it.</p>
        <div className="mt-xs">
          <SwatchPicker value={d.color} onChange={(c) => set('color', c)} label={`Colour for ${d.name.trim() || 'this block'}`} />
        </div>
      </div>
      {d.name.trim() !== '' && problem && <ErrorLine e={problem} warning />}
      {error ? <ErrorLine e={error} /> : null}
      {/* Save takes the free width; a block's delete sits at its right on the same line. */}
      <div className="flex items-center gap-xs">
        <Button type="submit" className="flex-1" disabled={pending || Boolean(problem)}>
          {pending ? 'Saving…' : saveLabel}
        </Button>
        {aside}
      </div>
    </form>
  );
}
