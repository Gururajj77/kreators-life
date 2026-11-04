# SwiftUI Expert rules, translated for kreators.app (React 19 web)

Source: AvdLee/SwiftUI-Agent-Skill, skills/swiftui-expert-skill/SKILL.md plus references (state-management, view-structure, performance-patterns, list-patterns, animation-basics, accessibility-patterns, sheet-navigation-patterns, layout-best-practices, liquid-glass, scroll-patterns, focus-patterns, modifier-patterns, image-optimization, text-patterns).
Not carried over (no web meaning): Instruments traces, #available, @Entry/@FocusedValue keys, SDK 27 macros, iPhone Duo/fold APIs, macOS scenes, previews, Swift Charts import, UIImage downsampling actor.
CLAUDE.md wins over this list (wave 8, 2026-11-04; see docs/DECISIONS.md). Liquid Glass is "only when asked": the founder already asked (calm glass, CLAUDE.md), so keep the existing glass and add none.
Never use these rules to restyle a control at rest.

## State and one source of truth
1. **Each piece of state has one owner.** Server data lives in React Query, the URL holds what survives Back (`useParamState`), chats use `useKept`, settings use `useFocusPrefs`. Never mirror a prop into `useState`. A deliberate one-time seed gets a comment. Check: `grep -rn "useState(props\.\|useState(initial" apps/web/src`. Look for `useEffect(() => setX(prop))` that copies a prop.
2. **State stays private to its component.** Pass a setter (the "binding") only to a child that writes. A child that only reads gets the value. Check: props named `setX` that the child never calls.
3. **Pass only what a view reads.** Do not pass a whole `user`, `data` or config object to a row that reads two fields. A row gets its element, never the list plus an index. Check: list rows typed with the parent's whole response.
4. **No redundant state updates.** Compare before calling `setX` in hot handlers (pointermove, scroll, timers). Keep derived values out of state. Check: setState inside `pointermove`, `scroll` or `setInterval` handlers without an equality guard.

## Composition
5. **Extract subviews as components, not render helpers.** Pull a large screen body into named components (`function Row(...)`), not `renderX()` functions or JSX in variables, so React can skip them. Check: screens over ~400 lines with `const renderX =` or `function renderX(`.
6. **Keep the render body pure and cheap.** No `new Date()` sorting, filtering or `Math.random()` inside render on every pass. Use `useMemo` keyed on the real inputs, or prepare the value on the server or in shared. No side effects in render. Check: `grep -rn "Math.random()" apps/web/src --include='*.tsx'`. Look for `.sort(`/`.filter(` on big arrays inside JSX.
7. **Change values, not structure, for conditional styling.** Toggle a class or prop rather than branching between two element trees, which resets state and focus. Do not wrap things in `AnyView`-like wrappers that change element types. Check: `cond ? <X .../> : <X ... different/>` of the same component.

## Lists and identity
8. **Stable keys.** `key` is the row's id from the server or shared constants, never the array index or `Math.random()`/`crypto.randomUUID()` in render. The key must not come from editable text. Index keys are allowed only for static, never-reordered content (fixed paper lines, chart ticks). Check: `grep -rnE 'key=\{(i|idx|index)\}' apps/web/src --include='*.tsx'` (most hits are static: Charts.tsx ticks, paper lines). An editable or reorderable list such as FAQ rows, invoice lines or subtasks is a bug.
9. **One element per row.** Each `.map` returns one keyed element: a fragment with a `key`, never an unkeyed fragment of siblings.
10. **Big lists are paged or lazy.** Use `PAGE_SIZES`/`Pager`/`usePage`. Never use a bare `LIMIT 100`. Below the fold, use `loading="lazy"` images and `lazyNamed` screens.
11. **Empty states are content, not blanks.** Every list says what to do when it is empty, as one line with the action. Use `Skeleton` while loading.

## Performance
12. **Narrow re-render scope.** Keep a rapidly changing value (a clock tick, pointer position or scroll offset) in the smallest component that shows it, or in a ref/CSS variable, never in a screen-level state. FocusPill and FocusRounds are the model. Check: `setInterval`/`requestAnimationFrame` state in screens.
13. **Clean up async work.** Every effect with a timer, listener, observer, GSAP tween or fetch returns a cleanup. Use `gsap.context().revert()` or AbortController. Check: `useEffect` with `addEventListener`/`setInterval`/`gsap.` and no `return`.
14. **Derive thresholds rather than streaming offsets.** A scroll or resize handler sets state only when crossing a threshold (`CondensedTitle` pattern), never on every pixel.

## Animation (GSAP per CLAUDE.md)
15. **Animate only transform and opacity.** No layout properties (width, height, top, margin) in tweens or CSS transitions. Check: `gsap.to(` with `height|width|top|left`.
16. **Scope animations narrowly.** Tween the one element that changes, never a root wrapper. No `transition: all` (keep it at 0).
17. **Every animation has its trigger.** Tie it to a value change or an event, like `.animation(_, value:)`. Do not leave free-running loops. Endless motion stops off screen or in a hidden tab (`useRunning`, `data-run`).
18. **Use non-linear easing for UI.** Use `--ease-open` / `--ease-spring`; linear only for progress or a marquee.
19. **Reduced motion means `gsap.set`.** The end state is shown with no movement. Check: every new `gsap.to/from` file references `prefers-reduced-motion` or the shared helper.

