import { MAX_REVIEW_TEMPLATES, PERIOD_KINDS, PERIOD_META, REVIEW_NAME_MAX, type PeriodKind, type ReviewTemplate } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useAuthed } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { TapTwice } from './TapTwice';
import { Fold } from './Fold';
import { Inert } from './Inert';
import { Sheet } from './Sheet';

const plural = (n: number) => `${n} ${n === 1 ? 'question' : 'questions'}`;
/** A built-in set's key on the list: the half's two parts share an id. */
const keyOf = (t: ReviewTemplate) => `${t.id}:${t.part ?? ''}`;

/**
 * The Templates area on Reviews (2026-11-07, the founder: "pre-built templates for each of them already populated"): one closed fold that
 * lists every period's built-in set, the half's two parts each, with its questions and the line naming each one's method, read only, each
 * with Make my own copy (the ordinary POST /reviews/templates, up to MAX_REVIEW_TEMPLATES); then the person's own templates of every kind,
 * changed or removed as before. The list downloads only when the fold opens.
 */
export function ReviewTemplates({ kind }: { kind: PeriodKind }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useAuthed(['reviews', 'templates'], () => api.reviewTemplatesAll(), open);
  const [editing, setEditing] = useState<ReviewTemplate | 'new' | null>(null);
  const [said, setSaid] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['reviews'] });
  const mine = q.data?.mine ?? [];
  const full = mine.length >= MAX_REVIEW_TEMPLATES;
  const copy = useMutation({
    mutationFn: (t: ReviewTemplate) => api.reviewTemplateAdd({ kind: t.kind, name: `${t.name} (my copy)`.slice(0, REVIEW_NAME_MAX), prompts: t.prompts }),
    onSuccess: (r) => {
      setSaid(`Copied. “${r.template.name}” is under Your own, ready to change.`);
      refresh();
    },
    onError: () => setSaid('That did not copy. Try again.'),
  });

  return (
    <section className="mt-lg" aria-labelledby="templates-heading">
      <h2 id="templates-heading" className="text-title2">
        Templates
      </h2>
      <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">Every period has one built-in set. Copy one to make it your own.</p>
      <Fold className="mt-sm" title="Questions for each period" hint={q.data ? String(q.data.builtIn.length + mine.length) : undefined} open={open} onOpenChange={setOpen}>
        {q.isPending ? (
          <p className="m-0 text-subhead text-ink-soft" role="status">
            Loading the templates
          </p>
        ) : q.isError ? (
          <p role="alert" className="m-0 text-subhead">
            The templates did not load. Try again in a moment.
          </p>
        ) : (
          <div className="flex flex-col gap-md">
            <div>
              <h3 className="m-0 text-headline">Built in</h3>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                {q.data.builtIn.map((t) => (
                  <li key={keyOf(t)}>
                    <Fold title={t.name} hint={plural(t.prompts.length)}>
                      {/* A list to read, behind two folds, so the density check reads it as a reading block. */}
                      <ol data-reading className="m-0 flex list-none flex-col gap-sm p-0">
                        {t.prompts.map((p, i) => (
                          <li key={i} className="rounded-tile bg-card p-sm">
                            <span className="block text-subhead font-semibold">{`${i + 1}. ${p}`}</span>
                            {t.why?.[i] && <span className="mt-xs block text-footnote text-ink-soft">{t.why[i]}</span>}
                          </li>
                        ))}
                      </ol>
                      <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm">
                        <span className="min-w-0 flex-1 basis-[60%] text-caption text-ink-soft">{full ? `${MAX_REVIEW_TEMPLATES} templates is plenty. Remove one to copy another.` : `A copy comes back every ${PERIOD_META[t.kind].short.toLowerCase()}, and you can change its words.`}</span>
                        <Button variant="outline" size="sm" className="ml-auto" disabled={full || copy.isPending} onClick={() => copy.mutate(t)}>
                          Make my own copy
                        </Button>
                      </div>
                    </Fold>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <h3 className="m-0 text-headline">Your own</h3>
                <Button variant="outline" size="sm" plusToX disabled={full} onClick={() => setEditing('new')}>
                  New template
                </Button>
              </div>
              {mine.length === 0 ? (
                <p className="mt-xs m-0 text-subhead text-ink-soft">None yet. Copy a built-in set, or start a new one.</p>
              ) : (
                <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                  {mine.map((t) => (
                    <li key={t.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                      <span className="min-w-0 flex-1">
                        <span className="block text-card-title">
                          <Inert text={t.name} />
                        </span>
                        <span className="block text-card-note text-ink-soft">{`${PERIOD_META[t.kind].name}, ${plural(t.prompts.length)}`}</span>
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                        Edit
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Fold>
      {said && (
        <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
          {said}
        </p>
      )}
      <TemplateEditor editing={editing} kind={kind} onClose={() => setEditing(null)} onSaved={refresh} />
    </section>
  );
}

export function TemplateEditor({ editing, kind, onClose, onSaved }: { editing: ReviewTemplate | 'new' | null; kind: PeriodKind; onClose: () => void; onSaved: () => void }) {
  const open = editing !== null;
  const existing = editing && editing !== 'new' ? editing : null;
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<PeriodKind>(kind);
  const [text, setText] = useState('');
  // A deliberate seed: each time the sheet opens it starts from the template it was opened with, with no error left from the last time.
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setCadence(existing?.kind ?? kind);
    setText(existing?.prompts.join('\n') ?? '');
    save.reset();
    remove.reset();
  }, [open, existing, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const prompts = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const save = useMutation({
    mutationFn: () => (existing ? api.reviewTemplateUpdate(existing.id, { name: name.trim(), prompts }) : api.reviewTemplateAdd({ kind: cadence, name: name.trim(), prompts })),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.reviewTemplateRemove(existing!.id),
    onSuccess: () => {
      onSaved();
      onClose();
      // Its row and Edit button go, so the keyboard's place moves to the section's heading.
      focusHeadingAfter('templates-heading');
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={existing ? 'Edit template' : 'New template'}>
      <form
        className="flex flex-col gap-sm pb-xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block text-subhead font-semibold" htmlFor="tpl-name">
          Name
        </label>
        <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={REVIEW_NAME_MAX} placeholder="Money month" className={FIELD} />
        {!existing && (
          <>
            <label className="mt-sm block text-subhead font-semibold" htmlFor="tpl-kind">
              Comes back every
            </label>
            <select id="tpl-kind" value={cadence} onChange={(e) => setCadence(e.target.value as PeriodKind)} className={FIELD}>
              {PERIOD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PERIOD_META[k].short.toLowerCase()}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="mt-sm block text-subhead font-semibold" htmlFor="tpl-prompts">
          Questions, one per line
        </label>
        <textarea id="tpl-prompts" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'What did you earn?\nWhat did you waste?'} className={FIELD} />
        {(save.isError || remove.isError) && (
          <p role="alert" className="m-0 text-subhead">
            That did not save. Try again.
          </p>
        )}
        <div className="mt-md flex gap-xs">
          <Button type="submit" disabled={!name.trim() || prompts.length === 0 || save.isPending} className="min-w-0 flex-1">
            {existing ? 'Save changes' : 'Add template'}
          </Button>
          {existing && <TapTwice name={existing.name} onYes={() => remove.mutate()} disabled={remove.isPending} />}
        </div>
        {existing && <p className="m-0 text-caption text-ink-soft">Reviews already saved keep their questions.</p>}
        <ErrorLine e={remove.error} />
      </form>
    </Sheet>
  );
}
