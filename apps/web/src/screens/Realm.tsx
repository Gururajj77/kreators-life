import { HeroBlobs, PILLAR_FLOWER } from '../components/Hero';
import {
  CHARACTER_STAGES,
  evolutionFor,
  isRelationshipKey,
  KIND_META,
  KINDS,
  levelProgress,
  parentKind,
  RELATIONSHIP_BY_KEY,
  type Node,
  type NodeKind,
  type RelationshipKey,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { BackLink } from '../components/PageHeader';
import { Pyramid } from '../components/Pyramid';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { TaskRow } from '../components/TaskRow';
import { StartFocus, Subtasks, TaskPlanFields, planBody, planOf, planProblem, type Plan } from '../components/TaskPlan';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe, useNodes, useRefreshAll } from '../lib/queries';
import { placementLine } from '../components/LifeMap';
import { Link } from 'react-router';
import { useActionQueue } from '../lib/useActionQueue';

/** The layers above the tasks, top down like the pyramid: the foundation first, projects last. */
const RUNGS = KINDS.filter((k) => k !== 'task');

export function Realm() {
  const { key } = useParams();
  if (!isRelationshipKey(key)) return <Navigate to="/tower" replace />;
  return <RealmView key={key} relationship={key} />;
}

function RealmView({ relationship }: { relationship: RelationshipKey }) {
  const rel = RELATIONSHIP_BY_KEY[relationship];
  const me = useMe();
  const nodesQ = useNodes(relationship);
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const today = todayLocal();
  const [adding, setAdding] = useState<NodeKind | null>(null);
  const [editing, setEditing] = useState<Node | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (e: unknown) => setNotice(e instanceof Error ? e.message : 'That did not work. Try again.');

  const state = me.data?.relationships.find((r) => r.key === relationship);
  const sess = useAuthed(['session', today], () => api.session(today));
  const placement = sess.data?.assessment?.placements.find((p) => p.relationship === relationship) ?? null;
  const nodes = nodesQ.data?.nodes ?? [];
  const byKind = (k: NodeKind) => nodes.filter((n) => n.kind === k);
  const built = nodes.some((n) => n.kind === 'pillar');
  const lp = levelProgress(state?.xp ?? 0);
  const evo = evolutionFor(CHARACTER_STAGES, state?.xp ?? 0, state?.floorAgeDays ?? 0);
  const activeTasks = byKind('task').filter((n) => n.status === 'active');
  const doneTasks = byKind('task').filter((n) => n.status === 'done');
  const projects = byKind('project').filter((n) => n.status === 'active');

  const queue = useActionQueue(refresh);
  const toggle = (n: Node) =>
    queue.run(n.id, async () => {
      if (n.status === 'done') {
        await api.uncomplete(n.id);
        return;
      }
      const r = await api.complete(n.id, todayLocal());
      celebrate({
        title: r.capped ? 'Done. Daily xp limit reached, so this one was for you' : 'Ripple',
        totalXp: r.totalXp,
        ripple: r.ripple,
        newBadges: r.newBadges,
        projectCleared: r.projectCleared,
        color: rel.color,
      });
    });
  const acceptQuest = useMutation({
    mutationFn: () => api.acceptQuest(relationship, today),
    onError: fail,
    onSuccess: () => {
      refresh();
      celebrate({ title: `${rel.character} is awake`, color: rel.color });
    },
  });

  return (
    <>
      {/* A calm wash instead of a flat block: the pillar's colour with a soft light at the top left, deepening toward the bottom. */}
      <div className="relative overflow-hidden rounded-b-card" style={{ background: `radial-gradient(70% 55% at 12% 0%, rgba(255, 255, 255, 0.22), transparent 70%), linear-gradient(165deg, ${rel.color}, color-mix(in oklab, ${rel.color} 62%, var(--fill-shade)))`, color: rel.text }}>
        <HeroBlobs kind={PILLAR_FLOWER[relationship]} />
        <div className="safe-top relative mx-auto w-full max-w-[480px] px-md pb-lg pt-md md:ml-[240px] md:max-w-[1040px] md:px-lg lg:mx-auto lg:pl-[240px]">
          {/* On a phone the brand and the corner buttons float over the top 56px, so the way back starts below them. */}
          <div className="pt-xl md:pt-0">
            <BackLink to="/tower" inherit>
              Pillars
            </BackLink>
          </div>
          <p className="mt-sm m-0 text-[14px] font-bold">
            Pillar {rel.floor} of 7, {rel.character}, your {rel.role}
          </p>
          <h1 className="text-[30px]">{rel.name}</h1>
          <div className="mt-md">
            <EvolutionReveal
              now={<Avatar relationship={relationship} size={88} mood={built ? 'happy' : 'sleepy'} stage={evo.stage.stage} decorative />}
              nowName={evo.stage.name}
              next={evo.next ? <Avatar relationship={relationship} size={88} stage={evo.next.stage} still decorative /> : null}
              nextName={evo.next?.name ?? null}
              charge={evo.charge}
              preparing={evo.preparing}
              readyInDays={evo.readyInDays}
            />
          </div>
          <p className="mt-sm m-0 text-center text-[14px] font-bold">
            Level {lp.level}, {state?.xp ?? 0} xp.{' '}
            {evo.preparing && evo.next
              ? `${evo.next.name} evolves in ${evo.readyInDays} ${evo.readyInDays === 1 ? 'day' : 'days'}.`
              : evo.next
                ? `${evo.xpToNext} xp until ${evo.next.name}.`
                : 'Final form.'}
          </p>
          <p className="mt-md m-0 rounded-card rounded-tl-[8px] bg-card p-md text-[16px] font-semibold text-ink">{rel.greeting}</p>
          {placement && (
            <p className="mt-sm m-0 text-[14px] font-bold">
              {placementLine(placement)}{' '}
              <Link to="/tower#life-map" className="underline underline-offset-4">
                See the map
              </Link>
            </p>
          )}
        </div>
      </div>

      <Screen>
        {notice && (
          <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {notice}
          </p>
        )}

        {!nodesQ.isPending && !built && (
          <section className="mt-lg" aria-labelledby="build-heading">
            <h2 id="build-heading" className="text-[24px]">
              Set up this pillar
            </h2>
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft" style={{ backgroundImage: `linear-gradient(145deg, color-mix(in oklab, ${rel.color} 16%, transparent), transparent 65%)` }}>
              <p className="m-0 text-[16px] font-semibold">
                {rel.character} built a pyramid from your answers: the foundation you picked, then a guiding principle, a value goal, a goal outcome, a project and three tasks. One tap and they show up on Daily.
              </p>
              <Button variant="color" color={rel.color} deep={`var(--deep-${rel.key})`} full className="mt-md" style={{ color: rel.text }} onClick={() => acceptQuest.mutate()} disabled={acceptQuest.isPending}>
                Set up {rel.character}&rsquo;s pyramid
              </Button>
              <Button variant="ghost" full className="mt-xs" onClick={() => setAdding('pillar')}>
                Or start by hand with a foundation
              </Button>
            </div>
          </section>
        )}

        {built && (
          <>
            <section className="mt-lg" aria-labelledby="do-heading">
              <h2 id="do-heading" className="text-[24px]">
                Tasks to do
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Tick the box when you have done it. The whole pyramid gets stronger.</p>
              {activeTasks.length > 0 ? (
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  <AnimatePresence initial={false}>
                    {activeTasks.map((n) => {
                      const project = nodes.find((p) => p.id === n.parentId);
                      return (
                        <TaskRow
                          key={n.id}
                          task={n}
                          today={today}
                          subtitle={project ? `Project: ${project.title}` : undefined}
                          busy={queue.isPending(n.id)}
                          hint={queue.hint(n.id)}
                          onToggle={() => toggle(n)}
                          onEdit={() => setEditing(n)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </ul>
              ) : (
                <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft shadow-toy-soft">Nothing waiting. Add one below.</p>
              )}
              <Button full className="mt-sm" onClick={() => setAdding('task')} disabled={projects.length === 0}>
                Add a task
              </Button>
              {projects.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Tasks need a project. Open the pyramid below to add one.</p>}
            </section>

            <section className="mt-lg" aria-labelledby="ladder-heading">
              <h2 id="ladder-heading" className="text-[24px]">
                The pyramid
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
                Five layers lead down to the tasks. Open a layer to see what is there, change it, or add to it.
              </p>
              <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                <Pyramid
                  relationship={relationship}
                  compact
                  words={Object.fromEntries(KINDS.map((k) => [k, byKind(k).find((n) => n.status === 'active')?.title ?? (k === 'task' ? 'Your next task' : 'Nothing here yet')]))}
                />
              </div>
              <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {RUNGS.map((kind) => {
                  const meta = KIND_META[kind];
                  const items = byKind(kind).filter((n) => n.status !== 'archived');
                  const parent = parentKind(kind);
                  const parents = parent ? byKind(parent).filter((n) => n.status === 'active') : [];
                  const locked = parent !== null && parents.length === 0;
                  const summary = items.length > 0 ? items.map((n) => n.title).join(', ') : locked && parent ? `Unlocks after your first ${KIND_META[parent].label.toLowerCase()}` : 'Nothing yet';
                  return (
                    <li key={kind}>
                      <details className="rounded-tile bg-card shadow-toy-soft">
                        <summary className="flex items-center gap-sm p-sm">
                          <span
                            className="flex size-[32px] shrink-0 items-center justify-center rounded-pill font-display text-[14px] font-extrabold"
                            style={locked ? { background: 'var(--color-line)', color: 'var(--color-ink-soft)' } : { background: rel.color, color: rel.text }}
                            aria-hidden="true"
                          >
                            {meta.rung}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[16px] font-bold">
                              {meta.plural}
                              {items.length > 0 && <span className="text-ink-mute"> {items.length}</span>}
                            </span>
                            <span className="block truncate text-[14px] font-semibold text-ink-soft">{summary}</span>
                          </span>
                          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="chev shrink-0 transition-transform" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </summary>
                        <div className="border-t border-line p-sm">
                          <p className="m-0 text-[14px] font-semibold text-ink-soft">{meta.hint}</p>
                          {items.length > 0 && (
                            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                              {items.map((n) => {
                                const parentNode = nodes.find((p) => p.id === n.parentId);
                                return (
                                  <li key={n.id}>
                                    <button type="button" onClick={() => setEditing(n)} className="toy toy-flat flex w-full items-center gap-sm rounded-tile bg-paper p-sm text-left">
                                      <span className="w-[6px] self-stretch rounded-pill" style={{ background: n.status === 'done' ? rel.deep : rel.color }} aria-hidden="true" />
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[16px] font-bold">
                                          {n.title}
                                          {n.status === 'done' && <span className="text-ink-mute"> (cleared)</span>}
                                        </span>
                                        {parentNode && <span className="block truncate text-[14px] font-semibold text-ink-soft">Holds up: {parentNode.title}</span>}
                                      </span>
                                      <span className="shrink-0 rounded-pill bg-card px-sm py-xs text-[12px] font-extrabold">{n.xp} xp</span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <Button variant="outline" className="mt-sm" onClick={() => setAdding(kind)} disabled={locked}>
                            Add {meta.label.toLowerCase()}
                          </Button>
                        </div>
                      </details>
                    </li>
                  );
                })}
                {doneTasks.length > 0 && (
                  <li>
                    <details className="rounded-tile bg-card shadow-toy-soft">
                      <summary className="flex items-center gap-sm p-sm">
                        <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-r4 font-display text-[14px] font-extrabold text-on-fill" aria-hidden="true">
                          ✓
                        </span>
                        <span className="min-w-0 flex-1 text-[16px] font-bold">Done tasks {doneTasks.length}</span>
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="chev shrink-0 transition-transform" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </summary>
                      <ul className="flex list-none flex-col gap-xs border-t border-line p-sm m-0">
                        <AnimatePresence initial={false}>
                          {doneTasks.map((n) => (
                            <TaskRow
                              key={n.id}
                              task={n}
                              today={today}
                              busy={queue.isPending(n.id)}
                              hint={queue.hint(n.id)}
                              onToggle={() => toggle(n)}
                              onEdit={() => setEditing(n)}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </details>
                  </li>
                )}
              </ol>
            </section>
          </>
        )}
      </Screen>

      <AddSheet kind={adding} relationship={relationship} nodes={nodes} today={today} onClose={() => setAdding(null)} />
      <EditSheet node={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function AddSheet({ kind, relationship, nodes, today, onClose }: { kind: NodeKind | null; relationship: RelationshipKey; nodes: Node[]; today: string; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [plan, setPlan] = useState<Plan>(() => planOf(null, today));
  const meta = kind ? KIND_META[kind] : null;
  const parent = kind ? parentKind(kind) : null;
  const parents = parent ? nodes.filter((n) => n.kind === parent && n.status === 'active') : [];

  useEffect(() => {
    setTitle('');
    setPlan(planOf(null, today));
    setParentId(parents[0]?.id ?? '');
    // Reset the form each time a rung's add button opens the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const create = useMutation({
    mutationFn: () => {
      if (!kind) throw new Error('no kind');
      return api.createNode({ kind, parentId: parent ? parentId : null, relationship, title: title.trim(), ...(kind === 'task' ? planBody(plan) : {}) });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <Sheet open={kind !== null} onClose={onClose} title={meta ? `New ${meta.label.toLowerCase()}` : ''}>
      {meta && (
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">{meta.hint}</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder={meta.prompt}
              required
              className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]"
            />
          </label>
          {parent && (
            <label className="block">
              <span className="block text-[14px] font-bold">Which {KIND_META[parent].label.toLowerCase()} does it hold up?</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]">
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'task' && (
            <>
              <TaskPlanFields plan={plan} onChange={setPlan} today={today} />
              <p className="m-0 text-[14px] font-semibold text-ink-soft">Leave the do date empty and the task waits in the not scheduled list on Daily until you pick a day. A new task can be ticked ten minutes after you write it. Go do it first.</p>
            </>
          )}
          {create.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {create.error instanceof Error ? create.error.message : 'Could not add it. Try again.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={create.isPending || !title.trim() || (kind === 'task' && planProblem(plan) !== null)}>
            Add {meta.label.toLowerCase()}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function EditSheet({ node, onClose }: { node: Node | null; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<Plan>(() => planOf(null));

  useEffect(() => {
    setTitle(node?.title ?? '');
    setNote(node?.note ?? '');
    setPlan(planOf(node));
  }, [node]);

  const save = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no node');
      return api.updateNode(node.id, { title: title.trim(), note, ...(node.kind === 'task' ? planBody(plan) : {}) });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no node');
      return api.deleteNode(node.id);
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  const meta = node ? KIND_META[node.kind] : null;
  return (
    <Sheet open={node !== null} onClose={onClose} title={meta ? `Edit ${meta.label.toLowerCase()}` : ''}>
      {node && meta && (
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) save.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Note</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Why this matters, in your words" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          {node.kind === 'task' && (
            <>
              <TaskPlanFields plan={plan} onChange={setPlan} today={todayLocal()} />
              <Subtasks task={node} />
              <StartFocus task={{ ...node, estimateMin: Number(plan.minutes) > 0 ? Number(plan.minutes) : node.estimateMin }} />
            </>
          )}
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {node.xp} xp earned here. {node.kind === 'task' ? 'Changing the title makes it a new task, so the ten-minute wait starts again.' : 'Removing it also removes everything it holds up.'}
          </p>
          <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || (node.kind === 'task' && planProblem(plan) !== null)}>
            Save changes
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Remove "${node.title}"?`)) remove.mutate();
            }}
            disabled={remove.isPending}
          >
            Remove this {meta.label.toLowerCase()}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
