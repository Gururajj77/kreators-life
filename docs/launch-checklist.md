# kreators.app launch checklist

Worked from `plannerdocs/10_Legal_Policies.pdf` ("The App Launch Checklist", 35 checks in eight parts, research to October 2026).
That document is general information, not legal advice, and neither is this page. Ticking a line records that it was
considered and where the app does it; it is not proof of compliance. Never claim a certification, a SOC 2, a compliance
label, an uptime number or a customer logo in any copy.

Each line says where it lives in the code, or what a person still has to do. **Open** means a human step before launch.

## Before anything else: the business details (Open)

The business that runs kreators.app is never written in code. It is set as Worker variables and read from
`GET /public/business`; an empty field shows "not set yet" on every policy page, never an invented value.

- [ ] `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_EMAIL` (the legal name, a postal address, a contact inbox)
- [ ] `BUSINESS_REG` (CIN or company registration), `BUSINESS_VAT` (GSTIN, or a VAT number), if there are any
- [ ] `BUSINESS_GRIEVANCE_NAME`, `BUSINESS_GRIEVANCE_EMAIL` and, if wanted, `BUSINESS_GRIEVANCE_PHONE`: the Grievance Officer for people in India (DPDP Act 2023, IT Rules 2021). Shown on `/contact`, `/privacy`, `/copyright` and pointed to from the privacy popup; "not set yet" until set. **Open**
- [ ] Confirm how long money records must be kept under Indian tax and company law (the policy says seven years and "what the law asks where the business is registered" until then), and whether to state a reply time for privacy requests (none is stated now). **Open**
- [ ] `DMCA_AGENT`, `DMCA_ADDRESS`, `DMCA_EMAIL`, and `DMCA_REGISTERED` once the agent is registered (part 8)
- Set them with `pnpm cf:secret <NAME>` or as plain vars in `wrangler.jsonc`, then check `/contact`, `/terms`, `/privacy` and `/copyright` show them.

## Part 1. Legal documents and disclosures

- [x] 01 Privacy policy: `/privacy` (`site/Policy.tsx`), with the table of how long things are kept (`RETENTION` in shared).
- [x] 02 Terms of service: `/terms`.
- [x] 03 A box to accept them: `TermsBox`, unticked, beside the button on the sign-up page, the setup chat's account card and `AccountForm`; sign-up needs `acceptTerms: true`.
- [x] 04 Acceptance records: `recordAcceptance` writes one append-only row per document and version in `terms_acceptances` (migration 0059); `LEGAL_VERSION` in shared is the day the documents last changed; older accounts see the one-time notice (`POST /me/legal/accept`).
- [x] 05 Refund policy: `/refunds`.
- [ ] 06 Business contact details: `/contact` reads `GET /public/business`. **Open** until the variables above are set.

## India first: DPDP Act and rupee prices

- [x] Consent notice: `/privacy` is the notice, in English, with a DPDP ground for each use (consent, or a use the Act allows) beside the GDPR ground for the EU and UK.
- [x] Rights of the data principal: a summary of the data and who it was shared with (the export), correction, completion, updating and erasure (Profile), withdrawal as easy as consent (Profile, Privacy choices), grievance redressal and naming a nominee, then the Data Protection Board of India.
- [ ] Grievance Officer: the three `BUSINESS_GRIEVANCE_*` variables above. **Open**
- [x] India in `CONSENT_FIRST_COUNTRIES`, so `/go` sets `kl_click` in India only after a yes.
- [x] Prices in INR with GST shown: `PLANS` and `TOPUP_PACKS` in rupees, and `/pricing` and `/terms` say "Prices are in Indian rupees. GST is added where it applies and shown before you pay."

## Part 2. Consent, cookies and marketing

- [x] 07 Cookie choice: `ConsentPopup` (bottom left, once), the three choices in `CONSENT_PURPOSES`, all off to start; changed any time under Profile, Privacy choices, or the footer's "Privacy choices".
- [x] 08 Trackers off until consent: `/go` sets `kl_click` only outside `CONSENT_FIRST_COUNTRIES` or after a yes (`kc_attr=1`), never under Global Privacy Control; YouTube and Vimeo wait behind `EmbedGate`; web vitals skip Do Not Track and GPC.
- [x] 09 Separate marketing consent: its own choice, stored per person in `user_consents` with the append-only `consent_records` log.
- [x] 10 Unsubscribe: `sendEmail(..., { marketing: true })` sends only with a recorded yes, adds a one-click link and `List-Unsubscribe` headers (`/unsubscribe/:token`); receipts and resets are never marketing.

