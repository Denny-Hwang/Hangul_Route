# Browse/Home — every lesson, the way a learner sees it (wireframe v1)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.1, §4.2, §4.5, §4.9
Audience: **parent or teacher** with a browse pass (grown-up surface inside the learner web build, `app.hangulroute.com/browse`). Copy may address grown-ups directly; no age wording, no "kids".
Code (planned): `apps/mobile/src/screens/browse/BrowseHomeScreen.tsx`, `components/JourneyGrid.tsx` (extracted from `screens/journey/JourneyScreen.tsx`, BR-5), `screens/library/StoryTile.tsx` (reused), `logic/browse/catalogue.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `~~ ko ~~` taught Korean through `KoreanText` (romanization beside it), `(o)` / `( )` a radio. No colours, fonts or pixel sizes. Every sentence is a placeholder; final strings live in `caregiver.browse`.

## Scenario (Given-When-Then)

Given: a parent or teacher opened Browse from their account, a report, the route or the grown-up area of the app
When: Browse home appears
Then: they see the whole course in the same shapes their learner sees (the Journey grid, the story shelf, the word topics, the cards), can tell at once what they can preview, and reach any lesson in two taps

## Screen goal

"Find any lesson and open it." (secondary: change how lessons are shown, Show as)

## Box diagram

### A. Phone (compact), full pass, Journey section

```
┌──────────────────────────────────┐
│ [< Exit preview]  Browse lessons │   title row; Exit is the one fixed back position
│                      [Show as]   │   -> browse/show-as
│ All lessons are open to preview. │   scope line (full)
│ ┌──────────────────────────────┐ │
│ │ Preview. Nothing is saved.   │ │   preview strip (every browse screen), not dismissable
│ └──────────────────────────────┘ │
│ ( Journey )( Stories )( Words )  │   section switch, learner order; one row, wraps
│ ( Cards )                        │
│                                  │
│ The route, stage by stage        │   short intro, one line per stage (localised oneLiner)
│  1 Hangul · Meet every letter…   │
│  2 Words · A taste               │   "A taste" / "Coming later" as the learner Journey says
│  3 Sentences · Coming later      │
│  4 Dialogue · A taste            │
│  5-7 · Coming later        v     │   consecutive later stages merged, expands
│                                  │
│      Let. Life Rites Nat. Crafts │   the learner Journey grid (JourneyGrid), browse state:
│  S1  [o]  [o]  [o]  [o]  [o]     │   [o] open cell (every shipped cell), nothing done,
│  S2  [ ]  [o]  [ ]  [o]  [ ]     │   no stars, no sparkle, no lock drawn
│  S4  [ ]  [ ]  [o]  [ ]  [ ]     │   [ ] later (no shipped episode)
│  S5  [o]  [ ]  [ ]  [ ]  [ ]     │   (Stage 5 books, F-STORY-005)
│                                  │
│ ──────────────────────────────── │
│ [ ] Keep lessons on this device  │   keep switch, OFF by default (OD-4)
│     for 7 days, also offline     │
└──────────────────────────────────┘
```

- A cell -> `browse/episode`. On regular / wide windows the grid and the episode outline share two panes, as the learner Journey does (F-LAYOUT-001 §3.7).
- There is no primary [[ CTA ]] here: home is a map; the primary action lives on the item page.

### B. Stories section

```
│ ( Journey )(*Stories*)( Words )  │
│ Story time                       │   groups as the Library groups them
│ ┌────────┐ ┌────────┐ ┌────────┐ │   learner StoryTile, browse state (no "continue",
│ │ [cover]│ │ [cover]│ │ [cover]│ │    no bookmark, no lock)
│ │ title  │ │ title  │ │ title  │ │
│ └────────┘ └────────┘ └────────┘ │
│ Culture                          │
│ ┌────────┐ ┌────────┐            │
│ │ [cover]│ │ [cover]│ Outline    │   sampler: tiles outside the free set carry an
│ └────────┘ └────────┘            │   "Outline" tag, never a lock
```

### C. Words section

```
│ ( Journey )( Stories )(*Words*)  │
│ ┌──────────────────────────────┐ │
│ │ Food · 12 words          [>] │ │   one row per topic -> browse/item (vocab-topic)
│ │ ~~ 밥 ~~ bap rice · ~~ 물 ~~… │ │   three sample words, romanization + gloss
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Family · 10 words  Outline[>]│ │   sampler outline tag
│ └──────────────────────────────┘ │
```

### D. Cards section

```
│ ( Journey )( Stories )( Words )  │
│ (*Cards*)                        │
│ [card][card][card][card]         │   every card face up: no silhouette, no earn hint
│ [card][card][card][card]         │   tap -> library/card-detail in preview state (modal)
```

### E. Sampler scope header

```
│ [< Exit preview]  Browse lessons │
│ Free lessons open to preview.    │   scope line (sampler)
│ Others show what they teach.     │
│ ┌──────────────────────────────┐ │
│ │ Preview. Nothing is saved.   │ │
│ └──────────────────────────────┘ │
```

## Interaction points

- Section chip -> switches the section in place (no navigation)
- Journey cell (open) -> `browse/episode { episodeId }`; later cell -> nothing (label "Coming later")
- Stage line -> scrolls to that stage's grid row; "5-7" line -> expands
- Story tile -> `browse/item { kind: 'story' }`
- Topic row -> `browse/item { kind: 'vocab-topic' }`
- Card -> `library/card-detail` (preview state: front and back as earned, no date, no share)
- [Show as] -> `browse/show-as` (sheet)
- Keep switch -> on: writes the pass and Show as settings for 7 days; off: removes them
- [< Exit preview] -> closes the tab when script-opened, else back to the learner app (gate) or the console (account)

## Navigation graph

Enter from: `browse/entry-points` (console Lessons button, report chip, route row, plan row, roster chip, grown-up area) · `browse/access` once a pass arrives · `browse/preview-end` "Back" chain · deep-link resolution (a `stage` target lands here scrolled to that stage)
Exit to: `browse/episode` · `browse/item` · `library/card-detail` (preview) · `browse/show-as` · console / learner app (Exit)

## States

- **success, full**: A to D.
- **success, sampler**: E header; outline tags on items outside the free set; every item still opens its page.
- **waiting** (pass not yet resolved, more than 1 s): the header and the strip, and one line "Getting your lessons ready…" in place of the sections; after 3 s without a pass -> `browse/access`.
- **empty section**: never blank; a section with nothing shipped shows one "Coming later" row.
- **offline**: works the same; a quiet "Offline" chip next to the scope line.
- **not in this version** (a deep link to an id this cached app does not have): home with one dismissible line "This lesson is not in this version of the app yet."
- **error** (a render failure): the learner `OopsScreen` with [ Try again ] (remounts the stack).

## Data needs

- reads: the bundled content only (`content/*`, `defaultStoryIndex()`, `vocabTopics`, `heritageCardsAll`), through `logic/browse/catalogue.ts`; the pass in memory (or `browse:pass` when kept); `browse:prefs` when kept
- writes: `browse:pass` and `browse:prefs` only when the keep switch is on (storage fence allows nothing else)
- telemetry: `browse.opened` (once per load), `browse.item_viewed` when a card opens
- no learner data of any kind (no profile, progress, tier, plan)

## Open questions

- Should the Journey grid show Stage 3 / 6 / 7 rows that have no shipped cell at all, or only the stage lines above it? Default: the grid shows the same rows as the learner Journey today.
- A search box is out of scope (spec §14); measure whether adults ask for "find letter X" in beta.
