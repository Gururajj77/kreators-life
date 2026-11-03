import { BADGE_META, type BadgeRole } from '@kreators/shared';
import { RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { AppIcon } from './AppIcon';

/**
 * The small badge that says what someone is here: creator, life coach, staff or admin (`badgeRoleOf` picks it). It
 * sits on the profile picture and under the logo in the sidebar. It is not an earned badge; those stay on the
 * profile page and the public page.
 */
export function RoleBadge({ role, size = 24, className = '' }: { role: BadgeRole; size?: number; className?: string }) {
  const meta = BADGE_META[role];
  const rel = RELATIONSHIP_BY_KEY[meta.accent];
  return (
    <span role="img" aria-label={meta.name} title={meta.name} className={`inline-flex shrink-0 items-center justify-center rounded-pill bg-card ${className}`} style={{ width: size, height: size, color: rel.color, boxShadow: `0 0 0 2px ${rel.color}` }}>
      <AppIcon name={meta.icon} size={Math.round(size * 0.58)} />
    </span>
  );
}
