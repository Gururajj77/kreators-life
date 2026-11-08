import { byKey } from './core.ts';
import type { RelationshipKey } from './core.ts';
import type { Unlock } from './badges.ts';
import type { IconName } from './roles.ts';

// ---------------------------------------------------------------------------
// Card games
// ---------------------------------------------------------------------------

/**
 * Card games, played in the app. Each game is unlocked once with points (see REWARDS in index.ts) and then played for good.
 * The card text lives in D1 (`card_games`, `card_decks` and `cards`, seeded by migration 0042) and is only served by `GET /cards/:key` to someone who unlocked the game (or to the team);
 * this file holds what the client needs before that: the name, the line, the picture and the price.
 */
export interface CardGameInfo {
  key: string;
  name: string;
  tagline: string;
  emoji: string;
  /** The relationship whose colours the game wears. */
  accent: RelationshipKey;
  /** Points to unlock it for good. */
  cost: number;
  /** An xp floor before it can be unlocked, on top of the points. Zero means none. */
  minXp: number;
  /** A badge to hold first, when the game asks for one. */
  badge?: string;
}

export const CARD_GAMES: readonly CardGameInfo[] = [
  { key: 'ulta_seedha', name: 'Ulta Seedha', tagline: 'A game to help you overcome approach anxiety.', emoji: '🙃', accent: 'friendship', cost: 2000, minXp: 500 },
  { key: 'dateflow_connect', name: 'DateFlow', tagline: 'A game for better dating experiences.', emoji: '💞', accent: 'lover_partner', cost: 2000, minXp: 500 },
  { key: 'date_guru', name: 'DateGuru', tagline: 'Fifty-two lessons for better dating experiences.', emoji: '🧭', accent: 'lover_partner', cost: 1500, minXp: 100 },
  { key: 'healflow', name: 'HealFlow', tagline: 'For mindful families who want to heal, bond and connect over fun, therapeutic activities.', emoji: '🌿', accent: 'parent_child', cost: 1500, minXp: 100 },
  { key: 'funflow', name: 'FunFlow', tagline: 'For friends, teams and party nights who want to bond and grow together.', emoji: '🎉', accent: 'friendship', cost: 1500, minXp: 100 },
  { key: 'relationship_method', name: '7RP Challenge', tagline: 'One small daily challenge for each of the seven relationships.', emoji: '🌈', accent: 'self', cost: 1000, minXp: 0 },
  { key: 'roast_or_flirt', name: 'Roast or Flirt', tagline: 'Build better self-esteem with your relationships power.', emoji: '🔥', accent: 'friendship', cost: 2000, minXp: 500 },
  { key: 'shadowflow', name: 'ShadowFlow', tagline: 'Use ShadowFlow to learn more about your hidden self.', emoji: '🌙', accent: 'divine', cost: 1500, minXp: 250 },
  { key: 'workflow', name: 'WorkFlow', tagline: 'Reveal the hidden secrets of office culture.', emoji: '💼', accent: 'servant_leader', cost: 1500, minXp: 250 },
];

export const CARD_GAME_BY_KEY: Record<string, CardGameInfo> = byKey(CARD_GAMES.map((g) => [g.key, g]));

/** A game's unlock is a reward with this key. */
export const gameRewardKey = (gameKey: string) => `game_${gameKey}`;

/** One card. A card with `alt` has two sides (Truth and Dare, Roast and Flirt, This and That): the flip shows the other. */
export interface PlayCard {
  /** A short name at the top, when the card has one. */
  title?: string;
  /** What the side is called: This, Roast, Seedha: Truth. */
  label?: string;
  text: string;
  /** Extra lines under the text: examples, questions, riddles, statements. */
  list?: string[];
  alt?: { label: string; text: string };
}

export interface PlayDeck {
  key: string;
  name: string;
  /** What the back of every card in this deck says, when the deck has its own line. */
  hint?: string;
  cards: PlayCard[];
}

/** What the game list shows for each game. */
export interface CardGameCard extends CardGameInfo {
  unlocked: boolean;
  /** What stands between this person and the game: xp, points and a badge, in plain words. Open when they have it all. */
  unlock: Unlock;
  decks: { key: string; name: string; count: number }[];
  total: number;
}

/** A whole game, served only when it is unlocked. */
export interface CardGamePlay extends CardGameInfo {
  howTo: string;
  /** Special cards: rules that shake a turn up. */
  special?: string[];
  specialNote?: string;
  /** House rules, for games that have them. */
  rules?: string[];
  decks: PlayDeck[];
}

export interface CardGamesResponse {
  points: number;
  games: CardGameCard[];
}

