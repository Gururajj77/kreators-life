import { MOODS, STRESS_LEVELS, type LogKind } from '@kreators/shared';
import { Link } from 'react-router';
import { Sparkline } from '../components/Charts';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { useWellbeing } from '../lib/queries';

const ROWS: { kind: LogKind; name: string; emoji: string; path: string; color: string; max: number; format: (v: number | null) => string }[] = [
  { kind: 'mood', name: 'Mood', emoji: '🙂', path: '/mood', color: '#FACC15', max: 5, format: (v) => (v === null ? 'Not logged today' : (MOODS.find((m) => m.value === Math.round(v))?.name ?? '')) },
  { kind: 'sleep', name: 'Sleep', emoji: '🌙', path: '/sleep', color: '#7F45E2', max: 10, format: (v) => (v === null ? 'Not logged' : `${v} hours`) },
  { kind: 'stress', name: 'Stress', emoji: '🌊', path: '/stress', color: '#FB8728', max: 5, format: (v) => (v === null ? 'Not logged' : STRESS_LEVELS[Math.round(v) - 1] ?? '') },
  { kind: 'mindful', name: 'Mindful minutes', emoji: '🧘', path: '/mindful', color: '#9BB068', max: 60, format: (v) => `${v ?? 0} min this week` },
];

export function Wellbeing() {
  const q = useWellbeing();
  const d = q.data;
  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Wellbeing</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">One score from your mood, sleep, stress, mindful minutes and streak. Tap a row to log today.</p>
      </header>
      {d && (
        <>
          <div className="mt-md flex items-center gap-md rounded-card bg-r4 p-md text-ink-fixed">
            <Ring value={d.score / 100} size={96} stroke={10} color="var(--color-ink)" track="color-mix(in oklab, var(--color-ink) 18%, transparent)" label={`Wellbeing ${d.score} of 100`}>
              <span className="font-display text-[30px] font-extrabold">{d.score}</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-display text-[24px] font-extrabold leading-tight">{d.label}</p>
              <p className="mt-xs m-0 text-[14px] font-semibold">Scored over the last seven days. Logging every day keeps it honest.</p>
            </div>
          </div>
          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {ROWS.map((r) => {
              const part = d.parts.find((p) => p.kind === r.kind);
              const series = d.week.map((w) => (r.kind === 'mindful' ? w.mindful : w[r.kind]));
              return (
                <li key={r.kind}>
                  <Link to={r.path} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                    <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill text-[22px]" style={{ background: r.color }} aria-hidden="true">
                      {r.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold">{r.name}</span>
                      <span className="block text-[14px] font-semibold text-ink-soft">{r.format(part?.latest ?? null)}</span>
                    </span>
                    <Sparkline values={series} max={r.max} color={r.color} />
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
