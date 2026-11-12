import { DAILY_SECTIONS, DAILY_VIEW_DEFAULT, dailyHiddenLine, dailySectionOfAnchor, parseDailyView, type DailySectionKey, type DailyView, type MeResponse } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type Ref, type RefObject } from 'react';
import { useLocation } from 'react-router';
import { api } from '../lib/api';
import { errorText } from '../lib/errors';
import { focusHeadingAfter } from '../lib/focusHeading';
import { keys, useMe } from '../lib/queries';
import { Button } from './Button';
import { Toggle } from './Toggle';
import { ToggleIcon } from './ToggleMark';

/**
 * Daily's View (2026-11-12, the founder): the sections of Daily a person hid, kept on their account (`PATCH /me {dailyView}`, read with
 * `parseDailyView`). A tap changes the cached account first and puts it back on a refusal, as Profile's tags do. A link or an inbox note that
 * lands on a hidden section's heading (`#done-heading`, `#ntd-heading`, …) shows that section for the visit, without changing what is kept.
 */
export function useDailyView() {
  const qc = useQueryClient();
  const me = useMe();
  const view = me.data?.user.dailyView ?? DAILY_VIEW_DEFAULT;
  const { hash } = useLocation();
  const [visit, setVisit] = useState<ReadonlySet<DailySectionKey>>(() => {
    const k = dailySectionOfAnchor(hash);
    return new Set(k ? [k] : []);
  });
  useEffect(() => {
    const k = dailySectionOfAnchor(hash);
    if (k) setVisit((prev) => (prev.has(k) ? prev : new Set([...prev, k])));
  }, [hash]);
  const [said, setSaid] = useState('');

  const save = useMutation({
    mutationKey: ['dailyView'],
    mutationFn: (next: DailyView) => api.updateMe({ dailyView: next }),
    onMutate: (next) => {
      setSaid('Saving…');
      const was = qc.getQueryData<MeResponse>(keys.me);
      if (was) qc.setQueryData<MeResponse>(keys.me, { ...was, user: { ...was.user, dailyView: next } });
      return { was };
    },
    onSuccess: () => setSaid('Saved.'),
    onError: (e, _v, ctx) => {
      if (ctx?.was) qc.setQueryData<MeResponse>(keys.me, ctx.was);
      setSaid(`Not saved. ${errorText(e)}`);
    },
    // Read the account again once the last of a quick run of taps is in, so a refetch never lands between two saves.
    onSettled: async () => {
      if (qc.isMutating({ mutationKey: ['dailyView'] }) <= 1) await qc.invalidateQueries({ queryKey: keys.me });
    },
  });

  // Start from the cached account, so two quick taps build on each other.
  const current = (): DailyView => qc.getQueryData<MeResponse>(keys.me)?.user.dailyView ?? view;
  const setShown = (key: DailySectionKey, show: boolean) => {
    const now = current().hidden.filter((k) => k !== key);
    // Hiding one that a link showed for this visit hides it now too.
    if (!show) setVisit((prev) => (prev.has(key) ? new Set([...prev].filter((k) => k !== key)) : prev));
    save.mutate(parseDailyView({ hidden: show ? now : [...now, key] }));
  };
  const showAll = () => save.mutate({ hidden: [] });
  const shows = (key: DailySectionKey) => !view.hidden.includes(key) || visit.has(key);
  return { view, hiddenCount: view.hidden.length, shows, setShown, showAll, said, saving: save.isPending };
}

export type DailyViewState = ReturnType<typeof useDailyView>;

/**
 * The View button at the end of the Tasks heading's controls, in the outline look of Time blocks and Plan my week: an eye that turns into a
 * cross while its panel is open under the heading, its name beside it on hover or keyboard focus.
 */
export function DailyViewButton({ ref, open, onToggle, controls, hidden }: { ref?: Ref<HTMLButtonElement>; open: boolean; onToggle: () => void; controls: string; hidden: number }) {
  const label = open ? 'Close the view' : hidden > 0 ? `View: ${dailyHiddenLine(hidden)}` : 'View';
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      data-tip={label}
      className="app-eye toy toy-ink btn-outline inline-flex size-[44px] flex-none! items-center justify-center rounded-pill border border-ink/30 bg-card-strong p-0 text-ink"
    >
      <ToggleIcon open={open} icon={Eye} size={18} />
    </button>
  );
}

/**
 * The quiet line while any section is hidden and the panel is closed: "2 sections hidden. Show all". Show all takes the line away with it,
 * so the keyboard's place moves to the Tasks heading (`focusHeadingAfter`), never to the page's top.
 */
export function DailyHiddenLine({ state }: { state: DailyViewState }) {
  if (state.hiddenCount === 0) return null;
  return (
    <p className="mt-xs m-0 text-caption text-ink-soft">
      {dailyHiddenLine(state.hiddenCount)}.{' '}
      <button
        type="button"
        onClick={() => {
          state.showAll();
          focusHeadingAfter('tasks-heading');
        }}
        disabled={state.saving}
        className="relative underline underline-offset-4 hover:text-ink after:absolute after:left-1/2 after:top-1/2 after:h-[44px] after:w-[max(100%,44px)] after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
      >
        Show all
      </button>
    </p>
  );
}

/**
 * The View panel, in place under the Tasks heading (never a sheet): a switch for each section Daily can hide, on while it shows. Escape
 * folds it and hands the keyboard back to the View button.
 */
export function DailyViewPanel({ id, state, onClose, button }: { id: string; state: DailyViewState; onClose: () => void; button: RefObject<HTMLButtonElement | null> }) {
  // Show all goes once nothing is hidden, so the keyboard's place moves to the status line that says what it did.
  const status = useRef<HTMLParagraphElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    onClose();
    button.current?.focus();
  };
  return (
    <div id={id} role="group" aria-label="Sections Daily shows" onKeyDown={onKey} className="@container mt-sm rounded-tile bg-card p-md shadow-toy-soft">
      <p className="m-0 text-subhead text-ink-soft">Pick what Daily shows. It stays this way on every device.</p>
      <ul className="mt-xs grid list-none gap-x-md p-0 m-0 @min-[34rem]:grid-cols-2">
        {DAILY_SECTIONS.map((s) => (
          <li key={s.key}>
            <Toggle compact label={s.name} on={!state.view.hidden.includes(s.key)} onChange={(on) => state.setShown(s.key, on)} />
          </li>
        ))}
      </ul>
      {(state.said || state.hiddenCount > 0) && (
        <div className="mt-xs flex flex-wrap-reverse items-center justify-between gap-sm">
          <p ref={status} tabIndex={-1} role="status" className="m-0 min-w-0 flex-1 basis-[60%] text-subhead text-ink-soft outline-none">
            {[state.hiddenCount > 0 ? `${dailyHiddenLine(state.hiddenCount)}.` : '', state.said].filter(Boolean).join(' ')}
          </p>
          {state.hiddenCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                state.showAll();
                requestAnimationFrame(() => status.current?.focus());
              }}
              disabled={state.saving}
            >
              Show all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
