# Route card: where you are and where you are going (screen spec v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` sections 4.3, 4.4, 4.5, 6.2, 10 · wireframe `design/wireframes/journey/learning-route.md` A to J, `parent/learning-route.md` L1
Mock: `mock/route-card.html` (board of states), `mock/route-tab.html` (the card on the Route tab) · shots `shots/route-card-states-375.png`, `-1280.png`, `shots/route-tab-320-first.png`
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
| D free-end (web, switch on) | "You played every quest that is open for you." | Goal only, "Hoya's suggestion" | — (no ask, no price, no lock) | Practice words (or Open Library) |
| J content cannot be read | "Hoya could not open your Learning Route." | — | — | Try again |
| L1 grown-up, local | — | collapsed in the third person, family source, "Plan ends Dec 20" | "By the end of this stage, Sam can:", pips, Hoya + Next as text | none |

## The trail under the card

- **Goal tag.** The goal stage's row gets the chip `[flag] Your goal` (`surface.sunken`, like the `[pin] You started here` chip). It comes after "You are here" and "You started here". On grown-up pages it reads "{name}'s goal".
- **Not open yet (D).** A not-open quest is the dotted `later` pip. The stage caption reads "Not open yet" when every playable quest of the stage is not open. The legend has two rows with the same dotted ring, "Not open yet" and "Coming later": the word, not the shape, tells them apart (section 4.5).
- **In your plan.** A cell row of an episode in `inPlanEpisodeIds` carries a ring plus the words "In your plan". The ring's final geometry comes from F-ENT-003 E3-D.

## Assumption f (three tags at 320): measured, and an option

- **Measured.** On the mock at 320 the tag row is 236 px wide. The three chips "You are here", "You started here" and "Your goal" do not fit in two rows:
  - At 100 % text they take **three rows**: the first two chips already need 248 px together.
  - At 200 % text they also take three rows, and four text lines, because "You started here" wraps inside its chip.
  - So assumption f does not hold on the mock at either size.
- **Option** (drawn on the board, before the expanded stage): when "You are here" and "Your goal" fall on the same stage, they become one chip, `[flag] You are here · Your goal`.
  - At 100 % the row then takes **two rows**, which meets the assumption.
  - At 200 % it is still two rows, but each chip wraps, so four text lines: no better than three chips.
- **Decision.** This stays an option for LR-5a and LR-10 to decide on the real screen, where the trail row may be wider than the mock's.
  - Until then, LR-5a builds the spec's default (three chips).
  - If LR-10's check confirms the measurement, the chip is adopted for 100 % text, and LR-3b adds one key for it.
  - At 200 % neither form meets "two lines". That needs the owner's call (keep the assumption at 100 % only, or drop it), not a third tag design.

## Accessibility

- **One summary.** The card is one summary block. Its label reads the visible parts in order with digit-free pip words (section 10), for example: "Stage 1, Hangul: you are in your goal stage. From your class's weekly plan. Some quests done, more are ready. Next: Family at the Table."
- **Hidden parts.** Hoya, the glyphs and the pips are hidden from screen readers.
- **Focus.** Focus lands on the card when the tab gains focus.
- **Motion.** The first-reached `cheering` pose is static when motion is reduced.
- **Sizes.** Body text keeps the 18 floor. The button is `touchTarget.child`.

## Strings the mocks need beyond section 11.1

| Key (LR-3b) | Draft | Why |
|---|---|---|
| `learner.myRoute.goal.exploreInGoal(n, title)` | "Explore Stage {n} · {title}: you are in your goal stage" | the collapsed taste line of E (section 4.3 says "or collapsed" for a default taste goal but names no key) |
| `caregiver.journey.goal.from.family` | "From the family's weekly plan" | already in 11.1; listed because L1 uses it |

Everything else on the board is a section 11.1 draft or an existing dictionary value.
