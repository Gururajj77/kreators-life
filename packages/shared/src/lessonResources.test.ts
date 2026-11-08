import { describe, expect, it } from 'vitest';
import { BOOKS } from './books';
import {
  LESSON_RESOURCE_KINDS,
  LESSON_RESOURCE_KIND_META,
  LESSON_RESOURCE_LABEL_MAX,
  LESSON_RESOURCE_REPEAT,
  LESSON_RESOURCES_FULL,
  MAX_LESSON_RESOURCES,
  lessonResourceKindOf,
  lessonResourceLabel,
  lessonResourceLink,
  parseLessonResources,
  storedLessonResources,
  type LessonResource,
} from './lessonResources';

const one = (row: unknown) => parseLessonResources([row]);
const YT = 'https://youtu.be/abc123XYZ';

describe('a lesson resource link', () => {
  it('takes https and the app’s own files, and nothing else', () => {
    expect(lessonResourceLink(' https://example.com/a ')).toBe('https://example.com/a');
    expect(lessonResourceLink('/resources/Shubham%20Editor%20Skill.md')).toBe('/resources/Shubham%20Editor%20Skill.md');
    expect(lessonResourceLink('/resources/Talking-Head%20Screencast%20-%20Chaptered%20Master%20%2B%20Reels.md')).not.toBe('');
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'data:text/html,hi', 'example.com', '//example.com/a', '/other/a.md', '/resources/../secret', '/resources/%2e%2e/secret', '/resources/a%2Fb', '/resources/%zz', 'https://a b', '', null, 3, {}]) {
      expect(lessonResourceLink(bad), String(bad)).toBe('');
    }
  });

  it('reads a bare link by the rule a lesson has always read it', () => {
    expect(lessonResourceKindOf(YT)).toBe('video');
    expect(lessonResourceKindOf('https://www.youtube.com/watch?v=abc123XYZ')).toBe('video');
    expect(lessonResourceKindOf('https://vimeo.com/123456')).toBe('video');
    expect(lessonResourceKindOf('https://cdn.example.com/a.mp4')).toBe('video');
    expect(lessonResourceKindOf('/resources/a.md')).toBe('file');
    expect(lessonResourceKindOf('https://example.com/guide.PDF?dl=1')).toBe('file');
    expect(lessonResourceKindOf('https://example.com/page')).toBe('link');
    expect(lessonResourceKindOf('https://x.pdf')).toBe('link');
    expect(lessonResourceKindOf('https://example.com/?f=a.pdf')).toBe('link');
    expect(lessonResourceKindOf('https://www.youtube.com/@someone')).toBe('link');
  });
});

describe('parseLessonResources', () => {
  it('reads each kind with what that kind needs', () => {
    expect(one({ kind: 'video', ref: YT }).resources[0]).toEqual({ id: '', kind: 'video', ref: YT, label: '' });
    expect(one({ kind: 'book', ref: BOOKS[0]!.slug }).resources[0]?.ref).toBe(BOOKS[0]!.slug);
    expect(one({ kind: 'file', ref: '/resources/a.md' }).resources[0]?.kind).toBe('file');
    expect(one({ kind: 'link', ref: 'https://example.com' }).resources[0]?.kind).toBe('link');
    // Any link may be picked as another link, a video's too, when it should open in its own tab.
    expect(one({ kind: 'link', ref: YT }).problem).toBeNull();
  });

  it('refuses what a kind cannot take, in plain words', () => {
    expect(one({ kind: 'video', ref: 'https://example.com/page' }).problem).toMatch(/not a video/);
    expect(one({ kind: 'video', ref: '/resources/a.md' }).problem).toMatch(/not a video/);
    expect(one({ kind: 'file', ref: 'http://example.com/a.pdf' }).problem).toMatch(/https/);
    expect(one({ kind: 'link', ref: 'javascript:alert(1)' }).problem).toMatch(/https/);
    expect(one({ kind: 'book', ref: 'no-such-book' }).problem).toMatch(/three books/);
    expect(one({ kind: 'podcast', ref: YT }).problem).toMatch(/kind/);
    for (const raw of [null, 'x', 3, []]) expect(one(raw).resources, String(raw)).toEqual([]);
    expect(parseLessonResources('nope').resources).toEqual([]);
    expect(parseLessonResources(null).problem).not.toBeNull();
  });

  it('finds nothing for a key off an object’s prototype', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(one({ kind: 'book', ref: key }).resources, key).toEqual([]);
      expect(one({ kind: key, ref: YT }).resources, key).toEqual([]);
    }
  });

  it('keeps a label as one short plain line', () => {
    expect(one({ kind: 'link', ref: 'https://example.com', label: '  The\n\tworkbook  ' }).resources[0]?.label).toBe('The workbook');
    expect(one({ kind: 'link', ref: 'https://example.com', label: 'x'.repeat(200) }).resources[0]?.label).toHaveLength(LESSON_RESOURCE_LABEL_MAX);
    expect(one({ kind: 'link', ref: 'https://example.com', label: 7 }).resources[0]?.label).toBe('');
  });

  it('holds a lesson to its most, keeps the order and leaves out a repeat', () => {
    const many = Array.from({ length: MAX_LESSON_RESOURCES + 2 }, (_, i) => ({ kind: 'link', ref: `https://example.com/${i}` }));
    const read = parseLessonResources(many);
    expect(read.resources.map((r) => r.ref)).toEqual(many.slice(0, MAX_LESSON_RESOURCES).map((r) => r.ref));
    expect(read.problem).toBe(LESSON_RESOURCES_FULL);
    const twice = parseLessonResources([{ kind: 'video', ref: YT }, { kind: 'video', ref: YT }, { kind: 'link', ref: YT }]);
    expect(twice.resources.map((r) => r.kind)).toEqual(['video', 'link']);
    expect(twice.problem).toBe(LESSON_RESOURCE_REPEAT);
  });

  it('every book can be picked', () => {
    for (const b of BOOKS) expect(one({ kind: 'book', ref: b.slug }).problem, b.slug).toBeNull();
  });
});

