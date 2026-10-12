# Route card: where you are and where you are going (screen spec v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` sections 4.3, 4.4, 4.5, 6.2, 10 · wireframe `design/wireframes/journey/learning-route.md` A to J, `parent/learning-route.md` L1
Mock: `mock/route-card.html` (board of states), `mock/route-tab.html` (the card on the Route tab) · shots `shots/route-card-states-375.png`, `-1280.png`, `shots/route-tab-320-first.png`, `shots/route-card-three-tags-320.png`, `-320-text200.png`
Code (planned): `screens/my-route/RouteCard.tsx` (LR-5a), copy selectors in `logic/my-route/copy.ts` (LR-3b)

## Anatomy

`Card` (`radii.lg`, `shadows.card`, padding `spacing.lg`, or `spacing.md` below `PIP_ROW_MIN_WIDTH`). Its parts are a column, `spacing.md` apart:

1. **Hoya line** (only start, reached, free-end, end of road, error): Hoya 64 (`cheering` only for the first reached visit, else `idle`) beside one sentence at `typography.size.prompt`, bold.
2. **Where block**, one group with its source line (`spacing.xs` apart):
   - **Goal equals Now** (collapsed): `[pin][flag]` (20 dp glyphs, `text.primary`) and the line `goal.inGoal` at `prompt` size, bold.
   - **Goal differs**: caption label "Now" over `[pin] Stage {n} · {title}`, then caption label "Goal" over `[flag] ...`, each line at `bodyLg`, bold. Labels are `text.muted`, `weight.semibold`.
   - **Source line**: `bodySm`, `text.secondary` ("From your class's weekly plan", "Hoya's suggestion", ...). Grown-up L1 adds "Plan ends {date}" under it, same style.
3. **Can-do**: lead `canDoLead` (caption, semibold, muted) over the stage line (`body`). Taste goal: the one line `goal.tasteLine` instead. Reached goal: none.
4. **Goal pips**: the goal stage's `PipRow` at 20 dp in the stage colour, with the cursor only when Next is in that stage. No digits, no "of", no bar.
5. **Next row**: with no Hoya line, Hoya 48 beside "Next: {title}" (bold). With a Hoya line, the Next or "Keep going" line alone.
6. **Button**: `Button` `lg` (`touchTarget.child`), primary, full width. The grown-up L1 card has none.

## States (board order)

