import { RELATIONSHIP_BY_KEY } from './core.ts';
import type { RelationshipKey } from './core.ts';
import { zonedToUtc } from './dates.ts';
import { isRealDay } from './account.ts';
import { analyseDiscover, DISCOVER_STRENGTHS, emptyLoveAnswers, emptyMindAnswers, emptyTypeAnswers, EQ_DIMS, LOVE_LANGUAGES, LOVE_PAIRS, loveTop, MIND_AREAS, MIND_SCREENS, parseLoveAnswers, parseMindAnswers, parseTypeAnswers, scoreLove, scoreMind, scoreType, TRAITS, TYPE_LETTERS, TYPE_NAMES, TYPE_SCREENS } from './discover.ts';
import type { DiscoverAnalysis, DiscoverResult, EqDim, ExtraKind, LoveAnswers, LoveKey, LoveResult, MindAnswers, MindArea, MindBand, MindResult, Trait, TraitBand, TypeAnswers, TypeLetter, TypeResult } from './discover.ts';

// ---- Human design: where the planets were. Our own low-precision astronomy (Meeus, and the JPL approximate orbits), good to a few arc minutes
// for the years people are born in, which is far finer than a gate (5.625 degrees) and fine enough for a line (0.9375 degrees) except right on its edge. ----

const RAD = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;
const sinD = (d: number) => Math.sin(d * RAD);
const cosD = (d: number) => Math.cos(d * RAD);

export type DesignBody = 'sun' | 'earth' | 'moon' | 'nnode' | 'snode' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
/** Each glyph ends in U+FE0E (text presentation), so a phone draws it as a symbol in the text colour, never as a colour emoji. */
export const DESIGN_BODIES: readonly { key: DesignBody; name: string; glyph: string }[] = [
  { key: 'sun', name: 'Sun', glyph: '☉\uFE0E' },
  { key: 'earth', name: 'Earth', glyph: '⊕\uFE0E' },
  { key: 'moon', name: 'Moon', glyph: '☽\uFE0E' },
  { key: 'nnode', name: 'North node', glyph: '☊\uFE0E' },
  { key: 'snode', name: 'South node', glyph: '☋\uFE0E' },
  { key: 'mercury', name: 'Mercury', glyph: '☿\uFE0E' },
  { key: 'venus', name: 'Venus', glyph: '♀\uFE0E' },
  { key: 'mars', name: 'Mars', glyph: '♂\uFE0E' },
  { key: 'jupiter', name: 'Jupiter', glyph: '♃\uFE0E' },
  { key: 'saturn', name: 'Saturn', glyph: '♄\uFE0E' },
  { key: 'uranus', name: 'Uranus', glyph: '♅\uFE0E' },
  { key: 'neptune', name: 'Neptune', glyph: '♆\uFE0E' },
  { key: 'pluto', name: 'Pluto', glyph: '♇\uFE0E' },
];

/** The Julian day of an instant (milliseconds since 1970, UTC). */
export const julianDay = (ms: number): number => ms / 86_400_000 + 2440587.5;

/** Dynamical time minus universal time, in seconds (Espenak and Meeus fits, 1900 to 2050). */
export function deltaTSeconds(year: number): number {
  if (year < 1900) return -2.79;
  if (year < 1920) {
    const t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (year < 1941) {
    const t = year - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (year < 1961) {
    const t = year - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (year < 1986) {
    const t = year - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (year < 2005) {
    const t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
}

/** Julian centuries of dynamical time since J2000, for an instant in UTC milliseconds. */
export function centuriesOf(ms: number): number {
  const year = 1970 + ms / 31_556_952_000;
  return (julianDay(ms) + deltaTSeconds(year) / 86400 - 2451545.0) / 36525;
}

/** The small wobble of the equinox in longitude, in degrees. */
function nutationLongitude(T: number): number {
  const omega = 125.04452 - 1934.136261 * T;
  const L = 280.4665 + 36000.7698 * T;
  const Lm = 218.3165 + 481267.8813 * T;
  return (-17.2 * sinD(omega) - 1.32 * sinD(2 * L) - 0.23 * sinD(2 * Lm) + 0.21 * sinD(2 * omega)) / 3600;
}

/** The Sun's apparent longitude (Meeus, chapter 25), in degrees. */
export function sunLongitude(T: number): number {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M) + (0.019993 - 0.000101 * T) * sinD(2 * M) + 0.000289 * sinD(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return norm360(L0 + C - 0.00569 - 0.00478 * sinD(omega));
}

// Meeus table 47.A, longitude terms: [D, M, M', F, coefficient in millionths of a degree].
const MOON_TERMS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

/** The arguments the Moon's series and the node share (Meeus, chapter 47). */
function lunarArgs(T: number) {
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  return {
    Lp: 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000,
    D: 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000,
    M: 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000,
    Mp: 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000,
    F: 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000,
  };
}

/** The Moon's longitude (Meeus, chapter 47, longitude terms), with the equinox wobble added. */
export function moonLongitude(T: number): number {
  const { Lp, D, M, Mp, F } = lunarArgs(T);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sum = 0;
  for (const [d, m, mp, f, c] of MOON_TERMS) sum += c * (Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1) * sinD(d * D + m * M + mp * Mp + f * F);
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  sum += 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
  return norm360(Lp + sum / 1e6 + nutationLongitude(T));
}

/** The true north node of the Moon, in degrees. */
export function trueNodeLongitude(T: number): number {
  const { D, M, Mp, F } = lunarArgs(T);
  const T2 = T * T;
  const mean = 125.0445479 - 1934.1362891 * T + 0.0020754 * T2 + (T2 * T) / 467441 - (T2 * T2) / 60616000;
  const corr = -1.4979 * sinD(2 * (D - F)) - 0.15 * sinD(M) - 0.1226 * sinD(2 * D) + 0.1176 * sinD(2 * F) - 0.0801 * sinD(2 * (Mp - F));
  return norm360(mean + corr + nutationLongitude(T));
}

// The JPL approximate orbits (1800 to 2050): a, e, I, L, long. of perihelion, long. of node, each with its rate per century.
type Orbit = readonly [number, number, number, number, number, number, number, number, number, number, number, number];
const ORBITS: Record<string, Orbit> = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  uranus: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.9542763, 0.40805281, 74.01692503, 0.04240589],
  neptune: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
  pluto: [39.48211675, -0.00031596, 0.2488273, 0.0000517, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482],
};

/** Heliocentric position on the J2000 ecliptic, in AU. */
function orbitPosition(name: string, T: number): [number, number, number] {
  const o = ORBITS[name]!;
  const a = o[0] + o[1] * T;
  const e = o[2] + o[3] * T;
  const I = o[4] + o[5] * T;
  const L = o[6] + o[7] * T;
  const w = o[8] + o[9] * T;
  const node = o[10] + o[11] * T;
  const peri = w - node;
  let M = ((L - w) % 360) * RAD;
  if (M > Math.PI) M -= 2 * Math.PI;
  if (M < -Math.PI) M += 2 * Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = cosD(peri);
  const sw = sinD(peri);
  const cO = cosD(node);
  const sO = sinD(node);
  const cI = cosD(I);
  const sI = sinD(I);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, sw * sI * xp + cw * sI * yp];
}

/** A planet's longitude as seen from the Earth, of the date, in degrees. */
export function planetLongitude(name: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto', T: number): number {
  const p = orbitPosition(name, T);
  const e = orbitPosition('earth', T);
  const lon = Math.atan2(p[1] - e[1], p[0] - e[0]) / RAD;
  const precession = 1.396971 * T + 0.0003086 * T * T;
  return norm360(lon + precession + nutationLongitude(T));
}

/** The ecliptic longitude of each of the thirteen bodies, tropical, in degrees, for an instant in UTC milliseconds. */
export function bodyLongitudes(ms: number): Record<DesignBody, number> {
  const T = centuriesOf(ms);
  const sun = sunLongitude(T);
  const node = trueNodeLongitude(T);
  return {
    sun,
    earth: norm360(sun + 180),
    moon: moonLongitude(T),
    nnode: node,
    snode: norm360(node + 180),
    mercury: planetLongitude('mercury', T),
    venus: planetLongitude('venus', T),
    mars: planetLongitude('mars', T),
    jupiter: planetLongitude('jupiter', T),
    saturn: planetLongitude('saturn', T),
    uranus: planetLongitude('uranus', T),
    neptune: planetLongitude('neptune', T),
    pluto: planetLongitude('pluto', T),
  };
}

/** The instant (UTC milliseconds) when the Sun stood 88 degrees of longitude before where it stood at `ms`: the design moment. */
export function designMoment(ms: number): number {
  const target = norm360(sunLongitude(centuriesOf(ms)) - 88);
  let t = ms - 88.3 * 86_400_000;
  for (let i = 0; i < 20; i += 1) {
    const diff = ((sunLongitude(centuriesOf(t)) - target + 540) % 360) - 180;
    if (Math.abs(diff) < 1e-6) break;
    t -= (diff / 0.9856) * 86_400_000;
  }
  return Math.round(t);
}

/** The Fagan-Bradley ayanamsa: the gap between the tropical and the sidereal zodiac, in degrees (24 02' 31" on 1 Jan 1950, growing about 50.26" a year). */
export function faganBradleyAyanamsa(ms: number): number {
  const years = (julianDay(ms) - 2433282.4235) / 365.2425;
  return 24.042044 + (50.2564 / 3600) * years;
}

// ---- Human design: the chart, in either zodiac ----
// Human design is a system for self-reflection, not science. The app uses it as a set of prompts, and turns each one into a small step you can do and count.

export type Zodiac = 'tropical' | 'fagan';
export const ZODIACS: readonly { key: Zodiac; name: string; blurb: string }[] = [
  { key: 'tropical', name: 'Tropical', blurb: 'The zodiac of the seasons, and the one Human design is usually drawn in. Zero degrees Aries is the March equinox.' },
  { key: 'fagan', name: 'Sidereal (Fagan-Bradley)', blurb: 'The zodiac measured against the fixed stars, using the Fagan-Bradley shift, about 24.7 degrees back from tropical today.' },
];
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'] as const;
/** A longitude as a sign and a position in it: "Pisces 3°12′". */
export function signOf(lon: number): { sign: string; deg: number; min: number; text: string } {
  const x = norm360(lon);
  const s = Math.floor(x / 30);
  const within = x - s * 30;
  const deg = Math.floor(within);
  const min = Math.floor((within - deg) * 60);
  return { sign: SIGNS[s]!, deg, min, text: `${SIGNS[s]} ${deg}°${String(min).padStart(2, '0')}′` };
}

/** The sixty-four gates in the order they run round the wheel, from 2 degrees of Aquarius (302 degrees) on. */
export const GATE_WHEEL: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57,
  32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];
const GATE_SPAN = 360 / 64;
const LINE_SPAN = GATE_SPAN / 6;
export function gateAt(lon: number): { gate: number; line: number; edge: number } {
  const x = norm360(lon - 302);
  const idx = Math.min(63, Math.floor(x / GATE_SPAN));
  const within = x - idx * GATE_SPAN;
  const line = Math.min(6, Math.floor(within / LINE_SPAN) + 1);
  const into = within - (line - 1) * LINE_SPAN;
  return { gate: GATE_WHEEL[idx]!, line, edge: Math.min(into, LINE_SPAN - into) };
}

/** The keynote of each gate, 1 to 64. */
export const GATE_NAMES: readonly string[] = [
  'Self-expression', 'Direction of the self', 'Ordering', 'Formulizing', 'Fixed rhythms', 'Friction', 'The role of the self', 'Contribution', 'Focus', 'Behavior of the self',
  'Ideas', 'Caution', 'The listener', 'Power skills', 'Extremes', 'Skills', 'Opinions', 'Correction', 'Wanting', 'The now',
  'Control', 'Grace', 'Assimilation', 'Rationalizing', 'The spirit of the self', 'The egoist', 'Caring', 'The game player', 'Perseverance', 'Feelings',
  'Influence', 'Continuity', 'Privacy', 'Power', 'Change', 'Crisis', 'Friendship', 'The fighter', 'Provocation', 'Aloneness',
  'Contraction', 'Growth', 'Insight', 'Alertness', 'The gatherer', 'Determination of the self', 'Realization', 'Depth', 'Principles', 'Values',
  'Shock', 'Stillness', 'Beginnings', 'Ambition', 'Spirit', 'Stimulation', 'Intuitive clarity', 'Vitality', 'Sexuality', 'Acceptance',
  'Mystery', 'Details', 'Doubt', 'Confusion',
];

export type DesignCenter = 'head' | 'ajna' | 'throat' | 'g' | 'heart' | 'spleen' | 'solar' | 'sacral' | 'root';
export const DESIGN_CENTERS: readonly { key: DesignCenter; name: string; motor: boolean; gates: readonly number[]; defined: string; open: string }[] = [
  { key: 'head', name: 'Head', motor: false, gates: [64, 61, 63], defined: 'A steady pull to think about big questions and ideas.', open: 'You take in other people’s questions. Not every question is yours to answer.' },
  { key: 'ajna', name: 'Ajna', motor: false, gates: [47, 24, 4, 17, 43, 11], defined: 'A set way of making sense of things, which you use again and again.', open: 'A flexible mind that sees many sides. You may feel pressure to look certain when you are not.' },
  { key: 'throat', name: 'Throat', motor: false, gates: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16], defined: 'A steady way to speak and to make things happen.', open: 'Your voice changes with the room. Speak when it is truly your turn, and you need not fill the silence.' },
  { key: 'g', name: 'Identity (G)', motor: false, gates: [1, 13, 25, 46, 2, 15, 10, 7], defined: 'A steady sense of who you are and where you are heading.', open: 'Your sense of direction shifts with the place and the people. The right places and people matter a lot.' },
  { key: 'heart', name: 'Heart (Ego)', motor: true, gates: [21, 40, 26, 51], defined: 'Steady willpower. You can keep promises to yourself.', open: 'You may feel you have something to prove. You do not. Promise less, and keep it.' },
  { key: 'spleen', name: 'Spleen', motor: false, gates: [48, 57, 44, 50, 32, 28, 18], defined: 'A steady gut sense for what is safe and healthy, which speaks once and quietly.', open: 'You can hold on to people, habits and places past their time. Practise letting go.' },
  { key: 'solar', name: 'Solar plexus', motor: true, gates: [36, 22, 37, 6, 49, 55, 30], defined: 'Your mood moves in waves. Clarity comes with time, not in the moment.', open: 'You take in other people’s feelings and may avoid conflict. Notice which feelings are yours.' },
  { key: 'sacral', name: 'Sacral', motor: true, gates: [34, 5, 14, 29, 59, 9, 3, 42, 27], defined: 'Steady life force. Your energy is there when the work fits you.', open: 'Your energy is borrowed. Rest before you are tired, and learn when you have done enough.' },
  { key: 'root', name: 'Root', motor: true, gates: [53, 60, 52, 19, 39, 41, 58, 38, 54], defined: 'Steady drive and pressure to get things done.', open: 'You take in stress and hurry. Do not rush to be free of pressure.' },
];
const CENTER_OF: Record<number, DesignCenter> = Object.fromEntries(DESIGN_CENTERS.flatMap((c) => c.gates.map((g) => [g, c.key]))) as Record<number, DesignCenter>;
export const centerOfGate = (g: number): DesignCenter => CENTER_OF[g]!;

