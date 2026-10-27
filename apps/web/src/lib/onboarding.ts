import type { SessionResponse } from '@kreators/shared';

/**
 * Where an unfinished onboarding continues. The strategy session comes first and is saved in two halves
 * (the assessment, then the plan); once the plan is signed, the vibe check builds the focus pillars.
 */
export function nextOnboardingPath(s: SessionResponse | undefined | null): string {
  if (!s || !s.assessment || !s.contract) return '/session';
  const focus = s.assessment.focus.filter(Boolean);
  return focus.length ? `/vibe-check?floors=${focus.join(',')}` : '/vibe-check';
}
