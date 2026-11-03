/**
 * The one wordmark, in the app and on the site: kreators.app, lowercase with the dot, in the display face. The dot carries the seven
 * pillar colours, red to violet, so the mark says "seven" without drawing anyone. No characters in the logo. `compact` shortens it to
 * "k" and the dot on the narrowest phones, where the whole name does not fit beside the corner buttons. Screen readers always hear
 * "kreators.app".
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const full = compact ? 'max-[379px]:hidden' : undefined;
  return (
    <span className="inline-flex items-baseline font-display font-extrabold tracking-tight">
      <span className="inline-flex items-baseline" aria-hidden="true">
        <span className={full}>kreators</span>
        {compact && <span className="min-[380px]:hidden">k</span>}
        <span className="brand-dot" />
        <span className={full}>app</span>
      </span>
      <span className="sr-only">kreators.app</span>
    </span>
  );
}
