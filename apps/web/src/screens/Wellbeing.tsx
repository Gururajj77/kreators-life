import { MODULE_BY_KEY, MOODS, STRESS_LEVELS, type LogKind, LOCALE } from '@kreators/shared';
import { AppIcon } from '../components/AppIcon';
import { Link } from 'react-router';
import { PeriodPanel } from '../components/PeriodPanel';
import { Donut, EmojiRow, Gauge, Legend, Sparkline } from '../components/Charts';
import { Hero } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { Ring } from '../components/Ring';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { useMe, useWellbeing } from '../lib/queries';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { ArrowUpRight } from 'lucide-react';
import { CardHead } from '../components/CardHead';
import { Icon } from '../components/Icon';
import '../components/fx/spotlight';

/** The four trackers; each wears its app's own icon from the registry. */
const ROWS: { kind: LogKind; name: string; path: string; color: string; pillar: 'parent_child' | 'guru' | 'friendship' | 'lover_partner'; tint: string; max: number; format: (v: number | null) => string }[] = [
  { kind: 'mood', name: 'Mood', path: '/mood', color: 'var(--color-r3)', pillar: 'parent_child', tint: 'var(--tint-yellow)', max: 5, format: (v) => (v === null ? 'Not logged today' : (MOODS.find((m) => m.value === Math.round(v))?.name ?? '')) },
  { kind: 'sleep', name: 'Sleep', path: '/sleep', color: 'var(--color-r6)', pillar: 'guru', tint: 'var(--tint-purple)', max: 10, format: (v) => (v === null ? 'Not logged' : `${v} hours`) },
  { kind: 'stress', name: 'Stress', path: '/stress', color: 'var(--color-r2)', pillar: 'friendship', tint: 'var(--tint-orange)', max: 5, format: (v) => (v === null ? 'Not logged' : STRESS_LEVELS[Math.round(v) - 1] ?? '') },
  { kind: 'mindful', name: 'Mindfulness', path: '/mindful', color: 'var(--color-r4)', pillar: 'lover_partner', tint: 'var(--tint-green)', max: 60, format: (v) => `${v ?? 0} min this week` },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** One score from mood, sleep, stress, mindful minutes and the streak, drawn the way the kit draws its score screen. */
export function Wellbeing() {
  const q = useWellbeing();
  const me = useMe();
  const d = q.data;
  const streak = me.data?.user.streak ?? 0;
  // The same arithmetic as the server, so the donut explains the number above it.
  const part = (kind: LogKind) => d?.parts.find((p) => p.kind === kind) ?? null;
  const moodAvg = part('mood')?.avg7 ?? null;
  const sleepAvg = part('sleep')?.avg7 ?? null;
  const stressAvg = part('stress')?.avg7 ?? null;
  const mindfulTotal = part('mindful')?.latest ?? 0;
  const makeup = [
    { label: 'Mood', value: (moodAvg === null ? 50 : ((moodAvg - 1) / 4) * 100) * 0.35, color: 'var(--color-r3)' },
    { label: 'Sleep', value: (sleepAvg === null ? 50 : (clamp(sleepAvg, 4, 8) - 4) * 25) * 0.25, color: 'var(--color-r6)' },
    { label: 'Stress', value: (stressAvg === null ? 50 : ((5 - stressAvg) / 4) * 100) * 0.2, color: 'var(--color-r2)' },
    { label: 'Mindful', value: (clamp(mindfulTotal, 0, 60) / 0.6) * 0.1, color: 'var(--color-r4)' },
    { label: 'Streak', value: (clamp(streak, 0, 7) / 0.07) * 0.1, color: 'var(--color-r5)' },
  ];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-large-title">Wellbeing</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">One score from your mood, sleep, stress, mindful minutes and streak. Tap a row to log today.</p>
        {d && (
          <Hero color="var(--color-r4)" deep="var(--deep-lover_partner)" className="mt-md" character="lover_partner" mood={d.score >= 60 ? 'excited' : d.score >= 40 ? 'happy' : 'sleepy'}>
            <p className="m-0 text-eyebrow uppercase opacity-90">Wellbeing score</p>
            {/* A phone stacks the word and its line under the gauge, so they keep the card's width instead of a sliver beside it. */}
            <div className="mt-xs flex flex-col items-start gap-xs sm:flex-row sm:items-center sm:gap-md">
              <Gauge value={d.score / 100} size={128} stroke={14} color="var(--color-on-fill)" track="rgba(255,255,255,0.3)" label={`Wellbeing ${d.score} of 100`}>
                <span className="text-figure-lg type-figure">{d.score}</span>
              </Gauge>
              <div className="min-w-0">
                <p className="m-0 text-title1">{d.label}</p>
                <p className="mt-xs m-0 text-subhead opacity-90">Scored over the last seven days. Logging every day keeps it{'\u00a0'}honest.</p>
              </div>
            </div>
          </Hero>
        )}
      </header>
      <PeriodPanel id="wellbeing-period" parts={['wellbeing', 'journal']} />
      <EmergenceSlot app="wellbeing" max={2} />
      {d && (
        <>

          <section className="mt-md flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft" aria-label="What makes the score">
            <Donut segments={makeup.map((m) => ({ value: Math.round(m.value), color: m.color, label: m.label }))} size={132} stroke={20} label="What makes the score">
              <span className="flex flex-col items-center leading-none">
                <span className="text-title2 type-figure">{d.score}</span>
                <span className="mt-xs text-caption text-ink-soft">of 100</span>
              </span>
            </Donut>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-headline">What makes it</p>
              <div className="mt-xs">
                <Legend items={makeup.map((m) => ({ color: m.color, label: m.label, text: `${Math.round(m.value)}` }))} />
              </div>
            </div>
          </section>

          <section className="mt-md rounded-tile bg-card p-sm shadow-toy-soft" aria-label="Mood this week">
            <p className="m-0 text-eyebrow uppercase text-ink-soft">Mood history</p>
            <div className="mt-xs">
              <EmojiRow
                items={d.week.map((w) => {
                  const m = w.mood === null ? null : (MOODS.find((x) => x.value === w.mood) ?? null);
                  return { label: new Date(`${w.date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'short' }).slice(0, 2), color: m?.color ?? null, mood: m?.value ?? null };
                })}
              />
            </div>
          </section>

          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {ROWS.map((r) => {
              const p = d.parts.find((x) => x.kind === r.kind);
              const series = d.week.map((w) => (r.kind === 'mindful' ? w.mindful : r.kind === 'move' ? null : w[r.kind]));
              return (
                <li key={r.kind}>
                  <Link to={r.path} data-pillar={r.pillar} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                    {r.kind === 'mood' && p?.latest ? (
                      <MoodFace value={p.latest} size={48} />
                    ) : (
                      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill text-ink" style={{ background: r.tint }}>
                        <AppIcon name={MODULE_BY_KEY[r.kind]?.icon} size={22} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-headline">{r.name}</span>
                      <span className="block text-subhead text-ink-soft">{r.format(p?.latest ?? null)}</span>
                    </span>
                    <Sparkline values={series} max={r.max} color={r.color} width={96} height={40} />
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Two doors, placed by the card rule: the name at the top left, the app's icon in the top right corner, the line at the foot on
              the left and an arrow at the bottom right that nudges on hover. */}
          <div className="mt-md grid grid-cols-2 gap-xs">
            {[
              { to: '/journal', name: 'Journal', line: 'Write it down', icon: MODULE_BY_KEY.journal?.icon },
              { to: '/companion', name: 'Companion', line: 'Talk it through', icon: MODULE_BY_KEY.companion?.icon },
            ].map((t) => (
              <Link key={t.to} to={t.to} className="fx-spot toy toy-soft group flex min-h-[112px] flex-col rounded-tile bg-card p-sm text-ink">
                <CardHead
                  tag={
                    <span className="flex size-[44px] items-center justify-center rounded-inner bg-paper text-ink-soft" aria-hidden="true">
                      <AppIcon name={t.icon} size={22} />
                    </span>
                  }
                >
                  <span className="block text-headline">{t.name}</span>
                </CardHead>
                <span className="mt-auto flex items-end justify-between gap-xs pt-sm">
                  <span className="min-w-0 text-subhead text-ink-soft">{t.line}</span>
                  <Icon icon={ArrowUpRight} size={16} className="read-arrow mb-[2px] shrink-0 text-ink-mute" />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
