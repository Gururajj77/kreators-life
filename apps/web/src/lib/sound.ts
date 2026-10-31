import type { AmbientKind } from '@kreators/shared';
import { useEffect, useRef } from 'react';

/**
 * Every sound the timers make, made in the browser so there is nothing to download and it works offline: soft bell beats, an end chime and
 * four serene background sounds. One audio context is shared, and `unlockAudio` is called from a tap, since a browser only lets sound start
 * after one. Silent where the browser has no audio.
 */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
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

/** One soft bell: a sine with a quiet second partial, a quick rise and a long fade. */
function bell(c: AudioContext, at: number, hz = 528, peak = 0.2) {
  for (const [mult, level, fade] of [[1, 1, 1.6], [2.01, 0.28, 1.0]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz * mult;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * level, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + fade);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + fade + 0.05);
  }
}
/** `n` soft beats, a little over a second apart: one for a mini break, three for the long break. */
export function playBeats(n: number): void {
  const c = audio();
  if (!c) return;
  void c.resume().catch(() => undefined);
  const t = c.currentTime + 0.05;
  for (let i = 0; i < n; i += 1) bell(c, t + i * 1.15);
}
/** A soft two-note chime, for the end of a part or a breathing session. */
export function playChime(): void {
  const c = audio();
  if (!c) return;
  void c.resume().catch(() => undefined);
  const t = c.currentTime + 0.05;
  bell(c, t, 660, 0.16);
  bell(c, t + 0.3, 880, 0.16);
}

export interface Ambient {
  setVolume: (v: number) => void;
  stop: () => void;
}

/** A looping buffer of noise: white, pink (softer, even across the sound) or brown (deep, like distant surf). */
function noise(c: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i += 1) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.5;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}
const slow = (c: AudioContext, hz: number, depth: number, target: AudioParam) => {
  const lfo = c.createOscillator();
  const amount = c.createGain();
  lfo.frequency.value = hz;
  amount.gain.value = depth;
  lfo.connect(amount).connect(target);
  return lfo; // started by `play`, once. A second start throws and would leave the other sources playing.
};

/** A very short burst of noise, for a hat. */
function noiseBurst(c: AudioContext): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.06), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  return buf;
}