describe('what a stored row reads as', () => {
  const row = (kind: string, ref: string, label = '') => ({ id: `id-${kind}-${ref}`, kind, ref, label });

  it('keeps a link saved before the https rule, and drops what could never be a link', () => {
    expect(storedLessonResources([row('link', 'http://example.com/page')])[0]?.ref).toBe('http://example.com/page');
    expect(storedLessonResources([row('file', '/resources/a b.md')])[0]?.kind).toBe('file');
    for (const bad of ['javascript:alert(1)', 'notes.md', '//example.com/a', '/resources/../secret']) expect(storedLessonResources([row('link', bad)]), bad).toEqual([]);
    expect(storedLessonResources([row('podcast', YT)])).toEqual([]);
    expect(storedLessonResources([row('book', 'constructor')])).toEqual([]);
  });

  it('turns a row marked a video that does not play into what it reads as', () => {
    expect(storedLessonResources([row('video', 'https://www.youtube.com/@someone')])[0]?.kind).toBe('link');
    expect(storedLessonResources([row('video', 'https://vimeo.com/terms.pdf')])[0]?.kind).toBe('file');
    expect(storedLessonResources([row('video', YT)])[0]?.kind).toBe('video');
  });

  it('keeps the rows’ order and id', () => {
    const rows = [row('link', 'https://example.com/2'), row('video', YT), row('book', BOOKS[1]!.slug)];
    expect(storedLessonResources(rows).map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });
});

describe('what a way in says', () => {
  const r = (id: string, kind: LessonResource['kind'], ref: string, label = ''): LessonResource => ({ id, kind, ref, label });

  it('one resource says what a lesson has always said', () => {
    expect(lessonResourceLabel(r('a', 'video', YT))).toBe('Watch video');
    expect(lessonResourceLabel(r('a', 'file', '/resources/a.md'))).toBe('Download resource');
    expect(lessonResourceLabel(r('a', 'link', 'https://example.com'))).toBe('Open resource');
  });

  it('a book says its own title, and a label always wins', () => {
    expect(lessonResourceLabel(r('a', 'book', BOOKS[2]!.slug))).toBe(BOOKS[2]!.title);
    expect(lessonResourceLabel(r('a', 'video', YT, 'The full talk'))).toBe('The full talk');
  });

  it('several of a kind with no label are numbered, so no two ways in read alike', () => {
    const all = [r('a', 'video', YT), r('b', 'video', 'https://vimeo.com/123456'), r('c', 'video', 'https://vimeo.com/654321', 'Part three'), r('d', 'link', 'https://example.com')];
    expect(all.map((x) => lessonResourceLabel(x, all))).toEqual(['Watch video 1', 'Watch video 2', 'Part three', 'Open resource']);
    expect(new Set(all.map((x) => lessonResourceLabel(x, all))).size).toBe(all.length);
  });

  it('every kind has its name and words', () => {
    for (const k of LESSON_RESOURCE_KINDS) {
      expect(LESSON_RESOURCE_KIND_META[k].name, k).not.toBe('');
      expect(LESSON_RESOURCE_KIND_META[k].label, k).not.toBe('');
    }
  });
});
