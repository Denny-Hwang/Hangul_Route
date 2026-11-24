# AnswerFeedback (component spec v2): result marks you can see without colour, a result said once

Spec: `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` (revision 2, `ready`; owner decisions OD-AF1 to
OD-AF9 of 2026-11-24, all as recommended) §3.1 to §3.5 and §5, row **AF-0b**; built by rows AF-1 (shared parts),
AF-2 (Culture Quiz, Tap & Respond), AF-3 (Card Match), AF-4a (tiles, Build a Letter), AF-4b (choice games) and AF-4c
(boards). Wireframe: `design/wireframes/minigame/answer-feedback.md` v2 (section C redrawn as shipped in this pass).
Approval: multi-agent review (CLAUDE.md §5, owner rule 2026-10-12). **Revision 2** applies review round 1 and the owner's
answers to Q1 to Q5 (2026-11-24); the log is at the end of this file.

Audience: every learner, any age (CLAUDE.md §1). The screen-reader parts serve learners on VoiceOver, TalkBack or a
browser screen reader; the marks serve everyone, and learners who cannot tell green from blue or amber most of all.

**The mocks are a design reference, not shipped code.** Every colour and size is a token: `mock/tokens.css` is
generated from `packages/design-system/src/tokens.ts` itself, and every mark is drawn from the design system's own
glyph data (`packages/design-system/src/components/Icon/glyphs.ts`). No rule uses `colors.feedback.danger`, and no
mark is an X.

| File | Shows |
|---|---|
| `mock/answer-feedback-states.html` | S1 the mark sizes; A1 to A9 every answer surface in each of its states; S2 a `replay` mark beside the actions that show `replay` |
| `mock/answer-feedback-quiz.html` | B1 to B4 Culture Quiz (a question, a miss, right, right with a screen reader and Next); C1, C2 Tap & Respond as shipped (a miss; right with Next) |
| `mock/answer-feedback-pairs.html` | D1 to D5 Card Match (picked, a meaning tried, a second one, a pair matched, the last pair with Next); E1 to E3 Match Sound as shipped and Odd One Out; F1, F2 Build a Letter (right; a miss that stays) |
| `mock/answer-feedback-boards.html` | G1 Story Sequence, G2 Story Order; H1, H2 Hidden Heritage (a spot at the scene's edge); I1, I2 Syllable Build, I3 Match Shape; J1 Role Play; K1 Sentence Builder |
| `mock/answer-feedback-display.html` | L1, L2 the Display sheet's "I use a screen reader" row (web only), off and on |
| `mock/answer-feedback.css` | the rules (tokens and the named constants only) |
| `mock/tokens.css` | generated, one custom property per token |
| `tools/build-mocks.mjs` | writes the pages and `tokens.css` (edit it, not the HTML) |
| `tools/capture.mjs` | the checks (below) and the shots |
| `shots/<page>-{360,320-text200,1024}.png` and `-grey.png` | each page at 360 x 740, at 320 x 568 with 200 % text, and at a 1024 x 768 tablet (side by side), in colour and in greyscale |

Run: `node design/components/AnswerFeedback/tools/build-mocks.mjs`, then
`NODE_PATH=<checkout>/apps/web/node_modules node design/components/AnswerFeedback/tools/capture.mjs`. It passes with no
finding on every page at every window.

## What it is

Not one component: a rule every answer surface follows, plus small shared parts.

1. **The result look** (spec §3.1): a right answer shows `check`, a miss the learner tries again shows `replay`
   ("try another"), Sentence Builder's tried-here tile shows `dash`, look-here is one dashed ring, a pick is a solid
   ring. The mark is decorative; the accessible name starts with the state ("Right answer: …", "Not this one: …",
   "Look here: …").
2. **The answer announcer** (`AnswerAnnouncer` and `useAnswerAnnouncement`, AF-1): one hidden polite region per game
   screen and one queued iOS call per result. Behaviour only, no look (below).
3. **`HoyaBubble` `live`** (AF-1): a result bubble stops being a live region, because the announcer says the result.
4. **Next** with a screen reader on (OD-AF9 (b), owner Q1), and the Display sheet's screen-reader row (OD-AF3 (d),
   owner Q3, Q4).

## The marks and rings

