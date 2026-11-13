import { TAG_FILTER_HINT_ID } from '../lib/taskTagFilter';

/** The hidden line a task's tag buttons are described by: what a tap does. Drawn once inside the list that filters by its tags. */
export function TagFilterHint() {
  return (
    <span id={TAG_FILTER_HINT_ID} hidden>
      Filters the list by this tag. Tap again to clear it.
    </span>
  );
}
