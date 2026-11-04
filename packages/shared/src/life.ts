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
  emotional: { name: 'Emotional', icon: 'Heart', blurb: 'Mood, what you wrote, and the people pillars.', path: '/mood', relationship: 'lover_partner' },
  spiritual: { name: 'Spiritual', icon: 'Sparkles', blurb: 'Stillness, awe, and the top two pillars.', path: '/mindful', relationship: 'divine' },
};

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
