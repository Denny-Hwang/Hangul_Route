# Quest / Discover: Trace the new letters (screen note, TC-0b)

Spec: `docs/specs/AMENDMENTS-STAGE1-TRACE-COVERAGE.md` §3.3 (the page), §3.4 (layout and the sizes it must fit), §3.6 (strings) · row **TC-0b** · approved by multi-agent review (CLAUDE.md §5, owner decision 2026-10-12); review log at the end
Wireframe: `design/wireframes/quest/discover.md`, section "[TC] Trace the new letters"
Mock (built by `tools/build.mjs` from `tools/frames.mjs`; rules in `mock/discover-trace.css`):
- `mock/trace-new-letters-sizes.html`: every acceptance size at standard text, in the arrangement it takes; quest 8's page at three sizes
- `mock/trace-new-letters-states.html`: the states of §3.3 (T1-T10) at 390 x 844, and six of them at 320 x 568
- `mock/trace-new-letters-largest.html`: Largest text on 390 x 844 (the acceptance size), and 320 x 568 for the record
- `mock/trace-new-letters-200.html`: 200 % text on 390 x 844 (stress case)
- `mock/trace-new-letters-spec-only.html`: the spec's rules 1-5 with its fallbacks (a) and (b) alone, where they do not fit

Shots: `shots/trace-new-letters-*.png` (each page, 1x), `shots/size-<w>x<h>[-largest|-200].png` (each acceptance size alone, 2x, the keep-going state)
Tools: `tools/measure.mjs` (measurements, checks, shots: `node design/screens/discover-trace/tools/measure.mjs`; `--matrix` prints every arrangement at every size). Playwright from `apps/web`'s install, as `design/screens/quest-leave-resume/tools/capture.mjs`.
Code (TC-1b): `apps/mobile/src/screens/quest/DiscoverTracePad.tsx` (new), `DiscoverStep.tsx`, `QuestPlayerView.tsx`

## Who and how it should feel

Any learner, any age (CLAUDE.md §1), a minute after hearing the letters for the first time: calm, unhurried, proud when a letter comes out right. The page never says "wrong": there is no Done, no fail look, no amber, no score. Hoya only praises, and the chips only fill. Pre-A1 English copy, all from the spec's §3.6 or existing keys.

## The page

```
[x Close]                     [Aa]     QuestPlayerView: the header and the step dots stay; the title slot reads
 ● ● ○ ○ ○ ○                  2 / 6    "Trace the new letters"; the step pill and the step's Hoya line are not drawn
 Trace the new letters
 Page 3 of 3  ● ● ●                    Discover's page row, counting this page
 [ㅏ][ㅓ][ㄱ][ㄴ]                       the letter row: decorative, one summary for screen readers
 Trace the letter a                    the heading (romanization in it); a final adds "Sits at the bottom of the block"
 +------------------+
 |   {ghost}{ink}   |                  the canvas: never inside a scroll view
 +------------------+
 (Hoya) Trace each line slowly.        Hoya's strip: idle / praise / keep going / shape guide; or the status row
 [Hear it][Show me][Clear][Next letter]
 [ Previous ] [[  Continue  ]]         pinned, Continue always enabled
```

