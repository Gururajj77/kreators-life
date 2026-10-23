export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  /** Secret. Admin endpoints are disabled when unset. */
  ADMIN_KEY?: string;
}

export interface UserRow {
  id: string;
  display_name: string;
  creator_type: string;
  xp: number;
  points: number;
  is_pro: number;
  leaderboard_opt_in: number;
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
