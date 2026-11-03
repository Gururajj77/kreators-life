import { BADGE_FAMILIES, BADGE_FAMILY_META, BADGE_TIER_LABEL, BADGE_TIERS, BADGES, badgeProgress, type Badge, type BadgeTier, type HeldBadge } from '@kreators/shared';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { bento } from '../lib/bento';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { BadgeArt } from './BadgeArt';
import { Sheet } from './Sheet';
import { Busy, Skeleton } from './Skeleton';

/**
 * The badge gallery under Profile: every badge by family, the ones you hold first, then the ones still to earn with the exact next step and,
 * where it can be counted, how far along you are. Tap one for the big medal and its details. Counts come from `GET /me/badges`; nothing here
 * reads what you wrote. Badges from the journal, money and focus time are marked private and stay on your own screens.
 */
const SEEN = 'kreators.badgesSeen';
const FRESH_MS = 10 * 60_000;

function readSeen(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function writeSeen(keys: Set<string>) {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...keys].slice(-200)));
  } catch {
    /* private window or full storage: the shine may play again, nothing else */
  }
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="block h-[8px] w-full overflow-hidden rounded-pill bg-line">
      <span className="block h-full rounded-pill bg-ink" style={{ width: `${pct}%` }} />
    </span>
  );
}

function Tile({ b, held, count, fresh, onOpen }: { b: Badge; held: HeldBadge | undefined; count: number; fresh: boolean; onOpen: () => void }) {
  const earned = Boolean(held);
  const p = badgeProgress(b, count);
  return (
    <button type="button" onClick={onOpen} className="toy toy-soft flex min-h-[44px] w-full flex-col items-center gap-xs rounded-tile bg-card p-sm text-center">
      <BadgeArt name={b.name} icon={b.icon} tier={b.tier} shape={BADGE_FAMILY_META[b.family].shape} earned={earned} size="md" shine={fresh} decorative />
      <span className="text-[14px] font-extrabold">{b.name}</span>
      <span className="text-[12px] font-bold text-ink-soft">
        {earned ? (held?.at ? `Earned ${day(held.at)}` : held?.given ? 'Given by the team' : 'Earned') : 'Locked'} · {BADGE_TIER_LABEL[b.tier]}
      </span>
      {!earned && <span className="text-[12px] font-semibold text-ink-soft">{b.how}</span>}
      {!earned && p.countable && (
        <span className="mt-auto flex w-full flex-col gap-xs">
          <Bar pct={p.pct} label={`${b.name}: ${p.label}`} />
          <span className="text-[12px] font-bold text-ink-soft">{p.label}</span>
        </span>
      )}
    </button>
  );
}

function Detail({ b, held, count, onClose }: { b: Badge | null; held: HeldBadge | undefined; count: number; onClose: () => void }) {
  const p = b ? badgeProgress(b, count) : null;
  const earned = Boolean(held);
  return (
    <Sheet open={b !== null} onClose={onClose} title={b?.name ?? 'Badge'}>
      {b && p && (
        <div className="flex flex-col items-center gap-sm text-center">
          <BadgeArt name={b.name} icon={b.icon} tier={b.tier} shape={BADGE_FAMILY_META[b.family].shape} earned={earned} size="lg" decorative />
          <p className="m-0 text-[14px] font-bold text-ink-soft">
            {BADGE_TIER_LABEL[b.tier]} · {b.family}
          </p>
          <p className="m-0 text-[16px] font-semibold">{b.how}.</p>
          <p className="m-0 text-[14px] font-extrabold">{earned ? 'Earned' : 'Locked'}</p>
          {earned ? (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{held?.at ? `Earned on ${day(held.at)}.` : held?.given ? 'Given by the kreators.app team.' : 'Earned before dates were kept.'}</p>
          ) : (
            <div className="flex w-full flex-col gap-xs">
              {p.countable && <Bar pct={p.pct} label={`${b.name}: ${p.label}`} />}
              <p className="m-0 text-[14px] font-semibold text-ink-soft">{p.countable ? p.label : 'Not earned yet.'}</p>
            </div>
          )}
          {BADGE_FAMILY_META[b.family].private && <p className="m-0 text-[12px] font-semibold text-ink-soft">Only you see this one. It never shows on your page or the leaderboard.</p>}
        </div>
      )}
    </Sheet>
  );
}

