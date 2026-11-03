import type { DiscoverKeys } from '@kreators/shared';

/**
 * Discover's answer keys, kept on the server only (P138, 2026-11-03). The situations and scenes themselves are in shared
 * (DISCOVER_SCENES, EQ_READING, EQ_PEOPLE) because the quiz shows them; what each option is worth is here, so the web bundle
 * never carries the best answers. `scoreDiscover` and `scoreEq` take these as their second argument (routes/discover.ts).
 * Each list follows its shared list in order; a new situation gets its key here in the same place.
 */
export const DISCOVER_KEYS: DiscoverKeys = {
  // How effective each option is, 1 (least) to 4 (most), from the team's own reading of each situation.
  scenes: [
    [2, 4, 1, 3],
    [1, 4, 2, 3],
    [2, 4, 1, 3],
    [2, 4, 1, 3],
    [1, 2, 4, 3],
    [2, 4, 3, 1],
  ],
  // Which option is the feeling each reading scene shows (the index of the right one).
  reading: [1, 2, 1, 3, 1, 2],
  // Emotional intelligence situations, keyed 1 (least) to 4 (most effective) by the team.
  people: [
    [1, 4, 2, 2],
    [1, 2, 4, 1],
    [2, 2, 1, 4],
    [1, 2, 4, 2],
    [2, 2, 1, 4],
    [4, 1, 2, 2],
    [2, 1, 2, 4],
    [2, 3, 4, 1],
  ],
};
