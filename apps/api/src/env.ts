export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  /** Secret. Admin endpoints are disabled when unset. */
  ADMIN_KEY?: string;
  /** Local only. When set, a signed-in person can fill their own account with two weeks of demo data from You. */
  DEMO_SEED?: string;
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
  city: string;
  area: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
  avatar_url: string;
  socials_json: string;
  fee_bps: number;
  streak: number;
  best_streak: number;
  last_checkin: string | null;
  onboarded_at: string | null;
  created_at: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: UserRow };
};