/** The thirty-six channels: two gates that, when both are on, join two centers. */
export const DESIGN_CHANNELS: readonly { a: number; b: number; name: string }[] = [
  { a: 64, b: 47, name: 'Abstraction' }, { a: 61, b: 24, name: 'Awareness' }, { a: 63, b: 4, name: 'Logic' }, { a: 17, b: 62, name: 'Acceptance' },
  { a: 43, b: 23, name: 'Structuring' }, { a: 11, b: 56, name: 'Curiosity' }, { a: 31, b: 7, name: 'The alpha' }, { a: 8, b: 1, name: 'Inspiration' },
  { a: 33, b: 13, name: 'The prodigal' }, { a: 20, b: 10, name: 'Awakening' }, { a: 45, b: 21, name: 'Money' }, { a: 16, b: 48, name: 'The wavelength' },
  { a: 20, b: 57, name: 'The brainwave' }, { a: 35, b: 36, name: 'Transitoriness' }, { a: 12, b: 22, name: 'Openness' }, { a: 20, b: 34, name: 'Charisma' },
  { a: 25, b: 51, name: 'Initiation' }, { a: 15, b: 5, name: 'Rhythm' }, { a: 2, b: 14, name: 'The beat' }, { a: 46, b: 29, name: 'Discovery' },
  { a: 10, b: 34, name: 'Exploration' }, { a: 10, b: 57, name: 'Perfected form' }, { a: 26, b: 44, name: 'Surrender' }, { a: 40, b: 37, name: 'Community' },
  { a: 27, b: 50, name: 'Preservation' }, { a: 57, b: 34, name: 'Power' }, { a: 59, b: 6, name: 'Intimacy' }, { a: 9, b: 52, name: 'Concentration' },
  { a: 3, b: 60, name: 'Mutation' }, { a: 42, b: 53, name: 'Maturation' }, { a: 18, b: 58, name: 'Judgment' }, { a: 28, b: 38, name: 'Struggle' },
  { a: 32, b: 54, name: 'Transformation' }, { a: 19, b: 49, name: 'Synthesis' }, { a: 39, b: 55, name: 'Emoting' }, { a: 41, b: 30, name: 'Recognition' },
];

/** The key of a channel, its two gates as DESIGN_CHANNELS lists them: "64-47". */
export const channelKey = (c: { a: number; b: number }): string => `${c.a}-${c.b}`;

