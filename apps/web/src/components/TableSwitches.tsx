import type { CoachLink, MeResponse, MyCoachResponse } from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { keys, useAuthed, useMe } from '../lib/queries';
import { useModules } from '../lib/modules';
import { ErrorLine } from './ErrorLine';
import { Toggle } from './Toggle';

/** The query that holds the person's coaches for a table's page; the All tables list fills it ahead, so the switch is there when a table opens. */
export const TABLE_COACHES_KEY = ['my-coach', 'tables'] as const;

/** The student's coaches who can be shown a table now: the active links only (a waiting ask keeps its switches on the Profile tab). */
export function useTableCoaches(enabled = true): CoachLink[] {
  const q = useAuthed(TABLE_COACHES_KEY, () => api.myCoach(), enabled);
  return (q.data?.links ?? []).filter((l) => l.status === 'active');
}

/** AI chat is the assistant and the Companion: the switch shows while either is on for the person, and All tables too (its tool needs it). */
export function useAiChatOn(): boolean {
  const { modules } = useModules();
  const on = (key: string) => modules.some((m) => m.key === key && m.on && m.available);
  return on('tables') && (on('assistant') || on('companion'));
}

/**
 * One switch's state on a table's page: the server's value, the newest tap shown at once, the taps sent one after another in order. Every
 * answer that comes back is written where the page reads it (`settle`), in order, so the last one written is the newest that landed; the shown
 * tap clears once the newest has settled. When the newest fails, the page reads the server again (`refetch`) before it lets go, so the switch
 * never falls back to a value from before an earlier tap that did land (the review, 2026-11-14).
 */
function useSwitch(send: (on: boolean) => Promise<unknown>, settle: (answer: unknown) => Promise<void> | void, refetch: () => Promise<unknown>, onError: (e: unknown) => void) {
  const [shown, setShown] = useState<boolean | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(0);
  const flip = (on: boolean) => {
    const n = ++latest.current;
    setShown(on);
    const go = chain.current.catch(() => undefined).then(() => send(on));
    chain.current = go;
    go.then(
      async (answer) => {
        await settle(answer);
        if (latest.current !== n) return;
        onError(null);
        setShown(null);
      },
      async (e: unknown) => {
        if (latest.current !== n) return;
        onError(e);
        await refetch().catch(() => undefined);
        if (latest.current === n) setShown(null);
      },
    );
  };
  return { shown, flip };
}

function CoachSwitch({ table, link, several, onError }: { table: string; link: CoachLink; several: boolean; onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const sw = useSwitch(
    (on) => api.shareTableWithCoach(link.id, table, on),
    async (answer) => {
      // The answer is the link as kept: written into this page's copy at once, then every other copy (Profile, Coaching) reads again.
      const fresh = (answer as { link: CoachLink | null }).link;
      if (fresh) qc.setQueryData<MyCoachResponse>(TABLE_COACHES_KEY, (old) => (old ? { ...old, links: old.links.map((l) => (l.id === fresh.id ? fresh : l)) } : old));
      await qc.invalidateQueries({ queryKey: ['my-coach'], predicate: (q) => q.queryKey[1] !== TABLE_COACHES_KEY[1] });
    },
    () => qc.invalidateQueries({ queryKey: ['my-coach'] }),
    onError,
  );
  return <Toggle compact on={sw.shown ?? (link.share.tables ?? []).includes(table)} onChange={sw.flip} label={several ? `Show to my coach, ${link.coach.name}` : 'Show to my coach'} />;
}

function AiSwitch({ table, onError }: { table: string; onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const me = useMe();
  const sw = useSwitch(
    (on) => api.aiTables({ table, on }),
    (answer) => {
      const aiTables = (answer as { aiTables: string[] }).aiTables;
      qc.setQueryData<MeResponse>(keys.me, (old) => (old ? { ...old, user: { ...old.user, aiTables } } : old));
    },
    () => qc.invalidateQueries({ queryKey: keys.me }),
    onError,
  );
  return <Toggle compact on={sw.shown ?? (me.data?.user.aiTables ?? []).includes(table)} onChange={sw.flip} label="Show to AI chat" />;
}

/** The one line under the switches: who can read the table once shown, that nobody can change it, and the private-model rule where it holds. */
function captionFor(coaches: readonly CoachLink[], ai: boolean, privateOnly: boolean): string {
  const who = coaches.length === 0 ? '' : coaches.length === 1 ? coaches[0]!.coach.name : 'Your coaches';
  const readers = who && ai ? `${who} and AI chat` : who || 'AI chat';
  return `${readers} can read it once shown, never change it.${ai && privateOnly ? ' AI chat reads it only on a model that keeps nothing.' : ''}`;
}

/**
 * The switches at the top of a table's own page, in its cover's action slot: side by side left of the helper line from the tablet up, one
 * under the other under it on a phone (app.css, `.cover-share-switches`), with one short line under them. "Show to my coach" (2026-11-14, the
 * founder: "in each table give toggle to show it to coach or not, give better name to that toggle switch, put it in hero section button
 * position on left on large screens and below helper text on mobile"), one per active coach, the same yes as that table's switch under Your
 * life coach on the Profile tab (`coach_links.share_json.tables`); and right beside it "Show to AI chat" (the founder, the same day: "give one
 * toggle for ai chat access just next to coach button too and even in profile section"), the same yes as Tables AI chat can read on the
 * Profile tab (`users.ai_tables_json`). Each tap sends only this table and on or off, so it never puts back a table switched elsewhere; a
 * refusal puts the switch back and says why under the line. Nothing is drawn when there is no coach and AI chat is off.
 */
export function TableSwitches({ table, coaches, ai, privateOnly }: { table: string; coaches: readonly CoachLink[]; ai: boolean; privateOnly: boolean }) {
  const [error, setError] = useState<unknown>(null);
  if (coaches.length === 0 && !ai) return null;
  return (
    <div className="cover-share-switches flex min-w-0 flex-col">
      <div className="cover-share-row flex flex-wrap items-center gap-x-lg">
        {coaches.map((l) => (
          <CoachSwitch key={l.id} table={table} link={l} several={coaches.length > 1} onError={setError} />
        ))}
        {ai && <AiSwitch table={table} onError={setError} />}
      </div>
      {/* Held to the switches' width (w-0 with min-w-full), so the line wraps under them and never widens the slot. */}
      <p className="w-0 min-w-full m-0 text-footnote text-ink-soft">{captionFor(coaches, ai, privateOnly)}</p>
      <ErrorLine e={error} className="mt-xs w-0 min-w-full" />
    </div>
  );
}
