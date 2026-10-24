import { LIFE_AREAS, RELATIONSHIP_BY_KEY, type LifeArea } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

/** Five areas of a life on one screen, each part opening the place where you act on it. */
export function Life() {
  const q = useAuthed(['life'], api.life);
  const d = q.data;
  const [minutes, setMinutes] = useState('30');
  const move = useMutation({ mutationFn: () => api.log('move', { value: Number(minutes) || 30 }), onSuccess: () => q.refetch() });

  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/apps" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Apps
        </Link>
        <h1 className="text-[30px]">Life</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Physical, financial, emotional, mental and spiritual, scored from what you already log. Tap any part to go where you act on it. Only you see this.</p>
        {d && (
          <div className="mt-md flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
            <Ring value={d.overall / 100} size={96} stroke={10} color="var(--color-ink)" track="color-mix(in oklab, var(--color-ink) 18%, transparent)" label={`Overall ${d.overall} of 100`}>
              <span className="font-display text-[24px] font-extrabold">{d.overall}</span>
            </Ring>
            <div className="min-w-0">
              <p className="m-0 text-[22px] font-extrabold leading-tight">{d.label}</p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">The average of the five areas. Parts with nothing logged do not count against you.</p>
            </div>
          </div>
        )}
      </header>

      {q.isError && (
        <p role="alert" className="span-all mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load your dashboard. Try again in a moment.
        </p>
      )}

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
                  <span className="mt-[4px] block h-[6px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
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
