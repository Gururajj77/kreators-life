export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  /** Secret. Admin endpoints are disabled when unset. */
  ADMIN_KEY?: string;
  /** Optional Workers AI binding for the companion. Without it the companion answers from your data alone. */
  AI?: Ai;
  /** Optional. With it, YouTube view counts are fetched automatically for content rewards. */
  YOUTUBE_API_KEY?: string;
  /** Optional Meta app credentials. Without them the Auto-DM webhook is off and automations only queue messages. */
  META_APP_SECRET?: string;
  META_VERIFY_TOKEN?: string;
  META_ACCESS_TOKEN?: string;
  /** Salt for hashing click IPs. Falls back to a fixed string locally. */
  CLICK_SALT?: string;
  /** Optional Razorpay keys. With them, money checkout is live; without them it stays in test mode. */
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  /** Optional Resend key for transactional email; the outbox keeps every message either way. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Extra founder addresses that become admins on sign-up or sign-in, comma separated. */
  ADMIN_EMAILS?: string;
  /** The content strategist's writer. With it, pieces are written by Claude through the official SDK. */
  ANTHROPIC_API_KEY?: string;
  /** Optional model id for the writer; claude-opus-5-5 when unset. */
  ANTHROPIC_MODEL?: string;
  /** The Agent Reach bridge (scripts/reach/server.mjs) and its key. Without it, research reads plain pages and YouTube only. */
  REACH_URL?: string;
  REACH_KEY?: string;
  /**
   * The assistant's model: any OpenAI-compatible chat endpoint. Without the key, typing to the assistant is off and
   * its free flows still work. The base URL defaults to OpenRouter, the model to the first of ASSISTANT_MODELS (a free
   * one); the panel can pick any model on that list.
   */
  ASSISTANT_API_KEY?: string;
  ASSISTANT_BASE_URL?: string;
  ASSISTANT_MODEL?: string;
  /** Optional: the model's price in US dollars per million tokens ("0.5415"), when it is not in MODEL_PRICES. */
  ASSISTANT_PRICE_IN?: string;
  ASSISTANT_PRICE_OUT?: string;
  /** For a model not on ASSISTANT_MODELS, on OpenRouter: zero-retention hosts only, unless "off" (then it may not read the journal or trackers). */
  ASSISTANT_ZDR?: string;
}

export interface UserRow {
  id: string;
  display_name: string;
  creator_type: string;
  xp: number;
  points: number;
  is_pro: number;
  leaderboard_opt_in: number;
  role: 'user' | 'sub_admin' | 'admin';
  email: string | null;
  phone: string;
  birth_date: string;
  password_hash: string | null;
  password_salt: string | null;
  handle: string | null;
  bio: string;
  modules: string;
  reminder_time: string | null;
  referral_code: string | null;
  referred_by: string | null;
  permissions: string;
  skills: string;
  categories: string;
  goals: string;
  experience_level: string;
  availability: string;
  location: string;
  open_to_intros: number;
  interests: string;
  /** JSON list of identity tags: known keys and labels in the person's own words. */
  identities: string;
  /** JSON: the setup chat's goals and what gets in the way, with when it was saved. */
  intake_json: string;
  city: string;
  area: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
  avatar_url: string;
  socials_json: string;
  public_json: string;
  links_json: string;
  fee_bps: number;
  streak: number;
  best_streak: number;
  /** The first-week checklist on Home was folded away. */
  getting_started_hidden_at?: string | null;
  last_checkin: string | null;
  onboarded_at: string | null;
  created_at: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: UserRow };
};
