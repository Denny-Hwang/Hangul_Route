# Onboarding: the guest first quest, its save, and the chooser and site pieces (design mocks v1, GU-0b)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` (sections 6 to 9, 13.2, 14, 16). This is design row **GU-0b**: the agent design pass that CLAUDE.md section 5 requires before a component is built (no component without a mock, no mock without a wireframe), approved by multi-agent review on the owner decision of 2026-10-12 (the precedent of OA-0b in `design/screens/profiles/` and SA-0b, #753).
Wireframes: `design/wireframes/onboarding/guest-first-quest.md`, `design/wireframes/onboarding/guest-save.md`, `design/wireframes/profiles/who-is-using-guest.md` (GU-0, #812).
Built by:
- **GU-3**: Hoya's hello and Discover page 1 in a guest run, the storage-blocked line, Welcome's waiting card → `guest-first-quest.md`.
- **GU-4**: Results' guest variant and its save card, the two save steps with Add an email, Not now (`GuestLater`), the first Home bubble → `guest-save.md`.
- **GU-5**: the chooser's Try the first quest and guest tiles, People on this device's guest row, the guest-only gate line on PIN setup → `design/screens/profiles/who-is-using-guest.md`.
- **GU-6**: the site hero line, How it works steps 1 and 3 and the /learners level answer with the `guestLesson` claim on → `design/screens/site/guest/README.md`.

## What is here

| File | What it fixes |
|---|---|
| `guest-first-quest.md` | the guest run's first screens and Welcome's waiting card: layout, reading order, decisions D1 and D2 |
| `guest-save.md` | Results' save card in its three cases, the two save steps, GuestLater, the first Home: decisions D3 to D10 |
| `mock/guest.css` | the sheet of this pass, linked after `../../app-shell/mock/app-shell.css` (tokens, board), `../../app-shell/mock/display-nav.css` (text size, ScreenHeader, Display control, ConfirmSheet) and `../../profiles/mock/profiles.css` (tiles, rows, PIN pad, sheets) |
| `mock/guest-quest.html` | boards 1 to 9: Hoya's hello, Discover page 1, the storage-blocked line, in en, es, ko |
| `mock/guest-welcome.html` | boards 1 to 6: Welcome with the waiting card, quest not done and quest done, in en, es, ko |
| `mock/guest-results.html` | boards 1 to 12: Results with the save card, cases open (3 stars, 1 star), verify and owner, and Try this one again under every cheer but perfect, in en, es, ko |
| `mock/guest-save-steps.html` | boards 1 to 21: Step 1 of 2 empty and filled; Step 2 of 2 before an answer, Me with Add an email closed and open, Someone I look after, the consent already held, in en, es, ko |
| `mock/guest-later.html` | boards 1 to 9: Not now with 30 days, 7 days, and the owner case, in en, es, ko |
| `mock/guest-home.html` | boards 1 to 6: the first Home bubble with and without the card, in en, es, ko |
| `../profiles/mock/who-is-using-guest.html`, `who-is-using-guest-largest.html`, `people-on-device-guest.html` | the chooser and grown-up pieces (`../profiles/who-is-using-guest.md`) |
| `../site/guest/` | the site mocks built from the real export (`../site/guest/README.md`) |
| `shots/` | each mock in Chromium at 320 and 1280, at 320 with the browser text size at 200 % (`-320-text200`), and at 320 with the app's Largest text size (`-320-largest`), full page, 1x (`who-is-using-guest-largest` is already at Largest, so it has no `-320-largest` shot; its `-320-text200` is Largest at 200 %, a 300 % root) |

**The mocks are a design reference, not shipped code.** Learner screens are react-native drawn as HTML in rem, so the browser text size and the Display sheet's text size both reach them. Under 400 px wide the board drops its side padding and the frame's hairlines, so a `-320` shot draws a true 320 window (288 inside the gutters); at 1280 every frame is a 360 phone, except the stress board's 320 frames.

- **Tokens.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it. `guest.css` copies the one token the three earlier sheets do not carry (`colors.feedback.nudge`, the filled star) and redefines none. Every `var()` resolves (checked on every page: no undefined custom property). No colour literal in the HTML, no emoji, no motion. No new token and no new glyph: close, arrow-left, arrow-right, plus, play, check, speaker, book and profile are shipped Icon glyphs, and Hoya is `hoyaFigure(pose)`, the shipped drawing, in its shipped colours.
- **Words.** Every drawn string and accessible name is a dictionary value of `packages/i18n` or a row of the amendment's section 16 (with the two rows this pass adds, below), word for word, in en, es and ko. Quest content is quest 1 and its shipped es and ko overlays. The mocks were made by a throw-away generator that is not committed (as for the OA-0b, reports and billing mocks); the site mocks by a committed tool (`../site/guest/tools/`), as for the new-visitor pass.
- **Annotations.** Grey monospace labels and dashed boxes are board notes, not UI. A dashed box stands for an unchanged part of a screen, or (Results, board 1) for what a guest run does not draw.
- **Fixture.** Thu Oct 22, 2026. A guest who just finished quest 1 (3, 2 or 1 star; the Book card with 2 or more). "Sam" is the example name typed at the save. The family tablet of OA-0b: Mina and Jun.

## Constants

| Where | Value | Derived from |
|---|---|---|
| Hoya on a narrative step / on Results and GuestLater / in a bubble / in the save card and Ready to go! | 120 / 140 / 72 / 56 | `QuestPlayerView` NarrativeStepBody, `ResultsScreen`, `HoyaBubble`, `CreateProfileScreen` ready card (all unchanged); GuestLater reuses Results' 140 |
| Stars on Results | 48 | `ResultsScreen` StarRow size (unchanged) |
| Card thumb | 96 (`touchTarget.hero`) | `CardArtThumb` `CARD_THUMB` (unchanged) |
| Agreement box | 28 (`spacing.xl + spacing.xs`) | `CreateProfileScreen` `CHECKBOX_SIZE` (unchanged) |
| Guest tile minimum, chooser grid | 8rem (`WHO_TILE_MIN`) | OA-0b D3, unchanged: the guest tiles join the shipped grid |
| Stress frame | 322 (a 320 window plus two hairlines) | design board only, not UI |

## New and changed strings

Added to spec section 16 by this pass, with es and ko drafts written to the F-I18N-001 section 3.10 style guide. No `packages/i18n` file changes in this row, so the review ledger is untouched; the rows that land them (GU-5, GU-6) review and sign them.

| Key | en | es | ko | Why |
|---|---|---|---|---|
| `caregiver.people.guestRemoveAsk` | Remove the first quest? | ¿Quitar la primera misión? | 첫 퀘스트를 지울까요? | the ConfirmSheet of Remove the first quest needs a question as its title (ConfirmSheet `title` is required and is the sheet's name); section 16.3 had only its message (`guestConfirm`) |
| `landing.home.how.steps.start.guestTitle` | Start right away | Empieza ya | 바로 시작하기 | with `guestLesson` on, step 1's shipped title "Make a profile" sits above "Play your first quest. Check your level after.", so the step names a profile before the quest; the title follows the hero line's "right away" (spec 13.2 table) |
| `landing.persona.learners.faq.level.guestA` (en, es changed) | … then tap “Take the level check” on Home. … | … y luego toca «Hacer la prueba de nivel» en Inicio. … | (unchanged: ‘수준 확인하기’) | the shipped answer quotes the button it names (“I already know some Korean”, «Ya sé algo de coreano», ‘한국어를 조금 알아요’); the guest answer now does the same in all three |

Reused without change (the drafts of section 16 are drawn as written): every row of 16.1, 16.2 and 16.3, and of 16.4 except the two above; `learner.welcome.*`, `learner.quest.*`, `learner.results.headline.*`, `cheer.*`, `newCard.*`, `learner.createProfile.*` (`step`, `title`, `who.*`, `lessons.plain`, `privacy.*`, `self.*`, `guardian.*`, `email.*`, `privacyLink`, `ready.*`, `missing.*`, `cta`, `namePlaceholder`), `learner.home.greeting`, `subtitle`, `profileLabel`, `classCode.cta`, `learner.who.*`, `a11y.who.tile`, `caregiver.audience.gated`, `caregiver.people.title`, `caregiver.audience.family.*`, `a11y.pinDigit`, `a11y.pinDelete`, `a11y.pinDots`, `a11y.stars`, `a11y.hoya`, `a11y.hearItLabel`, `a11y.discoverLetter`, `a11y.hearExample`, `common.buttons.close`, `back`, `cancel`, `common.display.*`.

## es and ko lengths

Character counts of every new string against English, with the CI length budget (F-I18N-001 section 3.11, `length-budget.test.ts`: every es string at most max(8, ceil(1.5 x en)); no new key ends in `cta`, so the 28-character `cta` budget does not apply). Every key fits; no allow-list entry is needed. Each is drawn in en, es and ko at 320, at 320 with Largest text and at 320 with 200 % browser text (the shots).

| Key | en | es | ko | es budget | Result |
|---|---|---|---|---|---|
| `learner.guest.welcome.waiting` | 28 | 28 (100 %) | 16 (57 %) | 42 | fits |
| `learner.guest.welcome.resume` | 16 | 18 (113 %) | 11 (69 %) | 24 | fits |
| `learner.guest.welcome.saveTitle` | 39 | 49 (126 %) | 25 (64 %) | 59 | fits |
| `learner.guest.welcome.save` | 11 | 16 (145 %) | 7 (64 %) | 17 | fits |
| `learner.guest.welcome.keeps` | 64 | 61 (95 %) | 30 (47 %) | 96 | fits |
| `learner.guest.memoryOnly` | 87 | 103 (118 %) | 52 (60 %) | 131 | fits |
| `learner.guest.results.line` | 48 | 64 (133 %) | 26 (54 %) | 72 | fits |
| `learner.guest.results.lineNoCard` | 45 | 55 (122 %) | 26 (58 %) | 68 | fits |
| `learner.guest.results.keep` | 16 | 21 (131 %) | 9 (56 %) | 24 | fits |
| `learner.guest.results.notNow` | 7 | 8 (114 %) | 3 (43 %) | 11 | fits |
| `learner.guest.results.askGrownUp` | 48 | 50 (104 %) | 23 (48 %) | 72 | fits |
| `learner.guest.results.askOwner` | 44 | 51 (116 %) | 25 (57 %) | 66 | fits |
| `learner.guest.later.title` ({days}) | 76 | 75 (99 %) | 55 (72 %) | 114 | fits |
| `learner.guest.later.line` | 64 | 79 (123 %) | 37 (58 %) | 96 | fits |
| `learner.guest.later.save` | 11 | 16 (145 %) | 7 (64 %) | 17 | fits |
| `learner.guest.later.close` | 5 | 6 (120 %) | 2 (40 %) | 8 | fits |
| `learner.guest.saved` ({name}) | 37 | 43 (116 %) | 23 (62 %) | 56 | fits |
| `learner.guest.savedNoCard` ({name}) | 34 | 40 (118 %) | 21 (62 %) | 51 | fits |
| `learner.createProfile.guest.title` | 18 | 20 (111 %) | 7 (39 %) | 27 | fits |
| `learner.createProfile.guest.nameLabel` | 4 | 6 (150 %) | 2 (50 %) | 8 | fits |
| `learner.createProfile.guest.later` | 57 | 62 (109 %) | 30 (53 %) | 86 | fits |
| `learner.createProfile.email.add` | 23 | 27 (117 %) | 13 (57 %) | 35 | fits |
| `learner.who.try` | 19 | 24 (126 %) | 10 (53 %) | 29 | fits |
| `learner.who.trySub` | 17 | 19 (112 %) | 10 (59 %) | 26 | fits |
| `learner.who.guest` | 11 | 14 (127 %) | 5 (45 %) | 17 | fits |
| `learner.who.guestCaption` | 13 | 15 (115 %) | 10 (77 %) | 20 | fits |
| `a11y.who.try` | 38 | 45 (118 %) | 19 (50 %) | 57 | fits |
| `a11y.who.guest` | 46 | 50 (109 %) | 28 (61 %) | 69 | fits |
| `caregiver.people.guestRow` | 22 | 27 (123 %) | 11 (50 %) | 33 | fits |
| `caregiver.people.guestKeep` | 17 | 25 (147 %) | 9 (53 %) | 26 | fits |
| `caregiver.people.guestRemove` | 22 | 24 (109 %) | 9 (41 %) | 33 | fits |
| `caregiver.people.guestRemoveAsk` | 23 | 26 (113 %) | 12 (52 %) | 35 | fits |
| `caregiver.people.guestOnlyGate` | 98 | 99 (101 %) | 57 (58 %) | 147 | fits |
| `caregiver.people.guestConfirm` | 63 | 70 (111 %) | 28 (44 %) | 95 | fits |
| `landing.home.hero.guest` | 57 | 55 (96 %) | 28 (49 %) | 86 | fits |
| `landing.home.how.steps.start.guestTitle` | 16 | 10 (63 %) | 7 (44 %) | 24 | fits |
| `landing.home.how.guestLevelBody` | 46 | 52 (113 %) | 26 (57 %) | 69 | fits |
| `landing.home.how.guestStartBody` | 39 | 48 (123 %) | 21 (54 %) | 59 | fits |
| `landing.home.how.steps.collect.guestBody` | 80 | 88 (110 %) | 37 (46 %) | 120 | fits |
| `landing.persona.learners.faq.level.guestA` | 108 | 130 (120 %) | 65 (60 %) | 162 | fits |

The tightest places: es `results.keep` "Conservar mi progreso" on the hero button (one line at 320 Standard and Largest, because the button runs the full width under the save card, D5); es `guestKeep` "Conservar como estudiante" (one line in a full-width row button); es `who.try` "Prueba la primera misión" in a 138 px tile at Largest (three lines, whole words, the stress board).

## Measured on the mocks (Chromium, macOS)

- Every page at 320, 1280, 320 at 200 % browser text and 320 at Largest: no sideways scroll, no undefined custom property, no colour literal, no emoji, no duplicate id, no dangling `aria-labelledby`, `aria-describedby`, `aria-controls` or `for`, no console error. No control under 64 x 64 (the example word of a Discover card is its own 64 target).
- Words break only at spaces at 320 and 1280 in every locale (ko keeps words whole, `:lang(ko) { word-break: keep-all }`). At 320 with Largest one break inside a word remains, on a shipped screen this row does not change: es "¡Conozca|mos" in quest 1's intro bubble (finding F1 below). At 320 with 200 % browser text (a 288 px window at double size, beyond the app's own Largest) long words in shipped headlines and buttons wrap inside their box rather than scroll ("Wonderful!", "¡Maravilloso!", "Conservar"); nothing leaves its frame.
- The stress board (spec 14): Try the first quest and First quest side by side in two 138 px columns of a 320 window at Largest, in en, es and ko: every label and line wraps at spaces inside its tile, nothing overflows (tiles 138 x 211 to 138 x 273). The shipped grid at Largest takes a column away first (one column of 288), drawn beside it.
- Contrast from the token values: `text.primary` on paper 16.10, on sunken 13.58, on brand.primaryLight 12.12, on successLight 13.24, on nudgeLight 14.02; `text.secondary` on paper 8.44, on sunken 7.12, on canvas 7.97 (the memoryOnly line, welcome.keeps, the gate caption), on brand.primaryLight 6.35 (Ready to go!); `brand.primaryDark` on brand.primaryLight 5.76 (the step pill); the save card's `brand.primary` outline on paper 5.44; `text.onPrimary` on `brand.primary` 5.44; ghost `brand.primary` text on sunken 4.59 (Back to my quest and Add my name inside the waiting card, at least 4.5 for body text).

## Findings for the rows that build

- **F1 (GU-3, shipped screen).** Quest 1's intro step draws Hoya (120) and then a HoyaBubble with its own 72 px cub inside a padded card: at 320 the line has about 136 px at Standard, and at Largest es "¡Conozcamos" breaks inside the word. The guest path uses this screen unchanged (spec 7.1), and it is the first screen every guest sees. Not changed here (the screen is shared by every learner); GU-3 should carry a follow-up: under 8rem of line width the bubble stacks its cub above the line, or the narrative card drops the bubble's own cub.
- **F2 (GU-6, GU-7).** With the hero line, `/` in English at 1280 x 800 is 2,296 px against the 2,300 budget (macOS Chromium; 2,240 without it). At 375 x 812 it is 3,094 (budget 3,250, headroom 3,150), and 294 visible words (300). Every first-screen rule holds in every locale (`../site/guest/README.md`). The CI measurement in GU-6's forced-on run decides. Spec 13.2 changes no budget; if CI is over a height budget at 960 px or wider, GU-6 applies the fallback pre-approved here (`../site/guest/README.md` D16: at 960 px and wider the line drops its `spacing.sm` top margin and the hero's bottom padding takes one token step smaller), and if a first-screen rule fails, the line moves under the two grown-up links (13.2). Any budget change is a separate owner-approved spec edit, not this row's choice.
- **F3 (GU-6 test words).** Since SN-1 (#813) step 1 reads "Make a profile" / "Pick a name and a Hoya. A level check is optional." The GU-6 all-combinations test should also fail on those two with `guestLesson` on (spec 13.2 amended in this PR), as it does on "Choose who is learning".

## Review

Author pass (design, accessibility, anti-shame, child safety, privacy, copy, against sections 6 to 9, 13, 14, 16 and the three wireframes), done before the PR; each finding is fixed in this PR:

- Fidelity: the Discover page first drew its two letters side by side as the wireframe sketch does; the shipped DiscoverStep stacks one card per letter with Hear it, Letter name and the example word, so the mock follows the code. The example word is its own 64 target.
- Fit: the save card first held its buttons inside a padded card, which broke es "Conservar" on the hero button at 320; the buttons now run the full width under the card (D5). Board frames first carried the 600 px gutter of the 1280 viewport into the 320 stress frame (130 px columns instead of 138); the frame keeps the phone gutter.
- Class names: the first draft's `.brand`, `.muted` modifiers collided with app-shell.css (a 64 px pill); renamed `tone-*` and `is-muted`.
- Safety and privacy: in the case `open` the save form keeps section 3.15's in-form PIN setup (no owner exists to lock out); after a `verify` it draws no PIN part, and the case `owner` never reaches it (CS-G10 as scoped in the fix stage, `guest-save.md` D7). No screen of a guest run draws a grown-up entry, a profile, a tab or a name (CS-G1); no tile or row of a guest shows progress, stars, cards, a count or a time (CS-G5); no age wording; no "guest" word on any screen; no red on any guest or learner screen, and none on Remove the first quest (D14).

Independent multi-agent review (CLAUDE.md section 5), 2026-10-22, two reviewers on the whole pass (mocks, shots, notes, site tool and measurements, spec edits): a design reviewer (coverage of every GU-0b item in en, es and ko, child safety, anti-shame, tokens, accessibility, fidelity to the shipped screens, the spec amendments, the README's numbers) and an es and ko strings reviewer (F-I18N-001 section 3.10, the section 16 glossary, shipped dictionary values, truth to the screens, length budgets). 0 blockers, 0 majors, 3 minors. Design: **APPROVE**; es and ko strings: **PASS**. Adjudication, each fixed in this PR:

- GuestLater's `owner` case kept "It isn't backed up yet. Add a name to back it up…" above the ask-the-owner line, though the guest cannot add a name there (minor, design): the owner case now shows the heading, the ask-the-owner line and Close only, as Results' owner case replaces Hoya's line (D9 in `guest-save.md`, boards 3, 6, 9 of `guest-later.html`, spec 8.6).
- The state diagram did not name Back as a way from Results to Not now after the 7.1 amendment (minor, design): spec 5.2's edge reads "Not now, or Back (7.1)".
- ko `guest.later.title` used the loanword 플레이, which the ko dictionary never uses for playing a quest (it says 퀘스트를 해요) (minor, ko): now "호야가 이 브라우저에 퀘스트를 간직할 수 있어요. 퀘스트를 하지 않으면 최대 {days}일까지예요." (spec 16.2, the mocks, the length table).
- Noted by the ko reviewer, no change: "add a name" is 이름을 넣다 while "add a learner / an email" is 추가하다; a deliberate split (filling a name in), consistent across the drafts; GU-4 and GU-5 confirm it in their MAR.
- The reviewers verified: every drawn string is the section 16 draft word for word; no "guest" word inside any frame; no age wording beyond the shipped "I'm under 13" consent row; no red anywhere (1 star is the amber thinking tone; Remove the first quest is never `feedback.danger`); every `var()` resolves; the README's contrast figures (5.44, 4.59, 7.97) are exact; the two new string rows and the 7.1, 8.6 and 13.2 amendments are justified and logged in spec section 23.

Second independent review (2026-10-22, two reviewers on the PR: a spec and design reviewer, and a safety, navigation and site reviewer). Review 1: APPROVE with minors, es and ko **PASS**. Review 2: APPROVE WITH FIXES, one major. Fix-stage adjudication:

- **Major, fixed: CS-G10 against the `open` form's PIN setup.** CS-G10 said no `Guest`-stack screen opens PIN setup, while boards 4 and 6 of `guest-save-steps.html` draw the Me card's optional PIN row and the grown-up card's PIN twice. Dropping them would break CS-G8 (the guardian PIN when required) on an empty device, where a child's save could then never finish. CS-G10 is now scoped: in the case `open` (no profile, no PIN) the form is the device's first run and keeps section 3.15's PIN setup; in `verify` and `owner` no `Guest`-stack screen draws any PIN setup, and `PinEntry { next: 'SaveGuest' }` is never setup. Checking the shipped code turned up one more gap: `formPlan` offers the Me card's optional PIN row whatever the device holds (`pinOptional: card === 'self'`), and its submit would replace the stored PIN, so after a `verify` the guest variant needs `parentPinHash === null` for that row. Spec 0, 8.2, 8.3, CS-G10 and the GU-4 tests (both halves), `guest-save.md` D7 and the safety paragraph above.
- **Minor, fixed: Hoya's cheer invited a replay that did not exist** (both reviewers). The guest variant now draws the shipped **Try this one again** (`learner.results.nextUp.again.cta`, already in en, es and ko, so no new string and no MAR gap) as a quiet text button under every cheer but `perfect`; it replays quest 1 inside the `Guest` stack. `guest.quest_done` is sent once per record so G4 is not inflated. Spec 5.2, 5.5, 7.1, the GU-3 tests, D3, and boards 2 to 4, 6 to 8 and 10 to 12 of `guest-results.html` (shots re-taken). A guest cheer with new keys was the other option; it would have added strings no reviewer had passed.
- **Minor, fixed: back around GuestLater** (review 2). `GuestLater` replaces Results in history, and a back on it acts as Close, never leaving the `Guest` stack through history (spec 8.6, D4, D9; GU-4 e2e with the route-allowlist listener).
- **Minor, fixed: the GU-6 test-plan row** (review 1). Section 19's GU-6 row now matches 13.2 and asserts by key (`how.steps.start.title`, `how.steps.start.body`, `how.levelBody`, `how.steps.collect.body`), so es and ko are covered.
- **Minor, fixed: the budget fallback** (both). F2 no longer offers "a budget line moved by the owner"; a height fallback at 960 px and wider is pre-approved in D16 and spec 13.2.
- **Nit, kept as a waiver: `guestStartBody` not drawn** (review 1). The `levelCheck`-off step 1 has the drawn layout with a shorter line in every locale; the waiver is written in `../site/guest/README.md`.
- **Info, noted: the guest-only gate box is reachable from the chooser's Grown-up area** (review 2). No change in GU-0b; `who-is-using-guest.md` D15 records that this is the device's pre-guest access, and section 19's GU-5 row adds the e2e.

The fix stage adds no string (Try this one again is a shipped dictionary value in all three locales), so review 1's es and ko PASS stands for every string of this pass.

No `packages/i18n` file changes in this row, so no namespace and no review ledger entry change; GU-3 to GU-6 land the strings and sign their own ledger entries after their own MAR.
