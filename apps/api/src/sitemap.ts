import { MODULES } from '@kreators/shared';

/** Module keys that have a public feature page. Kept beside the site copy's own list in apps/web/src/site/content.ts. */
export const FEATURE_KEYS = MODULES.filter((m) => !['search', 'notifications', 'manage', 'admin'].includes(m.key)).map((m) => m.key);
