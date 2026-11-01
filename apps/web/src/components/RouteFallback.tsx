import { Screen } from './Screen';
import { Busy, Skeleton, SkeletonCard } from './Skeleton';

/**
 * What shows while a screen's code downloads. It keeps the page frame (the same column and the room for the tab
 * bar) so the real screen lands in the same place and nothing jumps.
 */
export function RouteFallback({ tabs = true }: { tabs?: boolean }) {
  return (
    <Screen tabs={tabs} howTo={false}>
      <Busy label="Loading">
        <div className="pt-md">
          <Skeleton className="h-[32px] w-1/2" />
          <Skeleton className="mt-xs h-[16px] w-2/3" />
        </div>
        <div className="mt-md flex flex-col gap-sm">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      </Busy>
    </Screen>
  );
}