## Part 3. Handling personal data

- [x] 11 Collect only what is needed: no raw IP (a salted hash on `/go` and `/out`), no names in `data_requests`, nothing from the journal or wellbeing in logs, analytics or the leaderboard.
- [x] 12 Retention limits: `tidyOld` in cron.ts applies `RETENTION_DAYS` every run; the policy's table is `RETENTION`.
- [x] 13 Access and deletion: the export and delete under Profile cover every table that holds what a person wrote; each request is logged without a name in `data_requests`.
- [x] 14 Children: nobody under eighteen gets an account (`birthDateProblem`, `MIN_AGE` 18), so no parental-consent flow is needed. Revisit if that ever changes.
- [x] 15 No AI training on user data: the assistant reads the journal and trackers only for their owner and only through models that keep nothing (`private` in `ASSISTANT_MODELS`); Content sends only the brand's own folder.

## Part 4. Vendors and third parties

- [x] 16 Audit SDKs and tracking: no third-party analytics or ad SDK; fonts are self-hosted; the CSP (headers.ts and `public/_headers`) lists every outside origin (Razorpay, YouTube, Vimeo). A new origin needs a line in both and a run of `scripts/smoke/csp-browse.mjs`.
- [ ] 17 Data processing agreements: **Open.** Accept or sign the DPA of each processor on `/subprocessors` (Cloudflare, the email sender, Razorpay, the model host) and keep a copy.
- [x] 18 Subprocessor list: `/subprocessors` from `SUBPROCESSORS` in shared. Add a line there before a new processor goes live.

## Part 5. Accessibility (WCAG 2.2 AA)

- [x] 19 Colour contrast: the ink and fill tokens in app.css are tuned for 4.5:1; `scripts/smoke/contrast-probe.js` over every route in dark mode.
- [x] 20 Alt text: `scripts/scan.sh` fails on an `<img>` without `alt`.
- [x] 21 Keyboard: `SkipLink` first on every screen; every dialog uses `useDialogFocus` (focus in, Tab kept inside, Escape closes, focus returns); targets are 44px.

## Part 6. Fair design and pricing

- [x] 22 No dark patterns: sign-out, delete and cancel always ask once in plain words; nothing pre-ticked.
- [x] 23 No fake countdowns: every date shown is a real one (an event's start, a reward's end).
- [x] 24 No hidden fees: the store shows the full price; a partner link says "Partner link. Kreators may earn a share."; the platform fee is shown under Customers.
- [ ] 25 Auto-renewal disclosure: plans run for `PLAN_DAYS` and do not renew today (`PAYMENTS_LIVE` is off). **Open** the day renewal is built: say it beside the button and in the receipt.
- [ ] 26 Easy cancellation: **Open** with item 25; cancelling must be as short as starting.

## Part 7. Honest claims and transparency

- [x] 27 Unsupported claims: the public site claims only what the app does and never shows a made-up quote or number (CLAUDE.md rule).
- [x] 28 Fake reviews: no seeded reviews, quotes or data anywhere ("no demo or mock data").
- [x] 29 No SOC 2 or compliance claims in any copy.
- [x] 30 No uptime number is promised.
- [x] 31 No customer logos.
- [x] 32 AI content is labelled: every model reply says "Answered by" and the model's name; Content pieces carry their `writer`.

## Part 8. Intellectual property

- [x] 33 Image, font and code licences: the three fonts are self-hosted with their licences; the art is drawn in code; no Apple or other brand assets.
- [x] 34 Open-source obligations: `/licences` from `public/licences.json`, generated by `scripts/licences.mjs`. Run it again after adding a package.
- [ ] 35 DMCA agent: notices go to `copyright_notices` and the admins' inbox through `/copyright`. **Open:** register a designated agent with the US Copyright Office if US users are served, then set `DMCA_REGISTERED`.

## Final review before launch

- [ ] Set every Worker variable above and read `/contact`, `/terms`, `/privacy`, `/refunds`, `/copyright` and `/subprocessors` once on the live site.
- [ ] `bash scripts/check-exposed.sh <domain>` on the live domain.
- [ ] Install the secret check: `cp scripts/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` (done on the founder's machine on 2026-11-03).
- [ ] Ask a qualified professional to read the policies for the countries you launch in.
