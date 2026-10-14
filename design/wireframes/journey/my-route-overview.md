# My route: the whole journey at a glance, and the weekly plan proposal after the level check (wireframe v2)

> **Renamed 2026-10-11: the page is now LEARNING ROUTE** (`docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md`). Read every "My route" below as "Learning Route". This file stays valid for the trail, pips, expanded stage, skills, gains and states. What changed is drawn in `journey/learning-route.md` (Route tab, route card with Now / Goal / goal-stage pips / Next from F-ENT-003's `routeNext`, goal tag, F-ENT-003's closed pips and free-end hero), `parent/learning-route.md` and `console/learning-route.md` (read-only views for parents and teachers: the card in the per-learner report and the stage list page). The hero of A, C1 and C4 is replaced by the route card; the Journey header entry of D now opens the Route tab; the parent dashboard row (H) opens the read-only page, always read-only. **Tag order (LR-D, 2026-10-12):** a stage row's tags read "You are here", "Your goal", "You started here", in that order (`design/screens/learning-route/route-card.md`); the `[pin You started here] [You are here]` drawings below predate it, and the LR-D order replaces them.

Specs: `docs/specs/F-ROUTE-001-my-route-overview.md` (3.1 entries, 3.3 stage state, 3.4 pips, 3.5 hero, 3.7 skills, 3.9 weekly plan line, 3.11 layout, 3.12 grown-up views) · `docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md` (AM-1 / AM-2 / AM-5 / AM-14 result and report, FP-B3 / FP-B6 proposal: screens J and K)
Audience: anyone learning Hangul, any age (CLAUDE.md section 1). Learner screens work for a child alone (big targets, short words) and for an adult (quiet, no baby talk). Grown-up and teacher screens (C6, H, I, K2) are behind the PIN gate or in the console.
Code (planned): `screens/my-route/{MyRouteScreen,HeroCard,StageRow,LaterRow,CellList,SkillsCard,GainsCard,PlanLine}.tsx`, `logic/my-route/*`, `screens/home/HomeScreen.tsx` (strip), `screens/journey/JourneyScreen.tsx` (header button only), `screens/parent/ParentDashboardScreen.tsx` (journey row), `screens/route/RouteProposalScreen.tsx` (F-PLAN-002), `apps/web/src/app/teach/space/page.tsx` + `lib/console/journey-strip.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `v` a disclosure. No colours, fonts or pixel sizes except the pip sizes the spec fixes. Every sentence is a placeholder; final strings are in the dictionary.

**Owner decision 2026-10-10:** reading, listening and writing only. No screen in this file shows speaking in any form.

Pip legend — **documentation only.** The characters below stand for drawn shapes; the build draws every pip, the cursor marker and the start marker with `View` / SVG parts in `PipRow` (design-system), never with text characters (several of these render as colour emoji on iOS).

```
 (D)  done     filled disc
 (K)  known    ring with a thick inner disc (half the diameter)   placed out by the level check; NOT done
 (O)  open     ring                                               playable, not done
 (N)  new      ring with a small sparkle inside                   joined a stage that was already Complete
 (L)  later    dotted ring (4+ dashes)                            cell not shipped yet
  ^   cursor   small drawn marker above the next quest's pip
 pin  start    "You started here" tag with the pin glyph on the stage row
