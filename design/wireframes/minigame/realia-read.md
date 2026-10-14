# Minigame/Realia Read: find information in a drawn real-world text (wireframe v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.6 (Stage 6 Practice), §3.10 (the `realia` Discover item and the `realia-read` kind), §3.14 (accessibility: "every drawn text is also real text in the accessibility tree"), OD-11 (money), rows D-2 (this file and its mock), G-2 (the game), S6-1 to S6-5 (the realia content) · extends `design/wireframes/minigame/shell.md` and `families.md` (Family Recognition) · option card: `design/components/ChoiceCard`, taught Korean: `design/components/KoreanText`, drawn parts: `design/brief/illustrations/scene-art-style.md` (F-STORY-002 §3.9) · audio states: `design/wireframes/minigame/audio-fallback.md`
Mock: `design/screens/minigame-realia-read/` (the four realia, the round states, 320 px to tablet landscape)
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts, art or final copy; text in (parentheses) is a placeholder.
Code (row G-2, not yet built): `apps/mobile/src/screens/minigames/RealiaReadGame.tsx`; pure rules in `apps/mobile/src/logic/realia-read-flow.ts`; the realia view in `packages/design-system/src/components/RealiaSheet/`; dressings in `packages/design-system/src/scene-art/props/realia.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean shown with romanization (`KoreanText`), `{ x }` content-driven, `<state>` a runtime state, `== x ==` a line of realia text (real text on the drawn sheet).

## Scenario (Given-When-Then)

Given: a Stage 6 Practice step with a `realia-read` scope (one realia and 4-5 questions about it)
When: the learner reads the drawn menu, ticket, trail sign or price cards and taps the answer to a question ("How much is the ramyeon?")
Then: a right answer is a green check that also marks the line of the realia where the answer was, a miss is a soft amber nudge and the realia stays on screen to look at again, and after the last question the step is complete

## Screen goal

"Read the real thing and find the answer in it. A miss only means look again."

Reading is the skill (F-CURR-001 §3.11: `realia-read` counts for read). Nothing on this screen asks the learner to speak.

## The realia: a drawn sheet with real text

A realia is **two layers**, never one picture:

1. **Dressing**: scene-art props (registry items `prop:realia-*`, F-STORY-002 rules: flat shapes, token colours, no text, no logo, no photograph) that make the sheet read as a menu board, a ticket, a trail sign or a price card: the board's frame and awning, the ticket's stub and perforation, the sign's post and pointed boards, the card's peg and the goods behind it.
2. **Text layer**: every word on the realia is a live text element laid out inside the dressing, so it is in the accessibility tree, grows with the text size, follows the romanization setting and can be tapped to hear. The scene-art rule "no text in the image" (style guide §3.7) is kept because the text is not in the image.

The four kinds (fixture words from F-CURR-001 §3.6; each cell row S6-1 to S6-5 owns its own lines):

```
MENU (Read the Menu, Order Food)        TICKET (Travel for Chuseok)
+--{ awning dressing }--------------+   +--{ band with a drawn train }------+
|  == 메뉴 ==  (menyu)               |   | == 기차표 == (gichapyo)       :   |
|  == 김밥 == ......... == 2,000원 == |   | == 출발 ==   == 서울 == 3:00  : o |  <- stub after the
|  == 떡볶이 == ....... == 3,000원 == |   | == 도착 ==   == 대전 == 4:30  :   |     dotted cut
|  == 라면 == ......... == 3,000원 == |   +-----------------------------------+
|  == 비빔밥 == ....... == 5,000원 == |
+--{ counter dressing }-------------+

TRAIL SIGN (Hike & Ask)                 PRICE CARDS (Buy at Market)
   { mountain dressing }                 { goods }  { goods }  { goods }
   == 산길 == (sangil)  <- post plate    +--------+ +--------+ +--------+
  +--------------------------+>          |== 사과 ==| |== 부채 ==| |== 한지 ==|
  | == 정상 ==  == 1시간 ==   |>  right   |== 3개 == | |         | |         |
  +--------------------------+>          |==2,000원==| |==5,000원==| |==1,000원==|
 <+--------------------------+           +--------+ +--------+ +--------+
 <| == 입구 ==                |   left
 <+--------------------------+
