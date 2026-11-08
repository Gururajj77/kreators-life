// A lesson's resources (the founder, 2026-11-07: "for link of the book in lessons, add ability to select multiple resources like
// youtube or book or others"). A subpath export, `@kreators/shared/lessonResources`, in a chunk of its own: nothing in the barrel
// imports it at run time (work.ts takes a type only), so it may read the rest of shared without a cycle, like blockHints, and it loads
// with the lazy cohort page and the API. The rows are stored in `lesson_resources` (migration 0113).
import { BOOK_BY_SLUG } from './books.ts';
import { videoEmbed } from './community.ts';

/** The most resources one lesson holds. */
export const MAX_LESSON_RESOURCES = 6;
export const LESSON_RESOURCE_LABEL_MAX = 60;
export const LESSON_RESOURCE_LINK_MAX = 500;

export const LESSON_RESOURCE_KINDS = ['video', 'book', 'file', 'link'] as const;
export type LessonResourceKind = (typeof LESSON_RESOURCE_KINDS)[number];

/** One way into a lesson. `ref` is the link, or for a book its key in `BOOKS`. `label` is empty when the kind's own words are used. */
export interface LessonResource {
  id: string;
  kind: LessonResourceKind;
  ref: string;
  label: string;
}

/** Each kind's name in the form and the words its way in says when no label was typed (a book says its own title). */
export const LESSON_RESOURCE_KIND_META: Readonly<Record<LessonResourceKind, { name: string; label: string }>> = {
  video: { name: 'YouTube or Vimeo video', label: 'Watch video' },
  book: { name: 'Book', label: 'The book' },
  file: { name: 'File', label: 'Download resource' },
  link: { name: 'Other link', label: 'Open resource' },
};

const LINK_PROBLEM = 'Use a link that starts with https, or a /resources/ file.';
const VIDEO_PROBLEM = 'That link is not a video we can play here. Use a YouTube or Vimeo link, or pick Other link.';
const BOOK_PROBLEM = 'Pick one of the three books.';
const KIND_PROBLEM = 'Pick what kind of resource this is.';
export const LESSON_RESOURCES_FULL = `A lesson holds up to ${MAX_LESSON_RESOURCES} resources. Remove one to add another.`;
export const LESSON_RESOURCE_REPEAT = 'That one is already on this lesson.';

/**
 * A link a person typed for a lesson: https, or one of the app's own skill files under /resources/. Empty when it is neither. The seeded
 * files are percent-encoded ("Shubham%20Editor%20Skill.md", "%2B"), so escapes and "+" are allowed in a segment; a ".." in the path or
 * hidden behind an escape (an encoded dot or slash), or an escape that does not decode, is refused.
 */
export function lessonResourceLink(v: unknown): string {
  const t = typeof v === 'string' ? v.trim().slice(0, LESSON_RESOURCE_LINK_MAX) : '';
  if (/^\/resources\/[\w.%+-]+(\/[\w.%+-]+)*$/.test(t) && !t.includes('..')) {
    let decoded = '';
    try {
      decoded = decodeURIComponent(t);
    } catch {
      return '';
    }
    if (decoded.includes('..') || decoded.slice('/resources/'.length).split('/').length !== t.slice('/resources/'.length).split('/').length) return '';
    return t;
  }
  return /^https:\/\/\S+$/i.test(t) ? t : '';
}

const FILE_EXT = /\.(md|txt|pdf|zip|docx?|pptx?|xlsx?|csv|json|png|jpe?g|webp|gif|psd|ai|fig|prproj|drp|aep|cube|mp3|wav)$/i;

/** What a bare link reads as: a video that plays in the lesson, a file (the app's own skill files and any link to a file) or a page. */
export function lessonResourceKindOf(ref: string): Exclude<LessonResourceKind, 'book'> {
  if (videoEmbed(ref)) return 'video';
  if (ref.startsWith('/')) return 'file';
  // The path alone: what follows the site, without the query or the fragment.
  return FILE_EXT.test(/^https?:\/\/[^/?#]+([^?#]*)/i.exec(ref)?.[1] ?? '') ? 'file' : 'link';
}

const cleanLabel = (v: unknown) =>
  typeof v === 'string'
    ? v
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f\s]+/g, ' ')
        .trim()
        .slice(0, LESSON_RESOURCE_LABEL_MAX)
        .trim()
    : '';

