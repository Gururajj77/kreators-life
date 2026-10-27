# 04 — Database and data dictionary

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** the 28 migrations in `apps/api/migrations`, applied in order with `pnpm db:migrate:local` or `pnpm db:migrate`. This doc lists every table and its columns as they stand after migration 0028. Types are omitted; `_at` columns are UTC ISO strings, `_cents` are integer cents, `_points` are integer points, `_json` is a JSON string.

## 1. Principles as built

- Ids are random strings from `newId()`; sessions are two UUIDs; tokens at rest are SHA-256 hashes.
- Every time is a UTC ISO string. Zone conversion only through `zonedToUtc` and `slotsFor` in shared. Dates that mean "a day for a person" are `YYYY-MM-DD` strings and the request says which day is the person's today.
- Money is integer cents with a currency (INR by default); points are integers. Never floats.
- Statuses are constrained in code by `oneOf` against the lists in shared, not by database enums.
- Nothing financial is overwritten: `points_ledger`, `xp_events`, `orders`, `webhook_events`, `audit_logs`, `timeline_events`, `social_metrics` and `campaign_events` are append-only histories; a void or a refund writes the reverse.
- Sensitive data is separate and restricted: journal and wellbeing rows are read only by their owner; KYC keeps a hash and the last four digits; positions are rounded to three decimals and never returned; a chat partner's id never reaches the browser.
- Owner-scoped tables carry `user_id` or `owner_id` and every query filters by the session user.

## 2. Core and the game

