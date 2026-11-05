/**
 * The home hero's centrepiece, drawn once onto a canvas: one glossy tube tied in a knot, its length in the seven pillar colours one after
 * another ("seven relationships, one life"). Our own drawing, no model, no image file: a trefoil (the (2, 3) torus knot) seen in
 * perspective, drawn as a tube swept by a ball along the strand into a depth buffer, pixel by pixel: each pixel shows the nearest surface
 * and is lit by its own normal (a soft light from the top left, a tight highlight, a thin lavender rim at the very edge), and a far strand
 * darkens where a near one passes over it, so every crossing is a clean over-and-under with a shadow, never a crease.
 *
 * It is its own chunk (SevenKnot imports it after the first paint) and takes a few tens of milliseconds, in short stretches. The drawing never moves; `swayKnot`
 * only moves the finished canvas with transforms.
 */

type RGB = [number, number, number];

/** The knot's shape: how it is tied (p, q), its size, how thick the tube is, and how it is turned toward the eye. */
const SHAPE = { p: 2, q: 3, R: 0.9, a: 0.5, W: 0.56, tiltX: 0.4, tiltZ: -0.4, D: 3.2 };
/** The light, toward it from the surface (x right, y down, z toward the eye): from the top left and a little in front. */
const LIGHT = norm([-0.42, -0.62, 0.66]);
/** Halfway between the light and the eye: where the highlight sits (Blinn). */
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
/** A CSS colour as the browser computes it (a hex token or rgb()), read through a 1px canvas so any form works. */
function rgbOf(css: string, probe: CanvasRenderingContext2D): RGB | null {
  if (!css.trim()) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = 'black';
  probe.fillStyle = css.trim();
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

/** The colours from the theme tokens on `from`: the seven pillars in order, the shade the tube turns into and the rim light. */
export function knotColours(from: Element): { pillars: RGB[]; night: RGB; rim: RGB } | null {
  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = 1;
  probeCanvas.height = 1;
  const probe = probeCanvas.getContext('2d', { willReadFrequently: true });
  if (!probe) return null;
  const cs = getComputedStyle(from);
  const pillars: RGB[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const c = rgbOf(cs.getPropertyValue(`--color-r${i}`), probe);
    if (!c) return null;
    pillars.push(c);
  }
  const night = rgbOf(cs.getPropertyValue('--knot-shade'), probe);
  const rim = rgbOf(cs.getPropertyValue('--knot-rim'), probe);
  if (!night || !rim) return null;
  return { pillars, night, rim };
}

/** How long one stretch of drawing runs before it gives the page a turn (ms), so the first draw is many short tasks, never one long one. */
const SLICE_MS = 10;

/** Give the page a turn: the scheduler's own yield where the browser has it, else a timeout. */
function yieldToPage(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched && typeof sched.yield === 'function') return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Paint the knot onto the canvas at `cw` by `ch` backing pixels (already scaled for the screen). The work is done in short stretches with
 * the page given a turn between them, into one image that is put on the canvas once at the end (the canvas is resized only then, so it never
 * shows half a knot or a blank). `alive` is asked at every pause: when it says no (a newer draw started, the hero left) nothing is put and
 * the answer is false. The pixels are the same as drawing it in one go.
 */
export async function drawSevenKnot(cv: HTMLCanvasElement, colours: { pillars: RGB[]; night: RGB; rim: RGB }, cw: number, ch: number, alive: () => boolean = () => true): Promise<boolean> {
  const ctx = cv.getContext('2d');
  if (!ctx || cw <= 0 || ch <= 0) return false;
  let since = performance.now();
  /** True once a stretch has run its time. */
  const due = () => performance.now() - since >= SLICE_MS;
  /** Give the page its turn, then say whether the draw should go on. */
  const breathe = async (): Promise<boolean> => {
    await yieldToPage();
    since = performance.now();
    return alive();
  };
  const { p, q, R, a, W, tiltX, tiltZ, D } = SHAPE;
  const { pillars, night, rim } = colours;
  // Enough balls along the strand that the tube is smooth (a few pixels apart on any canvas).
  const N = Math.max(240, Math.round(Math.min(cw, ch) * 0.5));
  const cx = Math.cos(tiltX);
  const sx = Math.sin(tiltX);
  const cz = Math.cos(tiltZ);
  const sz = Math.sin(tiltZ);
  // Points along the knot: turned toward the eye, then seen in perspective (f > 1 is nearer, drawn larger).
  const pts: { x: number; y: number; z: number; f: number }[] = [];
  for (let k = 0; k < N; k += 1) {
    const t = (2 * Math.PI * k) / N;
    const rr = R + a * Math.cos(q * t);
    const x0 = rr * Math.cos(p * t);
    const y0 = rr * Math.sin(p * t);
    const z0 = a * Math.sin(q * t);
    const y1 = y0 * cx - z0 * sx;
    const z = y0 * sx + z0 * cx;
    const x = x0 * cz - y1 * sz;
    const y = x0 * sz + y1 * cz;
    const f = D / (D - z);
    pts.push({ x: x * f, y: y * f, z, f });
  }
  // Fit the drawing to the canvas, tube and all, with a little room at the edges.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let zmin = Infinity;
  let zmax = -Infinity;
  for (const pt of pts) {
    const r = (W * pt.f) / 2;
    minX = Math.min(minX, pt.x - r);
    maxX = Math.max(maxX, pt.x + r);
    minY = Math.min(minY, pt.y - r);
    maxY = Math.max(maxY, pt.y + r);
    zmin = Math.min(zmin, pt.z);
    zmax = Math.max(zmax, pt.z);
  }
  const scale = (Math.min(cw, ch) * 0.9) / Math.max(maxX - minX, maxY - minY);
  const ox = cw / 2 - ((minX + maxX) / 2) * scale;
  const oy = ch / 2 - ((minY + maxY) / 2) * scale;
  // Each ball: where it sits, its radius in pixels, its depth (in pixels, nearer is larger) and its colour, a pillar's own easing into the
  // next over its last stretch, and a little deeper in the night on the far side of the knot.
  const bx = new Float32Array(N);
  const by = new Float32Array(N);
  const br = new Float32Array(N);
  const bz = new Float32Array(N);
  const col = new Float32Array(N * 3);
  for (let k = 0; k < N; k += 1) {
    const pt = pts[k]!;
    bx[k] = ox + pt.x * scale;
    by[k] = oy + pt.y * scale;
    br[k] = (W * pt.f * scale) / 2;
    bz[k] = pt.z * scale;
    const f = (k / N) * pillars.length;
    const i = Math.floor(f) % pillars.length;
    const fr = f - Math.floor(f);
    const s = fr < 0.55 ? 0 : (fr - 0.55) / 0.45;
    const own = mix(pillars[i]!, pillars[(i + 1) % pillars.length]!, s * s * (3 - 2 * s));
    const c = mix(own, night, 0.28 * (1 - (pt.z - zmin) / (zmax - zmin || 1)));
    col[k * 3] = c[0];
    col[k * 3 + 1] = c[1];
    col[k * 3 + 2] = c[2];
  }
  // The depth buffer: the nearest surface at each pixel, which ball it belongs to, and how much of the pixel the tube covers (its edge
  // against the page, smoothed).
  const size = cw * ch;
  const depth = new Float32Array(size).fill(-Infinity);
  const owner = new Int32Array(size).fill(-1);
  const cover = new Float32Array(size);
  for (let k = 0; k < N; k += 1) {
    if (due() && !(await breathe())) return false;
    const x = bx[k]!;
    const y = by[k]!;
    const r = br[k]!;
    const z = bz[k]!;
    const reach = r + 0.5;
    // Well inside the edge a pixel is wholly covered: only the last pixel of the edge needs its distance.
    const inside = (reach - 1) * (reach - 1);
    const y0 = Math.max(0, Math.floor(y - reach));
    const y1 = Math.min(ch - 1, Math.ceil(y + reach));
    for (let py = y0; py <= y1; py += 1) {
      const dy = py + 0.5 - y;
      const span = reach * reach - dy * dy;
      if (span <= 0) continue;
      const half = Math.sqrt(span);
      const x0 = Math.max(0, Math.floor(x - half));
      const x1 = Math.min(cw - 1, Math.ceil(x + half));
      let at = py * cw + x0;
      for (let px = x0; px <= x1; px += 1, at += 1) {
        const dx = px + 0.5 - x;
        const d2 = dx * dx + dy * dy;
        if (d2 <= inside) cover[at] = 1;
        else {
          const c = reach - Math.sqrt(d2);
          if (c <= 0) continue;
          if (c > cover[at]!) cover[at] = c;
        }
        const h = r * r - d2;
        const zs = z + (h > 0 ? Math.sqrt(h) : 0);
        if (zs > depth[at]!) {
          depth[at] = zs;
          owner[at] = k;
        }
      }
    }
  }
  // The strand's direction at each ball (pixels, depth included): a pixel's normal is square to it, the tube's own, never the ball's,
  // which would ripple the highlight from ball to ball.
  const tx = new Float32Array(N);
  const ty = new Float32Array(N);
  const tz = new Float32Array(N);
  for (let k = 0; k < N; k += 1) {
    const n = (k + 1) % N;
    const b = (k + N - 1) % N;
    const v = norm([bx[n]! - bx[b]!, by[n]! - by[b]!, bz[n]! - bz[b]!]);
    tx[k] = v[0];
    ty[k] = v[1];
    tz[k] = v[2];
  }
  // Light each pixel by its normal, then shade a far strand where a near one passes just above it.
  const img = new ImageData(cw, ch);
  const out = img.data;
  const reachOf = Math.max(2, Math.round(Math.min(...br) * 0.14));
  const near = Math.min(...br) * 0.7;
  const around = [
    [reachOf, 0],
    [-reachOf, 0],
    [0, reachOf],
    [0, -reachOf],
    [reachOf * 0.7, reachOf * 0.7],
    [-reachOf * 0.7, reachOf * 0.7],
    [reachOf * 0.7, -reachOf * 0.7],
    [-reachOf * 0.7, -reachOf * 0.7],
  ].map(([dx, dy]) => Math.round(dy!) * cw + Math.round(dx!));
  for (let py = 0; py < ch; py += 1) {
    if (due() && !(await breathe())) return false;
    for (let px = 0; px < cw; px += 1) {
      const at = py * cw + px;
      let k = owner[at]!;
      if (k < 0) continue;
      // The ball whose surface is nearest is not always the one the pixel sits beside along the strand (where the strand leans toward the
      // eye, a nearer ball wins pixels well ahead of it): walk along the strand to the ball the pixel is beside, so the shading is smooth.
      for (let walk = 0; walk < 24; walk += 1) {
        const n = (k + 1) % N;
        const b = (k + N - 1) % N;
        const by0 = (px + 0.5 - bx[k]!) * tx[k]! + (py + 0.5 - by[k]!) * ty[k]!;
        const fwd = (bx[n]! - bx[k]!) * tx[k]! + (by[n]! - by[k]!) * ty[k]!;
        const back = (bx[k]! - bx[b]!) * tx[k]! + (by[k]! - by[b]!) * ty[k]!;
        if (by0 > fwd / 2) k = n;
        else if (by0 < -back / 2) k = b;
        else break;
      }
      // The direction, the size and the colour are eased toward the next ball (or the one before) by how far along the pixel sits, so
      // nothing steps from ball to ball.
      const ax = px + 0.5 - bx[k]!;
      const ay = py + 0.5 - by[k]!;
      const ahead = ax * tx[k]! + ay * ty[k]!;
      const j = ahead >= 0 ? (k + 1) % N : (k + N - 1) % N;
      const step = Math.abs((bx[j]! - bx[k]!) * tx[k]! + (by[j]! - by[k]!) * ty[k]!) || 1;
      const w = Math.min(1, Math.abs(ahead) / step);
      let T0 = tx[k]! + (tx[j]! - tx[k]!) * w;
      let T1 = ty[k]! + (ty[j]! - ty[k]!) * w;
      let T2 = tz[k]! + (tz[j]! - tz[k]!) * w;
      const tl = Math.sqrt(T0 * T0 + T1 * T1 + T2 * T2) || 1;
      T0 /= tl;
      T1 /= tl;
      T2 /= tl;
      // Where the eye's ray meets the tube, in the tube's own cross-section: `e` runs across the tube in the screen's plane, `m` across it
      // toward the eye, and how far the pixel sits from the axis along `e` sets the mix. Square to the strand, so it never ripples.
      const h = Math.sqrt(T0 * T0 + T1 * T1) || 1;
      const e0 = T1 / h;
      const e1 = -T0 / h;
      const flip = T0 * e1 - T1 * e0 < 0 ? -1 : 1;
      const m0 = -T2 * e1 * flip;
      const m1 = T2 * e0 * flip;
      const m2 = (T0 * e1 - T1 * e0) * flip;
      const across = Math.max(-1, Math.min(1, (ax * e0 + ay * e1) / (br[k]! + (br[j]! - br[k]!) * w)));
      const toward = Math.sqrt(1 - across * across);
      const nx = across * e0 + toward * m0;
      const ny = across * e1 + toward * m1;
      const nz = toward * m2;
      const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      // A tight highlight over a soft one (powers by squaring: half^160 and half^20).
      const h1 = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
      const h4 = h1 * h1 * h1 * h1;
      const h16 = h4 * h4 * h4 * h4;
      const h32 = h16 * h16;
      const shine = Math.min(1, h32 * h32 * h32 * h32 * h32 * 0.95 + h16 * h4 * 0.26);
      const edge = 1 - nz;
      // The ball's colour, lit: from the night it turns into, up past its own colour where the light falls.
      const lit = 0.36 + 0.72 * diffuse;
      const c3 = k * 3;
      const j3 = j * 3;
      let r = night[0] + (col[c3]! + (col[j3]! - col[c3]!) * w - night[0]) * lit;
      let g = night[1] + (col[c3 + 1]! + (col[j3 + 1]! - col[c3 + 1]!) * w - night[1]) * lit;
      let b = night[2] + (col[c3 + 2]! + (col[j3 + 2]! - col[c3 + 2]!) * w - night[2]) * lit;
      // A thin rim light at the very edge, then the sky the upper edge reflects, so it reads as gloss and the silhouette stays sharp.
      const rimT = edge * edge * edge * edge * 0.4;
      r += (rim[0] - r) * rimT;
      g += (rim[1] - g) * rimT;
      b += (rim[2] - b) * rimT;
      const sky = Math.max(0, -ny) * edge * Math.sqrt(edge) * 0.18;
      r += (255 - r) * sky;
      g += (255 - g) * sky;
      b += (255 - b) * sky;
      // How much of what is just around stands well in front: the shadow a near strand casts on the far one under it.
      let over = 0;
      const z = depth[at]!;
      for (const o of around) {
        const zn = depth[at + o];
        if (zn !== undefined && zn - z > near) over += Math.min(1, (zn - z - near) / near);
      }
      if (over) {
        const d = Math.min(0.62, (over / around.length) * 1.5);
        r += (night[0] - r) * d;
        g += (night[1] - g) * d;
        b += (night[2] - b) * d;
      }
      const i = at * 4;
      out[i] = r + (255 - r) * shine;
      out[i + 1] = g + (255 - g) * shine;
      out[i + 2] = b + (255 - b) * shine;
      out[i + 3] = Math.round(cover[at]! * 255);
    }
  }
  if (!alive()) return false;
  cv.width = cw;
  cv.height = ch;
  ctx.putImageData(img, 0, 0);
  return true;
}

/** The sway: how far it turns either way (degrees) and floats (px), and over how many seconds one way. */
const TURN = 5;
const FLOAT = 8;
const PERIOD = 9;
/** How far it leans toward a mouse, in px at the panel's edge. */
const LEAN = 16;

/**
 * The knot's motion, GSAP on transforms only: `inner` sways a few degrees and pixels each way (yoyo), and with a mouse `box` leans toward
 * the pointer over the panel it sits in (`[data-knot-host]`). The caller pauses it off screen and in a hidden tab, and never starts it
 * under reduced motion.
 */
export async function swayKnot(box: HTMLElement, inner: HTMLElement, mouse: boolean): Promise<{ pause: () => void; resume: () => void; stop: () => void }> {
  const { default: gsap } = await import('gsap');
  const t = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut', duration: PERIOD } });
  t.fromTo(inner, { rotation: -TURN, y: -FLOAT }, { rotation: TURN, y: FLOAT });
  let unhook = () => {};
  const host = box.closest('[data-knot-host]');
  if (host instanceof HTMLElement && mouse) {
    const x = gsap.quickTo(box, 'x', { duration: 1.1, ease: 'power3.out' });
    const y = gsap.quickTo(box, 'y', { duration: 1.1, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = host.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      x(((e.clientX - r.left) / r.width - 0.5) * 2 * LEAN);
      y(((e.clientY - r.top) / r.height - 0.5) * 2 * LEAN);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    unhook = () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      // A quickTo tween is paused, never done, so GSAP keeps it (and the element) until it is killed.
      x.tween.kill();
      y.tween.kill();
    };
  }
  return {
    pause: () => void t.pause(),
    resume: () => void t.resume(),
    stop: () => {
      unhook();
      t.kill();
      gsap.set([box, inner], { clearProps: 'transform' });
    },
  };
}