| State | Hoya line | Where block | Below | Button |
|---|---|---|---|---|
| A goal equals Now (plan) | — | collapsed `goal.inGoal`, source | can-do, pips with cursor, Hoya + Next | Continue |
| A2 goal ahead | — | Now / Goal, source | goal stage can-do, goal stage pips (no cursor), Hoya + Next | Continue |
| B new learner | "Your Learning Route starts here." | Goal only, "Hoya's suggestion" | can-do, open pips with cursor on the first | Start |
| C reached, first time | "You reached your goal. Hoya is proud!" (`cheering`) | Now / Goal "· reached", source | filled pips, "Keep going: {title}" | Continue |
| C later visits | — | as C | filled pips, Hoya `idle` + "Keep going" | Continue |
| E default taste goal | — | collapsed "Explore Stage 2 · Words: you are in your goal stage", "Hoya's suggestion" | "Try the first quests of this stage.", pips | Continue |
| F end of the open road | "You reached the end of the open road. More is coming." | none (no flag anywhere) | — | Open Library (or Open stories) |
| D free-end (web, switch on) | "You played every quest that is open for you." | Goal only, "Hoya's suggestion". The free-end hero has no Now line, so the goal line never collapses, even when here equals the goal stage (the board's trail puts both tags on Stage 2): the label reads "... Goal: Explore Stage 2, Words. Hoya's suggestion." | — (no ask, no price, no lock) | Practice words (or Open Library) |
| J content cannot be read | "Hoya could not open your Learning Route." | — | — | Try again |
| L1 grown-up, local | — | collapsed in the third person, family source, "Plan ends Dec 20" | "By the end of this stage, Sam can:", pips, Hoya + Next as text | none |

## The trail under the card

- **Goal tag.** The goal stage's row gets the chip `[flag] Your goal` (`surface.sunken`, like the `[pin] You started here` chip). On grown-up pages it reads "{name}'s goal" (or "Plan goal", case 2 of `stage-list.md`).
- **Tag order.** "You are here", then "Your goal", then "You started here": where you are, where you are going, where you began. The same order on grown-up rows. This order is what keeps three tags in two rows at 320 (next section).
- **Not open yet (D).** A not-open quest is the dotted `later` pip. The stage caption reads "Not open yet" when every playable quest of the stage is not open. The legend has two rows with the same dotted ring, "Not open yet" and "Coming later": the word, not the shape, tells them apart (section 4.5).
- **In your plan.** A cell row of an episode in `inPlanEpisodeIds` carries a ring plus the words "In your plan". The ring's final geometry comes from F-ENT-003 E3-D.

## Three tags at 320 (assumption f)

The shots `route-card-three-tags-320.png` and `-320-text200.png` show one stage with all three tags. The tag row is 236 px wide at 320 (the trail body beside the 40 px badge).

| Text size | Chip widths (px) | Rows | Text lines |
|---|---|---|---|
| 100 % | here 100, goal 97, start 145 | 2: "You are here" and "Your goal" (201 with the gap), then "You started here" | 2 |
| 100 %, Verdana (a wide fallback font) | here 117, goal 109, start 165 | 2 (first row 230) | 2 |
| 120 % | here 113, goal 107, start 163 | 2 (first row 224) | 2 |
| 200 % | here 173, goal 152, start 236 | 3, one tag each | 4: "You started here" wraps inside its chip |

- **Settled for LR-5a.** The order is here, goal, start. Tags wrap to the next row, never scroll, and a long tag may wrap inside its chip. Nothing is cut off. A chip keeps its `radii.pill` and its glyph stays centred when its text takes two lines.
- **Why not "two lines at 200 %".** At 200 %, "You are here" and "Your goal" are already wider together (329 px) than the 236 px row. So no order and no chip design fits three tags in two lines at 200 %. One merged chip ("You are here · Your goal") was tried: it is no shorter, and it needs a new key. The spec's assumption f is revised in this PR to "two rows at the default text size, one row each at 200 %" (section 14 and its review log).
- **The old order** (here, start, goal) took three rows even at 100 %: "You are here" and "You started here" need 249 px together.
- **For LR-5a (code).** Today `stageRowView` marks the pin by position: `pin: row.isStart && index === tags.length - 1` (`logic/my-route/view.ts`). With the goal tag in the middle, LR-5a gives `TagView` a glyph per tag (`'pin' | 'flag' | null`) instead of the position rule. `TagChip` draws `Icon` `flag` (LR-2) at 16 dp, the same size as the pin.
- **The row label** follows the same order: "... You are here. Your goal. You started here. ..." (section 10, as revised).

## Accessibility

- **One summary.** The card is one summary block. Its label reads the visible parts in order with digit-free pip words (section 10), for example: "Stage 1, Hangul: you are in your goal stage. From your class's weekly plan. Some quests done, more are ready. Next: Family at the Table."
- **Hidden parts.** Hoya, the glyphs and the pips are hidden from screen readers.
- **Focus.** Focus lands on the card when the tab gains focus.
- **Motion.** The first-reached `cheering` pose is static when motion is reduced.
- **Sizes.** Body text keeps the 18 floor. The button is `touchTarget.child`.

## Strings the mocks needed, and the PR that ships each key

| Key | Draft | Why |
|---|---|---|
| `learner.myRoute.goal.exploreInGoal(n, title)` (LR-3b) | "Explore Stage {n} · {title}: you are in your goal stage" | the collapsed taste line of E. Section 4.3's rule collapses Now and Goal when they are the same stage, and wireframe E's note gives these words (`journey/learning-route.md`, "When Now is also Stage 2"), but no key existed. **Added to section 11.1 by this PR**, with the grown-up twin `caregiver.journey.goal.exploreInGoal(name, n, title)`, and section 4.3's taste row now says "(or collapsed)" |
| `learner.myRoute.hero.error` (LR-3b) | "Hoya could not open your Learning Route." | the J state. F-ROUTE-001 section 3.17 asks for "hero and an inline retry" but names no words; this is the wireframe's J line. The button reuses `common.buttons.tryAgain`. **Added to section 11.1 by this PR**, with the grown-up twin `caregiver.journey.error(name)` "Hoya could not open {name}'s Learning Route." |
| `caregiver.journey.goal.from.family` (LR-3b) | "From the family's weekly plan" | already in 11.1; listed because L1 uses it |

**F-ENT-003's words, not yet on main.** These are drawn from F-ENT-003's drafts (its section 3.11 and Appendix A). They arrive with F-ENT-003's string PRs (`learner.routeNext` in E3-4, `learner.access` in E3-6), and LR-5a and LR-5b use them through their keys, never as copies:
- `learner.access.openForYou`: "You played every quest that is open for you.";
- `learner.access.practiceWords.cta`: "Practice words";
- `learner.routeNext.tag.inPlan`: "In your plan".

`learner.myRoute.state.notOpen` ("Not open yet") is already on main, and the legend row "Not open yet" is the new `legend.notOpen`, which carries the same value (section 7.3).

Everything else on the board is a section 11.1 draft or an existing dictionary value.