| State | Cue | Colour | Fill and border | Tappable | Name |
|---|---|---|---|---|---|
| right | `check` | `feedback.success` (on a light fill or its disc) | success family | no: inactive, never disabled | Right answer: … |
| miss, try again | `replay` | `text.primary` | nudge family | no: locked (inactive, still focusable), never disabled | Not this one: … |
| tried here (Sentence Builder only, OD-AF8 (c)) | `dash` on its disc | `text.primary` | nudge family | **yes** | …, tried |
| look here | **a dashed ring** (D4) | `border.focus`, `borderWidth.thick` | as today | yes | Look here: … |
| picked (Card Match, Pic-Word Match) | a solid ring | `brand.primary`, `borderWidth.thick` | `brand.primaryLight` (Card Match) | yes | …, selected |
| not answered | none | — | as today | yes | plain name |

### Size

- **20 dp minimum** for every mark that is not in the flow: `MARK_MIN = spacing.lg + spacing.xs`.
- **24 dp** for a mark in the flow at the end of a row: `spacing.xl` (ChoiceCard, unchanged), and on the Build a Letter
  target box, which has the room.
- **The disc**: 20 on a 26 disc (`MARK_MIN + 2 x spacing.xxs + 2 x borderWidth.thin`) of the state's light fill
  (`successLight` or `nudgeLight`) with a `borderWidth.thin` casing in `text.primary`.
- **Why 20, not 16:** the 16 dp marks of today draw the 2.2 to 2.6 stroke of the 24 grid at under 1.8 px, and a 12 dp
  dot was the only cue on Syllable Build's miss. At 20 the stroke is 1.8 to 2.2 px (shot S1).
- Marks keep a fixed size (an `Icon` does not follow the text size); the surfaces keep room for them at every text size
  instead (next table), which `mark-clear` holds at 320 x 568 with 200 % text. Scaling marks with the text size (capped
  near 1.5x) is follow-up F4.

### Place, per surface

Three placements. **In the flow**, in a column kept in every state. **Inside the corner**, out of the flow, with the
mark's box inside the answer's rounded inner corner (inset `spacing.xs` on `radii.lg` or smaller, `spacing.sm` on
`radii.xl`; the `corner` check). **On a disc straddling the corner**, 4 (`spacing.xs`) outside the border, where the
answer can shrink to its text (Tile) or a mark inside would read as part of the word (Sentence Builder).

| Surface | Marks | Placement | Room kept, so no text is covered and nothing moves | Row |
|---|---|---|---|---|
| ChoiceCard, row (Culture Quiz and Tap & Respond under OD-AF1 (B), Listen & Pick, Cloze Pick, Realia Read, Read Pick, Story Sequence and Story Order cards, Pic-Word Match) | `check`, `replay`, 24 | in the flow at the end | **the 24 column is kept in every state** (an empty 24 view when not answered), so a card never grows on answering (D3) | AF-1 |
| `Tile` (Match Sound, Odd One Out) and Match Shape's letter tiles | `check` (new), `replay` | **disc straddling the corner**, 4 outside (D2) | the disc reaches 20 inside the border, where the jamo column starts | AF-1 (`TILE_MARK`); Match Shape in AF-4c |
| Card Match card | `check` (both cards of a pair), `replay` (a meaning tried), 20 | inside the corner, inset `spacing.xs` | a top band: `paddingTop: max(spacing.xl, cardPadding)` in every state (D5) | AF-3 (`cardMatchStyle`) |
| Build a Letter target box | `check`, 24 | inside the corner, inset `spacing.sm` (`radii.xl`) | the 80 glyph is centred in the 160 box | AF-4a |
| Story Sequence filled slot | `check`, 20 (was 16) | in the flow, after the number | in the flow | AF-4b |
| Hidden Heritage ring | `check` (found), `replay` (miss) | disc centred on the ring's top-end corner, **moved into the scene near its edge** (D6) | the disc sits on the ring, never over the middle of the thing | AF-4c |
| Syllable Build zone and key tile | `check`, `replay` (was a 12 dp amber dot), 20 | inside the corner, inset `spacing.xs` (was `xxs`) | the jamo face is half the zone (`JAMO_FACE`) at every text size; a key's side padding is `spacing.xl` | AF-4c |
| Role Play reply | `replay` (was `dash`), 20 | inside the corner, inset `spacing.sm` (`radii.xl`) | end padding `spacing.xl + spacing.xs` (28) in every state (was `spacing.lg`) | AF-4c |
| Sentence Builder word tile | `dash` on its disc, `text.primary` | **disc straddling the corner**, 4 outside (owner Q5) | `paddingRight: spacing.xl` while tried (unchanged); the disc reaches 20 inside the border, the text ends 24 in | AF-4c |

