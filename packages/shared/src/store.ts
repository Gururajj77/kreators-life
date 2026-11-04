// ---------------------------------------------------------------------------
// Store: new gear through partner links, pre-owned gear from other creators, kits by budget, featured spots
// ---------------------------------------------------------------------------

export const STORE_CATEGORIES = ['Camera', 'Audio', 'Lighting', 'Computer', 'Phone', 'Software', 'Desk', 'Other'] as const;
export const STORE_STAGES = ['starting', 'growing', 'pro', 'any'] as const;
export type StoreStage = (typeof STORE_STAGES)[number];
export const STORE_STAGE_META: Record<StoreStage, { name: string; blurb: string }> = {
  starting: { name: 'Starting out', blurb: 'First videos, one mic, a phone that already works.' },
  growing: { name: 'Growing', blurb: 'Posting every week and ready for a real camera and light.' },
  pro: { name: 'Full time', blurb: 'This pays the rent, so the gear has to.' },
  any: { name: 'Any stage', blurb: 'Good at every step.' },
};
export const PREOWNED_CONDITIONS = ['new', 'lightly_used', 'regularly_used', 'well_used'] as const;
export type PreownedCondition = (typeof PREOWNED_CONDITIONS)[number];
export const PREOWNED_CONDITION_META: Record<PreownedCondition, { name: string; blurb: string }> = {
  new: { name: 'Brand new', blurb: 'Sealed, or never used.' },
  lightly_used: { name: 'Lightly used', blurb: 'Looks new, works like new.' },
  regularly_used: { name: 'Regularly used', blurb: 'Marks of use, fully working.' },
  well_used: { name: 'Well used', blurb: 'Worn, still working. Say what is wrong.' },
};
export const LISTING_STATUSES = ['live', 'agreed', 'sold', 'withdrawn'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const OFFER_STATUSES = ['open', 'accepted', 'declined', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
/** A featured spot: a week at the top, paid in points by a seller, free when staff give it. */
export const FEATURE_FEE_POINTS = 200;
export const FEATURE_DAYS = 7;
export const MAX_LISTING_IMAGES = 6;
export const MAX_KIT_ITEMS = 12;
export const MAX_OPEN_LISTINGS = 20;
export const isFeatured = (until: string | null | undefined, now = new Date().toISOString()): boolean => Boolean(until && until > now);
/** Picture links: https only, a handful at most. */
export function parseImageUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, 500))
    .filter((x) => /^https:\/\//.test(x))
    .slice(0, MAX_LISTING_IMAGES);
}
