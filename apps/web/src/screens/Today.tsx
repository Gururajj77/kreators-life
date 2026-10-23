import { IDENTITY_STAGES, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { Creator } from '../components/Creator';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { GuideCard, useGuide } from '../components/Guide';
import { Screen } from '../components/Screen';
import { TaskRow } from '../components/TaskRow';
import { api } from '../lib/api';
import { prettyDate } from '../lib/date';
import { useMe, useRefreshAll, useToday } from '../lib/queries';

function Step({ n, done, title, color, children }: { n: number; done: boolean; title: string; color?: string; children: ReactNode }) {
  return (
    <li className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex items-center gap-sm">
        <span
          className="flex size-[32px] shrink-0 items-center justify-center rounded-pill font-display text-[14px] font-extrabold"
          style={done ? { background: '#3FCB7A', color: '#2B1D3A' } : { background: color ?? '#2B1D3A', color: color ? '#2B1D3A' : '#fff' }}
          aria-hidden="true"
        >
          {done ? '✓' : n}
        </span>
        <h2 className="min-w-0 flex-1 text-[18px]">
          <span className="sr-only">{done ? 'Done: ' : `Step ${n}: `}</span>
          {title}
        </h2>
      </div>
      <div className="mt-sm">{children}</div>
    </li>
  );
}

export function Today() {
  const { date, data, isPending, isError, refetch } = useToday();
  const me = useMe();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const guide = useGuide();
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (e: unknown) => setNotice(e instanceof Error ? e.message : 'That did not work. Try again.');

  const checkin = useMutation({
    mutationFn: () => api.checkin(date),
    onError: fail,
    onSuccess: (r) => {
      refresh();
      setNotice(null);
      if (!r.alreadyCheckedIn) {
        celebrate({ title: r.streakBonus > 0 ? `Day ${r.streak}. Streak bonus!` : `Day ${r.streak} checked in`, totalXp: r.awarded, points: r.points, color: '#FFC93C' });
      }
    },
  });
  const spark = useMutation({
    mutationFn: () => api.spark(date),
    onError: fail,
    onSuccess: (r) => {
      refresh();
      setNotice(null);
      if (!r.alreadyDone) celebrate({ title: 'Spark done', totalXp: r.awarded, color: RELATIONSHIP_BY_KEY[r.relationship].color });
    },
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.complete(id),
    onError: fail,
    onSuccess: (r) => {
      refresh();
      setNotice(null);
      celebrate({
        title: r.capped ? 'Done. Daily xp cap reached, rest is part of the work' : 'Ripple',
        totalXp: r.totalXp,
        ripple: r.ripple,
        newBadges: r.newBadges,
        projectCleared: r.projectCleared,
        color: RELATIONSHIP_BY_KEY[r.node.relationship].color,
      });
    },
  });

  const rel = data ? RELATIONSHIP_BY_KEY[data.spark.relationship] : null;
  const tasks = data?.tasks ?? [];
  const questsDone = Boolean(data && tasks.length === 0 && data.doneRecently > 0);
  const identity = me.data?.identity ?? null;

  return (
    <Screen>
      <header className="pt-lg">
        <p className="m-0 text-[14px] font-bold text-ink-soft">{prettyDate(date)}</p>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-[32px]">Today</h1>
          {data && (
            <span className="shrink-0 rounded-pill bg-card px-sm py-xs text-[14px] font-extrabold shadow-toy-soft">
              <span aria-hidden="true">🔥 </span>
              {data.streak} {data.streak === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Three things, every day. That is the whole game.</p>
      </header>

      {!guide.seen && <GuideCard onDismiss={guide.dismiss} />}

      {isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Loading your day
        </p>
      )}
      {isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load today.</p>
          <Button variant="outline" className="mt-sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}
      {notice && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {notice}
        </p>
      )}

      {data && rel && (
        <ol className="mt-md flex list-none flex-col gap-sm p-0 m-0" aria-label="Your daily three">
          <Step n={1} done={data.checkedIn} title={data.checkedIn ? `Checked in, day ${data.streak}` : 'Check in'}>
            {data.checkedIn ? (
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                Points banked.{' '}
                <Link to="/rewards" className="underline underline-offset-4">
                  See rewards
                </Link>
              </p>
            ) : (
              <>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">Ten xp and ten points for showing up. Fifty bonus points every seventh day in a row.</p>
                <Button full className="mt-sm" onClick={() => checkin.mutate()} disabled={checkin.isPending}>
                  Check in
                </Button>
              </>
            )}
          </Step>

          <Step n={2} done={data.spark.done} title={`Spark from ${rel.character}`} color={rel.color}>
            <div className="flex items-start gap-sm">
              <Avatar relationship={rel.key} size={48} mood={data.spark.done ? 'excited' : 'happy'} decorative />
              <p className="m-0 min-w-0 flex-1 text-[16px] font-extrabold leading-snug">{data.spark.text}</p>
            </div>
            {data.spark.done ? (
              <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Done. {rel.character} is glowing.</p>
            ) : (
              <Button variant="color" color={rel.color} deep={rel.deep} full className="mt-sm" style={{ color: rel.text }} onClick={() => spark.mutate()} disabled={spark.isPending}>
                I did it
              </Button>
            )}
          </Step>

          <Step n={3} done={questsDone} title={tasks.length > 0 ? `Tick a task, ${tasks.length} waiting` : questsDone ? 'Tasks done for today' : 'No tasks yet'}>
            {tasks.length > 0 ? (
              <ul className="flex list-none flex-col gap-xs p-0 m-0">
                <AnimatePresence initial={false}>
                  {tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={date}
                      subtitle={RELATIONSHIP_BY_KEY[t.relationship].name}
                      busy={complete.isPending && complete.variables === t.id}
                      onToggle={() => complete.mutate(t.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">
                  {questsDone ? 'Everything above those tasks got stronger. More arrive as their dates come up.' : 'Tasks come from floors you build on the Tower.'}
                </p>
                <Link to="/tower" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-white shadow-[0_4px_0_0_#15101f]">
                  {questsDone ? 'Build another floor' : 'Build a floor'}
                </Link>
              </>
            )}
          </Step>
        </ol>
      )}

      {identity && (
        <section className="mt-lg" aria-labelledby="evo-heading">
          <h2 id="evo-heading" className="text-[22px]">
            Who you are becoming
          </h2>
          <Link to="/you" className="mt-sm block rounded-card bg-card p-md text-ink shadow-toy-soft">
            <EvolutionReveal
              now={<Creator stage={identity.stage.stage} size={72} decorative />}
              nowName={identity.stage.name}
              next={identity.next ? <Creator stage={identity.next.stage} size={72} decorative /> : null}
              nextName={identity.next?.name ?? null}
              charge={identity.charge}
              preparing={identity.preparing}
              readyInDays={identity.readyInDays}
            />
            <p className="mt-sm m-0 text-center text-[13px] font-semibold text-ink-soft">
              {identity.preparing && identity.next
                ? `Fully revealed. Evolves in ${identity.readyInDays} ${identity.readyInDays === 1 ? 'day' : 'days'}.`
                : identity.next
                  ? `${identity.xpToNext} xp until ${identity.next.name} is fully revealed.`
                  : `${IDENTITY_STAGES[IDENTITY_STAGES.length - 1]?.name}. Final form.`}
            </p>
          </Link>
        </section>
      )}
    </Screen>
  );
}