// ---------------------------------------------------------------------------
// Points and rewards — check-ins earn points you can later trade for real
// things. Rewards are reservations until the first drop ships.
// ---------------------------------------------------------------------------

export const POINTS = {
  checkin: 10,
  /** Every Nth day of a streak pays a bonus. */
  streakBonusEvery: 7,
  streakBonus: 50,
} as const;

export type RewardGroup = 'apparel' | 'tech' | 'drinkware' | 'stationery' | 'lifestyle' | 'novelty' | 'books' | 'games' | 'experiences';

export interface Reward {
  key: string;
  name: string;
  /** An unlock opens something in the app for good (a card game); a merch item or an event ships or happens later. */
  kind: 'event' | 'merch' | 'unlock';
  group: RewardGroup;
  /** For kind unlock: the card game it opens. */
  game?: string;
  /** Its own picture on the card. */
  emoji: string;
  cost: number;
  blurb: string;
  /** Where to read more about it, for the books and games that come from the founder's own sites. */
  link?: string;
}

/** The shelves of the catalog, in the order they are shown. */
export const REWARD_GROUPS: readonly { key: RewardGroup; name: string; icon: IconName; blurb: string }[] = [
  { key: 'books', name: 'Books', icon: 'BookOpen', blurb: 'Three books by Shubham Aggarwal, the founder of kreators.app.' },
  { key: 'games', name: 'Games', icon: 'Spade', blurb: 'Unlock a game once with points and play it in the app: shuffle, flip and draw. Nothing is posted to you.' },
  { key: 'apparel', name: 'Apparel and wearables', icon: 'Shirt', blurb: 'Wear it, and people ask what it is.' },
  { key: 'tech', name: 'Tech accessories', icon: 'Smartphone', blurb: 'Small things you use every day.' },
  { key: 'drinkware', name: 'Drinkware', icon: 'Coffee', blurb: 'Keep a drink with you, again and again.' },
  { key: 'stationery', name: 'Office and stationery', icon: 'PenLine', blurb: 'For your desk and your plans.' },
  { key: 'lifestyle', name: 'Lifestyle and wellness', icon: 'Leaf', blurb: 'Look after yourself, at home or on the road.' },
  { key: 'novelty', name: 'Novelty and fun', icon: 'Gamepad2', blurb: 'Just for the joy of it.' },
  { key: 'experiences', name: 'Experiences', icon: 'Ticket', blurb: 'Time with real people.' },
];