## Accessibility
20. **Tappable means `<button>` or `<a>`.** Never a `div` or `span` with `onClick`. `role="button"` only with key handling (verify Enter and Space). Tap targets are at least 44 by 44 (`target-probe.js`).
21. **Use labels and names.** Icon-only buttons have `aria-label`. Toggles have `aria-pressed`/`aria-expanded`. The selected tab or segment has `aria-selected`/`aria-current`. Check: `<Icon` alone inside `<button` with no label.
22. **Hide decorative art.** Posy, BackgroundPaths, MorphShapes, BadgeArt shine and avatars beside a name get `aria-hidden`. `<img>` always has `alt` (`scripts/scan.sh` enforces this).
23. **Group related content.** A card that is one link reads as one sentence. A stat tile reads its number with its label.
24. **Custom controls act like native ones.** RulerPicker/Toggle/Segmented use the right `role` (`slider`, `switch`, `tablist`/`radiogroup`) with arrow-key adjust. That is `accessibilityAdjustableAction`.
25. **Text scales.** Use rem type tokens (`--text-*`), not fixed px font sizes on reading text, so a person's browser zoom and font size apply.

## Sheets, alerts, navigation
26. **Use item-driven sheets.** Open a sheet with the item it is about (`const [editing, setEditing] = useState<Item|null>(null)`), not a boolean plus a separate selected id. Check: paired `open` + `selectedId` states.
27. **Sheets own their actions.** The sheet saves and closes itself through its own mutation. Do not prop-drill `onSave`/`onCancel` chains. All sheets use `Sheet` and `useDialogFocus` (focus in, trapped, Escape, return).
28. **Confirmations are in-app sheets.** Use `ConfirmSpend` or a confirm `Sheet`, never `window.confirm` (HIG and CLAUDE.md). Check: `grep -rn "window\.confirm" apps/web/src` Each one is a finding (wave 8 left two: Resources.tsx and Realm.tsx).
29. **Navigation is a typed router, not state.** Use links and `navigate()`. Tabs and filters that only change the view use `preventScrollReset` (`drive-scroll.mjs` reports 0). `BackLink` uses history when it has it.
30. **Pick containers that adapt, without swapping trees on resize.** Do not render two different component trees per breakpoint when CSS can adapt one, because that loses state mid-resize. Use responsive classes. `md`/`lg` need height, per app.css.

## Layout (HIG)
31. **Relative layout over magic numbers.** Use the spacing tokens (8 to 120). Avoid fixed `w-[390px]` style widths except deliberate ones (Fix row 148px, kanban 260/280px). Check: `bash scripts/scan.sh`.
32. **Views work in any context.** A component does not assume full screen. It fits a sheet, a half column or a phone. Check: `overflow-probe.js` 0 at 390, `height-probe.js` 0, `lone-probe.js` 0, `orphan-probe.js` 0 on laptop.
33. **Read size from the nearest container.** Use `ResizeObserver` on the element (CardTable rescale), not `window.innerWidth` in render.
34. **One primary action per screen, the rest in `MoreMenu`.** A few views is `Segmented`. Tabs that overflow go through `TabRow`, keeping each row's look.

## Glass (already adopted, keep as is)
35. **Use glass sparingly.** Only big surfaces blur (`.bg-card` with `rounded-card`/`rounded-tile`, nav, dialogs). No glass on chips, and no glass on glass without a solid `--card-strong`. Fall back to solid under reduced transparency, more contrast or no `backdrop-filter`. Use concentric radii (`--radius-card` 32, tile 24, inner 16/20). Do not mix radii arbitrarily.
36. **Interactive affordance only on tappables.** Use the `toy` hover and press only on things that act. Static cards get no lift.

## Modern over deprecated
37. **Prefer current platform APIs.** `contenteditable="plaintext-only"` with fallback, `dialog`/`inert` where used, `structuredClone`, `AbortController`, React 19 patterns (no `defaultProps` on function components, no `findDOMNode`, no string refs, no legacy context). Flag soft-deprecated APIs and leave them unless the task is a migration. Check: `grep -rn "defaultProps\|findDOMNode\|UNSAFE_" apps/web/src`.

## How to use
- For every app screen under review, walk rules 1 to 37 and note each violation as `file:line`, with the rule number.
- Fix hard rules (8, 9, 13, 19, 20, 21, 22, 26 to 28) as bugs. Present performance rules (5, 6, 12, 14) as suggestions unless they cause a visible bug.
- After changes, run the typecheck, build, shared tests, `scripts/scan.sh` and the probes in rules 31 and 32 over shots.json at phone and laptop width.
