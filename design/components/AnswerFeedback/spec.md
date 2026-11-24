# AnswerFeedback (component spec v1): result marks you can see without colour, a result said once

Spec: `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` (revision 2, `ready`; owner decisions OD-AF1 to
OD-AF9 of 2026-11-24, all as recommended) §3.1 to §3.5 and §5, row **AF-0b**; built by rows AF-1 (shared parts),
AF-2 (Culture Quiz, Tap & Respond), AF-3 (Card Match), AF-4a (tiles, Build a Letter), AF-4b (choice games) and AF-4c
(boards). Wireframe: `design/wireframes/minigame/answer-feedback.md` v2 (checked against the spec: no change needed).
Approval: multi-agent review (CLAUDE.md §5, owner rule 2026-10-12); the log is at the end of this file.

Audience: every learner, any age (CLAUDE.md §1). The screen-reader parts serve learners on VoiceOver, TalkBack or a
browser screen reader; the marks serve everyone, and learners who cannot tell green from blue or amber most of all.

**The mocks are a design reference, not shipped code.** Every colour and size is a token: `mock/tokens.css` is
generated from `packages/design-system/src/tokens.ts` itself, and every mark is drawn from the design system's own
glyph data (`packages/design-system/src/components/Icon/glyphs.ts`). No rule uses `colors.feedback.danger`, and no
mark is an X.

| File | Shows |
|---|---|
| `mock/answer-feedback-states.html` | S1 the mark sizes; A1 to A8 every answer surface in each of its states; S2 a `replay` mark beside the actions that show `replay` |
| `mock/answer-feedback-quiz.html` | B1 to B4 Culture Quiz (a question, a miss, right, right with a screen reader and Next); C1, C2 Tap & Respond (a miss; right with Next) |
| `mock/answer-feedback-pairs.html` | D1 to D4 Card Match (picked, a meaning tried, a second one, the pair matched); E1 to E3 Match Sound and Odd One Out; F1, F2 Build a Letter (right; a miss that stays) |
| `mock/answer-feedback-boards.html` | G1 Story Sequence, G2 Story Order; H1, H2 Hidden Heritage; I1, I2 Syllable Build, I3 Match Shape; J1 Role Play; K1 Sentence Builder |
| `mock/answer-feedback-display.html` | L1, L2 the Display sheet's "I use a screen reader" row, off and on |
| `mock/answer-feedback.css` | the rules (tokens and the named constants only) |
| `mock/tokens.css` | generated, one custom property per token |
| `tools/build-mocks.mjs` | writes the pages and `tokens.css` (edit it, not the HTML) |
| `tools/capture.mjs` | the checks (below) and the shots |
| `shots/<page>-{360,320-text200,1024}.png` and `-grey.png` | each page at 360 x 740, at 320 x 568 with 200 % text, and at a 1024 x 768 tablet (side by side), in colour and in greyscale |

Run: `node design/components/AnswerFeedback/tools/build-mocks.mjs`, then
`NODE_PATH=<checkout>/apps/web/node_modules node design/components/AnswerFeedback/tools/capture.mjs`. It passes with no
finding on every page at every window.

## What it is

Not one component: a rule every answer surface follows, plus two small shared parts.

1. **The result look** (spec §3.1): a right answer shows `check`, a miss the learner tries again shows `replay`
   ("try another"), Sentence Builder's tried-here tile shows `dash`, look-here is a ring. The mark is decorative; the
   accessible name starts with the state ("Right answer: …", "Not this one: …", "Look here: …").
2. **The answer announcer** (`AnswerAnnouncer` and `useAnswerAnnouncement`, AF-1): one hidden polite region per game
   screen and one queued iOS call per result. Behaviour only, no look (below).
3. **`HoyaBubble` `live`** (AF-1): a result bubble stops being a live region, because the announcer says the result.
4. **Next** with a screen reader on (OD-AF9 (b)), and the Display sheet's screen-reader row (OD-AF3 (d)).

## The marks

| Result | Mark | Colour | Fill and border | Tappable | Name |
|---|---|---|---|---|---|
| right | `check` | `feedback.success` on a light fill; `text.inverse` on a success fill | success family | no: inactive, never disabled | Right answer: … |
| miss, try again | `replay` | `text.primary` | nudge family | no: locked (inactive, still focusable), never disabled | Not this one: … |
| look here | none: the game's ring (ChoiceCard `hint`, a zone or tile ring, Hidden Heritage's dashed ring) | — | as today | yes | Look here: … |
| tried here (Sentence Builder only, OD-AF8 (c)) | `dash` | `text.primary` (was `text.secondary`) | nudge family | **yes** | …, tried |
| not answered | none | — | as today | yes | plain name |