```

- Every line is `{ ko, romanization }` (F-CURR-001 §3.1 rule 7). The romanization line sits under the Korean (`romanizationMode` `always`), or appears when the line is tapped (`tap`).
- Glosses are **not shown on the realia while a question is open** (a gloss next to 라면 would answer "Which one is noodles?"). The gloss of the answer line appears with the found mark after a right answer.
- Prices are **round practice amounts in won** inside the drawn sheet only (OD-11): multiples of 1,000 up to 10,000, written as Korean menus write them (`3,000원`), with the romanization of how they are read (samcheon won). Never a product price, a shop name, a brand, a logo, a company's ticket layout or a real train number.
- Directions are a **drawn arrow and a word**: a board points with its shape and an arrow glyph, and its accessible name says the direction ("to the right"); a question never depends on the arrow's colour.

## Box diagram

Phone, portrait (one column; the body scrolls, the realia scrolls with it):

```
+----------------------------------+
| (progress bar)          (2 / 4)  |  <- practice bar + "n / N" (shell)
|                                  |
|  +--{ awning }-----------------+ |
|  | == 메뉴 ==                   | |  <- the realia (text layer inside the dressing)
|  | == 김밥 == ...... == 2,000원 ==| |     each line is a button: tap = hear it
|  | == 떡볶이 == .... == 3,000원 ==| |
|  |#== 라면 == ...... == 3,000원 ==#|  <- after a hit: this line is ringed + check + gloss
|  | == 비빔밥 == .... == 5,000원 ==| |
|  +--{ counter }----------------+ |
|  (Tap a line to hear it.)        |  <- once per step, under the realia
|                                  |
|  (How much is this?)             |  <- question in the UI language (content)
|        ~~ 라면 ~~ (ramyeon)        |  <- the key word as KoreanText, never typed into the sentence
|                                  |
|  +-------------+ +-------------+ |
|  | ~~ 이천 원 ~~ | | ~~ 삼천 원 ~~ | |  <- 2-4 options: Korean, a number or a picture
|  | (icheon won)| | (samcheon..)| |     2 columns for short options, 1 column when long or narrow
|  +-------------+ +-------------+ |
|  +-------------+                 |
|  | ~~ 오천 원 ~~ |                 |
|  +-------------+                 |
|                                  |
|  (Hoya thinking: "Look again")   |  <- only after a miss (live region)
+----------------------------------+
```

Tablet and phone landscape (window class 700 and up: side by side, the realia stays in view while the options change):

```
+--------------------------------------------------------------------+
| (progress bar)                                            (2 / 4)  |
|                                                                    |
|  +--{ awning }--------------------+   (How much is this?)          |
|  | == 메뉴 ==                      |        ~~ 라면 ~~ (ramyeon)      |
|  | == 김밥 == ......... == 2,000원 == |                               |
|  | == 떡볶이 == ....... == 3,000원 == |   +----------+ +----------+    |
|  | == 라면 == ......... == 3,000원 == |   |~~이천 원~~| |~~삼천 원~~|    |
|  | == 비빔밥 == ....... == 5,000원 == |   +----------+ +----------+    |
|  +--{ counter }-------------------+   +----------+                  |
|  (Tap a line to hear it.)             |~~오천 원~~|                  |
|                                       +----------+                  |
|                                       (Hoya line slot)              |
+--------------------------------------------------------------------+
```

The two columns share the width equally up to `layout.maxWidth.full`; the realia column is sticky at the top of the scroll area when the question column is taller. On native (no CSS sticky) the screen does not scroll in this arrangement; each column scrolls on its own, so the realia stays put while the options scroll. A new question starts both columns at the top, and Hoya's line after a miss scrolls into view under the realia. Crossing the side-by-side boundary on native (rotation, Split View) rebuilds the game body: the game's progress is kept, screen-reader focus and scroll position are not (G-2 follow-up 2). Below 700 the layout is the phone column. At 900 and up the gutters widen; nothing else changes.

Question kinds (the answer is a number, a word or a picture, F-CURR-001 §3.6):

```
find a value:   (How much is this?) ~~ 라면 ~~          -> options: ~~ 이천 원 ~~ ~~ 삼천 원 ~~ ~~ 오천 원 ~~
find a thing:   (Which one costs this?) ~~ 오천 원 ~~   -> options: {picture: bibimbap} {picture: gimbap} {picture: noodles}
read a number:  (What time does it leave?) ~~ 출발 ~~   -> options: (3:00) (4:00) (4:30)    <- numbers in the UI's own digits and format
find the way:   (Which way is the summit?) ~~ 정상 ~~   -> options: {arrow left} ~~ 왼쪽 ~~ | {arrow right} ~~ 오른쪽 ~~
count:          (How many apples?) ~~ 사과 ~~            -> options: ~~ 한 개 ~~ ~~ 세 개 ~~ ~~ 다섯 개 ~~
```

One round (the key word plus its options) never mixes Sino-Korean and native numbers (F-CURR-001 §3.6: Sino-Korean for won and minutes, native before a counter; "the games never mix the two in one round"). A count question's key is the thing counted, never a won amount; the realia line it points at may show both (`3개`, `2,000원`), because the realia is the real thing, not the round.

States of one round:

```
asking:   the realia without glosses; the question; 2-4 options in idle
miss:     the tapped option -> amber + "try another" mark, locked; Hoya thinking "(Look again)"; the realia is unchanged
2nd miss: the line of the realia that holds the answer gets a "look here" ring (thick focus ring + a pointer glyph at its start);
          the right option is NOT ringed: the learner still reads the line to answer (with 3 options it confirms the last one);
          the status region announces "Look here: {line}" so a screen-reader user on the options hears it
hit:      the option -> green + check; the answer line on the realia -> "found" (ring + check glyph + its gloss under it);
          the option's Korean is spoken once; next question after 0.7 s; the found mark clears when the next question opens