/** What a channel is about, in the app's own plain words: what it is, at your best, what to watch for and a small step. A reading to reflect on; it never predicts. */
export interface ChannelMeaning {
  what: string;
  best: string;
  watch: string;
  step: string;
}
export const CHANNEL_MEANINGS: Record<string, ChannelMeaning> = {
  '64-47': { what: 'A mind that turns the past over and over until a pattern shows.', best: 'You find the meaning in what happened and share it as a story.', watch: 'Going over the same thought again and again, waiting for it to click.', step: 'Write down one thing from this week that still puzzles you, then leave it for a day.' },
  '61-24': { what: 'A mind drawn to questions with no easy answer, that circles back until a new idea lands.', best: 'A fresh idea comes, and you put it into words others can use.', watch: 'Pushing for an answer before it is ready, and feeling restless.', step: 'Keep a note for the ideas that come late at night or on a walk.' },
  '63-4': { what: 'A mind that doubts, tests and looks for the pattern that makes a thing work.', best: 'You find what holds up and what does not, and you can say why.', watch: 'Doubt that turns on yourself, or answers given before anyone asked.', step: 'Pick one plan and list three ways to test it before you trust it.' },
  '17-62': { what: 'A mind that forms views and backs them with facts and detail.', best: 'You give people a clear way to see a problem, step by step.', watch: 'Holding on to a view when the facts have changed.', step: 'Ask someone what they think before you share your own view.' },
  '43-23': { what: 'A sudden knowing that wants to be put into simple words.', best: 'You explain a new idea in a way that makes people sit up.', watch: 'Speaking too soon, before people are ready to hear it.', step: 'Say your new idea to one person you trust first, and notice how it lands.' },
  '11-56': { what: 'A head full of ideas and pictures, and a voice for telling them as stories.', best: 'Your stories help people learn and see something new.', watch: 'Chasing every idea and finishing none, or stretching the truth for a better story.', step: 'Tell one story this week that teaches a lesson you learned.' },
  '31-7': { what: 'A voice for leading, shaped by where a group wants to go.', best: 'People follow because you speak for what the group needs.', watch: 'Taking charge when no one asked, which can feel like a push.', step: 'Before you lead, ask the group what they want to reach.' },
  '8-1': { what: 'A drive to show your own way of doing things.', best: 'You add something new, and others feel free to be themselves.', watch: 'Waiting to be seen, or copying others to fit in.', step: 'Share one thing you made that is truly yours.' },
  '33-13': { what: 'A memory for people’s stories, and a need to step back before you share them.', best: 'You listen well, and later you share what the past can teach.', watch: 'Holding on to old stories, or sharing what was told in trust.', step: 'Write down one lesson from a hard time, and keep it short.' },
  '20-10': { what: 'Speaking and acting from who you are, right in the moment.', best: 'You live by your own values, and that gives others room to do the same.', watch: 'Saying things that others hear as cold or all about you.', step: 'Notice one choice today that was truly yours, and name it.' },
  '45-21': { what: 'A will to gather, hold and share what a group needs to do well.', best: 'You run things well, and the people around you are looked after.', watch: 'Trying to control it all, or not letting others help.', step: 'Hand one task you would keep to yourself to someone you trust.' },
  '16-48': { what: 'Skill that grows with practice and depth over time.', best: 'You get very good at something by doing it again and again.', watch: 'Feeling you are never ready, and putting off the start.', step: 'Practise one skill for fifteen minutes today, even if it is rough.' },
  '20-57': { what: 'A quick gut sense that you can put into words right away.', best: 'You notice what is off in a room and say it at the right time.', watch: 'Saying it so fast that people miss it, or brushing off your own hunch.', step: 'When a quiet hunch comes today, say it out loud or write it down.' },
  '35-36': { what: 'A hunger for new things to feel, and the wisdom that comes after.', best: 'You learn from what you go through and share it so others learn too.', watch: 'Jumping into the next new thing before the last one is done.', step: 'Before you start something new, write what the last one taught you.' },
  '12-22': { what: 'Feelings that come out in how you speak, at times warm and at times quiet.', best: 'When the mood is right, your words touch people.', watch: 'Speaking when the mood is low, so the words come out sharp.', step: 'Wait until you feel at ease before you have a hard talk.' },
  '20-34': { what: 'Busy energy that turns straight into doing.', best: 'You get a lot done, and you keep going when the work fits you.', watch: 'Rushing from task to task without asking if it is yours.', step: 'Before a new task, pause and check if your gut says yes.' },
  '25-51': { what: 'The nerve to take a leap and start fresh, often with a jolt.', best: 'You lead the way into something new and show others it is safe.', watch: 'Looking for a shock for its own sake, or trying too hard to win.', step: 'Try one small new thing this week that feels a little scary.' },
  '15-5': { what: 'A steady flow that keeps its own timing.', best: 'You find a rhythm that works, and others settle into it.', watch: 'Feeling upset when your routine breaks or when others rush you.', step: 'Keep one daily habit at the same time each day this week.' },
  '2-14': { what: 'A sense of direction, with the energy to pay for it.', best: 'You put your time and money into what matters to you.', watch: 'Spending effort on a path that does not feel like yours.', step: 'Look at where your money went this month and check it fits your aims.' },
  '46-29': { what: 'Saying yes to something and seeing it through to the end.', best: 'You commit fully and learn something real by going through it.', watch: 'Saying yes too fast and then feeling stuck.', step: 'Before you say yes today, take a breath and check your gut.' },
  '10-34': { what: 'Strong energy to follow what you believe, your own way.', best: 'You stand by your values and act on them.', watch: 'Not listening to anyone, even when help would be good.', step: 'Do one thing today only because it fits your values.' },
  '10-57': { what: 'A gut sense for what keeps you well and safe.', best: 'You make choices in the moment that look after you.', watch: 'Pushing your hunch aside to please others.', step: 'Listen to your first hunch about one small thing today.' },
  '26-44': { what: 'A knack for remembering what worked and telling people about it well.', best: 'You show people what they need and why it helps them.', watch: 'Pushing too hard, or bending the truth to close a deal.', step: 'Tell one person about something you like, plainly and honestly.' },
  '40-37': { what: 'A deal between work and care: you give, and you need your share back.', best: 'You build a fair circle where everyone pulls their weight.', watch: 'Giving too much and getting tired, or keeping score.', step: 'Ask for one thing you need from someone close this week.' },
  '27-50': { what: 'A drive to care for others and keep good values alive.', best: 'You look after people and keep a home or a group fair.', watch: 'Caring for others so much that you forget yourself.', step: 'Do one kind thing for yourself today, as you would for a friend.' },
  '57-34': { what: 'Quick energy and quick instinct, working as one.', best: 'You act fast, and well, when it counts.', watch: 'Staying busy on your own, without letting others in.', step: 'Notice one moment today when your hunch moved you, and trust it.' },
  '59-6': { what: 'The energy to get close to people and break down walls.', best: 'You make close bonds and help people open up.', watch: 'Getting too close too fast, or fights that come from that.', step: 'Have one honest talk with someone you trust this week.' },
  '9-52': { what: 'The power to focus and stay with one task.', best: 'You give full attention to the details and get them right.', watch: 'Feeling restless when there is nothing to focus on.', step: 'Set one twenty-minute focus round today on a single task.' },
  '3-60': { what: 'Energy that comes in bursts and brings change, bit by bit.', best: 'You bring something new into the world, at its own pace.', watch: 'Feeling low while you wait for change to come.', step: 'Write down one small change you have seen this month.' },
  '42-53': { what: 'Energy to start, grow and finish the cycles of life.', best: 'You see things through to the end and learn from each one.', watch: 'Starting many things and leaving some half done.', step: 'Pick one open project and take one step to close it.' },
  '18-58': { what: 'A drive to fix things and make them better.', best: 'You spot what could be better and help to improve it.', watch: 'Being too hard on others or on yourself.', step: 'Point out one thing that is going well before you suggest a fix.' },
  '28-38': { what: 'A drive to find meaning, even when life is hard.', best: 'You keep going and find what makes the effort worth it.', watch: 'Fighting for things that do not matter to you.', step: 'Ask what is worth your effort this week, and drop one thing that is not.' },
  '32-54': { what: 'Ambition joined with a sense for what will last.', best: 'You rise through hard work and pick the right people to grow with.', watch: 'Pushing too hard, or chasing status.', step: 'Name one goal for this year and one person who could help.' },
  '19-49': { what: 'A feel for what people need, and for the rules that keep a group fair.', best: 'You notice what is missing and help people get it.', watch: 'Needing too much, or cutting people off too fast.', step: 'Ask someone close what they need from you, and listen.' },
  '39-55': { what: 'Moods that move in waves, and a spirit that pushes for more.', best: 'Your feelings bring depth and meaning to what you make.', watch: 'Moods that take over, or poking at people to see if they care.', step: 'When your mood dips, wait it out before you act.' },
  '41-30': { what: 'A strong drive to feel and try new things.', best: 'You dream big and feel things deeply.', watch: 'Wanting too much, or feeling let down when a dream is slow.', step: 'Write down one dream and one small step toward it.' },
};

/** Which side switched a gate on in a chart: the conscious side, the unconscious side, both, or neither. */
export function gateSide(chart: { personality: readonly { gate: number }[]; design: readonly { gate: number }[] }, gate: number): 'personality' | 'design' | 'both' | null {
  const p = chart.personality.some((x) => x.gate === gate);
  const d = chart.design.some((x) => x.gate === gate);
  return p && d ? 'both' : p ? 'personality' : d ? 'design' : null;
}

/** A gate that is on while no channel through it is whole: a hanging gate, with the gates that would complete it. */
export interface HangingGate {
  gate: number;
  center: DesignCenter;
  side: 'personality' | 'design' | 'both';
  partners: number[];
}
export function hangingGates(chart: { personality: readonly { gate: number }[]; design: readonly { gate: number }[]; channels: readonly { a: number; b: number }[] }): HangingGate[] {
  const inChannel = new Set(chart.channels.flatMap((c) => [c.a, c.b]));
  const on = [...new Set([...chart.personality, ...chart.design].map((x) => x.gate))].sort((x, y) => x - y);
  const out: HangingGate[] = [];
  for (const gate of on) {
    if (inChannel.has(gate)) continue;
    const partners = DESIGN_CHANNELS.filter((c) => c.a === gate || c.b === gate).map((c) => (c.a === gate ? c.b : c.a));
    if (partners.length === 0) continue;
    out.push({ gate, center: centerOfGate(gate), side: gateSide(chart, gate)!, partners });
  }
  return out;
}

export type DesignType = 'generator' | 'mg' | 'manifestor' | 'projector' | 'reflector';
export const DESIGN_TYPES: Record<DesignType, { name: string; share: string; strategy: string; signature: string; notSelf: string; line: string; aura: string }> = {
  generator: { name: 'Generator', share: 'about 37 in 100 people', strategy: 'Wait to respond', signature: 'Satisfaction', notSelf: 'Frustration', aura: 'Open and drawing, it invites people in.', line: 'You are built to work at what lights you up. Life asks, and your gut answers with a clear yes or no.' },
  mg: { name: 'Manifesting Generator', share: 'about 33 in 100 people', strategy: 'Wait to respond, then tell people before you act', signature: 'Satisfaction and peace', notSelf: 'Frustration and anger', aura: 'Open and drawing, and quick to move.', line: 'You are a fast builder with many passions. You can skip steps, change course and still finish.' },
  manifestor: { name: 'Manifestor', share: 'about 9 in 100 people', strategy: 'Tell people before you act', signature: 'Peace', notSelf: 'Anger', aura: 'Closed and strong, and it keeps people at a distance.', line: 'You are here to start things. People push back less when you tell them first.' },
  projector: { name: 'Projector', share: 'about 20 in 100 people', strategy: 'Wait for the invitation', signature: 'Success', notSelf: 'Bitterness', aura: 'Focused and deep, it sees the person in front of you.', line: 'You see people and systems clearly and guide them. You do your best work when you are asked, and you need more rest than most.' },
  reflector: { name: 'Reflector', share: 'about 1 in 100 people', strategy: 'Wait about 28 days before big decisions', signature: 'Surprise', notSelf: 'Disappointment', aura: 'Open and sampling, it mirrors the room.', line: 'You mirror the health of the places and people around you. Choose both with care.' },
};
export type DesignAuthority = 'emotional' | 'sacral' | 'splenic' | 'ego' | 'self' | 'mental' | 'lunar';
export const DESIGN_AUTHORITIES: Record<DesignAuthority, { name: string; line: string }> = {
  emotional: { name: 'Emotional', line: 'Do not decide in the moment. Ride the wave and wait for clarity. That is often a night or more.' },
  sacral: { name: 'Sacral', line: 'Your gut answers in the moment, with a yes or a no. Ask yourself questions that can be answered that way.' },
  splenic: { name: 'Splenic', line: 'A quiet, quick hunch that speaks once. Act on it the first time you notice it.' },
  ego: { name: 'Ego (Heart)', line: 'Ask: what do I want, and what is worth my effort? Only commit to what you have the will for.' },
  self: { name: 'Self-projected', line: 'Talk it out loud with people you trust, and listen to what you hear yourself say.' },
  mental: { name: 'Mental (no inner authority)', line: 'Talk it through with a few people, in a few different places, and see which answer stays clear.' },
  lunar: { name: 'Lunar', line: 'Wait about 28 days, and talk the choice over with different people on the way.' },
};
export const DESIGN_LINES: readonly { name: string; line: string }[] = [
  { name: 'Investigator', line: 'You need a solid base. You dig in until you feel safe.' },
  { name: 'Hermit', line: 'You have natural talent that others see before you do, and you need time alone.' },
  { name: 'Experimenter', line: 'You learn by trying. Mistakes are how you find what works.' },
  { name: 'Networker', line: 'You grow through a few close ties, and your circle opens doors.' },
  { name: 'Problem solver', line: 'People hope you will fix things. Promise less than you can do.' },
  { name: 'Role model', line: 'Life comes in three stages: you try things, step back, then lead by example.' },
];
export const DESIGN_PROFILES: Record<string, string> = {
  '1/3': 'Investigator and Experimenter', '1/4': 'Investigator and Networker', '2/4': 'Hermit and Networker', '2/5': 'Hermit and Problem solver', '3/5': 'Experimenter and Problem solver', '3/6': 'Experimenter and Role model',
  '4/6': 'Networker and Role model', '4/1': 'Networker and Investigator', '5/1': 'Problem solver and Investigator', '5/2': 'Problem solver and Hermit', '6/2': 'Role model and Hermit', '6/3': 'Role model and Experimenter',
};
export type DesignAngle = 'right' | 'juxtaposition' | 'left';
export const DESIGN_ANGLES: Record<DesignAngle, { name: string; line: string }> = {
  right: { name: 'Right angle', line: 'A personal path: your life is about your own story, and the people who come into it.' },
  juxtaposition: { name: 'Juxtaposition', line: 'A fixed path with a strong focus. Your way of seeing stays steady all your life.' },
  left: { name: 'Left angle', line: 'A path through other people: your work shows in how you touch groups and teams.' },
};

