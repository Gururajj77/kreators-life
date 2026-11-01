# 04 — Database and data dictionary

Last updated: 2026-11-01

**Product:** kreators.app
**Version:** 0.4, reconciled with the app on 1 November 2026
**Source of truth:** the 58 migrations in `apps/api/migrations`, applied in order with `pnpm db:migrate:local` or `pnpm db:migrate`. Applied to an empty database they make 177 tables. This doc lists every table and its columns as they stand after migration 0058 (which only moves data and adds no table). Types are omitted; `_at` columns are UTC ISO strings, `_cents` are integer cents, `_points` are integer points, `_json` is a JSON string. A migration index is at the end.

## 1. Principles as built

- Ids are random strings from `newId()`; sessions are two UUIDs; tokens at rest are SHA-256 hashes. The tokens in a link a person shares (a client link, an invoice, an agreement, the private calendar) are long random codes kept in the clear in their own row, because the link is the only key; a fresh link replaces the old one.
- Every time is a UTC ISO string. Zone conversion only through `zonedToUtc` and `slotsFor` in shared. Dates that mean "a day for a person" are `YYYY-MM-DD` strings, and the request says which day is the person's today (`?day=`, or a `date` in the body). Rows that count by the person's calendar keep that day beside the UTC time (`published_day` and `approved_day` on `agency_items`, `day` on `focus_rounds`, `agency_time` and `water_logs`).
- Money is integer cents with a currency (INR by default); points are integers; invoice GST and TDS are basis points (one percent is 100). Never floats.
- Statuses are constrained in code by `oneOf` against the lists in shared, not by database enums.
- Nothing financial is overwritten: `points_ledger`, `credit_ledger`, `xp_events`, `orders`, `webhook_events`, `audit_logs`, `timeline_events`, `social_metrics` and `campaign_events` are append-only histories; a void or a refund writes the reverse.
- Sensitive data is separate and restricted: journal, wellbeing, Companion, Discover and the water and reminder rows are read only by their owner; KYC keeps a hash and the last four digits; positions are rounded to three decimals and never returned; a chat partner's id never reaches the browser; an anonymous post or reply keeps the author's id for staff and shows everyone else a made-up name.
- Owner-scoped tables carry `user_id` or `owner_id` and every query filters by the session user. Section 12 says, group by group, who can read what, what the export holds, and what erase and delete do.
- The pyramid, the tasks and the sums that feed Reviews and Life are computed from these rows; nothing is stored twice except where a saved review keeps a snapshot of its numbers so a changed template or new data never rewrites it.

## 2. Core and the game

