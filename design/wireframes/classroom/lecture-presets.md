# Classroom/Lecture-presets — start a ready-made lesson without picking items, on the presenter home and the console setup page (wireframe v1)

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` sections 4 (presets), 6 (parents), 10 (accessibility) · amends `classroom/lecture-presenter.md` A (presenter home), B (start screen) and K (console setup page)
Audience: **teacher, parent or caregiver, any grown-up presenting** (first-time presenters first)
Routes: presenter home `app.hangulroute.com/present` (no deck) · console setup `/teach/space/lecture?id=` and `/parent/space/lecture?id=`
Mock: LV-0b (`design/screens/presenter/presets.md`); revised 2026-10-16 in DN-0 (`presets.md`, `home.md`, `design/screens/app-shell/lecture-setup.md`)

> **Revised 2026-10-16 (`AMENDMENTS-LECTURE-V2.md` section 18; rows LV-3 and LV-4).** No language chips: the **Display (Aa)** control takes their place (Panels A to C). The home has a top-left **Back** (section 7 item 3). **Customize** opens one **grouped chooser** (tabs Lessons, Stories, Word topics, Letters; one tab at a time) with a **sticky footer**, on the presenter home (Panel C) and the console (Panel F). The helper picker is gone (Panels E and F). The browser back from the start screen returns to the home as it was.

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
| [< Back]           (Aa) [Help] |  <- Back: history.back() or "/"; Aa = Display (2026-10-16)
| (Hoya) Lecture mode            |  <- h1; Help = Keys and help (no language chips)
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
| [< Back]                      (Aa) [Keys and help]   |
| (Hoya) Lecture mode                                  |
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

Panel C — the same home at 1180 (laptop, tablet landscape, classroom PC), **Customize open** (revised 2026-10-16): three-column preset grid on the left two thirds, Recent on the right third; Customize full width below with the grouped chooser and a sticky footer

```
+------------------------------------------------------------------------------------------+
| [< Back]                                                          (Aa)  [Keys and help]  |
| (Hoya) Lecture mode                                                                      |
|------------------------------------------------------------------------------------------|
| Ready-made lessons                                            | Recent lessons           |
| +------------------+ +------------------+ +------------------+ | | Week 3 letters       | |
| | Next lesson   (>)| | Start from zero: | | Stage by stage(>)| | | Yesterday            | |
| | about 20 min     | | Hangul week 1 (>)| | about 20 min     | | | [[Resume]][Start over]| |
| +------------------+ +------------------+ +------------------+ | (empty: dashed line)     |
| | Story time    (>)| | Word review   (>)| | Quick 10-minute(>)| |                          |
| +------------------+ +------------------+ +------------------+ |                          |
|------------------------------------------------------------------------------------------|
| [ - Customize ]  "Choose each part yourself. You never have to."                         |
|   What to add:  ( Lessons )( Stories )( Word topics )( Letters )   <- tabs, one at a time |
|   Choose a stage: (Stage 1)(•Stage 2•)(Stage 3)(Stage 4)(Stage 5)(Stage 6)(Stage 7)       |
|   [x] Word Builder                     about 25 min   [ v 6 lessons inside ]              |
|   [ ] Lunch Box Words                  about 13 min   [ v 3 lessons inside ]              |
|   [ ] Holiday Words                    about 13 min   [ v 3 lessons inside ]              |
|   [ ] Outdoor Words · Playground Words (one row per theme: five rows at most)             |
|   Your lesson                                                                            |
|   1  Word Builder                      about 25 min                        [x remove]    |
|   2  Hoya's Seollal Morning            about 4 min                         [x remove]    |
|==========================================================================================|
| 2 parts · about 29 min                                         [[     BUILD LESSON     ]] |  <- sticky footer
+------------------------------------------------------------------------------------------+
```

- **Stories** and **Word topics** tabs: 8 rows, then [ Show 8 more ]. **Letters**: Consonants, Vowels.
- Titles in the device language (content overlays), English where none.
- Phone (320 to 600): the same chooser in one column; the tabs wrap to two rows at 200 % text; the footer stays at the bottom.

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

Panel E — the start screen (the big screen before Start) for a preset: what is in the lesson, then Start; Customize optional (revised 2026-10-16: no helper picker row; the browser back = Back to lessons; a phone gets `classroom/lecture-phone.md` F)

```
+------------------------------------------------------------------------------+
| [<- Back to lessons]                                                   (Aa)  |
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
|                                                                              |
|                 [[            START            ]]                            |
|                 [ Customize ]                                                |
+------------------------------------------------------------------------------+
```

Panel F — console setup page, presets first (teacher; the family page is the same with family wording). Revised 2026-10-16: PageBack, no Helper picker, Customize with the shared grouped chooser, Slides language, a sticky footer

```
+-----------------------------------------------------------+
| [frame: Teacher ...                    (Aa) [Learner app >]] |  <- AMENDMENTS-DISPLAY-NAV 7.3
| Classes | Lessons | Lecture mode | Billing                |  <- nav item (E3)
|-----------------------------------------------------------|
| [< Back to Class 2B]                                      |  <- PageBack, top-left
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
|                                                           |
| [ - Customize ]                                           |
|   Source (radio)                                          |
|   What to add: (Lessons)(Stories)(Word topics)(Letters)   |  <- the shared grouped chooser
|     stage chips; one row per episode; [v n lessons inside]|
|   Outline (prefilled; up / down / remove; + Quiz,         |
|     + Activity, + Class code / + Family code)             |
|   Options: Romanization · Stroke guide · Sound ·          |
|     Slides language [ Same as this device v ]             |  <- default writes no uiLocale
|     "A copied link uses the language of the device that   |
|      opens it."                                           |
|   Lesson title · Check the classroom device               |  <- family: "Check the TV or screen"
|===========================================================|
| about 20 min      [[ OPEN PRESENTER ]]   [ Copy link ]    |  <- sticky footer
+-----------------------------------------------------------+
```

- ~~Helper picker: (none)(numbers)(initials)(•names•)~~ removed in both the chosen card and Customize (LV-D7: every deck `picker: null`).

## Interaction points

- Preset card → opens in place (Panel D, disclosure pattern: the card button has `aria-expanded` and `aria-controls` naming its panel; opening one closes the others, so their `aria-expanded` becomes false); a second tap on the open card closes it; arrow keys do not move between cards (each is one tab stop).
- Stage chip, length chip → select (radio groups, `radioAfter`); the outline under the card re-resolves at once.
- [[ Start ]] on the presenter home → the start screen of the resolved deck (Panel E), saved to Recent only at Start on Panel E (as Quick lesson).
- [[ Start ]] on Panel E → the lesson (`classroom/lecture-presenter.md` C), unchanged.
- [ Customize ] on Panel E → back to the home with Customize open and nothing chosen (Quick lesson cannot hold arbitrary blocks; the preset stays one tap away).
- [< Back to lessons] on Panel E, or the browser back → the home as it was: the open card, its chips, Customize, the chooser tab and choices, the scroll position (row LV-3).
- [< Back] on the home → `history.back()` when the tab came from another app page, else `/` (`AMENDMENTS-LECTURE-V2.md` section 7 item 3).
- (Aa) → the Display sheet (`shell/display-sheet.md`): device language and text size.
- Chooser tab → shows that group (one at a time); stage chip → that stage's episodes; [ v n lessons inside ] → the episode's single lessons as checkbox rows; [ Show 8 more ] → the next 8 stories or topics; a checkbox → adds to Your lesson (presenter) or appends to the Outline (console); [x remove] → takes it out.
- [[ BUILD LESSON ]] (sticky) → the start screen of the built deck (Panel E).
- [ v Customize ] (home) → the grouped chooser (Panel C; it replaces the flat Quick lesson list, `design/screens/presenter/home.md` as revised).
- Console [[ Open presenter ]] / [ Copy link ] → unchanged hand-off (F-TCH-004 §3.2); the deck is the resolved preset.
- Console [ v Customize ] → Source, the grouped chooser, the Outline prefilled from the chosen preset, Options with **Slides language**, title and checks (Panel F); no Helper picker.
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
- **chooser, nothing chosen**: Your lesson shows "Nothing chosen yet. Choose from the tabs above."; Build lesson disabled with the existing "Choose at least one item to build a lesson."
- **chooser, lesson full** (30 blocks): unchosen checkboxes disabled, the existing full line.
- **a tab with nothing in this build** (no reviewed story yet): that tab is not drawn.
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
