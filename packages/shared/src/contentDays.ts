// Content days (2026-11-12, the founder): Edit day, Shoot day and Plan and post day are starting day templates (STARTING_TEMPLATES in
// timeBlocks.ts). Each content block in them carries a ready list of steps, shown inside that block on Daily on a day that uses the template:
// a list to read, never tasks and never ticked. "Add to my tasks" turns one list into ONE task in that block, its steps as the task's
// subtasks (POST /nodes/breakdown), which pays like any task. Plain words, no promises.
// A subpath export (`@kreators/shared/contentDays`), not in the barrel, so the words never grow the shared chunk; it imports the rest of shared
// and nothing in the barrel imports it, so no cycle (like blockHints).
import type { LifeAreaKey } from './life.ts';
import type { RelationshipKey } from './core.ts';
import { byKey } from './core.ts';
import { asDay, DATE_PATTERN, fromDay } from './dates.ts';

/** The most subtasks a task holds (MAX_SUBTASKS in routes/nodes.ts); a step list never passes it. */
export const BREAKDOWN_STEPS_MAX = 20;
/** The longest a task's or a subtask's title may be (routes/nodes.ts keeps 140). */
export const BREAKDOWN_TITLE_MAX = 140;

export interface ContentSteps {
  /** The one task "Add to my tasks" makes. */
  title: string;
  /** In order. Shown as a list; they become the task's subtasks. */
  steps: readonly string[];
}

/**
 * The ready lists, keyed by the starting template's seed, then the starting block's seed. Every content block (Shoot, Edit, Plan and prep,
 * Post) in a content day has one (tested), and two everyday blocks carry one on a Shoot day and an Edit day, where the work spills into them.
 */
export const CONTENT_STEPS: Readonly<Record<string, Readonly<Record<string, ContentSteps>>>> = {
  editday: {
    edit: {
      title: 'Edit: make the cut',
      steps: [
        'Watch every clip once and note the best takes.',
        'Cut a rough version from start to end.',
        'Trim the slow parts so each moment moves.',
        'Add music, captions and sound.',
        'Check the picture and the sound on a phone.',
        'Export one full version.',
      ],
    },
    busy: {
      title: 'Edit: back up and hand it on',
      steps: [
        'Back up the project and the export in two places.',
        'Name the files so you can find them later.',
        'Send it for review, or keep it for a post day.',
        'Write down one thing to fix next time.',
      ],
    },
  },
  shootday: {
    plan: {
      title: 'Shoot: get ready',
      steps: [
        'Write the shot list.',
        'Charge every battery.',
        'Clear the memory cards.',
        'Pack the kit and check it twice.',
        'Check the place, the light and the weather.',
      ],
    },
    shoot: {
      title: 'Shoot: run the shot list',
      steps: [
        'Set up, then test the sound and the light.',
        'Film the shots on the list in order.',
        'Take a second take of each key shot.',
        'Get a few extra shots to cover the cuts.',
        'Tick off the list before you pack up.',
      ],
    },
    busy: {
      title: 'Shoot: offload and back up',
      steps: [
        'Copy every card to your computer.',
        'Back up the clips in a second place.',
        'Check the copies play before you clear a card.',
        'Put the clips in folders by scene.',
      ],
    },
    reflect: {
      title: 'Shoot: a light review',
      steps: ['Note what worked today.', 'Note what to fix next time.', 'Mark the best takes for the edit.'],
    },
  },
  postday: {
    plan: {
      title: 'Plan: the next round',
      steps: [
        'Look at how your last posts did.',
        'Pick the next few ideas.',
        'Write a hook for each one.',
        'Put them on your calendar.',
        'Pick the day you will film each one.',
      ],
    },
    post: {
      title: 'Post: share what is ready',
      steps: [
        'Pick a post you made on another day.',
        'Check the caption, the tags and the cover.',
        'Post it at your usual time.',
        'Reply to comments for a while.',
        'Note how it did, to look at next week.',
      ],
    },
  },
};

// Looked up with no prototype at either level, so a seed like "constructor" finds nothing.
const STEPS_BY_TEMPLATE: Record<string, Record<string, ContentSteps>> = byKey(Object.entries(CONTENT_STEPS).map(([t, blocks]) => [t, byKey<Record<string, ContentSteps>>(Object.entries(blocks))] as const));
/** The list for a block on a day that uses a template, by their seeds; null when that block has none there (or a seed is unknown or empty). */
export function stepsFor(templateSeed: string | null | undefined, blockSeed: string | null | undefined): ContentSteps | null {
  if (!templateSeed || !blockSeed) return null;
  return STEPS_BY_TEMPLATE[templateSeed]?.[blockSeed] ?? null;
}

