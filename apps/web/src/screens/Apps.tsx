import { MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { Link } from 'react-router';
import { Screen } from '../components/Screen';
import { useModules } from '../lib/modules';
import { useMe } from '../lib/queries';

const ORDER: ModuleGroup[] = ['earn', 'community', 'wellbeing', 'creator', 'manage', 'core'];

export function Apps() {
  const me = useMe();
  const { modules } = useModules();
  const unread = me.data?.unread ?? 0;
  const on = modules.filter((m) => m.on && !['home', 'today', 'tower'].includes(m.key));
  const offCount = modules.filter((m) => m.available && !m.on).length;

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Apps</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Everything in one place. Switch apps on or off under You.</p>
        <Link to="/search" className="toy toy-soft mt-md flex min-h-[48px] items-center gap-sm rounded-pill bg-card px-md text-[16px] font-semibold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          Search tasks, journals, library, products
        </Link>
      </header>
      {ORDER.map((g) => {
        const list = on.filter((m) => m.group === g);
        if (list.length === 0) return null;
        return (
          <section key={g} className="mt-lg" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="text-[18px]">
              {MODULE_GROUPS[g]}
            </h2>
            <ul className="mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0 md:grid-cols-3">
              {list.map((m) => (
                <li key={m.key}>
                  <Link to={m.path} className="toy toy-soft relative flex min-h-[96px] flex-col justify-start rounded-tile bg-card p-sm text-ink">
                    <span className="flex items-center gap-xs">
                      <span className="text-[24px] leading-none" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <span className="min-w-0 truncate text-[16px] font-bold leading-tight">{m.name}</span>
                    </span>
                    <span className="clamp-2 mt-xs block text-[14px] font-semibold leading-snug text-ink-soft">{m.blurb}</span>
                    {m.key === 'notifications' && unread > 0 && (
                      <span className="absolute top-sm right-sm rounded-pill bg-r1 px-xs text-[12px] font-extrabold leading-[20px] text-white">{unread}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {offCount > 0 && (
        <p className="mt-lg m-0 text-center text-[14px] font-semibold text-ink-soft">
          {offCount} more {offCount === 1 ? 'app is' : 'apps are'} switched off.{' '}
          <Link to="/you#features" className="underline underline-offset-4">
            Turn them on
          </Link>
        </p>
      )}
    </Screen>
  );
}
