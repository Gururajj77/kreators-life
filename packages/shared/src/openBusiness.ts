// ---------------------------------------------------------------------------
// Close the unfinished (2026-11-07, the founder's ask): the words of a task's kind and its three endings, read by the task form (TaskPlan)
// and the boxes of Daily's Unfinished business view (TaskGroups). A leaf (it imports only types) and a subpath export,
// `@kreators/shared/openBusiness`, in its own chunk, so its text never sits in the shared chunk or the first download. The keys and the one
// reader (`OPEN_KINDS`, `parseOpenKind`) are in tasks.ts, in the barrel.
// Our own words of the idea: unfinished things tend to stay on the mind. No claim beyond that (the research on it is mixed).
// ---------------------------------------------------------------------------
import type { OpenKind } from './tasks.ts';

/** Each kind: its name, what it holds, and the one question to ask of it. */
export const OPEN_KIND_META: Record<OpenKind, { name: string; holds: string; question: string }> = {
  unfinished: { name: 'Unfinished', holds: 'Things you started and did not finish.', question: 'Do you still want it enough to give it more time?' },
  unresolved: { name: 'Unresolved', holds: 'Things with other people: a talk to have, a fight, a guilt.', question: 'Have the talk, or decide to let it go.' },
  undecided: { name: 'Undecided', holds: 'Choices you keep thinking about.', question: 'Get what you need to decide, or decide that you cannot yet.' },
};

/** The three ways to end one, each the ordinary action under it. */
export const OPEN_ENDINGS = {
  doIt: { name: 'Do it', line: 'Put it on today. A small one can be done now; tick it when it is.' },
  time: { name: 'Give it a time and date', line: 'Pick a day and a time. It goes on Daily that day with a reminder. Keep the time.' },
  letGo: { name: 'Let it go', line: 'Stop chasing it. It leaves your lists and reminders. You can bring it back.' },
} as const;
