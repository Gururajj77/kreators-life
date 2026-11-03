import { useTheme, type ThemeMode } from '../lib/theme';
import { Moon, Sun, SunMoon } from 'lucide-react';
import { Icon as Glyph } from './Icon';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeMode, string> = { system: 'Matching your device. Switch to light.', light: 'Light. Switch to dark.', dark: 'Dark. Switch to match your device.' };

/** The mode the page is in: the sun, the moon, or both for "match your device". */
function Icon({ mode }: { mode: ThemeMode }) {
  return <Glyph icon={mode === 'light' ? Sun : mode === 'dark' ? Moon : SunMoon} size={22} />;
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
      className={`toy toy-soft flex size-[44px] items-center justify-center rounded-pill bg-card-strong text-ink-soft hover:text-ink ${floating ? 'safe-top fixed top-sm right-md z-30' : ''} ${className}`}
    >
      <Icon mode={mode} />
    </button>
  );
}