| Part | Look (tokens) |
|---|---|
| Chip | `spacing.xxl` square at least, `radii.sm`, `borderWidth.base` `border.subtle` on `surface.paper`; glyph `bodyLg` semibold, `text.primary` |
| Chip, the letter shown now | `borderWidth.thick` `brand.primary` (the wider border and the heading say which letter; the chips are decorative) |
| Chip, traced on this visit | `feedback.successLight` fill, `feedback.success` border, and a `spacing.lg` disc in `feedback.successDark` with the `check` glyph in `surface.paper` at its corner. Fill-only: a letter passed with Next letter stays plain; nothing is ever taken away |
| Heading | `prompt` bold, `leading.tight` (`learner.minigame.trace.heading` / `.headingFinal`); a final's line `body`, `text.secondary` |
| Canvas | Trace Stroke's: idle `brand.primaryLight` / `brand.primary`, `borderWidth.thick`, `radii.xxl`; finished `feedback.successLight` / `feedback.success` with the ink in `text.primary` (as `TraceStrokeGame.tsx`); ghost `text.primary` at 0.12, width 18; ink width 8 (viewBox 200). No amber canvas: there is no miss |
| Show me (untaught, every letter until SO-3) | the shape reveal of SO-0c: the ghost steps aside, the strokes in `feedback.nudge`, width 14, one group at 0.6 (StrokeHint's shipped look) |
| Strip | Trace Stroke's `TraceFeedback` look: `surface.paper`, `borderWidth.base` `border.subtle`, `radii.lg`, `bodySm` semibold; praise `feedback.successLight` / `feedback.success` and Hoya `cheering`; Hoya's 40 figure only in the full arrangement on a tall window (content at least `TRACE_ROOMY_MIN_HEIGHT`) |
| Status row (a play that cannot sound) | PromptPanel's compact status row in the strip's place: the detail line (`caption`, `text.muted`) and its action, `Button` secondary `sm` |
| Hear it | `Button` secondary `sm`, `speaker` icon (as Discover's Hear it); accessible name "Hear it. Korean letter a" (`a11y.discoverLetter`), on a final "Hear it. Korean final consonant n" (`a11y.discoverFinal`) |
| Show me | `Button` secondary `sm` (as Trace Stroke); off while the reveal is up |
| Clear | `Button` ghost `sm`; off with no ink and during the advance beat |
| Next letter | `Button` ghost `sm` (moving on is never the main action; ghost as Trace Stroke's Skip). §3.3 says `size="md"`, §3.4 "one wrapping row of `sm` buttons": the mock uses `sm` (both are `touchTarget.min` high; `sm` lets the four share one row in landscape). Off during the advance beat |
| Disabled | the `Button`'s own look: its tone at opacity 0.6, still focusable on the web (`aria-disabled`) |
| Previous / Continue | `StepActions`: secondary / primary `lg` (`touchTarget.child`); `md` in the short arrangements (below; `StepActions` gets a size for it in TC-1b) |

**No new token, no new component, no new glyph.** The chip is a styled `View`; every button is the design-system `Button`.

## Arrangements (the §3.4 result)

The spec's rules 1-5 with its fallbacks (a) and (b) do **not** fit at 320 x 568, 375 x 553, 375 x 667, 844 x 390 or Largest text on 390 x 844 (table 2). TC-0b fixes the fallbacks (the row's "fixes §3.4's fallbacks if needed") with a measured ladder and records it in the spec's §3.4. The pad takes the **first arrangement in which the canvas slot is at least `TRACE_CANVAS_MIN` with every part on screen**, decided once per page from the page's tallest content (the longest heading of its letters, a final's line if any letter is a final, the tallest strip line), so the arrangement and the canvas keep one size across the page's letters.

Portrait:

1. **full**: spec rules 1-4 as written. Page row, chip row, heading, canvas, strip, one wrapping row of the four buttons, pinned row.
2. **beside**: the spec's fallback **(a)** (the chips at the end of the heading's line when they fit beside the page's longest heading; on the line under it, left-aligned, when not) and **Hear it and Show me beside the canvas**, in a column at its right. Clear and Next letter stay in the row under the strip, away from the canvas edge: a stroke that runs off the canvas can only meet a button that changes nothing.
3. **compact**: beside, and the step title is not drawn (the heading "Trace the letter a" leads the page).
4. **short**: compact, and the step dots ride in the ScreenHeader between Close and Aa (no count pill; the dots keep their accessible value "Step 2 of 6"), as Trace Stroke's progress does (AMENDMENTS-DISPLAY-NAV DN-4); no page row (its label "Page 3 of 3" stays for screen readers, visually hidden, before the heading); the page's own gaps step down to `spacing.sm`; Previous and Continue step down to `md` (`touchTarget.min`) with no spacer under them.
5. **short-b**: short without the chips (the spec's fallback **(b)**: the summary joins the heading's accessible text).

Landscape, when `traceLayoutMode` of the Screen's content box (the window less its gutters and insets, before the reading cap) is `side`, as Trace Stroke decides (§3.4 rule 5). 844 x 390, 667 x 375 and 1180 x 820 are side; 768 x 1024 and 390 x 844 are not. The trace page keeps the quest's reading column (720) inside it, so the header and the pinned row do not change width between page 2 and page 3:

6. **side**: spec rule 5. Canvas left (as wide as the box is tall, leaving the column at least `traceSidePanelWidth`); page row, heading with the chips, strip and the button row right; the pinned row under both.
7. **side-short**: side, and the step dots (with the pill) ride in the header, the title and the page row are not drawn (the label stays for screen readers), and the pinned row (`md`) goes to the foot of the right column (as Trace Stroke's side layout keeps Done and Skip in its column); the column is as wide as its one row of buttons and the canvas takes the rest, up to the column's height. The column comes first in reading order; the canvas is drawn on the left.
8. **side-short-b**: side-short without the chips (fallback **(b)**).

Order versus the spec: the spec tries (a) then (b). (a) is in step 2; (b) comes last (steps 5 and 8), because the chips are the page's fill-only meter, and moving two buttons or the title costs less. With the spec's order alone, Largest text on 390 x 844 would still not fit (table 2) and would have lost its chips.

Beyond (a) and (b), the ladder changes these spec lines (recorded in §3.4 for TC-1b): §3.3 "Title" (not drawn in compact, short and side-short), §3.4 rule 2 (no page row in short and side-short), rule 4 (Hear it and Show me beside the canvas from beside on), rule 5 (the trigger is `traceLayoutMode` of the Screen content box; side-short moves the pinned row into the column), and the pinned row's size in the short arrangements.

What keeps the canvas still (all in the mock, all for TC-1b):
- The strip keeps the height of the tallest line it can show (invisible copies of the praise and keep-going lines under the shown one, hidden from screen readers), and at least `touchTarget.min` plus its border, the status row's height. So praise, keep going, "Shape guide" and the status row never resize the canvas.
- The heading keeps the room of the page's longest heading; a page with a final keeps the final's line for every letter (quest 8: ㅑ ㅕ ㅍ, final ㅇ; the reserved line is an empty gap on the other letters, intended).
- On the last letter Next letter is gone, but its place in the row stays: an empty gap (at 390 x 844 a 64 high gap above the pinned row; intended), never a transparent `Button` (it would stay focusable on the web).

## Measurements

Measured on the mock in Chromium (`tools/measure.mjs`, this commit). "Canvas" is the canvas side over the page's states (quest 1: idle, praise with the beat, keep going on ㄱ, the status row; quest 7: final ㄴ; quest 8: ㅑ and final ㅇ with praise); in every row the canvas is wholly on screen and under nothing, and the strip, the band and every button are on screen with nothing scrolled. Continue's bottom edge is given against the window height.

**Table 1: the ladder's choice**

| Size | Text | Page | Arrangement | Canvas | Continue bottom / window |
|---|---|---|---|---|---|
| 320 x 568 | standard | quest 1 / quest 7 | short | 160 | 551 / 568 |
| 320 x 568 | standard | quest 8 | short-b | 160 | 551 / 568 |
| 375 x 553 | standard | quest 1 / 7 / 8 | short-b | 190 / 161 / 161 | 536 / 553 |
| 375 x 667 | standard | quest 1 / quest 7 | compact | 162 / 163 | 634 / 667 |
| 375 x 667 | standard | quest 8 | short | 215 | 650 / 667 |
| 844 x 390 | standard | quest 1 / quest 7 | side-short | 264 / 207 | 365 / 390 |
| 844 x 390 | standard | quest 8 | side-short-b | 252 | 365 / 390 |
| 390 x 844 | standard | quest 1 / 7 / 8 | full | 215 / 186 / 186 | 811 / 844 |
| 768 x 1024 | standard | every page | full | 384 (the regular cap) | 983 / 1024 |
| 1180 x 820 | standard | every page | side | 380 | 771 / 820 |
| 390 x 844 | Largest (1.5) | quest 1 / 7 / 8 | beside | 204 / 204 / 185 | 811 / 844 |
| 390 x 844 | 200 % (2) | quest 1 / quest 7 | short | 178 | 750 / 844 |
| 390 x 844 | 200 % (2) | quest 8 | short-b | 178 | 750 / 844 |
| 667 x 375 * | standard | quest 1 / quest 7 | side-short / side-short-b | 169 | 350 / 375 |
| 667 x 375 * | standard | quest 8 | none: slot under 160 | - | - |
| 640 x 360 * | standard | every page | none: slot under 160 | - | - |
| 320 x 568 * | Largest (1.5) | every page | none: slot about 65 | - | - |

\* not an acceptance size; recorded as open items.

Every size of `layout.spec.ts` and Largest on 390 x 844 meets §3.4 (canvas at least 160 and on screen, Continue on screen), and more: the chips (where drawn), Show me, Next letter, Hear it, Clear and the strip are all on screen too.

**Table 2: the spec's rules alone** (`mock/trace-new-letters-spec-only.html`; canvas slot with every button showing)

| Size | rules 1-4 | + (a) | + (b) | Verdict |
|---|---|---|---|---|
| 320 x 568 | 0 | 0 | 0 | no fit, even with the button rows scrolled away |
| 375 x 553 | 0 | 0 | 0 | no fit |
| 375 x 667 | 38 | 42 | 78 | 160 only by scrolling away most of the button rows (Next letter, Show me under the fold) |
| 844 x 390 (rule 5) | 81 | - | - | no fit: the title, the dots row and the pinned row leave about 80 for the canvas |
| 390 x 844 | 186 | 220 | 226 | fits |
| 768 x 1024 | 384 | 384 | 384 | fits |
| 1180 x 820 (rule 5) | 380 | - | - | fits |
| 390 x 844 Largest | 150 | 154 | 158 | no fit (2 to 10 short) |

In the spec's words: at 390 x 844, 768 x 1024 and 1180 x 820 no fallback applies; at 375 x 667 and Largest 390 x 844 fallback (a) applies but is not enough (ladder step 2 or 3); at 320 x 568, 375 x 553 and 844 x 390 neither (a) nor (b) is enough and the short arrangements apply, with (a), and (b) where needed, inside them.

## States (board T1-T10)

| | State | What changes |
|---|---|---|
| T1 | opens | first letter ringed, empty canvas, idle line "Trace each line slowly."; nothing plays (no sound by itself on this page) |
| T2 | a letter finished | `TRACE_IDLE_MS` (1.5 s) after the last lift on a finished letter: the canvas takes the finished look, Hoya `cheering` with "Beautiful! That looks like the letter.", the chip fills (`motion.duration.crawl`, `motion.easing.standard`; none with reduced motion), the success haptic. For `WRITE_ADVANCE_MS` (1.1 s) the canvas takes no ink and Next letter and Clear are off |
| T3 | the next letter | empty canvas, idle line, the next chip ringed |
| T4 | keep going | `TRACE_KEEP_GOING_MS` (3 s) with ink, no touch, not finished: "Keep going, or tap Next letter." in the idle look (no colour change, no sound); back to idle on the next stroke, Clear or a letter change |
| T5 | Show me, untaught | the SO-0c shape reveal (the reduced-motion still is the same picture, unnumbered); the strip reads "Shape guide" only while it would be idle; Show me off while it plays; it plays the card's sound (가 for ㄱ), as Hear it |
| T6 | last letter finished | the praise stays; no Next letter (its place kept); Clear is on and empties the canvas for another try (a second finish praises again; the chip is already filled) |
| T7 | last letter, keep going | "Keep going, or tap Continue." |
| T8 | a final (quest 7) | "Trace the final n", then "Sits at the bottom of the block"; the ghost is the consonant's shape alone, full size, with no block frame behind it (OD-TC-6 (a): a frame would suggest it is drawn at the bottom of this box) |
| T9 | Hear it could not sound | the slot's status row in the strip's place, at the strip's height: "Sound is off." and Turn sound on; no "Can't hear it?" link here |
| T10 | keyboard / switch focus | the focus ring `borderWidth.thick` `border.focus`, `spacing.xxs` outside the control, shown for keyboard and switch focus only |

A chip passed with Next letter stays plain (T4: ㅓ). Coming back with Previous inside the step keeps the letter and the filled chips; a new visit of the step starts plain.

## Accessibility

- **Touch targets**: every button is at least `touchTarget.min` (64) high and wide at every size and text size (checked on every frame); Previous and Continue are `touchTarget.child` (80) except in the short arrangements, where they are 64. The chips are not buttons and take no touches.
- **Screen reader**: the chip row is one line, `a11y.discoverWriteProgress` ("1 of 4 letters traced"); the chips themselves are hidden. Where the chips are not drawn (short-b, side-short-b) the line joins the heading's accessible text ("Trace the letter a. 1 of 4 letters traced"); where the page row is not drawn, its label "Page 3 of 3" stays as visually hidden text before the heading. The heading reads `traceTargetA11yText` ("Trace the letter g or k"); the canvas reads `a11y.minigame.traceCanvas`; while the untaught reveal is up, the canvas reads "g or k, shape guide." as SO-1 does. Every invisible copy that holds a height (strip lines, the longest heading, a reserved final line, the kept Next letter place) is hidden from screen readers (on native `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden`: opacity alone does not hide text).
- **Live region** (as `TraceFeedback`, TI-0b): one polite region, always mounted, holds only the lines that are said: praise and keep going. The idle line and "Shape guide" sit beside it, unannounced. On iOS (no live regions) the pad calls `announceForScreenReader` for praise and keep going. The status row is PromptPanel's own polite region, mounted (empty) in the strip's slot from the page's start so its line is announced when it appears.
- **Focus**: reading and focus order is the visual order: Close, Aa, (the page label), the heading, the canvas, the controls beside the canvas (Hear it, Show me), Clear, Next letter, Previous, Continue; in the side arrangements the right column (heading first) comes before the canvas. After Next letter, and after the advance when focus was inside the pad, focus moves to the new letter's heading (focusable by script only, as Trace Stroke's heading after Next), so the new letter is said; on the last letter Next letter goes, and focus has already moved to the heading. Next letter and Clear go soft-disabled (still focusable, `aria-disabled`) during the 1.1 s beat, so focus never falls to the page.
- **Continue at once** (user story 3): Continue is always enabled and always on screen; a switch or screen-reader user who cannot draw moves on without touching the canvas, and nothing is recorded against them.
- **Text size**: type follows the text-size engine (reading sizes by f, the title by 1 + (f - 1) / 2); buttons keep their height and grow their label. Largest on 390 x 844 fits (beside); 200 % on 390 x 844 fits every page (short, short-b).
- **Colour**: the finished state is carried by the line and Hoya's pose as well as green; a traced chip by its check mark; the letter shown now by the heading and the wider border. `feedback.danger` is never drawn (checked). Contrast (from the token values): disabled label 5.1:1, ghost label 5.4:1, check mark on its disc 7.6:1, the status caption 6.0:1, focus ring on the screen background 4.1:1. The SO-0c reveal colour is StrokeHint's shipped look (about 1.4:1, an existing open question of SO-0c), unchanged here.
- **Reduced motion**: no chip animation; Show me is its still.

## Constants

Values that are not tokens; all are shipped values.

| Where | Value | From |
|---|---|---|
| Canvas floor / phone cap / scaled cap | 160 / 320 / 320 x `layout.mediaScale` | `TRACE_CANVAS_MIN`, `TRACE_CANVAS_MAX`, `traceCanvasMax` |
| Ghost opacity, ghost / ink / hint width | 0.12, 18 / 8 / 14 (viewBox 200) | `TraceStrokeGame.tsx`, `StrokeHint.tsx` |
| Hint group opacity | 0.6 | SO-0c |
| Disabled button opacity | 0.6 | `Button.tsx` |
| Hoya in the strip | 40 | `TraceFeedback` |
| Roomy threshold | content at least 700 | `TRACE_ROOMY_MIN_HEIGHT` |
| Side trigger, side column | `traceLayoutMode`, `traceSidePanelWidth` | `logic/trace-layout.ts` |
| Pause before "finished", keep going, advance beat | 1500 / 3000 / 1100 ms | `TRACE_IDLE_MS`, `TRACE_KEEP_GOING_MS`, `WRITE_ADVANCE_MS` (spec §3.5) |

## For TC-1b

- **Choosing the arrangement**: a pure function (tested like `traceLayoutMode`) of the Screen's content box, the text-size scale and the page's content (letter count, longest heading, any final), with the part heights of this note; it is evaluated once per page and does not depend on the column it changes, so it cannot loop or flicker. `layout.spec.ts` asserts canvas at least 160 and Continue in view at its seven viewports and Largest on 390 x 844.
- `QuestPlayerView` learns from `onPageKind` (or a richer callback) whether to draw the title (not in compact, short, side-short) and where the step dots go (the ScreenHeader's middle in short and side-short; side-short keeps the count pill). `DiscoverStep` owns the rest (page row, chips, the pinned row's size).
- `StepActions` gets a size for its row (`lg` default, `md` in the short arrangements): today it hard-codes `lg` beside Previous. Add `StepActions.tsx` to TC-1b's files.
- Check that the design-system `Button` soft-disabled (`softDisabled`) keeps focus on react-native-web during the beat; use it, not `disabled`, for Next letter and Clear.
- The kept Next letter place is an empty `View` of the button's size, never a transparent `Button`.

## Open items

- **OQ-1 (owner)**: in the short arrangements Previous and Continue are `md` on the trace page and `lg` on the letter pages before it, so they change size between pages 2 and 3. The step-down follows the arrangement, not a window height (it also happens at 375 x 667 on quest 8's page and at 200 % text). Recommendation: accept it on the trace page only (the letter pages scroll and do not need it). Without it, 320 x 568 and 375 x 553 do not fit.
- **OQ-2 (owner)**: the step title "Trace the new letters" is not drawn in compact, short and side-short; the heading carries the page. If the title must always show, these sizes need another cut (the chips first).
- **Tightest rows**: at 320 x 568 the canvas is 160, held by the width the column beside it leaves (Hear it's label); 375 x 553 with a final is 161; 375 x 667 quest 1 is 162 (it falls to short, 215, if a font needs more). These are Chromium's system font; TC-1b's `layout.spec.ts` run on the real build settles them. If 320 x 568 comes out under 160 on a device font, the fallback is to put Show me and Clear beside the canvas there (173), with Clear lowest.
- Smaller landscape phones (667 x 375 quest 8, 640 x 360), Largest text on 320 x 568: no arrangement fits (outside the acceptance set); TC-1b's `text-size-fit` and `layout.spec.ts` runs record what the app does there.

## Review log

- 2026-11-26, multi-agent review (two lenses: visual / interaction design against the design system and the spec; accessibility). Both reviewers re-ran `tools/measure.mjs` and `--matrix`; the tables matched.
  - **Blockers**: none.
  - **Majors, fixed**: the landscape trigger (`layout.sideBySide`) missed 667 x 375 and 640 x 360 → `traceLayoutMode` of the Screen content box, as rule 5 and Trace Stroke (667 x 375 now fits quests 1 and 7). The short arrangement dropped the chips when not needed → short keeps them, short-b drops them (320 x 568 quests 1 and 7, 375 x 667 quest 8 keep their chips). The `md` pinned row needs a `StepActions` size the TC-1b row did not list, and the "compactHeight" precedent did not match → TC-1b note, OQ-1 restated (the step-down follows the arrangement). The ladder changed more spec lines than (a) and (b) and §3.4 was not updated → listed above and recorded in the spec's §3.4 in this PR; "Page 3 of 3" kept for screen readers. Clear sat 12 px from the canvas edge → Hear it and Show me beside the canvas, Clear and Next letter in the row. Focus after Next letter went nowhere and the new letter was not said → focus to the new heading (script-focusable), as Trace Stroke. The live region held the idle and "Shape guide" lines → one region for praise and keep going only, sizers outside, iOS announcement.
  - **Minors, fixed**: finished ink is `text.primary` (the note said `successDark`); wrapped chips left-aligned; ghost `Button` background transparent and disabled = its tone at 0.6; the check glyph's stroke 2.6 (`glyphs.ts`); Hear it on a final reads `a11y.discoverFinal`; 1180 x 820 side keeps the reading column (reason given); the empty Next letter place stated as intended; the arrangement is a pure function of the content box, not of the column it changes; the status row's region mounted from the start; soft-disabled controls keep focus; the kept place is not a `Button`; the side column comes first in reading order.
  - **Kept**: the 1 px wider border of the current chip (decorative chips; the heading names the letter); the SO-0c reveal contrast and `StepActions`' `wrap-reverse` order at large text (shipped, out of scope).