export interface DesignActivation {
  body: DesignBody;
  /** In the zodiac asked for, degrees. */
  lon: number;
  gate: number;
  line: number;
  /** How far inside its line the position sits, in degrees. Near zero means another program might call it the next line. */
  edge: number;
}
export interface DesignChannel {
  a: number;
  b: number;
  name: string;
  centers: [DesignCenter, DesignCenter];
  /** Which side switched on both gates: the conscious side, the unconscious side, or both. */
  from: 'personality' | 'design' | 'both';
}
export interface DesignChart {
  zodiac: Zodiac;
  personality: DesignActivation[];
  design: DesignActivation[];
  channels: DesignChannel[];
  defined: DesignCenter[];
  open: DesignCenter[];
  type: DesignType;
  authority: DesignAuthority;
  profile: { p: number; d: number; text: string };
  definition: 'none' | 'single' | 'split' | 'triple' | 'quadruple';
  cross: { angle: DesignAngle; pSun: number; pEarth: number; dSun: number; dEarth: number };
}

export interface DesignInput {
  /** Birth date, YYYY-MM-DD, as written on the birth record. */
  date: string;
  /** Birth time, HH:MM, 24-hour. */
  time: string;
  /** The IANA zone of the birthplace, such as Asia/Kolkata, so a summer-time or an old offset comes out right. */
  zone: string;
  /** The place, as the person writes it. For their own page only. */
  place: string;
  /** The full name on the birth record, for numerology. Optional. */
  name: string;
}
export interface DesignResult {
  input: DesignInput;
  birthUtc: string;
  designUtc: string;
  /** The Fagan-Bradley shift at each of the two moments, in degrees. */
  ayanamsa: { personality: number; design: number };
  /** Tropical longitudes, in degrees, for each of the thirteen bodies. */
  personality: Record<DesignBody, number>;
  design: Record<DesignBody, number>;
}

const isZone = (zone: string): boolean => {
  try {
    // en-US on purpose: these parts are parsed for zone maths, never shown.
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone.length > 0 && zone.length <= 64;
  } catch {
    return false;
  }
};
export const emptyDesignInput = (): DesignInput => ({ date: '', time: '', zone: '', place: '', name: '' });
/** The one reader for a birth record from the browser or a column. Anything unclean is left empty. */
export function parseDesignInput(raw: unknown): DesignInput {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof o[k] === 'string' ? (o[k] as string).trim().slice(0, max) : '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str('date', 10)) ? str('date', 10) : '';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(str('time', 5)) ? str('time', 5) : '';
  const zone = isZone(str('zone', 64)) ? str('zone', 64) : '';
  // A name is letters, spaces and the marks inside names.
  const name = str('name', 80).replace(/[^\p{L}\p{M} '’.-]/gu, '').replace(/\s+/g, ' ').trim();
  return { date, time, zone, place: str('place', 80), name };
}
export function designInputProblem(i: DesignInput, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!isRealDay(i.date)) return 'Enter your birth date.';
  if (i.date > today) return 'That day has not happened yet.';
  if (i.date < '1900-01-01') return 'The chart works for births from 1900 on.';
  if (!i.time) return 'Enter your birth time, as the hours and minutes on your birth record.';
  if (!i.zone) return 'Pick the time zone of the place you were born.';
  return null;
}
/** The chart's raw numbers for a birth record. Everything else is worked out from these, in either zodiac. */
export function computeDesign(input: DesignInput): DesignResult {
  const [h, m] = input.time.split(':').map(Number);
  const birth = zonedToUtc(input.date, (h ?? 0) * 60 + (m ?? 0), input.zone).getTime();
  const design = designMoment(birth);
  const round = (r: Record<DesignBody, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10000) / 10000])) as Record<DesignBody, number>;
  return {
    input,
    birthUtc: new Date(birth).toISOString(),
    designUtc: new Date(design).toISOString(),
    ayanamsa: { personality: Math.round(faganBradleyAyanamsa(birth) * 10000) / 10000, design: Math.round(faganBradleyAyanamsa(design) * 10000) / 10000 },
    personality: round(bodyLongitudes(birth)),
    design: round(bodyLongitudes(design)),
  };
}

const EDGE_LIMIT: Partial<Record<DesignBody, number>> = { jupiter: 0.12, saturn: 0.12, uranus: 0.12, neptune: 0.12, pluto: 0.12 };
/** The chart as read in one zodiac: gates and lines, channels, centers, type, authority, profile and cross. */
export function designChart(r: DesignResult, zodiac: Zodiac): DesignChart {
  const side = (lons: Record<DesignBody, number>, shift: number): DesignActivation[] =>
    DESIGN_BODIES.map((b) => {
      const lon = norm360(lons[b.key] - (zodiac === 'fagan' ? shift : 0));
      const g = gateAt(lon);
      return { body: b.key, lon, gate: g.gate, line: g.line, edge: g.edge };
    });
  const personality = side(r.personality, r.ayanamsa.personality);
  const design = side(r.design, r.ayanamsa.design);
  const on = { p: new Set(personality.map((x) => x.gate)), d: new Set(design.map((x) => x.gate)) };
  const channels: DesignChannel[] = [];
  for (const c of DESIGN_CHANNELS) {
    const pa = on.p.has(c.a);
    const pb = on.p.has(c.b);
    const da = on.d.has(c.a);
    const db = on.d.has(c.b);
    if (!((pa || da) && (pb || db))) continue;
    const from = pa && pb ? 'personality' : da && db ? 'design' : 'both';
    channels.push({ a: c.a, b: c.b, name: c.name, centers: [centerOfGate(c.a), centerOfGate(c.b)], from });
  }
  const defined = DESIGN_CENTERS.map((c) => c.key).filter((k) => channels.some((c) => c.centers.includes(k)));
  const open = DESIGN_CENTERS.map((c) => c.key).filter((k) => !defined.includes(k));
  // Which defined centers touch each other through channels: the groups that make up definition.
  const parent = new Map<DesignCenter, DesignCenter>(defined.map((c) => [c, c]));
  const find = (c: DesignCenter): DesignCenter => (parent.get(c) === c ? c : find(parent.get(c)!));
  for (const ch of channels) parent.set(find(ch.centers[0]), find(ch.centers[1]));
  const groupOf = (c: DesignCenter) => (defined.includes(c) ? find(c) : null);
  const groups = new Set(defined.map(find)).size;
  const definition = (['none', 'single', 'split', 'triple', 'quadruple'] as const)[Math.min(4, groups)]!;
  const isOn = (c: DesignCenter) => defined.includes(c);
  const throatGroup = groupOf('throat');
  const motorToThroat = throatGroup !== null && DESIGN_CENTERS.some((c) => c.motor && isOn(c.key) && groupOf(c.key) === throatGroup);
  const type: DesignType = defined.length === 0 ? 'reflector' : isOn('sacral') ? (motorToThroat ? 'mg' : 'generator') : motorToThroat ? 'manifestor' : 'projector';
  const authority: DesignAuthority =
    type === 'reflector' ? 'lunar' : isOn('solar') ? 'emotional' : isOn('sacral') ? 'sacral' : isOn('spleen') ? 'splenic' : isOn('heart') ? 'ego' : isOn('g') && throatGroup !== null && groupOf('g') === throatGroup ? 'self' : 'mental';
  const pSun = personality[0]!;
  const dSun = design[0]!;
  const key = `${pSun.line}/${dSun.line}`;
  const angle: DesignAngle = key === '4/1' ? 'juxtaposition' : ['5/1', '5/2', '6/2', '6/3'].includes(key) ? 'left' : 'right';
  return {
    zodiac,
    personality,
    design,
    channels,
    defined,
    open,
    type,
    authority,
    profile: { p: pSun.line, d: dSun.line, text: key },
    definition,
    cross: { angle, pSun: pSun.gate, pEarth: personality[1]!.gate, dSun: dSun.gate, dEarth: design[1]!.gate },
  };
}

// ---- Human design: the reading, in three layers, and what to do about it ----

/** The app's own way to group a reading, by the dimensions on its map of consciousness: 3D for the body and the day, 5D for the mind and other people, 7D for purpose. */
export const DESIGN_DEPTHS: readonly { key: '3d' | '5d' | '7d' | 'num'; name: string; blurb: string }[] = [
  { key: '3d', name: '3D · Body and day', blurb: 'How you are built to work, decide and rest. The practical layer: your type, strategy, authority and energy.' },
  { key: '5d', name: '5D · Mind and people', blurb: 'How you learn, relate and think. Your profile, your channels, and what you take in from others.' },
  { key: '7d', name: '7D · Purpose', blurb: 'What you are here to give. Your cross, the gates of your Sun, Earth and nodes, and what stands out between the two zodiacs.' },
  { key: 'num', name: 'Numerology', blurb: 'The numbers in your birth date and your name, with the master numbers 11, 22 and 33 and the turning point 10, set beside what Discover learned about you.' },
];
export interface DesignBlock {
  title: string;
  text: string;
  items?: string[];
}
export interface DesignGoal {
  pillar: RelationshipKey;
  title: string;
  /** Why the chart suggests it. */
  why: string;
  /** The first small step. */
  step: string;
  /** How you will know it happened: something to count. */
  proof: string;
}
export interface DesignAnalysis {
  headline: string;
  depths: Record<'3d' | '5d' | '7d', DesignBlock[]>;
  goals: DesignGoal[];
  /** Positions that sit so near the edge of a line that another program may read the next line. */
  edges: string[];
}
const listNames = (g: number[]) => g.map((n) => `${n} ${GATE_NAMES[n - 1]}`).join(', ');
const centerName = (k: DesignCenter) => DESIGN_CENTERS.find((c) => c.key === k)!.name;

