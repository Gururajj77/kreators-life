import type { RelationshipKey } from './core.ts';
import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Life: five areas, one dashboard
// ---------------------------------------------------------------------------

// The five areas always go in this order, on every page, chart, list and line
// of copy (the founder's rule, 2026-11-04): physical, financial, mental,
// emotional, spiritual. Each one holds up the next: when one fails it pulls
// down the one after it, and when it is strong it lifts it. The seven pillars
// keep their own order (`RELATIONSHIPS`); this is only the five areas.
export type LifeAreaKey = 'physical' | 'financial' | 'mental' | 'emotional' | 'spiritual';

/** The one order of the five areas. Anything that lists them maps over this. */
export const LIFE_AREA_ORDER: readonly LifeAreaKey[] = ['physical', 'financial', 'mental', 'emotional', 'spiritual'];

export const LIFE_AREAS: Record<LifeAreaKey, { name: string; icon: IconName; blurb: string; path: string; relationship: RelationshipKey }> = {
  physical: { name: 'Physical', icon: 'Activity', blurb: 'Sleep, movement and breath.', path: '/wellbeing', relationship: 'self' },
  financial: { name: 'Financial', icon: 'Wallet', blurb: 'What comes in, what goes out, where you are heading.', path: '/finance', relationship: 'servant_leader' },
  mental: { name: 'Mental', icon: 'Brain', blurb: 'Stress, focus, and what you are learning.', path: '/stress', relationship: 'guru' },
  emotional: { name: 'Emotional', icon: 'Heart', blurb: 'Mood, what you wrote, and the people close to you.', path: '/mood', relationship: 'lover_partner' },
  spiritual: { name: 'Spiritual', icon: 'Sparkles', blurb: 'Stillness, awe, teachers and faith.', path: '/mindful', relationship: 'divine' },
};

/** True for one of the five keys. */
export function isLifeAreaKey(v: unknown): v is LifeAreaKey {
  return typeof v === 'string' && (LIFE_AREA_ORDER as readonly string[]).includes(v);
}

/**
 * The area of life a task or habit carries, read from what was sent: a key ("physical") or a name in any case
 * ("Physical"). Null, an empty string, "none" or anything else gives null, so a caller that must refuse an unknown
 * value checks it with `lifeAreaProblem` first.
 */
export function parseLifeArea(v: unknown): LifeAreaKey | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  if (!t || t === 'none') return null;
  for (const key of LIFE_AREA_ORDER) if (t === key || t === LIFE_AREAS[key].name.toLowerCase()) return key;
  return null;
}

/** What a request may send as a task's area: a key or name, or null, '' or "none" to clear it. Anything else is refused with this line. */
export const LIFE_AREA_PROBLEM = 'pick one of the five areas, or none';
export function lifeAreaProblem(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && (!v.trim() || v.trim().toLowerCase() === 'none')) return null;
  return parseLifeArea(v) ? null : LIFE_AREA_PROBLEM;
}

export interface LifePart {
  label: string;
  /** What to show, e.g. "7.2 h" or "3 of 5 days". */
  value: string;
  /** Null when there is nothing logged yet. */
  score: number | null;
  path: string;
  hint: string;
}

export interface LifeArea {
  key: LifeAreaKey;
  score: number;
  /** Change against the week before, in points. */
  trend: number;
  parts: LifePart[];
}

export interface LifeSummary {
  date: string;
  overall: number;
  label: string;
  areas: LifeArea[];
}