### Contrast (each mark on the fill right behind it, WCAG 1.4.11; the `contrast` check)

- `check` in `feedback.success` on `feedback.successLight` (a fill or a disc): 4.28:1.
- `replay` and `dash` in `text.primary` on `feedback.nudgeLight`: 14.02:1.
- A disc's casing in `text.primary` reads on any fill and on any scene art, as Hidden Heritage's ring casing does.
- Look-here's dashed ring: `border.focus` on `surface.canvas` and on `surface.paper` is 3:1 or more (the existing
  contrast test), and its shape (dashes, outside the answer) carries it in greyscale (D4).

## Decisions

- **D1. One minimum, three placements** (above). AF-1 adds `MARK_MIN` and the disc size beside `TILE_MARK` in
  `packages/design-system` (named sums of tokens, not new tokens), so every game reads the same numbers.
- **D2. `Tile`'s mark moves onto a disc straddling the corner** (revision 2). Inside the corner it covered the jamo once
  a tile shrank to its glyph at 200 % text (the `mark-clear` check, states board at 320). On the disc it reaches 20
  inside the border and 4 (`spacing.xs`) outside, 8 clear of the next tile in the grid's `spacing.md` gap (revision 3:
  was 8 outside, which left about 4); the tile keeps its size. Match Shape's letter tiles (`MatchShapeBoard.tsx:82`,
  both round kinds) follow Tile; Syllable Build's zones and keys keep the mark inside the corner (their jamo face is a
  fixed half of the zone; a key has `spacing.xl` side padding). The `overlap` check keeps every mark and disc 4 from any
  other answer.
