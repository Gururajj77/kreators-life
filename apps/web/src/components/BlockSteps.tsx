import { RELATIONSHIP_BY_KEY, type TimeBlock } from '@kreators/shared';
import { breakdownProjectKey, stepsFor } from '@kreators/shared/contentDays';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../lib/api';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { SELECT_SM } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { Fold } from './Fold';
import { StatusTag } from './StatusTag';
import { useDailyAnswer } from './useDailyAnswer';

const COPY = {
  title: 'Steps for this block',
  lede: 'A list to follow. Add it as one task to tick each step.',
  add: 'Add to my tasks',
  project: 'Which project does it hold up?',
  projectHint: (pillar: string) => `Your projects in ${pillar}. This phone or laptop keeps your last pick.`,
  save: 'Add it',
  adding: 'Adding…',
  added: 'Added to your tasks.',
  open: 'Open it',
  noProject: (pillar: string) => `Tasks need a project. Set one up in ${pillar}, then come back.`,
  setUp: 'Go to Pillars',
} as const;

/** A text link with a 44px tap area (its ::after), at the right of its line. */
const LINK = "relative ml-auto whitespace-nowrap text-subhead font-semibold underline underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']";

function readPick(key: string | null): string {
  if (!key) return '';
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function keepPick(key: string | null, id: string) {
  if (!key) return;
  try {
    localStorage.setItem(key, id);
  } catch {
    /* A private window: the pick is only not remembered. */
  }
}

/**
 * Content days (2026-11-12, the founder's decisions 4 and 5): the ready list of steps a block carries on a day whose template is Edit day,
 * Shoot day or Plan and post day (`stepsFor` in `@kreators/shared/contentDays`), in a closed fold inside the block's box (By time block)
 * and its band (Your day). The steps are a list to read, never ticked here. "Add to my tasks" opens a project picker in place (the person's
 * active projects in the block's pillar, the same read as Daily's Add a task form, the last pick remembered on this device per person and
 * pillar) and makes ONE task in this block for this day with the steps as its subtasks (POST /nodes/breakdown). Once made, the fold says
 * "Added" with a link to the task on Daily instead of offering it again, the same when the server finds it was already there. Draws nothing
 * when the block has no list on this template. Lazy: it brings the step words (their own chunk) only to a content day.
 */
export function BlockSteps({ date, templateSeed, block }: { date: string; templateSeed: string | null | undefined; block: TimeBlock }) {
  const list = stepsFor(templateSeed, block.seed);
  const answer = useDailyAnswer(date);
  const me = useMe();
  const refresh = useRefreshAll();
  const id = useId();
  const [picking, setPicking] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const pillar = block.pillar;
  const pillarName = pillar ? RELATIONSHIP_BY_KEY[pillar].name : 'your pillars';
  const userId = me.data?.user.id ?? null;
  const pickKey = userId && pillar ? breakdownProjectKey(userId, pillar) : null;
  // The same read as Daily's Add a task form (its projects), so it is cached once and asked only when the picker opens.
  const month = date.slice(0, 7);
  const projectsQ = useAuthed(['today', 'month', month, date], () => api.todayMonth(month, date), picking);
  const projects = (projectsQ.data?.projects ?? []).filter((p) => !pillar || p.relationship === pillar);
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (!picking || projects.length === 0) return;
    if (projects.some((p) => p.id === projectId)) return;
    const kept = readPick(pickKey);
    setProjectId(projects.some((p) => p.id === kept) ? kept : projects[0]!.id);
  }, [picking, projects, projectId, pickKey]);

  const add = useMutation({
    mutationFn: () => api.breakdown({ date, templateSeed: templateSeed ?? '', blockSeed: block.seed ?? '', projectId }),
    onSuccess: (r) => {
      keepPick(pickKey, projectId);
      setMade(r.node.id);
      setPicking(false);
      void refresh();
    },
    onError: (e) => {
      // Made in another tab a moment ago: Daily is read again, and the answer's breakdowns then say "Added" with its link.
      if (e instanceof ApiError && e.status === 409) {
        setPicking(false);
        void refresh();
      }
    },
  });

  if (!list || !templateSeed || !block.seed) return null;
  const fromAnswer = answer?.breakdowns?.find((b) => b.templateSeed === templateSeed && b.blockSeed === block.seed)?.nodeId ?? null;
  const nodeId = made ?? fromAnswer;
  const conflict = add.error instanceof ApiError && add.error.status === 409;

  return (
    <Fold className="mt-xs" title={COPY.title} hint={`${list.steps.length} steps`}>
      <div data-block-steps={block.seed} className="rounded-tile bg-paper p-sm">
        <p className="m-0 text-caption text-ink-soft">{COPY.lede}</p>
        <ol className="mt-xs m-0 flex list-decimal flex-col gap-xs pl-md text-subhead text-ink-soft">
          {list.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {nodeId || conflict ? (
          <div className="mt-sm flex flex-wrap items-center justify-between gap-sm">
            <p role="status" className="m-0 flex min-w-0 flex-[1_1_60%] flex-wrap items-center gap-xs text-subhead">
              <StatusTag tone="good">Added</StatusTag>
              <span className="text-ink-soft">{COPY.added}</span>
            </p>
            {nodeId && (
              <Link to={`/today?task=${encodeURIComponent(nodeId)}`} className={LINK} aria-label={`${COPY.open}: ${list.title}`}>
                {COPY.open}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mt-sm flex justify-end">
              <Button variant="outline" size="sm" plusToX expanded={picking} aria-controls={id} onClick={() => setPicking((o) => !o)}>
                {COPY.add}
              </Button>
            </div>
            {picking && (
              <div id={id} className="mt-sm">
                {projectsQ.isPending ? (
                  <p className="m-0 text-subhead text-ink-soft">Loading your projects…</p>
                ) : projects.length === 0 ? (
                  <div className="flex flex-wrap-reverse items-center justify-between gap-sm">
                    <p className="m-0 min-w-0 flex-[1_1_60%] text-subhead text-ink-soft">{COPY.noProject(pillarName)}</p>
                    <Link to="/tower" className={LINK}>
                      {COPY.setUp}
                    </Link>
                  </div>
                ) : (
                  <form
                    className="flex flex-col gap-xs"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (projectId) add.mutate();
                    }}
                  >
                    <label className="block">
                      <span className="block text-subhead font-semibold">{COPY.project}</span>
                      <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${SELECT_SM} mt-xs w-full`} autoFocus>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                      <span className="mt-xs block text-caption text-ink-soft">{COPY.projectHint(pillarName)}</span>
                    </label>
                    <div className="flex justify-end">
                      <Button type="submit" variant="outline" size="sm" disabled={!projectId || add.isPending}>
                        {add.isPending ? COPY.adding : COPY.save}
                      </Button>
                    </div>
                  </form>
                )}
                {projectsQ.isError && <ErrorLine e={projectsQ.error} className="mt-xs" />}
                {!conflict && <ErrorLine e={add.error} className="mt-xs" />}
              </div>
            )}
          </>
        )}
      </div>
    </Fold>
  );
}
