// "Your year" on Profile lives in the barrel (index.ts, its last block), since the barrel has no runtime imports: the smoke scripts load it
// straight from TypeScript in Node, which cannot follow an import without its extension. This path re-exports it for whoever wants it alone.
export { ACTIVITY_DAYS, activityLevel, activityRange, activityWeeks } from './index';
export type { ActivityDay, ActivityMetric, ActivityYear } from './index';
