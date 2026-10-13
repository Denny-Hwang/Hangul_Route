# Learning Route screens: route card, report goal line, stage list page, four-tab bar (design mocks v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`, PR **LR-D** in the section 13 table. The mocks draw sections 4.3 (route card), 4.5 (not open yet, free-end), 5.1 (tab), 6.1 (report goal line, stage list page), 6.2 (local grown-up card), 10 (accessibility) and 11.1 (draft strings).
Wireframes: `design/wireframes/journey/learning-route.md` (A to J), `design/wireframes/parent/learning-route.md` (L1, R, L2), `design/wireframes/console/learning-route.md` (T1 to T3).
Glyphs: `design/components/Icon/learning-route-glyphs.md` (the `route` and `flag` sheet; assumption b).
Built by:
- LR-2: `Icon` `route` and `flag`.
- LR-4: the tab, the header purpose line and the tab label cap.
- LR-5a: the route card, the goal tag and "In your plan".
- LR-5b: not-open pips and the free-end hero.
- LR-5c: the first-time reached line.
- LR-8: the stage list page, the grown-up card and the report goal line.

## What is here

| File | What it fixes |
|---|---|
| `route-card.md` | the learner route card in every state (A, A2, B, C, E, F, D, J) and the local grown-up card (L1); where Hoya sits; the goal tag on the trail |
| `stage-list.md` | the grown-up summary views: the goal cases 1 to 3 shared by both views, the one goal line under the report's "Now on Stage" line, and the stage list page (`/parent/space/route`, `/teach/space/route`) at 320 and 1280 with its grown-up card and its states |
| `tab-bar.md` | the four-tab bar (flag on) next to today's three, the two purpose lines, and large text |
| `mock/` | a static HTML mock on one stylesheet, `learning-route.css`: `route-tab.html`, `route-card.html`, `report.html`, `stage-list-family.html`, `stage-list-class.html`, `stage-list-states.html`, `tab-bar.html` |
| `shots/` | the mock rendered in Chromium at 2x (file names give the page and the viewport width; `-text200` = the browser text size at 200 %, which models the native text size: the text grows and the layout width stays. The app's web build sets text in px, so on web it does not follow this setting; see `tab-bar.md`) |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/learning-route.css` is a token of `packages/design-system/src/tokens.ts`. Each one is copied once into a custom property named after it: `--spacing-xl` is `spacing.xl`, and `--colors-stage-stage1` is `colors.stage.stage1`.
- **Drawn parts.** Pips, stage badges, Hoya and the glyphs are inline SVG drawn from the shipped geometry:
  - `PipRow/geometry.ts`: `pipParts`, `cursorMarkerParts`, `stageSegmentParts`;
  - `Icon/glyphs.ts`;
  - a static port of `Hoya.tsx` (poses `idle` and `cheering`).
  So the shapes in the shots are the shapes the app draws.
- **Units.** Text sizes are in rem, so the 200 % shots enlarge every line. Pips, badges and glyphs keep their dp size, as `design/components/PipRow/spec.md` decides: they follow the layout class, not the font scale.
- **Words.** Every drawn string comes word for word from one of these sources:
  - a dictionary value (`learner.myRoute`, `caregiver.journey`, `console.journey`, `common`);
  - a draft of the amendment (section 11.1);
  - F-REPORT-001's `report.*` drafts;
  - F-ENT-003's `learner.access` and `learner.routeNext` drafts.

  Three strings had no key: the collapsed taste line of E, the J error line and the "Stages" heading of the stage list page. This PR adds their drafts to section 11.1 (with the grown-up twins of the first two); `route-card.md` and `stage-list.md` list them with the PR that adds each.
- **Annotations.** Grey dashed boxes and monospace labels are design-board notes, not UI. They mark the adult shell header, the F-BROWSE-001 slot and the unchanged skills card.

Open any file in a browser (`design/screens/learning-route/mock/route-tab.html`). Links are placeholders.

## Constants

Values that are not tokens. Each one derives from code or a token. LR-4, LR-5a and LR-8 write the UI ones as named constants, never as bare literals (CLAUDE.md section 4); the font stack and the board column say why they need no constant.

| Where | Value | Derived from |
|---|---|---|
| Stage badge | 40 px, inner known disc 20 px | `BADGE_SIZE` in `screens/my-route/StageBadge.tsx` (unchanged) |
| Route card padding below 360 px wide | `spacing.md` instead of `spacing.lg` | `PIP_ROW_MIN_WIDTH` (360, `logic/my-route/view.ts`): the 11 Stage 1 pips (11 x 20 + 10 x `spacing.xs` = 260) fit the 264 px inner width on one line |
| Trail rows below 360 px wide | a fill bar instead of pips on every stage row | `stageRowLook` (R-3, unchanged): `PIP_ROW_MIN_WIDTH`; the route card's goal pips are not a trail row and stay pips |
| Hoya in the card | 64 beside a Hoya line, 48 beside the Next line | `useMediaSize(72)` today in `HeroCard`; 48 keeps the Next row at 48 px, which is what keeps the button on the first screen at 320 x 568 (the budget is in the checks below). LR-5a names it next to that budget |
| Tab label growth cap | 1.3 x `typography.size.caption` (18.2 px), four-tab bar only | measured: the English labels fit 80 dp at 320 up to that size ("Journey" 69 px at the cap). LR-4 sets `maxFontSizeMultiplier` 1.3 with `numberOfLines` 1 and `adjustsFontSizeToFit` on the native label while the flag is on, so a longer ES or KO label ("Biblioteca" 84 px at the cap) shrinks to fit instead of being cut off. React Native Web ignores both props; the web label stays 14 px (see `tab-bar.md`) |
| "In your plan" ring | 16 px, `borderWidth.base` | placeholder for F-ENT-003 E3-D, which owns the ring at pip and cell size |
| Card shadow | `0 2 8` at 0.06 | `shadows.card` (shadowColor `text.primary`) |
| App breakpoints | 600 px, 900 px | `layout.breakpoint` (window classes, F-LAYOUT-001); written in px because the app's classes follow the window in dp, not the text size |
| Font stack | the system stack (`-apple-system`, `Segoe UI`, `Roboto`, ...) | `typography.family.sans` is `'System'`, which the app's web build resolves to this stack by itself; no constant needed |
| Board column | 22rem | design board only, not UI: one card per row at 375, two side by side at 1280 |

The board labels use `typography.family.mono`, and the badge and the sticky tab bar use `z.raised` and `z.sticky`, all as tokens.

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/route-tab-320-first.png` | 320 x 568, first screen | title, purpose line, the narrow route card (LR-11: 15 pips on two lines, no can-do lines) with Continue above the tab bar, the four tabs |
| `shots/app-route-first-320.png`, `app-route-class-plan-first-320.png`, `app-journey-first-320.png` | 320 x 568, first screen | the app's web build with the flag on (LR-11, from `my-route.spec.ts`): a new learner's Route tab with Start, a class-plan learner's Route tab with the longest Stage 1 title as Next and Continue, and the Journey tab; the screenshots of the 5-second check (assumption g) |
| `shots/route-tab-320.png` | 320, full page | the Route tab, state A: card, weekly plan line, trail with "You are here" and "Your goal"; the tab bar is drawn after the page (it is sticky on a real screen) |
| `shots/route-tab-320-text200.png` | 320, text 200 % | the same, every line enlarged; no sideways scroll; tab labels at the cap |
| `shots/route-tab-1280.png` | 1280, full page | one centred reading column (`layout.maxWidth.reading`); the bar centred in `layout.maxWidth.full`, drawn after the page as at 320 |
| `shots/route-card-states-375.png`, `-1280.png` | board | A, A2, B, C (first time and later visits), E, F, D with its trail and legend, L1, J, the three tags on one stage, and the expanded stage with "In your plan" |
| `shots/route-card-three-tags-320.png`, `-320-text200.png` | one board item at 320 | the three tags in their order (here, goal, start): two rows at the default text size, one row each at 200 % (assumption f) |
| `shots/report-goal-line-375.png`, `-1280.png` | board | the report's At a glance block in cases 1, 1 reached, 2, class 2, end of road, the older-device case, and case 3 ("Next open stage") when that stage is the Now stage and when it is not |
| `shots/stage-list-family-320.png`, `-1280.png`, `-320-text200.png` | page | `/parent/space/route`: Sam, case 1 with the secondary family-plan line; the 200 % text shot shows the reflow |
| `shots/stage-list-class-320.png`, `-1280.png` | page | `/teach/space/route`: Mina, case 2 reached, Plan goal tag, start tag |
| `shots/stage-list-states-375.png` | board | loading, not synced, not found, end of road, case 3 (Now stage and another stage), Hoya's suggestion source, cannot reach |
| `shots/tab-bar-320.png`, `-375.png`, `-1280.png`, `-320-text200.png` | board | three tabs (flag off), four tabs with Route or Journey selected, the two headers |
| `shots/native-ios-tab-bar-375-text214.png`, `-text264.png`; `shots/native-ios-three-tags-375-text214.png`, `-text264.png`; `shots/native-ios-route-tab-375-text214.png` | app, iOS Simulator | F-ROUTE-001 R-10b: the native 200 % checks of assumptions a and f on a flag-on Release build made with xcodebuild (iPhone SE 3rd generation, 375 x 667 pt; iOS text sizes Accessibility Large, React Native font scale 2.14, and Accessibility Extra Large, 2.64). Result in the amendment's section 16 R-10b entry |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| Sideways scroll | none at 320, 375 and 1280, and at 320 with 200 % text (section 10) | none on any page (`scrollWidth` equals the viewport on all 20 page and board shots) |
| Primary action on the first screen at 320 x 568 | one tap away (G2) | **Met with the narrow-width card (LR-11, `route-card.md` "Narrow width").** LR-D measured 13 px to spare with 8 Stage 1 pips; with 15 the pips took two lines and the LR-10 run found Continue about 75 px under the tab bar (issue #530). The narrow card drops the can-do lines (the open stage row under it shows them), tightens its gaps and reserves the pip marker bands per line. Mock (15 pips, Next on two lines): Continue ends at 413 px, the bar starts at 491 px, 78 px to spare. App web build (`my-route.spec.ts`, LR-11 cases): Continue with the longest Stage 1 title as Next ends 41 px above the bar; a new learner's Start 27 px above. A native 20 pt status bar moves both down by 20 px and they stay above the bar. R-10b repeats the check on a device or simulator with real insets |
| Route and Journey told apart in 5 seconds (assumption g, LR-OD-3) | a reviewer who has not seen the app names each tab's purpose from the first screen | **Purpose: pass; naming: owner input.** Run again for LR-11 by a fresh reviewer on the three `app-*-first-320.png` shots: purpose, the one action and the tab difference pass; the reviewer's overall verdict was "FAIL on differentiation" because "Route", "Learning Route", "See Learning Route" and "Heritage Journey" cross-reference each other. Full result and reading in the spec's section 16 LR-11 entry; an input to LR-OD-1 and LR-OD-3 before R-10b |
| Tab items at 320 | at least `touchTarget.min` (section 5.1) | four items of 80 x 64 |
| Tab labels at 320 with 200 % text | "Route" on one line (assumption a, met with the native 1.3 x label cap) | every English label on one line at the cap (Today 51, Route 50, Journey 69, Library 60 px of 80); **without a cap, "Journey" and "Library" overflow their 80 px items**. ES and KO drafts measured too; see `tab-bar.md` |
| Three tags on one stage row at 320 (assumption f, as revised by this PR) | at most two rows at the default text size; one row each at 200 %, nothing cut off | **Met** in the order here, goal, start. The tag row is 236 px. At 100 %, "You are here" (100) and "Your goal" (97) share the first row (201 px with the gap), and "You started here" (145) takes the second. With Verdana as a wide fallback font the first row is 230 px; it stays two rows up to 120 % text. At 200 % each tag takes its own row and "You started here" wraps inside its chip. The old order (here, start, goal) took three rows even at 100 %. See `route-card.md` |
| Adult page targets | at least 44 px (section 10) | back link, Open Learning Route, Try again and the reserved slot are 64 px tall (`touchTarget.min`) |
| Adult page at 320 and 1280 | one reading column, reflows at 200 % (section 10) | one column at both sizes; no sideways scroll at 320 with 200 % text |

These are the mock's numbers. LR-4 and LR-10 measure the real screens (`apps/mobile/e2e/web/my-route.spec.ts`), and LR-10 does the same for `apps/web/e2e/learning-route.spec.ts`. The native 200 % checks of assumptions a and f ran on the app in R-10b (the `native-ios-*` shots above).

## Decisions taken in this design pass

- **Hoya sits next to the words Hoya says or points at.**
  - When the card has a Hoya line (start, reached, free-end, end of road, error), Hoya is beside it at the top.
  - When it has none (A, A2, E, L1), the where block (Now and Goal) leads at full width, and Hoya sits beside the Next line, just above the button.
  - This puts the most important fact first and keeps the card short enough for the first screen at 320 x 568.
- **Now and Goal labels sit above their lines.** "Now" and "Goal" are caption words above each line, not to its left, so "Stage 2 · Words" never wraps at 320.
- **The goal line and its source read as one group,** `spacing.xs` apart. Every other part of the card is `spacing.md` apart.
- **E is drawn collapsed.** The wireframe draws Now and Goal both as Stage 2 in screen E but also says they collapse when equal. The mock collapses them: "Explore Stage 2 · Words: you are in your goal stage". LR-3b needs a key for that line (see `route-card.md`, strings).
- **D follows the owner decision of 2026-10-11.** The free plan is all of Stage 1. So the free-end example shows Stage 1 Complete and Stage 2's two shipped quests as "Not open yet", not a part-played Stage 1 as the wireframe drew before that decision.
- **The adult pages have no billing link.** The adult shell header (F-APP-001) is drawn as a placeholder. This amendment adds nothing to it, so there is no billing, plan or price link (LR-OD-8).
- **The stage list rows** use the seven-segment shapes of the R-9a strip at 24 dp (complete, known, explored, open, later), the state word, the can-do line and the count line with zero parts left out. A taste stage's word is "A taste", the learner page's word; LR-7 adds the console key for it. `console.journey.stageLine` still prints "0 quests done" when only the known part is non-zero, so LR-7 drops that part (`stage-list.md`, "Notes for LR-7").
- **Case 3 always shows its line**, as section 6.1 says: "Next open stage: Stage {n} · {title}", with no flag. For a learner with no plan this is usually the Now stage, so the line names the same stage as "Now on". That is still true and useful: it says this stage is the one to finish, and it never claims a goal. Hiding it in that case would change section 6.1, so the board draws it (`stage-list.md`).
- **Tag order: You are here, Your goal, You started here** (where you are, where you are going, where you began). This order fits three tags in two rows at 320, and the old order did not. The spec's assumption f, section 4.3 and the section 10 label order are revised to match in this PR (`route-card.md`).
- **The report's route lines form one region.** "Now on", the goal line and **Open Learning Route** sit in one `section` labelled "Learning Route" under the report's `h1` (section 10). The link moves from the end of the "Now on" line (F-REPORT-001's wireframe) to under the goal line. "Last practice" stays outside the region.
- **Pip-size marks come from F-ENT-003 E3-D.** The "Not open yet" dotted ring and the "In your plan" solid ring at pip and cell size are E3-D's (`design/components/RouteMarkers/`). This board draws placeholders only: today's `later` pip, and a 16 px ring in `border.shape`. LR-5a and LR-5b take the final shapes from E3-D. The amendment fixes only the shared dotted ring with its two words (section 4.5), and this board respects that.
