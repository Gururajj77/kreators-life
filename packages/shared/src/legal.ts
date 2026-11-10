// ---------------------------------------------------------------------------
// Legal: versions, what a person chooses, how long things are kept, who handles data. One list for the pages, the checks and the docs.
// ---------------------------------------------------------------------------

/** The version of the terms and the privacy policy (the day they were last changed). A new version is shown to people once. */
export const LEGAL_VERSION = '2026-11-10';
export const LEGAL_DOCS = [
  { key: 'terms', name: 'Terms of use', path: '/terms' },
  { key: 'privacy', name: 'Privacy policy', path: '/privacy' },
] as const;

/** The wording version of the privacy choices popup. Change it when a purpose is added or its meaning changes, and everyone is asked once more. */
export const CONSENT_VERSION = 1;
export interface ConsentPurpose {
  key: 'attribution' | 'embeds' | 'marketing';
  name: string;
  /** What it means, in a sentence a teenager can read. */
  line: string;
}
export const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  { key: 'attribution', name: 'Remember which link brought me', line: 'A cookie for thirty days that tells a creator which tracked link sent you, so they know what works. Off means no cookie.' },
  { key: 'embeds', name: 'Show videos from YouTube and Vimeo', line: 'Those sites see your visit when a video loads. Off means a video waits for you to tap it.' },
  { key: 'marketing', name: 'Send me news and offers by email', line: 'Now and then, never needed to use the app. Off means only the mail you need, like receipts and password resets.' },
];
export type ConsentChoices = Record<ConsentPurpose['key'], boolean>;
export const NO_CONSENT: ConsentChoices = { attribution: false, embeds: false, marketing: false };
/** Choices from anything the browser sends: only the known purposes, each true or false, the rest off. */
export function parseConsent(raw: unknown): ConsentChoices {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { attribution: o.attribution === true, embeds: o.embeds === true, marketing: o.marketing === true };
}
/**
 * Countries where a cookie that is not strictly needed waits for a yes: India, the EU, the rest of the EEA, the UK and
 * Switzerland. In India the Digital Personal Data Protection Act 2023 has personal data processed on consent (or a use
 * the Act lists), and the click cookie is optional, so it waits for a yes there too.
 */
