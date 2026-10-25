import { LIFE_AREAS, RELATIONSHIP_BY_KEY, type LifeArea } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PeriodPanel } from '../components/PeriodPanel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Gauge, MultiLine, PillBars } from '../components/Charts';
import { Hero } from '../components/Hero';
import { Ring } from '../components/Ring';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useWellbeing } from '../lib/queries';

/** Five areas of a life on one screen, each part opening the place where you act on it. */
export function Life() {
  const q = useAuthed(['life'], api.life);
  const d = q.data;
  const wb = useWellbeing();
  const [minutes, setMinutes] = useState('30');
  const move = useMutation({ mutationFn: () => api.log('move', { value: Number(minutes) || 30 }), onSuccess: () => q.refetch() });

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Life</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Physical, financial, emotional, mental and spiritual, scored from what you already log. Tap any part to go where you act on it. Only you see this.</p>
        {d && (
          <Hero color="var(--color-r4)" deep="var(--deep-lover_partner)" className="mt-md" character="lover_partner" mood={d.overall >= 60 ? "excited" : d.overall >= 40 ? "happy" : "sleepy"}>
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide opacity-90">Life score</p>
            <div className="mt-xs flex items-center gap-md">
              <Gauge value={d.overall / 100} size={128} stroke={14} color="var(--color-on-fill)" track="rgba(255,255,255,0.3)" label={`Overall ${d.overall} of 100`}>
                <span className="font-display text-[40px] font-extrabold">{d.overall}</span>
              </Gauge>
              <div className="min-w-0">
                <p className="m-0 font-display text-[28px] font-extrabold leading-tight">{d.label}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold opacity-90">The average of the five areas. Parts with nothing logged do not count against you.</p>
              </div>
            </div>
          </Hero>
        )}
      </header>

      {d && (
        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="The five areas this week">
          <div className="flex items-baseline justify-between gap-sm">
            <p className="m-0 text-[14px] font-bold">The five areas, this week</p>
            <p className="m-0 text-[12px] font-bold text-ink-soft">
              <span className="inline-block size-[10px] rounded-pill bg-r2" aria-hidden="true" /> down on last week
            </p>
          </div>
          <div className="mt-sm">
            <PillBars allLabels values={d.areas.map((a) => a.score)} max={100} labels={d.areas.map((a) => LIFE_AREAS[a.key].emoji)} colors={d.areas.map((a) => (Math.round(a.trend) < 0 ? 'var(--color-r2)' : RELATIONSHIP_BY_KEY[LIFE_AREAS[a.key].relationship].color))} color="var(--color-r4)" label="Score per area" height={120} />
          </div>
          <p className="mt-sm m-0 text-[12px] font-bold text-ink-soft">
            {d.areas.filter((a) => Math.round(a.trend) !== 0).map((a) => `${LIFE_AREAS[a.key].name} ${Math.round(a.trend) > 0 ? 'up' : 'down'} ${Math.abs(Math.round(a.trend))}`).join(', ') || 'Same as last week so far.'}
          </p>
        </section>
      )}

      {q.isError && (
        <p role="alert" className="span-all mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load your dashboard. Try again in a moment.
        </p>
      )}

      {wb.data && (
        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="Mood, sleep and calm this week">
          <p className="m-0 text-[14px] font-bold">This week, day by day</p>
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Mood, sleep and calm as scores out of a hundred. The physical, emotional and mental areas are built from these.</p>
          <div className="mt-sm">
            <MultiLine
              series={[
                { values: wb.data.week.map((w) => (w.mood === null ? null : ((w.mood - 1) / 4) * 100)), color: 'var(--color-r3)', label: 'Mood' },
                { values: wb.data.week.map((w) => (w.sleep === null ? null : (Math.max(4, Math.min(8, w.sleep)) - 4) * 25)), color: 'var(--color-r6)', label: 'Sleep' },
                { values: wb.data.week.map((w) => (w.stress === null ? null : ((5 - w.stress) / 4) * 100)), color: 'var(--color-r2)', label: 'Calm' },
              ]}
              max={100}
              labels={wb.data.week.map((w) => new Date(`${w.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }))}
              allLabels
              height={160}
              label="Mood, sleep and calm as scores out of a hundred for the last seven days"
              empty="Log a mood, a night or a stress level and the lines appear."
            />
          </div>
        </section>
      )}

      <PeriodPanel id="life-period" parts={['daily', 'notToDo', 'wellbeing', 'journal', 'finance', 'school']} />
      {d?.areas.map((a) => (
        <AreaCard key={a.key} area={a} />
      ))}

      <section className="mt-lg" id="move" aria-labelledby="move-heading">
        <h2 id="move-heading" className="text-[24px]">
          Log movement
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A walk, a run, a class. Minutes count toward the physical area, a hundred and fifty a week for full marks.</p>
        <form
          className="mt-sm flex gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            move.mutate();
          }}
        >
          <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" className="w-[120px] rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
          <Button type="submit" disabled={move.isPending}>
            {move.isSuccess ? 'Logged' : 'Add minutes'}
          </Button>
        </form>
      </section>
    </Screen>
  );
}

function AreaCard({ area }: { area: LifeArea }) {
  const meta = LIFE_AREAS[area.key];
  const rel = RELATIONSHIP_BY_KEY[meta.relationship];
  const trend = Math.round(area.trend);
  return (
    <section className="mt-lg" aria-labelledby={`area-${area.key}`}>
      <div className="rounded-card p-md" style={{ background: `var(--soft-${rel.key})` }}>
        <div className="flex items-center gap-sm">
          <Ring value={area.score / 100} size={72} stroke={8} color={rel.color} track="color-mix(in oklab, var(--color-ink) 14%, transparent)" label={`${meta.name} ${area.score} of 100`}>
            <span className="font-display text-[20px] font-extrabold">{area.score}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <h2 id={`area-${area.key}`} className="m-0 text-[24px]">
              <span aria-hidden="true">{meta.emoji} </span>
              {meta.name}
            </h2>
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{meta.blurb}</p>
            {trend !== 0 && (
              <p className="m-0 text-[12px] font-extrabold" style={{ color: `var(--deep-${rel.key})` }}>
                {trend > 0 ? `up ${trend}` : `down ${Math.abs(trend)}`} on last week
              </p>
            )}
          </div>
          <Avatar relationship={rel.key} size={40} decorative still />
        </div>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {area.parts.map((p) => (
            <li key={p.label}>
              <Link to={p.path} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm" title={p.hint}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{p.label}</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">{p.value}</span>
                </span>
                <span className="w-[96px] shrink-0">
                  <span className="block text-right text-[12px] font-extrabold text-ink-soft">{p.score === null ? 'no data' : p.score}</span>
                  <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                    <span className="block h-full rounded-pill" style={{ width: `${p.score ?? 0}%`, background: rel.color }} />
                  </span>
                </span>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-mute">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
        <Link to={meta.path} className="mt-sm inline-flex min-h-[44px] items-center text-[14px] font-bold underline-offset-4 hover:underline" style={{ color: `var(--deep-${rel.key})` }}>
          Open {meta.name.toLowerCase()} tools
        </Link>
      </div>
    </section>
  );
}
