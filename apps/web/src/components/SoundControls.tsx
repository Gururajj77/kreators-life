import { AMBIENT_SOUNDS, BREAK_BEATS, type AmbientKind, type FocusSettings } from '@kreators/shared';
import { useEffect, useRef, useState } from 'react';
import { evenGrid, evenTile } from '../lib/bento';
import { playBeats, startAmbient, unlockAudio, type Ambient } from '../lib/sound';
import { Toggle } from './Toggle';
import { AppIcon } from './AppIcon';

/** The background sounds: three to a row on a phone, five from the tablet, in even rows (lib/bento.ts). */
const SOUND_COLS = { base: 3, md: 5 } as const;

/** The words on this panel, in short plain sentences. */
const COPY = {
  master: 'Sounds and alarms.',
  silent: 'Every timer is silent. No beats. No chime. No background sound. No buzz. Your choices below are kept.',
  covers: 'This covers beats, chimes, background sound and the buzz. Switch it off to keep every timer silent.',
  oneBeat: 'One soft beat when a mini break starts.',
  threeBeats: 'Three soft beats when the long break starts.',
  hearOne: 'Hear one beat.',
  hearThree: 'Hear three beats.',
  buzz: 'Buzz a phone when a part ends.',
  background: 'Background sound.',
  background2: 'It plays softly while a timer runs. It fades out when the timer stops.',
  volume: 'Volume.',
  volumeLabel: 'Volume of the background sound.',
  taste: 'Hear it for a few seconds.',
  stopTaste: 'Stop the preview.',
} as const;
const bare = (t: string) => t.replace(/\.$/, '');

/** A short taste of a background sound, so a person can choose by ear. It stops by itself, and it follows the controls while it plays. */
function useTaste() {
  const live = useRef<{ node: Ambient; timer: number } | null>(null);
  const [on, setOn] = useState<AmbientKind | null>(null);
  const stop = () => {
    if (!live.current) return;
    window.clearTimeout(live.current.timer);
    live.current.node.stop();
    live.current = null;
    setOn(null);
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  const taste = (kind: Exclude<AmbientKind, 'off'>, volume: number) => {
    stop();
    unlockAudio();
    const node = startAmbient(kind, volume);
    if (!node) return;
    live.current = { node, timer: window.setTimeout(stop, 7000) };
    setOn(kind);
  };
  const setVolume = (v: number) => live.current?.node.setVolume(v);
  return { on, taste, stop, setVolume };
}

/**
 * Every sound and alarm of the Mindfulness timers, in one place. The first switch turns them all off at once (the options under it grey
 * out and are kept); under it, with `breaks`, a soft beat for a mini break and three for the long one, and a buzz; and a background sound
 * with its volume. Used by the focus sessions and by the breathing timer, which share one set of choices on the person's account.
 */
export function SoundControls({ settings, onChange, breaks = false, part = 'all' }: { settings: FocusSettings; onChange: (s: FocusSettings) => void; breaks?: boolean; /** `music` is only the background sound and its volume (the focus panel's music button); the master switch keeps its say. */ part?: 'all' | 'music' }) {
  const off = !settings.sound;
  const t = useTaste();
  // The preview follows the controls: the master switch silences it, the slider changes it, and another sound ends it.
  useEffect(() => {
    if (!settings.sound) t.stop();
  }, [settings.sound]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    t.setVolume(settings.ambientVolume);
  }, [settings.ambientVolume]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    t.stop();
  }, [settings.ambient]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<FocusSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="flex flex-col gap-xs text-left">
      {part === 'all' ? (
        <>
          <Toggle compact on={settings.sound} onChange={(v) => set({ sound: v })} label={bare(COPY.master)} />
          <p className="m-0 text-caption text-ink-soft">{off ? COPY.silent : COPY.covers}</p>
        </>
      ) : (
        off && (
          <Toggle compact on={settings.sound} onChange={(v) => set({ sound: v })} label={bare(COPY.master)} hint={COPY.silent} />
        )
      )}
      {breaks && part === 'all' && (
        <div className={`flex flex-col gap-xs ${off ? 'opacity-50' : ''}`}>
          <Toggle compact disabled={off} on={settings.soundShort} onChange={(v) => set({ soundShort: v })} label={bare(COPY.oneBeat)} />
          <Toggle compact disabled={off} on={settings.soundLong} onChange={(v) => set({ soundLong: v })} label={bare(COPY.threeBeats)} />
          <div className="flex flex-wrap gap-xs">
            <button type="button" disabled={off} onClick={() => playBeats(BREAK_BEATS.short)} className="toy toy-soft min-h-[44px] rounded-pill border border-line bg-card-strong px-sm text-subhead font-medium disabled:opacity-60">
              {bare(COPY.hearOne)}
            </button>
            <button type="button" disabled={off} onClick={() => playBeats(BREAK_BEATS.long)} className="toy toy-soft min-h-[44px] rounded-pill border border-line bg-card-strong px-sm text-subhead font-medium disabled:opacity-60">
              {bare(COPY.hearThree)}
            </button>
          </div>
          <Toggle compact disabled={off} on={settings.vibrate} onChange={(v) => set({ vibrate: v })} label={bare(COPY.buzz)} />
        </div>
      )}
      <div className={off ? 'opacity-50' : ''}>
        <p className="m-0 text-subhead font-semibold">{bare(COPY.background)}</p>
        <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.background2}</p>
        <div className={`mt-xs grid gap-xs ${evenGrid(AMBIENT_SOUNDS.length, SOUND_COLS)}`} role="group" aria-label={bare(COPY.background)}>
          {AMBIENT_SOUNDS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              disabled={off}
              aria-pressed={settings.ambient === s.key}
              onClick={() => set({ ambient: s.key })}
              className={`toy flex min-h-[64px] flex-col items-center justify-center gap-xs rounded-tile border-2 p-xs text-subhead font-semibold disabled:opacity-60 ${evenTile(i, AMBIENT_SOUNDS.length, SOUND_COLS)} ${settings.ambient === s.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
            >
              <AppIcon name={s.icon} size={20} />
              {s.name}
            </button>
          ))}
        </div>
        {settings.ambient !== 'off' && (
          <>
            <p className="mt-xs m-0 text-caption text-ink-soft">{AMBIENT_SOUNDS.find((s) => s.key === settings.ambient)!.blurb}</p>
            <label className="mt-xs flex items-center gap-sm">
              <span className="shrink-0 text-caption text-ink-soft">{bare(COPY.volume)}</span>
              <input type="range" min={0} max={100} step={5} disabled={off} value={settings.ambientVolume} onChange={(e) => set({ ambientVolume: Number(e.target.value) })} aria-label={bare(COPY.volumeLabel)} className="min-w-0 flex-1" />
              <span className="w-[40px] shrink-0 text-right text-caption text-ink-soft">{settings.ambientVolume}</span>
            </label>
            <button type="button" disabled={off} onClick={() => (t.on ? t.stop() : t.taste(settings.ambient as Exclude<AmbientKind, 'off'>, settings.ambientVolume))} className="toy toy-soft mt-xs min-h-[44px] rounded-pill border border-line bg-card-strong px-sm text-subhead font-medium disabled:opacity-60">
              {bare(t.on ? COPY.stopTaste : COPY.taste)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
