import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TimeBlocksResponse } from '@kreators/shared';
import { api } from './api';
import { useSession } from './store';

/** The query key of one week of time blocks; every time-blocks write invalidates `['timeBlocks']`. */
export const timeBlocksKey = (monday: string) => ['timeBlocks', monday] as const;

/**
 * One week of the person's time blocks (`GET /time-blocks?week=`, a Monday): the seven days with their templates, every block and
 * template, the weekly pattern and the date changes. Shared by the Time blocks page and the task form, so one read serves both;
 * paging to another week keeps the last one on screen until the next arrives.
 */
export function useTimeBlocks(monday: string, enabled = true) {
  const token = useSession((s) => s.token);
  return useQuery<TimeBlocksResponse>({ queryKey: timeBlocksKey(monday), queryFn: () => api.timeBlocks(monday), enabled: Boolean(token) && enabled, placeholderData: keepPreviousData });
}
