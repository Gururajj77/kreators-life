import { type MeResponse, type ModuleGroup } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { AppGroups, HiddenAppsPanel, showInCache, useFits, useHiddenApps, type AppChange, type AppPicks } from '../components/AppGroups';
import { Button } from '../components/Button';
import { tick } from '../components/fx/haptics';
import { ToggleIcon } from '../components/ToggleMark';
import { CondensedTitle } from '../components/fx/CondensedTitle';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';
import { api } from '../lib/api';
import { useGroupOrder, useModules, type ModuleView } from '../lib/modules';
import { keys, useMe, useRefreshAll } from '../lib/queries';
import { dialogOpen } from '../lib/useDialogFocus';

const ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'core', 'manage'];

/*
 * The row with the count and the buttons, at rest and while selecting. At rest the buttons' 44px reaches past the line above and below (`-my-sm`), so
 * the count keeps its place under the title, and a narrow phone wraps them under it, still at the right. While selecting it sticks under the
 * condensed title bar (52px, `.fx-condensed`), and its padding is taken back by its margins, so on a laptop neither the count, Select nor the list
 * moves. Its card shows only once the title has gone above that line (`.apps-row-stuck`), which is when the list reaches it: any sooner, a card would
 * cover the title's foot or push the row down. Under a 34rem column the words take a line and the buttons fill the next. Select is last at rest and
 * Done, the same button, last while selecting, so on a laptop it stays at the far right and never moves (the founder, 2026-11-07).
 */
const ROW_REST = 'flex flex-wrap items-center justify-between gap-x-sm gap-y-md';
const ROW_SELECTING = 'sticky top-[calc(env(safe-area-inset-top)+52px+4px)] z-10 -mx-sm -my-xs flex flex-wrap items-center justify-between gap-x-sm gap-y-xs rounded-card px-sm py-xs @min-[34rem]:my-[calc((var(--spacing-xs)+var(--spacing-sm))*-1)] @min-[34rem]:flex-nowrap';
const WORDS_REST = 'flex-[1_1_220px] text-ink-soft';
const WORDS_SELECTING = 'basis-full @min-[34rem]:basis-0 @min-[34rem]:flex-1';
const BUTTONS_REST = '-my-sm ml-auto flex shrink-0 items-center gap-xs';
const BUTTONS_SELECTING = 'fill-row-all flex basis-full flex-wrap items-center gap-xs @min-[34rem]:ml-auto @min-[34rem]:shrink-0 @min-[34rem]:basis-auto @min-[34rem]:flex-nowrap';
/** How soon after Hide or Show another tap on the row counts as the same tap: the buttons close up when one goes, so a double tap would land on what slid under the finger. */
const SAME_TAP_MS = 400;

const appsWord = (n: number) => `${n} ${n === 1 ? 'app' : 'apps'}`;

/** What the taps since the last tick did, in one short sentence. */
function didLine(hidden: number, shown: number) {
  const parts: string[] = [];
  if (hidden > 0) parts.push(`${appsWord(hidden)} hidden`);
  if (shown > 0) parts.push(`${appsWord(shown)} ${shown === 1 ? 'is' : 'are'} shown again`);
  return `${parts.join(' and ')}.`;
}

const NOTHING_DONE = { hidden: 0, shown: 0 };

/**
 * Select on Apps, the one owner: whether it is on, what is ticked, the one write and what to say about it. Hide and Show are one action. It writes
 * the cached account first, so the change shows at once, puts it back on a refusal and reads again after, and only one runs at a time. The apps
 * it wrote lose their ticks when it starts, since they have changed sides by then, and get them back on a refusal; the others keep theirs, so
 * "Show 1" is still there after "Hide 2".
 */
