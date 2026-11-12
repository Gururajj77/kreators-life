import { cleanIdentity, IDENTITY_BY_KEY, IDENTITY_LABEL_MAX, identitiesOf, MAX_CUSTOM_IDENTITIES, MAX_IDENTITIES, OWN_TAG_ICON, SETUP_ROLE_GROUPS, type IconName, type IdentityOption, type MeResponse } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
import { evenGrid, evenTile } from '../lib/bento';
import { focusHeadingAfter } from '../lib/focusHeading';
import { keys, useRefreshAll } from '../lib/queries';
import { tie } from '../lib/text';
import { AppIcon } from './AppIcon';
import { errorText } from './ErrorLine';
import { IconTag } from './FactTag';
import { Fold } from './Fold';
import { Icon } from './Icon';

/**
 * Profile's "Who you are" tags as tiles to pick (the founder, 2026-11-06: "make the set my tags bento style options to select"): every known
 * tag, in the setup chat's own groups (who you are on top, as the chat's first card; then what you make, what you do for clients, the stage
 * and the rest of life, each a Fold, closed on load with the count it holds). A tap saves at once through the ordinary PATCH /me {identities},
 * written to the cached account first and put back on a refusal, like hiding an app. Tags in the person's own words stay, listed above.
 */

interface TagGroup {
  label: string;
  icon: IconName;
  keys: readonly string[];
  fold: boolean;
  note?: string;
}

const of = (kind: IdentityOption['kind']) => identitiesOf(kind).map((i) => i.key);

const GROUPS: readonly TagGroup[] = [
  ...SETUP_ROLE_GROUPS.map((g) => ({ label: g.label, icon: g.icon, keys: g.keys, fold: false })),
  { label: 'Your own content', icon: 'Clapperboard', keys: of('craft'), fold: true },
  { label: 'For clients', icon: 'Luggage', keys: of('service'), fold: true },
  { label: 'Where you are with it', icon: 'Sprout', keys: of('stage'), fold: true, note: 'One at a time: picking another replaces it.' },
  { label: 'The rest of life', icon: 'Sun', keys: of('life'), fold: true },
];

// Two columns, three from a 32rem column, four from 48rem (the section's own width), in even rows (lib/bento.ts), so no row ends in a lone tile.
const TAG_COLS = { base: 2, '@lg': 3, '@3xl': 4 } as const;

const isStage = (k: string) => IDENTITY_BY_KEY[k]?.kind === 'stage';

