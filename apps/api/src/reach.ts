import { detectPlatform, type ResearchItem } from '@kreators/shared';
import type { Env } from './env';

/**
 * Research for the content strategist. The real engine is Agent Reach, a read-only command-line tool
 * (github.com/Panniantong/agent-reach) that reaches YouTube, the web, X, Instagram and Reddit. It runs on
 * a machine, not inside the Worker, so the Worker talks to a small bridge (scripts/reach/server.mjs)
 * at REACH_URL with REACH_KEY. Without the bridge, the Worker still reads plain pages itself and uses
 * the YouTube Data API when a key is set; everything else answers with a plain "needs Agent Reach".
 */
export interface ReachResult {
  ok: boolean;
  backend: string;
  items: ResearchItem[];
  error: string;
}

export const reachConnected = (env: Env): boolean => Boolean(env.REACH_URL);

const fail = (error: string, backend = 'none'): ReachResult => ({ ok: false, backend, items: [], error });

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Agent Reach's one-line JSON, trimmed to what a piece needs. */
function fromReach(raw: unknown): ResearchItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => (it && typeof it === 'object' ? (it as Record<string, unknown>) : {}))
    .map((it) => {
      const r = (it.raw && typeof it.raw === 'object' ? it.raw : {}) as Record<string, unknown>;
      const stats: Record<string, number> = {};
      for (const k of ['views', 'view_count', 'likes', 'like_count', 'comments', 'comment_count', 'followers', 'favorite_count', 'retweet_count', 'score']) {
        const v = r[k] ?? it[k];
        if (typeof v === 'number') stats[k.replace('_count', '')] = v;
      }
      return {
        title: clip(String(it.title ?? r.title ?? ''), 200),
        url: String(it.url ?? r.url ?? r.webpage_url ?? ''),
        author: clip(String(it.author ?? r.uploader ?? r.channel ?? r.username ?? ''), 80),
        publishedAt: String(it.published_at ?? r.upload_date ?? ''),
        text: clip(String(it.text ?? r.description ?? r.text ?? ''), 6000),
        stats,
      };
    })
    .filter((it) => it.title || it.text || it.url);
}