const TYPE_GOAL: Record<DesignType, { title: string; step: string; proof: string }> = {
  generator: { title: 'Say yes only to what lights you up', step: 'Before you agree to anything this week, ask yourself a yes or no question and notice how your body answers.', proof: 'Count your gut yeses. Aim for five this week.' },
  mg: { title: 'Respond first, then tell people your plan', step: 'When something comes up, wait for your gut to answer. If it is a yes, say what you will do before you do it.', proof: 'Tell someone your plan first on five days this week.' },
  manifestor: { title: 'Tell people before you act', step: 'Before a move that touches other people, send one line: what you are about to do.', proof: 'Send five heads-up messages this week.' },
  projector: { title: 'Wait to be asked, and rest well', step: 'Share advice only when someone asks. If you see something useful, say you have a thought and ask if they want it.', proof: 'Get asked, or invited, three times this month. Sleep eight hours on five nights this week.' },
  reflector: { title: 'Sleep on every big choice', step: 'Write the choice in your journal today, talk it over with three different people, and decide in about 28 days.', proof: 'One big decision logged and decided on its day.' },
};
const AUTH_GOAL: Record<DesignAuthority, { title: string; step: string; proof: string }> = {
  emotional: { title: 'Never decide a money or work matter in the moment', step: 'For any big yes, say, “Let me sleep on it.” Come back after a night, then after three, and see if the answer holds.', proof: 'Three big decisions delayed by a night this month.' },
  sacral: { title: 'Make work choices with a yes or no gut check', step: 'Turn each choice into a yes or no question. Say it aloud and notice the first answer in your body.', proof: 'Five work choices made this way this week.' },
  splenic: { title: 'Act on the first quiet hunch', step: 'When a quiet hunch speaks, write it down and act on it before you talk yourself out of it.', proof: 'Three hunches noted and acted on this week.' },
  ego: { title: 'Promise only what you want to do', step: 'Before you commit, ask: do I want this, and is it worth my effort? Write down what you promise.', proof: 'Keep every promise you make this week, and make fewer.' },
  self: { title: 'Decide by talking it out', step: 'Pick one trusted person for each big choice. Say what you think out loud and listen to yourself.', proof: 'Two big choices talked through before you decide this month.' },
  mental: { title: 'Talk it through in different places', step: 'Take each big choice to two people and to two different places, such as a walk and a cafe. See which answer stays clear.', proof: 'Three decisions made this way this month.' },
  lunar: { title: 'Give big choices a moon', step: 'Log the choice, then check in on it each week for four weeks with a different person.', proof: 'One big decision followed through four weeks.' },
};
const LINE_LEARN: readonly { title: string; step: string; proof: string }[] = [
  { title: 'Study one thing deeply before you share it', step: 'Pick one topic. Spend four weeks reading and testing before you teach or post about it.', proof: 'Thirty minutes a day on five days a week, for four weeks.' },
  { title: 'Make room for your natural talent', step: 'Block two free afternoons a week with no plan, and notice what you do without being asked.', proof: 'Two free blocks kept each week for a month.' },
  { title: 'Run three small experiments', step: 'Try three small things. After each, write what did not work and what you learned. Mistakes count as results.', proof: 'Three experiments with three written lessons this month.' },
  { title: 'Share what you learn with three people', step: 'Pick three people you know. Tell each one a thing you learned this week.', proof: 'Three conversations a week for four weeks.' },
  { title: 'Solve one real problem for someone', step: 'Ask a person what is stuck. Offer one small fix, and under-promise.', proof: 'One problem solved and one thank-you received this month.' },
  { title: 'Learn by trying, then lead by example', step: 'For thirty days, be a student of one skill. After that, show someone else the first steps.', proof: 'Thirty days logged, then one lesson given.' },
];
const OPEN_GOAL: Partial<Record<DesignCenter, { title: string; step: string; proof: string }>> = {
  heart: { title: 'Stop proving yourself at home', step: 'This week, do one thing for your family with no promise attached and nothing to show for it.', proof: 'Three small things done quietly.' },
  solar: { title: 'Pause before you answer a heated message', step: 'Before you reply to a message that stirs you, wait an hour and ask whose feeling it is.', proof: 'Five replies delayed an hour.' },
  sacral: { title: 'Rest before you are tired', step: 'Pick a fixed bedtime and keep it. Stop work when your day’s work is done, not when you are empty.', proof: 'Bedtime kept seven nights in a row.' },
  root: { title: 'Do not rush to be free of pressure', step: 'Pick one task you feel hurried about. Do it at an even pace for twenty minutes, then stop.', proof: 'Five calm twenty-minute blocks this week.' },
  spleen: { title: 'Let one old thing go', step: 'Name one habit, thing or tie that has outlived its use. Take one step to let it go.', proof: 'One thing let go this month.' },
  g: { title: 'Choose your places and people', step: 'List where you feel most like yourself. Spend your next free evening in one of those places.', proof: 'Three evenings in places that feel right.' },
  throat: { title: 'Speak when it is truly your turn', step: 'In a group, wait until you are asked or until the point is clearly yours, then say it plainly.', proof: 'Three times you waited and then spoke.' },
  ajna: { title: 'Say “I am not sure yet”', step: 'Once a day, let a question stay open instead of pretending to be certain.', proof: 'Five open questions kept open this week.' },
  head: { title: 'Pick which questions are yours', step: 'Write the questions on your mind. Cross out the ones other people put there.', proof: 'One list written and cut down to three.' },
};
const CROSS_GOAL: Record<DesignAngle, string> = {
  right: 'Write one page on your own path: where you want to be in a year and what you will build to get there.',
  juxtaposition: 'Write down the one thing you keep returning to, and give it a fixed hour every week.',
  left: 'Choose one group or team and plan one thing to give them each month.',
};

/** The chart, read in three layers, with goals you can do and count. */
export function analyseDesign(c: DesignChart): DesignAnalysis {
  const t = DESIGN_TYPES[c.type];
  const au = DESIGN_AUTHORITIES[c.authority];
  const pl = DESIGN_LINES[c.profile.p - 1]!;
  const dl = DESIGN_LINES[c.profile.d - 1]!;
  const all = [...c.personality, ...c.design];
  const edges = all
    .filter((a) => a.edge < (EDGE_LIMIT[a.body] ?? 0.04))
    .map((a) => `${DESIGN_BODIES.find((b) => b.key === a.body)!.name}, ${all.indexOf(a) < 13 ? 'conscious' : 'unconscious'}: gate ${a.gate} line ${a.line}`);
  const sunP = c.personality[0]!;
  const earthP = c.personality[1]!;
  const sunD = c.design[0]!;
  const earthD = c.design[1]!;

  const d3: DesignBlock[] = [
    { title: `${t.name}`, text: `${t.line} Strategy: ${t.strategy}. When it works you feel ${t.signature.toLowerCase()}. When it does not, you feel ${t.notSelf.toLowerCase()}.`, items: [`How common: ${t.share}`, `Aura: ${t.aura}`] },
    { title: `${au.name} authority`, text: au.line },
    { title: 'Definition', text: c.definition === 'none' ? 'No centers are defined: you take in the world and reflect it.' : c.definition === 'single' ? 'Single: all your defined centers join, so you feel self-contained and make sense on your own.' : c.definition === 'split' ? 'Split: two groups of centers with a gap. You may like people who bridge the gap for you.' : c.definition === 'triple' ? 'Triple split: three groups. You do well with a variety of people around you, and you need time to join the dots.' : 'Quadruple split: four groups. You need time, and the right people, for things to come together.' },
    { title: `Defined centers (${c.defined.length})`, text: c.defined.length ? 'These work the same way every day. They are your steady energy.' : 'You have none. Your whole chart is open.', items: c.defined.map((k) => `${centerName(k)}: ${DESIGN_CENTERS.find((x) => x.key === k)!.defined}`) },
    { title: `Open centers (${c.open.length})`, text: c.open.length ? 'These take in the world around you. They are where you learn and where you can be pushed around.' : 'You have none open.', items: c.open.map((k) => `${centerName(k)}: ${DESIGN_CENTERS.find((x) => x.key === k)!.open}`) },
  ];
  const d5: DesignBlock[] = [
    { title: `Profile ${c.profile.text}`, text: `${DESIGN_PROFILES[c.profile.text] ?? ''}. The first number is how you show up and the second is the part of you that works underneath.`, items: [`Line ${c.profile.p}, ${pl.name}: ${pl.line}`, `Line ${c.profile.d}, ${dl.name}: ${dl.line}`] },
    { title: `Channels (${c.channels.length})`, text: c.channels.length ? 'A channel joins two centers. It is a skill or a way of being you can count on.' : 'You have no whole channels. You have single gates, which are like themes you can use but do not always have.', items: c.channels.map((ch) => `${ch.a}-${ch.b} ${ch.name}: ${centerName(ch.centers[0])} to ${centerName(ch.centers[1])}, ${ch.from === 'both' ? 'from both sides' : ch.from === 'personality' ? 'conscious' : 'unconscious'}`) },
    { title: 'Conscious and unconscious', text: 'Conscious gates are the ones you know you have. Unconscious gates show up in your body and in how others see you before you do.', items: [`Conscious Sun: gate ${sunP.gate}.${sunP.line}, ${GATE_NAMES[sunP.gate - 1]}`, `Unconscious Sun: gate ${sunD.gate}.${sunD.line}, ${GATE_NAMES[sunD.gate - 1]}`, `Conscious Moon: gate ${c.personality[2]!.gate}.${c.personality[2]!.line}, ${GATE_NAMES[c.personality[2]!.gate - 1]}`] },
    { title: 'With other people', text: `Tell the people close to you your strategy: “${t.strategy}.” Then ask for theirs. Your open centers are where you take on their energy, so notice what is yours.` },
  ];
  const d7: DesignBlock[] = [
    { title: `${DESIGN_ANGLES[c.cross.angle].name} cross`, text: `${DESIGN_ANGLES[c.cross.angle].line} Your cross is made of four gates: the Sun and Earth of your conscious side and of your unconscious side.`, items: [`Conscious Sun: ${c.cross.pSun} ${GATE_NAMES[c.cross.pSun - 1]}`, `Conscious Earth: ${c.cross.pEarth} ${GATE_NAMES[c.cross.pEarth - 1]}`, `Unconscious Sun: ${c.cross.dSun} ${GATE_NAMES[c.cross.dSun - 1]}`, `Unconscious Earth: ${c.cross.dEarth} ${GATE_NAMES[c.cross.dEarth - 1]}`] },
    { title: 'Your nodes', text: 'The nodes point to where you are headed and what you grow out of.', items: [`North node, conscious: ${listNames([c.personality[3]!.gate])}`, `South node, conscious: ${listNames([c.personality[4]!.gate])}`, `North node, unconscious: ${listNames([c.design[3]!.gate])}`, `South node, unconscious: ${listNames([c.design[4]!.gate])}`] },
    { title: 'What you give', text: `Your Sun gate is ${sunP.gate}, ${GATE_NAMES[sunP.gate - 1]}, and your Earth gate is ${earthP.gate}, ${GATE_NAMES[earthP.gate - 1]}. The Sun is what lights you up and the Earth is what keeps you grounded. Underneath, ${sunD.gate} ${GATE_NAMES[sunD.gate - 1]} and ${earthD.gate} ${GATE_NAMES[earthD.gate - 1]} work without you trying.` },
  ];

  const g: DesignGoal[] = [];
  const typeGoal = TYPE_GOAL[c.type];
  g.push({ pillar: 'self', title: typeGoal.title, why: `Your type is ${t.name}, and your strategy is “${t.strategy}.”`, step: typeGoal.step, proof: typeGoal.proof });
  const au2 = AUTH_GOAL[c.authority];
  g.push({ pillar: 'servant_leader', title: au2.title, why: `Your authority is ${au.name.toLowerCase()}.`, step: au2.step, proof: au2.proof });
  const learn = LINE_LEARN[c.profile.p - 1]!;
  g.push({ pillar: 'guru', title: learn.title, why: `The first number of your profile is ${c.profile.p}, the ${pl.name.toLowerCase()}.`, step: learn.step, proof: learn.proof });
  const friendLine = DESIGN_LINES[c.profile.d - 1]!;
  g.push({ pillar: 'friendship', title: `Meet people the way a ${friendLine.name.toLowerCase()} does`, why: `The second number of your profile is ${c.profile.d}: ${friendLine.line}`, step: c.profile.d === 4 ? 'Pick three people you already like and book a coffee with each.' : c.profile.d === 2 ? 'Keep one hour a week for being alone, and answer when friends reach out.' : c.profile.d === 3 ? 'Try one new group or event this month. If it is not for you, that is a result.' : c.profile.d === 5 ? 'Ask a friend what is stuck, and offer one small, honest fix.' : c.profile.d === 6 ? 'Say one honest thing about how you live, to one friend who can use it.' : 'Pick one friend and spend an unhurried evening with them.', proof: 'Three friend moments this month.' });
  const openFirst = (['heart', 'solar', 'sacral', 'root', 'spleen', 'g', 'throat', 'ajna', 'head'] as const).find((k) => c.open.includes(k) && OPEN_GOAL[k]);
  if (openFirst) {
    const o = OPEN_GOAL[openFirst]!;
    g.push({ pillar: openFirst === 'heart' || openFirst === 'solar' ? 'parent_child' : 'self', title: o.title, why: `Your ${centerName(openFirst)} center is open: ${DESIGN_CENTERS.find((x) => x.key === openFirst)!.open}`, step: o.step, proof: o.proof });
  }
  g.push({ pillar: 'lover_partner', title: 'Share how you work with someone close', why: `Your strategy and authority only help if the people you love know them.`, step: `Tell your partner or a close friend: “I do best when I ${t.strategy.charAt(0).toLowerCase()}${t.strategy.slice(1)}, and I decide by ${au.name.toLowerCase()} authority.” Then ask for theirs.`, proof: 'One honest talk, with their answer written down.' });
  g.push({ pillar: 'divine', title: 'Write what your cross says about what you give', why: `Your cross is ${c.cross.pSun}, ${c.cross.pEarth}, ${c.cross.dSun} and ${c.cross.dEarth}, a ${DESIGN_ANGLES[c.cross.angle].name.toLowerCase()} cross.`, step: CROSS_GOAL[c.cross.angle], proof: 'One page written by Sunday.' });
  return { headline: `${t.name} ${c.profile.text}, ${au.name.toLowerCase()} authority`, depths: { '3d': d3, '5d': d5, '7d': d7 }, goals: g, edges };
}

