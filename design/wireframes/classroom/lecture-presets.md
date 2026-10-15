# Classroom/Lecture-presets — start a ready-made lesson without picking items, on the presenter home and the console setup page (wireframe v1)

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` sections 4 (presets), 6 (parents), 10 (accessibility) · amends `classroom/lecture-presenter.md` A (presenter home), B (start screen) and K (console setup page)
Audience: **teacher, parent or caregiver, any grown-up presenting** (first-time presenters first)
Routes: presenter home `app.hangulroute.com/present` (no deck) · console setup `/teach/space/lecture?id=` and `/parent/space/lecture?id=`
Mock: LV-0b (`design/screens/presenter/presets.md`)

## Scenario (Given-When-Then)

Given: a grown-up who has never used lecture mode opens it from a home card, the nav item or `/present`
When: the page opens
Then: six ready-made lessons are the first thing on the page; one tap on a card, an optional length chip and **Start** open a lesson; picking items one by one is folded away under **Customize** and is never needed

## Screen goal

"Start a ready lesson." (secondary: resume a recent lesson; customize)

## Box diagram

Panel A — presenter home, phone or small tablet, 320 wide (one column; also 200 % text)

```
+--------------------------------+
| (Hoya) Lecture mode   [Help]   |  <- h1; Help = Keys and help
| (English)(Español)(한국어)      |  <- language chips (only when the build offers 2+)
|--------------------------------|
| Ready-made lessons        (h2) |
| "Pick a ready lesson. You can  |
|  look at it before you start." |
| +----------------------------+ |
| | Next lesson                | |  <- first only when there is something to follow
| | Picks up after the last    | |
| | lesson shown on this screen| |
| | about 20 min            (>)| |
| +----------------------------+ |
| +----------------------------+ |
| | Start from zero:           | |
| | Hangul week 1              | |
| | The first letters, their   | |
| | sounds and simple syllables| |
| | about 20 min            (>)| |
| +----------------------------+ |
| | Stage by stage          (>)| |
| | Story time              (>)| |
| | Word review             (>)| |
| | Quick 10-minute warm-up (>)| |
| +----------------------------+ |
|--------------------------------|
| Recent lessons            (h2) |
| | Week 3 letters  Yesterday  | |
| | [[ Resume ]] [ Start over ]| |
|--------------------------------|
| [ v Customize ]                |  <- disclosure; closed by default
|   (opens today's Quick lesson: |
|    groups, checkboxes, Build)  |
+--------------------------------+
```

Panel B — the same home at 768 (tablet portrait): preset cards in a two-column grid, Recent and Customize below in one column

```
+------------------------------------------------------+
| (Hoya) Lecture mode                 [Keys and help]  |
| (English)(Español)(한국어)                            |
|------------------------------------------------------|
| Ready-made lessons                                   |
| +------------------------+ +------------------------+ |
| | Next lesson            | | Start from zero:       | |
| | line                   | | Hangul week 1          | |
| | about 20 min        (>)| | about 20 min        (>)| |
| +------------------------+ +------------------------+ |
| | Stage by stage      (>)| | Story time          (>)| |
| +------------------------+ +------------------------+ |
| | Word review         (>)| | Quick 10-minute     (>)| |
| |                        | | warm-up                | |
| +------------------------+ +------------------------+ |
|------------------------------------------------------|
| Recent lessons                                       |
| | Week 3 letters   Yesterday  [[Resume]] [Start over]|
|------------------------------------------------------|
| [ v Customize ]                                      |
+------------------------------------------------------+
```

Panel C — the same home at 1180 (laptop, tablet landscape, classroom PC): three-column preset grid on the left two thirds, Recent on the right third; Customize full width below

```
+------------------------------------------------------------------------------------------+
| (Hoya) Lecture mode                                       (English)(Español)(한국어) [Help]|
|------------------------------------------------------------------------------------------|
| Ready-made lessons                                            | Recent lessons           |
| +------------------+ +------------------+ +------------------+ | | Week 3 letters       | |
| | Next lesson      | | Start from zero: | | Stage by stage   | | | Yesterday            | |
| | line             | | Hangul week 1    | | Pick a stage...  | | | [[Resume]][Start over]|
| | about 20 min  (>)| | about 20 min  (>)| | about 20 min  (>)| | | Hello words  Sun [x] | |
| +------------------+ +------------------+ +------------------+ | | [Resume][Start over] | |
| | Story time    (>)| | Word review   (>)| | Quick 10-minute  | | (empty: dashed line)     |
| |                  | |                  | | warm-up       (>)| |                          |
| +------------------+ +------------------+ +------------------+ |                          |
|------------------------------------------------------------------------------------------|
| [ v Customize ]  "Choose each part yourself. You never have to."                         |
+------------------------------------------------------------------------------------------+
```

Panel D — a preset card chosen: it opens in place (one card open at a time); the length chips and Start; Stage by stage also shows the stage chips

```
| +--------------------------------------------+ |
| | Stage by stage                      (open) | |  <- button, aria-expanded=true, aria-controls = this panel; thick outline
| | Choose a stage                             | |
| | (Stage 1)(Stage 2)(Stage 3)(Stage 4)       | |  <- radio group, only stages with a ready cell
| | (Stage 5)(Stage 6)(Stage 7)                | |
| | How long?   ( 10 min )(•20 min•)( 30 min ) | |  <- radio group; default marked
| |                          [[   START   ]]   | |  -> Panel E (start screen) for this deck
| +--------------------------------------------+ |
```

- Next lesson, Hangul week 1, Story time: length chips 10 / 20 / 30. Word review: 10 / 20. Warm-up: no chips (10 fixed).
- A fallback line shows inside the card when it applies ("Nothing to follow yet, so this starts with Hangul week 1.").

Panel E — the start screen (the big screen before Start) for a preset: what is in the lesson, then Start; Customize optional

```
+------------------------------------------------------------------------------+
| [<- Back to lessons]                                                         |
|                                                                              |
|   Hangul week 1                                 (deck title, teacher text)   |
|   47 slides · about 19 min                                                   |
|   What's in this lesson                                                      |
|    1  Meet a, eo, g, n                    about 5 min                        |
|    2  Meet o, u, m and the circle         about 5 min                        |
|    3  Meet eu, i, d, r                    about 5 min                        |
|    4  Quick quiz: 4 questions             about 4 min                        |
|   ( 3 parts are not shown as slides. [See which] )   <- only while a skip remains |
|   checks: Korean voice · Ready for offline · Full screen                     |
|   Helper picker: numbers 1-12  [-][+]                                        |
|                                                                              |
|                 [[            START            ]]                            |
|                 [ Customize ]                                                |
+------------------------------------------------------------------------------+
```

Panel F — console setup page, presets first (teacher; the family page is the same with family wording)

```
+-----------------------------------------------------------+
| [frame: Teacher · Back to learning]                       |
| Classes | Lessons | Lecture mode | Billing                |  <- nav item (E3)
|-----------------------------------------------------------|
| <- Back to Class 2B                                       |
| Lecture mode (h1)                                         |
| "Show a slide lesson on a projector or TV, in class or at |
|  home."                                                   |
|                                                           |
| Ready-made lessons (h2)                                   |
| [card Next lesson: "From this week's plan: Week 3"]      |
| [card Start from zero] [card Stage by stage]              |
| [card Story time] [card Word review] [card Warm-up]       |
|   chosen card: How long? (10)(•20•)(30)                   |
|   What's in this lesson (read-only list, about-minutes)   |
|   Helper picker: (none)(numbers)(initials)(•names•)       |  <- §3.10 roster rule; family of 1: none
|   [[ OPEN PRESENTER ]]   [ Copy link ]                    |
|                                                           |
| [ v Customize ]                                           |
|   Source · Catalogue · Outline (prefilled) · Options ·    |
|   Helper picker · Check the classroom device              |  <- family: "Check the TV or screen"
+-----------------------------------------------------------+
```

## Interaction points

- Preset card → opens in place (Panel D, disclosure pattern: the card button has `aria-expanded` and `aria-controls` naming its panel; opening one closes the others, so their `aria-expanded` becomes false); a second tap on the open card closes it; arrow keys do not move between cards (each is one tab stop).
- Stage chip, length chip → select (radio groups, `radioAfter`); the outline under the card re-resolves at once.
- [[ Start ]] on the presenter home → the start screen of the resolved deck (Panel E), saved to Recent only at Start on Panel E (as Quick lesson).
- [[ Start ]] on Panel E → the lesson (`classroom/lecture-presenter.md` C), unchanged.
- [ Customize ] on Panel E → back to the home with Customize open and nothing chosen (Quick lesson cannot hold arbitrary blocks; the preset stays one tap away).
- [ v Customize ] (home) → Quick lesson as today (`design/screens/presenter/home.md`).
- Console [[ Open presenter ]] / [ Copy link ] → unchanged hand-off (F-TCH-004 §3.2); the deck is the resolved preset.
- Console [ v Customize ] → today's sections with the outline prefilled from the chosen preset.
- Opened with `?from=plan` → Next lesson chosen with the plan's blocks; `?from=revisit` → Warm-up chosen with the revisit letters.

## Navigation graph

Enter from: home cards (E1, E2, `classroom/lecture-entry-points.md`) · nav item (E3) · space action row (E4) · learner app grown-up card (E5) · a typed or bookmarked `/present` · Exit of a lesson · an invalid link
Exit to: start screen → lesson (`classroom/lecture-presenter.md` B, C) · Quick lesson (Customize) · Recent Resume · console: presenter tab (new tab) · Back to the space

## States

- **success**: Panels A-F.
- **nothing to follow** (no plan, no route position, no Recent): Hangul week 1 is the first card; Next lesson is last with its fallback line.
- **no words this week**: Word review shows "No words this week yet, so this is the warm-up instead." and resolves to the warm-up.
- **every story shown**: Story time shows the restart line. Story time decks are always titled "Story time" in the UI language (never a story's own title) and are filled to the chosen length with the next stories.
- **empty Recent**: the dashed empty line (`learner.presenter.home.recent.empty`), as today.
- **storage off**: Recent shows `recent.storageOff`; presets still work (Next lesson falls back, no history).
- **console: roster or plans failed to load**: Next lesson and Word review show their fallback lines; the other four work; the page's error notice stays as today.
- **flag off** (`lectureModeEnabled()` false, kill switch): the console page shows `console.lecture.comingSoon` and no card, nav item or button is drawn; `/present` is unaffected.
- **loading** (console): the presets section shows a skeleton of six cards; nothing is tappable until the roster and plans have answered or failed.

## Data needs

- Presenter: `CATALOG` and `routeCatalogOf` (bundled), the bundle (`lectureBundle`), `lecture:recent` (IndexedDB; `savedAt`, decks) for N4, S, T, W2, U windows.
- Console: roster (`summary.journey` aggregate only, `rollup.revisit`, `rollup.vocabRevisit`), plans (`latestPublished`, `planOutline`), `CATALOG`; nothing new from the API.
- Writes: none until Start (Recent, as today).

## Open questions

- None blocking. Pace of upper-stage presets is measured after LV-S4 (spec section 16).
