import { FOCUS_DEFAULTS, parseFocusSettings } from '@kreators/shared';

/**
 * The small part of lib/sound.ts the first screens need (split off 2026-11-07): the one shared audio context, `unlockAudio` and the ruler's
 * soft tick. The beats, chimes, breath cues and background sounds stay in lib/sound.ts, which loads with the screens that play them.
 */
let ctx: AudioContext | null = null;
export function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    return ctx;
  } catch {
    return null;
  }
}
/** Call from a tap (Start, a preview): lets the browser play sound later without another tap. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

/** The master switch as this device last saw it (the copy lib/focusPrefs.ts keeps by person); on when there is no copy yet. */
function soundIsOn(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith('kreators.focusPrefs.')) {
        const raw = localStorage.getItem(k);
        return raw ? parseFocusSettings(raw).sound : FOCUS_DEFAULTS.sound;
      }
    }
  } catch {
    // no storage: the default holds
  }
  return FOCUS_DEFAULTS.sound;
}
let lastTick = 0;
/**
 * A very soft tick for a ruler stepping past a mark: a few milliseconds of a high sine, almost no volume. Silent when the master switch is
 * off, when the browser has not yet let sound start (it never starts the audio by itself) and when ticks come faster than one every 35 ms.
 */
export function tickSound(): void {
  const c = audio();
  if (!c || c.state !== 'running' || !soundIsOn()) return;
  const now = performance.now();
  if (now - lastTick < 35) return;
  lastTick = now;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 1800;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.025, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}