export function TagPicker({ identities }: { identities: readonly string[] }) {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const [said, setSaid] = useState('');
  const own = identities.filter((k) => !IDENTITY_BY_KEY[k]);
  const atMax = identities.length >= MAX_IDENTITIES;

  const save = useMutation({
    mutationKey: ['identities'],
    mutationFn: ({ next }: { next: string[]; note: string }) => api.updateMe({ identities: next }),
    onMutate: ({ next }) => {
      setSaid('Saving…');
      const was = qc.getQueryData<MeResponse>(keys.me);
      if (was) qc.setQueryData<MeResponse>(keys.me, { ...was, user: { ...was.user, identities: next } });
      return { was };
    },
    onSuccess: (r, { note }) => {
      // The Life coach tag asks the team to make you one, as the setup chat does; say so, since the tile alone does not show it.
      const coach = r.coach ? 'Asked. The team will look at it.' : '';
      setSaid(['Saved.', note, coach].filter(Boolean).join(' '));
    },
    onError: (e, _v, ctx) => {
      if (ctx?.was) qc.setQueryData<MeResponse>(keys.me, ctx.was);
      setSaid(`Not saved. ${errorText(e)}`);
    },
    // Read the account again once the last of a quick run of taps is in, so a refetch never lands between two saves.
    onSettled: async () => {
      if (qc.isMutating({ mutationKey: ['identities'] }) <= 1) await refresh();
    },
  });

  const toggle = (key: string, why = '') => {
    // Start from the cached account, so two quick taps build on each other.
    const now = qc.getQueryData<MeResponse>(keys.me)?.user.identities ?? [...identities];
    if (now.includes(key)) {
      save.mutate({ next: now.filter((k) => k !== key), note: '' });
      return;
    }
    const replaced = isStage(key) ? now.find(isStage) : undefined;
    const next = [...now.filter((k) => !isStage(key) || !isStage(k)), key];
    if (next.length > MAX_IDENTITIES) return;
    save.mutate({ next, note: [why, replaced ? `${IDENTITY_BY_KEY[key]!.label} replaced ${IDENTITY_BY_KEY[replaced]!.label}.` : ''].filter(Boolean).join(' ') });
  };

  const ownId = useId();
  // A tag in your own words: cleaned the way the server cleans it. Words that name a known tag pick that tile instead.
  const addOwn = (raw: string): boolean => {
    const k = cleanIdentity(raw);
    if (!k) {
      setSaid('Type at least two letters.');
      return false;
    }
    const now = qc.getQueryData<MeResponse>(keys.me)?.user.identities ?? [...identities];
    if (now.some((x) => x.toLowerCase() === k.toLowerCase())) {
      setSaid(`You already have ${IDENTITY_BY_KEY[k]?.label ?? k}.`);
      return true;
    }
    if (IDENTITY_BY_KEY[k]) {
      toggle(k, `That is the ${IDENTITY_BY_KEY[k]!.label} tag, so it is picked below.`);
      return true;
    }
    save.mutate({ next: [...now, k], note: '' });
    return true;
  };

  return (
    <div data-pillar="self" className="@container mt-sm flex flex-col gap-md">
      {/* The label, the tags in your own words and a field to add one, on one line that wraps (the founder, 2026-11-06). Each tag is a
          mark (an IconTag) with a small ✕ that removes it on a second tap; the field shows while there is room for another. */}
      <div className="flex flex-wrap items-center gap-xs">
        <p id={ownId} className="m-0 mr-xs text-eyebrow uppercase text-ink-soft">
          In your own words
        </p>
        {own.length > 0 && (
          <ul className="contents" aria-labelledby={ownId}>
            {own.map((k) => (
              <li key={k} className="list-none">
                <OwnTag
                  tag={k}
                  onRemove={() => {
                    toggle(k);
                    // The tag and its ✕ go, so the keyboard's place moves to the label over them (never the field, which would open a phone's keyboard).
                    focusHeadingAfter(ownId);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {own.length < MAX_CUSTOM_IDENTITIES && !atMax && <AddOwn onAdd={addOwn} />}
      </div>
      {GROUPS.map((g) => {
        const count = g.keys.filter((k) => identities.includes(k)).length;
        const grid = <Tiles group={g} identities={identities} atMax={atMax} onToggle={toggle} />;
        return g.fold ? (
          // Closed on load even with a pick, so the section stays short on a phone; the count says what it holds.
          <Fold key={g.label} title={g.label} hint={count ? `${count} picked` : undefined}>
            {g.note && <p className="m-0 mb-xs text-caption text-ink-soft">{g.note}</p>}
            {grid}
          </Fold>
        ) : (
          <div key={g.label}>{grid}</div>
        );
      })}
      <p role="status" aria-live="polite" className="m-0 text-caption text-ink-soft">
        {atMax && !save.isPending ? `That's ${MAX_IDENTITIES}, the most. Untick one to swap it. ` : ''}
        {said}
      </p>
    </div>
  );
}

function Tiles({ group, identities, atMax, onToggle }: { group: TagGroup; identities: readonly string[]; atMax: boolean; onToggle: (key: string) => void }) {
  const id = useId();
  const options = group.keys.map((k) => IDENTITY_BY_KEY[k]).filter((o): o is IdentityOption => Boolean(o));
  return (
    <div role="group" aria-labelledby={group.fold ? undefined : id} aria-label={group.fold ? group.label : undefined}>
      {!group.fold && (
        <p id={id} className="m-0 mb-xs flex items-center gap-xs text-eyebrow uppercase text-ink-soft">
          <AppIcon name={group.icon} size={14} />
          {group.label}
        </p>
      )}
      <ul className={`grid list-none gap-sm p-0 m-0 ${evenGrid(options.length, TAG_COLS)}`}>
        {options.map((o, i) => {
          const on = identities.includes(o.key);
          // A stage swaps for the one already picked, so the most never blocks it.
          const blocked = !on && atMax && !(o.kind === 'stage' && identities.some(isStage));
          return (
            <li key={o.key} className={evenTile(i, options.length, TAG_COLS)}>
              <button
                type="button"
                aria-pressed={on}
                disabled={blocked}
                onClick={() => onToggle(o.key)}
                className={`toy flex h-full min-h-[96px] w-full flex-col items-start gap-xs rounded-tile border-2 p-sm text-left disabled:opacity-50 ${on ? 'border-r5' : 'toy-soft border-line bg-card'}`}
                style={on ? { background: 'var(--soft-self)' } : undefined}
              >
                <span className="flex w-full items-start justify-between gap-xs">
                  <AppIcon name={o.icon} size={22} className={on ? 'text-ink' : 'text-ink-soft'} />
                  {/* The tick says it is picked, so the colour is never the only sign. */}
                  <span aria-hidden className={`flex size-[24px] shrink-0 items-center justify-center rounded-pill border-2 ${on ? 'border-r5 bg-r5 text-on-fill' : 'border-line'}`}>
                    {on && <Icon icon={Check} size={14} strokeWidth={3} />}
                  </span>
                </span>
                {/* The last two words kept together, so a label that wraps grows going down ("Social / media manager"), never a short last line. */}
                <span className="text-headline">{tie(o.label)}</span>
                <span className="text-footnote text-ink-soft">{o.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A tag in the person's own words, with a ✕ that removes it on a second tap: the first turns the tag into "Tap ✕ again to remove", which lapses after four seconds. */
function OwnTag({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <span className="inline-flex items-center gap-xs">
      <span aria-live="polite">
        <IconTag tone={armed ? 'bad' : 'neutral'} icon={OWN_TAG_ICON}>
          {armed ? `Tap ✕ again to remove “${tag}”` : tag}
        </IconTag>
      </span>
      <button
        type="button"
        aria-label={armed ? `Tap again to remove ${tag}` : `Remove ${tag}`}
        data-tip={armed ? 'Tap again to remove' : 'Remove'}
        onClick={() => {
          if (!armed) return setArmed(true);
          setArmed(false);
          onRemove();
        }}
        className={`toy toy-soft relative flex size-[28px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink after:absolute after:left-1/2 after:top-1/2 after:size-[44px] after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] ${armed ? 'red-armed' : ''}`}
      >
        <Icon icon={X} size={16} />
      </button>
    </span>
  );
}

/** A short field to add a tag in your own words, with its add button: Enter or the button adds it and empties the field. */
function AddOwn({ onAdd }: { onAdd: (raw: string) => boolean }) {
  const [text, setText] = useState('');
  return (
    <form
      className="flex min-w-0 items-center gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && onAdd(text)) setText('');
      }}
    >
      <label className="sr-only" htmlFor="own-tag">
        Add a tag in your own words
      </label>
      <input
        id="own-tag"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={IDENTITY_LABEL_MAX}
        placeholder="Add your own"
        autoComplete="off"
        className="min-h-[44px] w-[168px] min-w-0 rounded-pill border-2 border-line bg-paper px-sm text-subhead"
      />
      <button type="submit" disabled={!text.trim()} aria-label="Add this tag" data-tip="Add" className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card text-ink-soft hover:text-ink disabled:opacity-70">
        <Icon icon={Plus} size={18} />
      </button>
    </form>
  );
}
