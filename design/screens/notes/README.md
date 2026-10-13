# Notes from grown-ups: learner card, My notes, note page, grown-up zone, composer, sent list, family view, hub (design mocks v1)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md`. This is the **design pass** that the spec's start order (line "after the design pass") and section 14.3 ("Design: mocks in `design/screens/` for the learner card, list, note page, grown-up screen, composer, sent list, family view and hub") require before FB-8, FB-9, FB-11a, FB-11b and FB-12 (CLAUDE.md section 5: no component without a mock). The owner decided on 2026-10-12 that agents make these mocks with a multi-agent review instead of by hand, as for the app shell (#420), browse (#421), reports (#429, #444) and class moves (#472).
Wireframes (on `main`): `design/wireframes/home/notes-card.md`, `notes/list.md`, `notes/detail.md`, `parent/notes.md`, `parent/note-report.md`, `console/note-composer.md`, `console/notes-sent.md`, `console/notes-hub.md`, `console/family-notes.md`.
Reused, not redrawn: the adult frame, buttons, learner-app parts and design board of the app-shell pass (`design/screens/app-shell/`); `mock/notes.css` imports `../../app-shell/mock/app-shell.css` unchanged. The grown-up zone follows the in-app report's look (`design/screens/reports/in-app-report.md`). Glyphs `note` and `heart` are FB-6's (#408).

Built by:
- **FB-8**: the Home card, My notes, the note page, the Profile row → `home-card.md`, `notes-list.md`, `note-page.md`.
- **FB-9**: the dashboard rows, Notes for <learner>, the hide confirm, the report sheet, the one-time card → `grown-up-notes.md`, `note-report.md`.
- **FB-11a**: the class notes page, the composer, the family page with its Sent tab → `sent-list.md`, `composer.md`, `family-notes.md` (Sent tab).
- **FB-11b**: the hubs and the nav items → `notes-hub.md`.
- **FB-12**: the Received tab, its sheets and settings, Can send notes → `family-notes.md`.

**Nothing here changes a flag, a route or a string.** `EXPO_PUBLIC_NOTES_ENABLED`, `NEXT_PUBLIC_NOTES_ENABLED` and the Worker's `NOTES_SEND` stay off; the owner controls `NOTES_SEND` (OD-19).

## What is here

| File | What it fixes |
|---|---|
| `home-card.md` | the Home card at row 2a: one note, several, wide, ko and es |
| `notes-list.md` | My notes: New and Earlier, rows, the answer chip, empty, error, split pane |
| `note-page.md` | the note page: preset, words, the quest card (open and closed), the reaction radio group, the seen-by line, the quiet links, every state |
| `grown-up-notes.md` | the dashboard rows, Notes for <learner>, the one-time card, the hide confirm, every state |
| `note-report.md` | the in-app report sheet and its answers |
| `composer.md` | the composer dialog (class and family), result, every problem line |
| `sent-list.md` | the class notes page, take back, the family Sent tab |
| `family-notes.md` | the family Received tab, report / hide / stop sheets, settings, Can send notes |
| `notes-hub.md` | the hubs |
| `mock/` | static HTML on one stylesheet, `notes.css`: pages `notes-list.html`, `note-page.html`, `grown-up.html`, `report-sheet.html`, `composer.html`, `sent.html`, `family.html`; boards `home-card.html`, `notes-list-states.html`, `note-page-states.html`, `grown-up-states.html`, `report-sheet-states.html`, `composer-states.html`, `sent-states.html`, `family-states.html`, `hub-states.html`; `check.html` |
| `shots/` | the mocks rendered in Chromium: pages at 2x (375) and 1x (1280, 320 with text at 200 %), the first screen at 390 x 844 for the note page, the composer and the family page, boards at 1x; 16-colour (4-bit) palette PNGs to keep the repo small, except `check-375.png` and `check-1280.png`, which are full colour so the greyscale and protanopia check is faithful (44 files). `-text200` is the browser text size at 200 % |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/notes.css` is a token of `packages/design-system/src/tokens.ts`, through the app-shell custom properties (named after the token) plus six this pass adds the same way (`feedback.nudge`, `feedback.successDark`, `hoya.nose`, `shadows.modal`, `z.modal`, `layout.pane.gap`), checked against `tokens.ts` on this commit. No colour literal outside the token block. The few numbers that are not tokens are under "Constants".
- **Units.** Console pages: text in rem, the phone / wide switch at 45em (F-APP-001 section 3.8). Learner screens and the grown-up zone: px window classes (600 regular, 700 side by side, 900 wide), as the app-shell and reports passes.
- **Drawn parts.** Glyphs are `Icon/glyphs.ts` paths (`note`, `heart`, `pencil`, `check-circle`, `sparkle`, `check`, `close`, `book`, `arrow-left`, `arrow-right`). Hoya (`cheering`, `idle`) is the Learning Route pass's drawing.
- **Words.** Every drawn UI string is an existing dictionary value: `common.notes`, `learner.notes`, `caregiver.notes`, `console.notes` and `a11y.notes` (FB-5, #417), their Korean and Spanish leaves (FB-5b, #483) on the ko / es items, and the frame's `console.shell.*`, `common.buttons.back`, `caregiver.dashboard.title`, `caregiver.audience.gated`. The console rows and lines are the output of FB-10's view models (`sentRowView`, `receivedRowView`, `recipientRows`, `presetGroups`, `notePreview`, `sendResultLines`, `noteTextMessage`, `groupByDay`), so they are exactly what FB-11a and FB-12 render. Names, classes, dates, account names and the free texts are fixture data; quest titles come from the catalogue. **No new string is needed by these mocks**, with one open i18n item: `ko` has no `caregiver.audience.gated` leaf (the whole `caregiver.audience` group falls back to English while `ko` is hidden), so the Korean note page draws the real runtime name "어른에게 알리기 (PIN required)". The leaf (`(PIN 필요)`, same form as `es`) must land with its ko review before `ko` ships, and before FB-8 merges if FB-8 is the first ko screen to use it; see `note-page.md`, "Notes for FB-8".
- **Annotations.** Dashed boxes and monospace labels are design-board notes, not UI; dashed boxes stand for parts of a screen this feature does not touch.

Open any file in a browser. Links are placeholders. The settings disclosure and the reaction picks work through a few lines of script.

## Entry points that live in other passes' mocks

FB-11a and FB-11b also add buttons to pages that other passes drew. They reuse those parts unchanged, so no new board is drawn; this is where each sits.

| Entry point | PR | Host drawing | Part and place |
|---|---|---|---|
| **Send a note** on a parent-home learner card | FB-11b (after A-5b) | `design/screens/app-shell/parent-home.md`, `mock/parent-home-states.html` | already drawn there: a secondary pill beside **Learning Route**, the pair wraps |
| **Send a note** in the report's insight action slot | FB-11b (after RP-7a) | `design/screens/reports/learner-report.md` ("Insight line") | a ghost pill in the line's action group, as the reports pass specifies for one action; not on an archived class |
| **Notes** on the class and family roster header | FB-11a | `design/screens/transfer/requests-page.md` (roster header button row) | a secondary pill in the header button row, before **Settings**, as **Class moves** is drawn |
| **Send a note** on a roster student card | FB-11a | `design/wireframes/console/roster.md` (card actions) | a secondary pill in the card's action row after **rescue code**, opening the composer with `&learner` |
| Notes item in the adult nav | FB-11b (after A-5a) | `mock/hub-states.html` (this pass, N13) | drawn |

## Constants

Values that are not tokens; the PRs write them as named constants, never as bare literals.

| Where | Value | Derived from |
|---|---|---|
| Glyph on list rows, chips, status lines | 20 px | the glyph sheet's minimum for `note` and `heart` (`design/components/Icon/spec.md`) |
| Glyph on the Home card, dashboard rows, reactions | 24 px | the glyph sheet's 24 dp |
| Hoya on the note page and the empty states | 96 px | `touchTarget.hero`, so the pose never outgrows the preset line at 320 |
| Quest art tile | 64 px | `touchTarget.min`, the Journey quest row's art square |
| Words on a list row | one line, clamped | wireframe "first words" |
| Phone / wide switch (console) | 45em, gutters `layout.gutter.*`, 70em | F-APP-001 section 3.8; the app-shell constants |
| Split pane (learner) | 700 px, list at `layout.pane.master` | `layout.sideBySideMin`, layout/wide.md |
| Wrap point of the one-time card's two equal buttons (Keep, Change) | `flex-basis` 8rem | the shorter label at 200 % text; below it the buttons stack |
| Wrap point of sheet actions (report, hide, stop, take back) | `flex-basis` 12rem | two pills side by side from about 25rem; below it they stack |
| Quest title in the composer's quest picker | `flex-basis` 10rem | the title keeps a readable line before the art and radio wrap under it |
| Font stack | the system stack | `typography.family.sans` is `'System'`; from `app-shell.css` |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `home-card-375.png`, `-1280.png` | board | one note (class, family), several, no card, offline, wide, ko and es |
| `notes-list-375.png`, `-1280.png`, `-320-text200.png` | page | New and Earlier with an answer chip |
| `notes-list-states-375.png`, `-1280.png` | board | empty, error, only Earlier, Encouragements only, self learner and child partner label, the Profile row (unread, all read, es), split pane, ko, es |
| `note-page-375.png`, `-1280.png`, `-320-text200.png` | page | frame A: words and an open quest, no pick yet |
| `note-page-390-first.png` | 390 x 844 | the preset, the words and the sender in the first screen |
| `note-page-states-375.png`, `-1280.png` | board | B, C, D, E, family note, Encouragements only, self-managed, unknown preset, quest not in the build, gone, error, ko, es |
| `grown-up-375.png`, `-1280.png`, `-320-text200.png` | page | Notes for Mina with card C, a put-away note, the setting, Send a note (web) |
| `grown-up-states-375.png`, `-1280.png` | board | dashboard rows, hide confirm, empty, no class, class-scoped, offline, failed, native, self-managed |
| `report-sheet-375.png`, `-1280.png`, `-320-text200.png` | page | the sheet with a reason picked |
| `report-sheet-states-375.png`, `-1280.png` | board | no reason, done, done after Unsafe, hidden, already gone, queued, offline, class-scoped, rate limit |
| `composer-375.png`, `-1280.png`, `-320-text200.png` | page | class composer, one student preselected (full height on a phone, dialog over the list on wide) |
| `composer-390-first.png` | 390 x 844 | title, close and step 1 in the first screen |
| `composer-states-375.png`, `-1280.png` | board | family, Everyone, quest needed, closed mark, result, nothing sent, sending, loading, text problem, every guard and server line, switch off, no students, archived |
| `sent-375.png`, `-1280.png`, `-320-text200.png` | page | the class sent list: batch, answer, quest, Not shown, Taken back, another grown-up's note |
| `sent-states-375.png`, `-1280.png` | board | take back sheets, one learner, locked, anonymized, family Sent tab, empty, loading, error |
| `family-375.png`, `-1280.png`, `-320-text200.png` | page | Received tab with card C and every status |
| `family-390-first.png` | 390 x 844 | heading, Send a note, learner, tabs and card C in the first screen |
| `family-states-375.png`, `-1280.png` | board | report, hide, stop sheets, own note, settings open, no class, Can send notes (owner, read-only), empty, no grant, no learners, loading, errors, limits |
| `hub-states-375.png`, `-1280.png` | board | several classes, several families, none (both), redirect, loading, error |
| `check-375.png`, `-1280.png` | board | greyscale and protanopia check with its contrast table |

## Measured on the mock (Chromium)

| Check | Target | Mock |
|---|---|---|
| Sideways scroll | none (wireframes; F-APP-001 3.16) | none on any of the 17 mocks at 320, 375, 768 and 1280, nor at 320 and 375 with 200 % text (102 renders, every disclosure opened; `scrollWidth` equals the viewport). The adult nav row scrolls inside itself at 320 with 200 % text, as the app-shell pass decided (its D3) |
| Targets | `touchTarget.min` | every link, button, select, text input, radio and checkbox row, tab and switch is at least 64 x 64 at every measured width |
| ids and references | every `aria-controls`, `aria-describedby`, `aria-labelledby` and `for` names an element that exists; no id repeats | met on all 17 mocks |
| One primary per state | wireframes | Read (Home card), Start (note page, only with an open quest), Report and hide, Send / Done, New note, Send a note, Start (hub C); none on My notes, the note page without an open quest and Notes for <learner> |
| Colour as the only signal | never (6.12) | New is a word; the pick is a dot, a check and a bold label; a problem is a sentence; the switch is a thumb position; statuses are words; no red anywhere (`feedback.danger` unused) |
| Text length (ko, es) | the cards and rows hold | the Home card, My notes and the note page drawn in ko and es at 375 and 1280 hold with no clipping; the console is drawn in English (its ko / es leaves exist, the pseudo-locale check belongs to FB-11a) |

### Contrast, greyscale and protanopia (WCAG 2.1, from the token values; `mock/check.html`)

Greyscale keeps WCAG luminance, so its column equals the normal one.

| Pair | Normal | Protanopia | Floor |
|---|---|---|---|
| "New" pill text (brand.secondaryDark) on brand.secondaryLight | 5.83 | 5.49 | 4.5:1 |
| Note card and list text (text.primary) on paper | 16.10 | 16.38 | 4.5:1 |
| Preset line on a card, list words (text.secondary) on paper | 8.44 | 8.78 | 4.5:1 |
| Dates, counter, Required (text.muted) on paper | 6.01 | 6.20 | 4.5:1 |
| Picked reaction border and check (brand.primary) on paper | 5.44 | 6.83 | 3:1 |
| Unpicked reaction border (border.strong) on paper | 1.95 | 2.00 | none: the radio dot, the check and the bold label carry the pick |
| Radio ring (border.shape) on paper | 4.55 | 4.71 | 3:1 |
| Quiet links and seen-by line (text.secondary) on canvas | 7.97 | 8.25 | 4.5:1 |
| Put-away line and done line (text.primary) on surface.sunken | 13.58 | 13.68 | 4.5:1 |
| One-time card text (text.primary) on brand.secondaryLight | 12.35 | 12.89 | 4.5:1 |
| Problem line (text.primary) on feedback.nudgeLight | 14.02 | 13.98 | 4.5:1 |
| Problem bar (feedback.nudge) on paper | 1.86 | 2.06 | none: decoration; the sentence and `aria-invalid` carry it |
| Invalid field border (text.primary) on paper | 16.10 | 16.38 | 3:1 |
| Result block (text.primary) on feedback.successLight | 13.24 | 13.71 | 4.5:1 |
| Saved check and word (feedback.successDark) on paper | 7.55 | 7.21 | 4.5:1 |
| Quest art glyph (brand.primaryDark) on brand.primaryLight | 5.76 | 6.67 | 3:1 |
| Primary label on brand.primary | 5.44 | 6.83 | 4.5:1 |
| Disabled labels (text.muted) on surface.sunken | 5.07 | 5.18 | exempt (disabled) |
| Switch on: track brand.primary vs paper | 5.44 | 6.83 | 3:1 |
| Switch off: ring border.shape vs paper | 4.55 | 4.71 | 3:1 |
| Back link (brand.secondaryDark) on canvas | 7.17 | 6.56 | 4.5:1 |
| Focus ring (border.focus) on paper | 4.30 | 3.91 | 3:1 |

## Enlarged text

The 200 % shots use the browser's own text-size setting (Chromium `Page.setFontSizes`, default 32 instead of 16), as the site, Learning Route, app-shell, reports and class-move mocks do; each `-text200` shot grows the viewport to the page height and sets the sizes again before the capture.

## Decisions taken in this design pass

- **N1. The Home card is one target.** The whole card is the pressable with `a11y.notes.card`; Read is drawn inside it as the primary pill, not a second focus stop (wireframe "one target, one focus stop"). No Hoya on the card.
- **N2. "New" is the `Pill` secondary tone** (`brand.secondaryLight` / `brand.secondaryDark`, 5.83:1), a word, never a dot, never amber or red, so it never reads as a warning.
- **N3. Reactions are a radio group of full-width pills.** Picked: a filled radio dot, a thick `brand.primary` border, a bold label and the `check` glyph; the heart never fills (glyph sheet). The seen-by line is the group's description, shown before and after a pick; a pick is announced with `a11y.notes.reactionPicked`.
- **N4. The quiet links sit under a rule at the bottom**, in `text.secondary`, `touchTarget.min` tall; "Tell a grown-up" carries "(PIN required)" in its accessible name (`caregiver.audience.gated`) because it opens the gate; "Report this note" on a self-managed profile does not. "Put this note away" is a button drawn as a quiet link (it acts in place and navigates nowhere); the other two are links. Open: the `ko` gated name (see "Words").
- **N5. A list row's name is `a11y.notes.row` plus `a11y.notes.answer`** when answered; the free text is not in the name. The words show as one clamped line.
- **N6. The grown-up zone takes the in-app report's look** (round back button, one reading column); the dashboard gets rows only (`caregiver.notes.row.title` + New pill), never a note list.
- **N7. Repeated row actions are described by their row.** Hide, Report, Stop and Take back carry `aria-describedby` to their row's first line (sender and date, or "To <name>"), so a screen reader hears which note each acts on, with no new string.
- **N8. Problems are amber, never red.** A problem line is `text.primary` on `feedback.nudgeLight` with a `feedback.nudge` bar (decoration); the field adds `aria-invalid` and a thick `text.primary` border. Send stays `aria-disabled` (focusable) and is described by the reason.
- **N9. The composer is a dialog from 45em and a full-height view below**, with numbered steps (decoration), the preview under the form, Send as the one primary, Done as the primary of the result.
- **N10. Family rows follow FB-10 `receivedRowView`.** A taken-back or hidden note keeps Report and Stop (the wireframe drew only Report on a taken-back row and no action on a hidden one); the view model, already reviewed and merged, is the source. The date heads each row inline ("Today · From Saturday Class B (teacher)").
- **N11. Can send notes is a `role="switch"` with no on/off words**, named by the person and the label together (`aria-labelledby`), its state a thumb position and a filled track; read-only for caregivers who are not the owner.
- **N12. The one-time card is `brand.secondaryLight`** with two equal secondary buttons (Keep, Change): information, not a warning, and no primary competes with the page's.
- **N13. The teacher frame draws a Notes item** (FB-11b's `teacherNotes`); the parent item is already in `ADULT_NAV`. Lessons is not drawn (its own flag).

## Review

Made with the precedent passes' review lenses in place of the owner's hand mocks (owner decision 2026-10-12): design, accessibility, anti-shame and copy, privacy, applied to every board before this PR, plus the measurements above.

- **Design**: every state of the nine wireframes drawn or ruled out with a reason (the unknown-mode setting row is left out, nothing to draw; the hub's one-space case is a redirect); one primary per state; the app-shell parts reused unchanged.
- **Accessibility**: targets, focus order, sideways scroll at 320 to 1280 and at 200 % text, greyscale and protanopia, unique ids and live references. Fixes applied in this pass: a 1 px overflow of the picker's row notes at 320 with 200 % text (`overflow-wrap`), Send now described by its reason, the Can send notes switches named by their person, repeated row actions described by their row (N7).
- **Anti-shame and copy**: no red, no countdown, no "unread" or "no reply", no count but "2 new notes"; "Not shown" never says why; no age words, no speaking words; every string a dictionary value, so the FB-5 / FB-5b copy tests already cover it.
- **Privacy**: no learner name in a URL (the mocks' links are placeholders; FB-10 `ROUTES.spaceNotes` carries ids only); the teacher's account is never shown to the family; the learner never sees an account name; the Home card shows no free text; a class sender never reads "Opened"; a batch row lists nobody who did not answer; a device-reported family note reads "Not shown" to its sender (drawn on the family Sent tab).