export const REWARDS: readonly Reward[] = [
  ...CARD_GAMES.map((g): Reward => ({ key: gameRewardKey(g.key), name: g.name, kind: 'unlock', emoji: g.emoji, group: 'games', cost: g.cost, blurb: g.tagline, game: g.key })),
  { key: 'book_relationship_method', name: 'The Relationship Method', kind: 'merch', emoji: '📘', group: 'books', cost: 2000, blurb: 'The book behind the seven relationships this app is built on.', link: 'https://brandingbum.com' },
  { key: 'book_dictionary_of_mistakes', name: 'Dictionary of Mistakes for Kreators', kind: 'merch', emoji: '📕', group: 'books', cost: 2000, blurb: 'Mistakes every creator makes, and how to learn from them.', link: 'https://brandingbum.com' },
  { key: 'book_20_somethings', name: 'Dictionary of Mistakes for 20 Somethings', kind: 'merch', emoji: '📗', group: 'books', cost: 2000, blurb: 'The mistakes of your twenties, and how to make them count.', link: 'https://brandingbum.com' },

  { key: 'tee', name: 'Kreators tee', kind: 'merch', emoji: '👕', group: 'apparel', cost: 2500, blurb: 'The seven characters, printed big.' },
  { key: 'hoodie', name: 'Kreators hoodie', kind: 'merch', emoji: '🧥', group: 'apparel', cost: 4500, blurb: 'Warm, soft and easy to spot.' },
  { key: 'cap', name: 'Cap', kind: 'merch', emoji: '🧢', group: 'apparel', cost: 1800, blurb: 'A plain cap with the Kreators mark.' },
  { key: 'beanie', name: 'Beanie', kind: 'merch', emoji: '🎿', group: 'apparel', cost: 1500, blurb: 'For the cold days.' },
  { key: 'socks', name: 'Socks', kind: 'merch', emoji: '🧦', group: 'apparel', cost: 1200, blurb: 'Fun socks with the characters.' },
  { key: 'tote', name: 'Tote bag', kind: 'merch', emoji: '👜', group: 'apparel', cost: 1000, blurb: 'Strong, reusable and roomy.' },

  { key: 'usb_drive', name: 'USB flash drive', kind: 'merch', emoji: '💾', group: 'tech', cost: 1500, blurb: 'Carry your files anywhere.' },
  { key: 'power_bank', name: 'Power bank', kind: 'merch', emoji: '🔋', group: 'tech', cost: 3000, blurb: 'Charge your phone on the go.' },
  { key: 'phone_grip', name: 'Phone grip and stand', kind: 'merch', emoji: '📲', group: 'tech', cost: 600, blurb: 'Sticks on and holds your phone up.' },
  { key: 'laptop_stickers', name: 'Laptop stickers', kind: 'merch', emoji: '💻', group: 'tech', cost: 400, blurb: 'A few small stickers for your laptop.' },

  { key: 'water_bottle', name: 'Water bottle', kind: 'merch', emoji: '💧', group: 'drinkware', cost: 1800, blurb: 'A steel bottle for your daily water goal.' },
  { key: 'mug', name: 'Coffee mug', kind: 'merch', emoji: '☕', group: 'drinkware', cost: 1200, blurb: 'A ceramic mug for your desk.' },
  { key: 'tumbler', name: 'Tumbler', kind: 'merch', emoji: '🥤', group: 'drinkware', cost: 2200, blurb: 'Keeps drinks hot or cold for hours.' },

  { key: 'notebook', name: 'Notebook', kind: 'merch', emoji: '📓', group: 'stationery', cost: 1200, blurb: 'A good notebook for plans and ideas.' },
  { key: 'pens', name: 'Pen and highlighter set', kind: 'merch', emoji: '🖊️', group: 'stationery', cost: 500, blurb: 'The classic set.' },
  { key: 'sticky_notes', name: 'Sticky notes', kind: 'merch', emoji: '🗒️', group: 'stationery', cost: 500, blurb: 'Small reminders you can see.' },
  { key: 'desk_organizer', name: 'Desk organizer', kind: 'merch', emoji: '🗂️', group: 'stationery', cost: 1000, blurb: 'Keeps your desk tidy.' },

  { key: 'lip_balm', name: 'Lip balm', kind: 'merch', emoji: '💋', group: 'lifestyle', cost: 400, blurb: 'Small enough for any bag.' },
  { key: 'hand_sanitizer', name: 'Hand sanitizer', kind: 'merch', emoji: '🧴', group: 'lifestyle', cost: 400, blurb: 'A pocket size bottle.' },
  { key: 'travel_pillow', name: 'Travel pillow', kind: 'merch', emoji: '😴', group: 'lifestyle', cost: 1800, blurb: 'For long trips.' },
  { key: 'luggage_tag', name: 'Luggage tag', kind: 'merch', emoji: '🧳', group: 'lifestyle', cost: 500, blurb: 'Find your bag fast.' },
  { key: 'sunglasses', name: 'Sunglasses', kind: 'merch', emoji: '🕶️', group: 'lifestyle', cost: 1500, blurb: 'For sunny days and festivals.' },

  { key: 'stickers', name: 'Sticker pack', kind: 'merch', emoji: '✨', group: 'novelty', cost: 600, blurb: 'All seven characters, die-cut.' },
  { key: 'stress_ball', name: 'Stress ball', kind: 'merch', emoji: '🟡', group: 'novelty', cost: 400, blurb: 'Squeeze it when work gets heavy.' },
  { key: 'enamel_pin', name: 'Enamel pin', kind: 'merch', emoji: '📌', group: 'novelty', cost: 500, blurb: 'A collectible pin of one of the characters.' },
  { key: 'keychain', name: 'Keychain', kind: 'merch', emoji: '🔑', group: 'novelty', cost: 500, blurb: 'Small, strong and always with you.' },
  { key: 'bottle_opener', name: 'Bottle opener', kind: 'merch', emoji: '🍾', group: 'novelty', cost: 400, blurb: 'Useful more often than you think.' },

  { key: 'meetup', name: 'Meetup ticket', kind: 'event', emoji: '🎟️', group: 'experiences', cost: 1500, blurb: 'A seat at the next city meetup.' },
  { key: 'coaching', name: 'One-to-one call', kind: 'event', emoji: '🎯', group: 'experiences', cost: 4000, blurb: 'Forty minutes with a mentor.' },
];

export const REWARD_BY_KEY: Record<string, Reward> = byKey(REWARDS.map((r) => [r.key, r]));

export type RedemptionStatus = 'reserved' | 'fulfilled' | 'cancelled';

export interface Redemption {
  id: string;
  rewardKey: string;
  points: number;
  status: RedemptionStatus;
  note: string;
  createdAt: string;
}

export interface RewardsResponse {
  points: number;
  /** The card games this person has unlocked. */
  games: string[];
  rewards: Reward[];
  redemptions: Redemption[];
}