export function BadgeGallery() {
  const q = useAuthed(['badges'], api.badges);
  const [tierPick, setTierPick] = useParamState('badgeTier', 'all');
  const tier = (BADGE_TIERS as readonly string[]).includes(tierPick) ? (tierPick as BadgeTier) : null;
  const [open, setOpen] = useState<string | null>(null);

  const held = useMemo(() => new Map((q.data?.held ?? []).map((h) => [h.key, h])), [q.data]);
  // A badge earned in the last few minutes that this device has not shown yet plays its shine once.
  const fresh = useMemo(() => {
    const seen = readSeen();
    return new Set((q.data?.held ?? []).filter((h) => h.at && Date.now() - Date.parse(h.at) < FRESH_MS && !seen.has(h.key)).map((h) => h.key));
  }, [q.data]);
  useEffect(() => {
    if (fresh.size === 0) return;
    const seen = readSeen();
    for (const k of fresh) seen.add(k);
    writeSeen(seen);
  }, [fresh]);

  const shown = BADGES.filter((b) => !tier || b.tier === tier);
  const total = BADGES.length;
  const have = BADGES.filter((b) => held.has(b.key)).length;
  const openBadge = open ? (BADGES.find((b) => b.key === open) ?? null) : null;

  return (
    <section aria-labelledby="badges-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-xs">
        <h2 id="badges-heading" className="text-[24px]">
          Badges
        </h2>
        {q.data && (
          <p className="m-0 text-[14px] font-extrabold" aria-live="polite">
            {have} of {total} earned
          </p>
        )}
      </div>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Medals the app earns for you by its own count. Tap one for the next step.</p>

      <div className="scroll-row mt-sm flex gap-xs" role="group" aria-label="Filter by tier">
        {(['all', ...BADGE_TIERS] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={(t === 'all' && !tier) || t === tier}
            onClick={() => setTierPick(t)}
            className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${(t === 'all' && !tier) || t === tier ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
          >
            {t === 'all' ? 'All' : BADGE_TIER_LABEL[t]}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <Busy label="Loading your badges" className="mt-md">
          <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[176px]" />
            ))}
          </div>
        </Busy>
      )}
      {q.isError && <p className="mt-md text-[14px] font-semibold text-ink-soft">Could not load your badges. Try again in a moment.</p>}

      {q.data &&
        BADGE_FAMILIES.map((f) => {
          const own = shown.filter((b) => b.family === f);
          if (own.length === 0) return null;
          // The ones you hold come first, then the ones to earn, each group in the order they are listed.
          const ordered = [...own.filter((b) => held.has(b.key)), ...own.filter((b) => !held.has(b.key))];
          const got = BADGES.filter((b) => b.family === f && held.has(b.key)).length;
          const all = BADGES.filter((b) => b.family === f).length;
          return (
            <section key={f} className="mt-md" aria-labelledby={`badge-family-${f.replace(/\s+/g, '-')}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-xs">
                <h3 id={`badge-family-${f.replace(/\s+/g, '-')}`} className="text-[16px]">
                  {f}
                </h3>
                <p className="m-0 text-[12px] font-extrabold text-ink-soft">
                  {got} of {all}
                </p>
              </div>
              <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{BADGE_FAMILY_META[f].blurb}</p>
              <ul className="mt-sm grid list-none grid-cols-2 gap-sm p-0 m-0 md:grid-cols-4">
                {ordered.map((b, i) => (
                  <li key={b.key} className={bento(i, ordered.length, 2, 4)}>
                    <Tile b={b} held={held.get(b.key)} count={q.data.progress[b.stat] ?? 0} fresh={fresh.has(b.key)} onOpen={() => setOpen(b.key)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      <Detail b={openBadge} held={openBadge ? held.get(openBadge.key) : undefined} count={openBadge ? (q.data?.progress[openBadge.stat] ?? 0) : 0} onClose={() => setOpen(null)} />
    </section>
  );
}