/** Where the two zodiacs agree and where they do not. */
export function designCompare(r: DesignResult): { same: boolean; lines: string[] } {
  const a = designChart(r, 'tropical');
  const b = designChart(r, 'fagan');
  const ta = DESIGN_TYPES[a.type].name;
  const tb = DESIGN_TYPES[b.type].name;
  const lines: string[] = [];
  lines.push(ta === tb ? `Type: ${ta} in both.` : `Type: ${ta} in the tropical zodiac, ${tb} in the sidereal.`);
  lines.push(a.authority === b.authority ? `Authority: ${DESIGN_AUTHORITIES[a.authority].name} in both.` : `Authority: ${DESIGN_AUTHORITIES[a.authority].name} (tropical), ${DESIGN_AUTHORITIES[b.authority].name} (sidereal).`);
  lines.push(a.profile.text === b.profile.text ? `Profile: ${a.profile.text} in both.` : `Profile: ${a.profile.text} (tropical), ${b.profile.text} (sidereal).`);
  const gates = (c: DesignChart) => new Set([...c.personality, ...c.design].map((x) => x.gate));
  const ga = gates(a);
  const gb = gates(b);
  const shared = [...ga].filter((x) => gb.has(x)).length;
  lines.push(`${shared} of ${ga.size} gates are the same in both.`);
  return { same: ta === tb && a.authority === b.authority && a.profile.text === b.profile.text, lines };
}

/** A short line on the chart for the assistant. Never the birth record. */
export interface DesignProfile {
  type: DesignType;
  strategy: string;
  authority: DesignAuthority;
  profile: string;
  /** Numerology: the life path, and the expression when a name was given. Never the name or the date. */
  lifePath: number;
  expression: number | null;
}
export const designProfile = (r: DesignResult): DesignProfile => {
  const c = designChart(r, 'tropical');
  const n = computeNumerology(r.input.date, r.input.name);
  return { type: c.type, strategy: DESIGN_TYPES[c.type].strategy, authority: c.authority, profile: c.profile.text, lifePath: n.lifePath.value, expression: n.expression?.value ?? null };
};


// ---- Numerology: the numbers in a birth date and a name, and what they say next to what Discover learned ----
// Numerology is a system for reflection, not science. Pythagorean letters (A=1 to I=9, then round again), master numbers 11, 22 and 33 kept whole,
// and the compound 10 and the karmic debts 13, 14, 16 and 19 noticed on the way down.

export interface NumberValue {
  /** The number it settles on: 1 to 9, or a master number 11, 22 or 33. */
  value: number;
  /** The sums on the way down, such as [19, 10, 1]. */
  chain: number[];
  master: boolean;
  /** The single digit under it: 11 is 2 underneath, 22 is 4, 33 is 6. */
  base: number;
  /** 13, 14, 16 or 19 when the sums passed through one of the karmic debts. */
  karmic: 13 | 14 | 16 | 19 | null;
}
const digitSum = (n: number): number => String(Math.abs(n)).split('').reduce((s, d) => s + Number(d), 0);
const MASTERS = [11, 22, 33];
export function numberValue(sum: number): NumberValue {
  const chain = [sum];
  let n = sum;
  while (n > 9 && !MASTERS.includes(n)) {
    n = digitSum(n);
    chain.push(n);
  }
  const karmic = chain.find((c) => c === 13 || c === 14 || c === 16 || c === 19) as 13 | 14 | 16 | 19 | undefined;
  const master = MASTERS.includes(n);
  return { value: n, chain, master, base: master ? digitSum(n) : n, karmic: karmic ?? null };
}
const reduced = (n: number): number => numberValue(n).value;

const PYTHAGOREAN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letterValue = (ch: string): number => ((PYTHAGOREAN.indexOf(ch) % 9) + 1);
/** The letters of a name, upper case, with accents taken off and anything else dropped. */
export const nameWords = (name: string): string[] =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
/** A word's vowels: A E I O U, and Y when the word has no other vowel. */
const vowelsOf = (word: string): string[] => {
  const v = word.split('').filter((c) => 'AEIOU'.includes(c));
  return v.length ? v : word.split('').filter((c) => c === 'Y');
};

export interface NumerologyResult {
  lifePath: NumberValue;
  birthday: NumberValue;
  attitude: NumberValue;
  /** From the full name: all letters, the vowels, the consonants. Null without a name. */
  expression: NumberValue | null;
  soulUrge: NumberValue | null;
  personality: NumberValue | null;
  /** The life path and the expression together. */
  maturity: NumberValue | null;
  /** Numbers from 1 to 9 that no letter of the name carries. */
  lessons: number[];
}
/** The numbers in a birth date (YYYY-MM-DD, as written on the record) and, if given, a full name. */
export function computeNumerology(date: string, name = ''): NumerologyResult {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const lifePath = numberValue(reduced(m) + reduced(d) + reduced(y));
  const words = nameWords(name);
  const letters = words.join('').split('');
  let expression: NumberValue | null = null;
  let soulUrge: NumberValue | null = null;
  let personality: NumberValue | null = null;
  let maturity: NumberValue | null = null;
  let lessons: number[] = [];
  if (letters.length > 0) {
    const sum = (cs: string[]) => cs.reduce((s, c) => s + letterValue(c), 0);
    const vowels = words.flatMap(vowelsOf);
    const vowelSet = new Set<string>();
    const consonants: string[] = [];
    for (const w of words) {
      const v = vowelsOf(w);
      w.split('').forEach((c, i) => (v.includes(c) && !(c === 'Y' && !v.every((x) => x === 'Y') ) ? vowelSet.add(`${w}${i}`) : consonants.push(c)));
    }
    expression = numberValue(sum(letters));
    soulUrge = vowels.length ? numberValue(sum(vowels)) : null;
    personality = consonants.length ? numberValue(sum(consonants)) : null;
    maturity = numberValue(lifePath.value + expression.value);
    const have = new Set(letters.map(letterValue));
    lessons = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !have.has(n));
  }
  return { lifePath, birthday: numberValue(d), attitude: numberValue(reduced(d) + reduced(m)), expression, soulUrge, personality, maturity, lessons };
}
/** The year, the month and the day you are in, from the birthday and today's date. The year turns over on 1 January. */
export function personalCycle(date: string, today: string): { year: NumberValue; month: NumberValue; day: NumberValue } {
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const year = numberValue(reduced(m) + reduced(d) + reduced(Number(today.slice(0, 4))));
  const month = numberValue(year.base + Number(today.slice(5, 7)));
  const day = numberValue(month.base + Number(today.slice(8, 10)));
  return { year, month, day };
}

