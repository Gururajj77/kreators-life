import { useQueryClient } from '@tanstack/react-query';

/**
 * Every query a time-blocks write can change: the page, Daily (its order, its blocks, the week plan, the month calendar under ['today']),
 * the old kind of day, pillar pages, and Your kinds of day and the Reviews tile, which read each day's template (2026-11-06). Its own
 * small file so Daily's kind-of-day picker, in the first download, can use it without pulling in the Time blocks page's parts.
 */
export function useTimeBlocksRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['timeBlocks', 'today', 'weekPlan', 'dayType', 'nodes', 'insights', 'reviews'] as const) void qc.invalidateQueries({ queryKey: [k] });
  };
}
