import {
  groupStartsOpen,
  MODULE_GROUP_ACCENT,
  MODULE_GROUP_BLURB,
  MODULE_GROUPS,
  orderInGroup,
  RELATIONSHIP_BY_KEY,
  type AppPrefs,
  type ModuleGroup,
} from "@kreators/shared";
import { Phrases } from "./Phrases";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { MeResponse } from "@kreators/shared";
import gsap from "gsap";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, ArrowUpRight, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { useKept } from "../lib/kept";
import {
  useAppPrefs,
  useHiddenApps,
  useModules,
  useSaveAppPrefs,
  type ModuleView,
} from "../lib/modules";
// The two hooks live in lib/modules.ts so Home can count hidden apps without downloading this file; re-exported for the screens.
export { useFits, useHiddenApps } from "../lib/modules";
import { keys, useMe, useRefreshAll } from "../lib/queries";
import { tie } from "../lib/text";
import { AnimatedIcon } from "./AnimatedIcon";
import { AppIcon } from "./AppIcon";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { CheckMark } from "./CheckRow";
import { Fold } from "./Fold";
import { tick } from "./fx/haptics";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { SortableList } from "./SortableList";
import { Toggle } from "./Toggle";
import { ToggleChevron } from "./ToggleMark";

/**
 * The apps, grouped, each group one big accordion in its pillar's colour. Opening a group shows the apps that are shown, each name
 * opening the app and a Hide button at its right; the hidden ones sit at the end in a short, full-width "Hidden apps" fold, each with
 * Show (the founder, 2026-11-06: hide and show, never an on and off switch, and a hidden app leaves the list). The fold starts closed
 * on Apps and open under Profile, Features. Hiding is the same per-person module switch as before (`api.setModule`).
 *
 * Select on Apps (2026-11-07): `pick` turns every eye into a checkbox and the whole row into its label. Apps.tsx owns what is ticked and draws
 * Hide, Show and Select all beside Select, on its count's line; the groups only show the ticks and hold themselves open.
 *
 * How a group starts is the person's own pick, saved on the account (`appPrefs`): on Apps (and in the sidebar and the phone menu)
 * Contribution and Essentials start open and the rest closed until they pick (`GROUP_OPEN_DEFAULT`); Profile, Features opens every
 * group unless they picked. Profile, Features is also where they pick: each group carries a "Starts open" switch, and "Arrange apps"
 * lets them drag the apps of a group into their own order (or use Move up and Move down), never into another group. Every list then
 * shows the placed apps first, in that order, and the rest in the default order (`orderInGroup`).
 */
