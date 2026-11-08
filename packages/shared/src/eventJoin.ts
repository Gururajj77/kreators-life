// The event attendee's way in (2026-11-07, migration 0121). Someone who signs up from a public event page (/events/:id) gets the event first and
// the setup chat later. Until setup is done, the app lets them into what an attendee needs and nothing else; `Shell` in App.tsx reads this.
// A leaf: it imports only a type, so it sits in the small `shared-base` chunk (vite.config.ts) and never grows the shared chunk.
import type { MediaItem } from './community.ts';

/** The apps switched on for an account that joined an event before setup (the ordinary per-person switch, `users.modules`). */
export const ATTENDEE_APPS = ['party', 'community', 'bond'] as const;

/**
 * Where an account that joined an event may go before setup is done: the event and Party, Community, Bond's chats, Inbox, the Profile tab
 * (`/you`) and Help. Each covers the paths under it (`/party/<id>`, `/bond/chats/<id>`). Anything else sends the person to the setup chat.
 */
export const ATTENDEE_PATHS = ['/party', '/community', '/bond', '/inbox', '/you', '/help'] as const;

/** Whether an account that joined an event, with setup not done yet, may open this path. */
export function attendeeMayOpen(path: string): boolean {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return ATTENDEE_PATHS.some((a) => p === a || p.startsWith(`${a}/`));
}

/** One upcoming public event, as the public site shows it (GET /api/public/events and /api/public/events/:id). Who is coming is never in it. */
export interface PublicEvent {
  id: string;
  title: string;
  description: string;
  /** A key of `EVENT_TYPES`. */
  eventType: string;
  hostName: string;
  /** Where it is, as the host wrote it; empty when it is online or not set yet. */
  venue: string;
  /** True when it happens online. The room's link is never public: a guest opens it from the event in the app. */
  online: boolean;
  /** The event's own zone. The page shows the time in the visitor's view (lib/date.ts). */
  timezone: string;
  startsAt: string;
  endsAt: string;
  /** Null when the room has no limit. */
  capacity: number | null;
  /** Seats still free, never under 0; null when the room has no limit. */
  seatsLeft: number | null;
  /** 0 is free. A ticket is paid in points, in the app, only after the person says yes. */
  pricePoints: number;
  /** 'published', 'cancelled' or 'done'. The list only ever holds published ones still to come. */
  status: string;
  featured: boolean;
  /** The host's pictures, for the card's cover and the page. */
  media?: MediaItem[];
}
