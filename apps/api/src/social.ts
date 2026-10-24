import { detectPlatform, type SocialPlatform } from '@kreators/shared';

export interface Reading {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

/** Pull a post's numbers from its platform when we have a way to. Returns null when we do not. */
export async function fetchMetrics(url: string, env: { YOUTUBE_API_KEY?: string }): Promise<{ platform: SocialPlatform; reading: Reading | null; why: string }> {
  const platform = detectPlatform(url);
  if (platform === 'youtube') {
    if (!env.YOUTUBE_API_KEY) return { platform, reading: null, why: 'YouTube reading needs a YOUTUBE_API_KEY on the server' };
    const id = youtubeId(url);
    if (!id) return { platform, reading: null, why: 'could not find a video id in that link' };
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(id)}&key=${env.YOUTUBE_API_KEY}`);
      if (!res.ok) return { platform, reading: null, why: `YouTube answered ${res.status}` };
      const data = (await res.json()) as { items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] };
      const st = data.items?.[0]?.statistics;
      if (!st) return { platform, reading: null, why: 'YouTube returned no statistics for that video' };
      return { platform, reading: { views: Number(st.viewCount ?? 0), likes: Number(st.likeCount ?? 0), comments: Number(st.commentCount ?? 0), shares: 0 }, why: 'read from YouTube' };
    } catch {
      return { platform, reading: null, why: 'could not reach YouTube' };
    }
  }
  // Instagram, TikTok, X and the rest only expose numbers through partner APIs.
  // Creators report them with a screenshot and a reviewer confirms before any payout.
  return { platform, reading: null, why: 'this platform has no open numbers; report them and a reviewer will confirm' };
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}