- **D3. ChoiceCard keeps its mark column** (review round 1, charter M6). Not answered and `hint` draw an empty 24 view
  where the mark goes, so answering never rewraps the text or grows the card (the `reflow` check). The cost is 36 dp of
  text width when not answered (the 24 mark and the row's `spacing.md` gap), which moves the `text-size-fit` and
  `game-sizing` e2e (AF-1). Romanization and
  gloss break at spaces, and inside a word only when the word cannot fit a line (`break-word`, never `anywhere`). Noted
  in `design/components/ChoiceCard/spec.md` for AF-1.
- **D4. One look-here shape everywhere** (review round 1, charter M3): a dashed ring, `borderWidth.thick` in
  `border.focus`, `spacing.xs` outside the answer, drawn by a negative-margin wrapper (as Role Play's look-here ring,
  `RolePlayGame.tsx:623`), so it takes no room and nothing moves. It replaces ChoiceCard `hint`'s thick border (1.06:1
  against `border.shape`, so it read by width alone), the zone and key ring of Syllable Build and Match Shape, Sentence
  Builder's solid ring and Role Play's solid ring. Hidden Heritage keeps its dashed ring inside the spot. The focus ring
  stays solid at `spacing.xxs`, and a pick is a solid ring: in greyscale look-here is the only dashed ring *outside* an
  answer (dashed borders *of* a place mark it empty: an empty zone, Sentence Builder's open place, an empty Found slot).
  With keyboard focus on a look-here answer the two rings meet in one band with a dashed outer edge (A1, "Look here
  with keyboard focus"): still unlike a plain focus ring or a pick, so they are left to merge.
- **D5. Card Match** (AF-3):
  - **Top band**, not an end gutter. The columns are 138 wide at 320, leaving 110 for a card's text, the tightest column
    in the games; a band of `max(spacing.xl, cardPadding)` (cardPadding scales to 17 at most) costs height instead, and
    the board scrolls. It is there in every state.
  - **Picked**: the picked Korean card keeps its `brand.primaryLight` fill and gains a solid ring, `borderWidth.thick` in
    `brand.primary`, `spacing.xxs` outside (5 in all). RN has no spread shadow, so it is drawn by a negative-margin
    wrapper around the `TapTarget` (Role Play's technique, not Pic-Word Match's padded target): no layout cost, not part
    of the hit area (inside the `TapBoard` the gap fill reaches the card), and 3 dp clear of the next card in the 8 row
    gap. Its name keeps `selected`. It reads in greyscale as a solid double outline, unlike look-here's dashes.
  - **Idle border**: kept `border.subtle` as shipped. Moving it to `border.shape` (as AU-17e did for ChoiceCard and Tile)
    is follow-up F1, outside F-A11Y-001.
  - **The last pair** with a screen reader on shows Next (owner Q1; D9, D5 frame).
- **D6. Hidden Heritage: a disc on the ring's corner, kept inside the scene** (review round 1, code M1). The scene clips
  (`overflow: 'hidden'`, `HiddenHeritageGame.tsx:385`), and real spots sit at its edge (`four-seasons.ts:241-250`:
  12 of 400 from the top, ending at the right edge). The disc's centre goes on the ring's top-end corner; along each
  axis where that would cut the disc at the scene's edge, it moves in just far enough to stay whole. AF-4c computes it
  from the spot and scene rectangles (a pure `ringMarkOffset`). The `scene` check holds it (H1). While the miss disc
  shows, the thing tapped is inactive: a tap on it is not a second miss. Look-here keeps today's dashed ring with no mark.
- **D7. Build a Letter's wrong build** (owner Q2). The slots take the nudge look and no mark (they stay tappable, so
  `replay` would say "locked", and `dash` stays Sentence Builder's). **The shape picture's place is kept directly under
  the slots in every state, at the round's own block height**: `rows x HINT_CELL + (rows - 1) x spacing.sm` (40, 88 or
  136 for one, two or three rows, `SyllableBlock/layout.ts:35-39`), known from the round's shape before any miss. Its
  appearance there is the non-colour cue, and nothing moves when it appears (the `reserved` check; F1 and F2 are a
  two-row block, F3 a three-row one). The picture moves from under Hoya's bubble (today) to under the slots; the order
  is target, slots, shape picture, Undo, tray, Hoya's line (F-A11Y-001 §3.5 notes it).
  - **First screen** (`first-screen` check, 360 x 740, measured from the game's own top, without the shell's header):
    the picture ends at 551 (two rows) and 679 (three rows), inside 740; Undo and the tray end at 856 and 984, so the
    screen scrolls to them, as it already does for a three-row block today. With the shell's header above, the
    three-row picture starts in the first screen and ends near the fold. That is what Q2 keeps: the cue in the first
    screen, not the whole board.
- **D8. The layouts as shipped** (review round 1, code M2):
  - **Tap & Respond** (`TapRespondGame.tsx:136-158`) is one column at every width: the heading, a `Card` with "Someone
    says", the Korean line, its romanization and meaning, and Hear it inside the Card; the replies under it. The
    round's focus node (spec §3.4) wraps the Card's text only, and Hear it stays its sibling inside the Card, so AF-2 does
    not move Hear it.
  - **Match Sound** (`MatchSoundGame.tsx:170-252`): the 48 speaker in `spacing.md` padding with its caption beside it;
    after a miss, Hoya's bubble carries the letter (Hangul and romanization on their own lines) and its own Hear it.
  - Culture Quiz and Tap & Respond today lock a miss with a `disabled` Button; on ChoiceCard (OD-AF1 (B)) it is
    `inactive`. Role Play passes `disabled` to a locked reply's `TapTarget` (`RolePlayGame.tsx:630`); AF-4c passes
    `inactive` instead.
- **D9. Next** (OD-AF9 (b), owner Q1): `Button tone="primary" size="hero" fullWidth`, label
  `learner.minigame.trace.next.cta` ("Next", also on the last round), as Story Check's (`StoryCheckGame.tsx:436-444`).
  With a screen reader on it shows **after every right answer that ends a round, the last round and the last pair
  included**, and takes focus; the step moves on only when it is pressed. It sits directly under the answers inside the
  answers column (stacked: after the last answer; side by side: under the answers in the right column) and never covers
  or moves an answer. At 320 x 568 with 200 % text it is below the first screen; the focus move scrolls it into view.
  Drawn in B4, C2, D5, E2 and I2; every other game is as B4 (Odd One Out, Build a Letter, Listen & Pick, Cloze Pick,
  Realia Read, Read Pick, Hidden Heritage, Match Shape, Role Play, Pic-Word Match's last pair, Sentence Builder's built
  sentence). Story Sequence and Story Order end their round with their own replay and Done, which are that button.
- **D10. The Display sheet row** (OD-AF3 (d), owner Q3, Q4; L1, L2):
  - **Words**: the label is the level check's `learner.placement.options.screenReader.label` ("I use a screen
    reader"); the help is its own new key, `common.display.screenReaderHelp`, "Tap Next to go on. Sounds play when you
    tap them." (es and ko in AF-1, drafted
    by R8: both locales are shipped). The flag lifts no other clock: the Daily Test's session clock and Challenge mode are
    unchanged.
  - **Look**: one row after the Text size group and its preview, before the note, which covers it too. A divider
    (`borderWidth.thin`, `border.subtle`) sets it apart. Label `Body` semibold, help `Body tone="secondary"` (18, the
    body floor), the track on the right. **The whole row is the switch** (`accessibilityRole="switch"`, named by the
    label, described by the help, at least `touchTarget.min` high). Off, the track is `border.shape` (4.55:1 on paper),
    not `border.strong` (1.95:1); on, `brand.primary`, the thumb at the end. The level check's own switch keeps
    `border.strong`: follow-up F3.
  - **Where**: web only, `Platform.OS === 'web'` (the installed PWA included). Native reads the platform screen reader.
    It writes the device flag the level check sets (`device:settings`).
  - **Code**: `DisplaySheetProps` gains `screenReader?: { label: string; help: string; value: boolean; onChange: (on:
    boolean) => void } | null`, drawn after Text size and before `note`; absent or null draws nothing. The learner
    app passes it on the web only. The grown-up pages' DOM twin (`apps/web/src/components/console/DisplaySheet.tsx`)
    and the presenter do not draw it: they run no answer rounds. AF-1 lands the prop; AMENDMENTS-DISPLAY-NAV gets its
    line in AF-6.
