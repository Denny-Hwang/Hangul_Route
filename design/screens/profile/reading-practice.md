# Profile / Reading practice, and Hoya's one-time reading line (screen note, RF-0b)

Spec: `docs/specs/AMENDMENTS-ROMANIZATION-FADE.md` §3.9 (the line), §3.10 (the choice), §3.11 (strings), §3.13 (screen readers) · row **RF-0b** · agent mock, multi-agent review (CLAUDE.md §5, owner decision 2026-10-12): two lenses, findings fixed, log at the end
Wireframe: `design/wireframes/profile/reading-practice.md` Panels A and B (Panel A amends `profile/profile-split.md`)
Mock (built by `tools/build.mjs` from `tools/frames.mjs`; rules in `mock/reading-practice.css`):
- `mock/reading-card-states.html`: the card with each choice checked, keyboard focus, the move after an arrow key, the press look, a web tap (press and focus together) (360 x 740, in its place on Profile)
- `mock/reading-card-sizes.html`: every size at standard text
- `mock/reading-card-text.html`: Largest text and 200 % text, phones and landscape
- `mock/reading-card-locales.html`: Spanish and Korean (length stress)
- `mock/hello-line.html`: quest 11's Hello step with the line: the five looks weighed (Q4, Q5), then the chosen one at every size
- `mock/hello-line-text.html`: the Hello step at Largest and 200 % text, and in Spanish and Korean

Shots: `shots/<page>.png` (each page, 1x) and `shots/card-*.png`, `shots/hello-*.png` (single frames, 2x)
Tools: `node design/screens/profile/tools/measure.mjs` (rebuilds `mock/*.html`, prints the tables below, runs the checks, takes the shots; `--no-shots`; `--phones` prints Table 5). Playwright from `apps/web`'s install (falls back to the main checkout), as `design/screens/hangul-check/tools/measure.mjs`. `tools/hoya-figure.mjs` is Hoya generated once from `hoyaFigure(pose)` (`packages/design-system/src/scene-art/hoya.ts`) on this commit.
Code (RF-2): `apps/mobile/src/components/ReadingPracticeCard.tsx`, `apps/mobile/src/screens/quest/QuestPlayerView.tsx` (`NarrativeStepBody`), `packages/design-system/src/components/HoyaBubble/` (one new prop, Q4)

**The mock is a design reference, not shipped code.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it; the few non-token numbers are in "Constants" (each a shipped constant). `colors.feedback.danger` is not in the stylesheet, and the checks read every drawn colour for it. The Spanish and Korean values of the six new keys (§3.11) are **length-stress drafts of this pass, not translations**: RF-2 drafts the real ones and has them reviewed (F-I18N-001 §3.10). Every other string is a dictionary value.

**Path.** The spec named `design/screens/romanization-fade/`; this pass sits beside the other Profile notes under `design/screens/profile/` (its first file; `design/screens/profiles/` is the who-is-playing flow). The spec's pointers (Scope, §5, row RF-0b) are updated in this PR.

## Who and how it should feel

Any learner, any age (CLAUDE.md §1), or a grown-up beside a child. Panel A is a quiet setting: three plain choices, nothing to confirm, nothing gated, no warning. Panel B is a small moment of pride, once: Hoya says the learner can read Hangul now, and where help is. The change is framed as progress, never as help taken away (§3.14): no "hide", "lose" or "remove" in learner copy, no red, Hoya's tone `idle`. Pre-A1 English.

## Panel A: the Reading practice card

```
+----------------------------------+
| Reading practice                 |  Heading prompt (existing learner.profile.reading.title)
| Show romanization                |  Body, text.secondary: the group's visible label and its name (NEW groupLabel)
| +------------------------------+ |
| | (o) As I learn               | |  one row = one radio = one target, at least touchTarget.min
| |     Shows less as you read   | |  the hint, under this option only (NEW auto.hint)
| |     more.                    | |
| +------------------------------+ |
| | ( ) Always                   | |
| +------------------------------+ |
| | ( ) Only when I tap          | |
| +------------------------------+ |
+----------------------------------+
```

