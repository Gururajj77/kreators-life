import { groupStartsOpen, MODULE_GROUP_ACCENT, MODULE_GROUP_BLURB, MODULE_GROUPS, orderInGroup, RELATIONSHIP_BY_KEY, type AppPrefs, type ModuleGroup } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import gsap from 'gsap';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowUp, ChevronRight, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useKept } from '../lib/kept';
import { useAppPrefs, useModules, useSaveAppPrefs, type ModuleView } from '../lib/modules';
import { useMe, useRefreshAll } from '../lib/queries';
import { tie } from '../lib/text';
import { AppIcon } from './AppIcon';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { tick } from './fx/haptics';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { SortableList } from './SortableList';
import { Toggle } from './Toggle';
import { ToggleChevron } from './ToggleMark';

/**
 * The apps, grouped, each group one big accordion in its pillar's colour. Opening a group shows every app in it, on or off: the name
 * opens an app that is on, and the switch on the right turns it on or off right there. Used on Apps and under Profile, Features, so
 * switching happens in the same place the apps are listed.
 *
 * How a group starts is the person's own pick, saved on the account (`appPrefs`): on Apps (and in the sidebar and the phone menu)
 * Contribution and Essentials start open and the rest closed until they pick (`GROUP_OPEN_DEFAULT`); Profile, Features opens every
 * group unless they picked. Profile, Features is also where they pick: each group carries a "Starts open" switch, and "Arrange apps"
 * lets them drag the apps of a group into their own order (or use Move up and Move down), never into another group. Every list then
 * shows the placed apps first, in that order, and the rest in context order (`orderInGroup`).
 */
export function AppGroups({ groups, unread = 0, fits, open, where }: { groups: readonly ModuleGroup[]; unread?: number; fits?: Map<string, string>; /** Where the person has not picked: every group starts open (Profile, Features); otherwise `GROUP_OPEN_DEFAULT`. */ open?: boolean; /** Which list this is, so each remembers its own open groups. */ where: 'apps' | 'profile' }) {
  const me = useMe();
  const scope = `appgroups:${me.data?.user.id ?? 'anon'}:${where}`;
  const { modules } = useModules();
  const prefs = useAppPrefs();
  const savePrefs = useSaveAppPrefs();
  const editing = where === 'profile';
  const [arrange, setArrange] = useState(false);
  const [said, setSaid] = useState('');
  const save = async (next: AppPrefs, done: string) => {
    const ok = await savePrefs(next);
    setSaid(ok ? done : 'Could not save that. Try again.');
  };
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: ({ key, on }: { key: string; on: boolean }) => api.setModule(key, on),
    onMutate: ({ key }) => {
      setBusy(key);
      setFailed(null);
    },
    onSuccess: async () => {
      await refresh();
    },
    onError: (_e, { key }) => setFailed(key),
    onSettled: () => setBusy(null),
  });

  return (
    <div className="flex flex-col gap-sm">
      {editing && (
        <div className="flex items-center justify-between gap-sm">
          <p className="m-0 min-w-0 text-[14px] font-semibold text-ink-soft">{arrange ? 'Drag a handle or use the arrows. Apps stay in their group.' : 'Pick how each group starts, and the order of its apps.'}</p>
          <Button variant="outline" size="sm" aria-pressed={arrange} onClick={() => setArrange((a) => !a)} className="shrink-0">
            {arrange ? 'Done' : 'Arrange apps'}
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
        const setStart = (v: boolean) => void save({ ...prefs, open: { ...prefs.open, [g]: v } }, `${name} starts ${v ? 'open' : 'closed'}.`);
        const move = (from: number, to: number) => {
          const keys = list.map((m) => m.key);
          const [k] = keys.splice(from, 1);
          if (!k || to < 0 || to >= list.length) return;
          keys.splice(to, 0, k);
          void save({ ...prefs, order: { ...prefs.order, [g]: keys } }, `${nameIn(list, k)} is now ${to + 1} of ${keys.length} in ${name}.`);
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
            onToggle={(key, on) => toggle.mutate({ key, on })}
            controls={
              editing ? (
                <div className="mx-sm mb-sm flex items-center gap-xs">
                  <div className="min-w-0 flex-1">
                    <Toggle compact on={startsOpenThere} onChange={setStart} label={startsOpenThere ? 'Starts open on Apps and in the menu' : 'Starts closed on Apps and in the menu'} color={RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[g]].color} />
                  </div>
                  {prefs.order[g] && <IconButton icon={RotateCcw} label="Reset order" onClick={resetOrder} />}
                </div>
              ) : null
            }
            arrange={editing && arrange ? move : null}
          />
        );
      })}
    </div>
  );
}

