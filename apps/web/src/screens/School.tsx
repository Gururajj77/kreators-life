import type { Cohort as CohortT, LearningItem, Program } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const modeName = (m: Program['deliveryMode']) => ({ online: 'Online', in_person: 'In person', hybrid: 'Hybrid' })[m];
const priceText = (p: Program) => (p.pricePoints > 0 ? `${p.pricePoints} points` : p.priceCents > 0 ? `${p.currency} ${(p.priceCents / 100).toFixed(0)}` : 'Free');

function Err({ error, fallback = 'That did not work.' }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {errText(error, fallback)}
    </p>
  );
}

export function School() {
  const pg = usePage();
  const q = useAuthed(['school', pg.query], () => api.school(pg.query));
  const [creating, setCreating] = useState(false);
  const d = q.data;
  const myIds = new Set(d?.myCohorts.map((k) => k.id) ?? []);

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">School</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Programs run as cohorts: lessons, assignments, live sessions and feedback from a mentor. Finish one and Work has places for what you learned.</p>
      </header>

      {d && (d.myCohorts.length > 0 || d.managed.length > 0) && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-[24px]">
            Your cohorts
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {[...d.myCohorts, ...d.managed.filter((k) => !myIds.has(k.id))].map((k) => (
              <li key={k.id}>
                <Link to={`/school/${k.id}`} className="toy toy-soft block rounded-tile bg-card p-sm">
                  <span className="block truncate text-[16px] font-bold">
                    {k.programName}, {k.name}
                  </span>
                  <span className="block text-[14px] font-semibold text-ink-soft">
                    {fmtDate(k.startAt)} to {fmtDate(k.endAt)}, {k.status}
                    {d.managed.some((m) => m.id === k.id) ? ', you manage it' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="programs-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="programs-heading" className="text-[24px]">
            Programs
          </h2>
          {d?.staff && <Button onClick={() => setCreating(true)}>New program</Button>}
        </div>
        {d && d.programs.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No programs are open yet. Each program lists its cohort dates here once the team sets them.</p>}
        <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
          {d?.programs.map((p) => (
            <li key={p.id}>
              <ProgramCard program={p} staff={Boolean(d.staff)} myIds={myIds} onChange={() => q.refetch()} />
            </li>
          ))}
        </ul>
        <Pager page={d?.page} label="programs" />
      </section>

      <NewProgramSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          q.refetch();
        }}
      />
    </Screen>
  );
}

function ProgramCard({ program: p, staff, myIds, onChange }: { program: Program; staff: boolean; myIds: Set<string>; onChange: () => void }) {
  const [tool, setTool] = useState<'lesson' | 'assignment' | 'cohort' | null>(null);
  const enroll = useMutation({ mutationFn: (cohortId: string) => api.enroll(cohortId), onSuccess: () => onChange() });
  const publish = useMutation({ mutationFn: (published: boolean) => api.updateProgram(p.id, { published }), onSuccess: () => onChange() });
  const open = p.cohorts.filter((k) => k.status === 'upcoming' || k.status === 'running');
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-[16px] font-bold">{p.name}</p>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {modeName(p.deliveryMode)}, {priceText(p)}
            {!p.published ? ', draft' : ''}
          </p>
        </div>
        {!p.published && <span className="shrink-0 rounded-pill bg-r3 px-xs text-[12px] font-extrabold leading-[20px] text-ink-fixed">Draft</span>}
      </div>
      {p.description && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold">{p.description}</p>}
      {p.outcomes && (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          <span className="font-bold">You leave with:</span> {p.outcomes}
        </p>
      )}
      {p.prerequisites && (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          <span className="font-bold">Before you start:</span> {p.prerequisites}
        </p>
      )}
      {open.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No cohort dates are set yet. Come back after the team adds one.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {open.map((k) => (
          <li key={k.id} className="flex items-center gap-sm rounded-tile bg-paper p-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold">{k.name}</span>
              <span className="block text-[14px] font-semibold text-ink-soft">
                {fmtDate(k.startAt)} to {fmtDate(k.endAt)}, {Math.max(0, k.capacity - k.enrolled)} of {k.capacity} seats left
              </span>
            </span>
            {myIds.has(k.id) ? (
              <Link to={`/school/${k.id}`} className="toy toy-soft inline-flex min-h-[44px] shrink-0 items-center rounded-pill bg-card px-md text-[14px] font-bold">
                Open
              </Link>
            ) : (
              <Button onClick={() => enroll.mutate(k.id)} disabled={enroll.isPending || k.enrolled >= k.capacity}>
                {k.enrolled >= k.capacity ? 'Full' : 'Enrol'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-xs">
        <Err error={enroll.error ?? publish.error} />
      </div>
      {staff && (
        <div className="mt-sm flex flex-wrap gap-xs">
          <Button variant="outline" onClick={() => setTool('lesson')}>
            Add lesson
          </Button>
          <Button variant="outline" onClick={() => setTool('assignment')}>
            Add assignment
          </Button>
          <Button variant="outline" onClick={() => setTool('cohort')}>
            Open a cohort
          </Button>
          <Button variant="ghost" onClick={() => publish.mutate(!p.published)} disabled={publish.isPending}>
            {p.published ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      )}
      {staff && (
        <StaffSheet
          program={p}
          tool={tool}
          onClose={() => setTool(null)}
          onDone={() => {
            setTool(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function StaffSheet({ program, tool, onClose, onDone }: { program: Program; tool: 'lesson' | 'assignment' | 'cohort' | null; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<LearningItem['contentType']>('lesson');
  const [body, setBody] = useState('');
  const [ref, setRef] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rubric, setRubric] = useState('');
  const [dueDays, setDueDays] = useState('7');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [capacity, setCapacity] = useState('30');
  const reset = () => {
    setTitle('');
    setBody('');
    setRef('');
    setInstructions('');
    setRubric('');
  };
  const addLesson = useMutation({
    mutationFn: () => api.addLearningItem(program.id, { moduleTitle: title, contentType, body, contentRef: ref || undefined }),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const addAssignment = useMutation({
    mutationFn: () => api.addAssignment(program.id, { title, instructions, rubric, dueDays: Number(dueDays) || 7 }),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const openCohort = useMutation({
    mutationFn: () => api.openCohort(program.id, { name: title, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), capacity: Number(capacity) || 30 }),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const titles = { lesson: 'Add a lesson', assignment: 'Add an assignment', cohort: 'Open a cohort' } as const;
  const busy = addLesson.isPending || addAssignment.isPending || openCohort.isPending;
  return (
    <Sheet open={tool !== null} onClose={onClose} title={tool ? `${titles[tool]}: ${program.name}` : ''}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          if (tool === 'lesson') addLesson.mutate();
          if (tool === 'assignment') addAssignment.mutate();
          if (tool === 'cohort' && startAt && endAt) openCohort.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">{tool === 'cohort' ? 'Cohort name' : 'Title'}</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className={field} />
        </label>
        {tool === 'lesson' && (
          <>
            <fieldset className="m-0 border-0 p-0">
              <legend className="text-[14px] font-bold">Kind</legend>
              <div className="mt-xs flex flex-wrap gap-xs">
                {(['lesson', 'video', 'reading'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={contentType === k} onClick={() => setContentType(k)} className={`min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${contentType === k ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                    {k}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="block text-[14px] font-bold">Link to a video or reading</span>
              <input type="url" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://" className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Text</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={20000} className={field} />
            </label>
          </>
        )}
        {tool === 'assignment' && (
          <>
            <label className="block">
              <span className="block text-[14px] font-bold">Instructions</span>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={5000} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">How it is judged</span>
              <textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={3} maxLength={2000} className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Days to hand it in</span>
              <input type="number" min={1} max={365} value={dueDays} onChange={(e) => setDueDays(e.target.value)} className={field} />
            </label>
          </>
        )}
        {tool === 'cohort' && (
          <>
            <div className="grid grid-cols-2 gap-xs">
              <label className="block">
                <span className="block text-[14px] font-bold">Starts</span>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className={field} />
              </label>
              <label className="block">
                <span className="block text-[14px] font-bold">Ends</span>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required className={field} />
              </label>
            </div>
            <label className="block">
              <span className="block text-[14px] font-bold">Seats</span>
              <input type="number" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={field} />
            </label>
            <p className="m-0 text-[14px] font-semibold text-ink-soft">You become its manager: you schedule sessions, give feedback and mark completion.</p>
          </>
        )}
        <Err error={addLesson.error ?? addAssignment.error ?? openCohort.error} fallback="Could not save it." />
        <Button type="submit" size="lg" full disabled={busy || !title.trim()}>
          {tool ? titles[tool] : 'Save'}
        </Button>
      </form>
    </Sheet>
  );
}

function NewProgramSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [mode, setMode] = useState<Program['deliveryMode']>('online');
  const [outcomes, setOutcomes] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [published, setPublished] = useState(false);
  const create = useMutation({
    mutationFn: () => api.createProgram({ name, description, pricePoints: Number(price) || 0, deliveryMode: mode, outcomes, prerequisites, published }),
    onSuccess: () => {
      setName('');
      setDescription('');
      onCreated();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New program">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Price in points</span>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">Zero makes it free.</span>
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">How it runs</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {(['online', 'in_person', 'hybrid'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${mode === m ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {modeName(m)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">What people leave with</span>
          <textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} rows={2} maxLength={2000} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What they need before starting</span>
          <textarea value={prerequisites} onChange={(e) => setPrerequisites(e.target.value)} rows={2} maxLength={1000} className={field} />
        </label>
        <label className="flex min-h-[44px] items-center gap-sm text-[14px] font-bold">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-[20px] accent-ink" />
          Publish right away
        </label>
        <Err error={create.error} fallback="Could not create it." />
        <Button type="submit" size="lg" full disabled={create.isPending || !name.trim()}>
          Create program
        </Button>
      </form>
    </Sheet>
  );
}

export type { CohortT };