function useAppPicks(listed: readonly ModuleView[], onActed: () => void) {
  const refresh = useRefreshAll();
  const qc = useQueryClient();
  const [selecting, setSelecting] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const [opened, setOpened] = useState(0);
  const [did, setDid] = useState(NOTHING_DONE);
  const [refused, setRefused] = useState(false);
  const write = useMutation({
    mutationFn: (changes: AppChange[]) => api.setModules(changes),
    onMutate: (changes) => ({ was: showInCache(qc, changes) }),
    onError: (_e, changes, ctx) => {
      if (ctx?.was) qc.setQueryData<MeResponse>(keys.me, ctx.was);
      setTicked((now) => new Set([...now, ...changes.map((c) => c.key)]));
      setDid(NOTHING_DONE);
      setRefused(true);
      // Done may have been tapped while it ran. Back to selecting, so the ticks and the line are there to see.
      setSelecting(true);
    },
    onSettled: () => refresh(),
  });
  const actedAt = useRef(-SAME_TAP_MS);
  const sameTap = () => performance.now() - actedAt.current < SAME_TAP_MS;
  const picked = listed.filter((m) => ticked.has(m.key));
  const allTicked = listed.length > 0 && picked.length === listed.length;
  const anotherTick = () => {
    tick();
    setDid(NOTHING_DONE);
    setRefused(false);
  };
  const toggle = (key: string) => {
    anotherTick();
    setTicked((now) => {
      const next = new Set(now);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };
  const selectAll = () => {
    if (sameTap()) return;
    anotherTick();
    if (allTicked) return setTicked(new Set());
    setTicked(new Set(listed.map((m) => m.key)));
    setOpened((n) => n + 1);
  };
  const act = (on: boolean) => {
    const changes = picked.filter((m) => m.on !== on).map((m) => ({ key: m.key, on }));
    if (write.isPending || changes.length === 0 || sameTap()) return;
    actedAt.current = performance.now();
    tick();
    write.mutate(changes);
    setTicked((now) => {
      const next = new Set(now);
      for (const { key } of changes) next.delete(key);
      return next;
    });
    setRefused(false);
    setDid((d) => (on ? { ...d, shown: d.shown + changes.length } : { ...d, hidden: d.hidden + changes.length }));
    onActed();
  };
  const turn = (on: boolean) => {
    setSelecting(on);
    setTicked(new Set());
    setOpened(0);
    setDid(NOTHING_DONE);
    setRefused(false);
  };
  const picks: AppPicks | null = selecting ? { ticked, toggle, opened } : null;
  const line = refused ? 'Could not save that. Nothing changed.' : did.hidden + did.shown > 0 ? didLine(did.hidden, did.shown) : picked.length > 0 ? `${picked.length} selected.` : 'Tick the apps to hide or show.';
  return { selecting, turn, sameTap, picks, line, refused, allTicked, selectAll, act, writing: write.isPending, toHide: picked.filter((m) => m.on).length, toShow: picked.filter((m) => !m.on).length };
}

/**
 * Every app, grouped, each group one big accordion in its pillar's colour (components/AppGroups.tsx); Contribution and
 * Essentials start open unless the person picked otherwise under Profile, Features, and the apps follow their own order there. Opening a group
 * lists the apps shown, each with Hide, and the hidden ones in a Hidden apps fold at its end, each with Show. The same groups sit under
 * Profile, Features. Beside the count, a round button opens every hidden app in one inline panel (the founder, 2026-11-06), so one is
 * brought back without opening its group; it shows only while an app is hidden (or the panel is open). Select, after it at the far right (the
 * founder, 2026-11-07), turns the eyes into checkboxes, and its actions come in beside it on the same row: Hide 2, Show 1 and Select all, for every app on
 * the page, in every group. The round button and its panel step aside meanwhile, so one app is never listed twice, and come back as they were. Rank
 * and rewards are part of the game, not apps.
 */
export function Apps() {
  const me = useMe();
  const { modules } = useModules();
  const groupOrder = useGroupOrder(ORDER);
  const on = modules.filter((m) => !m.locked && m.available && m.on).length;
  const hidden = useHiddenApps(groupOrder).reduce((n, x) => n + x.list.length, 0);
  const listed = modules.filter((m) => !m.locked && m.available && groupOrder.includes(m.group));
  const [showHidden, setShowHidden] = useState(false);
  const selectButton = useRef<HTMLButtonElement>(null);
  // Focus stays where the person is on the page: the button is at its top, and they may be far down the list.
  const focusSelect = () => selectButton.current?.focus({ preventScroll: true });
  const sel = useAppPicks(listed, focusSelect);
  const { selecting } = sel;
  const row = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  const roundShown = hidden > 0 || showHidden;
  const fits = useFits();
  const panel = useId();
  const label = showHidden ? 'Close hidden apps' : `Hidden apps (${hidden})`;

  // Escape leaves too, unless a dialog is open: then it belongs to the dialog.
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || dialogOpen()) return;
      focusSelect();
      sel.turn(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `turn` only calls setters.
  }, [selecting]);

  // The card comes once the title has gone above the row's sticking line: by then the row is stuck at every width and the list has reached it.
  useEffect(() => {
    const el = row.current;
    const above = title.current;
    if (!selecting || !el || !above) return;
    if (typeof IntersectionObserver === 'undefined') return setStuck(true);
    const line = parseFloat(getComputedStyle(el).top) || 0;
    const io = new IntersectionObserver(([e]) => setStuck(e?.isIntersecting === false), { rootMargin: `${-line}px 0px 0px 0px` });
    io.observe(above);
    return () => {
      io.disconnect();
      setStuck(false);
    };
  }, [selecting]);

  return (
    <Screen>
      <header ref={title} className="pt-lg">
        <CondensedTitle title="Apps">
          <h1 className="type-large">Apps</h1>
        </CondensedTitle>
      </header>

      {/* One wrapper from the count to the end of the list, so the row can stick for as long as the list lasts. */}
      <div className={`span-all mt-xs ${selecting ? '@container' : ''}`} data-apps-selecting={selecting ? '' : undefined}>
        <div ref={row} className={selecting ? `${ROW_SELECTING} ${stuck ? 'apps-row-stuck' : ''}` : ROW_REST}>
          <p role="status" aria-live="polite" className={`m-0 min-w-0 text-subhead ${selecting ? `${WORDS_SELECTING} ${sel.refused ? 'text-r1' : 'text-ink-soft'}` : WORDS_REST}`}>
            {selecting ? sel.line : `${on} shown${hidden > 0 ? `, ${hidden} hidden` : ''}. Open a group to see its apps, or hide one.`}
          </p>
          <div className={selecting ? BUTTONS_SELECTING : BUTTONS_REST}>
            {!selecting && roundShown && (
              <button type="button" className="mf-round toy shrink-0" data-at="br" data-tip={label} aria-label={label} aria-expanded={showHidden} aria-controls={panel} onClick={() => setShowHidden((v) => !v)}>
                <ToggleIcon open={showHidden} icon={EyeOff} />
              </button>
            )}
            {/* All outline: they are equal choices, and this page has no solid button. Select stays last, so the others come and go at its left. */}
            {selecting && sel.toHide > 0 && (
              <Button variant="outline" size="sm" disabled={sel.writing} aria-label={`Hide ${appsWord(sel.toHide)}`} onClick={() => sel.act(false)}>
                Hide {sel.toHide}
              </Button>
            )}
            {selecting && sel.toShow > 0 && (
              <Button variant="outline" size="sm" disabled={sel.writing} aria-label={`Show ${appsWord(sel.toShow)}`} onClick={() => sel.act(true)}>
                Show {sel.toShow}
              </Button>
            )}
            {selecting && (
              <Button variant="outline" size="sm" aria-pressed={sel.allTicked} onClick={sel.selectAll}>
                {/* The longer word keeps the button's width on one line (invisible, and in no name), so nothing beside it shifts when it turns into Clear. */}
                <span className="grid justify-items-center after:invisible after:col-start-1 after:row-start-1 @min-[34rem]:after:content-['Select_all']">
                  <span className="col-start-1 row-start-1">{sel.allTicked ? 'Clear' : 'Select all'}</span>
                </span>
              </Button>
            )}
            <Button
              ref={selectButton}
              variant="outline"
              size="sm"
              aria-pressed={selecting}
              onClick={() => {
                if (sel.sameTap()) return;
                sel.turn(!selecting);
              }}
            >
              <span className="grid justify-items-center after:invisible after:col-start-1 after:row-start-1 @min-[34rem]:after:content-['Select']">
                <span className="col-start-1 row-start-1">{selecting ? 'Done' : 'Select'}</span>
              </span>
            </Button>
          </div>
        </div>
        {showHidden && !selecting && (
          <div className="mt-sm">
            <HiddenAppsPanel groups={groupOrder} id={panel} fits={fits} />
          </div>
        )}
        {/* A gap past the buttons' reach, so they never crowd the search. */}
        <div className={showHidden && !selecting ? 'mt-md' : 'mt-lg'}>
          <SearchBox placeholder="Search tasks, journals, library, products, people" />
        </div>
        <div className="mt-lg">
          <AppGroups groups={groupOrder} unread={me.data?.unread ?? 0} where="apps" pick={sel.picks} />
        </div>
      </div>

      <p className="span-all mt-lg m-0 rounded-tile bg-paper p-sm text-center text-subhead text-ink-soft">Rank and rewards are part of the game and live under Profile.</p>
    </Screen>
  );
}
