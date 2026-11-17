# Quest: Previous beside the main button (design pass, QB-1 and QB-2)

Spec: `docs/specs/AMENDMENTS-QUEST-SOUND-BACK.md` rows **QB-1** (Previous inside Look and learn), **QB-2** (Previous between steps), **QB-3** (no score changes)
Wireframes: `design/wireframes/quest/player.md` (section "[QB] Previous"), `design/wireframes/quest/discover.md` (section "[QB] Previous inside the step"), `design/wireframes/quest/check.md` (launcher on a revisit)
Mock: `mock/quest-previous.html` (a board of five cases), `mock/quest-previous-largest.html` (320 wide, Largest text), rules in `mock/quest-previous.css` (token variables of `design/screens/app-shell/mock/app-shell.css` only)
Shots: `shots/mock-board-1280.png`, `shots/mock-board-390.png`, `shots/mock-largest-320.png` (the mock); the app (release `build:web`, `apps/mobile/e2e/web/quest-previous.spec.ts` with `HR_SHOTS=1`): `shots/app-look-and-learn-page2-390x844.png`, `app-look-and-learn-page1-after-previous-390x844.png`, `app-launcher-revisit-390x844.png`, `app-look-and-learn-largest-320x568.png`, `app-launcher-revisit-largest-320x568.png`
Code: `apps/mobile/src/screens/quest/StepActions.tsx` (the row), `QuestPlayerView.tsx`, `DiscoverStep.tsx`; the current-dot marker is `Progress`'s `current` (`packages/design-system/src/components/Progress/`)

## What it is

The owner sometimes moves on in a quest without meaning to. Every step from the second on, and every Look and learn page from the second on, gets **Previous** beside its main button. "Back" in this product means leaving a screen (`AMENDMENTS-LECTURE-V2.md` LV-M1), and the header's Close keeps asking the leave question, so the control is named Previous and never uses the navigation's back.

## The row

```
[ Previous ]  [[      Continue      ]]        <- one line: Previous left (1 share), main right (2 shares)

[[        Continue        ]]                  <- the two cannot share a line (Largest text at 320):
[         Previous         ]                     the row wraps upward, main button first
```

| Part | Component and tokens |
|---|---|
| Row | flex row, `wrap-reverse`, `spacing.sm` gap; neither button shrinks under its label |
| Previous | `Button` tone `secondary`, size `lg` (`touchTarget.child`, 80 high), label `learner.quest.previous.cta` |
| Main button | `Button` tone `primary`, size `lg` in the row (the step's Continue, See results, Play minigame, Go); without Previous the step keeps today's button (hero, full width) |
| Second button | under the row, `Button` tone `ghost`, size `md` (64 high): Skip for now on a first visit, Play again (`learner.quest.launcher.again.cta`) on a revisit |

## Where it shows

| Screen | Previous | Main | Second |
|---|---|---|---|
| Step 1, a narrative step | none (drawn as today) | Continue | |
| Look and learn, page 1 of the first step | none | Continue | |
| Look and learn, page 2 or later | the page before | Continue | |
| Look and learn, page 1, step 2 or later | the step before | Continue | |
| A narrative step, step 2 or later (the finish page too) | the step before | Continue / See results | |
| The finish page with Try these again offered | under the offer's two buttons | (the offer, unchanged) | |
| A game launcher, first visit | the step before | Play minigame | Skip for now |
| The Check launcher, first visit | the step before | Go | none |
| A game or Check launcher on a revisit | the step before | Continue | Play again |
| A game in play, Results | none | | |

A revisit is a step behind the furthest step reached in this run. Arriving on a Look and learn step by Previous opens its last page.

## Dots

Meters only fill (CLAUDE.md section 1). The step dots and the page dots show the furthest step or page reached; when the step or page shown is behind it, that dot carries a ring (`borderWidth.base`, the tone's dark colour, a `borderWidth.base` gap in the surface colour). The count pill ("3 / 6") and the page caption ("Page 1 of 2") name the one shown. With no step taken back the dots are drawn exactly as today.

## Accessibility

- Both buttons are at least 64 high at every text size (80 in the row); the accessible name is the visible label.
- Focus order is Previous, then the main button, the order they are read on one line.
- Previous stops any sound that is playing (the step's and the page's stop paths).
- Nothing about Previous is a warning or a loss: no confirm, no red, no count goes down (QB-3).
- Reduced motion: the row has no motion.
