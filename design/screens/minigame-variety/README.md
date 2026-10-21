# F-CURR-002 formats: Cloze Pick, Dictation, Syllable Build, Match Shape, Story Order, Role Play, My Story, Yut Review (design mocks v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md`, row **CM-D2** in the section 17 table: §7.1 (formats F1 to F6, F8 and F10, each with its fallback), §4.5 (`dictation-unambiguous` and the read-plus-meaning spelling round), §7.7 (the anti-shame checklist), §12.2 (`game.<kind>` switches), §14 (48 dp targets in the new games). This is the agent design pass the spec asks for before rows **CM-30** to **CM-35**, **CM-38** and **CM-39**; the multi-agent review approves it (owner decision 2026-10-12, CLAUDE.md §5). The order wireframe -> mock -> component holds.
Wireframes: `design/wireframes/minigame/cloze-pick.md`, `syllable-build.md`, `match-shape.md`, `story-order.md`, `role-play.md`, `my-story.md`, `yut-review.md`, the `hear` mode (Dictation) and the spelling round in `type-hangul.md`, the F-CURR-002 section of `shell.md` and screen W11 of `audio-fallback.md`.

Built by:
- **CM-30** Cloze Pick and the Listen & Pick text prompt mode -> `mock/cloze-pick.html`, board C.
- **CM-31** Dictation and the spelling round -> `mock/dictation.html`, board D.
- **CM-32** Syllable Build -> `mock/syllable-build.html`, board S.
- **CM-33** Match Shape and Read Pick -> `mock/match-shape.html`, board M.
- **CM-34** Story Order -> `mock/story-order.html`, board O.
- **CM-35** Role Play -> `mock/role-play.html`, board R.
- **CM-38** My Story -> `mock/my-story.html`, board Y.
- **CM-39** Yut Review -> `mock/yut-review.html`, board B.

**Nothing here changes a string, a flag, a schema, a token or content.** The words drawn are drafts listed in each wireframe's "Draft strings" table; the build rows add them to `packages/i18n` with their es and ko values in the same PR. The Korean drawn is fixture content; romanization is the repo converter's output (`packages/content-schema/src/romanization/rr.ts`) for every word and sentence.

## What is here

| File | What it fixes |
|---|---|
| `mock/variety.css` | one stylesheet on top of the writing mocks' (`../minigame-writing/mock/writing.css`, imported unchanged: the token block, the device frame, the keyboard, the Write Frame parts, the buttons); adds the option tiles, the prompt card, the sound notice, the Hoya line, the block and tile rows, the order cards and slots, the chat layout, My story so far, the Yut board band |
| `mock/*.html` (8 pages) | each format's main state; each page fills the window, so the same file is the 320 and the 768 shot |
| `mock/states.html` | boards C, D, S, M, O, R, Y, B: the miss (amber) and found states, each format's fallback round when its `game.<kind>` is off, the no-voice notice, the spelling round, the Role Play end card, My page (not kept), the Yut "throw again" state |
| `shots/` | the mocks rendered in Chromium: `<format>-320.png` (320 x 568 at 2x) and `<format>-768.png` (768 x 1024 at 1x), and `states.png` (the boards at 1x, full page) |

Open any file in a browser. Nothing is interactive (the Role Play page scrolls its chat log to the newest line on load, as the app does).

## Design decisions

