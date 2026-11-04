# Route blend: class days and practice days (design mocks v1, BL-D)

Spec: `docs/specs/AMENDMENTS-ROUTE-CLASS-BLEND.md`, row **BL-D** in the section 16 table (merged spec: #952, BL-0). The mocks draw sections 7 (learner), 8 (own and family weekly plans), 9.4 (learner practice days), 10.1 to 10.3 (console wizard, preview, readout, lecture card), 11 (grown-up views), 13 (anti-shame) and 19 (draft strings), and measure assumptions c and d of section 17.
Wireframes: `design/wireframes/console/curriculum-wizard.md` section "Meeting" (M1 to M5) · `design/wireframes/journey/route-class-blend.md` (B1 to B7) · `design/wireframes/parent/route-class-blend.md` (P1, P2).
Built by: BL-4 (wizard, preview, readout), BL-5 (lecture card), BL-7 (line, glyph, Refresh, Class today, resting row, proposal line), BL-8 (practice-days setting), BL-9 (parent card and report line). No flag, schema, migration or telemetry is added by this row.

**The mock is a design reference, not shipped code.** Its HTML is not reference markup either: BL-4 and BL-7 build the controls with the app's components and the names the wireframes give (RN `accessibilityLabel`, `TapTarget`), checked by their own a11y tests.

## Owner request it serves (2026-11-03)

| Owner sentence | Drawn in |
|---|---|
| "layer by persona" (section 3) | the console block exists only for a class (M1); the learner surfaces show only in the Class with practice layer (B1 to B7); the parent sees a family-only line (P1, P2) |
| "allow overlapping or split content" (section 5) | the two mode cards (M1, `?state=split`) and the cycle table in both modes (M3, `wizard-preview.html?mode=split`) |
| "lecture 30 / personal 10 -> more material on lecture days" (6.2, 10.2) | the preview header and per-day line: 1 class day (30 min) teaches about 3 lessons, a 10-minute practice day plays about 1 (overlap) or 2 (split) |
| "separate and harmonise" (section 8) | the resting own-plan row with See it (B5), the proposal line instead of a second plan (B6), the family plan's Pause link (P1) |

## What is here

| File | What it fixes |
|---|---|
| `mock/wizard-meeting.html` | step 2 with the meeting block (`#meeting`): Class chips and length, the practice row with the suggested-days line and Change days, the mode cards, length chips with Keep the average, and Days off with "Only the class is off". States `?state=change`, `split`, `zero`, `every` |
| `mock/wizard-preview.html` | step 4: the preview header (10.2 text) and the cycle table with Class and Practice cells (golden C; `?mode=split` golden D) |
| `mock/readout.html` | the published This week block (class lessons first, the class aggregate, "Class days so far", Re-pace and Move this class day, Stop practice days), the lecture card with no chips, and the class-only upgrade link |
| `mock/route-line.html` | the Route tab top at 320 x 568: the route card and the weekly plan line; `?class=2&practice=3,5,0` sets the days (assumption d is measured here) |
| `mock/route-line-board.html` | every line form side by side (1, 3 practice days; 2 class days; most days; every day except; every day) |
| `mock/learner-home.html` | Home on a class day ("Class today.", the From class pill with and without the glyph) and `?day=practice` (the Refresh card) |
| `mock/profile.html` | the resting own-plan row with See it, the proposal line, My practice days; `?who=child` the gated child view |
| `mock/parent.html` | the child card's class line with the meeting words (GX-4 line, no new row) and the report's practice-week line with the filling strip |
| `mock/route-blend.css`, `mock/strings.js`, `mock/glyphs.js` | one stylesheet of tokens; the words in en, es and ko (`?lang=`); the glyphs |
| `tools/capture.mjs` | shots and checks (below); run `node design/screens/route-blend/tools/capture.mjs` from the repo root (`--no-shots` checks only) |
| `shots/` | Chromium shots: `<page>[-<state>]-<lang>-<width>[-text200].png` (320 at 2x, 1280 at 1x); `measurements.json` holds the numbers of assumptions c and d |

Open any page in a browser with `?lang=en|es|ko` and `&text=200` for the 200 % text size (the html text size; every size is in rem). Links are placeholders.

## Rules the mocks hold (checked by `tools/capture.mjs`, all passing)

| Check | Rule |
|---|---|
| sideways | no page scrolls sideways at 320 or 1280, in en, es or ko, at 100 % or 200 % text |
| c-1280 | the meeting block fits one 1280 x 720 screen, from the page top, in every language and state |
| c-320 | at 320 px with 200 % text the block is one vertical scroll: nothing clipped, nothing sideways, no scroll area of its own |
| d-320 | the learner weekly plan line fits the Route card column at 320 x 568 in at most 3 lines (1 to 3 names, 2 class days, the longest es / ko names, and every collapsed form) |
| words | no emoji; none of `packages/i18n/src/banned-words.json` (learner and caregiver lists) nor "late", "behind", "lecture" (and es / ko equivalents) in any drawn string or accessible name (`aria-label`, `aria-labelledby`) |
| counts | no number above 3 on a learner screen, drawn or read aloud (lesson titles, dates and weeks included); the practice-days count chips are choices, marked `data-choice`, and are left out |
| one-label | no learner row shows two labels with the same words (the From class pill is one label, with or without the glyph) |
| tables | every header cell has a scope (column headers `col`, the week cell `row`) |

## Results

**Assumption c (one screen at 1280, one scroll at 320 with 200 % text): holds at 1280; at 320 with 200 % text it holds under this row's reading, an open point for BL-4's review or the owner (below).**

| Width | en | es | ko |
|---|---|---|---|
| 1280 x 720, default: block height / its bottom from the page top | 404 / 550 px | 410 / 556 px | 404 / 550 px |
| 1280 x 720, the tallest state (Change days open) | 444 px | 450 px | 444 px |
| 320, 100 % text: block height | 1075 px (1.9 screens of 568) | 1205 px | 898 px |
| 320, 200 % text: block height | 2689 px (4.7 screens), 0 clipped, 0 inner scroll areas | 2903 px (5.1), 0, 0 | 2130 px (3.8), 0, 0 |
| 320, 100 % text: the decisions end (the mode cards' bottom, from the block top) | 807 px (1.4 screens) | 937 px (1.6) | 686 px (1.2) |
| 320, 200 % text: the decisions end | 2119 px (3.7 screens) | 2333 px (4.1) | 1720 px (3.0) |

**Open point (BL-4 review or the owner).** At 320 the block is one continuous column read top to bottom. This row reads "one scroll" as one vertical scroll with nothing sideways, nothing clipped and nothing nested; the spec does not define it further, so that reading is a judgement, not a measured fact. A stricter reading, "every decision (Class, length, practice row, suggested days, mode cards) within 2 screens", holds at 100 % text in every language (1.2 to 1.6 screens) and does not hold at 200 % text (3.0 to 4.1 screens), where only a shorter block (for example the mode hints behind a disclosure) would meet it. BL-4's e2e repeats the 1280 check on the real page.

**Assumption d (the weekly plan line fits the Route card at 320 x 568 in es and ko): holds for 1 to 3 practice weekday names and every collapsed form, with 1 or 2 class days.** Most lines: en 3, es 3, ko 2, over 13 cases each (`measurements.json`, `d`). The line sits under the card, so the card's Continue stays where LR-11 put it.

**Class part with 3 to 5 class days (not part of d; `measurements.json`, `dClassPart`):** en 4 lines in every case, es 3 (3 class days) to 4 (4 or 5), ko 2. See finding 10.

## Decisions and findings for the rows that build this

1. **Practice-part rule (BL-7), as section 7.** With 4 or more practice days the part collapses: "practice every day" when the practice days cover every weekday or every non-class day (the class days fill the rest); "practice every day except {weekday}" when 6 practice days leave out a weekday that has no class either; otherwise "practice on most days"; 1 to 3 days by name. So 1 class + 6 practice (Wed to Mon) reads "class on Tuesday, practice every day", the same words as the console's "Practice every day" for that plan (10.1).
2. **Korean list (BL-7).** Weekday names in ko join with a middle dot (수요일·금요일·일요일): `Intl.ListFormat('ko')` gives "수요일, 금요일 및 일요일", whose commas run into the comma between the two parts and whose "및" is formal. en and es keep `Intl.ListFormat` (en adds the serial comma: "Wednesday, Friday, and Sunday"). Korean text wraps between words: `lineBreakStrategyIOS="hangul-word"` on iOS, `word-break: keep-all` on web.
3. **Practice row word order (BL-4).** "[3] times a week × [10] min each time" reads "주 [3]회 × 한 번에 [10]분" in Korean, so `practice.days` and `practice.minutes` cannot be fixed labels after the selects. The mock uses one proposed key, `console.curriculum.blend.practice.inline`, an ordered list of words and the two slots; `practice.days` and `practice.minutes` stay as the selects' accessible names.
4. **Per-day numbers (BL-4).** The preview's per-day line comes from `stats.byTrack`: in overlap a 10-minute practice day plays about 1 lesson plus Refresh (golden C), in split about 2 (golden D). Section 10.2's example sentence ("practice days play about 2") is the split case; BL-4 reads the stats, never a constant.
5. **Readout aggregate.** The practice aggregate reuses the existing `console.curriculum.readout.line` ("{done} / {total} so far · {planned} planned"), with no new key.
6. **Spelling (BL-4, BL-7, BL-9).** The section 19 drafts use British "practise" (verb) and "Practised"; `packages/i18n` en is American throughout ("Practiced" in `report`, `a11y`, GX-11's "Practiced 3 of the last 7 days" on the same parent card). The mocks and wireframes use American spelling: "Learners also practice on their own", "Practice what class taught", "Pick the days you practice.", "Practiced on {n} days this week". The rows that key these strings use the American forms; the spec's section 19 text is left as merged (a spec edit is outside this docs(design) row).
7. **The `class` glyph (BL-7).** New Icon glyph, 24 x 24 grid, round caps and joins: `stroke('M4 4.5 H20 V14.5 H4 Z', 2.2)`, `stroke('M8 19.5 L12 14.5 L16 19.5', 2.2)`, `stroke('M7.5 9.5 H13', 2.2)` (a board on an easel). Drawn at 16 dp in the pill (`--pill-glyph`), in the pill's text colour; it has no accessible name of its own.
8. **Zero practice days this week (BL-9).** The parent report draws no line and no strip at 0, so it never states what was not done.
9. **GX-11 week line.** The child card's "Practiced {d} of the last 7 days" (#942) is drawn only as context, unchanged; this row adds nothing to it.
10. **Class part of the weekly plan line (BL-7; may need a spec amendment).** Section 7 collapses only the practice part. With 3 to 5 class days the line runs to 4 lines in en (and es with 4 or 5 class days) at 320 x 568, over the 3-line bound of assumption d. BL-7 decides, before it builds, whether the class part gets its own collapse (for example "class on weekdays" for Monday to Friday) or the bound is relaxed for 3 or more class days; either way it goes through a spec amendment.
11. **es weekly habit (BL-4, BL-7, BL-9).** A recurring weekday takes the plural article and plural names: "clase los martes", "práctica los miércoles, viernes y domingos", "todos los días menos los lunes", "después de la clase de los martes". `Intl.DateTimeFormat` gives singular names; lunes to viernes are the same in the plural, sábado and domingo add -s (`esPl` in `mock/strings.js`). Labels with a colon keep the plain name ("Día de clase: martes", "Práctica: mié, vie, dom").

### Keys the mocks use that section 19 does not list (proposed; each row drafts en, es and ko and takes them through review)

| Key | en | es | ko | Row |
|---|---|---|---|---|
| `console.curriculum.blend.practice.inline` | {n} times a week × {m} min each time | {n} veces por semana × {m} min cada vez | 주 {n}회 × 한 번에 {m}분 | BL-4 |
| `console.curriculum.blend.preview.practiceOnlyTag` | practice only | solo práctica | 연습에서만 | BL-4 |
| `console.curriculum.blend.preview.classCol` / `practiceCol` | Class / Practice | Clase / Práctica | 수업 / 연습 | BL-4 (also the readout's Class and Practice headings, M4) |
| `console.curriculum.blend.family.classHasPractice` | {name}'s class has practice days on {weekdays}. | La clase de {name} tiene días de práctica el {weekdays}. | {name}의 반은 {weekdays}에 연습해요. | BL-9 |
| `console.curriculum.blend.preview.classReview` | Review together | Repaso en grupo | 함께 복습 | BL-4 (the class cell of a review cycle; or an existing class-review preset name if BL-4 finds one) |
| `learner.route.blend.seeIt` | See it | Verlo | 보기 | BL-7 |
| `learner.route.blend.practiceDays.count` | Days a week | Días por semana | 한 주에 며칠 | BL-8 |

The wireframe also names a line for "no class day chosen" and the Move this class day confirm; BL-4 drafts them with its other keys.

### Draft es and ko of section 19 (used by the mocks)

Every value is in `mock/strings.js` (`console`, `learner`, `a11y`). Glossary held: class = 수업 (a lesson time) and 반 (the group, as in the existing "반의 주간 계획에서"), practice = 연습, Refresh = 되짚기, Daily Review = 오늘의 복습 (existing); es clase, práctica, Refrescar, Repaso diario (existing). These are drafts for the rows that add the keys: they reach `packages/i18n` only in BL-4, BL-5, BL-7, BL-8 and BL-9, where the multi-agent review passes them and the review ledger is re-signed.

## Constants

Values that are not tokens. Each one derives from code or a token; the rows that build them name them as constants.

| Where | Value | Derived from |
|---|---|---|
| Console chip height | `spacing.xxxl` (48 px) | `Chip` in `apps/web/src/components/console/CurriculumParts.tsx` (unchanged) |
| Pill glyph | 16 px | the pill's caption line (`typography.size.caption` x `leading.tight` ≈ 16) |
| Parent strip mark | 20 px | the report calendar's day square (F-REPORT-001), GX-11's squares |
| Learner tab bar | 72 px | the learning-route mocks' bar (`touch.min` + `spacing.sm`), drawn sticky after the page |
| Meeting block two columns | from 900 px | `layout.breakpoint.wide` |
| Phone table to cards | below 600 px | `layout.breakpoint.regular` (the wizard's existing narrow rule) |
| Font stack | the system stack | `typography.family.sans` ('System') as the web build renders it |
| Board column | 22rem | design board only, not UI |

## Screens

| Shots | Viewport | Shows |
|---|---|---|
| `wizard-meeting-{en,es,ko}-{320,1280}.png`, `-320-text200.png` | page | M1 / M2: the meeting block, default (Tuesday, 30 min, 3 x 10 min, overlap) |
| `wizard-meeting-state-{change,split,zero,every}-{lang}-320.png` | page | Change days open; split chosen; 0 practice days (no mode, no days line); 7 practice days ("Practice every day, also after class on Tuesday") |
| `wizard-preview-{lang}-{320,1280}.png`, `wizard-preview-mode-split-{lang}-320.png` | page | M3: the header, the per-day line, the average, the start line, the cycle table (cards at 320) |
| `readout-{lang}-{320,1280}.png` | page | M4 / M5: This week, Class days so far, Move this class day, Stop practice days, the lecture card with no chips, Add practice days |
| `route-line-{lang}-{320,1280}.png`, `-320-text200.png` | page | B1: Route tab top with the line (1 class, 3 practice days) |
| `route-line-board-{lang}-{320,1280}.png` | board | B1: every line form |
| `learner-home-{lang}-{320,1280}.png`, `-320-text200.png`, `learner-home-day-practice-{lang}-320.png` | page | B2: Class today and the pills; B3: Refresh |
| `profile-{lang}-{320,1280}.png`, `-320-text200.png`, `profile-who-child-{lang}-320.png` | page | B5 to B7, and the gated child view |
| `parent-{lang}-{320,1280}.png` | page | P1 and P2 |
