import type { ChannelLine } from './community.ts';

// ---------------------------------------------------------------------------
// Kreators Run discussions (migration 0080): one per run, for that run's people only (the club's host, the members who were in
// the club by the time it ended, and anyone who logged it). Drawn and polled like a channel; the rules are an event conversation's.
// ---------------------------------------------------------------------------

/** A run's discussion stays open for writing this many days after the run ends, the same month as an event conversation. */
export const RUN_TALK_DAYS_AFTER = 30;

/** The instant a run's discussion closes for writing. */
export function runTalkClosesAt(endsAt: string): string {
  const end = new Date(endsAt).getTime();
  return Number.isNaN(end) ? endsAt : new Date(end + RUN_TALK_DAYS_AFTER * 86_400_000).toISOString();
}

/** Whether a run's discussion takes new lines: not for a cancelled run, and not once its month after the run is over. */
export function runTalkOpen(run: { status: string; endsAt: string }, now: string): boolean {
  return run.status !== 'cancelled' && now < runTalkClosesAt(run.endsAt);
}

/** One run's discussion as a row in the Discussions tab. */
export interface RunTalk {
  runId: string;
  clubId: string;
  clubName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  /** Takes new lines (see `runTalkOpen`). */
  open: boolean;
  closesAt: string;
  /** The viewer hosts the run (or is events staff): they may take any line down. */
  host: boolean;
  /** How many people are in it. */
  people: number;
  /** Lines from other people since the viewer last read it. */
  unread: number;
  lastLineAt: string | null;
}

/** A line in a run's discussion: a channel line without a rank, marked when the club's host wrote it under their name. */
export interface RunTalkLine extends Omit<ChannelLine, 'rank'> {
  host: boolean;
}
