import { createElement } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Icon } from '../components/Icon';

/**
 * The public site's buttons: three looks, one job each, the same on every page (the 2026-11-04 founder rule).
 *
 * 1. `SITE_PRIMARY`: the one main action of a page or a band (Start free, Go to app, Open an app for someone signed in). Solid ink.
 *    Only the home page's hero wraps it in `LiquidMetal`; the last call to action, on the fractal glass, wraps `SITE_PRIMARY_ON_GLASS`
 *    in it instead. On an ink band it flips (`SITE_PRIMARY_ON_INK`).
 * 2. `SITE_SECONDARY`: every other action button, one look everywhere: no fill, a visible hairline edge, semibold words, and
 *    `SiteArrow` after the words when it goes to another page. It lifts on hover (`toy`). It is never a filled surface, so it can never be
 *    mistaken for a guide's speech bubble (`GuideLine`: a soft tint with a tail, no edge, no lift). `SITE_CHIP` is its small size,
 *    for rows of app or pillar pills.
 * 3. `SITE_LINK`: underlined words, for a jump ("See how it works", "About the books", "See all in Explore"). `SITE_LINK_INLINE`
 *    is the same link inside a sentence, without the 44px box.
 *
 * Sections that follow each other never switch looks for the same kind of action, so a page never shows a glass pill under an outline one.
 */
const PILL = 'inline-flex items-center justify-center gap-xs rounded-pill text-center';

/** The one main action: solid ink with the sweep of light. */
export const SITE_PRIMARY = `toy fx-shimmer btn-primary ${PILL} min-h-[56px] bg-ink px-lg text-headline text-on-ink`;
/** The main action on an ink band: the card colour with ink text, so it still reads as the one solid thing there. */
export const SITE_PRIMARY_ON_INK = `toy fx-shimmer ${PILL} min-h-[56px] bg-card px-lg text-headline text-ink`;
/** The main action on the fractal glass bands (`FractalGlass`, deep navy in both themes): white with the fixed slate ink, so it is the one bright thing there in either theme. */
export const SITE_PRIMARY_ON_GLASS = `toy fx-shimmer ${PILL} min-h-[56px] bg-on-fill px-lg text-headline text-ink-fixed`;
/** The header's door into the app: the primary look at the header's height. */
export const SITE_PRIMARY_SM = `toy btn-primary ${PILL} min-h-[44px] bg-ink px-md text-callout font-semibold text-on-ink`;

/** No fill at rest: only the edge says "button" (the hover tints it). */
const OUTLINE = `toy toy-ink btn-outline ${PILL} border border-ink/40 bg-transparent text-ink`;
/** Every other action button. Put `<SiteArrow />` after the words when it opens another page. */
export const SITE_SECONDARY = `${OUTLINE} min-h-[48px] px-md text-callout font-semibold`;
/** The secondary look at a chip's size (app and pillar pills). Without padding: add `px-sm`, or `pl-xs pr-md` beside an avatar. */
export const SITE_CHIP_BASE = `${OUTLINE} min-h-[44px] text-subhead font-semibold`;
export const SITE_CHIP = `${SITE_CHIP_BASE} px-sm`;

/** The arrow a secondary button wears when it goes somewhere: the one sign, besides its edge, that it is a control. */
export function SiteArrow() {
  return createElement(Icon, { icon: ArrowUpRight, size: 18 });
}

/** A jump: underlined words with a 44px tap height. */
export const SITE_LINK = 'inline-flex min-h-[44px] items-center gap-xs font-medium underline underline-offset-4 hover:text-ink-soft';
/** A jump inside a sentence. */
export const SITE_LINK_INLINE = 'font-medium underline underline-offset-4 hover:text-ink-soft';