### Size (the minimum this pass sets)

- **20 dp minimum** for every mark on a corner, out of the flow: `MARK_MIN = spacing.lg + spacing.xs`.
- **24 dp** for a mark in the flow at the end of a row: `spacing.xl` (ChoiceCard, unchanged), and on the Build a Letter
  target box, which has the room.
- **Why 20, not 16:** the 16 dp marks of today (Tile's miss, Role Play, Sentence Builder, Syllable Build's check,
  Story Sequence's slot) draw the 2.2 to 2.6 stroke of the 24 grid at under 1.8 px, and a 12 dp dot was the only cue
  on Syllable Build's miss. At 20 the stroke is 1.8 to 2.2 px and the arrowhead of `replay` stays a clear triangle
  (shot S1).
- Marks do not grow with the text size (an `Icon` has a fixed size); the surfaces keep room for them at every text size
  instead (next table), which the capture's `mark-clear` check holds at 320 x 568 with 200 % text.

### Place, per surface

| Surface | Marks | Size | Where | Room kept, so no text is covered | Row |
|---|---|---|---|---|---|
| ChoiceCard, row (Culture Quiz and Tap & Respond under OD-AF1 (B), Listen & Pick, Cloze Pick, Realia Read, Read Pick, Story Sequence and Story Order cards) | `check`, `replay` | 24 | end of the row, in the flow (unchanged) | in the flow | AF-1: only `wrong` stops being `selected` |
| ChoiceCard, tile (Pic-Word Match) | `check`, `replay` on a disc | 24 | top corner (unchanged) | the mark shows only once answered | — |
| `Tile` (Match Sound, Odd One Out) | `check` (new), `replay` | **20** (was 16) | top-end corner, inset `spacing.none` (was `xxs`) | the glyph column starts 20 in (`spacing.md` padding + `spacing.sm`), where the mark ends | AF-1 (`TILE_MARK`) |
| Card Match card | `check` (both cards of a pair), `replay` (a meaning tried) | 20 | top-end corner, inset `spacing.xxs` | **a top band**: `paddingTop: spacing.xl` in every state (D3) | AF-3 (`cardMatchStyle`) |
| Build a Letter target box | `check` | 24 | top-end corner, inset `spacing.sm` (inside the `radii.xl` curve) | the 80 glyph is centred in the 160 box | AF-4a |
| Story Sequence filled slot | `check` | **20** (was 16) | in the flow, after the number (unchanged) | in the flow | AF-4b |
| Hidden Heritage ring | `check` (found), `replay` (miss) | 20 on a 26 disc | the disc is centred on the ring's top-end corner | the disc sits on the ring, never over the thing (D5) | AF-4c |
| Syllable Build and Match Shape zone and tile | `check`, `replay` (was a 12 dp amber dot) | **20** (check was 16) | top-end corner, inset `spacing.xxs` (unchanged) | the jamo face is half the zone (`JAMO_FACE`) at every text size; a key tile's side padding is `spacing.xl` | AF-4c |
| Role Play reply | `replay` (was `dash`) | **20** (was 16) | top-end corner, inset `spacing.xs` (unchanged) | end padding `spacing.xl` in every state (was `spacing.lg`, and the 16 dash reached 4 dp into the text) | AF-4c |
| Sentence Builder word tile | `dash`, `text.primary` | **20** (was 16) | top-end corner, inset `spacing.xs` (unchanged) | `paddingRight: spacing.xl` while tried (unchanged) | AF-4c |

### Contrast (each mark on the fill right behind it, WCAG 1.4.11; the capture's `contrast` check)

- `check` in `feedback.success` on `feedback.successLight`: 4.28:1. White `check` on a success fill: 5.21:1.
- `replay` and `dash` in `text.primary` on `feedback.nudgeLight`: 14.02:1; on a disc of `nudgeLight`, the same.
- Hidden Heritage: each disc is its state's light fill with a `borderWidth.thin` casing in `text.primary`, so the mark
  keeps those ratios over any scene art, and the disc's edge reads on the scene as the ring's casing does.

## Decisions

- **D1. One minimum, two sizes** (above). 20 on a corner, 24 in the flow. AF-1 adds `MARK_MIN` beside `TILE_MARK` in
  `packages/design-system` (a named sum of tokens, not a new token), so every game reads the same number.
- **D2. `Tile`'s mark moves into the corner** (inset `spacing.none`) as it grows to 20, so it still ends where the
  glyph column starts. The tile keeps its size; the glyph and the romanization line never move (A2, E1 to E3).
- **D3. Card Match keeps a top band, not an end gutter.** The two columns are 138 wide at 320, which leaves 110 for a
  card's text, the tightest text column in the games. An end gutter would take 12 more of it, so long meanings would
  break sooner; a top band (`paddingTop: spacing.xl`, 12 more than today) costs height instead, and the board scrolls.
  The band is there in every state, so nothing moves when a mark appears (A3, D1 to D4).
- **D4. Card Match's picked card: the Pic-Word Match selection ring.** The picked Korean card shows a second outline,
  `borderWidth.thick` in `brand.primary`, `spacing.xs` outside the card (`RING_SELECTED`, `PicWordMatchGame.tsx:82-83`), as
  well as its `brand.primaryLight` fill. It is the app's existing "picked, now its partner" cue in the other pair game,
  it reads in greyscale as a double outline, and it never looks like a result. It is drawn outside the card in the
  column and row gaps (12 and 8, the ring is 7), so nothing moves and it takes no touch. Its name keeps
  `selected`. Rejected: an `arrow-right` mark (the same chevron opens a row elsewhere in the app); a thicker border
  alone (2 vs 3 dp does not read in greyscale).
- **D5. Hidden Heritage: a disc on the ring's corner.** Found and miss were the same solid ring in two hues. Each now
  carries its mark on a 26 disc (20 + 2 x `spacing.xxs` + 2 x `borderWidth.thin`) of its own light fill, centred on the
  ring's top-end corner, so the mark reads on any scene and never covers the thing found. Look-here keeps today's
  dashed `feedback.info` ring with no mark. In greyscale the three differ by `check`, `replay` and the dash (H1, H2).
- **D6. Build a Letter's slots get the nudge look but no mark** (F2). Under OD-AF7 (i) the wrong build stays, and the
  slots stay tappable (a tap takes a tile back), so `replay` ("locked") would say the wrong thing, and `dash` is
  Sentence Builder's alone (OD-AF8 (c)). Without colour, the miss is Hoya's `thinking` line, the shape picture under it
  and the announcement. Owner question Q2 offers the alternative.
- **D7. Next** (OD-AF9 (b)): `Button tone="primary" size="hero" fullWidth`, label `learner.minigame.trace.next.cta`,
  as Story Check's Next (`StoryCheckGame.tsx:436-444`). It appears only with a screen reader on and only after a right
  answer that starts a new round, directly under the answers inside the answers column (stacked on a phone: after the
  last answer; side by side: under the answers in the right column), and takes focus. It never covers or moves an
  answer: it is added below them. At 320 x 568 with 200 % text it is below the first screen; the focus move scrolls it
  into view, as Trace's controls do (TI-3b). Games with Next: Culture Quiz, Tap & Respond, Match Sound, Odd One Out,
  Build a Letter, Listen & Pick, Cloze Pick, Realia Read, Read Pick, Hidden Heritage, Syllable Build, Match Shape and
  Role Play. Games without: Card Match, Pic-Word Match, Story Sequence, Story Order and Sentence Builder (no per-tap
  round change, spec §3.4's focus table). The last pair of a pair game is owner question Q1.
- **D8. The Display sheet row** (OD-AF3 (d), L1, L2): one row after the Text size group and its preview, before the
  note "For everyone on this device. Change it any time.", which now covers it too. It is the level check's row
  (`OptionsScreen.tsx:189-198`): label `learner.placement.options.screenReader.label` (Body semibold) and help
  `.help` (Caption secondary) on the left, a `Switch` on the right with the same `trackColor` (`brand.primary` on,
  `border.strong` off) and `thumbColor` (`surface.paper`); `accessibilityRole="switch"`, named by the label, described by
  the help. The switch's own hit area is at least `touchTarget.min`. A divider (`borderWidth.thin`, `border.subtle`)
  sets it apart from the radio groups. It writes the device flag the level check sets (`device:settings`). Shown on the
  web only (owner question Q4).
- **D9. A `replay` mark is not a replay button** (S2). A mark has no fill, outline or label of its own, is 20 or 24
  inside an answer of 64 or more, and is hidden from assistive tech; the answer around it is inactive, so a tap on it
  does nothing. Every action that shows `replay` is a filled pill at least 64 high with a word beside the glyph
  (`SoundNeededScreen.tsx:38`, Try again). No game screen pairs `replay` with "play again": every Hear it uses
  `speaker`. The one place a mark sits on its own disc is Hidden Heritage (D5), where it is closest to a small round
  button; the beta notes record how learners read it there (spec §3.1).
- **D10. Taught Korean on the boards** keeps its romanization and gloss everywhere (CLAUDE.md §1): Tap & Respond and
  Role Play replies, the Story Order lines, the Card Match cards (romanization; the meaning is the other card), the
  Hidden Heritage word, the tiles. The announcer names Korean by romanization and gloss only (OD-AF5 (a)); the
  capture's `said` check holds it.

## Greyscale (spec §3.1 "Greyscale", §3.8)

Open the `-grey` shots. In greyscale `feedback.successLight` (relative luminance 0.81) and `feedback.nudgeLight` (0.86) are a step
apart and the two borders less, so the fill alone does not tell right from a miss. What does:

| State | Cue without colour |
|---|---|
| right | `check` |
| miss, try again | `replay` |
| tried here (Sentence Builder) | `dash` |
| look here | a thick ring (ChoiceCard `hint`, zone or tile ring, Sentence Builder's outer ring) or a dashed ring (Hidden Heritage) |
| picked (Card Match) | the second outline (D4) |
| not answered | none of the above: a single `border.shape` outline |
| Build a Letter's wrong build | Hoya's `thinking` line and the shape picture (D6) |

## The answer announcer (behaviour only, no look)

`apps/mobile/src/screens/minigames/answer-announcer.tsx` and `use-answer-announcement.ts` (AF-1; spec §3.3). Drawn
nowhere; on the boards its words are the "Said once" lines under each frame.

- One per game screen, mounted for the screen's whole life, empty until the first result, emptied when a new round opens.
- Visually hidden with `srOnly` (moved to `screens/minigames/sr-only.ts`, re-exported by `korean-speech.ts`).
- `accessibilityLiveRegion="polite"` and `aria-live="polite"`. Never `assertive`, never focusable.
- iOS: hidden from VoiceOver (`accessibilityElementsHidden`); its channel is one queued
  `announceForAccessibilityWithOptions(text, { queue: true })` per result, made from `platform/screen-reader.ts` only.
  Android and the web: the region is the channel (reachable by swiping, emptied each round); no announce call.
- Its text changes once per result. The same text twice in a row gets a new `key` on its `Text`, so it is read again.
- The line comes from `answerAnnouncement(result)` as segments (`{ text, lang? }[]`), one `Text` per segment. This
  spec emits UI-language segments only; no taught-Korean Hangul (OD-AF5 (a)).
- Each line is at most the template's 12 words plus the item: "Right answer: sagwa, apple." "Not this one: pear. Try
  another." "Not a match: gimchi and rice. Try another."

## `HoyaBubble` `live` (behaviour only)

- `live?: boolean`, default `true`: every caller that does not pass it keeps today's polite region
  (`HoyaBubble.tsx:55`).
- `live={false}`: the bubble is drawn the same and is not a live region. A game that uses the announcer passes it on
  its **result** bubble only (the miss bubbles in B2, C1, D2, D3, E1, E3, F2, G1, G2, H1, H2, I1, I3, J1, K1), because
  the announcer says the result.
- Status bubbles stay live: Card Match's pick prompt (D1, "Now tap its meaning on the right."), the sound panel, Pic-Word
  Match's selection caption, Story Order's replay line (spec §3.3 table).
- No look change. On the boards each frame's note says which bubbles are `live={false}`.

## Accessibility

- An answered option's name starts with its state (`a11y.minigame.option.correct`, `.wrong`, `.hint`); a locked miss
  is never "dimmed" or "disabled" (`locked` is `inactive`); ChoiceCard `wrong` is not `selected` (AF-1).
- Every mark is `aria-hidden` / hidden from assistive tech (the capture's `mark-hidden` check).
- Focus: with a screen reader on, Next takes focus after a right answer (D7), then the new round's heading node
  ("Question 3 of 4. What does this mean? …"), never a button and never the raw Hangul heading (spec §3.4; drawn as the
  heading block in B1 to B4, C1, C2, E1 to E3, H1, H2, I1 to I3).
- Touch: every answer, button, slot, switch and radio on the boards is at least 64 high (`targets` check); ChoiceCard
  rows are 80 (`touchTarget.child`), Next 96 (`touchTarget.hero`).
- Reduced motion: nothing here moves. The marks appear at once, no fade.
- 320 x 568 with 200 % text: no page scrolls sideways; marks cover no text; long lines wrap. Seen, not changed here:
  Card Match's 138 dp columns break a long meaning at 200 % (D2 at 320 x 568: "water", "kimchi"), as they do today;
  at the app's own Largest step "kimchi" (90 dp) fits. HoyaBubble's 72 dp Hoya leaves its text a narrow column, as on
  every screen that uses it.

## Constants

Values that are not tokens. Every one is the shipped value, unchanged, or a board-only value.

| Where | Value | Derived from |
|---|---|---|
| `MARK_MIN` | 20 | `spacing.lg + spacing.xs` (D1); AF-1 names it in `packages/design-system` |
| Hidden Heritage disc | 26 | `MARK_MIN + 2 x spacing.xxs + 2 x borderWidth.thin` (D5) |
| Hoya in the bubble | 72 | `HoyaBubble.tsx` (unchanged) |
| Build a Letter target, glyph, slot, hint cell | 160, 80, 72, 40 | `BuildLetterGame.tsx:49-52` (unchanged) |
| Switch track and thumb | 52 x 32, 28 | the platform `Switch` (unchanged) |
| Undo with nothing to take back | opacity 0.6 | `BuildLetterGame.tsx` (unchanged) |
| Scene height, scene art | 240, 56 | design board only |
| Specimen column, fold line | 160; 740, 568 or 768 | design board only |

## Checks (`tools/capture.mjs`)

`literals` (no colour literal or bare px outside the constants block), `sideways`, `targets` (64), `danger`
(`feedback.danger` never drawn), `no-x` (no `close` glyph; marks are only `check`, `replay`, `dash`), `words` (no emoji, no
banned word in drawn text or names), `mark-size` (20 or more), `mark-clear` (no mark over any text of its answer),
`mark-hidden`, `contrast` (3:1 on the fill behind it), `cue` (every right, miss and tried answer has a mark, every
look-here a ring, every picked card its outline), `locked` (no answered option is disabled), `said` (no Hangul in an
announcer line), `next` (Next is the one focused control of its frame). All pass at 360 x 740, 320 x 568 with 200 %
text and 1024 x 768.

## Owner questions

- **Q1. The last pair of Card Match and Pic-Word Match with a screen reader on.** Spec §3.6 gives Card Match "the last
  pair's 800 ms, floor; no focus move": the step then ends, and the last line can be cut off by the step change. Proposed:
  with a reader on, the last pair shows Next too (one more tap, for reader users only), as every other round-ending
  right answer does (D7).
- **Q2. Build a Letter's wrong build** (D6): as drawn (nudge look on the slots, no mark), or `dash` on each slot ("tried
  here, still tappable"), which would widen OD-AF8 (c)'s one use of `dash`.
- **Q3. The Display sheet's help line.** It reuses the level check's help, "Questions play when you tap them, with no
  time limits." In the games the flag means Next and no sound by itself, which fits, but "no time limits" is a promise
  the flag does not keep elsewhere (the Daily Test's session clock, the optional Challenge mode). Either AF-1 makes the
  flag lift those clocks too, or the row gets its own help line (a new string, R8 and review).
- **Q4. The row on native.** On iOS and Android the app reads the platform screen reader, so a switch there would do
  nothing. Proposed: the row shows on the web only (where `screen-reader.web.ts` cannot tell). AMENDMENTS-DISPLAY-NAV
  gets the row in AF-6 either way.
- **Q5. Sentence Builder's `dash` at the corner** can read as a dash after the word ("이에요 –") at small sizes (K1).
  Kept as OD-AF8 (c) decided; the beta notes record it with D9's `replay` question.

## Review log

- Round 1: pending (multi-agent review of this pass, CLAUDE.md §5).