| Part | Look (tokens) |
|---|---|
| Card | `Card` padding `md` (`spacing.lg`), `surface.paper`, `radii.lg`, `shadows.card`, in Profile's My settings group between Display and Challenge (as today) |
| Heading | `Heading` `prompt` (bold, `leading.tight`), `text.primary` |
| Group label | `Body` (`body`, `leading.normal`), `text.secondary`, `spacing.xs` under the heading; `spacing.sm` above the first row. It is the radiogroup's name (`aria-labelledby` its id; native `accessibilityLabel` of the group) |
| Radio row | the whole row pressable, `role="radio"` / `accessibilityRole="radio"`, `aria-checked` + `accessibilityState={{ checked }}`; `minHeight` `touchTarget.min` (64), content centred in it; `paddingHorizontal` `spacing.xs` and a `borderWidth.thick` border (transparent at rest), `radii.md`: LessonDisplaySheet's row exactly. Rows touch (no gap) |
| Ring | 24 (`spacing.xl`), `borderWidth.base` `text.primary`, `radii.circle`, no fill; checked: a 12 (`spacing.md`) `text.primary` dot. LessonDisplaySheet's radio exactly (`RING`, `DOT`) |
| Ring position | **on the label's first line** (Q1): the ring sits in a slot one label line high (`body` x `leading.normal`), `spacing.md` before the text column |
| Label | `Body` (`body`); the checked option's label `semibold` (Q9) |
| Hint (As I learn only) | `Caption` (`caption`), `text.muted`, under the label in the same row (the Display and Sound rows' second-line look); the radio's accessible description (Q2) |
| Focus | the row's border turns `border.focus` (`borderWidth.thick`), no layout shift. Drawn on **any** web focus, a tap included (as LessonDisplaySheet's `focusRing(focused)`: the app has no focus-visible helper, and adding one is not this row's); on native, VoiceOver, TalkBack and Switch Control draw their own cursor |
| Pressed | the press look of `press-look.ts`: the row's border `border.shape` `borderWidth.thick` and the content at `PRESS_SCALE` (0.97); no shrink under reduced motion (`pressLook(reducedMotion)`). While a focused row is pressed (every web tap) the press look wins; after the release the focus ring shows (A7, A8). Nothing is chosen until the release. **The first Profile row with the press look**: Sound and Display have none, and DisplaySheet's radios use `border.focus` when pressed; the shared look (KT-D11) is the right one for a learner target, and those rows may follow later (not this row) |
| Disabled | none: the choice is always available (display only, not behind the grown-up gate, §3.10) |

**No new token, no new component, no new glyph** in Panel A. The rows are `Pressable`s as in `LessonDisplaySheet.tsx` and `DisplaySheet`'s `SegmentedRow`.

### States (board A1-A6)

| | State | What shows |
|---|---|---|
| A1 | As I learn checked | the default from RF-2 (`ROMANIZATION_DEFAULT_CHOICE = 'auto'`); the card shows the **stored choice** (`romanizationChoiceOf`), never the resolved mode, never an All lessons override |
| A2 | Always checked | the default until RF-2, and a learner who chose it (also: the Words cards switch turned Off, OD-RF-5) |
| A3 | Only when I tap checked | a learner who chose it, or a legacy `romanizationMode: 'tap'` (§3.2) |
| A4 | keyboard focus | Tab lands on the checked radio (roving focus, Q3) |
| A5 | after ArrowDown | focus and the choice move together and the choice is stored at once (`setRomanizationChoice`), as DisplaySheet's radios |
| A6 | pressed | a finger on Only when I tap: the press look; on release it becomes checked and is stored |
| A7 | a web tap | the tap also focuses the row: while pressed, the press look wins over the focus ring |
| A8 | after the release of A7 | Only when I tap checked, focused (the ring stays until focus leaves, as LessonDisplaySheet) |
| - | loading | settings are read before Profile draws; if not, the default is checked (§3.10) and the stored one replaces it when read |
| - | error | a stored choice this build does not know reads as the default, which is checked (§3.2); nothing else is lost |
| - | screen reader in use | the card is unchanged: it shows the stored choice. (As I learn then *resolves* as Always on every screen, §3.13, so its hint is not true for that learner while the reader is on; accepted, Q2 and Q6) |

## Panel B: the Hello step with Hoya's line (quest 11, phase `reading`, once per profile)

```
+----------------------------------+
| [x]                         (Aa) |  ScreenHeader (unchanged)
| o . . . . .               [1 / 6]|
| Into the Hills                   |  step title (unchanged)
| [Hello]                          |  step pill (unchanged)
| +------------------------------+ |  Card tone brand, padding lg (unchanged)
| |  (no Hoya 120 on this run, Q5)| |
| | +--------------------------+ | |
| | | [Hoya 72] Korea has many | | |  the quest's own bubble (unchanged, live polite as today)
| | |  mountains, ...          | | |
| | +--------------------------+ | |
| | +--------------------------+ | |  spacing.sm
| | | You can read Hangul now! | | |  the reading line: a HoyaBubble with no figure (Q4), tone idle, not live
| | | Need help with a word?   | | |
| | | Tap Show how to say it.  | | |
| | +--------------------------+ | |
| +------------------------------+ |
|                                  |
| [[          Continue          ]] |  unchanged: never held, never moved by the line (Q5)
+----------------------------------+
```

| Part | Look |
|---|---|
| The line's bubble | `HoyaBubble` tone `idle` (`surface.paper`, `borderWidth.base` `border.subtle`, `radii.xl`, padding `spacing.lg`, `shadows.card`), message `Body` `bodyLg` `semibold`, **with no figure** (a new prop, Q4), `live={false}`; `spacing.sm` under the quest's bubble, inside the same card |
| The step's Hoya | the 120 waving figure is **not drawn on this one run** (Q5); the quest's bubble keeps its Hoya 72, so one Hoya speaks both lines |
| Everything else | unchanged: header, dots and count, title, pill, card tone, the quest's bubble, Continue (`hero`) |

When the line is not due (every other run, Always or Only when I tap chosen, a screen reader in use, phase `letters`, a non-Stage 1 quest in phase `reading`, a guest, no profile): the step is exactly as today (board B0).

| | State | What shows |
|---|---|---|
| B-due | the run starts while the line is due | B1. "Due" is decided **once, when the run starts** (`readingNoticeDue` read then and kept on the run), so marking `romanizationNoticeAt` as the step mounts (§3.9) does not take the line, or bring the Hoya 120 back, under the learner's eyes |
| B-back | Previous from step 2 back to Hello in the same run | the same B1: the line and the missing Hoya 120 hold for the whole run |
| B-next | the next run (any quest) | B0: the line was marked, never again on this profile and device |
| B-leave | Close, then the same quest again | B0: it was marked when the step mounted (§3.9: leaving after it showed does not bring it back) |

## Decisions (open layout questions settled)

Each was settled with the recommendation below: **owner decision 2026-11-26: approved as recommended.**

- **Q1 — where the ring sits in a row of two or more lines.** (a) Centred on the row (as LessonDisplaySheet's one-line rows); (b) **on the label's first line**. **(b)**: As I learn has a hint under its label, and at Largest and 200 % text and in Spanish a label wraps (Table 2: three lines); a centred ring would sit between the label and the hint, or beside the second line. Measured: the ring's centre is on the label's first line's centre (0.0 px off) at every size, text size and locale. A one-line row is still centred in its 64.
- **Q2 — the hint's look and its accessible text.** **Caption `text.muted`**, the second-line look of the Sound and Display rows on the same page. For screen readers it is the radio's **description, not part of its name**: name "As I learn", description "Shows less as you read more." (`aria-describedby` on the web, which react-native-web supports; `accessibilityHint` on native). This is DisplaySheet's own pattern for its screen-reader switch (`accessibilityHint` + `aria-describedby`, `DisplaySheet.tsx:334-335`), and it keeps the name short each time an arrow key moves the choice and in the rotor. The name equals the visible label (WCAG 2.5.3, checked on Chromium's computed names). The hint shows whichever option is checked. Known limit: while a screen reader is in use, As I learn resolves as Always (§3.13), so the hint is not true for that learner then; accepted (one more string for a corner of a corner; the choice itself behaves as stored once the reader is off).
- **Q3 — keyboard and switch.** On the **web**: roving focus as DisplaySheet's radio groups (design README D19): only the checked radio is a Tab stop; ArrowUp / ArrowDown / ArrowLeft / ArrowRight, Home and End move focus **and** the choice, which is stored at once (display only, reversible, §3.10); **Space** on a focused radio chooses it and does not scroll the page (the key handler calls `preventDefault`: react-native-web presses a `role="radio"` on Enter only), Enter chooses it too. RF-2 uses the same pure helper (`radioAfter`, today in `logic/lecture/home-view.ts` and `DisplaySheet/model.ts`) and adds `' '`. On **native**, `tabIndex` and `onKeyDown` are **not** passed: in React Native 0.76 a `tabIndex` of -1 becomes `focusable={false}` on Android, which takes the click away from an unchecked row for a hardware keyboard and Switch Access; every row stays focusable and clickable there, and the platform moves between them. (DisplaySheet spreads them on every platform today: reported for its own row, not changed here.) Screen readers: each row reads its label, its role, its state and, on As I learn, the hint; the web adds the position ("1 of 3"); VoiceOver and TalkBack are recorded by the §7 device check, not promised here. The group reads "Show romanization" on the web (`aria-labelledby`); on native the group's `accessibilityLabel` follows DisplaySheet's pattern, and the TalkBack check confirms it is not a second stop repeating the visible label.
- **Q4 — how the line's bubble looks.** Five looks measured (board B0-B4, Table 3): (a) **a second bubble with no figure** (B1); (b) a second full `HoyaBubble` with its own Hoya 72 (B3); (c) one bubble with the line as its second paragraph (B4). **(a)**: (b) puts three tigers in one card and makes the line 84 px narrower (120 px at 320 wide: about 11 characters a line, 225 px tall); (c) is as narrow, and the line would sit inside the quest bubble's polite live region, which §3.9 forbids. (a) needs one additive prop on the design-system `HoyaBubble` (`figure?: boolean`, default `true`; with `false` the 72 figure and its gap are not drawn), so RF-2 adds `packages/design-system/src/components/HoyaBubble/{HoyaBubble.tsx,types.ts}` and a test (recorded in the spec's row RF-2 in this PR). Trade-off, stated: the second bubble's text starts at its own edge, not under the first bubble's text column, so only its tone, its place right under the first bubble inside the same card, and its voice tie it to Hoya. Indenting it to the text column was rejected: 84 px narrower again, the same width problem as (b).
- **Q5 — Continue under the fold.** With the line under Hoya 120 and the quest's bubble (B2, §3.9 as first written), the step grows by about 100-150 px and Continue falls under the fold on common phones where it is on screen today: at 360 x 740 only 11 px of it shows, at 360 x 800 71 px (Table 5). (a) Accept the scroll; (b) **on the run that shows the line, the step card does not draw its Hoya 120** (the quest bubble's Hoya 72 speaks both lines); (c) shrink the 120 to 72 (saves 48 px: not enough at 360 x 740); (d) drop the 120 only on short windows (B2 already fits from 390 x 844 up). **(b)**: Continue is then on screen wherever it is today (360 x 740 and up, Table 5), within 20 px of today's place where the step scrolls anyway (320 x 568: 20 px lower; 360 x 640 and 375 x 667: 7 px higher), and the line is on the first screen from 360 x 740 up. (d) was rejected: the same quest would look different from phone to phone for a rule the learner cannot see. Cost of (b): the waving figure is missing on that one run (it still waves on every other Hello step); a screen-reader user loses nothing, since the remaining figure is still named ("Hoya the tiger, standing", as `Hoya.tsx` names it). This amends §3.9's "Hoya's pose unchanged (waving)" (recorded in the spec in this PR). Where the step already scrolls today (320 x 568, Largest and 200 % text, landscape phones), it still scrolls; Continue always comes after the line, so reaching Continue passes it.
- **Q6 — the wireframe's open question: a status line under As I learn** ("Now: words you can read hide their romanization"). **Not added.** It would use a word of loss ("hide", §3.11), add a line that changes with progress (so the card would need the phase), and say nothing the hint and Hoya's line do not. Nor does the card say anything while a screen reader is in use (As I learn resolves as Always then, §3.13): the card shows the choice, not the resolved mode (§3.10).
- **Q7 — the wireframe's open question: Panel A grows Profile.** The card is 286 px at standard text at every width (the one-switch card it replaces is about 125 px: +160 px, the "about three rows" of the wireframe). At 320 x 568 with 200 % text it is 540 px, 4 px taller than the window's content box, and in landscape at 200 % (364 px) it is taller than 844 x 390's and 667 x 375's; at every other measured size and text size the three choices are on one screen (Korean too; Spanish at 200 % on 320 x 568 is 626 px). Profile scrolls; each option stays one target. Accepted: Profile is a scrolling list, and no row of the card is cut by anything but the scroll edge.
- **Q8 — the button's name inside the line.** Plain text, no quotes and no bold, in English ("Tap Show how to say it."), as the dictionary holds plain strings. RF-2's translators choose the locale's own convention: the Korean content already quotes button names with ‘…’ (`content/i18n/ko/stage1-quests.json`, "‘들어 보기’를 누른 다음"), so the Korean stress draft does too. In every locale the words must be the reveal button's own (§3.11 translator note).
- **Q9 — what marks the checked option.** The ring's dot and the label in `semibold`: never colour alone, and the same `text.primary` ink as LessonDisplaySheet (no brand fill on the row, so a checked row never looks like the press look or the focus ring). The bolder label never reflows a row: each choice checked in turn gives the same row heights at every tight size, text size and locale measured (Table 2b), so nothing moves under the finger.
- **Q10 — Panel C (the folded Discover word).** Not redrawn: RF-1b (#1167) built it with the existing **Show how to say it** control and `KoreanText`'s kept room (row RF-1b: "RF-0b not needed"). Panel D (a theme word stays shown) has no new look.

## Measurements

Measured on the mock in Chromium (`tools/measure.mjs`, this commit). Heights in px (dp); each frame is the window (no border inside it). Every radio row is at least 64 at every size, text size and locale; no frame scrolls sideways; the ring's centre is on the label's first line's centre everywhere ("Ring off first line").

**Table 1: the Reading practice card (English, As I learn checked)**

| Size | Text | Card (w x h) | As I learn / Always / Only when I tap (row height, label lines) | Ring off first line | Whole card in one window |
|---|---|---|---|---|---|
| 320 x 568 | standard | 288 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 320 x 568 | Largest (1.5) | 288 x 383 | 99 (1 + hint 2) / 64 (1) / 64 (1) | 0.0 | yes |
| 320 x 568 | 200 % (2) | 288 x 540 | 130 (1 + hint 2) / 64 (1) / 103 (2) | 0.0 | no (Profile scrolls) |
| 360 x 740 | standard | 328 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 360 x 740 | Largest (1.5) | 328 x 346 | 99 (1 + hint 2) / 64 (1) / 64 (1) | 0.0 | yes |
| 360 x 740 | 200 % (2) | 328 x 452 | 130 (1 + hint 2) / 64 (1) / 64 (1) | 0.0 | yes |
| 390 x 844 | standard | 358 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 390 x 844 | Largest (1.5) | 358 x 317 | 71 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 390 x 844 | 200 % (2) | 358 x 452 | 130 (1 + hint 2) / 64 (1) / 64 (1) | 0.0 | yes |
| 844 x 390 | standard | 720 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 844 x 390 | Largest (1.5) | 720 x 317 | 71 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 844 x 390 | 200 % (2) | 720 x 364 | 92 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | no (Profile scrolls) |
| 667 x 375 | standard | 619 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 667 x 375 | Largest (1.5) | 619 x 317 | 71 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 667 x 375 | 200 % (2) | 619 x 364 | 92 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | no (Profile scrolls) |
| 768 x 1024 | standard | 720 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |
| 1180 x 820 | standard | 720 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | 0.0 | yes |

**Table 2: Spanish and Korean (the six new values are length-stress drafts)**

| Locale | Size | Text | Card (w x h) | Rows (height, label lines) | Whole card in one window |
|---|---|---|---|---|---|
| en | 320 x 568 | standard | 288 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | yes |
| en | 320 x 568 | Largest (1.5) | 288 x 383 | 99 (1 + hint 2) / 64 (1) / 64 (1) | yes |
| en | 320 x 568 | 200 % (2) | 288 x 540 | 130 (1 + hint 2) / 64 (1) / 103 (2) | no |
| en | 844 x 390 | 200 % (2) | 720 x 364 | 92 (1 + hint 1) / 64 (1) / 64 (1) | no |
| es | 320 x 568 | standard | 288 x 290 | 68 (1 + hint 2) / 64 (1) / 64 (1) | yes |
| es | 320 x 568 | Largest (1.5) | 288 x 471 | 136 (2 + hint 2) / 64 (1) / 79 (2) | yes |
| es | 320 x 568 | 200 % (2) | 288 x 626 | 217 (2 + hint 3) / 64 (1) / 103 (2) | no |
| es | 844 x 390 | 200 % (2) | 720 x 364 | 92 (1 + hint 1) / 64 (1) / 64 (1) | no |
| ko | 320 x 568 | standard | 288 x 286 | 64 (1 + hint 1) / 64 (1) / 64 (1) | yes |
| ko | 320 x 568 | Largest (1.5) | 288 x 346 | 99 (1 + hint 2) / 64 (1) / 64 (1) | yes |
| ko | 320 x 568 | 200 % (2) | 288 x 401 | 130 (1 + hint 2) / 64 (1) / 64 (1) | yes |
| ko | 844 x 390 | 200 % (2) | 720 x 364 | 92 (1 + hint 1) / 64 (1) / 64 (1) | no |

**Table 2b: row heights with each choice checked (a semibold checked label must not change any row)**

| Locale | Size | Text | As I learn checked | Always checked | Only when I tap checked | Same? |
|---|---|---|---|---|---|---|
| en | 320 x 568 | standard | 64 / 64 / 64 | 64 / 64 / 64 | 64 / 64 / 64 | yes |
| en | 320 x 568 | Largest (1.5) | 99 / 64 / 64 | 99 / 64 / 64 | 99 / 64 / 64 | yes |
| en | 320 x 568 | 200 % (2) | 130 / 64 / 103 | 130 / 64 / 103 | 130 / 64 / 103 | yes |
| en | 390 x 844 | 200 % (2) | 130 / 64 / 64 | 130 / 64 / 64 | 130 / 64 / 64 | yes |
| es | 320 x 568 | standard | 68 / 64 / 64 | 68 / 64 / 64 | 68 / 64 / 64 | yes |
| es | 320 x 568 | Largest (1.5) | 136 / 64 / 79 | 136 / 64 / 79 | 136 / 64 / 79 | yes |
| es | 320 x 568 | 200 % (2) | 217 / 64 / 103 | 217 / 64 / 103 | 217 / 64 / 103 | yes |
| es | 390 x 844 | 200 % (2) | 179 / 64 / 103 | 179 / 64 / 103 | 179 / 64 / 103 | yes |
| ko | 320 x 568 | standard | 64 / 64 / 64 | 64 / 64 / 64 | 64 / 64 / 64 | yes |
| ko | 320 x 568 | Largest (1.5) | 99 / 64 / 64 | 99 / 64 / 64 | 99 / 64 / 64 | yes |
| ko | 320 x 568 | 200 % (2) | 130 / 64 / 64 | 130 / 64 / 64 | 130 / 64 / 64 | yes |
| ko | 390 x 844 | 200 % (2) | 130 / 64 / 64 | 130 / 64 / 64 | 130 / 64 / 64 | yes |

**Contrast on surface.paper:** text.primary 16.10:1, text.secondary 8.44:1, text.muted 6.01:1, border.focus 4.30:1, border.shape 4.55:1

**Table 3: the Hello step, the line's look (English, standard text)**

| Size | Look | Line width | Line bubble height | Content / window | Line on the first screen | Continue on the first screen |
|---|---|---|---|---|---|---|
| 320 x 568 | B0 none (today) | - | - | 674 / 472 | - | no (scrolls) |
| 320 x 568 | **B1 bare, no step Hoya** | 204 | 144 | 694 / 472 | no | no (scrolls) |
| 320 x 568 | B2 bare, step Hoya kept | 204 | 144 | 826 / 472 | no | no (scrolls) |
| 320 x 568 | B3 figure | 120 | 225 | 907 / 472 | no | no (scrolls) |
| 320 x 568 | B4 joined | 120 | - | 871 / 472 | no | no (scrolls) |
| 360 x 740 | B0 none (today) | - | - | 644 / 644 | - | yes |
| 360 x 740 | **B1 bare, no step Hoya** | 244 | 117 | 644 / 644 | yes | yes |
| 360 x 740 | B2 bare, step Hoya kept | 244 | 117 | 745 / 644 | yes | no (scrolls) |
| 360 x 740 | B3 figure | 160 | 171 | 799 / 644 | yes | no (scrolls) |
| 360 x 740 | B4 joined | 160 | - | 763 / 644 | yes | no (scrolls) |
| 390 x 844 | B0 none (today) | - | - | 748 / 748 | - | yes |
| 390 x 844 | **B1 bare, no step Hoya** | 274 | 117 | 748 / 748 | yes | yes |
| 390 x 844 | B2 bare, step Hoya kept | 274 | 117 | 748 / 748 | yes | yes |
| 390 x 844 | B3 figure | 190 | 144 | 748 / 748 | yes | yes |
| 390 x 844 | B4 joined | 190 | - | 748 / 748 | yes | yes |

**Table 4: the Hello step with the line, B1 (recommended); in brackets: today, no line**

| Locale | Size | Text | Line width | Line bubble height | Content / window (no line) | Line text top-bottom / window bottom | Continue on the first screen (no line) |
|---|---|---|---|---|---|---|---|
| en | 320 x 568 | standard | 204 | 144 | 694 / 472 (674) | 496-604 / 552 | no (no) |
| en | 360 x 740 | standard | 244 | 117 | 644 / 644 (644) | 442-523 / 724 | yes (yes) |
| en | 390 x 844 | standard | 274 | 117 | 748 / 748 (748) | 415-496 / 828 | yes (yes) |
| en | 844 x 390 | standard | 636 | 90 | 496 / 278 (530) | 360-414 / 366 | no (no) |
| en | 667 x 375 | standard | 535 | 90 | 496 / 263 (530) | 360-414 / 351 | no (no) |
| en | 768 x 1024 | standard | 636 | 90 | 912 / 912 (912) | 360-414 / 1000 | yes (yes) |
| en | 1180 x 820 | standard | 636 | 90 | 692 / 692 (692) | 368-422 / 788 | yes (yes) |
| en | 320 x 568 | Largest (1.5) | 204 | 279 | 1166 / 472 (1011) | 833-1076 / 552 | no (no) |
| en | 320 x 568 | 200 % (2) | 204 | 468 | 1720 / 472 (1376) | 1198-1630 / 552 | no (no) |
| en | 390 x 844 | Largest (1.5) | 274 | 239 | 923 / 748 (809) | 631-833 / 828 | no (no) |
| en | 390 x 844 | 200 % (2) | 274 | 360 | 1288 / 748 (1052) | 874-1198 / 828 | no (no) |
| en | 844 x 390 | Largest (1.5) | 636 | 117 | 599 / 278 (606) | 436-517 / 366 | no (no) |
| en | 844 x 390 | 200 % (2) | 636 | 198 | 748 / 278 (674) | 504-666 / 366 | no (no) |
| es | 320 x 568 | standard | 204 | 171 | 748 / 472 (701) | 523-658 / 552 | no (no) |
| es | 320 x 568 | 200 % (2) | 204 | 576 | 1930 / 472 (1478) | 1300-1840 / 552 | no (no) |
| ko | 320 x 568 | standard | 204 | 117 | 586 / 472 (593) | 415-496 / 552 | no (no) |
| ko | 320 x 568 | 200 % (2) | 204 | 468 | 1342 / 472 (998) | 820-1252 / 552 | no (no) |

The card keeps Profile's reading column (720) on wide windows; in landscape every row is one line. Spanish is the long one (drafts "A medida que aprendo", "Se muestra menos a medida que lees más.", "Solo cuando la toque"): rows grow downward, never sideways; RF-2's real values may be shorter. Korean wraps at spaces (`:lang(ko) word-break: keep-all` on the web, `KOREAN_LINE_BREAK` on iOS; Android breaks per syllable, `line-break.ts`). "Line text top-bottom" in Table 4 is the line's text box, not its bubble.

On the Hello step (Table 4), wherever Continue is on the first screen today it still is with the line (B1). Where the step scrolls today it scrolls up to about 450 px more at 200 % text (Spanish at 320 x 568: the line is ten lines), and in landscape and Korean at 320 x 568 it is 7-34 px shorter than today (the 120 figure is taller than the line there).

**Table 5: Continue on common phone windows (`measure.mjs --phones`; its bottom edge / the window's content bottom)**

| Window | Today (no line) | B2: the line, step Hoya kept | **B1: the line, no step Hoya** |
|---|---|---|---|
| 320 x 568 | 738 / 552 (under the fold) | 890 / 552 (under the fold) | 758 / 552 (under the fold) |
| 360 x 640 | 684 / 624 (36 px of it shows) | 809 / 624 (under the fold) | 677 / 624 (43 px of it shows) |
| 375 x 667 | 657 / 651 (90 px of it shows) | 782 / 651 (under the fold) | 650 / 651 |
| 360 x 740 | 708 / 724 | 809 / 724 (11 px of it shows) | 708 / 724 |
| 360 x 800 | 768 / 784 | 809 / 784 (71 px of it shows) | 768 / 784 |
| 390 x 844 | 812 / 828 | 812 / 828 | 812 / 828 |
| 393 x 852 | 820 / 836 | 820 / 836 | 820 / 836 |
| 412 x 915 | 883 / 899 | 883 / 899 | 883 / 899 |

**Checks** (every page, every frame; `measure.mjs` exits non-zero on any): every button and radio on screen at least 64 x 64; the ring on the label's first line (within 1 px); no text outside its radio; no sideways scroll; no row height changes with the checked option (Table 2b); the contrast above, computed from the stylesheet's token values; each radiogroup has exactly three radios in the order As I learn, Always, Only when I tap, exactly one checked, exactly one Tab stop (`tabindex="0"`) and it is the checked one; in **Chromium's computed accessibility tree** (Playwright aria snapshot): the group's name is its visible label, each radio's name is exactly its visible label with the right checked state, and As I learn's description is the hint; the reading line in no live region; `colors.feedback.danger` never drawn; no emoji; no banned word (`packages/i18n/src/banned-words.json`, en / es / ko learner lists); no "hide", "hidden", "lose", "remove", "less help", "for kids" or "ages". All pass.

**Not checked by the tool** (the mock has no script): the arrow keys, Home / End, Space and the focus moves of Q3 are drawn (A4, A5), not exercised; native screen readers, the OS font scale and browser zoom are §7's device checks. "Largest" and "200 %" are the app's own text-size factor.

## Accessibility

- **Roles and names.** The group: `role="radiogroup"` named by the visible "Show romanization" (`aria-labelledby` + `nativeID` on the web, as LessonDisplaySheet; `accessibilityLabel` on native, DisplaySheet's pattern, Q3). Each row: `role="radio"` / `accessibilityRole="radio"`, `aria-checked` true or false (react-native-web drops a false `aria-checked` unless it is passed: pass it always, as the current switch does) and `accessibilityState={{ checked }}`; its name is the label alone, the hint is As I learn's description (Q2). The ring and the text are hidden from assistive tech inside the row (`aria-hidden`, which React Native 0.76 maps to both native props), so the row says them once. The card's heading stays a heading (heading navigation finds "Reading practice"). The card is a plain `Card` (no landmark).
- **Keyboard and switch.** Q3: on the web one Tab stop, the arrows, Home and End move and choose, Space and Enter choose; on native no `tabIndex` and no key handler, so every row stays focusable and clickable for a hardware keyboard and Switch Access. The focus ring is the row's own `borderWidth.thick` `border.focus` border on any web focus (4.3:1 against the paper on both sides of it); the press look wins while pressed.
- **Touch.** Each whole row is the target, at least 64 high and the card's width; nothing else in the card is pressable. The press look is an outline and a slight shrink, never a state colour (KT-D11), and nothing is chosen until the release. A checked label's weight never changes a row's height (Table 2b).
- **Text size.** Type follows the text-size engine; rows grow downward and never cut text; the ring stays on the first line (Tables 1, 2). 200 % on 320 x 568 needs a 4 px scroll for the whole card (Q7).
- **Contrast** (computed by the tool from the token values, on `surface.paper`): label and ring `text.primary` 16.1:1; group label `text.secondary` 8.4:1; hint `text.muted` 6.0:1; focus border `border.focus` 4.3:1; press outline `border.shape` 4.55:1.
- **The line.** Not a live region (§3.9): it is read in order after the quest's own line, which keeps its polite region as today, so a screen reader never hears both at once. It never shows while a screen reader is in use on As I learn anyway (§3.13: S5 resolves `always`, `readingNoticeDue` is false); it can reach a screen-reader user only through the web, where the reader is not detected without the device's "I use a screen reader": reading in order then finds it before Continue. Focus is not moved to it. Continue is never held. The Hoya that stays is named as today ("Hoya the tiger, standing").
- **Colour.** No red; nothing in either panel uses a feedback colour. Checked is the dot plus weight, not colour.
- **Motion.** The only motion is the press shrink (none under reduced motion).

## Constants

Values that are not tokens; all are shipped values.

| Where | Value | From |
|---|---|---|
| Radio ring / dot | 24 / 12 | `LessonDisplaySheet.tsx` `RING = spacing.xl`, `DOT = spacing.md` |
| Press shrink | 0.97 | `press-look.ts` `PRESS_SCALE` |
| The step's Hoya / the bubble's Hoya | 120 / 72 | `NarrativeStepBody` (`QuestPlayerView.tsx`), `HoyaBubble.tsx` |
| Bubble border | 2 (`borderWidth.base`) | `HoyaBubble.tsx` (written there as `2`) |
| Progress dot | 12 (`spacing.md`) | `Progress.tsx` dots |
| Type sizes | 14 / 16 / 18 / 20 / 22 / 28 at f = 1 | `typography.size` caption / bodySm / body / bodyLg / prompt / title, written in the stylesheet as numbers times the text-size factor (`text-size.ts`: reading sizes x f, title x (1 + (f - 1) / 2)) |
| Card shadow | 0 2 8, `text.primary` ink at 0.06 | `shadows.card` |

## For RF-2

- `ReadingPracticeCard`: replace the switch with the group of Panel A; `testID`s per option (`reading-practice-choice-auto` and so on) for `language-picker.spec.ts`; on the web only (`Platform.OS === 'web'`), the roving `tabIndex` and an `onKeyDown` with `radioAfter` (lift it from `logic/lecture/home-view.ts` or the design system's `DisplaySheet/model.ts`, whichever RF-2 can import, without a copy) plus `' '` (choose the focused radio, `preventDefault`); the hint as `accessibilityHint` + `aria-describedby`; the ring slot one label line high (`scale.lineHeight(scale.size.body)`); the press look from `pressLook(useReducedMotion())`.
- `HoyaBubble`: `figure?: boolean` (default `true`), and a test that `figure={false}` draws no Hoya and keeps the tone's look; `live={false}` for the line.
- `NarrativeStepBody`: a `readingNotice?: string` prop beside `note`; when present, the second bubble (Q4) under the quest's bubble with `spacing.sm`, and no `<Hoya size={120}>` (Q5). Decide "due" once when the run starts and keep it on the run (B-due, B-back); mark the line shown when the step mounts (§3.9).
- e2e: the radio names, the checked state, a press storing the choice, Space and the arrows on the web; the line once on q11, still there after Previous from step 2, and not on a second quest (§6 test 11).
- Device checks (§7, amended in this PR): 320 x 568 at 200 % with VoiceOver and TalkBack: the card's three radios, what each says (name, state, position, the hint), and no second TalkBack stop for the group; on Android, choose an unchecked option with Switch Access and with a hardware keyboard; the q11 Hello step on a 360 x 740-class Android phone: Continue on screen with the line.
- Not in RF-2, reported: DisplaySheet's radio rows pass `tabIndex` on native too (`DisplaySheet.tsx:124`), the same Android problem as Q3.

## Review log

- 2026-11-26, multi-agent review of this pass (two independent lenses: visual / interaction design against the design system and the spec; accessibility against React Native 0.76.5 and react-native-web 0.19.13). Both re-ran `tools/measure.mjs`; the tables matched.
  - **Blockers**: none.
  - **Majors, fixed**: (1) the roving `tabIndex` of Q3 would make unchecked rows unclickable on Android (RN 0.76 maps `tabIndex={-1}` to `focusable={false}`) → web only, with an Android Switch Access and keyboard device check; DisplaySheet's same issue reported for its own row. (2) §7's device check still said the card fits at 320 x 568 with 200 % text → amended (one short scroll). (3) No state for coming back to Hello or for the moment the line is marked: computed per render the line and the Hoya 120 would flip as the step mounts → "due" decided once per run and held, Previous included (B-due, B-back, B-next, B-leave).
  - **Minors, fixed**: Space chose nothing on a web radio and scrolled the page → the handler takes `' '`. The focus ring "for keyboard only" had no mechanism → drawn on any web focus, as LessonDisplaySheet; the press look wins while pressed (A7, A8 drawn). The press look is new on Profile → said, with `useReducedMotion`. A semibold checked label could reflow a row → measured every choice checked (Table 2b): no change. The hint in the name → a description (DisplaySheet's pattern), names now equal the visible labels; the hint's untruth while a screen reader resolves As I learn as Always is stated. "1 of 3" promised on native → web only; VoiceOver and TalkBack are recorded by §7. Native group naming → DisplaySheet's pattern, with a TalkBack check for a duplicate stop. The tool's checks read attributes only → it now checks Chromium's computed names, states and description (aria snapshot), computes the contrast and the reflow, and says what it does not exercise. Numbers: Table 4's "line" column is the text box (renamed); the Hello deltas restated (up to about 450 px at 200 %, shorter in landscape and Korean); Q5's "same place" restated (within 20 px where it scrolls anyway). The approval line said approved before the log → reworded. The RF-0b row cell kept the old "Panel C" text → trimmed. Q4's unaligned second bubble and Q5's "short windows only" option → stated and rejected with reasons.
  - **Nits, fixed**: the row padding is horizontal only and the ring has no fill (LessonDisplaySheet exactly); Constants lists the dot, the type sizes and the shadow; the device frames draw their edge outside the window (an outline), so each frame is its labelled size; the context frame no longer puts "My settings" right above Display (Sound sits between). The mock names Hoya as `Hoya.tsx` does, and the card is no landmark.
  - **Kept**: Q1, Q2's look, Q4 (a), Q5 (b), Q6-Q10; the owner decision line on each, as instructed for this row.
