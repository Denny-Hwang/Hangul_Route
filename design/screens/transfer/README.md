# Class move screens: start sheet, requests page, family page, consent sheet, Classes card, app sheets (design mocks v1)

Spec: `docs/specs/F-SPACE-002-class-transfer.md`. This is the **design pass T-0b** (section 7 PR table: "hard dependency of T-6 and T-7"; flip gate G5) that CLAUDE.md section 5 requires before the console (T-6b, T-6c, T-6d) and app (T-7b, T-7c) screens. The owner decided on 2026-10-12 that agents make these mockups with multi-agent review instead of by hand. The mocks draw sections 4.2 (matrix, guards, views), 4.8 (console), 4.9 (limits as the user meets them), 4.10 (after the move), 4.11 (consent text), 4.12 (app) and 4.13 (edge cases).
Wireframe: `design/wireframes/console/class-transfer.md` (screens 1 to 7, states, accessibility). Related wireframes: `console/space-settings.md`, `console/roster.md`, `console/home.md`, `sync/join-space.md`.
Reused, not redrawn: the adult frame, buttons, learner-app parts and design board of the app-shell pass (#420, `design/screens/app-shell/`); `mock/transfer.css` imports `../../app-shell/mock/app-shell.css` unchanged, as the reports pass imports Learning Route's stylesheet.
Built by:
- **T-6b**: the requests page (class variant), the roster button, the home counts → `requests-page.md`.
- **T-6c**: the settings row Move action and the start sheet → `start-sheet.md`.
- **T-6d**: the family page, the consent sheet with its language switch, the teacher-requests switch → `family-page.md`, `consent-sheet.md`.
- **T-7b**: the Classes card variants and Move → `classes-card.md`.
- **T-7c**: `MoveClass`, `ApproveTransfer`, the read-only sheet, the Home line, the `PinEntry` destinations → `app-sheets.md` (and the app column of `consent-sheet.md`).
- T-6a (client, helpers) and T-7a (app logic) take the state names, the counts rule and the copy keys from these files; T-7d moves the app strings into `packages/i18n`.

**`CLASS_TRANSFER` stays off.** Nothing here changes a flag, a route or a string in the product; every surface drawn renders only behind `NEXT_PUBLIC_CLASS_TRANSFER` (console) or the inbox's `transfersEnabled` (app), flipped by the owner after the gates of section 7.

## What is here

| File | What it fixes |
|---|---|
| `requests-page.md` | `/teach/space/transfers` for a class: source and destination cards, steps, scheduled, room, history, every state, the roster button and the home counts |
| `start-sheet.md` | the settings learner row (class, family, offline, archived) and the start sheet: code field, preview, every error, sent |
| `family-page.md` | the same route for a family: cards for the learner side, Start a move, the teacher-requests switch, the guardian-predicate notices, moved and ended lines |
| `consent-sheet.md` | the consent sheet on both surfaces: canonical order, identity block, conditional lines, the button rule, language, every state |
| `classes-card.md` | the learner app's Classes & family card: variants (a) to (d), pending, planned, offline, after the move |
| `app-sheets.md` | `MoveClass`, `ApproveTransfer`, the read-only sheet, the planned sheet, the Home line |
| `mock/` | static HTML on one stylesheet, `transfer.css`: `requests.html`, `requests-states.html` (board), `settings.html`, `start-sheet.html`, `start-sheet-states.html` (board), `family.html`, `family-states.html` (board), `consent-sheet.html`, `consent-sheet-states.html` (board), `classes-card.html` (board), `app-sheets.html` (board), `check.html` |
| `shots/` | the mock rendered in Chromium. Page shots at 2x, boards at 1x, stored as 128-colour palette PNGs (30 files, about 4.2 MB). File names give the page and the viewport width; `-first` is the first screen only; `-text200` is the browser text size at 200 % |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/transfer.css` is a token of `packages/design-system/src/tokens.ts`, through the app-shell custom properties (named after the token: `--spacing-xl` is `spacing.xl`) plus four this pass adds in the same way (`feedback.nudge`, `feedback.successDark`, `shadows.modal`, `z.modal`), checked against `tokens.ts` on this commit. No colour literal outside the token block. The few numbers that are not tokens are under "Constants".
- **Units.** Console pages: text in rem, the phone / wide switch at 45em (F-APP-001 section 3.8), so a browser text size moves the switch with the text. Learner-app screens: px window classes, as the app-shell pass.
- **Drawn parts.** Glyphs are `Icon/glyphs.ts` paths (`check`, `dash`, `check-circle`, `pause`, `lock`, `close`, `arrow-left`, `arrow-right`). Learner avatars are `AvatarChip` discs (28 px, cub colours). The class code field is the shipped join field of `JoinSpaceScreen`.
- **Words.** Consent lines and visible-list items are `TRANSFER_CONSENT_TEXT.en` of `packages/content-schema/src/schemas/transfer-consent.ts`, word for word. Other strings are the wireframe's and the spec's English drafts, word for word, or existing dictionary values (`console.space.codeLabel.class`, `console.settings.learners.remove.*`, `console.space.relinkRequests.cta`, `console.space.settings.cta`, `console.tryAgain`, `caregiver.spaces.*`, `caregiver.join.code.rules`, `caregiver.join.code.looking.cta`, `caregiver.retry.offline`, `common.buttons.done` / `.back`, the existing "Please sign in again." and "Back to the roster"). The strings with no draft are listed under "New strings". Names, classes, dates and counts are fixture data.
- **Annotations.** Dashed boxes and monospace labels are design-board notes, not UI; dashed "unchanged" boxes stand for parts of a screen this feature does not touch.

Open any file in a browser (`design/screens/transfer/mock/requests.html`). Links are placeholders. The one disclosure (Not now with reasons) works through a few lines of script; "What the new teacher sees" is a plain line and list, always open (D15).

## Constants

Values that are not tokens. Each derives from a token, the content or a measurement; the PRs write them as named constants, never as bare literals.

| Where | Value | Derived from |
|---|---|---|
| Phone / wide switch, gutters | 45em, then `layout.gutter.compact` / `.regular` / `.wide` (70em) | F-APP-001 section 3.8; the app-shell constants (#420) |
| Console sheet width | at most `layout.maxWidth.reading` (720 px) | the reading column of the pages behind it; below 45em the sheet fills the screen |
| Class code field | 18rem (288 px) basis, full width on phones | measured: six `size.display` characters with `spacing.sm` tracking need about 270 px with `spacing.md` padding; `JoinSpaceScreen`'s field is full width |
| Step glyph | 20 px | the console's inline glyph size (app-shell way back) |
| Gate glyph | 16 px | the label's cap height at `size.bodySm`; the app's small `Icon` |
| Learner chip | 28 px | `AVATAR_CHIP_SIZE` (`AvatarChip.tsx`, unchanged) |
| Refresh | 30 s | spec 4.8 |
| Font stack | the system stack | `typography.family.sans` is `'System'`; from `app-shell.css` |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `requests-375.png`, `-1280.png` | page | class page as both source and destination: a family-started card to agree, a waiting card, a scheduled card, history, a destination card to accept, a destination card waiting for room |
| `requests-390-first.png` | 390 x 844, first screen | the first card with its Agree in the first screen |
| `requests-320-text200.png` | 320, text 200 % | the same page enlarged, one column, no sideways scroll |
| `requests-states-375.png`, `-1280.png` | board | loading, empty, every source and destination card, the reasons disclosure, both room causes, cap_learner, after a move in (New class code), failed action, request_changed, retry asked again, the destination waiting after its yes, a family-started source card without Cancel, ended meanwhile, 401, 403, locked, the roster button at zero and two, the teacher home (school row with per-class counts) and family home counts |
| `settings-375.png`, `-1280.png` | page | class settings with Move beside Remove, the Danger zone below |
| `start-sheet-375.png`, `-1280.png`, `-320-text200.png` | page | the start sheet at step 2 over the overlay |
| `start-sheet-states-375.png`, `-1280.png` | board | class, family, offline and archived rows; step 1 empty and looking; the seven error sheets and the five other answers (same_space, already_open, destination_busy, too_many_requests, not_transferable); step 2; sent |
| `family-375.png`, `-1280.png`, `-320-text200.png` | page | family page: a teacher-asked card, a waiting card, Start a move, the switch rows with a self-managed adult |
| `family-states-375.png`, `-1280.png` | board | every family card and notice (after Yes with both classes and with one class left); the Start a move answers (learner_manages_own, both already_open variants, locale, and the shared ones) |
| `consent-sheet-375.png`, `-1280.png`, `-320-text200.png` | page | a teacher-started sheet with four conditional lines |
| `consent-sheet-390-first.png` | 390 x 844, first screen | the heading, language switch and the summary block in the first screen |
| `consent-sheet-states-375.png`, `-1280.png` | board | no conditional line, all five (with the teacher-started Not now line), Yes waiting for the end, locale not available, text updated, Yes failed |
| `classes-card-375.png`, `-1280.png` | board | (a); (b) with a teacher request; a teacher request after the grown-up said yes; a managed device with no PIN and an open request (Review runs the PIN setup first); (c) with Move on every row and with a consent reset; self-only; (d) no PIN; (d') a new PIN; device consent off; learner-side waiting (both wordings); waiting for room; route none; planned; ended; offline; after the move; flag off |
| `app-sheets-375.png`, `-1280.png` | board | PinEntry (unchanged), MoveClass steps and every answer, the managed and self consent sheets (list open, language switch), Yes waiting for the end, sent, ApproveTransfer, the read-only sheets (teacher-started, teacher-started after the grown-up said yes, learner-side waiting, waiting for room, asked again off the device route), planned, offline, moved, the Home lines |
| `check-375.png`, `-1280.png` | board | greyscale and protanopia check |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| Sideways scroll | none (wireframe accessibility; F-APP-001 3.16) | none on any of the 12 mocks at 320, 375, 768 and 1280, nor at 320 and 375 with 200 % text (72 renders, `scrollWidth` equals the viewport; measured again after the review round, with every disclosure also opened) |
| Targets | `touchTarget.min` | every link, button, select, text input and checkbox row on the 12 mocks is at least 64 x 64 at every measured width, including the 64 px sheet close button and the app's back button |
| ids and references | every `aria-controls`, `aria-describedby`, `aria-labelledby` and `for` names an element that exists; no id repeats | met on all 12 mocks |
| First screen, requests page at 390 x 844 | the first answer is reachable without scrolling (wireframe: waiting for you first) | met: the first card's Agree sits in the first screen with the frame counted (`requests-390-first.png`) |
| First screen, consent sheet at 390 x 844 | the summary (`moving`, `new_teacher`, `old_teacher`) is the first thing read (4.11 layering) | met: heading, language switch and the whole summary block fit (`consent-sheet-390-first.png`) |
| Primary not above an unread line | 4.11 | met by position (the buttons are the last element, never sticky) and by the end sentinel: Yes is `aria-disabled` until the line after `cannot_undo` has been in view (D2; drawn on both state boards). A scroll-position rule, not evidence of reading: a keyboard skip still reaches an active Yes (D2) |
| Colour as the only signal | never | steps: check glyph + "said yes" vs dash + "waiting"; room: pause glyph + sentence; conditional lines: the sentence (the bar is decoration); the gate: lock glyph + "(PIN required)"; no red anywhere (`feedback.danger` unused) |
| Text length (ko, es) | the step boxes and the code row hold in every locale | measured in English only. T-6b and T-6d measure the three step boxes at 720 px and the code row with the pseudo-locale before the KO and ES review; a step box may wrap its state word under its name (the 1280 shot shows "you said yes" doing so) |

### Contrast, greyscale and protanopia (WCAG 2.1, from the token values; `mock/check.html`)

Greyscale keeps WCAG luminance, so its column equals the normal one.

| Pair | Normal | Protanopia | Floor |
|---|---|---|---|
| "said yes" check and word (`feedback.successDark`) on paper | 7.55 | 7.21 | 4.5:1 |
| "waiting" dash and word (`text.muted`) on paper | 6.01 | 6.20 | 4.5:1 |
| said yes vs waiting, against each other | 1.26 | 1.16 | none: the glyph shape (check vs dash), the word and the weight carry the state |
| Room block text and pause glyph (`text.primary`) on `feedback.nudgeLight` | 14.02 | 13.98 | 4.5:1 |
| Room block amber bar (`feedback.nudge`) on paper | 1.86 | 2.06 | none: decoration; the glyph and the sentence carry the state |
| Consent summary (`text.primary`) on `brand.secondaryLight` | 12.35 | 12.89 | 4.5:1 |
| Done line (`text.primary`) on `feedback.successLight` | 13.24 | 13.71 | 4.5:1 |
| Notice (`text.primary`) on `surface.sunken` | 13.58 | 13.68 | 4.5:1 |
| Back link (`brand.secondaryDark`) on canvas | 7.17 | 6.56 | 4.5:1 |
| Level pill, disabled labels and the waiting Yes (`text.muted`) on `surface.sunken` | 5.07 | 5.18 | 4.5:1 (disabled exempt) |
| Card lines (`text.secondary`) on paper | 8.44 | 8.78 | 4.5:1 |
| Code rules (`text.muted`) on canvas | 5.68 | 5.83 | 4.5:1 |
| Primary label on `brand.primary` / fill vs canvas | 5.44 / 5.14 | 6.83 / 6.42 | 4.5:1 / 3:1 |
| Lock glyph and ghost labels (`brand.primary`) on paper | 5.44 | 6.83 | 3:1 / 4.5:1 |
| Conditional-line bar (`border.strong`) on paper | 1.95 | 2.00 | none: decoration |
| Focus ring (`border.focus`) on paper | 4.30 | 3.91 | 3:1 |

## Enlarged text

The 200 % shots use the browser's own text-size setting (Chromium `Page.setFontSizes`, default 32 instead of 16), as the site, Learning Route, app-shell and reports mocks do; each `-text200` shot grows the viewport to the page height and sets the sizes again before the capture. The console renders tokens as px inline styles today, which this setting does not enlarge; T-6b, T-6c and T-6d follow the rem / em method where they touch layout (`globals.css`), as F-APP-001 does.

## New strings (no draft in the spec or the wireframe)

T-6a adds the console ones to the console message namespace (`console.transfer.*` in `packages/i18n/src/messages/en/console.ts`, which `lib/console/copy.ts` collects for the ban-list test: section 4.8's `COPY`); T-7d adds the app ones under `caregiver.transfer.*`. Consent lines stay in the keyed catalogue of `transfer-consent.ts`. English drafts:

| Draft | Where |
|---|---|
| "Who has said yes" | `a11y`: the steps list label (console and app) |
| "Choose an answer" | `a11y`: the group of the two reasons |
| "Class moves updated." | `a11y`: the polite live region after a refresh changed something |
| "A student joined this class" | destination history line (the source line "A student moved to another class" is the wireframe's) |
| "Your class code may have been shared during the move. You can make a new one." | destination, after a move in, beside **New class code** |
| "Everyone has said yes. The school is full right now." | destination room block, `cap_school` |
| "Everyone has said yes. The move is waiting." | destination room block, `cap_learner` |
| "{Name} is in the most classes allowed. Leave one, then the move can go ahead." | learner side room block, `cap_learner` |
| "New class: {Destination}" | source card when this class started the request |
| "Move requests from teachers" | family page section heading over the switch rows |
| "No learner here is in a class right now." | family page, Start a move with no learner in a live class |
| "A tablet that joined through {Source} needs to join again." | family, after the move, when `relinkAffected` |
| "Who is the new class?", "Teacher: {owner}", "{n} learners" | consent sheet identity block (wireframe drew them as data) |
| "Less than a week old", "A few weeks old", "A few months old", "More than a year old" | identity block, keyed by `ageBucket` (`days`, `weeks`, `months`, `years`); null leaves the age out |
| "Read to the end to continue." | consent sheet, both surfaces: the waiting Yes's description (D2) |
| "Not now ends this request. You can start a move yourself any time." | console consent sheet and family card, teacher-started only |
| "Not now ends this request." | app read-only sheet, teacher-started |
| "Not now, choose a reason" | `a11y`: the destination's Not now disclosure (D5) |
| "That code is for the class {Name} is in now." | `409 same_space` (console and app) |
| "{Name} already has a move waiting." | `409 already_open`, teacher start sheet |
| "A class already asked about moving {Name}. Its card is above." / "... Look on the Classes & family card." | `409 already_open` started by a class: family page / app |
| "A move for {Name} is already waiting. Its card is above." / "... Look on the Classes & family card." | `409 already_open` started by the learner side: family page / app |
| "That class has many moves waiting. Try again in a few days." | `409 destination_busy` |
| "Too many moves were started today. Try again tomorrow." | `429 too_many_requests` |
| "That code can't be used for a move." | `422 not_transferable` |
| "Ask the grown-up with the account to start this move in the console." | app, `409 caregiver_required` |
| "Moves can't be started on this device yet." | app, `422 device_consent_locked` |
| "Something changed. Look again.", "Refresh" | console card, `409 request_changed` |
| "You said yes. Nothing changes until everyone says yes." | destination card after its own yes while the request is still `requested` (the source has not answered, or the family's yes was reset, T8), and after a retry answered `consent_outdated` / `not_approved`; spec 4.8 "Cancel while open" and the general waiting copy |
| "Saturday Class B: 2 class moves waiting" (`{Class}: {count}`) | teacher home, school row, one link per child class; the count is the class's own `pendingCount` (T-5d) |
| "Waiting for the other class. The move happens after {date} if it says yes. You can cancel any time." | family card after Yes when one class is still waiting |
| "Moves open one day after the PIN is set." | app Classes card (d'), a PIN made less than a day ago |
| "This move can't be answered here." | app, route `none` (card row and read-only sheet) |
| "Waiting for the classes to answer." | app, learner-side request with both classes waiting (one class left: spec's "Waiting for the other class to answer.") |
| "Please check this again." | app card row after a consent reset (the family card's existing line) |
| "Cancel the request" | app read-only sheet, the veto on a learner-side request |
| "Review the move" | `a11y`: every app Review button |
| "Move {Name} to another class", "Move {Name} to a class" | `a11y`: the settings and start-sheet row buttons |
| "{space} (teacher {owner})", "{family} (you)", "{family} (family, {owner})" | `visible_today` items |
| "This text was updated. Please read it again." | consent sheet after `consent_text_stale` / `terms_changed` |
| "Sending…" | start sheet busy label |
| "Move to {Destination}?" | app consent title, self audience |
| "{Source} asked about a move." | app Classes card pending row, teacher-started |
| "Cancel the move" | app planned sheet |

Every other drawn string is a wireframe or spec draft (word for word) or an existing dictionary value. Every string passes the caregiver ban list (`isCaregiverSafe`) by construction: no "kid", no age, no blame word, no price, no plan name.

## Decisions taken in this design pass

- **D1. Canonical consent order.** The sheet renders `TRANSFER_CONSENT_LINES` in the code's order (`keeps` and `cooling_off` right after the summary), not the wireframe's grouping, because the order is part of the recorded text (4.11 parity test). The destination identity facts sit as a block directly above `typed_names`.
- **D2. The primary is last and waits for the end.** The buttons are the last element (no sticky footer), and **Yes** is `aria-disabled` with the hint "Read to the end to continue." until an end sentinel after `cannot_undo` has been in view once (spec 4.11, both surfaces). The list is always open, with no toggle (D15). `l_shown_json` is server-computed, so the sentinel is a client rule that T-6d and T-7c test; recording it would be a schema change (not in this pass). **The sentinel is a scroll-position rule only, not evidence of reading, and it does not stop a keyboard skip**: tabbing to the checkbox or to Yes scrolls it into view, the sentinel sits just above, and Yes turns active. Tests that can fail: on a sheet taller than the viewport Yes starts `aria-disabled` and turns active only after the sentinel intersects; a sheet shorter than the viewport starts active. Whether this is enough is counsel's call at G2.
- **D3. Three steps, words first.** Each step is a glyph (check or dash), the step name and a state word. One per row on phones, three boxes from 45em. No progress bar, no percentage. The family side names the classes; the source side says "This class" / "New class"; the destination has no step list (it never learns the source's answer).
- **D4. One button for the roster entry**, as Re-link does: "Class moves" at zero, "N class moves waiting" with a count. The teacher home and the family home show the count only when it is above zero; a school row shows counts only.
- **D5. Not now with reasons is a disclosure**, not an ARIA menu: one button opens a group of two buttons (Not now, No room). Only the receiving class has it. The disclosure's accessible name is "Not now, choose a reason" (visible "Not now" inside it), so it never reads as a duplicate of the inner Not now.
- **D6. Waiting for room** is a `feedback.nudgeLight` block with a `pause` glyph in `text.primary` and a `feedback.nudge` bar (decoration, 1.86:1, never the signal). The source and the family read "Waiting for room in the new class."; only the destination reads "full".
- **D7. Gate mark.** A gated button in the app carries the `lock` glyph and "(PIN required)" in its accessible name; a self-only device without a PIN opens directly and shows no glyph.
- **D8. The veto on every open request.** The learner's full-scope device keeps one gated Review on any pending row (routes `caregiver`, `device` and `none`), opening the read-only sheet whose only actions are the veto (Not now on a teacher-started request, Cancel the request on a learner-side one) and Back (guard 11). The quiet line says where the yes happens. No PIN is asked for a yes the device cannot give. Spec 4.12 (b) is amended to say so.
- **D9. Class-wide lines once per card.** (a)'s rescue-code line and (d)'s PIN line appear once under the rows, not under every class row.
- **D10. Settings row order.** Move to another class comes before Remove from class; both are secondary buttons; Move is never in the Danger zone; the archived row shows neither.
- **D11. Find class steps down at step 2** (one primary per state: Send request).
- **D12. History without names.** Source "A student moved to another class", destination "A student joined this class", any ending "This request ended.", each with a date only. The family alone may see "Ended from {Name}'s tablet.".
- **D13. Route `none` gets its own line.** Spec 4.12 (d) used to pair the PIN prompt with `none` and add "Waiting for the family."; but `none` is exactly the state where no PIN helps (a teacher-started request after `selfManaged` or the family left; a learner-side one with device consent off). The app draws "This move can't be answered here." with the gated veto, and the PIN prompt moves to the no-request rule (D16). Spec 4.12 (d) is amended.
- **D14. Visible-today wording.** A class reads "{space} (teacher {owner})", the viewer's family "{family} (you)", another family "{family} (family, {owner})" (the self-managed adult's sheet).
- **D15. The visible list is always open**, on the console and in the app, as spec 4.11 says ("expanded by default"): "What the new teacher sees:" is a plain line followed by the list, with no toggle, so the core disclosure can never be folded on a sheet that records a yes. The wireframe's "may fold the list for space" is withdrawn (wireframe amended); it costs only scroll length.
- **D16. Choosing the Classes card variant** (`classes-card.md`): with an open request, its `learnerRoute`; with none, a device rule from data the app already has (scope, `transferDeviceConsent`, family memberships, `selfManaged`, and `consent-gate.ts`: self consent, PIN existence and `pinCreatedAt`). The PIN prompt shows only when a PIN would open the route; a PIN made less than a day ago reads "Moves open one day after the PIN is set."; device consent off shows nothing. No new inbox field is needed. While a request is open, no row shows Move.
- **D17. "Agreed by the school admin." stays on its own class.** It shows only where this class's own slot was filled `via: school_admin`; when the admin filled both slots, both pages show it (owner decision T11's case, and its test). This is a reading of T11 that keeps T8 (the destination never learns the source's answer); the owner confirmed this reading on 2026-10-14 (F-SPACE-002 T11), and the server change is spec row T-5d (#497), which T-6b depends on.
- **D18. Class age is a bucket.** The identity block keys four phrases on `ageBucket`; no number is drawn and no finer field is asked for (spec 4.2 "class age bucket").
- **D19. The app sheet has the language switch** (guard 7 "offers the language switch"), the same select as the console, starting at the UI locale. Until ko and es texts are reviewed (G2), those choices show "Not available in your language yet." on both surfaces.
- **D20. Home never carries a yes.** The self-audience Home line opens `ApproveTransfer` ("Yes, move me" sits after the lines), so a yes always follows the consent text. Spec 4.12 Home is amended.
- **D21. Not now says what it does when it ends a request.** On a teacher-started sheet and the family card: "Not now ends this request. You can start a move yourself any time." as Not now's description; the label stays the wireframe's "Not now".
- **D22. Cancel on a source card follows `initiator`.** The source card shows **Cancel request** while the request is `requested` or `approved` (waiting for others, waiting for room, scheduled) only when this class started it (`initiator: 'source'`), as the cancel route allows (spec 4.4); a family-started request never shows it there. The start sheet's "You can cancel any time before the move." stays true while the move waits for room.
- **D24. A managed device with no PIN keeps the veto.** A gated Review on an open request runs the existing PIN setup first (`initialPinMode` `setup-1`), then opens the read-only sheet. The rule is "never a PIN prompt for a yes the device cannot give", not "never a PIN prompt": guard 11 keeps the veto on the device. The no-request rule gains a last branch (a self profile without its consent time shows nothing), and unknown inbox values read as route `none`, learner-side wording and no age.
- **D23. The destination's waiting line after its yes.** Once the destination has said yes and the request is still `requested` (the source has not answered, or the family's yes was reset and the card stays listed, T8), the card reads "You said yes. Nothing changes until everyone says yes." with no actions. The same line covers both causes, so the destination learns neither the source's answer nor the reset.

## Review

Made with a multi-agent review in place of the owner's hand mockups (owner decision 2026-10-12). Lenses (the spec's T-0b row: design, accessibility, anti-shame and copy, privacy) applied to every board before this PR: spec conformance (every state of the wireframe and of spec 4.8, 4.12 and 4.13 drawn or ruled out with a reason, D13), privacy (T8: the destination never sees a name, id, progress or source before the move; T14: no names in URLs or titles), anti-shame (no actor or reason on an ending, no red; no countdown on learner, family or destination surfaces, while the source teacher's card shows days left as plain meta text per `daysLeft`), audience (no age wording, "learner" and "grown-up" on shared surfaces), consent text fidelity (word for word from the schema, canonical order), tokens (no literal outside the token block), and accessibility (targets, focus order, sideways scroll, 200 % text, greyscale and protanopia). Fixes found by that pass and applied here: the reasons group showed while closed (a `[hidden]` rule), the code field was too narrow for six characters, the route line sat under the steps, Find class stayed primary next to Send request, and the app variants mixed a family row into the device route.

**Review round 2 (two independent reviewers on PR #472).** Accepted and applied: the missing app states (waiting for the classes, waiting for room, ended, route `none`) and the guard-11 veto on every open request (D8, D13); every reachable error code with a drawn line (start sheet, family page, MoveClass, request_changed, retry asked again); the reading gate on both surfaces with the list open everywhere (D2, D15); the spec amendments for 4.8, 4.11 and 4.12; the variant rule and the PIN lines (D16); the step 2 privacy sentence; one live region per page; the destination disclosure name (D5); the countdown wording above; Move on every class row; the Home targets by route; per-class counts on the school row; T-7c depending on T-0b; class age as a bucket (D18); the school-admin line on its own class (D17); the inbox learner count as a T-5c follow-up (`app-sheets.md`); the app language switch (D19); learner names in the row buttons; the Not now line (D21). Nothing was rejected.

**Review round 3 (two independent reviewers on PR #472, head a5fb5927).** Applied: a teacher request after the grown-up said yes on the Classes card and the read-only sheet; the no-PIN veto (D24); the family card's one-class line; "initials, a picture and a level" in the step 2 sentence; `awaiting_learner` and `one_slot_per_action` lines and the Agree-for-both condition; one count rule (`pendingCount`) for the school row, through T-5d; the server follow-ups as spec row T-5d with the T11 reading (D17); the missing no-request branch and the unknown-value fallbacks; the class-started meta on the scheduled page card; D2 reworded (a scroll-position rule, not evidence of reading); the visible list as a plain line with no toggle (D15); spec 4.8 Cancel follows `initiator`. Kept: (d)'s Set up PIN button (it opens the same PIN setup as Profile, then Grown-ups; the child-made-PIN risk is recorded for counsel at G6, spec A4).

**Codex review (PR #472, commit 43d93928).** The reading gate (P1) was already closed by D2 in review round 2. The two P2s are applied: Cancel on a source card follows `initiator`, including while a source-started move waits for room (D22, `requests-page.md` Cards), and the destination card has a waiting line after its own yes, for a source that has not answered and for a family yes that was reset (D23, Cards and States). `requests-states-375.png` and `-1280.png` are re-rendered.