line tap: any line, any time -> the line is spoken (playPrompt); in `tap` mode its romanization appears and stays for the step
no sound: tapping a line shows its romanization (if hidden) and nothing else; the game never depends on hearing
done:     the last hit -> 0.7 s -> back to the quest
empty:    "(Nothing to play here)" + [ Back to quest ]
```

## Interaction points

- **Option card** (`ChoiceCard`): the first answer in a question is the scored one; a miss never ends the question; the right tap ends it. Only the first touch in a 50 ms window counts (as Listen & Pick).
- **Realia line** (a button in the text layer): plays the line (`playPrompt` of its Korean); reveals its romanization in `tap` mode. It is never an answer: tapping a line does not score and does not select. A line tap during the 0.7 s after a hit is ignored.
- **A line tap is not a hint** (decided): it does not change the first-try tally, which counts only the first option tapped in a question. Hearing a line is supported reading (the learner still has to find the line and match its sound to an option), and it never names the answer in the UI language. G-2 and the S6 content tests use this rule.
- **Question advance**: automatic, 0.7 s after the right tap; after the last question the step is complete.
- **No Skip**: the step is short (4-5 questions) and every question can be answered by reading; the quest player's leave control is the way out (as Listen & Pick).
- **Leave**: the quest player's own leave control (this screen adds none).

## Navigation graph

Enter from: `quest/player` (a `practice` step with a `realia-read` scope) -> `minigame/shell` (push, returns)
Exit: the last question -> back to `quest/player` (step complete) · empty scope -> back to `quest/player`
Related: the Discover `realia` page (`quest/discover-sentences.md`, row D-1) shows the same realia with its key words before this step; the realia is drawn by the same view.

## States

- **success**: as drawn.
- **empty**: a scope with no valid question (or a realia with no lines) shows one line and a Back button.
- **error**: an unknown realia ref or dressing -> the text layer on a plain sheet (paper fill, outline) with the same lines, never blank (the realia still plays, because the text is what is read); an unknown option picture -> the option's gloss as a text option; a question whose answer is not among its options, or whose `answerLineId` is not a line of the realia, is skipped (and caught by the content test).
- **offline**: all content and art are bundled; no Korean voice -> line taps show text only, nothing blocks.
- **reduced motion**: no motion is used; states change instantly.
- **large text / small phone**: the realia's text layer reflows inside the dressing (lines wrap, the price moves under the dish when the row is too narrow, the dressing stretches to the text); the body scrolls; options fall back to one column below 340 dp and for long text; nothing is cut or shrunk below its token size.
- **accessibility**: the realia is a named group with a summary ("Menu, 4 lines"), then its lines in reading order as real text (a menu is a list of dishes with prices; a ticket is a list of label and value pairs; a sign is a list of boards, each with its direction; price cards are a list of cards); each line is a button whose name is its Korean, its romanization (through `a11yRomanization`) and, for a direction, the direction; the found and look-here marks are in the line's name, not only drawn. Then the question, the key word (`KoreanText`), the options. Full tree in the mock README.
- **anti-shame**: amber + Hoya thinking on a miss; a bar that only fills; no red, no timer, no score number; the "n / N" count is the only number.
- **Korean UI**: menus and the question are Korean; the realia's lines are the same Korean (they are content, not UI), still with romanization; the gloss of a found line is the Korean gloss from the lesson overlay, never an echo of the line (F-CURR-001 §3.15 behaviour 9).

## Data needs

- reads: `scopeFor(ref).realiaRead` (row C-1 owns the schema; what this screen needs): `realia` `{ id, kind: 'menu' | 'ticket' | 'sign' | 'price-card', dressingRef, title?: KoText, lines: { id, ko: KoText, value?: KoText, dir?: 'left' | 'right', group?: string }[] (1-8), altEn }` and `questions` (4-5) `{ id, prompt: en (es / ko in the lesson overlay), key?: KoText, options: { id, ko?: KoText, number?: { kind: 'time' | 'count' | 'won', value }, pictureRef? }[] (2-4; 4 when the look-here ring should still make the learner read), answerId, answerLineId }` · a straight-ahead board is not in volume 1; if a cell needs one, C-1 adds `dir: 'ahead'` additively (never `up`) with its own mock state · `romanizationMode` (F-I18N-001; `tap` hides a line's romanization until it is tapped)
- writes: `host.answer('q<k>', correct)` -> `quest-run-store` (first-try tally); `host.complete()` -> `markStepComplete()`
- telemetry: `minigame.finished` `{ kind: 'realia-read', questId, stepIndex }` (existing event; no new event name, F-CURR-001 §3.11); no realia text, answer text or tapped line in any payload

## Open questions

- Station names on the Chuseok ticket (`서울`, `대전` in the mock) are fixture words; S6-3 decides whether the ticket names real cities (allowed: a city is not a company) or the cell's own words (`기차역`, `고향`) and counts them against the 6 new words of rule 4.
- A two-realia step (the station board beside the ticket in Travel for Chuseok)? Recommend one realia per step in volume 1; the second realia goes in the Discover page.
