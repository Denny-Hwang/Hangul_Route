# All lessons home (BR-7)

Wireframe: `design/wireframes/browse/home.md` A to E and States · Spec: F-BROWSE-001 §4.1, §4.2, §4.4, §4.5, §4.12 · Mock: `mock/home-route.html`, `mock/home-journey.html`, `mock/home-library.html`, `mock/home-states.html` · Shots: `shots/home-route-*.png`, `shots/home-journey-*.png`, `shots/home-library-*.png`, `shots/home-states-*.png`

## Layers, top to bottom

| # | Part | Look | Shown |
|---|---|---|---|
| 1 | Header row | [ < Close ] (`arrow-left` 24 + "Close", Body semibold, 64 tall, the one fixed top-left position) and [ Lesson display ] (`settings` 20 + label; a pill chip on `surface.paper`, `borderWidth.base` `border.strong`, 64 tall) at the right | always |
| 2 | Title | "All lessons", Heading `title`, the screen's one header; the **Offline** chip beside it (`surface.sunken` pill, Caption semibold `text.secondary`) | chip when offline |
| 3 | How-to | "Tap a lesson to see what it teaches, then play it. Nothing is saved." Body `text.secondary`, `spacing.sm` above | always |
| 4 | Scope line | a `surface.sunken` box, `radii.md`, `spacing.md` x `spacing.lg` padding. Sampler with the switch on: "Your learner's free lessons are open. The others show what they teach." Fallback with the switch on: "Showing free lessons. We could not check your plan." | the content switch on only: a sampler pass (the sampler line) or a fallback pass (the fallback line). With the switch off no scope line ever shows, a fallback included (§4.3 step 3, README decision 22) |
| 4b | Note line | a deep link's note ("This letter is practiced across Stage 1.", "This lesson is not in this version of the app yet.") on `feedback.infoLight` with a 64 dismiss button (`close` glyph, "Dismiss") | after such a link |
| 5 | Pointer line | "To see how your learner is doing, open your home page." + `arrow-right`, `brand.primary` semibold, underlined, 64 tall; goes to `/parent` or `/teach/home` (no learner id) | account passes that are not kept (fallback included), online only; never gate or kept, and hidden offline because the persona home needs the internet (README decisions 3 and 24) |
| 6 | Section control | one row: Route · Journey · Library (README decision 2) | always |
| 7 | Section | below, `spacing.xl` above | |
| 8 | Keep switch | `border.subtle` rule, `spacing.xxl` above. **The whole row is the control** (README decision 21): one `role="switch"` button, full width and at least 64 tall, holding the label "Keep lessons on this device for 7 days, also offline" (Body) and the 48 x 24 track as drawing only (`border.strong` off, `brand.secondary` on; 16 `surface.paper` thumb). Tap anywhere on the row toggles it; Space and Enter toggle it on keyboard focus | account passes that are not a fallback |

## Section control

- A track on `surface.sunken` with a `border.subtle` edge, `radii.pill`, `spacing.xxs` inset and gap. Segments share the width equally and are 64 tall.
- Selected: `brand.primary` fill, `text.onPrimary`, bold. Others: `text.primary` semibold on the track.
- Label size Body (18), capped at 1.3 x (23.4); one line, never wraps (§7). Measured at 320 (93 wide each), 375 and 1280, and at 320 with 200 % text: one row, no label clipped.
- From the regular class the track is at most 30rem wide.
- `role="radiogroup"` with the name "Show lessons by". Each segment is a `radio`; arrow keys move and select; one Tab stop (roving `tabindex`).
- **Route present** (`flags.myRouteEnabled` on): three segments, Route is the default. **Absent**: two segments (Journey, Library), Journey is the default, and the Journey section starts with the collapsed stage line.

## Route section

The learner Learning Route trail (`TrailRow` via `browseRouteTrail`) in the browse state: no pips, no fill bar, no here, goal or start tags, no route card.

