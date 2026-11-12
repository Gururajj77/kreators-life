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
  /** Salt for hashing click addresses, anonymous names and the addresses and typed emails in `rate_limits` keys. Falls back to a fixed string locally. */
  CLICK_SALT?: string;
  /** Optional Razorpay keys. With them, money checkout is live; without them it stays in test mode. */
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  /** The business that runs kreators.app, shown on the contact page and used in marketing mail. Set as Worker variables; never written in code. */
  /** The site's own address, for links in mail (https://kreators.app). */
  PUBLIC_URL?: string;
  BUSINESS_NAME?: string;
  BUSINESS_ADDRESS?: string;
  BUSINESS_EMAIL?: string;
  BUSINESS_REG?: string;
  BUSINESS_VAT?: string;
  /** The Grievance Officer for people in India (DPDP Act 2023, IT Rules 2021): name, email and an optional phone. Shown as "not set yet" when empty. */
  BUSINESS_GRIEVANCE_NAME?: string;
  BUSINESS_GRIEVANCE_EMAIL?: string;
  BUSINESS_GRIEVANCE_PHONE?: string;
  /** Who receives copyright notices (the business unless set), and "yes" once the agent is listed with the US Copyright Office. */
  DMCA_AGENT?: string;
  DMCA_ADDRESS?: string;
  DMCA_EMAIL?: string;
  DMCA_REGISTERED?: string;
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
  /** Set only on the test server (blueprint.sh): count D1 round trips and rows and say them in headers (d1Guard.ts). Never set in production. */
  D1_GUARD?: string;
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
  friend_code: string | null;
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
  /** JSON: which app groups start open and the order of apps inside a group (migration 0074), read through parseAppPrefs. */
  app_prefs_json?: string | null;
  /** JSON: the date format and time format this person's screens use (migration 0109), read through parseDatePrefs; NULL is the default. */
  date_prefs_json?: string | null;
  /** JSON: the sections of Daily the person hid with View (migration 0134), read through parseDailyView; NULL hides nothing. */
  daily_view_json?: string | null;
  fee_bps: number;
  streak: number;
  best_streak: number;
  /** The first-week checklist on Home was folded away. */
  getting_started_hidden_at?: string | null;
  /** When the starting time blocks and day templates were added (migration 0089); null until the first read. */
  time_blocks_seeded_at?: string | null;
  /** The counts behind the badges, kept for an hour (`keptStats` in db.ts). */
  stats_json?: string | null;
  stats_at?: string | null;
  last_checkin: string | null;
  onboarded_at: string | null;
  /** The Party event joined from its public page before setup was done (migration 0121). */
  attendee_event?: string | null;
  created_at: string;
}

/** A team member acting on an owner's Agency, as the gate resolved them for this one request. */
export interface TeamActor {
  id: string;
  ownerId: string;
  memberId: string;
  memberName: string;
  role: import('@kreators/shared').TeamRole;
  access: import('@kreators/shared').TeamAccess;
}

export type AppEnv = {
  Bindings: Env;
  /** `team` is set by the Agency team gate (agencyTeamAccess.ts) when a team member works on someone's Agency: `user` is then the owner. */
  /** `adminKeyOk` is set only by the admin key's door (`adminKeyDoor` in ops.ts), the one place that key is compared. */
  Variables: { user: UserRow; team?: TeamActor; logNote?: string; requestId?: string; adminKeyOk?: boolean };
};