```

Sizes: 20 dp pips in a stage row, 24 dp in a cell row. Below 360 dp of width the stage row shows its caption and a plain fill bar instead (the stage sheet still has the pips and a legend).

Screens:

- A. My route, phone, mid-progress (today's bundle)
- B. A stage expanded (cells, can-do line, letter wall)
- C. States: new learner, placed learner, known stage, rest, new quests joined, weekly plan line, read-only (grown-up)
- D. Entries: Journey header button, Home strip
- E. Regular and wide (one reading column)
- G. Phone landscape
- H. Parent dashboard journey row
- I. Console roster card strip
- J. After the level check: result with the weekly plan strip (self) and the child variant
- K. The weekly plan proposal screen (self, grown-up, update after a retake)
- L. Empty, error, offline, text alternative

(F, the two-pane layout of v1, is removed: no two panes in this version.)

## Scenario (Given-When-Then)

Given: someone is learning Hangul on a phone, a tablet or a laptop, with or without a level check, with or without a weekly plan
When: they open My route from the Journey header, Home or the level-check result
Then: they see the seven stages as one road, where they started, where they are, what they have done, what comes next and what their quests practiced, with shapes that only fill and no number that compares them to anything

## Screen goal

"Know where I am on the whole road, in one look, and take the next step in one tap."

---

## A. My route, phone, mid-progress (compact, 320 to 599)

Default entitlement (every shipped stage playable, as the app does today), no level check; done: `letters-q1..q3`, `life-q1`; cursor `life-q2`.

```
┌──────────────────────────────────┐
│ [<]  My route                    │
│ ┌──────────────────────────────┐ │   hero card: Hoya + one sentence + the ONE primary action
│ │ (Hoya)  You are on Stage 1:  │ │
│ │         Hangul.              │ │
│ │ Next: Family at the Table    │ │
│ │ [[        Continue        ]] │ │   -> QuestPlayer for the cursor quest
│ └──────────────────────────────┘ │
│  Week 3 · Next in your weekly    │   weekly plan line: ONLY when a plan exists (C5); no dots
│  plan: Family at the Table  [Open plan]
│                                  │
│  (1)━━ Hangul             [Open] │   stage row = one button, >= 64 tall
│   ┃   4 quests played            │
│   ┃          ^                   │   cursor marker over the 5th pip
│   ┃   (D)(D)(D)(D)(O)(O)(O)(O)   │   one drawn shape per quest; no bar behind them
│   ┃   [You are here]             │
│   ┃                              │   connector: solid down to the last stage reached
│  (2)┄┄ Words           [A taste] │   two shipped quests, three cells not shipped
│   ┆   Ready when you are         │
│   ┆   (O)(O) (L)(L)(L)           │
│  (3)┄┄ Sentences · Coming later  │   compact row, no pips
│  (4)┄┄ Dialogue        [A taste] │
│   ┆   (O) (L)(L)(L)(L)           │
│  (5-7) Stages 5 to 7 · Coming later   v   consecutive later stages merged; tap expands
│                                  │
│  What your quests practice       │   an inventory of finished quests, not a test
│  Read    (D)(D)(D) ( )  In 4 quests you finished    faint slot: the next mark is reachable
│  Listen  (D)(D)(D) ( )  In 4 quests you finished
│  Write   (D)            In 1 quest you finished     no slot: no second trace quest exists yet
│                                  │
│  [star] 9   [card] 3             │   gains: absolute numbers, hidden when zero
└──────────────────────────────────┘
```

- Stage row tap -> expands in place (B). One row open at a time; the `here` stage is open on first view.
- Pips are decoration for sighted users; the row label carries the facts for screen readers (L).
- No percent, no `x / y`, no ranking, no "level" as a grade, no "Premium", no digits except counts, "Stage N", "Week N" and dates.

## Interaction points (A)

- [[ Continue ]] -> `QuestPlayer { questId, episodeId }` of the cursor
- Stage row -> expand / collapse (`route_map.stage_opened`)
- "Stages 5 to 7" row -> expands to three compact rows
- Skill row -> bottom sheet "Games that count for Read" (static list of game names)
- [Open plan] -> F-PLAN-002 `RouteOverview`
- Gains: card tile -> Library; stories tile -> Library stories shelf when it exists
- [<] -> previous screen

---

## B. A stage expanded

```
│  (1)━━ Hangul             [Open] │
│   ┃   (D)(D)(D)(D)(O)(O)(O)(O)   │
│   ┃   ┌────────────────────────┐ │
│   ┃   │ By the end of this     │ │   can-do line: no number, no target
│   ┃   │ stage you can: read any│ │
│   ┃   │ Hangul letter and      │ │
│   ┃   │ syllable and know its  │ │
│   ┃   │ sound.                 │ │
│   ┃   │ (Read) (Listen) (Write)│ │   "This stage builds" chips: intent, not a target
│   ┃   │                        │ │
│   ┃   │ Letters & Books        │ │   cell row: theme, episode title, pips, a word
│   ┃   │ Meet the Letters       │ │
│   ┃   │ (D)(D)(D)     Complete │ │   whole row is the button -> EpisodeDetail
│   ┃   │ Food & Daily Life      │ │
│   ┃   │ Around the Korean Table│ │
│   ┃   │ (D)(O)         Playing │ │   a word, not a fraction
│   ┃   │ Holidays & Traditions  │ │
│   ┃   │ (O)               Open │ │
│   ┃   │ Nature & Animals (O) Open
│   ┃   │ Play & Crafts    (O) Open
│   ┃   │ [ What the shapes mean ]│ │   pip legend (drawn shapes + words)
│   ┃   └────────────────────────┘ │
│   ┃   Letter wall  (R-7c: after F-QUEST-002 Q-6a, lit symbols only; complete after Q-8)
│   ┃   [ Letter wall ]            │   ghost button, opens in place (like the legend)
│   ┃   A letter lights up once the│
│   ┃   quest that teaches it is   │
│   ┃   done.                      │
│   ┃   [#] Met in a quest         │   legend: a small tile per state shown
│   ┃   [o] Already known          │
│   ┃   [ ] Coming up in a quest   │
│   ┃   ┌────────────────────────┐ │
│   ┃   │ ~~ ㅏ a ~~  ~~ ㅓ eo ~~ │ │   lit = met in a finished quest
│   ┃   │ ~~ ㄱ g ~~  ...         │ │   outlined = taught by a quest the level check placed out
│   ┃   └────────────────────────┘ │
```

Letter wall rules (R-7c):

- The 30 Stage 1 symbols in teaching order, each one `KoreanText` size `sm`: the letter, its sound, and the gloss "at the end" for a final consonant, so `ㄴ` and the final `ㄴ` never read alike. Romanization always shows (the letters are taught content).
- **Lit** (`[#]`): a warm fill (`brand.primaryLight`) and a drawn check; taught by a finished Stage 1 quest (the union of `questTeaches` over the done quests). Every Stage 1 quest is open, so a learner may skip ahead: a finished later quest lights only its own letters, never the ones before it. In teaching order this is the same as `symbolsMetThrough`.
- **Outlined** (`[o]`): a ring in `border.shape`; covered by the level check (the `teaches` of a placed-out quest). Finishing a later quest leaves these outlined.
- **Plain** (`[ ]`): no frame; not met yet. Never greyed out and never counted ("12 to go" is banned).
- Closed by default, so the open stage stays short on a phone; the legend lists only the states the wall shows. The tiles are one list, each tile a list item, and each letter is one screen-reader item: "ㄴ, n, at the end. Already known."
- A tile is 72 wide at 1x and grows with the device text size (`letterTileWidth`), so a large letter chip stays inside its tile and the row wraps to fewer tiles.
- No wall when no quest has a Discover step; All lessons (expandable off) never draws it.

A `later` stage expands to its can-do line, its chips and "It will appear here when it is ready." No lock icon, no price.

---

## C. Page states

### C1. New learner (nothing done, no level check)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya)  Your Hangul route    │ │
│ │         starts here.         │ │
│ │ Your first goal: read every  │ │   goal line (OD-9), no number
│ │ Hangul letter.               │ │
│ │ [[         Start         ]]  │ │   -> the first quest
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   Ready when you are         │
│   ┃    ^                         │
│   ┃   (O)(O)(O)(O)(O)(O)(O)(O)   │
│   ┃   [You are here]             │
│  ...                             │
│  What your quests practice       │
│  Read     Ready when you are     │   no empty slots before the first mark
│  Listen   Ready when you are     │
│  Write    Ready when you are     │
│  (gains hidden: all zero)        │
```

### C2. Placed learner, Stage 1 (R-7a: after F-PLC-001 P-5 and F-QUEST-002 Q-6a; 15-quest fixture)

Placed out `q1..q6`, nothing done, start `q7`. Learner wording never names the band.

```
│  (1)━━ Hangul             [Open] │
│   ┃   Ready when you are         │
│   ┃                       ^      │
│   ┃   (K)(K)(K)(K)(K)(K)(O)(O)(O)(O)(O)(O)(O)(O)(O)   wraps to a second line when needed
│   ┃   [pin You started here] [You are here]
```

- `(K)` pips do not count in "N quests played" and add no star, card or latch.
- Before Q-6a fills `teaches`, a Stage 1 level check places nothing out, so this state appears only for Stage 2+ placements (C3).
- A grown-up override that puts quests back turns `(K)` into `(O)`; `(D)` never changes.

### C3. Placed into Stage 2: Stage 1 reads "You knew this"

```
│  (1)━━ Hangul      [You knew this]│   ring-with-disc badge, never the Complete badge
│   ┃   You knew this              │
│   ┃   (K)(K)(K)(K)(K)(K)(K)(K)   │
│   ┃                              │   connector passes through
│  (2)━━ Words           [A taste] │
│   ┃    ^                         │
│   ┃   (O)(O) (L)(L)(L)           │
│   ┃   [pin You started here] [You are here]
```

### C4. Rest (everything open is done)

```
│ ┌──────────────────────────────┐ │
│ │ (Hoya)  You did everything   │ │
│ │ that is open right now. More │ │
│ │ is coming.                   │ │
│ │ [[      Open stories     ]]  │ │   or [ Open Library ] when no reviewed story exists
│ └──────────────────────────────┘ │
│  (1)━━ Hangul         [Complete] │   check-in-circle badge; latched (stays Complete)
│   ┃   8 quests played            │
│   ┃   (D)(D)(D)(D)(D)(D)(D)(D)   │
│  (2)━━ Words          [Explored] │   all shipped quests done; never "Complete"
│   ┃   You explored everything that is open right now
│   ┃   (D)(D) (L)(L)(L)           │
│  (4)━━ Dialogue       [Explored] │
│   ┃   [You are here]             │   highest stage with progress
```

If the owner picks the other branch of OD-4 (free tier skips Stage 2 / 4), those rows read **Not open yet** (never "coming", never "Premium").

### C5. New quests joined a Complete stage (content grew after the learner finished)

```
│  [sparkle] 7 new quests joined Stage 1.     shown once; a gain, never a deficit
│  (1)━━ Hangul         [Complete] │   stays Complete (latched)
│   ┃   8 quests played · New quests joined
│   ┃   (D)(D)(D)(D)(D)(D)(D)(D)   (N)(N)(N)(N)(N)(N)(N)
│   ┃   └── earned group ──────┘   └── new group, after a gap ──┘
```

The earned group stays fully filled; new pips never sit among the earned ones.

### C6. Weekly plan line (R-7b: after F-PLAN-002 P2-7a)

```
│  Week 3 · Next in your weekly plan: Meet the Vowels   [ Open plan ]
```

- One line; no dots, no week strip, no "this week" count. Screen-reader label = the visible text.
- Before the start: "Your weekly plan starts on Mon, Oct 12." After the end: "Your weekly plan is finished." + `[ Make a new plan ]`.
- No plan, feature on, not dismissed: `Hoya can make a weekly plan for you  [ Make my plan ]` (opens K).

### C7. Read-only (a grown-up opens a child's page from the dashboard, gate open)

```
│ [<]  My route                    │
│  Viewing Sam's journey           │
│ ┌──────────────────────────────┐ │
│ │ Sam is on Stage 1: Hangul.   │ │   third person; no hero button
│ └──────────────────────────────┘ │
│  (1)━━ Hangul             [Open] │
│   ┃   4 quests played            │
│   ┃   [Sam started here]         │
│  What Sam's quests practice      │
│  Read   (D)(D)(D)  In 4 quests Sam finished
│  Listen (D)(D)(D)  In 4 quests Sam finished
│  Write  (D)        In 1 quest Sam finished
│  Spelling with tiles: 2 quests   │   grown-up only line
│  "The level check looks at reading and listening. Writing is practiced with
│   tracing games and is not scored. The rows count finished quests that include
│   these games; a game skipped inside a quest still counts."
```

No telemetry, no `seen` write. Gate closed -> `PinEntry` instead of this page.

---

## D. Entries

```
Journey tab header (R-3, the first entry):    Home (R-4b, replaces the "Stage 1 progress" bar):
┌──────────────────────────────┐              ┌──────────────────────────────────┐
│ Heritage Journey             │              │ Today with Hoya  (mission cards) │
│ 7 stages x 5 themes. ...     │              │ (story card, quiet card: see the │
│ [ See my route ]             │              │  Home stack order, spec 6.4)     │
└──────────────────────────────┘              │ ┌──────────────────────────────┐ │
                                              │ │ My route                  >  │ │
                                              │ │ You are on Stage 1: Hangul   │ │
                                              │ │ (D)(D)(D)(D)(O)(O)(O)(O)     │ │
                                              │ │ ■ □ □ □ □ □ □  seven stages  │ │   drawn segments
                                              │ │ Week 3 of your weekly plan   │ │   only when a plan exists
                                              │ └──────────────────────────────┘ │
                                              │ Homework card ...                │
                                              └──────────────────────────────────┘
```

No Profile row for My route (Profile keeps "Make a weekly plan").

---

## E. Regular and wide (>= 600)

```
┌──────────────────────────────────────────────┐
│        ┌────────────────────────────┐        │   one centred reading column (Screen width="reading")
│        │ [<] My route               │        │   same order as A
│        │ hero ...                   │        │   pips, badges and Hoya scale with the media size
│        │ trail ...                  │        │   type does not change; targets stay >= 64
│        └────────────────────────────┘        │
└──────────────────────────────────────────────┘
```

---

## G. Phone landscape (short, e.g. 844 x 390)

One column, the page scrolls; the hero is at the top. A stage row wider than 600 puts the pips on the title line.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [<] My route     (Hoya) You are on Stage 1: Hangul.        [[ Continue ]]  │
│ (1)━ Hangul [Open]   (D)(D)(D)(D)(O)(O)(O)(O)   4 quests played  [You are here] │
│ (2)┄ Words [A taste] (O)(O) (L)(L)(L)                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## H. Parent dashboard, compact journey row (in-app, behind the gate; R-9b on top of i18n PR 8a)

```
┌──────────────────────────────────────────┐
│ (avatar) Sam              [Some reading] │   existing header
│ Quests 4  Cards 3  Sessions 5  Minutes 38 │  existing stats (dictionary after PR 8a)
│ ──────────────────────────────────────── │
│ Journey                                  │
│ ■ □ □ □ □ □ □   (7 drawn segments)       │   text list for screen readers
│ Now: Stage 1 · Hangul                    │
│ Started: Stage 1 · Letters and sounds · Oct 9   (only with a level check)
│ Read (D)(D)(D)  Listen (D)(D)(D)  Write (D)     │
│ Spelling with tiles: 2 quests            │
│ "The level check looks at reading and listening. Writing is practiced with
│  tracing games and is not scored. The rows count finished quests that include
│  these games; a game skipped inside a quest still counts."
│ [ See journey ]                          │   -> MyRoute { profileId } read-only (C7)
│ Recent                                   │   existing
└──────────────────────────────────────────┘
```

- No comparison between profiles, no "ahead" / "behind", no ratio.

---

## I. Console: roster card strip (class and family spaces; not school, not the console home)

Added under the existing lines of the roster card (`teach/space/page.tsx:161-168`). Data: `summary.journey`.

```
┌──────────────────────────────────────┐
│ (avatar) Mina               [Some reading] │
│ Last active today                     │
│ Quests 4 / 8 · 3 cards                │   existing
│ 38 min this week                      │
│ Starting spot: Stage 2 · Words · Oct 9      (F-PLC-001, when a level check exists)
│ Journey  ■ ■ □ □ □ □ □   On Stage 2   │   drawn segments + word list
│ v Stage by stage                      │   <details>
│    Stage 1 · Hangul: 8 known from the level check, 0 quests done
│    Stage 2 · Words: 1 quest done      │   "known" part only when > 0; never "N / total"
│    Stages 3 to 7: coming later        │
└──────────────────────────────────────┘
```

- Cards stay in recent-activity order. No class average, no distribution, no sort or filter by stage. No "not included" line (the roster has no tier).
- `summary.journey` absent or malformed: the journey lines are omitted; the device's sync is never refused for it.

---

## J. After the level check: the result screen with the weekly plan strip

Amends F-PLC-001 `placement/result` (AM-1, AM-14). The mini grid and the three route cards stay.

### J1. Self profile (`effectiveLearnerType` self, on any device), `flags.routeEnabled`

```
┌──────────────────────────────────┐
│ (Hoya cheering)                   │
│ Hoya found your starting spot!    │   not-tested run: "Here is a good place to start" + J3
│ [mini grid: pin on the start cell, outline on known cells]
│ Start here: <quest title>         │
│ Next: ...         Later: ...      │
│ ┌──────────────────────────────┐  │
│ │ Hoya made a weekly plan for  │  │
│ │ you                          │  │
│ │ 4 weeks · 3 days a week      │  │
│ │ about 15 minutes a day       │  │
│ │ (Gentle 2) (o Steady 3) (Brisk 4)  pace chips, one pre-selected
│ │ [[    Use this plan     ]]   │  │   one tap: creates the plan, opens the start quest
│ │ [ Change ]                   │  │   -> K
│ └──────────────────────────────┘  │
│ [ Just start ]                    │   skip and play; hides the plan prompt for 14 days
│ See my route      For grown-ups   │   two links (See the whole map while My route's flag is off)
└──────────────────────────────────┘
```

- Four actions; **Use this plan** is the only primary. No PIN is asked for a self profile's own plan, even on a device with a PIN or with child profiles on it (OD-14, decided 2026-10-14); a child profile goes through the grown-up gate (J2).
- Retake that changes nothing: "Your plan stays right where it is." and no strip. Retake that finds more: K3.
- Nothing to schedule (e.g. placed at Stage 2+ on today's bundle): no strip; the existing "You know a lot!" screen is unchanged.

### J2. Child profile

Primary **Start**, links **See my route** and **For grown-ups: set up a weekly plan**. No plan is pitched to the child; behind the gate the report's first card is the proposal (K2).

### J3. Reading was not tested (sound guide was shown)

```
│ Here is a good place to start     │
│ We checked listening and shapes. To find where to start reading,
│ try the check with the sound guide hidden.
│ [ Try it with the sound guide hidden ]     one-tap retake
│ (weekly plan strip below, as J1)  │
```

---

## K. The weekly plan proposal (`route/proposal`)

### K1. Self: one tap, or change pace, length and start day

```
┌──────────────────────────────────┐
│ [<]  Your weekly plan             │
│ (Hoya) Hoya made a weekly plan for you.
│ "Stage 1 first."                  │   headline from a code
│  How many days a week?            │
│ (Gentle 2) (o Steady 3) (Brisk 4) │
│  How long?                        │
│ (o) 4 weeks           [Hoya suggests]
│     "About 3 weeks of lessons are ready now. The rest is free practice."   (today's bundle)
│ ( ) 12 weeks                      │
│     "About 3 weeks of lessons are ready now. The rest is free practice."
│ ( ) 6 months                      │
│     "About 3 weeks of lessons are ready now. The rest is free practice."
│ ( ) Choose weeks                  │
│  Starts   (o) Today  ( ) Tomorrow  ( ) Pick a day
│  v Change days and time           │
│  First week                       │
│   Mon  Meet g, n, d, l            │   spreadDates for 3 a week from a Monday: Mon, Wed, Sat
│   Wed  Meet m, b, s, ng           │
│   Sat  Meet the Vowels            │
│ [[    Start this plan     ]]      │
│ [ Not now ]                       │   hides the prompt for 14 days or until the next result
└──────────────────────────────────┘
```

On the frozen fixture (after Q-8 and reviewed stories) the same screen pre-selects 12 weeks: "Stage 1 is done around week 7, then heritage stories." and the 4-week card reads "The first part of Stage 1 fits in 4 weeks; more weeks finish it." (`lessons-cut-short`; a card never claims a finish the draft does not reach).

- No preview line says Premium; locked or unreleased parts read "More lessons are coming." for the learner.
- Banned: behind, late, overdue, missed. The plan moves along by itself when days are skipped (F-PLAN-002 3.7).

### K2. Grown-up variant (gated placement report, or console wizard step 2)

```
┌──────────────────────────────────────────────────────────────┐
│ Suggested weekly plan for Sam                                │
│ Based on: Stage 1 · Letters and sounds, 2 days a week, 10 minutes
│ Pace (o) Gentle [Suggested]  ( ) Steady  ( ) Brisk           │
│ Length (o) 12 weeks [Suggested] ( ) 4 weeks ( ) 6 months ( ) Choose weeks
│ Heads-up (plain words, grown-up only):                       │
│  - 3 lessons are not included with this account yet and are not in the plan.
│  - 5 episodes are not released yet; they start once they are.
│ "The level check looks at reading and listening. Writing is practiced with
│  tracing games and is not scored. ..."   (caregiver.skillsNote)
│ [[ Use this plan ]]   [ Change ]   [ Not now ]               │
└──────────────────────────────────────────────────────────────┘
```

The console wizard pre-selects the same pace and length through the same `proposeRoute`.

### K3. Update after a retake (a plan already exists)

```
┌──────────────────────────────────────────────────────────────┐
│ Hoya found a later place to start.                           │
│ Your weekly plan can move ahead and keep the same end date.  │
│ [[ Update my plan ]]   [ Keep my plan ]                      │
└──────────────────────────────────────────────────────────────┘
```

A retake never moves the start earlier; days already past keep their items. A grown-up override may put quests back into the future of the plan.

---

## L. Empty, error, offline, text alternative

- **No snapshot yet**: C1.
- **Offline**: identical; everything is local.
- **A section whose data is absent hides itself**: no plan -> no plan line; no level check -> no start tag or known pips; no discover steps -> no letter wall; a skill with no finished quest -> "Ready when you are" and no slots.
- **Another profile**: C7 (gate open) or `PinEntry`.
- **Text alternative** (what a screen reader reads): "My route. You are on Stage 1: Hangul. Next: Family at the Table. Continue, button. Week 3. Next in your weekly plan: Family at the Table. Open plan, button. Stage list. Stage 1, Hangul. Open. You are here. 4 quests played. Stage 2, Words. A taste. Ready when you are. Stage 3, Sentences. Coming later. Stage 4, Dialogue. A taste. Stages 5 to 7. Coming later. What your quests practice, list. Read. In 4 quests you finished. Listen. In 4 quests you finished. Write. In 1 quest you finished."
- **Never on this page**: percent, `x / y`, "behind", "late", "missed", "Premium", price, rank, red, emoji or emoji-capable symbols, a level number, any speaking text.