/** An app's name in a group's list, for the line a screen reader hears after a move. */
const nameIn = (list: ModuleView[], key: string) => list.find((m) => m.key === key)?.name ?? key;

function Group({ group, list, unread, fits, busy, failed, scope, startOpen, onToggle, controls, arrange }: { group: ModuleGroup; list: ModuleView[]; unread: number; fits?: Map<string, string>; busy: string | null; failed: string | null; scope: string; startOpen: boolean; onToggle: (key: string, on: boolean) => void; /** Profile, Features: the "Starts open" switch and the group's More menu, under its header. */ controls: ReactNode; /** Arranging (Profile, Features): rows get a drag handle and Move up and Move down, and this moves one. */ arrange: ((from: number, to: number) => void) | null }) {
  // Open or closed is remembered for this tab and this person (lib/kept.ts): it stays as left while moving around the app, and resets on
  // a reload, on sign-out, or on another device.
  const [open, setOpen] = useKept<boolean>(scope, group, startOpen);
  const body = useRef<HTMLDivElement>(null);
  const id = useId();
  const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[group]];
  const on = list.filter((m) => m.on).length;

  // A group that starts open shows open at once; only a tap slides it.
  const first = useRef(true);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      if (open) {
        el.hidden = false;
        gsap.set(el, { height: 'auto', opacity: 1 });
      }
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (open) {
      el.hidden = false;
      if (reduce) gsap.set(el, { height: 'auto', opacity: 1 });
      else gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.32, ease: 'power3.out' });
    } else if (!el.hidden) {
      if (reduce) {
        gsap.set(el, { height: 0, opacity: 0 });
        el.hidden = true;
      } else gsap.to(el, { height: 0, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: () => void (el.hidden = true) });
    }
  }, [open]);

  return (
    <section aria-labelledby={`${id}-h`} data-pillar={rel.key} className="rounded-card" style={{ background: `var(--soft-${rel.key})` }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-b`}
        onClick={() => {
          tick();
          setOpen((o) => !o);
        }}
        className="toy toy-flat flex min-h-[72px] w-full items-center gap-sm rounded-card p-sm text-left"
      >
        <Avatar relationship={rel.key} size={44} decorative still mood={on > 0 ? 'happy' : 'sleepy'} />
        <span className="min-w-0 flex-1">
          <span id={`${id}-h`} className="block font-display text-[18px] font-extrabold leading-tight">
            {MODULE_GROUPS[group]}
          </span>
          <span className="block text-[13px] font-bold" style={{ color: `var(--deep-${rel.key})` }}>
            {MODULE_GROUP_BLURB[group]}
          </span>
        </span>
        <span className="shrink-0 rounded-pill bg-card-strong px-sm text-[12px] font-extrabold leading-[26px]" style={{ color: `var(--deep-${rel.key})` }}>
          {on} of {list.length} on
        </span>
        <ToggleChevron open={open} size={20} className="text-ink-soft" />
      </button>
      {controls}
      <div ref={body} id={`${id}-b`} hidden={!open} className="overflow-hidden">
        {arrange ? (
          <SortableList items={list} keyOf={(m) => m.key} onMove={arrange} className="fx-inset m-0 mx-sm mb-sm list-none p-0">
            {(m, i, handle) => <ArrangeRow m={m} index={i} count={list.length} color={rel.color} handle={handle} onMove={arrange} />}
          </SortableList>
        ) : (
          <ul className="fx-inset m-0 mx-sm mb-sm list-none p-0">
            {list.map((m) => (
              <li key={m.key}>
                <Row m={m} color={rel.color} tint={`var(--soft-${rel.key})`} unread={m.key === 'notifications' ? unread : 0} why={fits?.get(m.key)} busy={busy === m.key} failed={failed === m.key} onToggle={(v) => onToggle(m.key, v)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Row({ m, color, tint, unread, why, busy, failed, onToggle }: { m: ModuleView; color: string; tint: string; unread: number; why?: string; busy: boolean; failed: boolean; onToggle: (on: boolean) => void }) {
  const words = (
    <>
      <span className={`flex size-[44px] shrink-0 items-center justify-center rounded-pill ${m.on ? 'text-ink' : 'text-ink-mute'}`} style={{ background: m.on ? tint : 'var(--color-line)' }}>
        <AppIcon name={m.icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-xs text-[16px] font-bold leading-tight ${m.on ? '' : 'text-ink-soft'}`}>
          {m.name}
          {unread > 0 && m.on && <span className="rounded-pill bg-r1 px-xs text-[11px] font-extrabold leading-[18px] text-on-fill">{unread}</span>}
          {m.on && <Icon icon={ChevronRight} size={16} className="text-ink-mute" />}
        </span>
        <span className="mt-[2px] block text-[13px] font-semibold leading-snug text-ink-soft">{tie(m.blurb)}</span>
        {why && <span className="mt-[2px] block text-[12px] font-bold text-ink-mute">Fits you: {why}</span>}
        {failed && (
          <span role="alert" className="mt-[2px] block text-[12px] font-bold text-r1">
            Could not switch it. Try again.
          </span>
        )}
      </span>
    </>
  );
  return (
    <div className="fx-row items-center gap-sm text-ink" style={{ '--tint': color } as CSSProperties}>
      {m.on ? (
        <Link to={m.path} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-sm">
          {words}
        </Link>
      ) : (
        <span className="flex min-h-[44px] min-w-0 flex-1 items-center gap-sm">{words}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={m.on}
        aria-label={`${m.name}: ${m.on ? 'on' : 'off'}`}
        disabled={busy}
        onClick={() => {
          tick();
          onToggle(!m.on);
        }}
        className="fx-switch shrink-0"
        style={{ '--switch-on': color } as CSSProperties}
      >
        <span className="fx-switch-knob" aria-hidden="true" />
      </button>
    </div>
  );
}

/** A row while arranging: the drag handle, the app, and Move up and Move down for the keyboard and anyone who prefers buttons. */
function ArrangeRow({ m, index, count, color, handle, onMove }: { m: ModuleView; index: number; count: number; color: string; handle: ReactNode; onMove: (from: number, to: number) => void }) {
  const arrow = 'toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink disabled:opacity-40 disabled:pointer-events-none';
  return (
    <div className="fx-row items-center gap-xs text-ink" style={{ '--tint': color } as CSSProperties}>
      {handle}
      <span className={`flex size-[32px] shrink-0 items-center justify-center ${m.on ? 'text-ink' : 'text-ink-mute'}`}>
        <AppIcon name={m.icon} size={20} />
      </span>
      <span className={`min-w-0 flex-1 text-[16px] font-bold leading-tight ${m.on ? '' : 'text-ink-soft'}`}>{m.name}</span>
      <button type="button" aria-label={`Move ${m.name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)} className={arrow}>
        <Icon icon={ArrowUp} size={18} />
      </button>
      <button type="button" aria-label={`Move ${m.name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className={arrow}>
        <Icon icon={ArrowDown} size={18} />
      </button>
    </div>
  );
}