- **D11. A `replay` mark is not a replay button** (S2). A mark has no fill, outline or label of its own, is 20 or 24
  inside an answer of 64 or more, and is hidden from assistive tech; the answer around it is inactive, so a tap on it
  does nothing. Every action that shows `replay` is a filled pill at least 64 high with a word beside the glyph
  (`SoundNeededScreen.tsx:38`). No game screen pairs `replay` with "play again": Hear it uses `speaker`. The discs come
  closest to a small round button; the beta notes record how learners read them, and `replay` beside the sound buttons
  of Match Sound and Syllable Build: in Match Sound the round `replay` disc sits next to the speaker's shipped caption
  "Tap to replay" (E1, E2).
- **D12. Taught Korean** keeps its romanization and gloss everywhere (CLAUDE.md §1). The announcer names Korean by
  romanization and gloss only (OD-AF5 (a)); the `said` check holds it.

## Greyscale (spec §3.1 "Greyscale", §3.8)

Open the `-grey` shots. In greyscale `feedback.successLight` (relative luminance 0.81) and `feedback.nudgeLight`
(0.86) are a step apart, so the fill alone does not tell right from a miss. What does:

| State | Cue without colour |
|---|---|
| right | `check` |
| miss, try again | `replay` |
| tried here (Sentence Builder) | `dash` on a corner disc |
| look here | a **dashed** ring outside the answer (inside the spot on Hidden Heritage); a dashed border *of* a place means it is empty |
| picked (Card Match, Pic-Word Match) | a **solid** second ring outside the answer |
| not answered | none of the above: a single outline |
| Build a Letter's wrong build | the shape picture appearing in its kept place under the slots (D7), then Hoya's `thinking` line |
| focused look-here | one band, solid inside and dashed at its outer edge (D4) |

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
- The line comes from `answerAnnouncement(result)` as segments (`{ text, lang? }[]`), one `Text` per segment, UI
  language only (OD-AF5 (a)).

## `HoyaBubble` `live` (behaviour only)

- `live?: boolean`, default `true`: every caller that does not pass it keeps today's polite region (`HoyaBubble.tsx:55`).
- `live={false}`: drawn the same, not a live region. A game that uses the announcer passes it on its **result** bubble
  only (the miss bubbles in B2, C1, D2, D3, E1, E3, F2, G1, G2, H1, H2, I1, I3, J1, K1).
- Status bubbles stay live: Card Match's pick prompt (D1), the sound panel, Pic-Word Match's selection caption, Story
  Order's replay line (spec §3.3 table).

## Accessibility

- An answered option's name starts with its state; a locked miss is never "dimmed" or "disabled" (`inactive`, D8);
  ChoiceCard `wrong` is not `selected` (AF-1).
- Every mark is hidden from assistive tech (`mark-hidden`).
- Focus: with a screen reader on, Next takes focus after a right answer that ends a round (D9), then the new round's
  heading node, never a button and never the raw Hangul heading (spec §3.4).