- `users`: id, display_name, creator_type, xp, points, is_pro, leaderboard_opt_in, role, email (unique), phone, birth_date (both asked at sign-up, migration 0026; never shown to anyone else), password_hash, password_salt, handle (unique, `user_xxxxxx` until changed), friend_code (unique, 8 characters), bio, modules (JSON of the person's own switches), reminder_time, referral_code (unique), referred_by, permissions (JSON list), skills, categories, goals, experience_level, availability, location, open_to_intros, interests, identities (JSON list of identity tags, migration 0030), intake_json (the setup chat's goals and what gets in the way), getting_started_hidden_at, city, area, lat, lng, timezone, avatar_url, socials_json, public_json, links_json, fee_bps, streak, best_streak, last_checkin, onboarded_at, created_at. Migration 0019 dropped `email_verified_at` with the magic links. There is no separate profile or creator-profile table; the columns live here.
- `sessions`: token, user_id, created_at. At most three per person (`MAX_DEVICES`); the fourth sign-in signs the oldest out. `session_evictions` (migration 0051): token, user_id, created_at, so a device that was pushed out can be told why; the cron clears rows older than thirty days.
- `password_resets`: id, user_id, token_hash, created_at, expires_at, used_at.
- `relationship_scores`: user_id, relationship, score, xp. Seven rows per person, created at sign-up.
- `onboarding_answers`: id, user_id, question_id, relationship, value, points, created_at.
- `assessments` (migration 0029): id, user_id, kind, fears_json, insecurities_json, scores_json, real_day_json, focus_json, created_at. One per session run; the latest is the one that counts.
- `placements`: id, assessment_id, user_id, relationship (unique with the assessment), core_level, floor_level, core_band, floor_band, evidence, created_at. Levels are map values from 20 to 540; the flags (capped, required, volatile) are not stored but computed by `placementFlags` whenever they are read.
- `routines`: id, user_id, assessment_id, ramp_step, general_json, exceptional_json, practices_json, created_at.
- `contracts`: id, user_id, assessment_id, min_days, checkin_time, penalty, next_weekly, next_monthly, signed_name, signed_at. The strategy session's contract with oneself, not an agreement with a client (those are `agency_contracts`).
- `routine_days`: user_id, day (primary key together), day_type, steps_json, done, updated_at. One row per person per local day; done only when every morning step is ticked.
- `xp_events`: id, user_id, relationship, source, source_id, amount, created_at.
- `spark_completions`: user_id, date, relationship, created_at. The small act.
- `honors`: user_id, honor_key, note, awarded_at. `badge_grants` (migration 0045): user_id, badge_key (primary key together), note, awarded_at. Badges a super admin gave by hand, on top of the ones `computeBadges` counts; they count for unlocks and the leaderboard and every grant is audited.
- `points_ledger`: id, user_id, amount, reason, ref, created_at. Reasons include checkin, streak, purchase, sale, bounty, run, feature, social, refund, admin.
- `redemptions`: id, user_id, reward_key, points, status (reserved, fulfilled, cancelled), note, created_at, updated_at.
- `not_to_do`: id, user_id, title, relationship, streak, best_streak, created_at. `not_to_do_days`: item_id, user_id, day, status (kept, slipped), created_at.
- `notifications`: id, user_id, kind, title, body, link, read_at, created_at, archived_at (migration 0035: archiving marks read; only an archived note can be deleted). A reminder's id is fixed (`task-<id>-<day>`, `review-<id>-<day>`, `water-<user>-<day>`), so it is sent once.
- `support_tickets`: id, user_id, subject, body, status, reply, replied_by, created_at, updated_at.
- `rate_limits`: key, window_start, count. The key is `<limit name>:<address or person>`.
- `module_settings`: key, enabled, min_role, rollout. `flag_overrides`: id, flag_key, subject_type (user, role, organization), subject_id, enabled, expires_at, reason, created_by, created_at.
- `audit_logs`: id, actor_user_id, action, resource_type, resource_id, before_summary, after_summary, created_at. No IP.
- `app_logs` (migration 0046): id, at, level, area, method, path, status, ms, actor_id, actor_name, message. One line per change anyone makes, per refusal, per failed request, per cron run that did something and per error a browser reports. Never a body or a query string; ids in the path are replaced; the person's own areas (journal, wellbeing, Companion, Discover, assistant) leave only a bare server-error line with no person and no path. Only a super admin reads it. The cron deletes lines older than thirty days, and a deleted account's name is wiped from them.
- `analytics_events`: id, user_id, name (one of `TRACKED_EVENTS`), props_json, created_at.
- `timeline_events`: id, entity (order, booking, user, kyc), entity_id, type, data_json, created_at.
- `email_outbox`: id, user_id, to_email, subject, body, status, error, created_at, sent_at. Every mail, sent or not.
- `webhook_events`: id (the provider's event id, or a hash of the raw body), provider, type, payload (raw, up to 20,000 characters), processed_at, error, received_at.

## 3. Daily: tasks, focus, reminders and the calendar

- `nodes`: id, user_id, kind (pillar, principle, value_goal, outcome, project, task), parent_id, relationship, title, note, status, xp, due_date, due_time, estimate_min, ready_at, completed_at, sort_order, created_at, updated_at, and, for tasks, added_by (a life coach's user id when a coach made it, migration 0034), do_date (the day to do it; the only date that holds a tick back, migration 0048), repeat_json (a `Repeat` rule: daily, weekdays, weekly on chosen weekdays, monthly, yearly, every N, an optional end day. For monthly and yearly rules it can also hold `anchor`, the first day the task was on, set by `spawnNext` so a task that fell on the 28th of a short month goes back to the 31st; it lives inside this JSON, so there is no column and no migration for it. `parseRepeat` drops an `until` or an `anchor` that is not a real calendar day), spawned_from (the task a repeat came from, so unticking takes the untouched child back), priority (0 to 3 for P0 to P3, null for none, migration 0049), remind (0 or 1: the Remember tag), origin (`build` for tasks the strategy session or the vibe check made from the pillars), for_review (0 or 1: brought to the review for its period, migration 0057). The pyramid is a tree of nodes.
- `subtasks` (migration 0049): id, user_id, task_id (cascades with the task), title, done_at, sort_order, created_at. A small checklist that pays nothing, up to twenty a task.
- `focus_rounds` (migration 0047): id, user_id, node_id, title (kept so the history survives the task being deleted), minutes, day, created_at, quality (1 to 5, or null; how focused the person said they were, migration 0056). Owner only; feeds the focus dashboard.
- `focus_prefs` (migration 0053): user_id, settings_json, updated_at. One row per person: the timer lengths and counts, what counts as mindful minutes, the sound switch, the break beats, the buzz, the background sound and its volume. Read and written through `parseFocusSettings`.
- `reminder_prefs` (migration 0039): user_id, water_on, water_goal_ml, water_glass_ml, water_every_min (120 or 240, `WATER_EVERY_CHOICES`; migration 0058 moved every shorter value to 120 and 121 to 239 to 240), water_from, water_to, last_water_at, updated_at. `water_logs`: id, user_id, day, ml, created_at. `custom_reminders`: id, user_id, title, time, days_json, enabled, last_sent_day, created_at. Owner only; water pays no xp. The reminders screen is computed, not stored: `GET /reminders` answers with the water state, the person's own reminders and `tasks`, the open tasks tagged Remember (`RememberedTask`: id, title, day = the do date or else the due date, time = `due_time`). Those come straight from `nodes` (`remind = 1`), so the Water and reminders box, the Daily tag and the inbox note are one thing and there is no table of remembered tasks.
- `calendar_feeds` (migration 0056): user_id, token (unique, 24 characters), enabled, created_at. The person's private calendar link. It exposes only a title, a pillar and a priority for each open task that has a day (and the time when it has one), and the person's scheduled reviews; never a note, the journal, a mood or a tracker.

## 4. Organizations, Army, Work

- `organizations`: id, name, type, status, created_by, created_at. `organization_members`: organization_id, user_id, role, status, created_at.
- `campaigns`: id, organization_id, owner_user_id, name, brief, budget_amount, currency, start_date, due_date, status, usage_rights, exclusivity_terms, brand_restrictions, public, created_at, updated_at.
- `campaign_deliverables`: id, campaign_id, title, format, platform, due_at, status, approved_at, final_url, created_at.
- `campaign_assignments`: id, campaign_id, creator_user_id, role, fee_amount, currency, status, terms_accepted_at, created_at. Unique (campaign_id, creator_user_id). A client in Agency can be served through a campaign the person has an accepted assignment on.
- `deliverable_versions`: id, deliverable_id, version_number, url, note, submitted_by, submitted_at, review_status. Agency's "send to Army" writes a row here through Army's own upload code.
- `feedback_items`: id, deliverable_version_id, author_user_id, comment, status, created_at.
- `campaign_events`: id, campaign_id, actor_user_id, event_type, note, created_at.
- `opportunities`: id, organization_id, created_by, title, description, opportunity_type, skills_required, location_mode, location_text, compensation_min, compensation_max, currency, deliverables, deadline, status, eligibility, club_only (migration 0027; listed, opened and applied to only by an approved, unexpired member), featured, created_at, published_at, closed_at.
- `applications`: id, opportunity_id, creator_user_id, cover_note, portfolio_snapshot, status, submitted_at, updated_at, decision_at. Unique (opportunity_id, creator_user_id).
- `application_events`: id, application_id, actor_user_id, event_type, note, created_at.
- `portfolio_items`: id, user_id, title, description, url, visibility, created_at.

## 5. School

- `programs`: id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, featured, created_by, created_at.
- `cohorts`: id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at.
- `enrollments`: id, cohort_id, learner_user_id, status, payment_status, enrolled_at, completed_at. Unique (cohort_id, learner_user_id).
- `learning_items`: id, program_id, module_title, content_type, content_ref, body, sequence, published.
- `course_assignments`: id, program_id, title, instructions, rubric, due_days, sequence.
- `submissions`: id, assignment_id, cohort_id, learner_user_id, url, text, status, submitted_at, updated_at. Unique (assignment_id, cohort_id, learner_user_id).
- `submission_feedback`: id, submission_id, reviewer_user_id, comment, grade, created_at.
- `cohort_sessions`: id, cohort_id, title, starts_at, ends_at, online_url, created_at. `attendance`: session_id, user_id, status, checked_in_at.
- Two real programs are seeded by migration 0016 (their lessons are rewritten from the skill files in `apps/web/public/resources`); the migration itself is their source.

## 6. Party, Run, Club, Win, TV and Fund

- `events`: id, title, description, event_type, host_user_id, venue, online_url, timezone, starts_at, ends_at, capacity, price_points, visibility, status, featured, created_at.
- `event_registrations`: id, event_id, user_id, status, registered_at, checked_in_at, networking_opt_in. Unique (event_id, user_id). `event_feedback`: id, event_id, user_id, rating, comment, created_at. Unique (event_id, user_id).
- `run_clubs`: id, name, city, description, pace, meets, host_user_id, visibility, status, created_at. `run_members`: club_id, user_id, status, joined_at.
- `runs`: id, club_id, title, meeting_point, starts_at, ends_at, metres, code, collab_id, status, created_at, xp (what each entry pays, set by the host, migration 0033). `run_entries`: id, run_id, club_id, user_id, metres, minutes, xp, points, status, logged_at. Unique (run_id, user_id).
- `run_collabs`: id, title, brand_name, organization_id, created_by, brief, asks, giveaway, giveaway_count, city, starts_at, ends_at, status, created_at. `run_collab_applications`: id, collab_id, club_id, user_id, note, status, created_at, decided_at. Unique (collab_id, club_id).
- `attendee_codes` (migration 0033): app, thing_id (primary key together; app is party or circles), code, xp, created_by, created_at, updated_at. `attendee_claims`: app, thing_id, user_id (primary key together), xp, created_at. The host sets the code and what it pays; a guest claims it once. Claims stay through an erase so a code cannot pay twice.
- `event_reminders` (migration 0035): app, thing_id, user_id, kind (day, hour), sent_at. One row per reminder sent, so none is sent twice.
- `event_photos` (migration 0037): app, event_id, url, note, set_by, updated_at (the host's photo-folder link). `event_messages`: id, app, event_id, user_id, body, created_at, removed_by, anonymous, parent_id, depth. `event_networking`: app, event_id, user_id, created_at (the guests who chose to be listed). Circles have none of these.
- `memberships`: id, user_id, membership_type, status, note, decision_note, approved_by, manager_user_id (a staff member, migration 0027), starts_at, ends_at, created_at. Unique (user_id, membership_type).
- `bounties`: id, created_by, organization_id, brand_name, title, brief, deliverable, budget_points, rate_per_thousand, max_payout_points, min_views, reward_rule, eligibility, platform, starts_at, ends_at, status, version, featured, created_at.
- `bounty_submissions`: id, bounty_id, user_id, url, platform, status, latest_views, latest_engagement, evidence_views, evidence_note, payout_points, reviewer_id, dispute_note, created_at, updated_at. Unique (bounty_id, user_id).
- `social_metrics`: id, submission_id, views, likes, comments, shares, source, note, recorded_by, fetched_at.
- `proposals`: id, kind (tv, fund), user_id, title, pitch, budget_amount, currency, stage, created_at, updated_at. `decision_log`: id, proposal_id, actor_user_id, from_stage, to_stage, note, created_at.

## 7. Community, Bond, Circles

- `community_posts`: id, user_id, category, body, product_id, hidden_at, hidden_by, created_at, pinned_at, pinned_by, held_at (a new member's first post waits for a guide when that is on), anonymous. `community_replies`: id, post_id, user_id, body, hidden_at, created_at, anonymous, parent_id, depth (replies thread to a depth of four). `community_likes`: post_id, user_id, created_at, kind (one of six reactions; the first is the like that pays). `follows`: follower_id, owner_id, created_at.
- `community_reply_reactions`: reply_id, user_id, kind, created_at (pay nothing). `community_post_follows`: post_id, user_id, created_at (a post's author and everyone who replies follow it). `community_settings`: key, value, updated_by, updated_at (for example `hold_first_posts`). `community_mutes`: user_id, muted_by, muter_rank, reason, created_at (a mute is by rank; lifting needs at least the muter's rank).
- `friendships`: id, requester_id, recipient_id, status, created_at, answered_at. Unique (requester_id, recipient_id).
- `introductions`: id, requester_user_id, recipient_user_id, context, status, consent_at, created_at. `blocks`: blocker_id, blocked_id, reason, created_at (anyone blocks anyone; it ends a friendship and hides posts, replies, event lines and leaderboard rows both ways).
- `bond_chats`: id, a_user_id, b_user_id, a_alias, b_alias, source, created_at, last_message_at. Unique (a_user_id, b_user_id). `bond_messages`: id, chat_id, user_id, body, created_at.
- `circle_events`: id, title, city, area, starts_at, venue_hint, group_size, status, repeat, series_id, created_by, created_at. `circle_signups`: event_id, user_id, note, status (the show-up answer, owner only), created_at. `circle_groups`: id, event_id, name, venue, plan, chat_opens_at, created_at. `circle_members`: group_id, user_id, alias, character, revealed (always 0; there is no reveal), status. `circle_messages`: id, group_id, user_id, body, created_at.
- `seasons`: season, closed_at. `season_results`: season, place (primary key together), user_id, xp (migration 0035: the top three of a closed month on the leaderboard, who get the `season_top` honor).

## 8. Wellbeing, Journal, Reviews, Companion, Life

- `wellbeing_logs`: id, user_id, kind (mood, sleep, stress, mindful, move), date, value, extra, note, created_at. A finished focus session (and a finished break, when switched on) is a `mindful` row with `extra.kind`.
- `journal_entries`: id, user_id, title, body, emotion, stress, stressors, created_at, updated_at.
- `review_templates`: id, user_id, kind, name, prompts_json, created_at, updated_at. `reviews`: id, user_id, kind, period_start, period_end, template_id, template_name, prompts_json, answers_json, rating, highlight, snapshot_json (the numbers as they were, and the tasks brought to it), created_at, updated_at. Unique (user_id, kind, period_start).
- `review_schedules` (migration 0057): id, user_id, kind (week, month, quarter, half), name, anchor (the first day), time (HH:MM in the person's zone), repeat_json (the same `Repeat` rule a task uses, or null for once), enabled, next_on (the next day the reminder falls on, so the cron only looks at what is due), created_at. Up to twenty a person. Owner only.
- `kpi_prefs` (migration 0054): user_id, enabled, updated_at. The switch on the Reviews page; off until the person turns it on, and the server refuses every business-metrics route while it is off. `kpis`: id, user_id, name, unit (number, money, percent, hours), direction (up, down), cadence (week, month, quarter, half), target, source (`manual`, or one of published, first_pass, on_time, hours, utilisation, invoiced, paid, new_clients, read from Agency), created_at. `kpi_values`: kpi_id, period_start (primary key together), value, note, updated_at. Money is cents and hours are minutes. Up to twelve metrics.
- `chat_messages`: id, user_id, role, body, created_at. The Companion.
- Life has no table; it is computed from the rows above plus nodes, spark completions, finance and run entries.

## 9. Shop, growth, Store, Tools, Knowledge

- `products`: id, owner_id, kind, title, description, price_points, price_cents, currency, url, starts_at, duration_min, capacity, meeting_url, status, cover, sort_order, pwyw, intake_json, replay_url, replay_points, bundle_json, locked_body, response_days, lead_magnet, certificate, buffer_min, notice_hours, max_days_ahead, period_months, min_points, badge, min_xp (an xp floor beside the points floor and the badge, migration 0044), faq_json (up to six questions and answers written by the creator, migration 0052), created_at, updated_at. `status` is draft, live or archived. Deleting a product that has orders archives it instead of removing the row, so paid orders and the buyers' access stay; one with no orders is deleted.
- `lessons`: id, product_id, title, body, video_url, sort_order, drip_days, quiz_json, pass_score, created_at. `lesson_progress`: user_id, lesson_id, completed_at. `quiz_attempts`: user_id, lesson_id, score, passed, created_at. `certificates`: id, code, user_id, product_id, issued_at. Unique (user_id, product_id).
- `orders`: id, buyer_id, product_id, owner_id, points, cents, currency, status (pending, paid, failed, expired, refunded, or test when no provider is live), coupon_code, affiliate_code, source_link_id, click_id, platform_fee_points, intake_json, variant, expires_at, provider, provider_order_id, provider_payment_id, paid_at, refunded_at, refund_reason, created_at.
- `coupons`: id, owner_id, code, percent_off, product_id, max_uses, uses, expires_at, created_at. Unique (owner_id, code).
- `availability`: id, owner_id, weekday, start_min, end_min. `availability_overrides`: id, owner_id, date, ranges_json. Unique (owner_id, date).
- `bookings`: id, product_id, owner_id, buyer_id, order_id, starts_at, ends_at, status, meeting_url, note, intake_json, created_at. Unique (owner_id, starts_at).
- `leads`, `testimonials` (unique per product and author), `broadcasts`, `dm_requests` (the paid question), `page_events` (owner_id, kind, ref), `sequences`, `sequence_sends`.
- `content_items` (unique per owner and url), `tracked_links` (code), `link_clicks` (ip_hash, user_agent, referrer, country), `dm_automations`, `dm_sends` (unique per automation and recipient), `funnels`.
- `kyc_profiles`: user_id, status, legal_name, pan_last4, pan_hash, bank_last4, ifsc, address, note, submitted_at, decided_at, decided_by.
- `finance_transactions`: id, user_id, kind, amount_cents, currency, category, counterparty, splits_json, note, date, source, ref, created_at. `finance_dues`, `finance_recurring`, `finance_budgets` (user_id, category, monthly_cents), `finance_goals`.
- `invoices`: id, user_id, number (unique per user), client_name, client_email, items_json, total_cents, currency, status (draft, sent, paid, void), issue_date, due_date, note, token (the public link), paid_at, created_at, and, for invoices made in Agency (migration 0054): agency_client_id, doc_json (the designed invoice: title, both parties, bank, look, discount, GST and a CGST and SGST split, TDS added or shown, footnote and footer, and a switch for each thing the client may see), revised_at (when it was last changed after the client could see it). `total_cents` is always the invoice calculator's answer (`invoiceTotals` in shared).
- `store_items`: id, title, category, description, price_cents, currency, url, image_url, stage, featured_until, status, min_points, badge, min_xp, created_by, created_at, updated_at. `store_kits`: id, title, description, stage, budget_cents, currency, items_json, featured_until, status, created_by, created_at, updated_at.
- `preowned_listings`: id, seller_id, title, category, description, condition, price_cents, original_cents, currency, purchase_year, includes, images_json, is_kit, city, status, sold_cents, buyer_id, featured_until, created_at, updated_at. `preowned_offers`: id, listing_id, buyer_id, cents, note, status, created_at, decided_at. `preowned_messages`: id, listing_id, buyer_id, sender_id, body, created_at.
- `outbound_clicks`: id, kind (store, tool), target_id, ip_hash, user_agent, created_at.
- `tools`: id, name, category, url, description, affiliate, verified, suggested_by, featured_until, min_points, badge, min_xp, created_at.
- `resources`: id, author_id, kind, title, summary, body, url, tags, published, created_at, updated_at.
- `media_files` (migration 0037): id, owner_id, mime, size, data (base64, up to 1 MB), created_at. `media_items`: id, owner_type, owner_id, kind (picture, GIF, video link), url, caption, position, added_by, created_at. Pictures and GIFs on listings and lessons; a video is only ever a link.
- `brands` (migration 0028): id, owner_id, name, niche, description, voice, created_at, updated_at. `brand_sources`: id, brand_id, kind, url, label, summary, meta_json, last_read_at, created_at. `research_runs`: id, brand_id, kind, query, status, backend, items_json, error, created_at, finished_at. `brand_pieces`: id, brand_id, kind, title, brief, body, sources_json, writer, status, created_at, updated_at. Owner-scoped through the brand; in the export; deleted with the account.

## 10. Agency

All of these are owner only, filter by `user_id`, are in the export and go with the account. Nothing here is shown to a brand, to staff or to the leaderboard; what a client sees at a link is chosen by the owner and removed on the server before it is sent.

- `agency_settings` (migration 0054): user_id, currency, weekly_hours (the hours a week used for utilisation), profile_json (the person's own business profile: who invoices come from, tax numbers, the bank, the look, GST and TDS defaults, an invoice prefix, days to pay, the signer and the courts for agreements), updated_at. Their own bank and tax numbers live only here, never in code.
- `agency_clients`: id, user_id, name, contact_name, contact_email, status (lead, active, paused, ended), health (green, amber, red), channels_json, retainer_cents, pieces_per_month, hours_per_month, renewal_date, notes, campaign_id (an Army campaign the person is a creator on), billing_json (what goes under "Billed to"), portal_token (the client link, unique; null while it is off), portal_json (a switch for each part the client may see and each thing they may do), created_at, updated_at. Up to sixty a person.
- `agency_items` (the deliverables): id, user_id, client_id, title, kind (video, short, post, carousel, newsletter, blog, script, thumbnail, podcast, other), platform, stage (idea, script, making, review, approved, published), due_date, publish_date, link (https only), notes (private), army_deliverable_id, fee_cents (never at the client link), revisions (times it was sent back), approved_at, published_at, approved_day, published_day (the person's own days), created_at, updated_at. Up to two thousand a person.
- `agency_notes`: id, user_id, item_id, author (me, client, brand), shared, body, created_at. The thread on a deliverable. A person's own note is private unless shared; a client's comes in through the link; a brand's comes back from Army.
- `agency_time`: id, user_id, client_id, item_id, day, minutes, billable, note, created_at.
- `agency_contracts`: id, user_id, client_id, title, template_key, status (draft, sent, signed, void), doc_json (the agreement as sections: text, packages, a brief, signatures), token (the client's link, null unless sent), answers_json (the client's answers, only to questions the agreement asks and options it offered), acceptance_json (the typed name and title, and when; not a certified e-signature), sent_at, signed_at, revised_at, created_at, updated_at.
- `agency_doc_comments`: id, user_id, doc_type (invoice, contract), doc_id, author (me, client), body, created_at. Comments asking for a change, for an invoice or an agreement; deleted with the document.
- `agency_templates` (migration 0055): id, user_id, kind (invoice, contract), name, doc_json, items_json, created_at, updated_at. Up to thirty of each kind. An invoice template keeps the look, sender, bank, GST, TDS and lines but never who it was billed to; an agreement template keeps the sections but not the names filled in.
- The business metrics tables (`kpi_prefs`, `kpis`, `kpi_values`) are in section 8, beside Reviews.

## 11. Assistant, credits and coaching

- `assistant_actions` (migration 0031): id, user_id, tool, label, status (pending, done, failed, undone, cancelled), args_json (ids only; kept until a pending one runs), undo_json, refresh_json, error, created_at, updated_at. It keeps tool names, ids and plain labels, never journal text or a log's note. `assistant_runs` (migration 0032): id, user_id, stopped_at, created_at; a row lives only while a message runs, for the Stop button.
- `credit_accounts`: user_id, plan, plan_started_at, plan_until, plan_credits (they do not carry over), extra_credits (top-ups and team grants, kept until used), updated_at. `credit_ledger`: id, user_id, bucket (plan, extra), amount, reason, agent, model, input_tokens, output_tokens, note, actor_id, created_at. Every grant, every use and every expiry is a row; it stays through an erase and after a delete, for the books.
- `coach_links` (migration 0034): id, coach_id, student_id, status, asked_by, created_by, share_json (five switches the student sets), created_at, answered_at, ended_at, ended_by. One open link per pair. `coach_notes`: id, link_id, coach_id, student_id, body, created_at. `coach_log`: id, link_id, coach_id, student_id, actor_id, action, label, target_id, before_json, after_json, created_at (every ask, answer, end, share change, note and task change). `coach_profiles`: user_id, about, open, asked_at, updated_at. The permission itself is on `users.permissions`.

## 12. Discover, games and the rest

- `discover_drafts` (migration 0041): user_id, answers_json, updated_at. `discover_results`: id, user_id, answers_json, result_json, created_at (each finished quiz keeps its answers and result, so a changed algorithm never rewrites an old one). `discover_settings` (migration 0043): user_id, steps (next steps, on by default), assistant (off until the person says), updated_at, mind (the "how your mind works" switch, off until the person says, migration 0050). `discover_extras` (migration 0050): user_id, kind (type, love, mind, design), draft_json, answers_json, result_json, taken_at, updated_at; one row per person and kind. All owner only, like the journal.
- `card_unlocks` (migration 0040): user_id, game_key (primary key together), redemption_id, unlocked_at. `card_games` (migration 0042): game_key, how_to, special_json, special_note, rules_json. `card_decks`: game_key, deck_key, name, hint, position. `cards`: game_key, deck_key, position, title, label, text, list_json, alt_label, alt_text. The card text is served only to a person who unlocked the game or to the team; names, prices and pictures are public and stay in code. The text was seeded once, and the applied migration is its source. Unlocks stay through an erase.

## 13. Who can read what, and what erase, delete and export do

| Group | Tables | Who can read | In the export | Erase ("start over") | Delete account |
|---|---|---|---|---|---|
| The person's own private rows | `journal_entries`, `wellbeing_logs`, `chat_messages`, `water_logs`, `reminder_prefs`, `custom_reminders`, `discover_*`, `not_to_do`, `focus_rounds`, `focus_prefs` | the owner only (Discover and the journal reach the assistant only as a short summary, only for a model that keeps nothing, and only while the owner's switch is on) | yes (the quiz drafts, settings, results and add-ons too) | the journal, wellbeing, water and reminder rows stay; focus rounds, the Discover rows and the not-to-do list are cleared | all deleted |
| Pyramids and the strategy session | `nodes`, `subtasks`, `assessments`, `placements`, `routines`, `contracts`, `routine_days`, `onboarding_answers` | the owner; a life coach sees only what the student shares per link, never the journal | yes (all but `onboarding_answers`) | cleared | deleted (except `onboarding_answers`, which stay with the anonymised account) |
| Reviews | `reviews`, `review_templates`, `review_schedules`, `kpi_*` | the owner only | yes | `reviews` cleared; templates, schedules and business metrics stay | deleted |
| Agency | `agency_*`, `invoices` made in Agency | the owner; a client sees only what the link allows | yes | stays (business records, not progress) | deleted; each invoice stays for the books with its total, and loses who it was for, its lines, its notes, its design (bank and tax numbers) and its link |
| Calendar link | `calendar_feeds` | the owner (the link holder reads the file) | yes, without the secret | stays | deleted |
| Money | `orders`, `bookings`, `finance_*`, `points_ledger`, `credit_*`, `kyc_profiles` | the people in the order; finance staff for payouts; the owner for their own books | orders, bookings, finance, invoices, points and credits yes | the points ledger is cleared; a plan and its credits stay | orders, finance, ledger and audit rows stay for the books; `kyc_profiles` is deleted |
| Game and rank | `xp_events`, `spark_completions`, `relationship_scores`, `honors`, `badge_grants`, `card_unlocks`, `attendee_claims`, `run_entries` | the owner; the leaderboard shows opted-in people only | badges, unlocks, claims and run entries yes | xp, sparks and scores cleared; honors, badge grants, unlocks, claims and run entries stay (so a code or a run cannot pay twice) | badges, unlocks, claims and run entries deleted |
| Social | `community_*`, `friendships`, `bond_*`, `circle_*`, `event_*`, `blocks`, `follows` | per feature; anonymous authors are shown a made-up name | the person's own event lines and networking choices, blocks, post follows and reply reactions | stays | the person's own lines and blocks are deleted; posts and replies remain under "Deleted member" |
| Coaching | `coach_*` | both sides of a link, as the student shares | links, notes, log and profile yes | stays (a coach is a person, not progress) | ended, notes and log deleted |
| Assistant | `assistant_actions`, `assistant_runs` | the owner | actions yes | cleared | deleted |
| Operations | `app_logs`, `audit_logs`, `email_outbox`, `webhook_events`, `analytics_events`, `link_clicks` | super admin (logs); staff with the permission | no | not touched | `app_logs` lose the name; the rest stay |

The export (`GET /me/export`) is one JSON file; the keys are the groups above (`nodes`, `subtasks`, `wellbeing`, `journal`, `orders`, `bookings`, `finance`, `invoices`, `points`, `notifications`, `notToDo`, `reviews`, `reviewTemplates`, `reviewSchedules`, `assessments`, `brands`, `assistantActions`, `creditLedger`, `focusRounds`, `focusPrefs`, `discover*`, `coach*`, `waterLogs`, `customReminders`, `calendarFeed`, `agency*`, `kpis` and the rest).

## 14. Departures from the v0.1 model

- No `user_profiles`, `creator_profiles`, `roles` or `user_roles`: the columns are on `users`; roles are one column and permissions a JSON list.
- No `feature_flags` table with environments: `module_settings` is keyed by module key, plus `flag_overrides`.
- No `achievements` or `user_achievements`: badges are computed from counts by `computeBadges` in `db.ts` (never stored), honors and by-hand badges are stored in `honors` and `badge_grants`.
- No `payment_transactions`, `ledger_entries` or `payout_requests`: `orders` carries the provider references, `points_ledger` is the points history, payouts of content rewards are rows on `bounty_submissions` plus the ledger, and bank payouts are a KYC profile reviewed by an admin.
- `knowledge_sources`, `ai_interactions` and `wellbeing_challenges` do not exist: no corpus, Companion messages are plain rows, and the assistant keeps tool names and ids only.
- Well over a hundred tables exist that v0.1 never named: the game, wellbeing, the shop, growth, finance, the store, circles, bond, run, reviews, not-to-do, the assistant, coaching, Discover, card games, media and Agency.
- There is no table for Life, Home, Search or the leaderboard: they are computed.

## 15. Retention and deletion

- Delete (needs the word DELETE; an admin can do the same for a member from People, never for an admin or for themselves): `users` is anonymised (name becomes "Deleted member"; email, phone, date of birth, password, handle, friend code, bio, avatar, socials, skills, categories, goals, interests, identity tags, intake, city, area, position, location, reminder, intro opt-in, leaderboard opt-in and permissions cleared). Deleted: sessions and evictions, nodes and subtasks, not-to-do, reviews, templates and schedules, water and reminders, focus rounds and settings, the calendar link, every Agency table and every business metric (the invoices stay for the books, scrubbed as in section 13), pre-owned listings and offers, run entries and memberships, wellbeing logs, journal entries, companion messages, notifications, portfolio, KYC, the strategy session's rows, the content strategist's folders, what the assistant did, attendee claims, card unlocks, badge grants, Discover rows, the person's side of coaching, post follows and reply reactions, event reminders, uploaded files and the media they added, their event lines and networking choices, their blocks and mutes. Hosted run clubs are closed and the person's products are archived. Orders, finance rows, ledger rows (points and credits) and audit rows stay for the books.
- Erase ("start over", `POST /me/reset`): clears progress only, as in section 13. Never touched: Agency and every invoice, orders, a plan and its credits, unlocked card games, attendee claims, run entries, a life coach's links and notes, the journal and wellbeing logs, water and reminders, review templates and schedules, business metrics and the calendar link.
- Export: one JSON file with most of what the person wrote, including the journal and the not-to-do list. It does not hold everything yet (see Known gaps).
- Purges that exist: `app_logs` and `session_evictions` after thirty days (the cron), `password_resets` by expiry, `assistant_runs` rows only live while a message runs, and rate-limit rows reset by window.
- Purges that do not: `webhook_events` payloads, `email_outbox`, `analytics_events` and `link_clicks` keep everything.
- Anything a brand, staff member, the leaderboard or Club selection can read never includes journal, wellbeing or Discover rows.

## Known gaps

- No purge for `webhook_events`, `email_outbox`, `analytics_events` or `link_clicks`.
- No written backup or restore procedure.
- `circle_members.revealed` is always 0 and could go.
- `onboarding_answers`, `xp_events`, `spark_completions`, `relationship_scores` and `honors` are not removed when an account is deleted; they stay attached to the anonymised row.
- Erase leaves a coach's links and notes by design; a person who wants them gone must end the link or delete the account.
- Reported in the 2026-11-01 bug sweep and not changed (each needs a decision):
  - Deleting an account leaves Bond and circle messages, support tickets, introductions, applications, finance dues, goals and budgets, `email_outbox.to_email`, and the client details of invoices that were not made in Agency.
  - The export (`GET /me/export`) leaves out Companion messages (`chat_messages`), `portfolio_items`, `kyc_profiles`, `community_mutes`, `event_reminders`, posts and replies, Bond messages, support tickets, finance dues, goals and budgets, `xp_events` and `relationship_scores`.
  - Media uploads can never be deleted (a person is capped at 60).

## Migration index

| No. | File | What it adds |
|---|---|---|
| 0001 | init | users, sessions, relationship scores, onboarding answers, nodes (the pyramid), xp events, small acts |
| 0002 | evolution_points_honors | honors, the points ledger, redemptions |
| 0003 | task_ready_at | when a task can first be ticked |
| 0004 | super_app | module settings, wellbeing logs, journal, notifications, resources, Community, Companion, products, lessons, orders, coupons, availability, bookings, leads, testimonials, broadcasts, page events |
| 0005 | seed_resources | the Knowledge resources |
| 0006 | blueprint | flag overrides, audit log, organizations, Army, School, Work, Party, Club, Win bounties, introductions, tools, proposals |
| 0007 | listings | social metrics, featured listings |
| 0008 | commerce | quiz attempts, certificates, paid questions, content items, tracked links, Auto-DM, funnels, sequences, webhook events |
| 0009 | time_finance | task time and estimate; Finance transactions, invoices, budgets |
| 0010 | money | dues, recurring entries, goals, splits |
| 0011 | circles_life | interests and place; Circles |
| 0012 | parity | booking zones and overrides, KYC, email outbox, timeline, analytics, rate limits |
| 0013 | circles_weekly | repeating Circles, how a person shows up |
| 0014 | bond | friendships, alias chats |
| 0015 | public | what a person shows on their page |
| 0016 | school_programs | the two real School programs |
| 0017 | links | link blocks on the public page |
| 0018 | magic_links | magic-link tokens (dropped again in 0019) |
| 0019 | drop_magic_links | removes the magic links |
| 0020 | password_resets | one-time reset links |
| 0021 | not_to_do | the not-to-do list and its days |
| 0022 | reviews | review templates and reviews |
| 0023 | store | the Store: items, kits, pre-owned listings, offers, messages, outbound clicks |
| 0024 | unlocks | points floor and badge on products, items and tools |
| 0025 | run | run clubs, runs, entries, collabs |
| 0026 | signup_fields | phone and date of birth (minimum age 18) |
| 0027 | club_benefits | club-only Work listings, a named manager |
| 0028 | content_strategist | brands, sources, research runs, pieces |
| 0029 | strategy_session | assessments, placements, routines, contracts, routine days |
| 0030 | setup | identity tags and the setup chat's intake |
| 0031 | assistant | assistant actions, credit accounts and ledger |
| 0032 | assistant_runs | the Stop button |
| 0033 | attendee_codes | event codes and claims, xp on runs |
| 0034 | coaching | coach links, notes, log, profiles; who added a task |
| 0035 | engagement | reactions, post follows, pins, held posts, community settings, inbox archive, event reminders, seasons, getting-started fold |
| 0036 | friend_codes | friend codes |
| 0037 | media_connect | media files and items, event photos, event lines, networking, mutes |
| 0038 | anonymous_threads | anonymous posts and replies, threaded replies and event lines |
| 0039 | water_reminders | reminder preferences, water logs, custom reminders |
| 0040 | card_games | card unlocks |
| 0041 | discover | Discover drafts and results |
| 0042 | card_content | the card games' text |
| 0043 | discover_settings | next steps and assistant switches |
| 0044 | unlock_xp | an xp floor on products, items and tools |
| 0045 | badge_grants | badges given by hand |
| 0046 | app_logs | the app's own log |
| 0047 | focus_rounds | finished focus rounds |
| 0048 | task_dates_repeat | do date, repeat, spawned from |
| 0049 | task_priority_remind | priority, Remember, origin, subtasks |
| 0050 | discover_extras | the Discover add-ons and the mind switch |
| 0051 | session_evictions | the three-device cap |
| 0052 | product_faq | a product's questions and answers |
| 0053 | focus_prefs | timer settings on the account |
| 0054 | agency | Agency, the designed invoice, agreements, comments, business metrics |
| 0055 | agency_templates | the person's own invoice and agreement templates |
| 0056 | focus_quality_calendar | the focus rating, the private calendar link |
| 0057 | review_schedules | scheduled reviews and the task flag for the review |
| 0058 | water_every_two_hours | moves water gaps shorter than two hours to two, and the ones between to four; no new table |

## What changed since this was written

- 2026-11-01: reconciled from 0.3 (26 October, 28 migrations, about 110 tables) to 57 migrations and 177 tables. New groups: the strategy session and setup chat (0029, 0030), the assistant and credits (0031, 0032), attendee codes (0033), coaching (0034), engagement, seasons and inbox archive (0035), friend codes (0036), media and event extras (0037), anonymous and threaded conversations (0038), water and reminders (0039), card games and their text (0040, 0042), Discover, its settings and add-ons (0041, 0043, 0050), xp floors and badge grants (0044, 0045), the app's own log (0046), focus rounds, settings and quality (0047, 0053, 0056), task dates, repeat, priority, Remember, subtasks and the review flag (0048, 0049, 0057), the device cap (0051), product questions (0052), Agency, templates and business metrics (0054, 0055), the private calendar link (0056) and scheduled reviews (0057).
- 2026-11-01: added the access table (13) and the migration index; retention and deletion now follow `account.ts` and `POST /me/reset` line by line.
- 2026-11-01 (later): migration 0058 (water gaps; no table) takes the count to 58 migrations, still 177 tables. No table or column was added by the bug sweep: the monthly and yearly repeat `anchor` lives inside `nodes.repeat_json`; the Water and reminders box's new "Tasks from Daily" list is read from `nodes`; a sold product is archived (`products.status`) instead of deleted. The reported-but-not-changed gaps about delete and export are under Known gaps.