// ---- Add to my tasks (POST /nodes/breakdown) ----

/** `nodes.origin` of a task made from a content day's steps: `breakdown:<template seed>:<block seed>`. One per person, day and list (the route
 * checks before it adds, so a second tap makes nothing), and Daily reads it to say "Added" with an Open link instead of offering it again. */
export const BREAKDOWN_ORIGIN_PREFIX = 'breakdown:';
export const breakdownOrigin = (templateSeed: string, blockSeed: string): string => `${BREAKDOWN_ORIGIN_PREFIX}${templateSeed}:${blockSeed}`;
/** The seeds a breakdown task came from, or null for any other origin. */
export function breakdownOfOrigin(origin: string | null | undefined): { templateSeed: string; blockSeed: string } | null {
  if (!origin || !origin.startsWith(BREAKDOWN_ORIGIN_PREFIX)) return null;
  const [templateSeed, blockSeed, ...rest] = origin.slice(BREAKDOWN_ORIGIN_PREFIX.length).split(':');
  if (!templateSeed || !blockSeed || rest.length) return null;
  return stepsFor(templateSeed, blockSeed) ? { templateSeed, blockSeed } : null;
}

/** What POST /nodes/breakdown sends, checked. */
export interface BreakdownAsk {
  date: string;
  templateSeed: string;
  blockSeed: string;
  projectId: string;
}
const realDay = (d: unknown): d is string => typeof d === 'string' && DATE_PATTERN.test(d) && fromDay(asDay(d)) === d;
/** The one reader of a breakdown request: a real day, a content day's list by its seeds, and a project id (the route checks the project is the person's own, active and in the block's pillar). */
export function parseBreakdown(body: unknown): BreakdownAsk | { problem: string } {
  const o = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return { problem: 'Send the day, the list and the project.' };
  if (!realDay(o.date)) return { problem: 'Pick a real day.' };
  const t = typeof o.templateSeed === 'string' ? o.templateSeed : '';
  const b = typeof o.blockSeed === 'string' ? o.blockSeed : '';
  if (!stepsFor(t, b)) return { problem: 'That block has no list of steps.' };
  const projectId = typeof o.projectId === 'string' ? o.projectId.trim() : '';
  if (!projectId || projectId.length > 64) return { problem: 'Pick one of your projects.' };
  return { date: o.date, templateSeed: t, blockSeed: b, projectId };
}

/** The task "Add to my tasks" makes, besides the project it goes under (which also gives its pillar). */
export interface BreakdownTask {
  title: string;
  /** The steps, in order, as its subtasks (at most BREAKDOWN_STEPS_MAX). */
  subtasks: string[];
  origin: string;
  /** The day it is for: the task opens on it, and cannot be ticked before it. */
  doDate: string;
  /** The block it sits in (the person's block with that seed: `b-<seed>-<user>`, or their row with that seed). */
  timeBlockId: string;
  /** The block's minutes that day, in 15-minute steps, 15 to 600 (the most a task's estimate holds), so Your day and Place my day count the block as used. */
  estimateMin: number;
  /** The block's area of life, so the Area filter finds it. */
  lifeArea: LifeAreaKey | null;
}
/** The one rule for a breakdown task, from the list and the block as it is that day; null when the block has no list there. */
export function breakdownTask(ask: Pick<BreakdownAsk, 'date' | 'templateSeed' | 'blockSeed'>, block: { id: string; area: LifeAreaKey | null; minutes: number }): BreakdownTask | null {
  const list = stepsFor(ask.templateSeed, ask.blockSeed);
  if (!list) return null;
  const quarter = Math.round(block.minutes / 15) * 15;
  return {
    title: list.title.slice(0, BREAKDOWN_TITLE_MAX),
    subtasks: list.steps.slice(0, BREAKDOWN_STEPS_MAX).map((s) => s.slice(0, BREAKDOWN_TITLE_MAX)),
    origin: breakdownOrigin(ask.templateSeed, ask.blockSeed),
    doDate: ask.date,
    timeBlockId: block.id,
    estimateMin: Math.min(600, Math.max(15, quarter)),
    lifeArea: block.area,
  };
}
/** The device key that remembers the project a person last picked for a pillar's breakdowns (localStorage, per person). */
export const breakdownProjectKey = (userId: string, pillar: RelationshipKey): string => `kreators.breakdownProject:${userId}:${pillar}`;
