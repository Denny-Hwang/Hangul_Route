# Paywall/Free state — what is free (Day 1 and Day 2) and what the full route adds (wireframe v1)

Spec: `docs/specs/F-ENT-003-free-day2-unlocked-curriculum.md` §3.9 (paywall), §3.11 (copy), §3.15 (child safety) · amends the free state of `paywall/upgrade.md` (F-ENT-001 §3.5); covered and premium states unchanged
Audience: **parent or self-learner** — reached only through `profiles/pin-entry` (or directly on a self-only device with no PIN, `gateOpensDirectly`)
Code: `apps/mobile/src/screens/paywall/PaywallScreen.tsx`, `apps/mobile/src/logic/paywall.ts`, `packages/content-schema/src/catalog/route-days.ts`

## Scenario (Given-When-Then)

Given: a learner tapped "Ask a grown-up" on a lesson past Day 2, on the Home free-end card, on Results or on a Library tile, and an adult passed the gate (switch on, learner free)
When: the paywall renders
Then: the adult reads exactly what is free and stays theirs, then what the full route adds, with one offer and one button to the web console

## Screen goal

"Say what is free first, plainly, then one offer."

## Box diagram (free state, switch on)

```
+--------------------------------------------+
| [<- back]                                  |
|            [hoya idle]                     |
|                                            |
| What is free                    (heading)  |
|  - Day 1 and Day 2 of the route:           |
|    {6} quests, {18} letters                |  <- counts from data, never typed
|  - {6} short stories                       |
|  - {4} word topics                         |
|  - Everything your learner finished        |
|    stays theirs.                           |
|                                            |
| What Family Lifetime unlocks   (heading)   |  <- existing offer block
|  - Every lesson of every Stage, now and    |  <- first bullet changed
|    later                                   |
|  - Cloud save on every device              |
|  - Grown-up dashboard and plans            |
|  - Up to 5 learners                        |
|  +--------------------------------------+  |
|  | Family Lifetime   price (sandbox)    |  |  <- PLAN_PRICING via formatUsd
|  | one payment, nothing to cancel       |  |
|  +--------------------------------------+  |
| [[ OPEN THE WEB CONSOLE ]]                 |  <- target owned by the item 12 spec
| promo hint line                            |
| terms line                                 |
+--------------------------------------------+
```

- A line whose count is 0 is not shown (no sampler story is bundled today, so the stories line is hidden until one is); counts come only from content in this build.
- With the switch **off**, the free state is unchanged ("Stage 1 is always free."), because no limit is enforced.
- Covered (class or school) and premium states: unchanged, no prices.
- No countdown, no "limited time", no comparison with other learners.

## Interaction points

- [[ OPEN THE WEB CONSOLE ]] -> external browser (`consoleBillingUrl()` today; moved by the billing-on-app spec); `paywall.console_opened` (unchanged).
- [<- back] -> the surface that opened the paywall (`from`: journey, settings, library, episode, home, results).
- Opening fires `paywall.viewed { state, from }` with the three new `from` values.

## Navigation graph

Enter from: `profiles/pin-entry` (next: Paywall) from `episode/detail-access-preview`, `home/next-and-free-end-card`, `results/back-to-plan-and-free-end`, `library/access-and-plan-tags`, Profile plan card
Exit to: web console billing (browser) · back to the opening surface · Journey (covered / premium states)

## States

- **Free, switch on**: as drawn.
- **Free, switch off**: today's free state.
- **Covered / premium**: unchanged.
- **Empty** (catalogue has no free day, impossible by test): the What is free block hides the days line.
- **Error** (console URL cannot open): today's inline note with the URL.

## Accessibility

- Headings are headings; the free list is a list; the counts are read as numbers inside the sentence. Button via `Button`; focus lands on "What is free".

## Data needs

- `freeRouteQuestIds(CATALOG)` and the catalogue's `teaches` for the letters count; sampler count from the story registry; free topic count from `FREE_VOCAB_TOPIC_IDS`; `PLAN_PRICING` (sandbox); `effectiveTier` for the state.

## Open questions

- OD-9 (default: the What is free block replaces the Stage 1 line while the switch is on).
- The landing guide uses the same wording when the owner flips the switch (owner item 2 spec).
