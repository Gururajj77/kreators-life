/**
 * Every ask still waiting between two people goes with a block by name, at once and quietly, nobody told (2026-11-10), from whichever
 * door the block came: Bond's Block (routes/bond.ts) or the Block on a named post, reply, channel, run or cohort line (`blockBehind` in
 * routes/community.ts). A block behind a made-up name never runs it: closing an ask would say who the name was.
 *
 * What goes: a brand's ask where either is an active owner and the other the one asked (and its note); a friend suggestion the team made
 * for the two (and both its notes); an Agency team invite between owner and member (and its note); a private program's invite between its
 * maker and the person, and a private course's between its owner and the person, while not yet taken up (the break-it check of wave 27:
 * the person could still enrol in, or buy, the blocker's private place). Each team row that pointed at one is ended with it, so Connect
 * people reads it as ended. Statements for the caller's batch, in this order; no imports, no round trip of their own.
 */
export function blockAsksStmts(db: D1Database, a: string, b: string, now: string): D1PreparedStatement[] {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  // Owner `owner` of a brand the other was asked onto, still waiting (`m` is the ask's membership row).
  const asked = (owner: string, person: string) =>
    `(m.user_id = ${person} AND EXISTS (SELECT 1 FROM organization_members o WHERE o.organization_id = m.organization_id AND o.user_id = ${owner} AND o.role = 'owner' AND o.status = 'active'))`;
  const orgAsks = `SELECT m.organization_id, m.user_id FROM organization_members m WHERE m.status = 'invited' AND m.user_id IN (?1, ?2) AND (${asked('?1', '?2')} OR ${asked('?2', '?1')})`;
  const teamPair = "status = 'invited' AND ((owner_id = ?1 AND member_id = ?2) OR (owner_id = ?2 AND member_id = ?1))";
  // A private program's invite from its maker to the other, or a private course's from its owner, not yet taken up (`i` is the invite).
  const programInvite = (maker: string, person: string) =>
    `(i.user_id = ${person} AND EXISTS (SELECT 1 FROM programs p WHERE p.id = i.program_id AND p.created_by = ${maker})
      AND NOT EXISTS (SELECT 1 FROM enrollments e JOIN cohorts k ON k.id = e.cohort_id WHERE k.program_id = i.program_id AND e.learner_user_id = i.user_id AND e.status != 'withdrawn'))`;
  const courseInvite = (owner: string, person: string) =>
    `(i.user_id = ${person} AND EXISTS (SELECT 1 FROM products p WHERE p.id = i.product_id AND p.owner_id = ${owner})
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.product_id = i.product_id AND o.buyer_id = i.user_id AND o.status IN ('paid', 'test')))`;
  const programs = `SELECT i.program_id, i.user_id FROM program_invites i WHERE i.user_id IN (?1, ?2) AND (${programInvite('?1', '?2')} OR ${programInvite('?2', '?1')})`;
  const courses = `SELECT i.product_id, i.user_id FROM product_invites i WHERE i.user_id IN (?1, ?2) AND (${courseInvite('?1', '?2')} OR ${courseInvite('?2', '?1')})`;
  return [
    // A brand's ask: its team row ends, its note goes, then the ask itself.
    db
      .prepare(`UPDATE team_connections SET ended_at = ?3 WHERE kind = 'org' AND ended_at IS NULL AND first_user_id IN (?1, ?2) AND (ref_id, first_user_id) IN (${orgAsks})`)
      .bind(a, b, now),
    db.prepare(`DELETE FROM notifications WHERE user_id IN (?1, ?2) AND id IN (SELECT 'org-ask-' || organization_id || '-' || user_id FROM (${orgAsks}))`).bind(a, b),
    db.prepare(`DELETE FROM organization_members AS m WHERE m.status = 'invited' AND m.user_id IN (?1, ?2) AND (${asked('?1', '?2')} OR ${asked('?2', '?1')})`).bind(a, b),
    // The team's friend suggestion for the two: both its notes, then the row.
    db
      .prepare(
        `DELETE FROM notifications WHERE user_id IN (?1, ?2) AND id IN (SELECT 'suggest-' || id || '-' || ?1 FROM team_connections WHERE kind = 'friends' AND status = 'asked' AND first_user_id = ?1 AND second_user_id = ?2
           UNION SELECT 'suggest-' || id || '-' || ?2 FROM team_connections WHERE kind = 'friends' AND status = 'asked' AND first_user_id = ?1 AND second_user_id = ?2)`,
      )
      .bind(lo, hi),
    db.prepare("UPDATE team_connections SET status = 'ended', ended_at = ?3 WHERE kind = 'friends' AND status = 'asked' AND first_user_id = ?1 AND second_user_id = ?2").bind(lo, hi, now),
    // An Agency team invite: its team row ends, its note goes, then the invite.
    db.prepare(`UPDATE team_connections SET ended_at = ?3 WHERE kind = 'agency' AND ended_at IS NULL AND ref_id IN (SELECT id FROM agency_team WHERE ${teamPair})`).bind(a, b, now),
    db.prepare(`DELETE FROM notifications WHERE user_id IN (?1, ?2) AND id IN (SELECT 'team-' || id FROM agency_team WHERE ${teamPair})`).bind(a, b),
    db.prepare(`UPDATE agency_team SET status = 'removed', ended_by = 'owner', removed_at = ?3, updated_at = ?3 WHERE ${teamPair}`).bind(a, b, now),
    // A private program's or course's invite between its maker and the other: its team row ends, then the invite.
    db
      .prepare(`UPDATE team_connections SET ended_at = ?3 WHERE kind = 'program' AND ended_at IS NULL AND first_user_id IN (?1, ?2) AND (ref_id, first_user_id) IN (${programs})`)
      .bind(a, b, now),
    db.prepare(`DELETE FROM program_invites AS i WHERE i.user_id IN (?1, ?2) AND (${programInvite('?1', '?2')} OR ${programInvite('?2', '?1')})`).bind(a, b),
    db
      .prepare(`UPDATE team_connections SET ended_at = ?3 WHERE kind = 'product' AND ended_at IS NULL AND first_user_id IN (?1, ?2) AND (ref_id, first_user_id) IN (${courses})`)
      .bind(a, b, now),
    db.prepare(`DELETE FROM product_invites AS i WHERE i.user_id IN (?1, ?2) AND (${courseInvite('?1', '?2')} OR ${courseInvite('?2', '?1')})`).bind(a, b),
  ];
}