export const NUMBER_LABELS: Record<'lifePath' | 'birthday' | 'attitude' | 'expression' | 'soulUrge' | 'personality' | 'maturity', { name: string; line: string }> = {
  lifePath: { name: 'Life path', line: 'The road you walk. The biggest number.' },
  birthday: { name: 'Birthday number', line: 'A gift you carry from the day you were born.' },
  attitude: { name: 'Attitude', line: 'How you meet the world at first.' },
  expression: { name: 'Expression', line: 'What you are here to do, from your full name.' },
  soulUrge: { name: 'Soul urge', line: 'What you want deep down, from the vowels of your name.' },
  personality: { name: 'Personality', line: 'How others see you, from the consonants of your name.' },
  maturity: { name: 'Maturity', line: 'Who you grow into later in life: life path and expression together.' },
};
export interface NumberReading {
  name: string;
  line: string;
  gift: string;
  shadow: string;
  tryThis: string;
  /** Which of the five Discover traits this number leans on. */
  leans: Partial<Record<Trait, 'high' | 'low'>>;
  /** The pillar it calls on. */
  pillar: RelationshipKey;
}
export const NUMBER_READINGS: Record<number, NumberReading> = {
  1: { name: 'The starter', line: 'You are here to begin things and to stand on your own.', gift: 'Courage, drive and the will to go first.', shadow: 'Going it alone, pushing too hard, or waiting to be told.', tryThis: 'Start one small thing this week without waiting for anyone’s okay.', leans: { c: 'high', a: 'low' }, pillar: 'servant_leader' },
  2: { name: 'The peacemaker', line: 'You are here to join people together and keep the peace.', gift: 'Listening, patience and tact.', shadow: 'Putting yourself last, or dodging a hard talk.', tryThis: 'Ask for one thing you need, kindly and plainly.', leans: { a: 'high', e: 'low' }, pillar: 'lover_partner' },
  3: { name: 'The voice', line: 'You are here to express yourself and bring joy.', gift: 'Words, humour and an easy way with people.', shadow: 'Scattering your energy, or hiding hurt behind a joke.', tryThis: 'Share something you made or wrote with one person.', leans: { e: 'high', o: 'high' }, pillar: 'friendship' },
  4: { name: 'The builder', line: 'You are here to build something solid and lasting.', gift: 'Discipline, order and reliability.', shadow: 'Rigidity, and worry about change.', tryThis: 'Pick one foundation habit and keep it for 21 days.', leans: { c: 'high', o: 'low' }, pillar: 'servant_leader' },
  5: { name: 'The explorer', line: 'You are here to change, to move and to learn by doing.', gift: 'Curiosity, freedom and quick adapting.', shadow: 'Restlessness, and starting more than you finish.', tryThis: 'Try one new thing this week, and finish one old thing.', leans: { o: 'high', c: 'low' }, pillar: 'guru' },
  6: { name: 'The carer', line: 'You are here to care for people and make a home.', gift: 'Warmth, responsibility and a love of beauty.', shadow: 'Taking on everyone’s load, or trying to control.', tryThis: 'Do one kind thing for family, then one for yourself.', leans: { a: 'high', s: 'high' }, pillar: 'parent_child' },
  7: { name: 'The seeker', line: 'You are here to look deeper and find the truth.', gift: 'Insight, focus and a quiet mind.', shadow: 'Pulling away, doubt and overthinking.', tryThis: 'Give one question twenty quiet minutes a day, then write one line.', leans: { o: 'high', e: 'low' }, pillar: 'divine' },
  8: { name: 'The achiever', line: 'You are here to build power, money and results, and to use them well.', gift: 'Drive, judgment and a head for business.', shadow: 'Chasing status, or working too much.', tryThis: 'Set one money or work goal with a number and a date.', leans: { c: 'high', s: 'high' }, pillar: 'servant_leader' },
  9: { name: 'The giver', line: 'You are here to finish things and to serve something larger.', gift: 'Compassion, wisdom and a wide view.', shadow: 'Holding on to the past, or giving until you are empty.', tryThis: 'Finish one thing you left open, then give something away.', leans: { a: 'high', o: 'high' }, pillar: 'divine' },
  10: { name: 'The wheel', line: 'Ten is a turning point: an ending and a fresh start in one number. It settles down to a 1.', gift: 'A chance to begin again with what you learned.', shadow: 'Clinging to what is over.', tryThis: 'Name one thing that is done. Close it, and take the first small step on the next.', leans: {}, pillar: 'self' },
  11: { name: 'The messenger', line: 'A master number, a high 2: you pick up what others miss and can light the way.', gift: 'Intuition, inspiration and sensitivity.', shadow: 'Nervous tension, and doubt about your own gift.', tryThis: 'Write down one hunch a day for a week, then act on one.', leans: { o: 'high', s: 'low' }, pillar: 'divine' },
  22: { name: 'The master builder', line: 'A master number, a high 4: you can turn a big vision into something real.', gift: 'Practical vision, and the patience to build at scale.', shadow: 'Feeling crushed by the size of your own vision.', tryThis: 'Break your biggest goal into ten steps and do the first one today.', leans: { c: 'high', o: 'high' }, pillar: 'servant_leader' },
  33: { name: 'The master teacher', line: 'A master number, a high 6: you are here to lift others through care.', gift: 'Healing, teaching and warm leadership.', shadow: 'Giving yourself away until you burn out.', tryThis: 'Teach one thing you know to one person, and stop when you are tired.', leans: { a: 'high', s: 'high' }, pillar: 'parent_child' },
};
export const KARMIC_DEBTS: Record<13 | 14 | 16 | 19, string> = {
  13: 'A debt around effort: work steadily, because shortcuts cost you more later. It settles into a 4.',
  14: 'A debt around freedom: keep a balance, because freedom works best with limits. It settles into a 5.',
  16: 'A debt around ego: let pride go, because a fall can be a clean start. It settles into a 7.',
  19: 'A debt around power: ask for help and share, and do not carry it all alone. It settles into a 1.',
};
export const YEAR_THEMES: Record<number, { theme: string; step: string }> = {
  1: { theme: 'A year to start. Plant seeds.', step: 'Start the one thing you have been putting off.' },
  2: { theme: 'A year to partner and be patient.', step: 'Make one connection stronger.' },
  3: { theme: 'A year to express and enjoy.', step: 'Share your work, and say yes to joy.' },
  4: { theme: 'A year to build a base.', step: 'Pick one foundation and work on it every week.' },
  5: { theme: 'A year of change and freedom.', step: 'Say yes to one change, and plan for it.' },
  6: { theme: 'A year of home and care.', step: 'Look after the people and the place close to you.' },
  7: { theme: 'A year to look inward.', step: 'Rest, study and think. Do less and see more clearly.' },
  8: { theme: 'A year of power and results.', step: 'Aim at one clear goal with a number.' },
  9: { theme: 'A year to finish and let go.', step: 'Close what is done, and clear space.' },
  11: { theme: 'A year of insight.', step: 'Listen for the hunch, and act on one.' },
  22: { theme: 'A year to build something big.', step: 'Take the first real step on a long plan.' },
  33: { theme: 'A year to teach and to heal.', step: 'Give your time to one person who needs it.' },
};
const TRAIT_STEP: Record<Trait, { high: string; low: string }> = {
  o: { high: 'Try one new thing in your pillars today, even a small one.', low: 'Keep the routine that works, and change only one thing in it.' },
  c: { high: 'Plan the day the night before, and give each task a finish line.', low: 'Pick one task and finish only that today. Small and done beats big and open.' },
  e: { high: 'Do one step with another person today: a friend, a circle or a run.', low: 'Keep a quiet hour in your day, and do your hardest task in it.' },
  a: { high: 'Put one of your own needs on today’s list, and keep it.', low: 'Say one kind, plain thing to someone today before you give your view.' },
  s: { high: 'Use your steadiness: take the one task others are avoiding.', low: 'Take two minutes with the breathing timer before your hardest task.' },
};
const TYPE_ACTION: Record<DesignType, string> = {
  generator: 'let the year bring things to you to respond to, and say yes only to what lights you up',
  mg: 'respond first, then tell the people involved your plan before you move',
  manifestor: 'start what the year asks for, and tell the people it touches before you act',
  projector: 'wait for the invitation that fits the year, and rest well',
  reflector: 'give each big choice a moon, about 28 days, before you commit',
};
export interface NumerologyContext {
  /** How each of the five traits reads, from the main Discover result. */
  traits?: Record<Trait, TraitBand> | null;
  top?: RelationshipKey[];
  growth?: RelationshipKey | null;
  design?: DesignProfile | null;
  love?: { receive: LoveKey[]; give: LoveKey[] } | null;
}
export interface NumerologyInsight {
  kind: 'agree' | 'stretch' | 'combo';
  title: string;
  text: string;
  /** A small thing to do about it. */
  step: string;
  pillar?: RelationshipKey;
}
/** What the numbers say next to what the person's own answers said: where they agree, where they stretch, and how they combine with the chart. */
export function numerologyInsights(n: NumerologyResult, cycle: ReturnType<typeof personalCycle>, ctx: NumerologyContext): NumerologyInsight[] {
  const out: NumerologyInsight[] = [];
  const core: [string, NumberValue | null][] = [
    ['Life path', n.lifePath],
    ['Expression', n.expression],
    ['Soul urge', n.soulUrge],
  ];
  const traitName = (t: Trait) => TRAITS.find((x) => x.key === t)!.name.toLowerCase();
  let agree = 0;
  let stretch = 0;
  for (const [label, v] of core) {
    if (!v) continue;
    const r = NUMBER_READINGS[v.value]!;
    const tag = `${label} ${v.value}${v.master ? `/${v.base}` : ''}`;
    for (const [trait, dir] of Object.entries(r.leans) as [Trait, 'high' | 'low'][]) {
      const band = ctx.traits?.[trait];
      if (!band || band === 'mid') continue;
      if (band === dir && agree < 3) {
        agree += 1;
        out.push({ kind: 'agree', title: `${tag} and your ${traitName(trait)}`, text: `Your ${tag}, ${r.name.toLowerCase()}, leans ${dir === 'high' ? 'high' : 'low'} on ${traitName(trait)}, and your Discover answers read ${band}. They point the same way, so this is a strength to lean on. ${r.gift}`, step: r.tryThis, pillar: r.pillar });
      } else if (band !== dir && stretch < 3) {
        stretch += 1;
        out.push({ kind: 'stretch', title: `${tag} and your ${traitName(trait)}`, text: `Your ${tag}, ${r.name.toLowerCase()}, leans ${dir} on ${traitName(trait)}, but your Discover answers read ${band}. That is a place to grow, not a flaw: a number says what you are here to build, not what you have built so far.`, step: TRAIT_STEP[trait][dir], pillar: r.pillar });
      }
    }
  }
  const lp = NUMBER_READINGS[n.lifePath.value]!;
  if (ctx.top?.includes(lp.pillar)) out.push({ kind: 'agree', title: 'Your life path and your top strengths', text: `Your life path calls on ${RELATIONSHIP_BY_KEY[lp.pillar].name.toLowerCase()}, and ${DISCOVER_STRENGTHS[lp.pillar].name} is one of your top three strengths in Discover. The road and the strength match.`, step: lp.tryThis, pillar: lp.pillar });
  else if (ctx.growth === lp.pillar) out.push({ kind: 'stretch', title: 'Your life path and your quietest strength', text: `Your life path calls on ${RELATIONSHIP_BY_KEY[lp.pillar].name.toLowerCase()}, but ${DISCOVER_STRENGTHS[lp.pillar].name} is your quietest strength in Discover. It is the easiest place to start a small habit.`, step: DISCOVER_STRENGTHS[lp.pillar].tryThis, pillar: lp.pillar });
  const yr = YEAR_THEMES[cycle.year.value] ?? YEAR_THEMES[cycle.year.base]!;
  if (ctx.design) {
    out.push({ kind: 'combo', title: `Personal year ${cycle.year.value} and your strategy`, text: `${yr.theme} Your Human design strategy is “${ctx.design.strategy.charAt(0).toLowerCase()}${ctx.design.strategy.slice(1)}”, so this year, ${TYPE_ACTION[ctx.design.type]}.`, step: yr.step });
  }
  if (ctx.love && [2, 6, 33].includes(n.lifePath.value)) {
    out.push({ kind: 'combo', title: 'A care number and how you show love', text: `Your life path ${n.lifePath.value} is about care, and you show love through ${ctx.love.give.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ')}. Put the two together in one act.`, step: LOVE_LANGUAGES[ctx.love.give[0]!].give, pillar: 'lover_partner' });
  }
  return out;
}

