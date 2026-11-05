/**
 * The plain words for any error: an Error's own message (the server's line when there is one), else a line that says what to do.
 * Its own module with no imports, so `lib/api.ts` (preloaded as `app-api`) and `components/ErrorLine.tsx` can both re-export it
 * without pulling each other in.
 */
export function errorText(e: unknown, fallback = 'That did not work. Check your connection and try again.'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