export const CONSENT_FIRST_COUNTRIES: readonly string[] = ['IN', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'];

/** How long each kind of thing is kept, and why. The privacy page, the cron's tidy-up and the docs all read this list. */
export interface RetentionRule {
  category: string;
  keep: string;
  why: string;
}
export const RETENTION: readonly RetentionRule[] = [
  { category: 'Your account, profile, pillars, tasks, trackers and everything you add', keep: 'Until you delete your account, then gone at once. What other people rely on stays without your name, such as a product someone bought, the title of an event that had guests, a run club others joined, a paid reward entry without its link or notes, a pitch the team said yes to without its title or words, a campaign role and its work link, and what the team made.', why: 'It is your data and the reason the app exists. What stays is there for the people who count on it.' },
  { category: 'Your journal, gratitude lines and wellbeing logs', keep: 'Until you delete an entry, empty a day\'s lines or delete your account. A note of which gratitude prompts you wrote under or skipped (the prompt and the day, never your words) stays until you delete your account.', why: 'Only you can read them, unless you share wellbeing numbers with a life coach. The note keeps a prompt from coming back too soon.' },
  { category: 'A life coach\'s closed invite link (only a hash of it)', keep: 'A year', why: 'So opening an old link says it was closed.' },
  { category: 'Supplements you list in Fitness, and the days you ticked them', keep: 'Until you remove them or delete your account', why: 'It is your own list. Only you see it.' },
  { category: 'The waitlist (your name, your email and the line you wrote, if any)', keep: 'Thirty days after the invite you were sent is used or runs out, 180 days after the team says no, or a year if nobody has answered yet. It goes at once if you ask us, or when you delete an account with that email.', why: 'So the team can let you in when there is a place, and so an address is not kept once that is settled.' },
  { category: 'Invite codes you made, and the one you joined with', keep: 'Until you delete your account. Then a code you made that nobody used is taken back, and the label you gave a code is cleared; a used code stays, so it can never be used again.', why: 'A code works once, for one account, and a join is credited to whoever made the code.' },
  { category: 'Sign-in sessions', keep: 'Until you sign out, you pass the device limit, or thirty days after you were signed out by it', why: 'To keep you signed in, and to say why you were signed out.' },
  { category: 'A client\'s unlock of an Agency link that has a password (a random token kept only as a hash)', keep: 'Twelve hours, or until the owner changes the password', why: 'So a client does not type the password on every page.' },
  { category: 'A client\'s ask for a new Agency link password (the day, and a short reason if they gave one)', keep: 'Until the owner sets a new one or dismisses it, then ninety days', why: 'So the owner knows the link may be at risk.' },
  { category: 'Password reset links', keep: 'Thirty minutes to use; the used or expired row is removed within a week', why: 'Safety.' },
  { category: 'Counts of tries, such as sign-ins (each kept under your account, or a scrambled form of the email typed or your device\'s address, never the email or address itself)', keep: 'Two days', why: 'To slow down anyone guessing a password, and to stop abuse. A count holds nothing else.' },
  { category: 'The app\'s own log (changes, refusals, errors, who did it)', keep: 'Thirty days', why: 'To find and fix problems and to spot abuse. Never holds what you wrote.' },
  { category: 'Emails we sent you (receipts, resets)', keep: 'Ninety days in the outbox, then deleted', why: 'To show what was sent if something goes wrong.' },
  { category: 'A note already in someone else\'s inbox', keep: 'Until they delete it or their account, even after you delete yours. It keeps the words it was written with, which can hold your name or a line of yours.', why: 'A note does not record who it came from, so we cannot find it to change it.' },
  { category: 'Raw payment messages from the payment provider', keep: 'One year, then the raw text is cleared and the order stays', why: 'To settle a dispute about a payment.' },
  { category: 'Orders, invoices and money records', keep: 'Seven years. When you delete your account, your name and the words typed on an order or invoice come off, and the entries you typed in Finance go at once.', why: 'The tax and accounting law where the business is registered asks for it.' },
  { category: 'Discount codes you used (which code, what it took off, when)', keep: 'Until you delete your account', why: 'To hold each code to its limits and to show what it cost.' },
  { category: 'Tracked link clicks (an address hash, never the address)', keep: 'Thirteen months', why: 'So a creator can compare this year with last year.' },
  { category: 'Your terms and privacy choices', keep: 'Until you delete your account', why: 'To show what you agreed to and when.' },
  { category: 'Lines you write in Community and Bond channels, run discussions and School cohort discussions', keep: 'A year after each line was written (a cohort thread goes a year after its newest line), or until you delete the line or your account', why: 'A channel is a running chat, not a record.' },
  { category: 'Data requests (the date, what was asked, when it was done; no names)', keep: 'Three years', why: 'To show we answered in time.' },
  { category: 'Copyright notices', keep: 'Three years after they were settled', why: 'To show what was done about a notice.' },
];

/** Everyone who handles personal data for us. The subprocessors page, the privacy page and the docs all read this list. */
export interface Subprocessor {
  name: string;
  does: string;
  data: string;
  where: string;
  /** always, or only when the person uses the feature. */
  when: string;
}
export const SUBPROCESSORS: readonly Subprocessor[] = [
  { name: 'Cloudflare', does: 'Runs the app and its database, and serves the website', data: 'Everything you put in the app, and the address of your device while a page loads', where: 'A global network; data is held in the region Cloudflare picks for our database', when: 'Always' },
  { name: 'Resend', does: 'Sends email: receipts, password resets, payout notices, and notes people send, such as an Agency copy or a coach\'s invite', data: 'The address it goes to and the words of the email', where: 'United States', when: 'When we email you, or a member sends a note' },
  { name: 'Razorpay', does: 'Takes card and bank payments', data: 'What you buy and what you pay; card and bank details go to Razorpay and never to us', where: 'India', when: 'Only when you pay with money' },
  { name: 'Anthropic', does: 'Writes pieces in Content when a writing model is connected', data: 'The folder of the brand you are writing for: its links, the research from them and your brief', where: 'United States', when: 'Only when you write a piece in Content' },
  { name: 'OpenRouter and the model hosts it uses', does: 'Runs the assistant and the Companion when you type to them with a plan', data: 'What you type, the chat so far and what the assistant or the Companion looks up. A model that keeps nothing is the only one that may read your journal, mood, sleep or trackers', where: 'United States and others, by model', when: 'Only when you type to the assistant or the Companion with a plan' },
  { name: 'Cloudflare Workers AI', does: 'Drafts product text when no other writing model is connected, and answers the Companion without a plan', data: 'The brief you give it, or your Companion chat and the facts it uses', where: 'A global network', when: 'Only when you ask for a draft or talk to the Companion' },
  { name: 'YouTube (Google) and Vimeo', does: 'Play a video that someone put on a page', data: 'That your device loaded the video, once you allow it', where: 'United States', when: 'Only when you play a video' },
  { name: 'Google (YouTube Data API)', does: 'Reads public view counts for content rewards and Content research', data: 'The public link of a post, never anything about you', where: 'United States', when: 'Only for content rewards and research' },
  { name: 'Agent Reach (our own research bridge)', does: 'Reads public pages for Content research', data: 'The public links you added to a brand folder', where: 'Where we run it', when: 'Only when it is connected and you run research' },
];

/** The days after which a thing is removed by the daily tidy-up. One list, read by the cron. */
export const RETENTION_DAYS = { outbox: 90, webhooks: 365, clicks: 396, resets: 7, requests: 1095, notices: 1095, channelLines: 365, passwordRequests: 90, rateLimits: 2, waitlistDeclined: 180, waitlistWaiting: 365, waitlistSettled: 30 } as const;

/** What the business that runs kreators.app wants shown on the contact page and in the copyright notice process. Every field is set by the owner, never in code. */
export interface BusinessInfo {
  name: string;
  address: string;
  email: string;
  registration: string;
  vat: string;
  /** The Grievance Officer under India's DPDP Act and IT Rules: the first stop for a privacy or content complaint. Empty until the owner sets it. */
  grievanceName: string;
  grievanceEmail: string;
  grievancePhone: string;
  /** The designated agent for copyright notices (the same entity unless the owner says otherwise). */
  dmcaAgent: string;
  dmcaAddress: string;
  dmcaEmail: string;
  dmcaRegistered: boolean;
}
