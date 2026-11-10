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
import { FIELD_LINE } from '../lib/ui';
import { useAuthed, useWellbeing } from '../lib/queries';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { ArrowUpRight } from 'lucide-react';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { weekday } from '../lib/date';

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
        <h1 className="text-large-title">Life</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Physical, financial, mental, emotional and spiritual, scored from what you already log. Tap any part to go where you act on it. Only you see this.</p>
        {d && (
          <Hero color="var(--color-r4)" deep="var(--deep-lover_partner)" className="mt-md" character="lover_partner" mood={d.overall >= 60 ? "excited" : d.overall >= 40 ? "happy" : "sleepy"}>
            <p className="m-0 text-eyebrow uppercase opacity-90">Life score</p>
            {/* A phone stacks the word and its line under the gauge, so they keep the card's width instead of a sliver beside it. */}
            <div className="mt-xs flex flex-col items-start gap-xs sm:flex-row sm:items-center sm:gap-md">
              <Gauge value={d.overall / 100} size={128} stroke={14} color="var(--color-on-fill)" track="rgba(255,255,255,0.3)" label={`Overall ${d.overall} of 100`}>
                <span className="text-figure-lg type-figure">{d.overall}</span>
              </Gauge>
              <div className="min-w-0">
                <p className="m-0 text-title1">{d.label}</p>
                <p className="prose-long mt-xs m-0 text-prose opacity-90">The average of the five areas. Parts with nothing logged do not count against{'\u00a0'}you.</p>
              </div>
            </div>
          </Hero>
        )}
      </header>

      {d && (
        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="The five areas this week">
          <div className="flex items-baseline justify-between gap-sm">
            {/* Kept whole up to the comma, so a narrow phone breaks it there (the rectangle rule). */}
            <p className="m-0 text-headline">
              <span className="inline-block">The five areas,</span> <span className="inline-block">this week</span>
            </p>
            <p className="m-0 text-caption text-ink-soft">
              <span className="inline-block size-[10px] rounded-pill bg-r2" aria-hidden="true" /> down on last week
            </p>
          </div>
          <div className="mt-sm">
            <PillBars allLabels values={d.areas.map((a) => a.score)} max={100} labels={d.areas.map((a) => LIFE_AREAS[a.key].name)} colors={d.areas.map((a) => (Math.round(a.trend) < 0 ? 'var(--color-r2)' : RELATIONSHIP_BY_KEY[LIFE_AREAS[a.key].relationship].color))} color="var(--color-r4)" label="Score per area" height={120} />
          </div>
          <p className="mt-sm m-0 text-caption text-ink-soft">
            {d.areas.filter((a) => Math.round(a.trend) !== 0).map((a) => `${LIFE_AREAS[a.key].name} ${Math.round(a.trend) > 0 ? 'up' : 'down'} ${Math.abs(Math.round(a.trend))}`).join(', ') || 'Same as last week so far.'}
          </p>
        </section>
      )}

      {q.isError && (
        <p role="alert" className="span-all mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          Could not load your dashboard. Try again in a moment.
        </p>
      )}

      {wb.data && (
        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="Sleep, calm and mood this week">
          <p className="m-0 text-headline">This week, day by day</p>
          <p className="mt-xs m-0 text-caption text-ink-soft">Sleep, calm and mood as scores out of a hundred. The physical, mental and emotional areas are built from these.</p>
          <div className="mt-sm">
            <MultiLine
              series={[
                { values: wb.data.week.map((w) => (w.sleep === null ? null : (Math.max(4, Math.min(8, w.sleep)) - 4) * 25)), color: 'var(--color-r6)', label: 'Sleep' },
                { values: wb.data.week.map((w) => (w.stress === null ? null : ((5 - w.stress) / 4) * 100)), color: 'var(--color-r2)', label: 'Calm' },
                { values: wb.data.week.map((w) => (w.mood === null ? null : ((w.mood - 1) / 4) * 100)), color: 'var(--color-r3)', label: 'Mood' },
              ]}
              max={100}
              labels={wb.data.week.map((w) => weekday(w.date))}
              allLabels
              height={160}
              label="Sleep, calm and mood as scores out of a hundred for the last seven days"
              empty="Log a night, a stress level or a mood and the lines appear."
            />
          </div>
        </section>
      )}

      {/* Each area's own numbers come with the score and the week (the spacing pass, 2026-11-07: they had sat under Emerging, as if they
          were its cards); then By period, and Emerging after the numbers, as on every screen. */}
      {d?.areas.map((a) => (
        <AreaCard key={a.key} area={a} />
      ))}
      <PeriodPanel id="life-period" parts={['daily', 'notToDo', 'wellbeing', 'journal', 'finance', 'school']} />
      {/* Always shown here, as on Home (the founder, 2026-11-06: "previously there was emergence in life app, add it back"). */}
      <EmergenceSlot app="life" max={2} always />

      <section className="mt-lg" id="move" aria-labelledby="move-heading">
        <h2 id="move-heading" className="text-title2">
          Log movement
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">A walk, a run, a class. Minutes count toward the physical area, a hundred and fifty a week for full marks.</p>
        <form
          className="mt-sm flex gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            move.mutate();
          }}
        >
          <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" className={`${FIELD_LINE} min-w-0 flex-1`} />
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
      <div data-pillar={rel.key} className="rounded-card p-md" style={{ background: `var(--soft-${rel.key})` }}>
        <div className="flex items-center gap-sm">
          <Ring value={area.score / 100} size={72} stroke={8} color={rel.color} track="color-mix(in oklab, var(--color-ink) 14%, transparent)" label={`${meta.name} ${area.score} of 100`}>
            <span className="text-title3 type-figure">{area.score}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            {/* On a laptop the title and its link share the top row, the link at the right. Its box is one title line tall and centres on
                it, so its 44px tap area never pushes the lines below down. Below that width the middle column is too narrow for both: the
                link went under the title, between it and its own line, so it sits at the card's foot instead (the spacing pass, 2026-11-07). */}
            <div className="flex items-center justify-between gap-x-sm">
              <h2 id={`area-${area.key}`} className="m-0 flex min-w-0 items-center gap-xs text-title2">
                <AppIcon name={meta.icon} size={24} />
                {meta.name}
              </h2>
              <div className="ml-auto hidden h-[26px] shrink-0 items-center lg:flex">
                <AreaLink area={area} />
              </div>
            </div>
            {/* Each part up to a comma kept whole, so a narrow phone breaks the line there and never leaves a short one (the rectangle rule). */}
            <p className="m-0 text-subhead text-ink-soft">
              {meta.blurb.split(', ').map((part, i, all) => (
                <span key={part}>
                  {i > 0 && ' '}
                  <span className="inline-block">{i < all.length - 1 ? `${part},` : part}</span>
                </span>
              ))}
            </p>
            {trend !== 0 && (
              <p className="m-0 text-caption font-semibold" style={{ color: `var(--deep-${rel.key})` }}>
                {trend > 0 ? `up ${trend}` : `down ${Math.abs(trend)}`} on last week
              </p>
            )}
          </div>
          <Avatar relationship={rel.key} size={40} decorative still />
        </div>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {area.parts.map((p) => (
            <li key={p.label}>
              <Link to={p.path} className="group toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm" title={p.hint}>
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{p.label}</span>
                  <span className="block text-card-note text-ink-soft">{p.value}</span>
                </span>
                <span className="w-[96px] shrink-0">
                  <span className="block text-right text-caption text-ink-soft">{p.score === null ? 'no data' : p.score}</span>
                  <span className="mt-xs block h-[6px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                    <span className="block h-full rounded-pill" style={{ width: `${p.score ?? 0}%`, background: rel.color }} />
                  </span>
                </span>
                <Icon icon={ArrowUpRight} size={18} strokeWidth={3} className="transition-transform motion-safe:group-hover:translate-x-xs motion-safe:group-hover:-translate-y-xs shrink-0 text-ink-mute" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-xs flex justify-end lg:hidden">
          <AreaLink area={area} />
        </div>
      </div>
    </section>
  );
}

function AreaLink({ area }: { area: LifeArea }) {
  const meta = LIFE_AREAS[area.key];
  const rel = RELATIONSHIP_BY_KEY[meta.relationship];
  return (
    <Link to={meta.path} className="inline-flex min-h-[44px] items-center text-subhead font-semibold underline-offset-4 hover:underline" style={{ color: `var(--deep-${rel.key})` }}>
      Open {meta.name.toLowerCase()} tools
    </Link>
  );
}