/** Progress through one add-on. */
export function extraProgress(kind: ExtraKind, raw: unknown): { done: number; total: number } {
  if (kind === 'design') return { done: designInputProblem(parseDesignInput(raw)) === null ? 1 : 0, total: 1 };
  if (kind === 'type') return { done: parseTypeAnswers(raw).filter(Boolean).length, total: TYPE_SCREENS.length };
  if (kind === 'mind') return { done: parseMindAnswers(raw).filter(Boolean).length, total: MIND_SCREENS.length };
  const a = parseLoveAnswers(raw);
  return { done: a.receive.filter((v) => v !== null).length + a.give.filter((v) => v !== null).length, total: LOVE_PAIRS.length * 2 };
}
export const extraComplete = (kind: ExtraKind, raw: unknown): boolean => {
  const p = extraProgress(kind, raw);
  return p.done === p.total;
};
export const emptyExtra = (kind: ExtraKind): unknown => (kind === 'type' ? emptyTypeAnswers() : kind === 'mind' ? emptyMindAnswers() : kind === 'design' ? emptyDesignInput() : emptyLoveAnswers());
export const parseExtra = (kind: ExtraKind, raw: unknown): unknown => (kind === 'type' ? parseTypeAnswers(raw) : kind === 'mind' ? parseMindAnswers(raw) : kind === 'design' ? parseDesignInput(raw) : parseLoveAnswers(raw));
export function scoreExtra(kind: ExtraKind, answers: unknown): TypeResult | LoveResult | MindResult | DesignResult {
  return kind === 'type' ? scoreType(answers as TypeAnswers) : kind === 'mind' ? scoreMind(answers as MindAnswers) : kind === 'design' ? computeDesign(answers as DesignInput) : scoreLove(answers as LoveAnswers);
}

/** A short summary of the add-ons taken. Never the answers or the scores. The mind part only travels when the person switched it on. */
export interface ExtrasProfile {
  type?: string;
  love?: { receive: LoveKey[]; give: LoveKey[] };
  mind?: Record<MindArea, MindBand>;
  /** Human design: the type, strategy, authority and profile only. Never the birth date, time or place. */
  design?: DesignProfile;
}
export function extrasProfile(x: { type?: TypeResult | null; love?: LoveResult | null; mind?: MindResult | null; design?: DesignResult | null }, allowMind: boolean): ExtrasProfile | null {
  const out: ExtrasProfile = {};
  if (x.type) out.type = x.type.code;
  if (x.design) out.design = designProfile(x.design);
  if (x.love) out.love = { receive: loveTop(x.love.receive), give: loveTop(x.love.give) };
  if (x.mind && allowMind) out.mind = Object.fromEntries(MIND_AREAS.map((a) => [a.key, x.mind!.areas[a.key].band])) as Record<MindArea, MindBand>;
  return Object.keys(out).length ? out : null;
}
/** How to help, from the add-ons. Never names a condition. */
export function extraHints(x: ExtrasProfile): string[] {
  const out: string[] = [];
  if (x.type) for (const l of x.type.split('')) if (l in TYPE_LETTERS) out.push(TYPE_LETTERS[l as TypeLetter].hint);
  if (x.love) {
    out.push(`They feel cared for through ${x.love.receive.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ')}, and show care through ${x.love.give.map((k) => LOVE_LANGUAGES[k].name.toLowerCase()).join(' and ')}. For a step about a person, suggest that kind of gesture.`);
  }
  if (x.design) {
    const h: Record<DesignType, string> = {
      generator: 'Let them respond: ask a clear question that can be answered with a yes or a no, rather than pushing a plan.',
      mg: 'Let them respond first, then help them tell the people involved before they move. They like to try several things.',
      manifestor: 'Do not hold them up with questions. Suggest telling the people involved before they act.',
      projector: 'Wait to be asked before you advise, and ask whether they would like your view first. Remind them to rest.',
      reflector: 'Do not rush big choices. Suggest giving them time and talking them over with a few people.',
    };
    out.push(h[x.design.type]);
    out.push(`Decisions suit their ${DESIGN_AUTHORITIES[x.design.authority].name.toLowerCase()} authority: ${DESIGN_AUTHORITIES[x.design.authority].line}`);
  }
  if (x.mind) {
    if (x.mind.att !== 'few') out.push('Offer one small step at a time and a short focus round. Use plain checklists and remind them kindly, never with blame.');
    if (x.mind.ene !== 'few') out.push('Keep steps short and active, and suggest a movement break between them.');
    if (x.mind.pat !== 'few') out.push('Keep things predictable. Say what is coming and warn them before a change. Be clear and literal.');
  }
  return out;
}
export function extrasForAssistant(x: ExtrasProfile): string {
  const bits: string[] = [];
  if (x.type) bits.push(`Four-letter type from a self-check: ${x.type} (${TYPE_NAMES[x.type]?.name ?? 'a type'}).`);
  if (x.love) bits.push(`Love languages: receives best through ${x.love.receive.map((k) => LOVE_LANGUAGES[k].name).join(' and ')}; shows love through ${x.love.give.map((k) => LOVE_LANGUAGES[k].name).join(' and ')}.`);
  if (x.design) bits.push(`Human design (a system for reflection, not science, so never state it as fact): ${DESIGN_TYPES[x.design.type].name}, strategy “${x.design.strategy}”, ${DESIGN_AUTHORITIES[x.design.authority].name.toLowerCase()} authority, profile ${x.design.profile}. Numerology, another reflection tool: life path ${x.design.lifePath} (${NUMBER_READINGS[x.design.lifePath]?.name.toLowerCase() ?? ''})${x.design.expression ? `, expression ${x.design.expression}` : ''}.`);
  if (x.mind) bits.push(`How their mind works, as self-reported signs (never a diagnosis, never name a condition, never suggest they have one): ${MIND_AREAS.map((a) => `${a.name.toLowerCase()}: ${x.mind![a.key]} signs`).join('; ')}. Use this only to pace and shape steps.`);
  return bits.join(' ');
}
/** The one paragraph the assistant reads: the main quiz and the add-ons together, either may be missing. */
export function learnedForAssistant(p: DiscoverProfile | null, x: ExtrasProfile | null): string | null {
  if (!p && !x) return null;
  if (p && !x) return profileForAssistant(p);
  const extra = `${extrasForAssistant(x!)} How to help: ${extraHints(x!).join(' ')}`;
  if (p) return `${profileForAssistant(p)} Self-checks too. ${extra}`;
  return `They took short self-checks in Discover. They are not diagnoses, so never state them back as facts about the person and never use them to label them. Use them only to pick your tone and the size of a step. ${extra}`;
}

/** A short summary of the latest result. Never the answers, and nothing a person could not read on their own Discover page. */
export interface DiscoverProfile {
  takenAt: string;
  top: RelationshipKey[];
  growth: RelationshipKey;
  bands: Record<Trait, TraitBand>;
  level: DiscoverAnalysis['reasoning']['level'];
  /** How each emotional intelligence part reads, when that part was taken. */
  eq?: Record<EqDim, TraitBand>;
}

export function discoverProfile(result: DiscoverResult, takenAt: string): DiscoverProfile {
  const a = analyseDiscover(result);
  const bands = Object.fromEntries(a.personality.map((p) => [p.trait, p.band])) as Record<Trait, TraitBand>;
  const eq = a.eq ? (Object.fromEntries(a.eq.dims.map((d) => [d.dim, d.band])) as Record<EqDim, TraitBand>) : undefined;
  return { takenAt, top: result.top, growth: result.growth, bands, level: a.reasoning.level, ...(eq ? { eq } : {}) };
}

/** How to help this person, in plain sentences: used to pick a tone and the size of a step. Rules only. */
export function styleHints(p: DiscoverProfile): string[] {
  const out: string[] = [];
  if (p.bands.c === 'low') out.push('Keep steps tiny and one at a time, each with a clear finish line.');
  if (p.bands.c === 'high') out.push('They like plans: give an ordered list and respect their deadlines.');
  if (p.bands.s === 'low') out.push('Be calm and reassuring. Name one small step and do not pile on.');
  if (p.bands.s === 'high') out.push('They are steady, so you can be direct.');
  if (p.bands.e === 'low') out.push('Keep messages short. Do not push social plans.');
  if (p.bands.e === 'high') out.push('They like energy: people-based steps, such as a friend, a circle or a run, suit them.');
  if (p.bands.a === 'high') out.push('Gently encourage them to put their own needs on the list.');
  if (p.bands.a === 'low') out.push('Be straight and brief. They prefer honesty to softness.');
  if (p.bands.o === 'high') out.push('Offer a fresh option now and then.');
  if (p.bands.o === 'low') out.push('Stick to routines that work and change one thing at a time.');
  if (p.eq?.m === 'low') out.push('When they are upset, slow down and name the feeling before you offer a step.');
  if (p.eq?.a === 'low') out.push('Ask how they feel before you suggest a fix.');
  if (p.eq?.s === 'low') out.push('Keep hard conversations in small steps, and let them lead.');
  if (p.eq?.d === 'low') out.push('Celebrate small wins, because motivation dips when results are slow.');
  out.push(p.level === 'Sharp' || p.level === 'Strong' ? 'They like to know the why: give a short reason.' : 'Use short examples and plain words.');
  return out;
}

/** The paragraph the assistant reads, when the person allowed it and the model keeps nothing. */
export function profileForAssistant(p: DiscoverProfile): string {
  const strengths = p.top.map((k) => DISCOVER_STRENGTHS[k].name).join(', ');
  const traits = TRAITS.map((t) => `${t.name.toLowerCase()}: ${p.bands[t.key]}`).join('; ');
  const eqLine = p.eq ? ` Emotional side: ${EQ_DIMS.map((d) => `${d.name.toLowerCase()}: ${p.eq![d.key]}`).join('; ')}.` : '';
  return `They took the Discover quiz on ${p.takenAt.slice(0, 10)}. It is a self-check, not a diagnosis, so never state it back as a fact about them and never use it to label them. Use it only to pick your tone and the size of a step. Strongest: ${strengths}. Quietest: ${DISCOVER_STRENGTHS[p.growth].name}. Traits: ${traits}. Reasoning puzzles: ${p.level}.${eqLine} How to help: ${styleHints(p).join(' ')}`;
}

/** Where each strength is worked on in the app. */
export const STRENGTH_PATH: Record<RelationshipKey, string> = Object.fromEntries((Object.keys(DISCOVER_STRENGTHS) as RelationshipKey[]).map((k) => [k, `/realm/${k}`])) as Record<RelationshipKey, string>;
