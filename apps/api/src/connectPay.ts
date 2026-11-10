/**
 * Who a connection the team made pays, and under which key (2026-11-10, the founder's "fix all these properly" on wave 26's open
 * questions). One rule in SQL, read by the payment (`payConnection` in invites.ts) and by the Connected badge's count (`getStats` in
 * db.ts), so the badge counts exactly what pays. No imports: db.ts and invites.ts both read it.
 *
 * - Whoever made a connection is never paid for it (`created_by`), so a staff member cannot pay themselves by connecting themselves.
 * - A job pays nobody for the job: a cohort's manager pays no side, and a Club manager pays the member, never the manager.
 * - Once per kind, pair and place, ever: ending a connection and making it again never pays again. The place is the program, course,
 *   cohort, brand or Club membership a kind names; a coach link and an Agency invite are a new row each time, so their pair is the key.
 *   Counted from the rows that came true (`CONNECT_PAID_BEFORE`), which an erase of progress keeps, as well as from the payment itself,
 *   which an erase takes away (2026-11-10, the break-it check: an erase, then the same suggestion again, paid a second time).
 * - A place's own maker connecting someone to it pays nobody (the break-it check): inviting someone to a private program you made, a
 *   course or a brand you own, is the invite the place's own route sends, which never paid, so making places is no way to pay a friend.
 */

/** Whether a connection row (alias `t`) pays the person `who` (a column or a bound parameter). */
export const CONNECT_PAYS = (t: string, who: string): string =>
  `(${t}.kind != 'cohort' AND (${t}.created_by IS NULL OR ${t}.created_by != ${who}) AND NOT (${t}.kind = 'club' AND ${t}.second_user_id = ${who})
    AND NOT (${t}.kind = 'program' AND EXISTS (SELECT 1 FROM programs pp WHERE pp.id = ${t}.ref_id AND pp.created_by = ${t}.created_by))
    AND NOT (${t}.kind = 'product' AND EXISTS (SELECT 1 FROM products pp WHERE pp.id = ${t}.ref_id AND pp.owner_id = ${t}.created_by))
    AND NOT (${t}.kind = 'org' AND EXISTS (SELECT 1 FROM organization_members pp WHERE pp.organization_id = ${t}.ref_id AND pp.user_id = ${t}.created_by AND pp.role = 'owner')))`;

/** Whether another row with the same key as `t` already came true and paid (or was due to pay) `who`: then `t` pays them nothing. */
export const CONNECT_PAID_BEFORE = (t: string, who: string): string =>
  `EXISTS (SELECT 1 FROM team_connections o WHERE o.id != ${t}.id AND o.came_true_at IS NOT NULL AND o.kind = ${t}.kind AND o.first_user_id = ${t}.first_user_id
     AND o.second_user_id IS ${t}.second_user_id AND (${t}.kind NOT IN ('program', 'product', 'cohort', 'org', 'club') OR o.ref_id IS ${t}.ref_id)
     AND ${CONNECT_PAYS('o', who)})`;

/** The key a payment is claimed under (xp_events.source_id for source 'connect'): the kind, the two people and the place. */
export const CONNECT_PAY_KEY = (t: string): string =>
  `(${t}.kind || ':' || ${t}.first_user_id || ':' || COALESCE(${t}.second_user_id, '') || ':' || CASE WHEN ${t}.kind IN ('program', 'product', 'cohort', 'org', 'club') THEN COALESCE(${t}.ref_id, '') ELSE '' END)`;
