/**
 * Undoing by rank, the one rule for every door that undoes a connection the team made (2026-11-10, the founder's "fix all these properly",
 * then the break-it check of wave 27). The rule a guide's undo follows: undoing needs at least the rank that did it. So a connection an
 * admin or the admin key made (team_connections.made_as, migration 0131, kept as they stood when they made it) is ended, taken back or
 * replaced only by an admin, whether from Connect people's End, Army's Withdraw by talent staff, the Club's manager route by a reviewer or
 * the cohort page by staff with Cohorts. A place's own maker on their own place keeps their own route (a brand's owner, a program's maker),
 * as they always had it: they are not acting for the team there. No imports beyond types: school.ts, club.ts, orgs.ts and adminConnect.ts read it.
 */

/** How the maker of a team connection stood when they made it. */
export type MadeAs = 'key' | 'admin' | 'staff';
export const madeAsOf = (actor: { role: string } | null): MadeAs => (!actor ? 'key' : actor.role === 'admin' ? 'admin' : 'staff');

/** The words when someone not an admin tries to change a manager an admin named (the cohort page, the Club's route, Connect people). */
export const ADMIN_NAMED_MANAGER = 'An admin named this manager. Only an admin can change it.';

/**
 * Whether the connection now live on this place was made by an admin or the key. A cohort's or a Club membership's live row is its one
 * open row (naming a manager ends the rows before it); a brand's is the ask still waiting for this person (no answer yet, not ended).
 */
export async function adminHolds(db: D1Database, kind: 'cohort' | 'club' | 'org', refId: string, personId: string | null = null): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS x FROM team_connections WHERE kind = ?1 AND ref_id = ?2 AND ended_at IS NULL AND made_as != 'staff'
         AND (?1 != 'org' OR (first_user_id = ?3 AND answered_at IS NULL)) LIMIT 1`,
    )
    .bind(kind, refId, personId)
    .first();
  return Boolean(row);
}

/**
 * Ends every open row on a place whose manager changed (a cohort or a Club membership), so one row is live per real connection. It goes
 * in the batch with the change, after it, and acts only when the place now holds `managerId`, so a change refused as stale ends nothing.
 */
export const endManagerRows = (db: D1Database, kind: 'cohort' | 'club', refId: string, managerId: string | null, now: string): D1PreparedStatement =>
  db
    .prepare(
      `UPDATE team_connections SET ended_at = ?1 WHERE kind = ?2 AND ref_id = ?3 AND ended_at IS NULL
         AND EXISTS (SELECT 1 FROM ${kind === 'cohort' ? 'cohorts' : 'memberships'} WHERE id = ?3 AND manager_user_id IS ?4)`,
    )
    .bind(now, kind, refId, managerId);
