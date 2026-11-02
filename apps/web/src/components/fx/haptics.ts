import { FOCUS_DEFAULTS, parseFocusSettings } from '@kreators/shared';

/**
 * A tiny tick on a phone that can buzz (navigator.vibrate), only when the person's own Vibrate setting (Mindful, Sounds) is on.
 * The setting is the one already kept on this device by person (lib/focusPrefs.ts); with no copy yet the default applies.
 */
export function tick(ms = 8): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    let on = FOCUS_DEFAULTS.vibrate;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('kreators.focusPrefs.')) {
        const raw = localStorage.getItem(k);
        if (raw) on = parseFocusSettings(raw).vibrate;
        break;
      }
    }
    if (on) navigator.vibrate(ms);
  } catch {
    // no storage or no vibration: nothing to do
  }
}