export function AppGroups({
  groups,
  unread = 0,
  fits,
  open,
  where,
  pick = null,
}: {
  groups: readonly ModuleGroup[];
  unread?: number;
  fits?: Map<string, string>;
  /** Where the person has not picked: every group starts open (Profile, Features); otherwise `GROUP_OPEN_DEFAULT`. */ open?: boolean;
  /** Which list this is, so each remembers its own open groups. */ where:
    "apps" | "profile";
  /** Select on Apps is on: what is ticked, from the page that owns it. */ pick?: AppPicks | null;
}) {
  const me = useMe();
  const scope = `appgroups:${me.data?.user.id ?? "anon"}:${where}`;
  const { modules } = useModules();
  const prefs = useAppPrefs();
  const savePrefs = useSaveAppPrefs();
  const editing = where === "profile";
  const [arrange, setArrange] = useState(false);
  const [said, setSaid] = useState("");
  const save = async (next: AppPrefs, done: string) => {
    const ok = await savePrefs(next);
    setSaid(ok ? done : "Could not save that. Try again.");
  };
  const { busy, failed, toggle } = useAppSwitch(setSaid);

  return (
    <div className="flex flex-col gap-sm">
      {editing && (
        // The line at the left and Arrange apps at its bottom right, in line with it (the founder, 2026-11-06); a narrow phone wraps it under, still at the right.
        // Centred on the button's line, not on its foot: at the foot the 44px button left an empty band above the line (2026-11-07).
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <p className="m-0 min-w-0 flex-[1_1_220px] text-subhead text-ink-soft">
            {arrange
              ? "Drag a handle or use the arrows. Apps stay in their group."
              : "Pick how each group starts, and the order of its apps."}
          </p>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={arrange}
            onClick={() => setArrange((a) => !a)}
            className="ml-auto shrink-0"
          >
            {arrange ? "Done" : "Arrange apps"}
          </Button>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
      {groups.map((g) => {
        const list = orderInGroup(
          modules.filter((m) => m.group === g && m.available && !m.locked),
          prefs.order[g],
        );
        if (list.length === 0) return null;
        const startOpen = groupStartsOpen(prefs, g, open);
        // The switch says how the group starts on Apps, in the sidebar and in the phone menu (the defaults there, not Profile's own).
        const startsOpenThere = groupStartsOpen(prefs, g);
        const name = MODULE_GROUPS[g];
        const setStart = (v: boolean) =>
          void save(
            { ...prefs, open: { ...prefs.open, [g]: v } },
            `${name} starts ${v ? "open" : "closed"}.`,
          );
        const move = (from: number, to: number) => {
          const keys = list.map((m) => m.key);
          const [k] = keys.splice(from, 1);
          if (!k || to < 0 || to >= list.length) return;
          keys.splice(to, 0, k);
          void save(
            { ...prefs, order: { ...prefs.order, [g]: keys } },
            `${nameIn(list, k)} is now ${to + 1} of ${keys.length} in ${name}.`,
          );
        };
        const resetOrder = () => {
          const order = { ...prefs.order };
          delete order[g];
          void save({ ...prefs, order }, `${name} is back in its own order.`);
        };
        return (
          <Group
            key={g}
            group={g}
            list={list}
            unread={unread}
            fits={fits}
            busy={busy}
            failed={failed}
            scope={scope}
            startOpen={startOpen}
            hiddenOpen={editing}
            onToggle={(key, on) =>
              toggle.mutate({ key, on, name: nameIn(list, key) })
            }
            controls={
              editing ? (
                <div className="mx-sm mb-sm flex items-center gap-xs">
                  <div className="min-w-0 flex-1">
                    <Toggle
                      compact
                      on={startsOpenThere}
                      onChange={setStart}
                      label={
                        startsOpenThere
                          ? "Starts open on Apps and in the menu"
                          : "Starts closed on Apps and in the menu"
                      }
                      color={RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[g]].color}
                    />
                  </div>
                  {prefs.order[g] && (
                    <IconButton
                      icon={RotateCcw}
                      label="Reset order"
                      onClick={resetOrder}
                    />
                  )}
                </div>
              ) : null
            }
            arrange={editing && arrange ? move : null}
            pick={pick}
          />
        );
      })}
    </div>
  );
}

/** One app's new state, as PATCH /me/modules takes it. */
export type AppChange = { key: string; on: boolean };

/** Writes a change into the cached account, so it shows at once, and gives back what was there to put back on a refusal. */
export function showInCache(qc: QueryClient, changes: readonly AppChange[]) {
  const was = qc.getQueryData<MeResponse>(keys.me);
  if (was) {
    const access = was.access && { ...was.access };
    const modules = { ...was.user.modules };
    for (const { key, on } of changes) {
      const now = access?.[key];
      if (access && now) access[key] = { ...now, on };
      modules[key] = on;
    }
    qc.setQueryData<MeResponse>(keys.me, {
      ...was,
      access,
      user: { ...was.user, modules },
    });
  }
  return was;
}

/** What Select on Apps hands each group: what is ticked, the way to change it, and how many times Select all was pressed (each press opens every group again). */
export type AppPicks = {
  ticked: ReadonlySet<string>;
  toggle: (key: string) => void;
  opened: number;
};

/**
 * Hide or show one app for this person (the per-person module switch), with which one is busy or failed and a line for screen readers.
 * The change shows at once (the founder, 2026-11-06: the "N of M shown" count and the Hidden apps fold must not wait for the reload): the
 * cached account is updated before the call, put back if the server refuses, and read again after.
 */
function useAppSwitch(say: (line: string) => void) {
  const refresh = useRefreshAll();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: ({ key, on }: { key: string; on: boolean; name: string }) =>
      api.setModule(key, on),
    onMutate: ({ key, on }) => {
      setBusy(key);
      setFailed(null);
      return { was: showInCache(qc, [{ key, on }]) };
    },
    onSuccess: async (_r, { on, name }) => {
      say(
        on
          ? `${name} is shown again.`
          : `${name} is hidden. Find it under Hidden apps.`,
      );
      await refresh();
    },
    onError: (_e, { key }, ctx) => {
      if (ctx?.was) qc.setQueryData<MeResponse>(keys.me, ctx.was);
      setFailed(key);
    },
    onSettled: () => setBusy(null),
  });
  return { busy, failed, toggle };
}

