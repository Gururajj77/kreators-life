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
/** A small select in a toolbar or a table row. */
export const SELECT_SM = 'min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium';
/** The words above a field. */
export const LABEL = 'block text-subhead font-semibold';
/** A destructive yes, the one look (`.red-yes` in app.css): the pale red outline at rest, solid red on a mouse hover, keyboard focus or a press. */
export const RED_YES = 'toy inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill px-md text-headline red-yes disabled:opacity-50';
/** The same yes in a stacked column, level with a `size="lg"` Keep under it. */
export const RED_YES_LG = 'toy inline-flex min-h-[56px] items-center justify-center gap-xs rounded-pill px-md text-headline red-yes disabled:opacity-50';

/** A pill that picks one of a few (a filter, a sort): solid only once it is picked. 44px tall. */
export const chip = (on: boolean) => `toy inline-flex min-h-[44px] shrink-0 items-center rounded-pill border-2 px-sm text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`;

/** A typed amount in cents (`typedCents`: "30,000" and "₹30,000" read as 30000); NaN for junk or a minus, so the form can say so. Blank is 0. */
export const feeCents = (v: string): number => {
  const c = typedCents(v);
  return Number.isInteger(c) && c >= 0 ? c : Number.NaN;
};