function readOne(raw: unknown): { resource: LessonResource } | { problem: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { problem: KIND_PROBLEM };
  const r = raw as Record<string, unknown>;
  const kind = LESSON_RESOURCE_KINDS.find((k) => k === r.kind);
  if (!kind) return { problem: KIND_PROBLEM };
  let ref = '';
  if (kind === 'book') {
    // BOOK_BY_SLUG has no prototype, so "constructor" finds nothing.
    ref = typeof r.ref === 'string' ? r.ref.trim() : '';
    if (!BOOK_BY_SLUG[ref]) return { problem: BOOK_PROBLEM };
  } else {
    ref = lessonResourceLink(r.ref);
    if (!ref) return { problem: LINK_PROBLEM };
    if (kind === 'video' && !videoEmbed(ref)) return { problem: VIDEO_PROBLEM };
  }
  return { resource: { id: typeof r.id === 'string' ? r.id.slice(0, 64) : '', kind, ref, label: cleanLabel(r.label) } };
}

/**
 * The one reader of what a person sends: a list of resources comes back clean, in its order, bounded, with the first thing wrong in
 * `problem` (a row that fails, a repeat of the same kind and link, or one past the most a lesson holds, is left out). A key that is not
 * one of the kinds or books finds nothing.
 */
export function parseLessonResources(raw: unknown): { resources: LessonResource[]; problem: string | null } {
  if (!Array.isArray(raw)) return { resources: [], problem: KIND_PROBLEM };
  const resources: LessonResource[] = [];
  let problem: string | null = null;
  for (const row of raw) {
    const read = readOne(row);
    if ('problem' in read) problem ??= read.problem;
    else if (resources.some((x) => x.kind === read.resource.kind && x.ref === read.resource.ref)) problem ??= LESSON_RESOURCE_REPEAT;
    else if (resources.length >= MAX_LESSON_RESOURCES) problem ??= LESSON_RESOURCES_FULL;
    else resources.push(read.resource);
  }
  return { resources, problem };
}

/**
 * Rows from the table as the screen gets them. A saved lesson never loses a way in it always had: a link saved before the https rule
 * (http, or an own file with a space in it) still reads, and a row marked as a video that does not play reads by the plain rule above.
 * Anything that is not a web link or a path of the app's own is dropped, so a stored `javascript:` never reaches a page.
 */
export function storedLessonResources(rows: readonly { id: string; kind: string; ref: string; label: string }[]): LessonResource[] {
  const out: LessonResource[] = [];
  for (const row of rows) {
    const kind = LESSON_RESOURCE_KINDS.find((k) => k === row.kind);
    if (!kind) continue;
    if (kind === 'book') {
      if (BOOK_BY_SLUG[row.ref]) out.push({ id: row.id, kind, ref: row.ref, label: cleanLabel(row.label) });
      continue;
    }
    const own = /^\/[^/\\]/.test(row.ref) && !row.ref.includes('..');
    if (!own && !/^https?:\/\/\S+$/i.test(row.ref)) continue;
    out.push({ id: row.id, kind: kind === 'video' && !videoEmbed(row.ref) ? lessonResourceKindOf(row.ref) : kind, ref: row.ref, label: cleanLabel(row.label) });
  }
  return out.slice(0, MAX_LESSON_RESOURCES);
}

/** What a way in says: the label typed, else a book's own title, else the kind's words, numbered when several of a kind have no label. */
export function lessonResourceLabel(r: LessonResource, all: readonly LessonResource[] = [r]): string {
  if (r.label) return r.label;
  if (r.kind === 'book') return BOOK_BY_SLUG[r.ref]?.title ?? LESSON_RESOURCE_KIND_META.book.label;
  const words = LESSON_RESOURCE_KIND_META[r.kind].label;
  const same = all.filter((x) => x.kind === r.kind && !x.label);
  return same.length > 1 ? `${words} ${same.findIndex((x) => x.id === r.id) + 1}` : words;
}