/**
 * Every hidden app in one place (the hidden-apps button on Apps and on Home's Go to, the founder 2026-11-06): under each group's name in its colour, the
 * apps with Show, so one can be brought back without opening its group. An inline panel under its button, never a sheet.
 */
export function HiddenAppsPanel({
  groups,
  id,
  fits,
  empty = "No hidden apps. Hide one from its group below.",
}: {
  groups: readonly ModuleGroup[];
  id: string;
  /** Apps that fit the person (`useFits`): listed first in each group, with "Fits you" and why. */ fits?: Map<
    string,
    string
  >;
  /** The line when nothing is hidden. */ empty?: string;
}) {
  // Inside each group the apps that fit come first; the rest keep the group's own order (a stable sort).
  const sets = useHiddenApps(groups).map((x) =>
    fits && fits.size > 0
      ? {
          ...x,
          list: [...x.list].sort(
            (a, b) => Number(fits.has(b.key)) - Number(fits.has(a.key)),
          ),
        }
      : x,
  );
  const [said, setSaid] = useState("");
  const { busy, failed, toggle } = useAppSwitch(setSaid);
  return (
    <section
      id={id}
      aria-label="Hidden apps"
      className="rounded-card bg-card p-sm shadow-toy-soft"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
      {sets.length === 0 ? (
        <p className="m-0 text-subhead text-ink-soft">{empty}</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {sets.map(({ group, list }) => {
            const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[group]];
            return (
              <div key={group} data-pillar={rel.key}>
                <p
                  className="m-0 mb-xs text-eyebrow uppercase"
                  style={{ color: `var(--deep-${rel.key})` }}
                >
                  {MODULE_GROUPS[group]}
                </p>
                <ul className="fx-inset m-0 list-none p-0">
                  {list.map((m) => (
                    <li key={m.key}>
                      <Row
                        m={m}
                        color={rel.color}
                        tint={`var(--soft-${rel.key})`}
                        unread={0}
                        why={fits?.get(m.key)}
                        busy={busy === m.key}
                        failed={failed === m.key}
                        onToggle={(v) =>
                          toggle.mutate({ key: m.key, on: v, name: m.name })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** An app's name in a group's list, for the line a screen reader hears after a move. */
const nameIn = (list: ModuleView[], key: string) =>
  list.find((m) => m.key === key)?.name ?? key;

function Group({
  group,
  list,
  unread,
  fits,
  busy,
  failed,
  scope,
  startOpen,
  hiddenOpen,
  onToggle,
  controls,
  arrange,
  pick = null,
}: {
  group: ModuleGroup;
  list: ModuleView[];
  unread: number;
  fits?: Map<string, string>;
  busy: string | null;
  failed: string | null;
  scope: string;
  startOpen: boolean;
  /** The Hidden apps fold starts open (Profile, Features) or closed (Apps). */ hiddenOpen: boolean;
  onToggle: (key: string, on: boolean) => void;
  /** Profile, Features: the "Starts open" switch and the group's More menu, under its header. */ controls: ReactNode;
  /** Arranging (Profile, Features): rows get a drag handle and Move up and Move down, and this moves one. */ arrange:
    ((from: number, to: number) => void) | null;
  /** Selecting (Apps): what is ticked, and the way to change it. */ pick?: AppPicks | null;
}) {
  // Open or closed is remembered for this tab and this person (lib/kept.ts): it stays as left while moving around the app, and resets on
  // a reload, on sign-out, or on another device.
  const [kept, setKept] = useKept<boolean>(scope, group, startOpen);
  const body = useRef<HTMLDivElement>(null);
  const id = useId();
  const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[group]];
  const shown = list.filter((m) => m.on);
  const hidden = list.filter((m) => !m.on);
  const on = shown.length;
  // While selecting, the group and its Hidden apps fold are held here, so a hidden app can be ticked. A tap still opens or closes them, and Select
  // all opens them all again. Nothing is written to what they remember (Fold never writes its own state while a screen holds it), so each goes
  // back to how it was once selecting ends.
  const selecting = pick !== null;
  const opened = pick?.opened ?? 0;
  const [held, setHeld] = useState<boolean | null>(null);
  const [heldFold, setHeldFold] = useState(true);
  useEffect(() => {
    setHeld(selecting && opened > 0 ? true : null);
    setHeldFold(true);
  }, [selecting, opened]);
  const open = selecting ? (held ?? kept) : kept;
  const row = (m: ModuleView) => (
    <li key={m.key}>
      <Row
        m={m}
        color={rel.color}
        tint={`var(--soft-${rel.key})`}
        unread={m.key === "notifications" ? unread : 0}
        why={fits?.get(m.key)}
        busy={busy === m.key}
        failed={failed === m.key}
        onToggle={(v) => onToggle(m.key, v)}
        pick={
          pick
            ? {
                checked: pick.ticked.has(m.key),
                onChange: () => pick.toggle(m.key),
                deep: `var(--deep-${rel.key})`,
                text: rel.text,
              }
            : undefined
        }
      />
    </li>
  );

  // A group that starts open shows open at once; only a tap slides it.
  const first = useRef(true);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    // A slide still running would finish after this one and hide the group again.
    gsap.killTweensOf(el);
    if (first.current) {
      first.current = false;
      if (open) {
        el.hidden = false;
        gsap.set(el, { height: "auto", opacity: 1 });
      }
      return;
    }
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (open) {
      el.hidden = false;
      if (reduce) gsap.set(el, { height: "auto", opacity: 1 });
      else
        gsap.fromTo(
          el,
          { height: 0, opacity: 0 },
          { height: "auto", opacity: 1, duration: 0.32, ease: "power3.out" },
        );
    } else if (!el.hidden) {
      if (reduce) {
        gsap.set(el, { height: 0, opacity: 0 });
        el.hidden = true;
      } else
        gsap.to(el, {
          height: 0,
          opacity: 0,
          duration: 0.22,
          ease: "power2.in",
          onComplete: () => void (el.hidden = true),
        });
    }
  }, [open]);

  return (
    <section
      aria-labelledby={`${id}-h`}
      data-pillar={rel.key}
      className="rounded-card"
      style={{ background: `var(--soft-${rel.key})` }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-b`}
        onClick={() => {
          tick();
          if (selecting) setHeld(!open);
          else setKept((o) => !o);
        }}
        className="toy toy-flat flex min-h-[72px] w-full items-center gap-sm rounded-card p-sm text-left"
      >
        <Avatar
          relationship={rel.key}
          size={44}
          decorative
          still
          mood={on > 0 ? "happy" : "sleepy"}
        />
        <span className="min-w-0 flex-1">
          <span id={`${id}-h`} className="block text-title3 type-figure">
            {MODULE_GROUPS[group]}
          </span>
          <span
            className="block text-footnote"
            style={{ color: `var(--deep-${rel.key})` }}
          >
            {MODULE_GROUP_BLURB[group]}
          </span>
        </span>
        <span
          className="shrink-0 rounded-pill bg-card-strong px-sm text-caption font-medium leading-[26px]"
          style={{ color: `var(--deep-${rel.key})` }}
        >
          {on} of {list.length} shown
        </span>
        <ToggleChevron open={open} size={20} className="text-ink-soft" />
      </button>
      {controls}
      {/* One small gap under the group's toggle, so its hover tint never touches the list (the founder, 2026-11-06). */}
      <div ref={body} id={`${id}-b`} hidden={!open} className="overflow-hidden">
        <div className="pt-xs">
          {arrange ? (
            // .fx-inset sets its own margins to 0, so the room either side and under the list comes from a wrapper.
            <div className="mx-sm mb-sm">
              <SortableList
                items={list}
                keyOf={(m) => m.key}
                onMove={arrange}
                className="fx-inset m-0 list-none p-0"
              >
                {(m, i, handle) => (
                  <ArrangeRow
                    m={m}
                    index={i}
                    count={list.length}
                    color={rel.color}
                    handle={handle}
                    onMove={arrange}
                  />
                )}
              </SortableList>
            </div>
          ) : (
            <>
              {shown.length > 0 ? (
                // .fx-inset sets its own margins to 0, so the room either side and under the list comes from a wrapper (the founder,
                // 2026-11-06: space on the left and right inside a group).
                <div className="mx-sm mb-sm">
                  <ul className="fx-inset m-0 list-none p-0">
                    {shown.map(row)}
                  </ul>
                </div>
              ) : (
                <p className="m-0 mx-sm mb-sm text-subhead text-ink-soft">
                  Every app here is hidden.
                </p>
              )}
              {/* The hidden apps at the end of the shown ones: one short fold across the full width, each inside with its eye to show it. */}
              {hidden.length > 0 && (
                // The fold lines up with the list above (its wrapper's room), and its rows sit one small gap under its button.
                <Fold
                  className="mx-sm mb-sm"
                  title="Hidden apps"
                  hint={String(hidden.length)}
                  defaultOpen={hiddenOpen}
                  open={selecting ? heldFold : undefined}
                  onOpenChange={selecting ? setHeldFold : undefined}
                >
                  <div className="mt-xs">
                    <ul className="fx-inset m-0 list-none p-0">
                      {hidden.map(row)}
                    </ul>
                  </div>
                </Fold>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({
  m,
  color,
  tint,
  unread,
  why,
  busy,
  failed,
  onToggle,
  pick,
}: {
  m: ModuleView;
  color: string;
  tint: string;
  unread: number;
  why?: string;
  busy: boolean;
  failed: boolean;
  onToggle: (on: boolean) => void;
  /** While selecting (Apps): the eye is a checkbox in the same spot, and the whole row ticks it instead of opening the app. */ pick?: {
    checked: boolean;
    onChange: () => void;
    deep: string;
    text: string;
  };
}) {
  // The eye plays its turn first, then the row moves; a failed change (the row stays) brings the eye back.
  const [flipping, setFlipping] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (failed) setFlipping(false);
  }, [failed]);
  const words = (
    <>
      <span
        className={`flex size-[44px] shrink-0 items-center justify-center rounded-pill ${m.on ? "text-ink" : "text-ink-mute"}`}
        style={{ background: m.on ? tint : "var(--color-line)" }}
      >
        <AppIcon name={m.icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`flex items-center gap-xs text-headline ${m.on ? "" : "text-ink-soft"}`}
        >
          {m.name}
          {unread > 0 && m.on && (
            <span className="rounded-pill bg-r1 px-xs text-caption2 font-semibold leading-[18px] text-on-fill">
              {unread}
            </span>
          )}
          {/* While selecting the row ticks and opens nothing, so it wears no link's arrow. */}
          {m.on && !pick && (
            <Icon icon={ArrowUpRight} size={16} className="text-ink-mute" />
          )}
        </span>
        {/* Each part after a colon is kept whole, so a narrow row breaks there on purpose ("Brand campaigns:" over the rest; Text is a
            rectangle). */}
        <span className="mt-[2px] block text-footnote text-ink-soft">
          <Phrases text={tie(m.blurb)} />
        </span>
        {why && (
          <span className="mt-[2px] block text-caption text-ink-mute">
            Fits you: {why}
          </span>
        )}
        {failed && (
          <span role="alert" className="mt-[2px] block text-caption text-r1">
            Could not {m.on ? "hide" : "show"} it. Try again.
          </span>
        )}
      </span>
    </>
  );
  if (pick)
    return (
      <label
        className="fx-row check-row relative cursor-pointer select-none items-center gap-sm text-ink"
        style={{ "--tint": color, "--check-color": color } as CSSProperties}
      >
        {/* The real checkbox covers the whole row, unseen, so the keyboard's next stop scrolls the whole row clear of what sticks above it. */}
        <input
          type="checkbox"
          className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
          aria-label={m.name}
          checked={pick.checked}
          onChange={pick.onChange}
        />
        <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-sm">
          {words}
        </span>
        <span className="flex size-[44px] shrink-0 items-center justify-center">
          <CheckMark
            checked={pick.checked}
            color={color}
            deep={pick.deep}
            text={pick.text}
          />
        </span>
      </label>
    );
  return (
    <div
      className="fx-row items-center gap-sm text-ink"
      style={{ "--tint": color } as CSSProperties}
    >
      {m.on ? (
        <Link
          to={m.path}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-sm"
        >
          {words}
        </Link>
      ) : (
        <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-sm">
          {words}
        </span>
      )}
      {/* Hide and Show are a quiet eye (the founder, 2026-11-06: not a dominant button): the round 44px icon button the arrange arrows
          already use, the useanimations eye turning to its slashed state (or back) before the row moves to its new list. Its word is the
          round buttons' tooltip (`.app-eye`, 2026-11-07), on a mouse hover or keyboard focus. */}
      <button
        type="button"
        aria-label={`${m.on ? "Hide" : "Show"} ${m.name}`}
        data-tip={m.on ? "Hide" : "Show"}
        disabled={busy || flipping}
        onClick={() => {
          tick();
          const go = () => onToggle(!m.on);
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return go();
          setFlipping(true);
          timer.current = window.setTimeout(go, 360);
        }}
        className="app-eye toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink disabled:pointer-events-none"
      >
        <AnimatedIcon
          name="visibility"
          size={20}
          active={m.on ? flipping : !flipping}
        />
      </button>
    </div>
  );
}

/** A row while arranging: the drag handle, the app, and Move up and Move down for the keyboard and anyone who prefers buttons. */
function ArrangeRow({
  m,
  index,
  count,
  color,
  handle,
  onMove,
}: {
  m: ModuleView;
  index: number;
  count: number;
  color: string;
  handle: ReactNode;
  onMove: (from: number, to: number) => void;
}) {
  const arrow =
    "toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div
      className="fx-row items-center gap-xs text-ink"
      style={{ "--tint": color } as CSSProperties}
    >
      {handle}
      <span
        className={`flex size-[32px] shrink-0 items-center justify-center ${m.on ? "text-ink" : "text-ink-mute"}`}
      >
        <AppIcon name={m.icon} size={20} />
      </span>
      <span
        className={`min-w-0 flex-1 text-headline ${m.on ? "" : "text-ink-soft"}`}
      >
        {m.name}
      </span>
      <button
        type="button"
        aria-label={`Move ${m.name} up`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className={arrow}
      >
        <Icon icon={ArrowUp} size={18} />
      </button>
      <button
        type="button"
        aria-label={`Move ${m.name} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        className={arrow}
      >
        <Icon icon={ArrowDown} size={18} />
      </button>
    </div>
  );
}