- Touch: every answer, button, slot, switch row and radio is at least 64 high (`targets`).
- Reduced motion: nothing here moves. Marks and rings appear at once.
- 320 x 568 with 200 % text: no page scrolls sideways; marks cover no text and no other answer; no ChoiceCard grows on
  answering. Seen, not changed here (follow-up F5): Card Match's 138 dp columns break a long meaning at 200 %, as they
  do today; HoyaBubble's 72 dp Hoya leaves its text a narrow column, so a long word breaks inside.

## Constants

Values that are not tokens. Every one is the shipped value, unchanged, a named sum of tokens, or a board-only value.

| Where | Value | Derived from |
|---|---|---|
| `MARK_MIN` | 20 | `spacing.lg + spacing.xs` (D1) |
| Disc | 26 | `MARK_MIN + 2 x spacing.xxs + 2 x borderWidth.thin` |
| Disc outside the border (straddling) | 4 | `spacing.xs` |
| Build a Letter's shape place | 40, 88, 136 | `rows x HINT_CELL + (rows - 1) x spacing.sm` |
| Hoya in the bubble | 72 | `HoyaBubble.tsx` (unchanged) |
| Build a Letter target, glyph, slot, hint cell | 160, 80, 72, 40 | `BuildLetterGame.tsx:49-52` (unchanged) |
| Switch track and thumb | 52 x 32, 28 | the platform `Switch` (unchanged) |
| Undo with nothing to take back | opacity 0.6 | `BuildLetterGame.tsx` (unchanged) |
| Scene height, scene art | 240, 56 | design board only |
| Specimen column, fold line, text factor | 160; 740, 568 or 768; 1 or 2 | design board only |

## Checks (`tools/capture.mjs`)

`literals`, `sideways`, `targets` (64), `danger`, `no-x`, `words`, `mark-size` (20 or more), `mark-clear` (no mark over
any text of its answer), `corner` (a corner mark's box inside the rounded inner corner), `overlap` (every mark and disc at
least `spacing.xs` from any other answer), `scene` (a Hidden Heritage disc whole inside its clipping scene), `reflow` (a ChoiceCard as high
answered as not), `mark-hidden`, `contrast` (marks 3:1 on their fill; the switch's off track 3:1 on the sheet), `cue`
(every right, miss and tried answer has a mark, a tried one on its disc; every look-here a dashed ring; every pick a
solid ring), `locked`, `reserved` (Build a Letter's shape place under the slots, at its block's height), `first-screen` (the shape
picture inside 740 at 360 x 740; where the tray ends is printed), `body-floor` (the Display
help line at 18 or more), `said`, `next`. All pass at 360 x 740, 320 x 568 with 200 % text, and 1024 x 768. The
200 % window is a hybrid: reading sizes (caption to prompt) double, and large type (title, display, hero: the jamo on a
tile) grows 1.5 times, by the engine's `1 + (f - 1) / 2`. The app's own largest step is 1.5 (`text-size.ts:27-29`); a
native OS font scale multiplies every size alike (`text-size.ts:85`), so 200 % here is a stress case, not one setting.

## Owner decisions (2026-11-24, in session, on revision 1's Q1 to Q5)

- **Q1** Next (reader on) shows after every right answer that ends a round, the last round and the last pair included;
  the step moves on when Next is pressed. Card Match's last-pair 800 ms applies only with the reader off (one line in
  F-A11Y-001 §3.6). D9.
- **Q2** Build a Letter's wrong build gets no `dash`; the shape picture's place is kept directly under the slots in
  every state, so its appearance is the cue and nothing moves. D7.
- **Q3** The Display row gets its own help line, "Tap Next to go on. Sounds play when you tap them." (new English key
  `common.display.screenReaderHelp`, in F-A11Y-001 §3.7; es and ko in AF-1, drafted by R8 and reviewed:
  both locales are shipped). It does not lift the
  Daily Test or Challenge clocks. D10.
- **Q4** The row shows on the web only (`Platform.OS === 'web'`, the installed PWA included). D10.
- **Q5** Sentence Builder keeps `dash`, on a 26 `nudgeLight` disc with a `borderWidth.thin` `text.primary` casing
  straddling the tile's top-end corner, so it reads as a badge, not as ㅡ or a hyphen. D1, A6, K1; the `cue` check.

## Follow-ups (not in F-A11Y-001)