**D1. One frame, three layouts.** Every format renders in the shell (`shell.md`): layout A (options under a prompt: Cloze Pick, Match Shape, Syllable Build, Story Order), layout B (a pinned answer area: Role Play, Dictation, My Story's write phase), layout C (a band above the item: Yut Review). A learner who has met one meets the others without new controls.

**D2. A miss is amber, never red.** The tapped tile takes `feedback.nudgeLight` with a thick `feedback.nudge` border and the mark dot (the Type Hangul mark); Hoya's line is the `thinking` pose on the same amber. `feedback.danger` is not used anywhere in these mocks. A found answer has three cues: the success fill, the check glyph and (where it applies) the gloss or the filled gap.

**D3. Meanings are held back where they would answer the round.** Cloze tiles, Story Order cards and Role Play replies show Korean and romanization only; Story Order and Role Play offer [ Show meanings ] as a hint (recorded as hinted for the memory model, never a penalty line). Prompts keep their meaning (the sentence's meaning in Cloze Pick, the partner line's meaning in Role Play, the word's meaning in Dictation), because the meaning is the input the round reads from.

**D4. Dictation hides the romanization before Done.** The Korean is the answer and is not drawn, so the romanization (which, for the unambiguous words Dictation admits, maps straight to the spelling) is held too; "Show how it sounds" reveals it as a hint. Below 640 tall it is the link line of the meaning button in the one prompt row (speaker, meaning button, Skip), so it is never half-shown. After Done the word is shown with its romanization and meaning. With no device voice the round opens as a `see` round with the sound notice (board D1), decided before the round opens.

**D5. Syllable Build at 320 fits on one screen** by putting the speaker beside the block (measured: top row 64, speaker and block 140, three rows of caption and 64, the Hoya slot). The final row never offers two letters with the same final sound (밥 offers ㅂ, ㄴ, ㅇ and No final, never ㅍ).

**D6. Match Shape's origin picture faces left**, so the tongue drawn heavier reads as the letter (ㄴ: the tongue touching the upper gum, in the wording of the shipped, sourced fact f3 of `content/stories/shapes-of-hangeul.json`). The picture is an original, simple side view in tokens; CM-33 draws the five consonant pictures and the vowel bases as registry props with a `sourceRef`, to the scene-art style guide. The mock's picture is a proposal for the ㄴ prop's shape budget (5 shapes, 5 colours).

**D7. Role Play never ends badly.** A less natural reply is never sent: it locks in amber, Hoya says why another fits (board R1), and the learner taps again. Every branch ends with a closing line and Continue (board R2). The partner is named by role (사서, librarian), never by a personal name; the learner is "you".

**D8. My page is shown and not kept.** The not-kept line sits above the text (board Y1), and there is no save, share, copy, download or print control. Every bank has one neutral option (호야 for a person, 괜찮아요 for a feeling, 공원 for a place), drawn like the others.

**D9. The Yut board is play only.** The board band (128 on a phone from 600 tall, 96 below 600 tall with the throw on one line and no sticks art, 320 from regular) shows the 29 stations of the board (20 on the edge, 6 to a side with shared corners, and 9 on the two crossing lines), the learner's piece, the last throw's name in Korean with romanization and how far it went, the sticks as drawn art, and the home tray of four pieces. The stations are not tap targets. Stars and everything else come from the review answers; the result screen is the plain one. No other player, no capture, no backward move.

**D10. Fallbacks are shipped games.** Each board's last device is the format's fallback round, rendered as the shipped game would render it (C3 Listen & Pick with a text prompt, S2 Listen & Pick on the block, M3 Read Pick, R3 Tap to Respond). The dashed note under each is a board note, not UI: the learner sees no notice.

## Drawn parts (scene-art budget)

| Prop (proposed id) | Format | Shapes | Colours (token paths) |
|---|---|---|---|
| `prop:shape-origin-nieun` (and `-giyeok`, `-mieum`, `-siot`, `-ieung`, the vowel bases) | Match Shape | 5 | `hoya.belly`, `border.shape`, `surface.sunken`, `surface.paper`, `text.primary` |
| `prop:yut-sticks` | Yut Review | 4 | `hoya.furDark`, `border.shape` |
| the board | Yut Review | layout (29 circles and 5 lines) | `surface.paper`, `border.shape`, `border.strong`, `brand.primary` (the piece) |
| the book picture of the spelling round | Dictation board D2 | 3 | `brand.secondaryLight`, `surface.paper`, `text.primary`, `border.shape` (a fixture picture; the S2 rows use the WordArt or card art of the word) |

No `brand.primary` in a prop other than the learner's piece, and no `feedback.danger` anywhere.

## Tokens

Every value in `mock/variety.css` is a custom property of the writing mocks' token block (a token of `packages/design-system/src/tokens.ts`, copied once under its own name; checked value by value against `tokens.ts` in the writing pass and unchanged since) or one of the constants below. No colour literal anywhere in the CSS or the HTML; every `var(--...)` used is defined (checked with a script on this commit). **No new token is needed.**

## Constants

Values that are not tokens. The build rows write them as named constants, never bare literals.

| Where | Value | Derived from |
|---|---|---|
| Yut board drawing, phone | 128 from 600 tall; 96 below | 2 x `touchTarget.min`; `touchTarget.hero` |
| Yut board drawing, from regular | 320 | 5 x `touchTarget.min` |
| Match Shape origin picture, phone height | `var(--trace-canvas-min)` (160) | `TRACE_CANVAS_MIN`, referenced, not copied |
| Chat bubble width cap | 85 % phone, 80 % from regular | keeps the side of a bubble (who said it) visible at every width |
| Syllable Build block zones | 64 x 64 each, the final zone 64 tall across both columns (phone); 96 and a 64-tall final zone from regular | `spacing.jumbo` (= `touchTarget.min`, because a filled zone is a tap target that empties it); `touchTarget.hero` / `touchTarget.min` |
| Story Order slots | 2 x 2 on a phone, 4 across from regular | a filled slot shows its line's first word with romanization (`그다음에` `geudaeume` needs half the column); each slot at least `touchTarget.min` tall |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/cloze-pick-320.png`, `-768.png` | 320 x 568 2x, 768 x 1024 | asking: the sentence with the gap, three tiles (one column at 320, two from regular) |
| `shots/dictation-320.png`, `-768.png` | same | hear mode: below 640 tall one row (speaker, meaning button with its "Show how it sounds" link line, Skip); the hero speaker with Hear it again from 640 tall; the keyboard of Type Hangul |
| `shots/syllable-build-320.png`, `-768.png` | same | building: the first letter placed, three labelled rows, No final |
| `shots/match-shape-320.png`, `-768.png` | same | origin round: the ㄴ picture and line, three letter tiles |
| `shots/story-order-320.png`, `-768.png` | same | captions only: two slots filled with their first words, two cards left, Show meanings, Skip this one |
| `shots/role-play-320.png`, `-768.png` | same | turn 2 of 4: the log, the partner line with Hear it, two replies pinned |
| `shots/my-story-320.png`, `-768.png` | same | frame 2 of 3, pick: My story so far, the frame, the bank with the neutral option 호야 |
| `shots/yut-review-320.png`, `-768.png` | same | after a throw (개, 2 stations) with the next review item; below 600 tall the 96 band with the throw on one line; the board beside the item from regular |
| `shots/states.png` | 1180 wide, 1x, full page | boards C, D, S, M, O, R, Y, B |

## Checked by eye

- 320 x 568: every target at least 64 tall (48 dp floor of §14 met), no text cut, no horizontal scroll; Syllable Build, Cloze Pick, Match Shape, Dictation and Yut Review fit the first screen; Story Order, Role Play and My Story scroll as their wireframes say (Role Play's reply area stays pinned).
- 768 x 1024: one reading column (or two panes for Yut Review and My Story), nothing stretched past the reading width.
- No red, no emoji, no percentage, no timer, no age wording, no microphone or speaking control on any board.