- **Stage row**: the 40 badge (`borderWidth.thick` in the stage colour, the number), the title (Body large bold), the availability pill (Open `brand.primaryLight`, A taste `brand.secondaryLight`), and the one-liner (`text.secondary`). A dotted connector runs to the next row. It ends in a chevron.
- **The whole stage row is one button**: "Stage 1, Hangul. Open. Meet every Korean letter and the sound it makes. Shows it on the Journey." It goes to the Journey section scrolled to that stage (`journey-stage-<stage>` layout, BR-5b).
- **Rows**: the learner trail's own, five today: Stages 1 to 4, then its merged "Stages 5 to 7" row (`laterRowView`; README decision 26).
- **Later rows** ("Sentences", "Stages 5 to 7"): the dotted badge, the title and the neutral "Coming later" pill. They are not buttons (README decision 5).

## Journey section

The learner Journey grid (`JourneyGrid` via `browseJourneyRows`), with no learner marks: no completed fill, no stars, no sparkle, no Next triangle, no "In your plan" ring, no start pin.

- Column labels, then per stage the ring, title, one-liner and availability pill, then five cells.
- **Open cell**: the theme initial on paper with the stage-coloured border. **Coming later**: an empty sunken cell, no glyph (E3-D D5). **Closed** (sampler, switch on only): the open look plus the dotted ring (40, 48 or 56 by class), labelled "{episode}: not open yet. Opens the lesson page." (F-ENT-003's `a11y.access.notOpen(title)`, by reference; it arrives with E3-5)
- The legend line "Not open yet" appears only while a ring is drawn.
- The taste note appears only on a row with an open cell (E3-D D11).
- A cell is a button to the episode outline. A later cell does nothing on one pane.
- At 320 the cells are 54 to 56, under `touchTarget.min`, because the learner grid is reused unchanged: a recorded exception (README, Measured; spec §15), not a Browse choice.
- **Two panes from the wide class** (F-LAYOUT-001 §3.7): the grid in the 400 master pane, and the episode outline of the selected cell in the detail pane (the cell takes the `border.focus` 3 edge). The header and keep switch stay in the reading column.
- **Route absent**: one collapsed line on paper above the grid, "7 stages, from letters to your own words", with a chevron (64 button, `aria-expanded`). Expanded, it lists "Stage n · Title" and the one-liner for all seven.

## Library section

Groups in the learner Library's order (`browseLibrary`): Cards, Story Time, Culture, Words. A group with nothing in this build is left out, and Cards always stays.

- **Cards**: the heading, the theme filter chips (the learner's: All, Letters, Food, Holidays, Nature, Play; buttons with `aria-pressed`, at least 64 tall and 64 wide here, where the learner chip is about 40), then the learner gallery grid (2 columns on compact, 3 from regular). Each slot shows the rarity pill, the CardArt face, the Korean with romanization, and the English title. Every card is face up, with no earn hint and no "New" pill. Content order is theme, then rarity. A slot opens the card page in its preview state.
- **Story Time / Culture**: the learner `StoryTile` (cover, title, the learner's subtitle; no "continue", no bookmark). A closed tile (sampler, switch on) keeps `surface.sunken` and shows the 16 dotted ring with "Not open yet" (E3-D). Today no story is reviewed, so neither group appears (`home-library.html` notes it; `home-states.html` draws it).
- **Words**: one card row per topic: title, "· 12 words", the first three words (Korean with romanization, gloss), and a chevron. The row is one button to the topic page (`topic.md`).

## States

| State | What changes |
|---|---|
| full, or sampler with the switch off (production) | A to C exactly; no scope line, ring, closed tile or billing anywhere |
| sampler, switch on | the scope line; rings on closed cells; closed tiles; the legend |
| fallback, switch on | the fallback line; the pointer line; no keep switch |
| fallback, switch off (production) | no scope line; the pointer line; no keep switch |
| gate pass | no pointer line, no keep switch |
| kept pass | no pointer line; the switch shows on; Close with no same-origin referrer goes to `/` (README decision 25). Turning the switch off on a kept-only pass keeps the resolved pass in memory until the tab closes or reloads, then Access (README, Notes for the PRs) |
| offline | the Offline chip; no pointer line (README decision 24); everything else works |
| deep-link note | the note line, dismissible |
| keyboard focus | the `border.focus` ring on the focused target (README decision 20) |
| no pass | never renders: Access |
