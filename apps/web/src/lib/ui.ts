import { typedCents } from '@kreators/shared';

// The class strings every form shares, defined once (they were copied into 53 screens). Change a field's look here.

/** A full-width text field under its label: the common one. */
export const FIELD = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body';
/** The same field with no space above, for a field that sits beside something else in a row. */
export const FIELD_LINE = 'w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body';
/** The common field on a solid card instead of the glass paper: the sign-in and sign-up forms. */
export const FIELD_CARD = 'mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-body';
/** A filter field in a staff toolbar (Logs, Observability): on the card. */
export const FIELD_FILTER = 'w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-body';
/** A field on the readable solid card, so a quiet placeholder holds 4.5:1 on any wash behind it (attendee codes). */
export const FIELD_SOLID = 'w-full rounded-tile border-2 border-line bg-card-strong px-sm py-sm text-body';
/** A field inside a table cell, edited in place (DataTable): 44px tall, never narrower than 120px. */
export const FIELD_CELL = 'min-h-[44px] w-full min-w-[120px] rounded-tile border-2 border-line bg-paper px-sm text-subhead';
/** The common field held at 44px whatever it holds (a date, a select): the admin forms. */
export const FIELD_44 = 'mt-xs min-h-[44px] w-full rounded-tile border-2 border-line bg-paper px-sm text-body';
/**
 * Button heights (2026-11-07, the founder: "make the buttons height lesser, this is more for mobile"): on a phone lg 48, md 40, sm and chips 36,
 * from `md` today's 56, 48 and 44. Under 44 `tap-pad` (app.css) keeps the 44 by 44 hit area. A select or a field cannot carry it, so they stay 44.
 */
export const BTN_LG = 'min-h-[48px] md:min-h-[56px]';
export const BTN_MD = 'min-h-[40px] md:min-h-[48px] tap-pad';
export const BTN_SM = 'min-h-[36px] md:min-h-[44px] tap-pad';
/** A small select in a toolbar or a table row. */
export const SELECT_SM = 'min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium';
/** The words above a field. */
export const LABEL = 'block text-subhead font-semibold';
/** A destructive yes, the one look (`.red-yes` in app.css): the pale red outline at rest, solid red on a mouse hover, keyboard focus or a press. */
export const RED_YES = 'toy inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center justify-center gap-xs rounded-pill px-md text-headline red-yes disabled:opacity-50';
/** The same yes in a stacked column, level with a `size="lg"` Keep under it. */
export const RED_YES_LG = 'toy inline-flex min-h-[48px] md:min-h-[56px] items-center justify-center gap-xs rounded-pill px-md text-headline red-yes disabled:opacity-50';

/**
 * Room for the Water bubble at the bottom left of Daily and Journal (ReminderBubble, fixed 16px past the sidebar, up to 10rem wide): the
 * bubble's right edge and an 8px gap, less the column's own left gap (32px, and from the laptop width half of what the window has past the
 * 1072px frame). From the `lg` width, where the bubble is: a tablet has the Water and reminders section in the page like a phone.
 */
export const WATER_LANE = 'lg:[&>*]:ml-[max(0px,calc(10rem_-_var(--spacing-xs)_-_max(0px,(100vw_-_1040px_-_var(--spacing-lg))_/_2)))]';

/** A pill that picks one of a few (a filter, a sort): solid only once it is picked. 36px tall on a phone, 44 from `md`; `tap-pad` keeps the 44px hit area. */
export const chip = (on: boolean) => `toy inline-flex min-h-[36px] md:min-h-[44px] tap-pad shrink-0 items-center rounded-pill border-2 px-sm text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`;

/** A typed amount in cents (`typedCents`: "30,000" and "₹30,000" read as 30000); NaN for junk or a minus, so the form can say so. Blank is 0. */
export const feeCents = (v: string): number => {
  const c = typedCents(v);
  return Number.isInteger(c) && c >= 0 ? c : Number.NaN;
};
