import { MODULE_GROUP_ACCENT, MODULE_GROUP_BLURB, MODULE_GROUPS, RELATIONSHIP_BY_KEY, type ModuleGroup } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useModules, type ModuleView } from '../lib/modules';
import { useMe, useRefreshAll } from '../lib/queries';

const ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'core', 'manage', 'internal'];

/**
 * The apps that are on, as a list, grouped, each group in its own colour. Apps that are off are not
 * shown here at all: one clear button at the top leads to Profile, Features, where every app is
 * switched on or off. Rank and rewards are part of the game, not apps.
 */
export function Apps() {
  const me = useMe();
  const { modules } = useModules();
  const refresh = useRefreshAll();
  const unread = me.data?.unread ?? 0;
  const [asking, setAsking] = useState<ModuleView | null>(null);
  const enable = useMutation({
    mutationFn: (key: string) => api.setModule(key, true),
    onSuccess: async () => {
      await refresh();
      setAsking(null);
    },
  });
  const available = modules.filter((m) => !m.locked && m.available);
  const listed = available.filter((m) => m.on);
  const offCount = available.length - listed.length;

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Apps</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {listed.length} on. Tap one to open it.
        </p>
        <Link to="/you#features" className="toy mt-md flex items-center gap-sm rounded-card bg-ink p-md text-on-ink" style={{ '--toy-color': 'var(--color-ink)' } as CSSProperties}>
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-on-ink/15 text-[24px]" aria-hidden="true">
            🧩
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-extrabold leading-tight">Turn apps on or off</span>
            <span className="mt-xs block text-[14px] font-semibold text-on-ink/70">{offCount > 0 ? `${offCount} more ${offCount === 1 ? 'app is' : 'apps are'} waiting. Switch on only what you need.` : 'Every app is on. Switch off what you do not use.'}</span>
          </span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <div className="mt-md">
          <SearchBox placeholder="Search tasks, journals, library, products, people" />
        </div>
      </header>

      {ORDER.map((g) => {
        const list = listed.filter((m) => m.group === g);
        if (list.length === 0) return null;
        const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[g]];
        const on = list.filter((m) => m.on).length;
        return (
          <section key={g} className="span-all mt-lg" aria-labelledby={`g-${g}`}>
            <div className="flex items-center gap-sm rounded-card p-sm" style={{ background: `var(--soft-${rel.key})` }}>
              <Avatar relationship={rel.key} size={40} decorative still mood={on > 0 ? 'happy' : 'sleepy'} />
              <div className="min-w-0 flex-1">
                <h2 id={`g-${g}`} className="text-[18px]">
                  {MODULE_GROUPS[g]}
                </h2>
                <p className="m-0 text-[12px] font-bold" style={{ color: `var(--deep-${rel.key})` }}>
                  {MODULE_GROUP_BLURB[g]}
                </p>
              </div>
              <span className="shrink-0 rounded-pill bg-card px-xs text-[12px] font-extrabold leading-[24px]" style={{ color: `var(--deep-${rel.key})` }}>
                {on} on
              </span>
            </div>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {list.map((m) => (
                <li key={m.key}>
                  <AppRow m={m} color={rel.color} tint={`var(--soft-${rel.key})`} unread={m.key === 'notifications' ? unread : 0} onAsk={() => setAsking(m)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="span-all mt-lg m-0 rounded-tile bg-paper p-sm text-center text-[14px] font-semibold text-ink-soft">Rank and rewards are part of the game and live under Profile.</p>

      <Sheet open={Boolean(asking)} onClose={() => setAsking(null)} title={asking ? `Switch on ${asking.name}?` : 'Switch on'}>
        {asking && (
          <div>
            <div className="flex items-center gap-sm">
              <span className="flex size-[56px] shrink-0 items-center justify-center rounded-pill text-[28px]" style={{ background: `var(--soft-${MODULE_GROUP_ACCENT[asking.group]})` }} aria-hidden="true">
                {asking.emoji}
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[16px] font-bold">{asking.name}</p>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">{asking.blurb}</p>
              </div>
            </div>
            <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Once it is on it opens from here, from Home and from the sidebar on a laptop. You can switch it off any time under Profile, Features.</p>
            {enable.isError && (
              <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                Could not switch it on. Try again.
              </p>
            )}
            <div className="mt-md flex gap-xs">
              <Button size="lg" className="flex-1" disabled={enable.isPending} onClick={() => enable.mutate(asking.key)}>
                {enable.isPending ? 'Switching on' : `Switch on ${asking.name}`}
              </Button>
              <Button variant="outline" size="lg" onClick={() => setAsking(null)} disabled={enable.isPending}>
                Not now
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

/** One row: the app's icon in its group colour, name, blurb, and either a chevron (on) or "off" (grey, tap to switch on). */
function AppRow({ m, color, tint, unread, onAsk }: { m: ModuleView; color: string; tint: string; unread: number; onAsk: () => void }) {
  const inner = (
    <>
      <span className={`flex size-[48px] shrink-0 items-center justify-center rounded-pill text-[24px] ${m.on ? '' : 'grayscale'}`} style={{ background: m.on ? tint : 'var(--color-line)' }} aria-hidden="true">
        {m.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-xs text-[16px] font-bold leading-tight ${m.on ? '' : 'text-ink-soft'}`}>
          {m.name}
          {unread > 0 && m.on && <span className="rounded-pill bg-r1 px-xs text-[11px] font-extrabold leading-[18px] text-on-fill">{unread}</span>}
        </span>
        <span className={`mt-xs block text-[14px] font-semibold leading-snug ${m.on ? 'text-ink-soft' : 'text-ink-mute'}`}>{m.blurb}</span>
      </span>
      {m.on ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-mute">
          <path d="M9 5l7 7-7 7" />
        </svg>
      ) : (
        <span className="shrink-0 rounded-pill border-2 border-line px-sm text-[12px] font-extrabold leading-[28px] text-ink-mute">Off</span>
      )}
    </>
  );
  if (m.on) {
    return (
      <Link to={m.path} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink" style={{ borderLeft: `6px solid ${color}` } as CSSProperties}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onAsk} className="toy toy-flat flex w-full items-center gap-sm rounded-tile border-2 border-dashed border-line bg-paper p-sm text-left text-ink" aria-label={`${m.name} is off. Switch it on`}>
      {inner}
    </button>
  );
}
