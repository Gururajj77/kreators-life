# 06 — Design system and UX

**Product:** kreators.app
**Version:** 0.3, reconciled with the app on 26 October 2026
**Source of truth:** the design rules in `CLAUDE.md`; `design/figma-tokens.json` (the freud UI Kit v1.5 values, frozen); the `@theme` block in `apps/web/src/app.css`; `apps/web/src/components`; `bash scripts/scan.sh`; `python3 -I scripts/flesch.py`.

## 1. Experience goal

One coherent product, not a directory of microsites. Every screen is built from the same few parts, every tappable thing lifts the same way, every app explains itself the same way at the bottom of its screen, and the whole thing reads like the kit it came from. Results first, then what did it, then the one thing to do next.

## 2. Information architecture as built

- **Phone:** one column, five tabs along the bottom: Home, Daily, Pillars, Apps, Profile. The top-right corner holds two floating buttons, theme on the left and an apps menu on the right (a `Sheet` listing the sidebar's groups). The first header of every screen starts 64px down to clear them. A phone on its side keeps the phone layout (`md` and `lg` need 480px of height as well as width).
- **Laptop:** the tabs become a sidebar. The role badge and the theme button sit at the top beside the logo. Enabled apps are listed under their group as collapsible headings that start folded; only the group of the app you are inside opens. Sign out is in the footer. Beside the sidebar the column is `md:w-auto`.
- **Groups and their names:** Contribution (School, Work, Army, Win), Creation (Public page, Shop, Store, Audience, Content, Auto-DM, Finance, My purchases, Knowledge, Tools, TV, Fund), Connection (Party, Kreators Run, Community, Club, Bond, Circles), Reflection (Life, Wellbeing, Mood, Sleep, Stress, Mindful minutes, Journal, Reviews, Companion), Essentials (Home, Daily, Pillars, Search, Inbox, Help), Operations (Manage, Admin), Internal (Observability; staff and admins only). Each group wears a relationship colour (`MODULE_GROUP_ACCENT`).
- **Apps page:** a grouped list, each group in its colour with its character. An app that is on opens on tap; an app that is off is grey and tapping it opens a sheet that asks before switching it on. Switching off lives only under Profile, Features. Rank and Rewards are part of the game and live under Profile, not apps.
- **Every app screen** opens with `BackLink`, which pops one history entry when the tab has one and otherwise goes up to its parent. `Root` renders `ScrollRestoration`, so a new page starts at the top and Back returns where you were. Screen state that must survive Back lives in the URL through `useParamState` (Community's category, sort and filter; the Store's category, stage and budget; Run's tab).
- **Search** is inline (`SearchBox`): apps and help from the client, everything else from `GET /search`, grouped under the field as you type, never a new page. Its border lights on focus; white on a dark header.
- **Dark mode** keeps the seven hues and turns the surfaces inside out; each app's pages take a deep shade of its relationship's hue (`data-accent` on the document, set by `Gate`). The theme switch (device, light, dark) is on every page including onboarding.

## 3. Home and dashboards

Home is the landing screen and the one dashboard, in one call (`GET /home`). It follows the kit's Home frame: a dark header with the date, the character, the greeting and three pills (level, streak, today's mood) over a search field; a scrolling row of coloured metric cards; four solid stat tiles (streak, xp today, points, level); the day's three boxes as a green card with the guidance line (`nudgeFor`, which always names the next box and what it will not work without); tracker rows with a small visual each; "Up next"; the Companion card; two Knowledge cards; the game's own views; the "By period" panel; and the grid of shortcuts into every app that is on.

The v0.1 warning against vanity scores stands, with this reading: the game's numbers are its results and come first on purpose; every card under them is an action. Numbers come before actions on any dashboard. Home is the only screen that flows into two columns on a laptop; every other screen is one full-width column (`Screen` defaults to `columns={false}`).

Every dashboard carries the same "By period" block (`PeriodPanel`: `PeriodFilter` plus `SummaryTiles`): Home, Life, Finance, Wellbeing, Mood, Sleep, Stress, Mindful, Journal and the Shop.

## 4. Tokens

Everything is a CSS variable on `:root`, defined in the `@theme` block of `app.css` and redefined for dark mode. Never hard-code a colour or a spacing value in a screen; `scripts/scan.sh` fails the build on a hex colour outside the drawn art, a numeric Tailwind spacing class, an arbitrary pixel value, white on the ink fill, or the old product name.

- **Spacing:** six values only: xs 8, sm 12, md 16, lg 32, xl 64, 2xl 120 (`--spacing-xs` to `--spacing-2xl`). A hairline under 8px between icons and the 240px sidebar offset are the accepted exceptions.
- **Ink:** a grey family, not brown. `--color-ink` is `#262626` in light mode; dark mode is `#121212` paper and `#1e1e1e` card. `ink-soft`, `ink-mute`, `line` and `shadow` are greys. `ink-fixed` stays dark in both modes.
- **Surfaces:** `paper`, `card`, `line`.
- **On-fill tokens:** `on-fill` (white on any solid relationship colour), `on-yellow` (the one exception, dark on yellow), `on-ink` (the foreground on the ink fill, which turns cream in dark mode).
- **The seven relationship colours** `r1` to `r7`, from the kit's families (Present Red, Empathy Orange, Zen Yellow, Serenity Green, Mindful Brown, Kind Purple): Servant leader `#E11D48` (Ember), Friendship `#FB8728` (Pip), Parent and child `#FACC15` (Sunny), Lover and partner `#9BB068` (Clover), With yourself `#926247` (Dew), With the guru `#7F45E2` (Sage), With the divine `#5D2AAD` (Lumen). Each has a tint; in dark mode a tint becomes the deep end of its own family, never grey.
- **Type:** `--font-display` and `--font-body` from the kit's family and weights.
- **Radii:** `card`, `tile`, `pill`.
- **Shadows:** `--shadow-toy` and `--shadow-toy-soft`, the only two. A resting card carries a hairline edge plus the soft drop so it reads on cream and in dark mode. No new shadow values.
- **Motion:** GSAP for anything new; `motion/react` only where it already is. Reduced motion is honoured with `gsap.set`.

## 5. The contrast rule

On a solid colour fill (`bg-r1` to `bg-r7`, a `Hero`) every foreground element is white: `text-on-fill`, rings and lines in `var(--color-on-fill)` with an `rgba(255,255,255,0.3)` track, buttons `variant="light"`. Yellow takes `text-on-yellow`. `bg-ink` turns cream in dark mode, so everything on it uses the `on-ink` tokens, never `text-white` or `bg-white`. Dark text and ink buttons sit only on cream, card and tint surfaces. Never a brown ring, brown text or an ink button on a coloured card. In a row of equal choices no button is solid until it is picked.

`scripts/smoke/contrast-probe.js` walks every text node on every route in dark mode and lists anything under 2.2:1. The only accepted hits are white captions on the green fill and greyed unearned badges.

## 6. Components as built

- Shell: `Screen` (tabs, columns, howTo), `TabBar` (tabs, sidebar, phone menu), `Gate` (module on or off), `ThemeToggle`, `SignOut`, `RoleBadge`.
- Structure: `PageHeader` (the way back as a round button, the title, one line), `BackLink`, `Section` (one heading size and gap, an optional "Open" link), `Sheet` (a close button and room to breathe; phone bottom padding `pb-xl`), `Hero` (one of the seven characters with a mood that follows the number).
- Rows and actions: `CheckRow` and `TaskRow` (every action is a checkbox row with the `toy` hover affordance; a dated task is locked with "Tick it on the day"), `Toggle`, `Button` (solid ink pills for primary, outlined for secondary, `light` on fills), `.scroll-row` for pills that scroll sideways (bleeds 16px into the gutters so a lifted `toy` and its shadow are never clipped; any top margin goes on a wrapper).
- Numbers: `StatTile`, the chart vocabulary in `Charts.tsx`: `AreaLine` and `MultiLine` for trends (the frame always on: y labels, baseline, gridlines), `PillBars` and `WeekBars` for days, `Gauge` and `Ring` for scores, `Donut` with `Legend` for shares, `Bubbles` for what comes up most, `CalendarGrid` for a month, `EmojiRow` for moods, and `Sparkline`, `Segments`, `PillChain`, `WeekDots` on rows. Every tracker screen shows a thirty-day line. `MoodFace` draws moods; never system emoji. `Avatar` and `Person` draw the characters; `EvolutionReveal` and `Celebration` animate a stage.
- Teaching: `Pyramid` (the one explainer, GSAP: a tick lands on the tip and a glow runs to the base; onboarding shows it after the answers, one card at a time under a tappable pyramid), `HowTo` and `HowItWorks` (the "How it works" card every app's main screen ends with: one `toy toy-soft` button, closed by default, with the steps and the words as two `toy-flat` toggles inside; `span-all` on Home; never a floating button or a sheet), `Nudge` (one quiet 12px line under the thing it talks about, linking to Help), `Guide`, `Markdown` (lesson bodies: `##`, `###`, `-`, `1.`, `>`, `**bold**`; no HTML, no links).
- Lists and admin: `Pager` and `usePage` (the bar under every long list: rows per page 10, 25, 50 or 100, previous and next, the page kept in the URL; it hides on a short list), `DataTable` (sort by any column, search, filter by a column's values, tick rows for bulk actions, edit a cell in place, and the same pager fed by the server), `ListingSheet`, `SearchBox`, `InterestPicker` (`INTEREST_GROUPS`, at most 10 on), `PeriodFilter` and `PeriodPanel`, `TrustBadge`, `NotToDoList`, `LinksEditor` and `LinkBlocks`, `XpBar`, `OnboardingTroupe` (the characters walking along the bottom as questions progress).

## 7. States

Every screen is driven by TanStack Query, so loading, error and empty come for free and are handled per section: a short "nothing yet" line with the action that fills it, an error line with retry, the `Gate` screen for a module that is off or unavailable, a 404-shaped answer for a thing you cannot see. Destructive actions confirm first (`window.confirm` in nineteen places; account deletion needs the word DELETE). There are no skeleton loaders; sections render their frame (a chart's axes, a tile's label) before data lands. Keyboard focus shows only from the keyboard (`focus-visible`), with the kit's focus ring.

## 8. Words

- Universal and plain: a teenager can read it. Flesch 60 or above on any file (`python3 -I scripts/flesch.py <file>`, `--strings` for a TypeScript file's quoted text).
- The glossary is `TERMS` (45 words), listed under Help as "Words we use". Seven *pillars*, each a *pyramid* of six *layers* (foundation, guiding principle, value goal, goal outcome, project, task), the daily *small act*, the *not to do* list, *reviews* by *period*, the *Daily* tab, the *Profile* tab, the *Public page* module, the *five areas of life*. Never tower, floor, area for the seven, rule, feeling, proof, rung, ladder, spark, habit, vice, sprint, cycle, retro, Today or You as screen names.
- The product is kreators.app, lowercase with the dot, in every heading, footer, email, policy and share card. Never "Kreators Life".
- Every app's "How it works" is three to five concrete steps with the numbers, from `HOW_TO`; a new app gets an entry or the shared test fails.

## 9. Accessibility, with status

- Aria labels and roles throughout (about 670 `aria-*` attributes and 170 roles); headings in order; labels on fields.
- Reduced motion honoured in GSAP and the few `motion/react` places.
- Contrast probed over every route in dark mode; two accepted exceptions.
- Phone layout probed over every route (`scripts/smoke/overflow-probe.js` through the screenshot tool): no page scrolls sideways and nothing pokes past the screen, in portrait or landscape. A class may not carry `inline-flex` or `inline-block` next to `hidden`, because Tailwind 4 orders those after `hidden`.
- Keyboard: focus-visible rings, disclosure rows that open from the keyboard.
- Not done: a WCAG target is not stated anywhere; no screen-reader pass has been made; text alternatives on the drawn characters are decorative by design.

## 10. Workflow

The kit came first: tokens were pulled once from Figma (`scripts/figma-pull.py`, `scripts/figma-sections.py`) and frozen, so builds never call Figma. A new screen reuses `PageHeader`, `Section`, `StatTile`, the charts and the rows; it never invents a style. After touching colours, run the contrast probe over every route in dark mode. Screenshots come from `node scripts/smoke/shoot.mjs [routes]` against the smoke server, in light, dark or both, phone, laptop and a phone on its side.

## Known gaps

- No stated WCAG level and no screen-reader pass.
- Empty and error states are per section and consistent in tone but not catalogued as components.
