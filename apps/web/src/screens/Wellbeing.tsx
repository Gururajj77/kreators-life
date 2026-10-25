import { MOODS, STRESS_LEVELS, type LogKind } from '@kreators/shared';
import { Link } from 'react-router';
import { Donut, EmojiRow, Legend, Sparkline } from '../components/Charts';
import { Hero } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { Ring } from '../components/Ring';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { useMe, useWellbeing } from '../lib/queries';

const ROWS: { kind: LogKind; name: string; emoji: string; path: string; color: string; tint: string; max: number; format: (v: number | null) => string }[] = [
  { kind: 'mood', name: 'Mood', emoji: '🙂', path: '/mood', color: 'var(--color-r3)', tint: 'var(--tint-yellow)', max: 5, format: (v) => (v === null ? 'Not logged today' : (MOODS.find((m) => m.value === Math.round(v))?.name ?? '')) },
  { kind: 'sleep', name: 'Sleep', emoji: '🌙', path: '/sleep', color: 'var(--color-r6)', tint: 'var(--tint-purple)', max: 10, format: (v) => (v === null ? 'Not logged' : `${v} hours`) },
  { kind: 'stress', name: 'Stress', emoji: '🌊', path: '/stress', color: 'var(--color-r2)', tint: 'var(--tint-orange)', max: 5, format: (v) => (v === null ? 'Not logged' : STRESS_LEVELS[Math.round(v) - 1] ?? '') },
  { kind: 'mindful', name: 'Mindful minutes', emoji: '🧘', path: '/mindful', color: 'var(--color-r4)', tint: 'var(--tint-green)', max: 60, format: (v) => `${v ?? 0} min this week` },
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
        <h1 className="text-[30px]">Wellbeing</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">One score from your mood, sleep, stress, mindful minutes and streak. Tap a row to log today.</p>
      </header>
      {d && (
        <>
          <Hero color="var(--color-r4)" deep="var(--deep-lover_partner)" className="mt-md" character="lover_partner" mood={d.score >= 60 ? "excited" : d.score >= 40 ? "happy" : "sleepy"}>
            <div className="flex items-center gap-md">
              <Ring value={d.score / 100} size={112} stroke={12} color="var(--color-on-fill)" track="rgba(255,255,255,0.3)" label={`Wellbeing ${d.score} of 100`}>
                <span className="font-display text-[36px] font-extrabold">{d.score}</span>
              </Ring>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-display text-[28px] font-extrabold leading-tight">{d.label}</p>
                <p className="mt-xs m-0 text-[14px] font-semibold opacity-90">Scored over the last seven days. Logging every day keeps it honest.</p>
              </div>
            </div>
          </Hero>

          <section className="mt-md flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft" aria-label="What makes the score">
            <Donut segments={makeup.map((m) => ({ value: Math.round(m.value), color: m.color, label: m.label }))} size={132} stroke={20} label="What makes the score">
              <span className="flex flex-col items-center leading-none">
                <span className="font-display text-[24px] font-extrabold">{d.score}</span>
                <span className="mt-xs text-[12px] font-bold text-ink-soft">of 100</span>
              </span>
            </Donut>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[14px] font-bold">What makes it</p>
              <div className="mt-xs">
                <Legend items={makeup.map((m) => ({ color: m.color, label: m.label, text: `${Math.round(m.value)}` }))} />
              </div>
            </div>
          </section>

          <section className="mt-md rounded-tile bg-card p-sm shadow-toy-soft" aria-label="Mood this week">
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Mood history</p>
            <div className="mt-xs">
              <EmojiRow
                items={d.week.map((w) => {
                  const m = w.mood === null ? null : (MOODS.find((x) => x.value === w.mood) ?? null);
                  return { label: new Date(`${w.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), emoji: m?.emoji ?? null, color: m?.color ?? null, mood: m?.value ?? null };
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
                  <Link to={r.path} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                    {r.kind === 'mood' && p?.latest ? (
                      <MoodFace value={p.latest} size={48} />
                    ) : (
                      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill text-[22px]" style={{ background: r.tint }} aria-hidden="true">
                        {r.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold">{r.name}</span>
                      <span className="block text-[14px] font-semibold text-ink-soft">{r.format(p?.latest ?? null)}</span>
                    </span>
                    <Sparkline values={series} max={r.max} color={r.color} width={96} height={40} />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-md grid grid-cols-2 gap-xs">
            <Link to="/journal" className="toy toy-soft rounded-tile bg-card p-sm">
              <span className="block text-[22px]" aria-hidden="true">📓</span>
              <span className="block text-[16px] font-bold">Journal</span>
              <span className="block text-[14px] font-semibold text-ink-soft">Write it down</span>
            </Link>
            <Link to="/companion" className="toy toy-soft rounded-tile bg-card p-sm">
              <span className="block text-[22px]" aria-hidden="true">💬</span>
              <span className="block text-[16px] font-bold">Companion</span>
              <span className="block text-[14px] font-semibold text-ink-soft">Talk it through</span>
            </Link>
          </div>
        </>
      )}
    </Screen>
  );
}