- **F1** Card Match's idle border `border.subtle` (1.32:1) to `border.shape`, as AU-17e did for ChoiceCard and Tile.
- **F2** Beta notes: how learners read the discs and `replay` beside sound buttons (D11); whether Card Match's
  `brand.primary` pick ring beside an amber miss reads as alarming (review minor 8).
- **F3** The level check's screen-reader switch (`OptionsScreen.tsx:189-198`): its `border.strong` off track is 1.95:1;
  give it D10's `border.shape` track and whole-row target.
- **F4** Marks that grow with the text size (capped near 1.5x), once AF-1 has landed `MARK_MIN`.
- **F5** Narrow text columns at 200 %: Card Match's meanings ("kimch/i"), HoyaBubble's text beside its 72 dp Hoya
  ("describin/g"); and break romanization at syllable boundaries ("annyeong-haseyo") rather than at any letter.

## Review log

- **Round 1 (2026-11-24), two lenses: spec and code truth; charter and accessibility.** No blockers. Revision 2 fixed:
  - Spec and code, majors: (M1) Hidden Heritage's disc was cut by the shipped scene's `overflow: hidden` at edge spots:
    it now moves into the scene (D6), the mock clips and has an edge spot (H1), the `scene` check holds it, and the A8
    note says 26. (M2) Tap & Respond and Match Sound were not drawn as shipped: both redrawn (C1, C2, E1, E2), D8 says
    Hear it stays inside Tap & Respond's Card, and the wireframe's section C is redrawn.
  - Spec and code, minors: (m3) the Display row's prop, the DOM twin and the presenter (D10). (m4) Card Match: idle border
    kept as shipped (F1), the ring's technique, hit area and clearance, the band as `max(xl, cardPadding)` (D5). (m5)
    the corner marks' inset (below). (m6) Pic-Word Match's picture card (A9), Role Play's look-here (A5), Next on the last
    pair (D5) and "all as B4" with the label on the last round (D9). (m7) `inactive` for Role Play's locked reply and for
    Culture Quiz and Tap & Respond (D8).
  - Charter and accessibility, majors: (M1) Sentence Builder's dash: owner Q5. (M2) corner marks on the rounded border:
    inset `spacing.xs` on `radii.lg`, `spacing.sm` on `radii.xl`, and the `corner` check; Tile moved onto a straddling
    disc when the check showed its jamo covered at 200 % (D2). (M3) one dashed look-here ring everywhere (D4), the
    greyscale table and the `cue` check. (M4) Build a Letter's first-screen cue: owner Q2 (D7). (M5) Next on the last
    round: owner Q1 (D9). (M6) the ChoiceCard mark column and line breaking (D3) and the `reflow` check. (M7) the switch's
    off track and the whole-row target (D10), with the level check's row as F3.
  - Charter and accessibility, minors: (8) logged for the beta (F2). (9) resolved by D4. (10) beta note (D11). (11) the
    disc at scene edges and the inactive thing tapped (D6). (12) F4. (13) the help line in `Body` secondary, and the
    `body-floor` check. (14) F5.
- **Owner decisions 2026-11-24**: Q1 to Q5 as above.
- **Round 2 (2026-11-24), the same two lenses.** Both approve with changes; no blockers. Revision 3 fixed:
  - Code, majors: (A) Build a Letter's kept place follows the round's block (one, two or three rows), F1 and F2 are a
    two-row block, F3 a three-row one, the first screen is measured and stated (D7), and F-A11Y-001 §3.5 notes the new
    order. (B) F-A11Y-001 §3.1 points to this spec and its look-here and tried rows are updated; §9's AF-1, AF-3, AF-4a
    and AF-4c rows list the work this design adds (Tile's tests, the ChoiceCard column's e2e cost, the hint cue).
  - Code, minors: the 200 % hybrid is stated (Checks); the Hidden Heritage disc is D6 in the notes; A8 says a clamped
    disc may cover the thing's corner.
  - Charter: (1) the straddling disc sits 4 outside, and `overlap` keeps 4 clear of any other answer (D2). (2) Match
    Shape's tiles follow Tile, Syllable Build's zones and keys keep the corner (D2, the places table, A4, I3). (3) the
    greyscale wording, and the focused look-here specimen (D4, A1). (4) "Tap to replay" beside the disc (D11). (5) es and
    ko in AF-1 (D10, Q3). (6) F5.
- Round 3: pending.