- `users`: id, display_name, creator_type, xp, points, is_pro, leaderboard_opt_in, role, email (unique), phone, birth_date (both asked at sign-up, migration 0026; never shown to anyone else), password_hash, password_salt, handle (unique), bio, modules (JSON of the person's own switches), reminder_time, referral_code (unique), referred_by, permissions (JSON list), skills, categories, goals, experience_level, availability, location, open_to_intros, interests, city, area, lat, lng, timezone, avatar_url, socials_json, public_json, links_json, fee_bps, streak, best_streak, last_checkin, onboarded_at, created_at. Migration 0019 dropped `email_verified_at` with the magic links. There is no separate profile or creator-profile table; the columns live here.
- `sessions`: token, user_id, created_at.
- `relationship_scores`: user_id, relationship, score, xp. Seven rows per person, created at sign-up.
- `onboarding_answers`: id, user_id, question_id, relationship, value, points, created_at.
- `assessments` (migration 0029): id, user_id, kind, fears_json, insecurities_json, scores_json, real_day_json, focus_json, created_at. One per session run; the latest is the one that counts.
- `placements`: id, assessment_id, user_id, relationship (unique with the assessment), core_level, floor_level, core_band, floor_band, evidence, created_at. Levels are map values from 20 to 540; the flags (capped, required, volatile) are not stored but computed by `placementFlags` whenever they are read.
- `routines`: id, user_id, assessment_id, ramp_step, general_json, exceptional_json, practices_json, created_at.
- `contracts`: id, user_id, assessment_id, min_days, checkin_time, penalty, next_weekly, next_monthly, signed_name, signed_at.
- `routine_days`: user_id, day (primary key together), day_type, steps_json, done, updated_at. One row per person per local day; done only when every morning step is ticked.
- `nodes`: id, user_id, kind (pillar, principle, value_goal, outcome, project, task), parent_id, relationship, title, note, status, xp, due_date, due_time, estimate_min, ready_at, completed_at, sort_order, created_at, updated_at. The pyramid is a tree of nodes.
- `xp_events`: id, user_id, relationship, source, source_id, amount, created_at.
- `spark_completions`: user_id, date, relationship, created_at. The small act.
- `honors`: user_id, honor_key, note, awarded_at.
- `points_ledger`: id, user_id, amount, reason, ref, created_at. Reasons include checkin, streak, purchase, sale, bounty, run, feature, social, refund, admin.
- `redemptions`: id, user_id, reward_key, points, status (reserved, fulfilled, cancelled), note, created_at, updated_at.
- `not_to_do`: id, user_id, title, relationship, streak, best_streak, created_at. `not_to_do_days`: item_id, user_id, day, status (kept, slipped), created_at.
- `notifications`: id, user_id, kind, title, body, link, read_at, created_at.
- `support_tickets`: id, user_id, subject, body, status, reply, replied_by, created_at, updated_at.
- `password_resets`: id, user_id, token_hash, created_at, expires_at, used_at.
- `rate_limits`: key, window_start, count.
- `module_settings`: key, enabled, min_role, rollout. `flag_overrides`: id, flag_key, subject_type (user, role, organization), subject_id, enabled, expires_at, reason, created_by, created_at.
- `audit_logs`: id, actor_user_id, action, resource_type, resource_id, before_summary, after_summary, created_at. No IP.
- `analytics_events`: id, user_id, name (one of `TRACKED_EVENTS`), props_json, created_at.
- `timeline_events`: id, entity (order, booking, user, kyc), entity_id, type, data_json, created_at.
- `email_outbox`: id, user_id, to_email, subject, body, status, error, created_at, sent_at. Every mail, sent or not.
- `webhook_events`: id (the provider's event id, or a hash of the raw body), provider, type, payload (raw, up to 20,000 characters), processed_at, error, received_at.

## 3. Organizations, Army, Work

- `organizations`: id, name, type, status, created_by, created_at. `organization_members`: organization_id, user_id, role, status, created_at.
- `campaigns`: id, organization_id, owner_user_id, name, brief, budget_amount, currency, start_date, due_date, status, usage_rights, exclusivity_terms, brand_restrictions, public, created_at, updated_at.
- `campaign_deliverables`: id, campaign_id, title, format, platform, due_at, status, approved_at, final_url, created_at.
- `campaign_assignments`: id, campaign_id, creator_user_id, role, fee_amount, currency, status, terms_accepted_at, created_at. Unique (campaign_id, creator_user_id).
- `deliverable_versions`: id, deliverable_id, version_number, url, note, submitted_by, submitted_at, review_status.
- `feedback_items`: id, deliverable_version_id, author_user_id, comment, status, created_at.
- `campaign_events`: id, campaign_id, actor_user_id, event_type, note, created_at.
- `opportunities`: id, organization_id, created_by, title, description, opportunity_type, skills_required, location_mode, location_text, compensation_min, compensation_max, currency, deliverables, deadline, status, eligibility, club_only (migration 0027), featured, created_at, published_at, closed_at.
- `applications`: id, opportunity_id, creator_user_id, cover_note, portfolio_snapshot, status, submitted_at, updated_at, decision_at. Unique (opportunity_id, creator_user_id).
- `application_events`: id, application_id, actor_user_id, event_type, note, created_at.
- `portfolio_items`: id, user_id, title, description, url, visibility, created_at.

## 4. School

- `programs`: id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, featured, created_by, created_at.
- `cohorts`: id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at.
- `enrollments`: id, cohort_id, learner_user_id, status, payment_status, enrolled_at, completed_at. Unique (cohort_id, learner_user_id).
- `learning_items`: id, program_id, module_title, content_type, content_ref, body, sequence, published.
- `course_assignments`: id, program_id, title, instructions, rubric, due_days, sequence.
- `submissions`: id, assignment_id, cohort_id, learner_user_id, url, text, status, submitted_at, updated_at. Unique (assignment_id, cohort_id, learner_user_id).
- `submission_feedback`: id, submission_id, reviewer_user_id, comment, grade, created_at.
- `cohort_sessions`: id, cohort_id, title, starts_at, ends_at, online_url, created_at. `attendance`: session_id, user_id, status.

## 5. Party, Run, Club, Win, TV and Fund

- `events`: id, title, description, event_type, host_user_id, venue, online_url, timezone, starts_at, ends_at, capacity, price_points, visibility, status, featured, created_at.
- `event_registrations`: id, event_id, user_id, status, registered_at, checked_in_at, networking_opt_in. Unique (event_id, user_id). `event_feedback`: id, event_id, user_id, rating, comment, created_at. Unique (event_id, user_id).
- `run_clubs`: id, name, city, description, pace, meets, host_user_id, visibility, status, created_at. `run_members`: club_id, user_id, status, joined_at.
- `runs`: id, club_id, title, meeting_point, starts_at, ends_at, metres, code, collab_id, status, created_at. `run_entries`: id, run_id, club_id, user_id, metres, minutes, xp, points, status, logged_at. Unique (run_id, user_id).
- `run_collabs`: id, title, brand_name, organization_id, created_by, brief, asks, giveaway, giveaway_count, city, starts_at, ends_at, status, created_at. `run_collab_applications`: id, collab_id, club_id, user_id, note, status, created_at, decided_at. Unique (collab_id, club_id).
- `memberships`: id, user_id, membership_type, status, note, decision_note, approved_by, manager_user_id (a staff member, migration 0027), starts_at, ends_at, created_at. Unique (user_id, membership_type).
- `bounties`: id, created_by, organization_id, brand_name, title, brief, deliverable, budget_points, rate_per_thousand, max_payout_points, min_views, reward_rule, eligibility, platform, starts_at, ends_at, status, version, featured, created_at.
- `bounty_submissions`: id, bounty_id, user_id, url, platform, status, latest_views, latest_engagement, evidence_views, evidence_note, payout_points, reviewer_id, dispute_note, created_at, updated_at. Unique (bounty_id, user_id).
- `social_metrics`: id, submission_id, views, likes, comments, shares, source, note, recorded_by, fetched_at.
- `proposals`: id, kind (tv, fund), user_id, title, pitch, budget_amount, currency, stage, created_at, updated_at. `decision_log`: id, proposal_id, actor_user_id, from_stage, to_stage, note, created_at.

## 6. Community, Bond, Circles

- `community_posts`: id, user_id, category, body, product_id, hidden_at, hidden_by, created_at. `community_replies`: id, post_id, user_id, body, hidden_at, created_at. `community_likes`: post_id, user_id, created_at. `follows`: follower_id, owner_id, created_at.
- `friendships`: id, requester_id, recipient_id, status, created_at, answered_at. Unique (requester_id, recipient_id).
- `introductions`: id, requester_user_id, recipient_user_id, context, status, consent_at, created_at. `blocks`: blocker_id, blocked_id, reason, created_at.
- `bond_chats`: id, a_user_id, b_user_id, a_alias, b_alias, source, created_at, last_message_at. Unique (a_user_id, b_user_id). `bond_messages`: id, chat_id, user_id, body, created_at.
- `circle_events`: id, title, city, area, starts_at, venue_hint, group_size, status, repeat, series_id, created_by, created_at. `circle_signups`: event_id, user_id, note, status (the show-up answer, owner only), created_at. `circle_groups`: id, event_id, name, venue, plan, chat_opens_at, created_at. `circle_members`: group_id, user_id, alias, character, revealed (always 0; there is no reveal), status. `circle_messages`: id, group_id, user_id, body, created_at.

## 7. Wellbeing, Journal, Reviews, Companion, Life

- `wellbeing_logs`: id, user_id, kind (mood, sleep, stress, mindful, move), date, value, extra, note, created_at.
- `journal_entries`: id, user_id, title, body, emotion, stress, stressors, created_at, updated_at.
- `review_templates`: id, user_id, kind, name, prompts_json, created_at, updated_at. `reviews`: id, user_id, kind, period_start, period_end, template_id, template_name, prompts_json, answers_json, rating, highlight, snapshot_json, created_at, updated_at. Unique (user_id, kind, period_start).
- `chat_messages`: id, user_id, role, body, created_at. The Companion.
- Life has no table; it is computed from the rows above plus nodes, spark completions, finance and run entries.

## 8. Shop, growth, Store, Tools, Knowledge

- `products`: id, owner_id, kind, title, description, price_points, price_cents, currency, url, starts_at, duration_min, capacity, meeting_url, status, cover, sort_order, pwyw, intake_json, replay_url, replay_points, bundle_json, locked_body, response_days, lead_magnet, certificate, buffer_min, notice_hours, max_days_ahead, period_months, min_points, badge, created_at, updated_at.
- `lessons`: id, product_id, title, body, video_url, sort_order, drip_days, quiz_json, pass_score, created_at. `lesson_progress`: user_id, lesson_id, completed_at. `quiz_attempts`: user_id, lesson_id, score, passed, created_at. `certificates`: id, code, user_id, product_id, issued_at. Unique (user_id, product_id).
- `orders`: id, buyer_id, product_id, owner_id, points, cents, currency, status (pending, paid, failed, expired, refunded, or test when no provider is live), coupon_code, affiliate_code, source_link_id, click_id, platform_fee_points, intake_json, variant, expires_at, provider, provider_order_id, provider_payment_id, paid_at, refunded_at, refund_reason, created_at.
- `coupons`: id, owner_id, code, percent_off, product_id, max_uses, uses, expires_at, created_at. Unique (owner_id, code).
- `availability`: id, owner_id, weekday, start_min, end_min. `availability_overrides`: id, owner_id, date, ranges_json. Unique (owner_id, date).
- `bookings`: id, product_id, owner_id, buyer_id, order_id, starts_at, ends_at, status, meeting_url, note, intake_json, created_at. Unique (owner_id, starts_at).
- `leads`, `testimonials` (unique per product and author), `broadcasts`, `dm_requests` (the paid question), `page_events` (owner_id, kind, ref), `sequences`, `sequence_sends`.
- `content_items` (unique per owner and url), `tracked_links` (code), `link_clicks` (ip_hash, user_agent, referrer, country), `dm_automations`, `dm_sends` (unique per automation and recipient), `funnels`.
- `kyc_profiles`: user_id, status, legal_name, pan_last4, pan_hash, bank_last4, ifsc, address, note, submitted_at, decided_at, decided_by.
- `finance_transactions`: id, user_id, kind, amount_cents, currency, category, counterparty, splits_json, note, date, source, ref, created_at. `finance_dues`, `finance_recurring`, `finance_budgets` (user_id, category, monthly_cents), `finance_goals`. `invoices` (unique per user and number; a public token).
- `store_items`: id, title, category, description, price_cents, currency, url, image_url, stage, featured_until, status, min_points, badge, created_by, created_at, updated_at. `store_kits`: id, title, description, stage, budget_cents, currency, items_json, featured_until, status, created_by, created_at, updated_at.
- `preowned_listings`: id, seller_id, title, category, description, condition, price_cents, original_cents, currency, purchase_year, includes, images_json, is_kit, city, status, sold_cents, buyer_id, featured_until, created_at, updated_at. `preowned_offers`: id, listing_id, buyer_id, cents, note, status, created_at, decided_at. `preowned_messages`: id, listing_id, buyer_id, sender_id, body, created_at.
- `outbound_clicks`: id, kind (store, tool), target_id, ip_hash, user_agent, created_at.
- `tools`: id, name, category, url, description, affiliate, verified, suggested_by, featured_until, min_points, badge, created_at.
- `resources`: id, author_id, kind, title, summary, body, url, tags, published, created_at, updated_at.
- `brands` (migration 0028): id, owner_id, name, niche, description, voice, created_at, updated_at. `brand_sources`: id, brand_id, kind, url, label, summary, meta_json, last_read_at, created_at. `research_runs`: id, brand_id, kind, query, status, backend, items_json, error, created_at, finished_at. `brand_pieces`: id, brand_id, kind, title, brief, body, sources_json, writer, status, created_at, updated_at. Owner-scoped through the brand; in the export; deleted with the account.

## 9. Departures from the v0.1 model

- No `user_profiles`, `creator_profiles`, `roles` or `user_roles`: the columns are on `users`; roles are one column and permissions a JSON list.
- No `feature_flags` table with environments: `module_settings` is keyed by module key, plus `flag_overrides`.
- No `achievements` or `user_achievements`: badges are computed from counts by `computeBadges` in `db.ts` (never stored), honors are stored in `honors`.
- No `payment_transactions`, `ledger_entries` or `payout_requests`: `orders` carries the provider references, `points_ledger` is the points history, payouts of content rewards are rows on `bounty_submissions` plus the ledger, and bank payouts are a KYC profile reviewed by an admin.
- `knowledge_sources`, `ai_interactions` and `wellbeing_challenges` do not exist: no corpus, and Companion messages are plain rows.
- About sixty tables exist that v0.1 never named: the game, wellbeing, the shop, growth, finance, the store, circles, bond, run, reviews, not-to-do.

## 10. Retention and deletion

- Delete (needs the word DELETE): `users` is anonymised (name becomes "Deleted member"; email, phone, date of birth, password, handle, bio, avatar, socials, skills, categories, goals, interests, city, area, position, location, reminder and intro opt-in cleared); sessions, nodes, not-to-do, reviews and templates, pre-owned listings and offers, run entries and memberships, wellbeing logs, journal entries, companion messages, notifications, portfolio and KYC are deleted; hosted run clubs are closed. Orders, finance rows, ledger rows and audit rows stay for the books.
- Export: one JSON file with everything the person wrote, including the journal and the not-to-do list.
- Rate-limit rows reset by window. Webhook payloads and the outbox keep everything; no purge exists.
- Anything a brand, staff member, the leaderboard or Club selection can read never includes journal or wellbeing rows.

## Known gaps

- No purge for `webhook_events`, `email_outbox`, `analytics_events` or `link_clicks`.
- No written backup or restore procedure.
- `circle_members.revealed` is always 0 and could go.