/** Start a background sound. `volume` is 0 to 100. Returns null where there is no audio. Fades in, and fades out when stopped. */
export function startAmbient(kind: Exclude<AmbientKind, 'off'>, volume: number): Ambient | null {
  const c = audio();
  if (!c) return null;
  void c.resume().catch(() => undefined);
  const out = c.createGain();
  out.connect(c.destination);
  const level = (v: number) => Math.pow(Math.max(0, Math.min(100, v)) / 100, 2) * 0.6;
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.linearRampToValueAtTime(Math.max(0.0001, level(volume)), c.currentTime + 1.8);
  const stoppers: (() => void)[] = [];
  try {
    const play = (s: AudioScheduledSourceNode) => {
      s.start();
      stoppers.push(() => {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      });
    };
    if (kind === 'rain') {
      const a = noise(c, 'white');
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1100;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7500;
      const g = c.createGain();
      g.gain.value = 0.55;
      a.connect(hp).connect(lp).connect(g).connect(out);
      play(a);
      const b = noise(c, 'pink');
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 0.6;
      const g2 = c.createGain();
      g2.gain.value = 0.3;
      b.connect(bp).connect(g2).connect(out);
      play(b);
      play(slow(c, 0.13, 0.12, g2.gain));
    } else if (kind === 'ocean') {
      const a = noise(c, 'brown');
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 650;
      const g = c.createGain();
      g.gain.value = 0.55;
      a.connect(lp).connect(g).connect(out);
      play(a);
      play(slow(c, 0.085, 0.4, g.gain));
      const b = noise(c, 'pink');
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.5;
      const g2 = c.createGain();
      g2.gain.value = 0.12;
      b.connect(bp).connect(g2).connect(out);
      play(b);
      play(slow(c, 0.085, 0.1, g2.gain));
    } else if (kind === 'wind') {
      const a = noise(c, 'pink');
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      bp.Q.value = 1.1;
      const g = c.createGain();
      g.gain.value = 0.7;
      a.connect(bp).connect(g).connect(out);
      play(a);
      play(slow(c, 0.06, 280, bp.frequency));
      play(slow(c, 0.11, 0.25, g.gain));
  
    } else if (kind === 'lofi') {
      // Slow, mellow chords (I, vi, ii, V in C), a soft low beat and hat, a little tape wobble and a bed of vinyl crackle.
      const BEAT = 60 / 70;
      const BAR = BEAT * 4;
      const CHORDS: readonly (readonly number[])[] = [
        [130.81, 164.81, 196.0, 246.94],
        [110.0, 130.81, 164.81, 196.0],
        [146.83, 174.61, 220.0, 261.63],
        [123.47, 146.83, 174.61, 196.0],
      ];
      const tone = c.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1150;
      tone.Q.value = 0.4;
      const bus = c.createGain();
      bus.gain.value = 0.9;
      tone.connect(bus).connect(out);
      const wow = c.createGain();
      wow.gain.value = 7;
      const wobble = c.createOscillator();
      wobble.frequency.value = 0.33;
      wobble.connect(wow);
      play(wobble);
      const live = new Set<AudioScheduledSourceNode>();
      const voice = (osc: AudioScheduledSourceNode, at: number, end: number) => {
        osc.start(at);
        osc.stop(end);
        live.add(osc);
        osc.onended = () => live.delete(osc);
      };
      stoppers.push(() => {
        live.forEach((o) => {
          try {
            o.stop();
          } catch {
            // already ended
          }
        });
        live.clear();
      });
      const tick = noiseBurst(c);
      const scheduleBar = (at: number, n: number) => {
        const chord = CHORDS[n % CHORDS.length]!;
        const end = at + BAR + 0.5;
        chord.forEach((hz, i) => {
          for (const cents of [-5, 5]) {
            const o = c.createOscillator();
            o.type = 'triangle';
            o.frequency.value = hz;
            o.detune.value = cents;
            wow.connect(o.detune);
            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, at + i * 0.03);
            g.gain.linearRampToValueAtTime(0.045, at + 0.35 + i * 0.03);
            g.gain.linearRampToValueAtTime(0.03, at + BAR);
            g.gain.linearRampToValueAtTime(0.0001, end);
            o.connect(g).connect(tone);
            voice(o, at, end + 0.05);
          }
        });
        const bass = c.createOscillator();
        bass.type = 'sine';
        bass.frequency.value = Math.min(...chord) / 2;
        const bg = c.createGain();
        bg.gain.setValueAtTime(0.0001, at);
        bg.gain.linearRampToValueAtTime(0.16, at + 0.12);
        bg.gain.linearRampToValueAtTime(0.0001, at + BAR);
        bass.connect(bg).connect(bus);
        voice(bass, at, at + BAR + 0.05);
        // A soft kick on the first and third beat, a hat on the off-beats.
        for (const b of [0, 2]) {
          const k = c.createOscillator();
          const kg = c.createGain();
          k.type = 'sine';
          k.frequency.setValueAtTime(110, at + b * BEAT);
          k.frequency.exponentialRampToValueAtTime(45, at + b * BEAT + 0.14);
          kg.gain.setValueAtTime(0.0001, at + b * BEAT);
          kg.gain.exponentialRampToValueAtTime(0.28, at + b * BEAT + 0.01);
          kg.gain.exponentialRampToValueAtTime(0.0001, at + b * BEAT + 0.22);
          k.connect(kg).connect(bus);
          voice(k, at + b * BEAT, at + b * BEAT + 0.25);
        }
        for (const b of [0.5, 1.5, 2.5, 3.5]) {
          const h = c.createBufferSource();
          h.buffer = tick;
          const hp = c.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 6500;
          const hg = c.createGain();
          hg.gain.value = b % 1 === 0.5 && b !== 2.5 ? 0.05 : 0.03;
          h.connect(hp).connect(hg).connect(bus);
          voice(h, at + b * BEAT, at + b * BEAT + 0.08);
        }
      };
      // Keep a few seconds of music scheduled ahead, a bar at a time.
      let next = c.currentTime + 0.1;
      let bar = 0;
      const fill = () => {
        while (next < c.currentTime + 7) {
          scheduleBar(next, bar);
          next += BAR;
          bar += 1;
        }
      };
      fill();
      const timer = window.setInterval(fill, 600);
      stoppers.push(() => window.clearInterval(timer));
      // Vinyl: faint hiss and sparse crackle that loops.
      const vinyl = c.createBuffer(1, c.sampleRate * 5, c.sampleRate);
      const vd = vinyl.getChannelData(0);
      for (let i = 0; i < vd.length; i += 1) vd[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.00035 ? (Math.random() * 2 - 1) * 0.5 : 0);
      const vs = c.createBufferSource();
      vs.buffer = vinyl;
      vs.loop = true;
      const vhp = c.createBiquadFilter();
      vhp.type = 'highpass';
      vhp.frequency.value = 1800;
      const vg = c.createGain();
      vg.gain.value = 0.7;
      vs.connect(vhp).connect(vg).connect(out);
      play(vs);
  } else {
      // A low, warm hum: three sines, a fifth and an octave apart, breathing slowly.
      const g = c.createGain();
      g.gain.value = 0.5;
      g.connect(out);
      for (const [hz, level] of [[110, 0.5], [164.8, 0.22], [220.4, 0.28]] as const) {
        const osc = c.createOscillator();
        const og = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        og.gain.value = level;
        osc.connect(og).connect(g);
        play(osc);
      }
      play(slow(c, 0.17, 0.18, g.gain));
    }
  } catch {
    // Whatever started is stopped again, so a sound that could not be built never plays on with nothing to stop it.
    stoppers.forEach((st) => st());
    out.disconnect();
    return null;
  }
  // A new level starts from where the sound is now, and drops what was still scheduled (such as the fade-in), so the change is heard at once.
  const glide = (to: number, seconds: number) => {
    const now = c.currentTime;
    const here = Math.max(0.0001, out.gain.value);
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(here, now);
    out.gain.linearRampToValueAtTime(Math.max(0.0001, to), now + seconds);
  };
  let stopped = false;
  return {
    setVolume: (v) => {
      if (!stopped) glide(level(v), 0.2);
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      glide(0.0001, 0.35);
      window.setTimeout(() => {
        stoppers.forEach((s) => s());
        out.disconnect();
      }, 450);
    },
  };
}

/**
 * Plays a background sound while `active` is true, and fades it out when it is not. Changing the sound switches at once; changing the volume
 * follows it. Stops for good when the screen goes.
 */
export function useAmbient(active: boolean, kind: AmbientKind, volume: number): void {
  const live = useRef<{ kind: AmbientKind; node: Ambient } | null>(null);
  useEffect(() => {
    const want = active && kind !== 'off' ? kind : null;
    if (live.current && live.current.kind !== want) {
      live.current.node.stop();
      live.current = null;
    }
    if (want && !live.current) {
      const node = startAmbient(want, volume);
      if (node) live.current = { kind: want, node };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, kind]);
  useEffect(() => {
    live.current?.node.setVolume(volume);
  }, [volume]);
  useEffect(
    () => () => {
      live.current?.node.stop();
      live.current = null;
    },
    [],
  );
}
