import { MAX_COHORT_TALK_LINE, type CohortTalkLine, type CohortTalkVisibility } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { dateTime } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { useTapTwice } from '../lib/useTapTwice';
import { Button } from './Button';
import { AskSheet, type Ask } from './Channels';
import { ErrorLine } from './ErrorLine';
import { IconTag } from './FactTag';
import { Inert } from './Inert';
import { Pager, usePage } from './Pager';
import { Section } from './Section';
import { SkeletonList } from './Skeleton';
import { ToggleChevron } from './ToggleMark';
import { Segmented } from './fx/Segmented';

/** How far a reply sits in from its post: one step a level, three levels at most, on the spacing scale (8, 12, 16 on a phone; 12, 16, 32 from md). */
const INDENT = ['', 'ml-xs md:ml-sm', 'ml-sm md:ml-md', 'ml-md md:ml-lg'] as const;
const ACTION = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-caption text-ink-soft underline underline-offset-4 hover:text-ink';
const VISIBILITY_OPTIONS: readonly { value: CohortTalkVisibility; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

/**
 * A School cohort's discussion: threads for everyone in the cohort, replies three levels deep, and past that a reply beside the line it
 * answers. Each member picks how they show here, Private (their handle in stars, the default) or Public (their @handle, which others
 * can open). The server does the masking, so this only draws what it is sent. Every line renders through `Inert`.
 */
export function CohortDiscussion({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const pg = usePage('ct');
  const q = useAuthed(['cohort-talk', cohortId, pg.query], () => api.cohortTalk(cohortId, pg.query));
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  const postId = useId();
  const refresh = () => qc.invalidateQueries({ queryKey: ['cohort-talk', cohortId] });

  const post = useMutation({
    mutationFn: (text: string) => api.cohortTalkSay(cohortId, text),
    onSuccess: () => {
      setDraft('');
      pg.reset();
      void refresh();
    },
  });
  const reply = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId: string }) => api.cohortTalkSay(cohortId, text, parentId),
    onSuccess: () => {
      setReplyDraft('');
      setReplyTo(null);
      void refresh();
    },
  });
  const unsay = useMutation({ mutationFn: (lineId: string) => api.cohortTalkUnsay(cohortId, lineId), onSuccess: () => void refresh() });
  const report = useMutation({ mutationFn: (lineId: string) => api.cohortTalkReport(cohortId, lineId) });
  const block = useMutation({ mutationFn: (lineId: string) => api.cohortTalkBlockAuthor(cohortId, lineId), onSuccess: () => void refresh() });
  const visibility = useMutation({ mutationFn: (v: CohortTalkVisibility) => api.cohortTalkVisibility(cohortId, v), onSuccess: () => void refresh() });

  const data = q.data;
  const threads = groupThreads(data?.lines ?? []);
  const me = data?.me;
  const shownVisibility = visibility.isPending && visibility.variables ? visibility.variables : (me?.visibility ?? 'private');

  return (
    <Section id="discussion" title="Discussion" lede="Ask, answer and share with everyone in this cohort.">
      {q.isError && <ErrorLine e={q.error} />}
      {q.isPending && <SkeletonList count={3} lines={2} label="Loading the discussion" />}
      {data && me && (
        <>
          <div className="flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-card p-sm">
            <p className="m-0 min-w-0 flex-1 text-subhead text-ink-soft">
              <span className="inline-block">
                You appear as <span className="font-semibold text-ink">{me.label}</span>.
              </span>{' '}
              <span className="inline-block">{shownVisibility === 'public' ? 'Others can open your page.' : 'Your handle stays hidden.'}</span>
            </p>
            <Segmented label="How you appear in this discussion" value={shownVisibility} onChange={(v) => visibility.mutate(v)} options={VISIBILITY_OPTIONS} />
          </div>
          <ErrorLine e={visibility.isError ? visibility.error : null} className="mt-xs" />

          <form
            className="mt-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) post.mutate(draft);
            }}
          >
            <label htmlFor={postId} className="text-subhead font-semibold">
              Start a thread
            </label>
            <textarea id={postId} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_COHORT_TALK_LINE} rows={3} placeholder="Ask a question or share what you learned" className={FIELD} />
            <div className="mt-xs flex justify-end">
              <Button type="submit" variant="outline" disabled={!draft.trim() || post.isPending}>
                {post.isPending ? 'Posting' : 'Post'}
              </Button>
            </div>
            <ErrorLine e={post.isError ? post.error : null} className="mt-xs" />
          </form>

          {threads.length === 0 ? (
            <p className="mt-md m-0 text-subhead text-ink-soft">No threads yet. Start the first one.</p>
          ) : (
            <ul className="mt-md m-0 flex list-none flex-col gap-sm p-0">
              {threads.map((t) => (
                <li key={t[0]!.threadId} className="rounded-tile bg-card p-sm shadow-toy-soft">
                  <ol className="m-0 flex list-none flex-col gap-xs p-0" aria-label="Thread">
                    {t.map((l) => (
                      <li key={l.id} className={`${INDENT[Math.min(l.depth, 3)]} ${l.depth > 0 ? 'border-l-2 border-line pl-sm' : ''}`}>
                        <LineView
                          line={l}
                          moderator={data.moderator}
                          replying={replyTo === l.id}
                          onReply={() => {
                            setReplyTo(replyTo === l.id ? null : l.id);
                            setReplyDraft('');
                          }}
                          onDelete={() =>
                            l.mine
                              ? unsay.mutate(l.id)
                              : setAsk({ title: 'Take this line down?', body: 'Its words go for everyone, and the writer is told. Replies under it stay.', action: 'Yes, take it down', run: () => unsay.mutate(l.id) })
                          }
                          onReport={() => setAsk({ title: 'Tell the team about this line?', body: 'The team reads it and decides what to do. The writer is not told who sent it.', action: 'Yes, tell the team', run: () => report.mutate(l.id) })}
                          onBlock={() => setAsk({ title: `Block ${l.author.label}?`, body: "You will not see each other's lines, and any friendship ends. You can undo it under Bond.", action: 'Yes, block', run: () => block.mutate(l.id) })}
                        />
                        {replyTo === l.id && (
                          <form
                            className="mt-xs"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (replyDraft.trim()) reply.mutate({ text: replyDraft, parentId: l.id });
                            }}
                          >
                            <label className="sr-only" htmlFor={`reply-${l.id}`}>
                              Reply to {l.mine ? 'yourself' : l.author.label}
                            </label>
                            <textarea id={`reply-${l.id}`} autoFocus value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} maxLength={MAX_COHORT_TALK_LINE} rows={2} placeholder={`Reply to ${l.mine ? 'yourself' : l.author.label}`} className={FIELD} />
                            <div className="mt-xs flex flex-wrap justify-end gap-xs">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                                Cancel
                              </Button>
                              <Button type="submit" variant="outline" size="sm" disabled={!replyDraft.trim() || reply.isPending}>
                                {reply.isPending ? 'Sending' : 'Send reply'}
                              </Button>
                            </div>
                            <ErrorLine e={reply.isError ? reply.error : null} className="mt-xs" />
                          </form>
                        )}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
          <ErrorLine e={unsay.isError ? unsay.error : report.isError ? report.error : block.isError ? block.error : null} className="mt-xs" />
          {report.isSuccess && (
            <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
              Thanks. The team has it.
            </p>
          )}
          <Pager page={data.page} prefix="ct" label="threads" />
        </>
      )}
      <AskSheet ask={ask} onClose={() => setAsk(null)} />
    </Section>
  );
}

/** The lines come in reading order; each thread starts at a post. */
function groupThreads(lines: CohortTalkLine[]): CohortTalkLine[][] {
  const out: CohortTalkLine[][] = [];
  for (const l of lines) {
    const last = out.at(-1);
    if (last && last[0]!.threadId === l.threadId) last.push(l);
    else out.push([l]);
  }
  return out;
}

function Author({ line, moderator }: { line: CohortTalkLine; moderator: boolean }) {
  const a = line.author;
  if (line.mine) return <span className="font-semibold">You</span>;
  return (
    <span className="min-w-0">
      {a.public && a.handle ? (
        <Link to={`/u/${a.handle}`} className="inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline">
          {a.label}
        </Link>
      ) : (
        <span className="font-semibold">{a.label}</span>
      )}
      {/* A moderator sees who a private member is, so a report can be acted on. */}
      {moderator && !a.public && a.handle && <span className="ml-xs text-caption text-ink-soft">(@{a.handle})</span>}
    </span>
  );
}

function LineView({
  line,
  moderator,
  replying,
  onReply,
  onDelete,
  onReport,
  onBlock,
}: {
  line: CohortTalkLine;
  moderator: boolean;
  replying: boolean;
  onReply: () => void;
  onDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const [more, setMore] = useState(false);
  const ask = useTapTwice();
  const empty = line.takenDown || line.hidden;
  if (empty)
    return (
      <p className="m-0 py-xs text-subhead text-ink-soft">
        {line.hidden ? 'A line from someone you blocked, or who blocked you.' : 'This line was taken down.'}
      </p>
    );
  return (
    <div className="text-subhead">
      <div className="flex flex-wrap items-center justify-between gap-xs">
        <span className="flex min-w-0 flex-wrap items-center gap-xs">
          <Author line={line} moderator={moderator} />
          {line.author.manager && <IconTag tone="info" icon="GraduationCap">Manager</IconTag>}
        </span>
        <span className="whitespace-nowrap text-caption text-ink-soft">{dateTime(line.createdAt)}</span>
      </div>
      {line.replyTo && <p className="m-0 text-caption text-ink-soft">Replying to {line.replyTo.label}</p>}
      <p className="mt-xs m-0 whitespace-pre-wrap break-words">
        <Inert text={line.body} />
      </p>
      <span className="mt-xs flex flex-wrap items-center gap-sm">
        <button type="button" onClick={onReply} aria-expanded={replying} className={ACTION}>
          {replying ? 'Close reply' : 'Reply'}
        </button>
        {/* Your own line: a second tap deletes it (the founder, 2026-11-13). Someone else's still asks in a sheet. */}
        {line.mine ? (
          <button type="button" onClick={() => ask.tap(true, onDelete)} className={ask.isArmed(true) ? `${ACTION} red-armed rounded-pill px-sm no-underline` : ACTION}>
            <span aria-hidden={ask.isArmed(true) || undefined}>{ask.isArmed(true) ? 'Tap again to delete' : 'Delete'}</span>
<span className="sr-only" aria-live="polite">{ask.isArmed(true) ? 'Tap again to delete' : ''}</span>
          </button>
        ) : (
          moderator && (
            <button type="button" onClick={onDelete} className={ACTION}>
              Take down
            </button>
          )
        )}
        {!line.mine && (
          <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className={`${ACTION} gap-xs`}>
            More
            <ToggleChevron open={more} size={14} />
          </button>
        )}
        {more && !line.mine && (
          <>
            <button type="button" onClick={onReport} className={ACTION}>
              Report
            </button>
            {/* A private member is never blocked from here: a block is listed by name under Bond, which would unmask them. */}
            {line.author.userId && (
              <button type="button" onClick={onBlock} className={ACTION}>
                Block
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}
