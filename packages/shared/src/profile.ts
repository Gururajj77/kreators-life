import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Creator studio — products, orders, bookings, leads
// ---------------------------------------------------------------------------

export interface Socials {
  instagram: string;
  youtube: string;
  x: string;
  website: string;
}
export const EMPTY_SOCIALS: Socials = { instagram: '', youtube: '', x: '', website: '' };

/**
 * What a person shows on their public page. One switch for the whole page, then one per part.
 * Everything here is the person's choice; nothing on the page is shown unless its switch is on.
 */
export interface PublicSettings {
  /** The whole page. Off means only you can open it. */
  pagePublic: boolean;
  showSocials: boolean;
  /** The link blocks: buttons, headers, text, images, videos, carousels. */
  showBlocks: boolean;
  showPortfolio: boolean;
  showProducts: boolean;
  /** Your community posts, on your page. */
  showPosts: boolean;
  /** Level, streak, pillars set up. Never the journal or wellbeing. */
  showActivity: boolean;
  /** The badges you earned and the honors you were awarded. */
  showBadges: boolean;
  allowFriendRequests: boolean;
  /** Friends can open an anonymous chat with you from your page. */
  allowChats: boolean;
}
export const DEFAULT_PUBLIC: PublicSettings = { pagePublic: true, showSocials: true, showBlocks: true, showPortfolio: true, showProducts: true, showPosts: true, showActivity: false, showBadges: true, allowFriendRequests: true, allowChats: true };
export const PUBLIC_SETTING_META: { key: keyof PublicSettings; name: string; blurb: string }[] = [
  { key: 'pagePublic', name: 'My page is public', blurb: 'Off hides the whole page from everyone but you. Every switch below needs this on.' },
  { key: 'showSocials', name: 'Show my social icons', blurb: 'Instagram, YouTube, X and your website.' },
  { key: 'showBlocks', name: 'Show my links', blurb: 'Your link buttons, headers, text, images, videos and carousels.' },
  { key: 'showPortfolio', name: 'Show my portfolio', blurb: 'Your public portfolio items.' },
  { key: 'showProducts', name: 'Show what I sell', blurb: 'Products from your shop.' },
  { key: 'showPosts', name: 'Show my posts', blurb: 'Your posts in the community feed, on your page too.' },
  { key: 'showActivity', name: 'Show my activity', blurb: 'Level, streak and how many pillars are set up. Never your journal or wellbeing.' },
  { key: 'showBadges', name: 'Show my badges', blurb: 'The badges you earned and any honors the team awarded you.' },
  { key: 'allowFriendRequests', name: 'Let people add me as a friend', blurb: 'Off hides the Add friend button.' },
  { key: 'allowChats', name: 'Let friends start a chat', blurb: 'Anonymous, under aliases. Off means nobody can open one with you.' },
];
// ---------------------------------------------------------------------------
// Links on the public page: the Linktree part. Blocks the creator stacks in order, shown to everyone.
// ---------------------------------------------------------------------------

export const LINK_BLOCK_TYPES = ['link', 'header', 'text', 'image', 'video', 'carousel'] as const;
export type LinkBlockType = (typeof LINK_BLOCK_TYPES)[number];

export interface LinkBlockItem {
  id: string;
  title: string;
  url: string;
  image: string;
}

export interface LinkBlock {
  id: string;
  type: LinkBlockType;
  /** The button label, header text, caption or video title. */
  title: string;
  /** Where it goes. A video block takes a YouTube link. */
  url: string;
  /** An https picture, for image blocks. */
  image: string;
  /** The paragraph of a text block. */
  text: string;
  /** A link drawn big and in colour. */
  featured: boolean;
  /** Off hides it from the page without deleting it. */
  on: boolean;
  /** The cards of a carousel. */
  items: LinkBlockItem[];
}

export const MAX_LINK_BLOCKS = 30;
export const MAX_CAROUSEL_ITEMS = 10;

export const LINK_BLOCK_META: Record<LinkBlockType, { name: string; icon: IconName; blurb: string }> = {
  link: { name: 'Link', icon: 'Link', blurb: 'A button that opens any page.' },
  header: { name: 'Header', icon: 'LetterH', blurb: 'A title that groups the links under it.' },
  text: { name: 'Text', icon: 'Type', blurb: 'A short paragraph in your words.' },
  image: { name: 'Image', icon: 'Image', blurb: 'One picture, with a link if you want.' },
  video: { name: 'Video', icon: 'SquarePlay', blurb: 'A YouTube video that plays on your page.' },
  carousel: { name: 'Carousel', icon: 'GalleryHorizontal', blurb: 'Cards people swipe through, each with a link.' },
};

const httpsUrl = (v: unknown): string => (typeof v === 'string' && /^https:\/\/[^\s\u0000-\u001f\u007f]{1,500}$/.test(v.trim()) ? v.trim() : '');
const shortText = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Keeps only what a block may hold: https links, short text, a bounded carousel. Empty or unknown blocks are dropped. */
export function parseLinkBlocks(raw: unknown): LinkBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: LinkBlock[] = [];
  for (const b of raw.slice(0, MAX_LINK_BLOCKS)) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    if (!(LINK_BLOCK_TYPES as readonly string[]).includes(String(r.type))) continue;
    const type = r.type as LinkBlockType;
    const items: LinkBlockItem[] = Array.isArray(r.items)
      ? r.items
          .slice(0, MAX_CAROUSEL_ITEMS)
          .map((it, i) => {
            const x = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
            return { id: shortText(x.id, 40) || `c${i + 1}`, title: shortText(x.title, 80), url: httpsUrl(x.url), image: httpsUrl(x.image) };
          })
          .filter((it) => it.title || it.image)
      : [];
    let id = shortText(r.id, 40) || `b${out.length + 1}`;
    while (out.some((o) => o.id === id)) id = `${id.slice(0, 36)}-${out.length + 1}`;
    const block: LinkBlock = { id, type, title: shortText(r.title, 120), url: httpsUrl(r.url), image: httpsUrl(r.image), text: shortText(r.text, 600), featured: r.featured === true, on: r.on !== false, items: type === 'carousel' ? items : [] };
    if (type === 'link' && !block.url) continue;
    if (type === 'header' && !block.title) continue;
    if (type === 'text' && !block.text) continue;
    if (type === 'image' && !block.image) continue;
    if (type === 'video' && !block.url) continue;
    if (type === 'carousel' && block.items.length === 0) continue;
    out.push(block);
  }
  return out;
}

/** The id inside a YouTube link, or null for anything else. */
export function youtubeId(url: string): string | null {
  const m = url.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Profile and portfolio
// ---------------------------------------------------------------------------

export const SKILLS = ['Videography', 'Editing', 'On camera', 'Interviewing', 'Writing', 'Design', 'Photography', 'Sound', 'Sales and pitching', 'Community', 'Live streaming', 'Teaching'] as const;
export const CATEGORIES = ['Education', 'Comedy', 'Lifestyle', 'Fitness', 'Food', 'Tech', 'Finance', 'Travel', 'Music', 'Gaming', 'Fashion', 'Wellbeing'] as const;
export const EXPERIENCE_LEVELS = ['Just starting', 'Early', 'Working', 'Established'] as const;
export const AVAILABILITY = ['Open to work', 'Open to collabs', 'Busy right now'] as const;
export const GOALS = ['Learn skills', 'Find paid work', 'Collaborate', 'Attend events', 'Sell what I make', 'Get healthier habits'] as const;

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  url: string;
  visibility: 'public' | 'private';
  createdAt: string;
}
