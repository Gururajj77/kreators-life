import { PLAN_DAY_MINUTES } from '@kreators/shared';
import { Settings } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { RulerPicker } from './RulerPicker';
import { Sheet } from './Sheet';

/** The plan itself, downloaded when the sheet first opens (or a pointer or the keyboard reaches the button). */
const loadBody = () => import('./WeekPlanBody');
const PlanBody = lazyNamed(loadBody, 'PlanBody');

/** The words on this sheet, in short plain sentences. */
export const COPY = {
  button: 'Plan my week',
  title: 'Plan my week',
  lede: 'Seven days from today. Each task with no day gets a suggested day and block. Nothing changes until you keep them.',
  blocksLink: 'Time blocks and day templates',
  hours: 'Hours of planned work a day',
  strength: 'Plan strength',
  strengthLede: 'Days with something planned, days that are not overloaded, and tasks that say how long they take.',
  now: 'Now',
  with: 'With all of these',
  week: 'The week',
  suggestions: 'Suggested days',
  keep: 'Keep what fits',
  skip: 'Skip them all',
  look: 'Worth a look',
  lookLede: 'Tick one when you have dealt with it. Tap Fix to change the tasks here.',
  handled: 'Dealt with',
  fix: 'Fix',
  hide: 'Hide',
  chooseDay: 'Choose a day',
  addOn: 'Add a task on',
  own: 'Add your own',
  ownLede: 'Pick a task you already have, then give it a day, a length and the rest.',
  ownFold: 'Pick a task',
  pick: 'Find a task',
  pickPlaceholder: 'Type part of its name',
  change: 'Change',
  loadingTasks: 'Loading your tasks',
  noTasks: 'No other open tasks',
  loadingTask: 'Opening the task.',
  addOwnButton: 'Add to the plan',
  remove: 'Remove',
  empty: 'You have no open tasks to plan. Add a few, then come back.',
  allPlaced: 'Every open task already has a day.',
  over: 'Over',
  loading: 'Planning your week.',
  failed: 'The plan did not load. Try again in a moment.',
  noneKept: 'Nothing to keep yet. Tick a suggestion or make a change.',
} as const;

const HOURS_KEY = 'kreators.planHours';
const readHours = (): number => {
  try {
    const n = Number(localStorage.getItem(HOURS_KEY));
    return Number.isFinite(n) && n >= 1 && n <= 12 ? Math.round(n) : PLAN_DAY_MINUTES / 60;
  } catch {
    return PLAN_DAY_MINUTES / 60;
  }
};
const saveHours = (n: number) => {
  try {
    localStorage.setItem(HOURS_KEY, String(n));
  } catch {
    // not kept here, still used for this plan
  }
};

/** The "Plan my week" button for Daily, its sheet, and a short line after the plan is kept. */
export function WeekPlanButton({ openOn = 0 }: { /** Opens the sheet each time this goes up (Daily's "2 late"), as the button does. */ openOn?: number } = {}) {
  const date = todayLocal();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openOn <= 0) return;
    void loadBody();
    setSaid('');
    setOpen(true);
  }, [openOn]);
  const [hours, setHours] = useState(readHours);
  const [said, setSaid] = useState('');
  const navigate = useNavigate();
  // Under `weekPlan`, which every time block and day template write reads again.
  const q = useAuthed(['weekPlan', date, hours], () => api.weekPlan(date, hours), open);
  const plan = q.data?.plan;
  const blocks = q.data?.blocks ?? [];
  const [draftHours, setDraftHours] = useState(hours);
  const setH = (n: number) => {
    const next = Math.max(1, Math.min(12, n));
    setHours(next);
    setDraftHours(next);
    saveHours(next);
  };
  const done = (kept: number, failed: number) => {
    setOpen(false);
    setSaid(kept === 0 && failed === 0 ? '' : failed > 0 ? `${kept} ${kept === 1 ? 'task now has' : 'tasks now have'} a day. ${failed} did not save.` : `${kept} ${kept === 1 ? 'task now has' : 'tasks now have'} a day.`);
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPointerEnter={() => void loadBody()}
        onFocus={() => void loadBody()}
        onClick={() => {
          void loadBody();
          setSaid('');
          setOpen(true);
        }}
      >
        {COPY.button}
      </Button>
      {said && (
        <p role="status" className="m-0 basis-full text-right text-caption text-ink-soft">
          {said}
        </p>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={COPY.title}
        rail={
          // The blocks and templates the plan leans on are set on their own page: the gear goes there.
          <IconButton
            icon={Settings}
            label={COPY.blocksLink}
            onClick={() => {
              setOpen(false);
              navigate('/time-blocks');
            }}
          />
        }
      >
        <div className="pb-md">
          <p className="m-0 text-subhead text-ink-soft">{COPY.lede}</p>
          <div className="mt-sm rounded-tile bg-paper p-sm">
            <div className="flex items-baseline justify-between gap-sm">
              <span className="text-subhead">{COPY.hours}</span>
              <span className="text-title3" aria-hidden="true">
                {draftHours} h
              </span>
            </div>
            {/* The plan is asked for again only once the ruler settles, not at every tick it passes. */}
            <RulerPicker label={COPY.hours} tone="paper" accent="r2" min={1} max={12} step={1} labelEvery={2} majorStep={2} value={draftHours} onChange={setDraftHours} onCommit={setH} valueText={(v) => `${v} ${v === 1 ? 'hour' : 'hours'} a day`} />
          </div>
          <div className="mt-md">
            {q.isPending && (
              <p role="status" className="m-0 text-subhead text-ink-soft">
                {COPY.loading}
              </p>
            )}
            {q.isError && (
              <p role="alert" className="m-0 text-subhead">
                {COPY.failed}
              </p>
            )}
            {plan && plan.suggestions.length === 0 && plan.days.every((d) => d.tasks === 0) && plan.noRoom.length === 0 ? (
              <p className="m-0 text-subhead text-ink-soft">{COPY.empty}</p>
            ) : (
              plan && (
                <Suspense
                  fallback={
                    <p role="status" className="m-0 text-subhead text-ink-soft">
                      {COPY.loading}
                    </p>
                  }
                >
                  <PlanBody key={`${hours}:${plan.suggestions.map((s) => `${s.id}${s.day}${s.blockId ?? ''}`).join()}`} plan={plan} blocks={blocks} onDone={done} />
                </Suspense>
              )
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