/** Ask the bridge to run `agent-reach <channel> <action> ...`. */
async function bridge(env: Env, channel: string, action: string, params: Record<string, string | number>): Promise<ReachResult> {
  if (!env.REACH_URL) return fail('Agent Reach is not connected. Set REACH_URL to the bridge.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120_000);
  try {
    const res = await fetch(`${env.REACH_URL.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.REACH_KEY ? { authorization: `Bearer ${env.REACH_KEY}` } : {}) },
      body: JSON.stringify({ channel, action, params }),
      signal: ctl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; backend?: string | null; items?: unknown; error?: { code?: string; message?: string; hint?: string } | null };
    if (!res.ok || !json.ok) {
      const e = json.error ?? {};
      return fail(`${e.code ?? `bridge ${res.status}`}${e.message ? `: ${e.message}` : ''}${e.hint ? ` (${e.hint})` : ''}`, 'agent-reach');
    }
    return { ok: true, backend: json.backend ? `agent-reach/${json.backend}` : 'agent-reach', items: fromReach(json.items), error: '' };
  } catch (e) {
    return fail(e instanceof Error && e.name === 'AbortError' ? 'Agent Reach took too long.' : 'Agent Reach could not be reached.', 'agent-reach');
  } finally {
    clearTimeout(timer);
  }
}

/** A page as text, without the bridge: scripts and styles out, tags out, whitespace folded. */
export function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim() ?? /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim() ?? '';
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  return { title, description, text: clip(body, 20_000) };
}

async function readPage(url: string): Promise<ReachResult> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; kreators.app content strategist)', accept: 'text/html,*/*' }, redirect: 'follow' });
    if (!res.ok) return fail(`The page answered ${res.status}.`, 'page');
    const type = res.headers.get('content-type') ?? '';
    const raw = await res.text();
    const page = type.includes('html') ? htmlToText(raw) : { title: '', description: '', text: clip(raw, 20_000) };
    return { ok: true, backend: 'page', items: [{ title: page.title, url, author: '', publishedAt: '', text: [page.description, page.text].filter(Boolean).join('\n\n'), stats: {} }], error: '' };
  } catch {
    return fail('That page could not be read.', 'page');
  }
}

const YT = 'https://www.googleapis.com/youtube/v3';
interface YtVideo { id: string | { videoId?: string }; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }
const ytItem = (v: YtVideo): ResearchItem => {
  const id = typeof v.id === 'string' ? v.id : (v.id?.videoId ?? '');
  return {
    title: clip(v.snippet?.title ?? '', 200),
    url: `https://www.youtube.com/watch?v=${id}`,
    author: clip(v.snippet?.channelTitle ?? '', 80),
    publishedAt: v.snippet?.publishedAt ?? '',
    text: clip(v.snippet?.description ?? '', 4000),
    stats: { views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0), comments: Number(v.statistics?.commentCount ?? 0) },
  };
};
const ytId = (url: string) => /(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(url)?.[1] ?? '';

async function youtubeApi(env: Env, action: 'read' | 'search', target: string, limit: number): Promise<ReachResult> {
  if (!env.YOUTUBE_API_KEY) return fail('Reading YouTube needs Agent Reach or a YOUTUBE_API_KEY.');
  try {
    let ids: string[] = [];
    if (action === 'read') ids = [ytId(target)].filter(Boolean);
    else {
      const s = (await (await fetch(`${YT}/search?part=snippet&type=video&maxResults=${Math.min(25, limit)}&q=${encodeURIComponent(target)}&key=${env.YOUTUBE_API_KEY}`)).json()) as { items?: YtVideo[] };
      ids = (s.items ?? []).map((v) => (typeof v.id === 'string' ? v.id : (v.id?.videoId ?? ''))).filter(Boolean);
    }
    if (ids.length === 0) return fail('No videos found.', 'youtube-api');
    const d = (await (await fetch(`${YT}/videos?part=snippet,statistics&id=${ids.join(',')}&key=${env.YOUTUBE_API_KEY}`)).json()) as { items?: YtVideo[] };
    return { ok: true, backend: 'youtube-api', items: (d.items ?? []).map(ytItem), error: '' };
  } catch {
    return fail('YouTube did not answer.', 'youtube-api');
  }
}

/** Read one link: the channel is picked from the address, Agent Reach first, the Worker's own readers after. */
export async function readLink(env: Env, url: string): Promise<ReachResult> {
  const platform = detectPlatform(url);
  if (reachConnected(env)) {
    const viaReach =
      platform === 'youtube' ? await bridge(env, 'youtube', 'read', { target: url })
      : platform === 'x' ? await bridge(env, 'twitter', 'thread', { target: url })
      : /reddit\.com|redd\.it/.test(url) ? await bridge(env, 'reddit', 'read', { target: url })
      : await bridge(env, 'web', 'read', { target: url });
    if (viaReach.ok) return viaReach;
  }
  if (platform === 'youtube') return youtubeApi(env, 'read', url, 1);
  return readPage(url);
}

/** A search, an outlier hunt, a transcript or a profile. */
export async function research(env: Env, kind: string, query: string, limit: number): Promise<ReachResult> {
  const n = Math.max(1, Math.min(25, limit || 10));
  switch (kind) {
    case 'read':
      return readLink(env, query);
    case 'search':
      return reachConnected(env) ? bridge(env, 'web', 'search', { query, limit: n }) : fail('Searching the web needs Agent Reach.');
    case 'youtube_search': {
      const r = reachConnected(env) ? await bridge(env, 'youtube', 'search', { query, limit: n }) : fail('');
      return r.ok ? r : youtubeApi(env, 'search', query, n);
    }
    case 'outliers': {
      const r = reachConnected(env) ? await bridge(env, 'youtube', 'search', { query, limit: Math.max(n, 15) }) : fail('');
      const base = r.ok ? r : await youtubeApi(env, 'search', query, Math.max(n, 15));
      if (!base.ok) return base;
      const items = [...base.items].sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0)).slice(0, n);
      return { ...base, items };
    }
    case 'x_search':
      return reachConnected(env) ? bridge(env, 'twitter', 'search', { query, limit: n }) : fail('Searching X needs Agent Reach with an X login.');
    case 'reddit_search':
      return reachConnected(env) ? bridge(env, 'reddit', 'search', { query, limit: n }) : fail('Searching Reddit needs Agent Reach.');
    case 'transcript':
      return reachConnected(env) ? bridge(env, 'youtube', 'subtitle', { target: query, lang: 'en,en-orig,hi' }) : fail('Transcripts need Agent Reach.');
    case 'profile': {
      if (!reachConnected(env)) return fail('Profiles need Agent Reach with a login for that platform.');
      const p = detectPlatform(query);
      const handle = query.replace(/^https?:\/\/[^/]+\//, '').replace(/^@/, '').split(/[/?]/)[0] ?? query;
      if (p === 'instagram') return bridge(env, 'instagram', 'posts', { username: handle, limit: n });
      return bridge(env, 'twitter', 'tweets', { username: handle, limit: n });
    }
    default:
      return fail('Unknown research kind.');
  }
}
