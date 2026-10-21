# Site / `/learners` — three small captures of the app (wireframe)

Spec: `docs/specs/AMENDMENTS-SITE-NEWUSER.md` §3.4, §3.13 (amends F-SITE-002 §3.4), row SN-1. Earlier frame: `learners.md`.
Audience: a learner of any age deciding whether the app looks like something they would enjoy.

## User scenario (Given-When-Then)

- Given a teenager or an adult beginner reads "How most quests work",
- When they reach the three steps,
- Then three real screens (home, a mini-game, a heritage card) show what the words mean, without opening the app.

## Screen goal

1. Show the product truthfully (real captures in the page's language) next to the steps that describe it.

## Box diagram

```
│ H2: How most quests work                                      │
│ 1 Discover · 2 Play · 3 Check (unchanged steps)               │
│ (small Hoya) Hoya never says "wrong."   (unchanged)           │
│ ┌home┐ ┌game┐ ┌card┐   ← three phone frames in one row, always three across (each a third of the column,    │
│ │    │ │    │ │    │      max row width 34rem); each image has its own alt text                              │
│ └────┘ └────┘ └────┘                                          │
│ caption  caption  caption  ← short visible labels: a sampler of real screens, not pictures of steps 1-3       │
│ [See the mini-games v]  (unchanged)                           │
```

States:
- **Success**: as drawn.
- **Empty**: none.
- **Error**: a missing capture keeps its frame (fixed aspect ratio) and its alt text.
- **Large text**: images do not grow with text; the row stays three across and never scrolls sideways.

## Interaction points

- None: the captures are images, not links (the page's primary action, Start learning, sits in the head and closing).

## Navigation graph

- Enter from: home `#who` card, header nav (wide), footer, the parents page's "What learners do".
- Exit to: unchanged (learner app, mini-game and card folds).

## Data needs

- `public/site/<locale>/{home,game,card}.webp`; alt text `landing.captures.home`, `.game`, `.card(word, romanization,
  meaning)` with the card's taught Korean passed as values (CLAUDE.md §1).

## Open questions

- None new. The card shown is the welcome tiger card (horangi), the one every learner owns first.
