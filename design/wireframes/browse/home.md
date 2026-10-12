# Browse/Home — All lessons, the way a learner sees them (wireframe v3)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.1, §4.2, §4.5, §4.9
Audience: **parent or teacher** with a pass (grown-up surface inside the learner web build, `app.hangulroute.com/browse`). Copy may address grown-ups directly; no age wording, no "kids".
Code (planned): `apps/mobile/src/screens/browse/BrowseHomeScreen.tsx`, `components/JourneyGrid.tsx` (extracted from `screens/journey/JourneyScreen.tsx`, BR-5b), `screens/my-route/TrailRow.tsx` (reused, BR-5b), `screens/library/StoryTile.tsx` (reused), `logic/browse/catalogue.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `~~ ko ~~` taught Korean through `KoreanText` (romanization beside it), `(o)` / `( )` a radio, `(*X*)` the selected segment. No colours, fonts or pixel sizes. Every sentence is a placeholder; final strings live in `caregiver.browse`.

v2 (review of 2026-10-11): one-row section control in the learner's order (Route · Journey · Library), one how-to line, scope line only when it means something, no preview strip on catalogue screens, closed items drawn the way the learner sees them, [ Close ] instead of "Exit preview", "Lesson display" instead of "Show as".
v3 (2026-10-12, F-ENT-003 §6.4 adopted): a closed Journey cell carries the learner's dotted ring and "not open yet" label, never a lock glyph (F-ENT-003 OD-6); the Library groups follow the learner registry order (Cards, Story Time, Culture, Words).

## Scenario (Given-When-Then)

Given: a parent or teacher opened **Lessons** from their home, a report, the Learning Route, the plan builder or the grown-up area of the app
When: All lessons appears
Then: in one glance they know what the page is for, see the whole course in the same shapes their learner sees (the Learning Route, the Journey grid, the Library), and reach any lesson in two taps

## Screen goal

"Find any lesson and open it." (secondary: change how lessons are shown, Lesson display)

## Box diagram

### A. Phone (compact), full pass, Route section (default while the learner Route tab is on)

```
┌──────────────────────────────────┐
│ [< Close]   All lessons          │   title row; Close is the one fixed back position
│                [Lesson display]  │   -> browse/show-as
│ Tap a lesson to see what it      │   one how-to line (layer 1: what this page is)
│ teaches, then play it. Nothing   │
│ is saved.                        │
│ To see how your learner is       │   pointer line: account pass, not kept, online only
│ doing, open your home page. >    │   -> persona home (no learner id); never gate/kept
│ ( *Route* )( Journey )( Library )│   ONE row, learner order; never wraps at 320
│                                  │
│ (1)── Hangul                     │   learner Learning Route trail (TrailRow), browse
│       Meet every letter          │   state: no "here", no goal, no pips filled,
│ (2)── Words · A taste            │   no route card
│ (3)── Sentences · Coming later   │
│ (4)── Dialogue · A taste         │
│ (5-7) Coming later               │   consecutive later stages merged
│                                  │
│ ──────────────────────────────── │
│ [ ] Keep lessons on this device  │   keep switch: account pass only, OFF by default
│     for 7 days, also offline     │
└──────────────────────────────────┘
```

- A stage row -> Journey section scrolled to that stage.

### B. Journey section

```
│ ( Route )( *Journey* )( Library )│
│ 7 stages, from letters to your   │   only when the Route section is absent (flag off):
│ own words                  [ v ] │   one collapsed line, expands to the stage one-liners
│                                  │
│      Let. Life Rites Nat. Crafts │   the learner Journey grid (JourneyGrid), browse state:
│  S1  [o]  [o]  [o]  [o]  [o]     │   [o] open cell, nothing done, no stars, no sparkle,
│  S2  [ ]  [o]  [ ]  [o]  [ ]     │   no Next triangle, no "In your plan" ring
│  S4  [ ]  [ ]  [o]  [ ]  [ ]     │   [ ] later (no shipped episode)
```

- A cell -> `browse/episode`. On regular / wide windows the grid and the episode outline share two panes, as the learner Journey does (F-LAYOUT-001 §3.7).
- There is no primary [[ CTA ]] here: home is a map; the primary action lives on the item page.

### C. Library section (the learner Library's groups, in its registry order)

```
│ ( Route )( Journey )( *Library* )│
│ Cards                            │
│ [card][card][card][card]         │   every card face up: no silhouette, no earn hint
│ [card][card][card][card]         │   tap -> library/card-detail in preview state (modal)
│ Story Time                       │
│ ┌────────┐ ┌────────┐ ┌────────┐ │   learner StoryTile, browse state (no "continue",
│ │ [cover]│ │ [cover]│ │ [cover]│ │    no bookmark); Culture follows the same way
│ │ title  │ │ title  │ │ title  │ │
│ └────────┘ └────────┘ └────────┘ │
│ Words                            │   the slot F-VOC-003 registers as "Words"
│ ┌──────────────────────────────┐ │
│ │ Food · 12 words          [>] │ │   one row per topic -> browse/item (vocab-topic)
│ │ ~~ 밥 ~~ bap rice · ~~ 물 ~~… │ │   three sample words, romanization + gloss
│ └──────────────────────────────┘ │
```

- Group order is the learner Library's tab order (`LIBRARY_SECTIONS`): Cards, Story Time, Culture, Words. A group with nothing in this build is left out, as the learner leaves out its tab; Cards always stays. Found culture notes are a learner's state and are not shown.

### D. Sampler pass with the content switch ON (not possible in production today)

```
│ [< Close]   All lessons          │
│ Tap a lesson to see what it …    │
│ Your learner's free lessons are  │   scope line: only sampler + switch on
│ open. The others show what they  │
│ teach.                           │
│ ( Route )( *Journey* )( Library )│
│  S1  [o]  [o]  [o*] [o*] [o*]    │   * closed cell drawn exactly as the learner Journey
│                                  │     draws it: the dotted ring, never a lock glyph,
│                                  │     label "{episode}: not open yet. Opens the lesson
│                                  │     page." (F-ENT-003 §3.7, journey/grid-plan-and-
│                                  │     access.md); it still opens its page
```

- With the switch **off** (production until Stripe Live), sampler and full look identical: no scope line, no closed cell, no closed tile.

### E. Fallback pass (the console could not check the plan)

```
│ Showing free lessons. We could   │   replaces the scope line; fallback passes last 1 hour
│ not check your plan.             │
```

## Interaction points

- Section segment -> switches the section in place (no navigation)
- Stage row (Route) -> Journey at that stage
- Journey cell (open or closed) -> `browse/episode { episodeId }`; later cell -> nothing (label "Coming later")
- Collapsed stage line -> expands the seven one-liners
- Story tile -> `browse/item { kind: 'story' }`; topic row -> `browse/item { kind: 'vocab-topic' }`
- Card -> `library/card-detail` (preview state: front and back as earned, no date, no share)
- [Lesson display] -> `browse/show-as` (sheet)
- Pointer line -> persona home (`/parent` or `/teach/home`), same tab
- Keep switch -> on: keeps the account pass and Lesson display settings for 7 days; off: removes them
- [< Close] -> back to the page that opened All lessons (same tab), else the persona home (account) or the learner app (gate)

## Navigation graph

Enter from: `browse/entry-points` (Lessons in the adult navigation, report Preview, Learning Route rows, plan row, roster chip, grown-up area) · deep-link resolution (a `stage` target lands on Journey at that stage) · `browse/preview-end` "Back" chain
Exit to: `browse/episode` · `browse/item` · `library/card-detail` (preview) · `browse/show-as` · persona home or learner app (Close, pointer line)

## States

- **success, full**: A to C.
- **success, sampler, switch off**: identical to full.
- **success, sampler, switch on**: D; closed items keep their pages.
- **fallback**: E.
- **no pass**: never renders; `browse/access` instead.
- **Route section absent** (`myRouteEnabled` off, as for learners): two segments, Journey ( Library ), Journey default, collapsed stage line on Journey.
- **empty group**: never blank; a group with nothing shipped shows one "Coming later" row.
- **offline**: works the same; a quiet "Offline" chip next to the title.
- **not in this version** (a deep link to an id this cached app does not have): one dismissible line "This lesson is not in this version of the app yet."
- **error** (a render failure): the learner `OopsScreen` with [ Try again ].

## Data needs

- reads: the bundled content only (`content/*`, `defaultStoryIndex()`, `vocabTopics`, `heritageCardsAll`), through `logic/browse/catalogue.ts`; the session pass (`hr:browse:pass`) or the kept pass; `browse:prefs` when kept; `shell:lastPersona` (persona code only); the effective switch `gatingActive(flags, bundleOs())` (never the raw `flags.contentGatingEnabled`), `flags.myRouteEnabled`
- writes: `browse:pass` and `browse:prefs` only when the keep switch is on (the storage fence allows nothing else besides `device:audio` and the browse telemetry queue)
- telemetry: `browse.opened` (once per load), `browse.item_viewed` when a card opens
- no learner data of any kind (no profile, progress, tier, plan)

## Open questions

- A search box is out of scope (spec §14); measure whether adults ask for "find letter X" in beta.
