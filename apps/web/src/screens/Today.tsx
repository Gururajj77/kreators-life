import { RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { CheckRow } from '../components/CheckRow';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { GuideCard, useGuide } from '../components/Guide';
import { Person } from '../components/Person';
import { Screen } from '../components/Screen';
import { TaskRow } from '../components/TaskRow';
import { api } from '../lib/api';
import { prettyDate } from '../lib/date';
import { useMe, useRefreshAll, useToday } from '../lib/queries';
import { useActionQueue } from '../lib/useActionQueue';

export function Today() {
  const { date, data, isPending, isError, refetch } = useToday();
  const me = useMe();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const guide = useGuide();
  const queue = useActionQueue(refresh);

  const checkIn = () =>
    queue.run('checkin', async () => {
      const r = await api.checkin(date);
      if (!r.alreadyCheckedIn) {
        celebrate({ title: r.streakBonus > 0 ? `Day ${r.streak}. Streak bonus!` : `Day ${r.streak} checked in`, totalXp: r.awarded, points: r.points, color: '#FFC93C' });
      }
    });
  const doSpark = () =>
    queue.run('spark', async () => {
      const r = await api.spark(date);
      if (!r.alreadyDone) celebrate({ title: 'Spark done', totalXp: r.awarded, color: RELATIONSHIP_BY_KEY[r.relationship].color });
    });
  const tick = (id: string) =>
    queue.run(id, async () => {
      const r = await api.complete(id);
      celebrate({
        title: r.capped ? 'Done. Daily xp limit reached, so this one was for you' : 'Ripple',
        totalXp: r.totalXp,
        ripple: r.ripple,
        newBadges: r.newBadges,
        projectCleared: r.projectCleared,
        color: RELATIONSHIP_BY_KEY[r.node.relationship].color,
      });
    });

  const rel = data ? RELATIONSHIP_BY_KEY[data.spark.relationship] : null;
  const tasks = data?.tasks ?? [];
  const taskDone = Boolean(data && data.doneRecently > 0);
  const doneCount = data ? Number(data.checkedIn) + Number(data.spark.done) + Number(taskDone) : 0;
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
        {data && (
          <div className="mt-sm">
            <p className="m-0 text-[14px] font-bold">
              {doneCount === 3 ? 'All three done. See you tomorrow.' : `${doneCount} of 3 done. Tick a box when you have done the thing.`}
            </p>
            <div className="mt-xs flex gap-xs" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-[8px] flex-1 rounded-pill ${i < doneCount ? 'bg-r4' : 'bg-line'}`} />
              ))}
            </div>
          </div>
        )}
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

      {data && rel && (
        <>
          <section className="mt-lg" aria-labelledby="show-heading">
            <h2 id="show-heading" className="text-[18px]">
              Show up
            </h2>
            <div className="mt-sm">
              <CheckRow
                large
                checked={data.checkedIn}
                onToggle={checkIn}
                title={data.checkedIn ? `Checked in, day ${data.streak}` : 'I showed up today'}
                subtitle={
                  data.checkedIn ? (
                    <>
                      Points banked.{' '}
                      <Link to="/rewards" className="underline underline-offset-4">
                        See rewards
                      </Link>
                    </>
                  ) : (
                    '+10 xp and +10 points. Fifty bonus points every seventh day in a row.'
                  )
                }
                color="#3FCB7A"
                deep="#1E8A4D"
                text="#2B1D3A"
                busy={queue.isPending('checkin')}
                hint={queue.hint('checkin')}
                lockedMessage={data.checkedIn ? 'Already checked in today. Come back tomorrow.' : null}
              />
            </div>
          </section>

          <section className="mt-lg" aria-labelledby="spark-heading">
            <div className="flex items-center gap-sm">
              <Avatar relationship={rel.key} size={36} still decorative mood={data.spark.done ? 'excited' : 'happy'} />
              <h2 id="spark-heading" className="text-[18px]">
                Today&rsquo;s spark from {rel.character}
              </h2>
            </div>
            <div className="mt-sm">
              <CheckRow
                large
                checked={data.spark.done}
                onToggle={doSpark}
                title={data.spark.text}
                subtitle={data.spark.done ? `Done. ${rel.character} is glowing.` : `${rel.name}. +15 xp.`}
                color={rel.color}
                deep={rel.deep}
                text={rel.text}
                busy={queue.isPending('spark')}
                hint={queue.hint('spark')}
                lockedMessage={data.spark.done ? 'Done for today. A new spark comes tomorrow.' : null}
              />
            </div>
          </section>

          <section className="mt-lg" aria-labelledby="tasks-heading">
            <div className="flex items-baseline justify-between gap-sm">
              <h2 id="tasks-heading" className="text-[18px]">
                Tasks
              </h2>
              {tasks.length > 0 && <span className="text-[14px] font-bold text-ink-soft">{tasks.length} waiting</span>}
            </div>
            {tasks.length > 0 ? (
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                <AnimatePresence initial={false}>
                  {tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={date}
                      subtitle={RELATIONSHIP_BY_KEY[t.relationship].name}
                      busy={queue.isPending(t.id)}
                      hint={queue.hint(t.id)}
                      onToggle={() => tick(t.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="mt-sm rounded-card border-2 border-dashed border-line p-md">
                <p className="m-0 text-[14px] font-semibold text-ink-soft">
                  {taskDone ? 'Tasks done for today. Everything above them got stronger. More arrive as their dates come up.' : 'Tasks come from floors you build on the Tower.'}
                </p>
                <Link to="/tower" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-white">
                  {taskDone ? 'Build another floor' : 'Build a floor'}
                </Link>
              </div>
            )}
          </section>
        </>
      )}

      {identity && (
        <section className="mt-lg" aria-labelledby="evo-heading">
          <h2 id="evo-heading" className="text-[18px]">
            Who you are becoming
          </h2>
          <Link to="/you" className="toy toy-soft mt-sm block rounded-card bg-card p-md text-ink">
            <EvolutionReveal
              now={<Person stage={identity.stage.stage} size={72} decorative />}
              nowName={identity.stage.name}
              next={identity.next ? <Person stage={identity.next.stage} size={72} decorative /> : null}
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
                  : `${identity.stage.name}. Final form.`}
            </p>
          </Link>
        </section>
      )}
    </Screen>
  );
}
