import { NavLink } from 'react-router';

const TABS = [
  {
    to: '/today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    ),
  },
  {
    to: '/tower',
    label: 'Tower',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor">
        <rect x="3" y="17" width="18" height="4" rx="2" />
        <rect x="5" y="11" width="14" height="4" rx="2" />
        <rect x="7" y="5" width="10" height="4" rx="2" />
      </svg>
    ),
  },
  {
    to: '/leaderboard',
    label: 'Rank',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor">
        <rect x="9" y="4" width="6" height="17" rx="2" />
        <rect x="2" y="10" width="6" height="11" rx="2" />
        <rect x="16" y="13" width="6" height="8" rx="2" />
      </svg>
    ),
  },
  {
    to: '/you',
    label: 'You',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <path d="M8.5 14.5q3.5 3 7 0" />
      </svg>
    ),
  },
];

export function TabBar() {
  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card">
      <ul className="mx-auto flex max-w-[480px] list-none items-stretch justify-around p-0 m-0">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                `tab flex min-h-[64px] flex-col items-center justify-center gap-xs text-[12px] font-bold transition-colors ${isActive ? 'text-ink' : 'text-ink-mute hover:text-ink'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`tab-icon flex size-[36px] items-center justify-center rounded-pill transition-colors ${isActive ? 'bg-ink text-white' : ''}`}>{t.icon}</span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
