Status: ready

# F-LAYOUT-001 — Responsive layout: tablets, landscape, a wide layout instead of a 480 px column

**Scope**: `packages/design-system` (layout tokens, `layoutClassFor`, `useLayoutClass`, `LayoutProvider`, `Screen` width, `SplitPane`, tab-bar side insets) · `apps/mobile` (web shell `scripts/pwa-postbuild.mjs`, `public/manifest.webmanifest`, orientation platform module + guard, Home / Journey / Library / EpisodeDetail / CardDetail views, game sizing, e2e) · `design/tokens/layout.v1.md` (new) · `scripts/check-token-drift.mjs` · wireframe `design/wireframes/layout/layout-wide.md`
**Owner**: solo dev
**Rollout**: PWA first (the primary channel). Native iPad / Android tablets follow the App Store track (10-app-map decision #28). PR order in §6. F-TCH-004 (lecture presenter) needs PR 1 and PR 2a only.

Parent / siblings: PR #95 (Screen scrolls, safe-area aware, labelled Profile entry, `pin-pad-layout.ts`, `tabBarMetrics`) · audit UX-09, UX-23, UX-26, p1-L1..L4, p2-L1..L3 · `design/wireframes/pwa/system-banners.md` panel 4 (portrait guard) · F-STORY-002 §3.3 (reader screen, "Landscape / wide" two-column rule) · F-STORY-003 §3.5 (3-4 columns "at tablet width") · F-LEARN-001 (sticky footer, `PinPad`) · F-I18N-001 (long Spanish strings) · F-TCH-004 (presenter exemptions) · wireframe `wireframes/layout-wide.md`

---

## Decisions

Binding owner decisions this spec implements: **D1** (anyone, any age: tablets in classrooms and adult learners on laptops are first-class, nothing is "phone only" except the portrait nudge) · **D2** (three UI locales: Spanish strings are about 25-30 % longer; panes must not clip) · **D7** (no new raster art; layout uses tokens only) · **D8** (spec id) · **D12** (manifest orientation `any`, phone-only portrait guard, presenter route exempt).

Decisions taken in this spec (LD = layout decision):

| # | Decision | Why |
|---|---|---|
| LD1 | **Three width classes from the window width, plus a height flag**: `compact` < 600, `regular` 600-899, `wide` >= 900; `short` = window height < 480. | Same numbers as Material window size classes for compact/medium, with `wide` lowered from 840 to 900 so a 10" tablet in landscape (1024+) and a 960x600 Android tablet are wide, while a landscape phone (844 or 932 wide, <= 440 high) is not. |
| LD2 | **Two panes need `wide` and not `short`; side-by-side content (picture left, text right) needs only landscape and width >= 700.** A landscape phone never gets panes (844x390, 932x430) but does get `sideBySide`. | The 844x390 case is already designed as one pane (Trace `side` mode, PIN pad 6 x 2: `trace-layout.ts:11`, `pin-pad-layout.ts:8`), and F-STORY-002 §3.3 already specifies two columns for landscape phones ("native tablets and landscape phones; width >= 700 dp and wider than tall"): excluding `short` from `sideBySide` would contradict it. |
| LD3 | **Content width is capped inside `Screen`, not on `#root`.** Default `width="reading"` = 720; `width="full"` = 1120 for pane screens. Backgrounds stay full-bleed. The `#root` 480 px rule is deleted. | One rule makes every existing screen look right on a tablet without touching it. A cap on `#root` also boxes in the tab bar, banners and the presenter (D12). |
| LD4 | **Media scales, text does not.** Hoya, tiles, card art, the Trace canvas and the PIN keys scale by `mediaScale` (1 / 1.2 / 1.4). Type tokens (`body` floor 18) are unchanged. | The charter floors (`typography.size.body = 18`, `touchTarget.min = 64`) are the same on every device; larger media is where a tablet gains. Text scale stays the user's (OS / browser zoom). |
| LD5 | **Manifest `orientation: "any"`; phones are kept upright by a soft guard plus a best-effort runtime lock.** The guard has a "Keep sideways" button remembered per device. | Browser-tab landscape works today (no guard code exists, grep `orientation` finds only `manifest.webmanifest:9`, `app.json:6` and comments), and the 844x390 layouts were built and are tested. A guard with no way out would be a regression for browser users; the wireframe's "no button" is amended (open question in `system-banners.md:83` is answered: phones only). |
| LD6 | **Bottom tab bar stays on every class in this spec.** Its row is centred inside `maxWidth.full`. | `@react-navigation/bottom-tabs ^6.6.1` (`apps/mobile/package.json`) has no `tabBarPosition`; a side rail waits for the v7 upgrade. |
| LD7 | **Split panes are state, not routes, for now.** There is no `linking` config (`App.tsx:75`); the selected item lives in screen state and survives rotation. | Deep links are a separate spec (UX-04). |
| LD8 | **A pane screen is the same screen, not a second implementation.** Journey / Library render the existing list plus an extracted `…View` component in the detail pane; the single-pane path keeps the current stack navigation. | One source of truth for the episode page and the card page. |

---

## 1. Context

Facts verified against `/Users/ggoboogi/workspace/Hangul_Route` at `origin/main` `ecf6365` (PRs #95-#105 included; re-verified at review 3, 2026-10-10: every file:line below was read at that commit).

- **The web column.** `apps/mobile/scripts/pwa-postbuild.mjs:44-48`: at `min-width: 600px`, `#root { max-width: 480px; margin: 0 auto; min-height: 100vh; border-left/right }` ("until a wide layout is designed"). At 1180x820 about 60 % of the window is empty (audit UX-23).
- **Orientation.** `public/manifest.webmanifest:9` `"orientation": "portrait"`; `app.json:6` `"orientation": "portrait"`, `app.json:18` `supportsTablet: true`. The portrait guard exists only as wireframe panel 4 (`system-banners.md:39-51`); no orientation code in `apps/mobile/src`.
- **Safe areas (PR #95, shipped).** `Screen` pads each edge it owns with the inset from `SafeAreaInsetsContext` (`packages/design-system/src/components/Screen/Screen.tsx:25-27`), scrolls by default (`:16,36-45`), and takes `edges` (`layout.ts:12-17`; `TAB_SCREEN_EDGES` drops `bottom`). `tabBarMetrics(bottomInset)` sizes the tab row from the 64 pt floor (`layout.ts:65-69`, used at `navigation/tabs.tsx:15,23-29`). `viewport-fit=cover` is injected at `pwa-postbuild.mjs:88`. Left / right insets in landscape are covered by a unit fixture (`__tests__/layout.test.ts:6,18`) but nothing renders them on the tab bar or the banners.
- **No breakpoints.** `useWindowDimensions` is used in exactly one file, `screens/parent/PinEntryScreen.tsx:16,68`, which hard-codes `WEB_COLUMN_MAX = 480` (`:46`, used at `:70`) to mirror the CSS cap. `logic/trace-layout.ts` takes the **measured content box** (`:21-25`) with `TRACE_CANVAS_MAX = 320` (`:19`) and a `side` mode at `width > height && width >= 440` (`:38-39`). `pin-pad-layout.ts` picks 3 / 4 / 6 columns (`:18`). Everything else is phone geometry: Journey cells are `flex: 1, aspectRatio: 1` in one row of five (`JourneyScreen.tsx:105-115,163`), Library cards are `flexBasis: '47%'` (`LibraryScreen.tsx:122`).
- **Overlays.** `PwaBanners` is `position: absolute; left/right: spacing.md; bottom: spacing.xl` over the whole window (`components/PwaBanners.tsx:36-40`), ignoring insets and the tab bar (audit UX-26).
- **Existing layout test.** `apps/mobile/e2e/web/layout.spec.ts`: four viewports (`:12-17`: 320x568, 375x553, 375x667, 844x390), `expectReachable` scrolls like a learner and requires full visibility (`:27-37`), four tests per viewport (`layout.spec.ts:54,91,132,174`). `playwright.config.ts:15` runs every spec as a Pixel 5 (touch, mobile) unless a spec overrides `viewport`.
- **Tokens.** `touchTarget = { min: 64, child: 80, hero: 96 }` (`tokens.ts:198`), `spacing` (`:105`), type sizes (`:130-150`, `hero: 48`). `scripts/check-token-drift.mjs:29` knows six token kinds (no `layout`); `__tests__/tokens-parity.test.ts` pins colours and the manifest colours only (`:33`, `:58-70`).
- **Design-system test lane.** Node-only vitest; `src/components/**` is excluded from coverage (`vitest.config.ts`), so logic must live in `src/layout.ts`-style pure files and components stay thin.

## 2. User story

> As a teacher with an iPad in a Chromebook-and-iPad classroom, I want the app to use the whole screen in either orientation, so the Journey map and a lesson page sit side by side and nothing is a thin strip down the middle.
>
> As a learner on a phone, I want the app to stay upright and easy, with no surprise when I turn the phone.
>
> As the owner, I want one layout foundation that every later screen (reader, Discover, placement, presenter) gets for free.

## 3. Acceptance criteria

### 3.1 Layout classes and tokens

`packages/design-system/src/tokens.ts` gains a `layout` group (placed after `spacing` at `:105`, because it references `spacing`; units are CSS px / dp; also added to the `tokens` aggregate and the `Tokens` type at `:243-262`; `check-token-drift.mjs` matches `export const layout = { … } as const`, which the nested-object form below satisfies), mirrored by **`design/tokens/layout.v1.md`** (new; same table style as `spacing.v1.md`):

```ts
export const layout = {
  breakpoint: { regular: 600, wide: 900 },       // window width
  shortHeight: 480,                               // window height below this = 'short'
  phoneShortSide: 600,                            // min(width, height) below this = a phone ...
  phoneMaxLongSide: 1000,                         // ... if the long side is also at most this (a 1100x500 desktop window is not a phone)
  sideBySideMin: 700,                             // F-STORY-002 reader: two columns when landscape and width >= this
  maxWidth: { reading: 720, full: 1120 },
  gutter: { compact: spacing.lg, regular: spacing.xl, wide: spacing.xxl },
  pane: { master: 400, gap: spacing.xl },         // master pane width on wide; detail takes the rest
  mediaScale: { compact: 1, regular: 1.2, wide: 1.4 },
  columns: { cards: { compact: 2, regular: 3, wide: 3 }, journeyCellMax: 112 },
} as const;
```

Pure function in `packages/design-system/src/layout.ts` (exported from `index.ts`):

```ts
export type WidthClass = 'compact' | 'regular' | 'wide';
export type FormFactor = 'phone' | 'tablet';
export interface LayoutClass {
  width: WidthClass;
  short: boolean;                    // height < layout.shortHeight
  orientation: 'portrait' | 'landscape';   // width > height
  form: FormFactor;                  // phone if min(w,h) < phoneShortSide and max(w,h) <= phoneMaxLongSide, else tablet
  panes: 1 | 2;                      // 2 iff width === 'wide' && !short
  sideBySide: boolean;               // landscape && windowWidth >= sideBySideMin, ANY height (reader, Discover; F-STORY-002 §3.3). Games decide per screen whether to honour it on a short window (§3.6)
  gutter: number; maxWidth: { reading: number; full: number };
  mediaScale: number;                // layout.mediaScale[width]; 1 when short
  cardColumns: number;
  windowWidth: number; windowHeight: number;
}
export function layoutClassFor(size: { width: number; height: number }): LayoutClass;
```

Rules: boundaries are inclusive on the upper class (`width >= 600` is `regular`, `>= 900` `wide`); `width` or `height` that is `0`, `NaN` or negative is treated as `compact` / not short (the first web frame can report 0). `short` forces `mediaScale = 1` and `panes = 1` (it does not change `sideBySide`).

**Expected results (these six are a table test and the e2e viewports):**

| Window | width | short | orientation | form | panes | sideBySide | mediaScale |
|---|---|---|---|---|---|---|---|
| 320x568 | compact | no | portrait | phone | 1 | no | 1 |
| 375x553 | compact | no | portrait | phone | 1 | no | 1 |
| 390x844 | compact | no | portrait | phone | 1 | no | 1 |
| 768x1024 | regular | no | portrait | tablet | 1 | no | 1.2 |
| 1180x820 | wide | no | landscape | tablet | **2** | yes | 1.4 |
| 844x390 | regular | **yes** | landscape | phone | 1 | **yes** | 1 |

Extra boundary rows in the unit test: 599 / 600 / 899 / 900 wide, 479 / 480 high, 699 / 700 wide in landscape for `sideBySide`, 932x430 (iPhone Pro Max landscape: width `wide`, `short`, so panes 1, `sideBySide` yes), 960x600 (Android tablet landscape: wide, panes 2), 678x1024 (iPad Split View), 1100x500 (desktop: tablet form, not short), 0x0.

### 3.2 Hook, provider and components (`packages/design-system/src/components/Layout/`, excluded from coverage like all components)

- `useLayoutClass(): LayoutClass` reads the nearest `LayoutProvider`, else `useWindowDimensions()` (react-native-web updates it on resize and rotation) through `layoutClassFor`. Memoised on `{width, height}`.
- `LayoutProvider({ value })` lets **a pane override the class for its subtree** (a detail pane 600 wide is `regular` with `panes: 1`, not `wide`, so nested screens do not try to split again) and lets `/design-preview` and tests force a class.
- `Screen` gains `footer?: ReactNode` (**owner of the sticky-footer slot** that F-LEARN-001 §5 "Small phones", F-QUEST-002 §5 and F-VOC-003 §3 all point to; none of them defines it): rendered below the scroll area, outside the `ScrollView`, inside the bottom safe-area padding when the screen owns the `bottom` edge, with the same width cap as the content, so a primary CTA stays reachable on a short window without scrolling; the content area gets the remaining height. Without `footer` nothing changes. The slot adds no style of its own beyond the cap and padding. PR 1.
- `Screen` gains `width?: 'reading' | 'full' | 'bleed'` (default `'reading'`). Both branches (`scrollable` and not, `Screen.tsx:29-46`) wrap `children` in `<View style={{ width: '100%', maxWidth, alignSelf: 'center', ... }}>` (`flexGrow: 1` when scrollable, so a bottom-pinned CTA stays put; `flex: 1` when `scrollable={false}`, so fixed content shrinks to the space it is given and a measuring child such as Trace sizes itself from it) **inside** the already padded container, so insets and gutter stay outside the cap and the background stays full-bleed. `padded` uses `layout.gutter[width]` instead of the fixed `spacing.lg`. `'bleed'` = no cap (the presenter stage, full-screen art).
- `SplitPane({ master, detail, masterWidth? })`: when `useLayoutClass().panes === 2` renders a row, each pane its own `ScrollView` (`keyboardShouldPersistTaps="handled"`), master `layout.pane.master` wide, `layout.pane.gap` between, detail wrapped in a `LayoutProvider` with the pane's own class. When `panes === 1` renders only `master` (the caller navigates as today). The parent `Screen` is `scrollable={false}` and owns the safe-area padding.
- `useMediaSize(base: number): number` = `Math.round(base * mediaScale)`; the **only** way a component scales a size. Raw `* 1.4` in a screen is rejected in review.
- `tabBarMetrics(bottomInset, sideInsets?: { left; right })` (additive; existing callers and tests keep working) also returns `paddingLeft` / `paddingRight` = `max(side inset, (windowWidth - maxWidth.full) / 2)` so the tab row is centred and clears a landscape notch. `tabs.tsx:23-29` passes them.

### 3.3 Web shell (`apps/mobile/scripts/pwa-postbuild.mjs`, `public/manifest.webmanifest`)

- **Given** a window wider than 600 px, **when** the app loads, **then** `#root` has no `max-width` and no side borders; its width equals the window (the `@media (min-width: 600px) { #root … }` block at `pwa-postbuild.mjs:44-48` is deleted; the shell keeps `overscroll-behavior`, `user-select` and `#trace-canvas` rules, `:37-43`). `#root` keeps a full-height flex column (confirm against the Expo reset in PR 2; if the reset sets `height: 100%` nothing is added).
- `manifest.webmanifest:9` becomes `"orientation": "any"`. `tokens-parity.test.ts` gains `it('manifest orientation is any')` next to the colour rows (`:64`), so the lock cannot silently return.
- `app.json:6` is **not** changed here (native, decision #28; §3.10).
- `pwa-postbuild.mjs` reads nothing new from tokens (breakpoints are runtime, not CSS). A guard comment lists the one CSS rule that must never come back (`#root` cap).
- `PwaBanners` (`components/PwaBanners.tsx:36-40`) and `InstallGuideSheet` sit in a centred container (`maxWidth.reading`) and add the bottom inset **plus the tab-bar height** when the tab bar is visible (UX-26). Behaviour (when banners appear) is unchanged.

### 3.4 Orientation: soft portrait guard for phones only

- New `apps/mobile/src/logic/layout/orientation-guard.ts` (pure, 100 %):

```ts
export interface GuardInput { layout: LayoutClass; coarsePointer: boolean; route: string | null; allowedSideways: boolean; dismissedThisSession: boolean }
export function shouldShowPortraitGuard(i: GuardInput): boolean;
// true iff layout.form === 'phone' && layout.orientation === 'landscape' && coarsePointer
//   && !allowedSideways && !dismissedThisSession && !isGuardExempt(route)
export const GUARD_EXEMPT_ROUTES = ['/present'] as const;   // F-TCH-004; prefix match on the pathname. Defensive only: the presenter is a separate root that never mounts `App` and so never mounts the guard (F-TCH-004 TD1)
```

- `platform/orientation.ts` (native stub: returns `{ coarsePointer: true }`, no-ops) and `platform/orientation.web.ts`: `coarsePointer()` = `matchMedia('(pointer: coarse)').matches`; `tryLockPortrait()` calls `screen.orientation.lock('portrait-primary')` only when the app is **standalone** (`isStandalone()`, `platform/pwa.web.ts:29`) and the form is phone, ignores every failure; `unlock()` for tablets, the presenter and "Keep sideways". Feature-detected.
- `store/layout-store.ts` (zustand, key **`device:layout`** via `platform/storage`): `{ v: 1, allowedSideways: boolean }`; hydrated in `hydrateLearnerData()` (`store/bootstrap.ts`). A corrupt or missing value means `false`.
- `components/PortraitGuard.tsx` mounted in `App.tsx` beside `PwaBanners` (`App.tsx:79`), full-screen overlay (`z.modal`), Hoya `thinking`, one line "Turn your phone upright" (message key `learner.portraitGuard.title`: F-I18N-001 §3.4 rule 2 has no `pwa` namespace), and a secondary button **"Keep sideways"** (min 64 pt) that sets `allowedSideways` and calls `unlock()`. Rotating back to portrait removes it. It never shows during a presenter route, on a tablet, or with a mouse.
- **Given** a phone in landscape in a browser tab, **when** the guard shows and the learner taps "Keep sideways", **then** the guard goes away, the choice is remembered on the device, and every screen works at 844x390 as in §3.6.
- **Given** an installed Android phone, **when** the app opens, **then** the runtime lock keeps it upright and the guard rarely shows; on iPhone (no lock API, manifest orientation ignored) the guard is the mechanism.

### 3.5 Safe areas

- `Screen` already pads all four edges (`layout.ts:40-52`); this spec adds only what rendering a wide window exposes: tab bar side insets (§3.2), centred overlays that add bottom and side insets, and the pane screens (`SplitPane` inside a non-scrolling `Screen`, so the top / side insets are applied once, not per pane).
- Landscape notch: left / right insets keep content out of the cut-out and away from the rounded corners; the tab row and the guard honour them. Modal screens keep `withOwnSafeArea` (`navigation/with-own-safe-area.tsx`).
- iPad home indicator and Stage Manager windows: `SafeAreaProvider` reports the window's own insets; a resizable window changes class live (no restart).
- Tested: `layout.test.ts` gains side-inset cases for `tabBarMetrics`; Playwright cannot emulate `env(safe-area-inset-*)`, so real insets are on the manual device list (§5, "Manual").

### 3.6 Behaviour per screen and class

`compact` = today's phone layout, unchanged. "Reading" = centred 720 column with `gutter`; "full" = 1120.

| Screen | regular (768x1024) | wide (1180x820) | short (844x390) |
|---|---|---|---|
| Home (`HomeScreen.tsx`) | `full`; two columns: missions left (flex 3), stage progress / homework / tip right (flex 2); Hoya x1.2 | same, Hoya x1.4 | one column, scrolls |
| Journey | `full`; the 5-column grid with **cell max 112** and column labels aligned; tapping a cell navigates (single pane) | **two panes**: grid left (400), the cell's detail right (`EpisodeDetailView` for a lesson cell; the coming-soon content for a placeholder; F-STORY-005's stories-only cell opens `CellStoriesView` once that screen's body is extracted the same way, until then tapping it navigates as on one pane and the selection does not change); first selection = the episode of the learner's next quest; selection survives rotation | one column |
| Library | `full`; 3 columns | **two panes** for the Cards section: everything the screen shows above the grid today (title row, F-STORY-004 `SectionTabs`, F-VOC-003 Words card, theme chips) and the 3-column gallery in the master pane, `CardDetailView` right (flip card, hear it, share); locked card shows the "how to earn" text. Other F-STORY-004 sections (Story time, Culture notes, Theme packs) use the `full` width list with no detail pane and navigate as on one pane (their detail screens are stack screens) | 2 columns |
| EpisodeDetail / CardDetail (stack screens) | `reading` | only used when `panes === 1`; with panes they are the detail pane | `reading` |
| QuestPlayer, Results, Homework, Profile, Parent dashboard, Paywall, Join, Restore, Save progress, Oops (`OopsScreen`) | `reading` | `reading` | `reading`, scrolls |
| Onboarding (Welcome, Create profile, First quest) | `reading`, CTA pinned in a sticky footer slot (F-LEARN-001) | same | same, CTA reachable by scroll |
| PIN entry (`PinEntryScreen.tsx`; after F-LEARN-001 PR 4a the keypad is the shared `PinPad`) | `reading`; `WEB_COLUMN_MAX` (`PinEntryScreen.tsx:46` today, wherever F-LEARN-001 PR 4a leaves it) replaced by `layout.maxWidth.reading`; keys scale by `mediaScale` up to `touchTarget.hero` | same | `pinPadLayout` 6 x 2 as today |
| Match Sound / Culture Quiz / Odd One Out | prompt above, 2 x 2 tiles (tile size x `mediaScale`) | prompt left, tiles right (`sideBySide`) | as today (games opt out of `sideBySide` on a short window) |
| Trace Stroke | canvas up to `traceCanvasMax(layout)` = 320 x mediaScale (max 448) | `side` mode, canvas up to 448 | `side` mode as today (`trace-layout.ts:38-39`) |
| Build a Letter / Card Match / Story Sequence / Tap Respond / Voice Echo | tiles and cards x `mediaScale`; Card Match and Story Sequence cards 3-4 columns (F-STORY-003 §3.5 "3-4 columns at tablet width") | same | as today |
| Story reader, Discover pages, Listen & Pick (new specs) | follow `sideBySide` (art / picture left, text right), as F-STORY-002 §3.3 specifies | same | follow `sideBySide`: a landscape phone gets two columns (F-STORY-002 §3.3), a short portrait window stacks and scrolls |
| Presenter `/present` (F-TCH-004) | `Screen width="bleed"` | `bleed` | `bleed` |

New games and screens from other specs **must** use `Screen`, `useLayoutClass()` and `useMediaSize()`; the adoption checklist is §3.12.

### 3.7 Split-pane Journey and Library

- `screens/episode/EpisodeDetailView.tsx` (new) is the body of `EpisodeDetailScreen.tsx` (197 lines) taking `{ episodeId, onStartQuest(questId), onBack? }`; the stack screen becomes a thin wrapper (`navigation.navigate('QuestPlayer', …)` stays). `screens/library/CardDetailView.tsx` likewise from `CardDetailScreen.tsx` (372 lines). Extraction PRs are behaviour-neutral (golden tests: same accessibility labels).
- `logic/layout/pane-selection.ts` (pure, 100 %): `initialEpisode(episodes, snapshot)` (next incomplete shipped episode, else the first shipped), `initialCard(cards, unlocked)` (most recently earned, else first), `reconcileSelection(prev, items)` (keeps the selection when still present, else falls back). Rotation or resize between `panes: 1` and `panes: 2` keeps `selectedEpisodeId` / `selectedCardId` in screen state; going to a single pane does not auto-navigate; going to two panes shows the remembered item.
- **Given** a wide window, **when** the learner taps a Journey cell, **then** the right pane shows that episode and the cell shows a selected state (border + `accessibilityState.selected`), with no navigation and no animation. "Start" in the pane opens `QuestPlayer` full screen (the quest is a focused activity, not a pane). Back from the quest returns to the same selection.
- **Given** a two-pane window, **when** the learner leaves a quest opened straight from the tabs (Journey pane, Home) or from Results' Next up, or taps Results "Episode page", **then** the Journey tab opens with that episode selected in the right pane (`logic/layout/quest-return.ts`, Journey route param `episodeId`, read once then cleared; an id the catalogue does not have is ignored). A quest opened from another screen (Homework, a full-screen episode page) leaves to the full-screen episode page so Back returns to that screen, and one pane opens the full-screen episode page, both as before.
- **Given** a preview ("coming soon") cell, **then** selecting it shows the existing coming-soon content in the pane (no lock-in-the-pane, no paywall; D5).
- Focus order is master then detail; `Tab` / arrow keys move between cells; selection announces "Episode: <title>, selected".
- **Sizes check out**: the master pane is 400 wide inside the page gutter, so five Journey cells with four `spacing.xs` gaps are (400 - 16) / 5 = 76 each, above `touchTarget.min` (64); `layout-size.test.ts` asserts it for `layout.pane.master` and for the narrowest pane window (900). The detail pane is `windowWidth - 2 * gutter.wide - pane.master - pane.gap` = 412 at 900 and 536 at 1024 (the 1120 cap binds from 1184).

### 3.8 Touch targets, pointer and keyboard

- **Floor unchanged on every class**: interactive elements are at least `touchTarget.min` (64) in both dimensions; primary actions `child` (80). A mouse or a bigger screen does not relax it (children use tablets; adults use touch laptops). New layout elements (pane list rows, selected cell, guard button, tab items) meet it by construction; `layout-size.test.ts` asserts that every function in `logic/layout/*` returning a size never goes below 64 for tappable items.
- **Ratchet audit** (`e2e/web/target-size.spec.ts`): at 768x1024, 1180x820 and 375x667 it walks Home, Journey, Library and Profile, measures every `button` / `link` / `checkbox`, and compares offenders (< 64 in either dimension) with `e2e/web/fixtures/touch-target-allowlist.json` (initially today's offenders, e.g. Library filter chips about 36 high, audit UX-25). A new offender fails; removing one from the app requires removing it from the list (the list can only shrink).
- Pointer: `Pressable` already gives hover / press states on web; no hover-only affordances. Keyboard: every control is reachable and activates with Enter / Space; the focus ring uses `colors.border.focus` (`tokens.ts`, 3:1). No new shortcuts in learner screens (the presenter has its own, F-TCH-004).
- Text zoom: at browser zoom 200 % the window width halves in CSS px, so the class drops (1180 -> 590 compact); content reflows to one column, no horizontal scroll (checked in e2e at 1180x820 with `page.setViewportSize` to 590x410 as a proxy).

### 3.9 Device behaviour

- **iPad (Safari tab and home-screen PWA)**: portrait 768-834 wide is `regular`; landscape 1024-1366 is `wide` with two panes. Split View / Slide Over change the window live (320-507 compact, up to about 678 regular). No orientation guard (tablet form). Safe-area insets from `viewport-fit=cover` (`pwa-postbuild.mjs:88`).
- **Android tablets and Chromebooks (Chrome, installed PWA)**: same classes; the manifest no longer locks portrait, so rotation just works; a resizable Chromebook window changes class as it is dragged. 960x600 is `wide` and two-pane.
- **Desktop browsers**: wide window = two panes capped at 1120 and centred; a narrow window = compact. A short desktop window (< 480 high) is `short` and gets one pane. No guard (pointer is fine).
- **Phones**: unchanged in portrait (320 / 375 / 390). Landscape: soft guard (§3.4), one pane, all existing short-height behaviour.
- **Foldables**: unfolded inner screens (about 840 x 900) are `regular` / `wide` tablets; closed covers are phones.

### 3.10 Native (deferred, recorded so nothing is lost)

`app.json:6` stays `portrait` and the native App Store track is deferred (decision #28). When it resumes: iPad multitasking requires all four iPad orientations (`UISupportedInterfaceOrientations~ipad`), so use `"orientation": "default"` with `expo-screen-orientation` locking phones to portrait at startup; `ios.requireFullScreen` stays false; `useLayoutClass()` already works natively because it uses `useWindowDimensions`. No native change is in this spec's PRs.

### 3.11 Relation to F-TCH-004 (lecture presenter)

The presenter needs from this spec: (1) no `#root` cap (PR 2a), (2) manifest `any` (PR 2a), (3) `Screen width="bleed"` (PR 1), (4) `useLayoutClass()` for the control bar's real-pixel sizing (PR 1), (5) safe-area aware `bleed` (PR 1). `GUARD_EXEMPT_ROUTES` (PR 3) is defensive only, because the presenter never mounts `App` and therefore never mounts the guard (F-TCH-004 TD1); the presenter does not wait for PR 3. It does **not** use panes. Presenter-specific tokens (stage dimensions, projected type scale) live in a separate `presenter` token group owned by F-TCH-004, not in `layout`.

### 3.12 Adoption checklist for new screens (copy into the PR template of every spec that adds a screen)

1. Wrap in `Screen` (never a raw `View` at the top); pick `width`.
2. Never read `useWindowDimensions` directly; use `useLayoutClass()`.
3. No raw sizes derived from the window: `useMediaSize(base)`.
4. A `sideBySide` arrangement for anything with a picture and text; stacked otherwise.
5. Tappables >= 64; no horizontal scroll at 320 and at 590 (200 % zoom of 1180).
6. Add the screen to the e2e reachability list for the six viewports when it has a primary CTA.
7. Spanish strings (about 30 % longer): no fixed-width labels; text wraps.

### 3.13 Telemetry, accessibility, errors, offline

- Telemetry (added to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9`, and to `specs-out/TELEMETRY-NAMES.md`; naming convention rule 4): `layout.observed` `{ width: 'compact'|'regular'|'wide', form: 'phone'|'tablet', orientation, panes: 1|2, standalone: boolean }` once per session (to learn real tablet use); `layout.guard_shown` `{ standalone: boolean }`; `layout.guard_dismissed` `{ via: 'rotated' | 'keep_sideways' }`. No sizes in px, no profile data.
- Accessibility: the guard is a polite status region and its button is labelled; selected pane items expose `accessibilityState.selected`; panes are landmarks ("Journey map", "Episode details") so a screen reader can jump; reduced motion: pane selection and rotation have no animation.
- Errors: `matchMedia`, `screen.orientation` and storage failures are swallowed (guard falls back to "show" for phones in landscape only when `coarsePointer` is known true). A first frame of `0 x 0` yields `compact`, then corrects on the next layout.
- Offline: no network use; the guard flag is local.

## 4. Out of scope

- Native iPad / Android layout work and `app.json` orientation (§3.10); a left navigation rail (needs react-navigation v7); deep links / `linking` (UX-04); a Hangul font (UX-24); the minigame shell / exit buttons (UX-04); the contrast and IconButton work (UX-10, UX-25) beyond the ratchet audit; redesigning content screens for tablets beyond the table in §3.6; the landing page and the console (`apps/web`, separate layouts); desktop keyboard shortcuts in learner screens; picture-in-picture or multi-window drag and drop.

## 5. Tests

| File | Level | Coverage |
|---|---|---|
| `packages/design-system/src/__tests__/layout-class.test.ts` | unit | `layoutClassFor` over the six viewports and the boundary rows in §3.1, `0x0`, `NaN`; `short` forces panes 1 and scale 1; phone vs desktop-short discrimination |
| `packages/design-system/src/__tests__/layout.test.ts` (extend) | unit | `tabBarMetrics` side insets and centring; `screenPadding` unchanged |
| `packages/design-system/src/__tests__/tokens-parity.test.ts` (extend) | unit | `design/tokens/layout.v1.md` rows equal `layout` values (the current test parses only the colour table, `:11-15`, so a second parser for `| key | value |` rows is added); manifest `orientation` is `any` |
| `scripts/check-token-drift.mjs` + its test | unit | `layout` added to `KNOWN_KINDS` (`:29`) |
| `apps/mobile/src/logic/layout/__tests__/orientation-guard.test.ts` | unit, 100 % | truth table (phone / tablet, landscape, coarse, allowed, dismissed, `/present`) |
| `apps/mobile/src/logic/layout/__tests__/pane-selection.test.ts` | unit, 100 % | initial selection, reconcile on data change, rotation round trip |
| `apps/mobile/src/logic/layout/__tests__/layout-size.test.ts` | unit, 100 % | every tappable size returned by `logic/layout/*` is >= 64; Journey cell at master 400 and at the narrowest pane window; detail pane width formula |
| `apps/mobile/src/logic/__tests__/trace-layout.test.ts` (extend) | unit | `traceCanvasMax` by class, `side` at 1180x820 content boxes |
| `apps/mobile/src/store/__tests__/layout-store.test.ts` | unit | hydrate, corrupt value, persist `device:layout` |
| `apps/mobile/src/platform/__tests__/orientation.web.test.ts` | platform, >= 70 % | lock only when standalone and phone, failures swallowed, unlock, `coarsePointer` |
| `apps/mobile/e2e/web/layout.spec.ts` (extend, PR #95's file) | e2e | `VIEWPORTS` gains **390x844, 768x1024, 1180x820** (existing 320x568, 375x553, 375x667, 844x390 stay); at 844x390 the `onboard()` helper dismisses the guard once ("Keep sideways") so the four existing tests still pass; each test also asserts no horizontal overflow (`documentElement.scrollWidth <= innerWidth`). Runtime note: every spec inherits the Pixel 5 device of `playwright.config.ts:15` (touch, `isMobile`), so `pointer: coarse` is true at every viewport, which the 844x390 guard case relies on; one extra case at 844x390 with `isMobile: false, hasTouch: false` proves the guard stays away from a mouse. CI cost: three new viewports x four tests, each with onboarding, adds roughly 2-4 minutes (estimate, not measured) to the 20-minute `web-app.yml` job, which runs every `apps/mobile/e2e/web` spec on any PR touching `apps/mobile/` or `packages/`; measure in PR 2a and shard the job (`--shard`) if it passes about 12 minutes |
| `apps/mobile/e2e/web/tablet-layout.spec.ts` (new) | e2e | `#root` width equals the viewport at 768 and 1180; manifest `orientation` is `any`; Journey at 1180x820 shows two panes and selecting a cell changes the right pane without navigating; at 768x1024 it navigates; Library 3 columns and detail pane at 1180; rotate 768x1024 <-> 1024x768 keeps the selection; the 844x390 guard appears, "Keep sideways" removes it and a reload keeps it removed; tab bar is centred and its items >= 64 |
| `apps/mobile/e2e/web/target-size.spec.ts` + fixture (new) | e2e | ratchet audit (§3.8) |
| Screenshots (not a test gate) | manual | `tablet-layout.spec.ts` calls a `shot(page, name)` helper that writes PNGs to `e2e/web/__shots__/` (git-ignored) only when `HR_SHOTS=1`; the PR author attaches Home, Journey and Library at 375x667, 768x1024 and 1180x820 (CLAUDE.md §9). `/design-preview` (F-VR-001, `apps/web`) re-draws design-system primitives as plain HTML and cannot render RN screens such as Home or Journey, so it is only used for a small `layout` token table (breakpoints, caps) added next to the spacing section |
| Manual (device list in the PR) | manual | iPhone with notch in landscape (insets on tab bar and guard), iPad Safari + home-screen PWA portrait / landscape / Split View, Android tablet and phone installed PWA (manifest update lag: Chrome refreshes it on its next check), Chromebook window drag |

Coverage: `packages/design-system` 85 % (pure files), `apps/mobile` logic 90 %, platform 70 %.

## 6. Rollout and PR breakdown (dependency order)

Size S < 300 changed lines, M < 700. Every UI PR links its design mock (`design/screens/…`, produced by the owner in the manual design step, CLAUDE.md §5) and attaches the screenshots of §5.

| PR | Content | Size | Depends on |
|---|---|---|---|
| 0 | `docs(design)`: promote `wireframes/layout-wide.md` to `design/wireframes/layout/` (split per screen if wanted), add the Layout rows to `design/wireframes/README.md` and `docs/blueprints/10-app-map.md`, amend `pwa/system-banners.md` panel 4 (guard gets "Keep sideways"), `TELEMETRY-NAMES.md` rows, the adoption checklist (§3.12) into `.github/pull_request_template.md` | S | none |
| 1 | `feat(design-system)`: `layout` tokens (+ `tokens` aggregate) + `design/tokens/layout.v1.md` + drift script kind + parity tests; `layoutClassFor`; `useLayoutClass`, `LayoutProvider`, `useMediaSize`; `Screen width` and `Screen footer` (+ centring, gutter); `tabBarMetrics` side insets | M | PR #95 (merged) |
| 2a | `feat(mobile)`: delete the `#root` cap (`pwa-postbuild.mjs:44-48`); manifest `any` (+ parity test); `layout.spec.ts` gains 390x844, 768x1024, 1180x820 (guard not yet shipped, so 844x390 unchanged); `tablet-layout.spec.ts` part 1 (`#root`, manifest); measure job time | S | 1 |
| 2b | `feat(mobile)`: `PwaBanners` / `InstallGuideSheet` centred and inset-aware; the `PinEntryScreen` / `PinPad` constant removed; tab bar uses side insets | S | 1 (and F-LEARN-001 PR 4a if it has landed; otherwise edit `PinEntryScreen.tsx:46`) |
| 3 | `feat(mobile)`: `PortraitGuard` + `orientation` platform + `layout-store` + telemetry names + `layout.spec.ts` guard dismissal helper | M | 2a |
| 4 | `refactor(mobile)`: `EpisodeDetailView`, `CardDetailView` extraction (no visible change) | S | 1 |
| 5a | `feat(mobile)`: `SplitPane`, `pane-selection`, Journey pane (lesson / placeholder cells), `tablet-layout.spec.ts` part 2 (Journey) | M | 1, 4 |
| 5b | `feat(mobile)`: Library pane for the Cards section (+ card columns) | S | 5a |
| 5c | `feat(mobile)`: Home two columns | S | 1 |
| 6 | `feat(mobile)`: game and PIN sizing by `mediaScale` / `sideBySide` (Match Sound, Culture Quiz, Odd One Out, Trace, Build a Letter, Card Match, Voice Echo); `traceCanvasMax` | M | 1 |
| 7 | `test(mobile)`: touch-target ratchet audit + fixture; `HR_SHOTS` screenshot helper | S | 5a-5c, 6 |

F-TCH-004 PR 6 may start after layout PR 2a (it needs no panes). Native work is not scheduled.

**Shared files** (expect mechanical rebases; also to be added to `spec-wave-2026-10.md` §5): `packages/design-system/src/tokens.ts`, `design/tokens/`, `scripts/check-token-drift.mjs`, `tokens-parity.test.ts` (PR 1; F-TCH-004 PR 2, F-LEARN-001 PR 3) · `packages/content-schema/src/schemas/telemetry.ts`, its exact-list test and `src/index.ts` (PR 3) · `apps/mobile/scripts/pwa-postbuild.mjs` (PR 2a; F-TCH-004 PR 3, F-AUDIO-004 A-6) · `apps/mobile/App.tsx` (PR 3; F-AUDIO-004 A-4a `installGestureUnlock`, F-I18N-001 PR 3) · `components/PwaBanners.tsx` (PR 2b; F-I18N-001 PR 8b) · `screens/parent/PinEntryScreen.tsx` and `PinPad` (PR 2b, 6; F-LEARN-001 PR 4a / 4b / 6, F-I18N-001 PR 5) · `screens/home/HomeScreen.tsx` (PR 5c; F-I18N-001 PR 6a, F-LEARN-001 PR 5, F-STORY-004 PR 4.4a) · `screens/journey/JourneyScreen.tsx` (PR 5a; F-STORY-005 PR 5.3-5.5) · `screens/library/LibraryScreen.tsx` (PR 5b; F-STORY-004 PR 4.5, F-VOC-003) · `screens/episode/EpisodeDetailScreen.tsx` (PR 4; F-QUEST-002 Q-5b, F-STORY-004 PR 4.6) · `screens/library/CardDetailScreen.tsx` (PR 4; F-AUDIO-004 A-5b) · `screens/minigames/*Game.tsx` (PR 6; F-QUEST-002, F-STORY-003, F-AUDIO-004 A-5) · `navigation/tabs.tsx` (PR 2b) · `e2e/web/layout.spec.ts` (PR 2a, 3; every spec that onboards through the old form, F-LEARN-001 PR 4b). Rule of thumb for order: whichever of PR 4 / 5a-5c and the F-STORY-004 / F-STORY-005 / F-AUDIO-004 PRs lands second rebases.

## 7. Dependencies

- **Upstream**: PR #95 (merged). `react-native-safe-area-context 4.12.0` and `react-native-web ~0.19.13` already in `apps/mobile/package.json`.
- **Downstream**: F-TCH-004 (presenter), F-STORY-002 (replace its "web keeps the 480 px column ... verified on native only" sentence at §3.3 and its "Layout verified at ... the 480 px web column" line in §3.10 (line 355 of the merged spec): the reader's two-column rule and a 720-wide `reading` column now apply on the web), F-STORY-003 (tablet columns), F-QUEST-002 (Discover side-by-side), F-LEARN-001 (sticky footer, `PinPad`), F-I18N-001 (long strings), F-PLC-001 / F-VOC (new screens use the checklist).

## 8. Unverified assumptions and open items

- `screen.orientation.lock('portrait-primary')` working in an installed Android PWA without fullscreen, and Chrome refreshing an installed app's manifest orientation on its own schedule: both are from documentation, not tested on a device. The guard is the safety net.
- Whether the Expo web reset already makes `#root` fill the viewport height once the CSS block is removed (`min-height: 100vh` is in the block being deleted): check in PR 2; if not, add a `height: 100%` rule to the injected shell CSS. **Resolved in PR 2a**: the Expo reset already fills the viewport height (every screen reached in e2e at 390x844, 768x1024 and 1180x820 fills the window with the tab bar at the bottom), so no rule was added.
- `matchMedia('(pointer: coarse)')` is `true` on a touch laptop in tablet mode and `false` on a Chromebook with trackpad; guard behaviour on hybrids is therefore "show only when coarse", accepted.
- `mediaScale` values (1.2 / 1.4) and `maxWidth` (720 / 1120) are starting points; tune in mid-fi on a real iPad before PR 5 merges.
- Two panes at 900-1023 wide leave 412-535 px for the detail pane (`windowWidth - 2 x 32 gutter - 400 master - 24 gap`; the first draft's 440-620 ignored the gutters); the Library flip card at that size is checked in the Library pane PR (5b). If cramped, raise `breakpoint.wide` to 1024 (one token), which also keeps a 960x600 Android tablet single-pane. **Resolved in PR 5b (#187)**: checked at 900x700 and 960x600, the flip card fits the 412-wide pane (art 200, the title wraps cleanly), so `breakpoint.wide` stays 900.
- Selected-episode state is lost on a full page reload (no deep links yet, LD7); acceptable for MVP.
