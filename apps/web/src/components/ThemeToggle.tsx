import { useTheme, type ThemeMode } from '../lib/theme';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeMode, string> = { system: 'Matching your device. Switch to light.', light: 'Light. Switch to dark.', dark: 'Dark. Switch to match your device.' };

function Icon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light')
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    );
  if (mode === 'dark')
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
        <path d="M14.5 3a9 9 0 1 0 6.5 15.3A8 8 0 0 1 14.5 3z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** One button that cycles device, light, dark. Lives on every page. */
export function ThemeToggle({ className = '', floating = false }: { className?: string; floating?: boolean }) {
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={LABEL[mode]}
      title={LABEL[mode]}
      className={`toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card text-ink-soft hover:text-ink ${floating ? 'safe-top fixed top-sm right-md z-30' : ''} ${className}`}
    >
      <Icon mode={mode} />
    </button>
  );
}
