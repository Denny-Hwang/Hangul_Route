# Realia Read: the game screen and the four realia (design mocks v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md`, row **D-2** ("`minigame/realia-read.md`, mocks of the four realia (menu, ticket, trail sign, price card)"), sections 3.6 (Stage 6 Practice), 3.10 (`realia` Discover item, `realia-read` kind), 3.14 (accessibility), OD-11 (money). This is the agent design pass that row **G-2** (the game and the realia scene art) builds from (CLAUDE.md section 5: wireframe, then mock, then component; owner decision 2026-10-12: agent mocks approved by the multi-agent review).
Wireframe: `design/wireframes/minigame/realia-read.md` (scenario, states, interaction points, data needs).
Reused, not redrawn: the token block and base of the app-shell pass (`design/screens/app-shell/mock/app-shell.css`, imported unchanged); `ChoiceCard` (`design/components/ChoiceCard/spec.md`) and `KoreanText` size `sm` (`design/components/KoreanText/spec.md`) as specified there; Hoya's `thinking` pose with the geometry of `packages/design-system/src/scene-art/hoya.ts`; the scene-art rules of `design/brief/illustrations/scene-art-style.md` for every drawn part.

**Nothing here changes code, a string, a flag or content.** The mock is a design reference, not shipped code.

## What is here

| File | What it fixes |
|---|---|
| `mock/realia-read.css` | one stylesheet: the screen, the realia (dressing + text layer), the option cards, the boards |
| `mock/game.html` | the game screen, menu, question 1 of 4, asking (phone column; side by side from window class 700) |
| `mock/game-sign.html` | the game screen, trail sign, question 2 of 4, the right answer found (option green, the board ringed with its gloss) |
| `mock/realia.html` | board: the four realia, each with its accessibility note |
| `mock/states.html` | board: S1 asking, S2 miss, S3 second miss (look here), S4 hit (found), S5 picture options, S6 number options (ticket), S7 count (price cards), S8 romanization `tap`, S9 Korean UI, S10 Spanish UI, S11 unknown dressing (plain sheet), S12 empty |
| `shots/` | the mocks rendered in Chromium (list below) |

Open any file in a browser. Line taps in S8 reveal romanization through a few lines of script.

## Design decisions

**D1. A realia is a drawn sheet with real text, not a picture of text.** The dressing (frame, awning, ticket stub, post and boards, goods and pegs) is scene art: flat shapes, token colours, no text, no logo. Every word is a live text element inside it. This keeps the scene-art rule "no text in the image" (style guide section 3.7), puts every word in the accessibility tree (spec section 3.14), lets the text grow with the text size (see `game-320-text200.png`: the price drops under the dish, nothing is cut), and lets `romanizationMode` hide or show the romanization like everywhere else.

**D2. The realia text is not drawn as `KoreanText` chips.** A menu of blue chips would not read as a menu. Realia lines use the realia's own type (Hangul `bodyLg` bold, romanization `caption` italic in `text.secondary`, on the sheet's paper). The question's key word and the Korean options do use `KoreanText`, so "a chip = what I am asked about" still holds.

**D3. No gloss on the realia while a question is open.** A gloss beside 라면 would answer "Which one is instant noodles?". The found line shows its gloss after a right answer (S4). The Discover realia page (row D-1) shows the key words with their glosses before this step.

**D4. Second miss rings the line, not the option.** The look-here ring (dashed `border.focus`, thick, plus a pointer glyph) goes on the line of the realia that holds the answer, so the learner still reads to answer (S3). Pic-Word Match rings the partner tile; here the reading is the point.

**D5. Found = three cues.** Success fill and ring, a check glyph, and the gloss line; the line's accessible name gains "Found here". The option card's states are `ChoiceCard`'s own.

**D6. Directions never by colour or side alone.** A trail board points with its side (the board sits left or right of the post), an arrow glyph in its own cell, and its accessible name ("to the right"). Options for a direction pair the arrow with its Korean word (`왼쪽`, `오른쪽`).

**D7. Side by side from window class 700.** On a tablet or a phone in landscape the realia stays in view (sticky) beside the question and options, so the learner never scrolls between the text and the answers. The mock switches with a container query so the board frames behave like windows of their own width; the app uses its window class (F-LAYOUT-001).

**D8. Money (OD-11).** Prices are round practice amounts in won, multiples of 1,000 up to 10,000, written the way Korean menus write them (`3,000원`) with the romanization of how they are read (`samcheon won`). No shop name (the board's title is 메뉴, "menu"), no brand, no logo, no product price, no fare on the ticket, no company and no train number. The train on the ticket band is a generic drawn train.

## Drawn parts (scene-art budget)

Every dressing is a registry prop for G-2 (`packages/design-system/src/scene-art/props/realia.ts`), checked by `checkItem`. Counts are from the mock's SVG.

| Prop (proposed id) | Realia | Shapes | Colours (token paths) |
|---|---|---|---|
| `prop:realia-awning` | menu | 9 | `text.secondary`, `theme.life`, `surface.paper`, `border.shape` |
| `prop:realia-counter` | menu | 4 | `text.secondary`, `theme.life`, `border.shape` |
| `prop:realia-train-band` | ticket | 11 | `text.secondary`, `brand.secondary`, `border.shape`, `surface.paper` (band fill `brand.secondaryLight`) |
| `prop:realia-ticket-stub` | ticket | 2 | `surface.canvas`, `border.strong` |
| `prop:realia-mountains` | trail sign | 2 | `theme.nature`, `border.shape`, `surface.paper` |
| `prop:realia-post-foot` | trail sign | 4 | `text.secondary`, `theme.nature`, `surface.sunken`, `border.shape` |
| `prop:realia-goods-apples` | price cards | 6 | `text.secondary`, `border.shape`, `surface.sunken`, `theme.letters`, `theme.nature` |
| `prop:realia-goods-fan` | price cards | 4 | `theme.crafts`, `border.shape`, `surface.paper`, `text.secondary` |
| `prop:realia-goods-hanji` | price cards | 4 | `brand.primaryLight`, `feedback.nudgeLight`, `surface.paper`, `border.shape`, `border.strong` |
| option pictures `gimbap`, `bibimbap`, `ramyeon` | S5 | 5-10 each | at most 5 each; no `brand.primary`, no `feedback.danger` |

The sheets, boards, plate and cards are layout boxes in tokens (`surface.paper` or `feedback.nudgeLight`, outline `border.shape` or `text.secondary`, `borderWidth.base`, `radii.sm` / `radii.md`), because they must grow with the text. The trail board fill is the shipped `prop:signpost`'s `feedback.nudgeLight`. The folding fan is a generic shape (no painted motif); the apple basket and paper stack are generic goods: no heritage artefact here needs a `sourceRef`.

## Tokens

Every value in `mock/realia-read.css` is a token of `packages/design-system/src/tokens.ts`, through the app-shell custom properties plus the ones this pass adds the same way (`feedback.nudge`, `feedback.successDark`, `hoya.nose`, `theme.*`, `stage.stage6`, `typography.size.hero`, `layout.pane.gap`), checked against `tokens.ts` on this commit. No colour literal outside the token block. No new token is needed (spec section 6, "Tokens and assets").

Contrast: realia Hangul is `text.primary` on `surface.paper` or `feedback.nudgeLight`; romanization `text.secondary` on the same (both pairs are already pinned by `contrast.test.ts` for paper; G-2 adds `text.secondary` on `feedback.nudgeLight` to that test). The found ring `feedback.success` and look-here ring `border.focus` are non-text marks against paper (at least 3:1), always beside a glyph.

## Constants

Values that are not tokens; G-2 writes them as named constants, never as bare literals.

| Where | Value | Derived from |
|---|---|---|
| Top dressing height | 40 | `spacing.xxxl` less `spacing.sm`: keeps the question on the first 320 x 568 screen with the menu above it (`game-320-first.png`) |
| Bottom dressing height | 32 | `spacing.xxl` |
| Goods above a price card | 56 | `touchTarget.min` less `spacing.sm` |
| Look-here pointer, found check | 24 | `spacing.xl`, the Icon row size |
| Option picture | 96 | `touchTarget.hero` (ChoiceCard art) |
| Trail board width | 88 % of the sign | leaves the post visible on the other side, so the board's side reads as its direction |
| Ticket label column | 4.5 rem | the widest label (`출발`, `도착`) at `bodyLg` plus `spacing.sm`; grows with the text |
| Price card minimum width | 8.5 rem | `5,000원` at `bodyLg` plus the card padding; below it the cards stack |

## Accessibility tree (G-2 builds exactly this)

Order: progress, the realia, the line hint, the question, the key word, the options, the Hoya live region. Same order in the side-by-side layout.

```
progressbar "Progress" value 0 of 4            (the count "1 / 4" is its visible text)
group "Menu, 4 lines"                          (a11y.minigame.realia.summary(kind, n); the dressing is hidden)
  text "메뉴, menyu"                            (title, lang ko)
  list
    listitem > button "김밥, g i m b a p, 2,000원, icheon won"       hint "Tap to hear it"
    listitem > button "떡볶이, t t e o k b o k k i, 3,000원, samcheon won"
    listitem > button "라면, r a m y e o n, 3,000원, samcheon won"   (+ ". Look here" on the second miss;
                                                                     + ". instant noodles, 3,000 won. Found here" after the hit)
    listitem > button "비빔밥, b i b i m b a p, 5,000원, ocheon won"
text "Tap a line to hear it."
heading "How much is this?"                    (content, from the cell file / lesson overlay)
text "Korean: 라면, r a m y e o n"              (KoreanText, a11y.koreanItem)
button "Korean: 이천 원, icheon won"            (ChoiceCard; with the shipped a11y.minigame.option names when answered)
button "Korean: 삼천 원, samcheon won"
button "Korean: 오천 원, ocheon won"
status (polite) "Look again"                   (only after a miss)
```

- **Ticket**: group "Train ticket, 2 lines" > list > button "출발, chulbal: 서울, seoul, 3:00, se si" and "도착, ...: 대전, ..., 4:30, ne si samsip bun".
- **Trail sign**: group "Trail sign, 3 lines" > text "산길, sangil" > list > button "정상, jeongsang, 1시간, han sigan, to the right", "입구, ipgu, to the left", "출구, chulgu, to the left". The arrow cell is hidden (its meaning is in the name).
- **Price cards**: group "Price cards, 3 lines" > list > button "사과, sagwa, 3개, se gae, 2,000원, icheon won", "부채, ...", "한지, ...". The goods drawings are hidden; the card text names them.
- Romanization in a name is spaced per letter (`a11yRomanization`), as `KoreanText` does, so a screen reader spells it instead of guessing an English word. In `tap` mode the name keeps the romanization (the setting hides a visual line, not information).
- Picture options have their UI-language label as the accessible name. Number options are read by the formatter of the UI locale.
- Every line button and option is at least `touchTarget.min` tall; lines are full-width rows, so two lines never share a touch target.

## Strings for G-2 (en, es, ko)

The mocks draw these; G-2 adds them to `packages/i18n` with the es and ko values in the same PR (coverage ratchets). Drafted to the F-I18N-001 section 3.10 style guide (Pre-A1 English, neutral Latin-American Spanish with "tú", Korean 해요체, no particle on a variable, 낱말 for a learning word). Question texts are **content** (the cell file `en`, the lesson overlays `es` / `ko`), written by rows S6-1 to S6-5, not UI strings.

| Key (proposed) | en | es | ko |
|---|---|---|---|
| `learner.minigame.realia.lineHint` | Tap a line to hear it. | Toca una línea para escucharla. | 줄을 누르면 소리를 들을 수 있어요. |
| `learner.minigame.realia.missHoya` | Look again | Mira otra vez | 다시 살펴봐요 |
| `learner.minigame.realia.empty` | Nothing to play here | Aquí no hay nada para jugar | 여기에는 할 게임이 없어요 |
| `a11y.minigame.realia.summary(kind, n)` | `${kind}, ${count(n, 'line', 'lines')}` | `${kind}, ${n} línea` / `líneas` (plural) | `${kind}, ${n}줄` |
| `a11y.minigame.realia.kind.menu` | Menu | Menú | 메뉴판 |
| `a11y.minigame.realia.kind.ticket` | Train ticket | Boleto de tren | 기차표 |
| `a11y.minigame.realia.kind.sign` | Trail sign | Letrero del sendero | 산길 표지판 |
| `a11y.minigame.realia.kind.priceCards` | Price cards | Etiquetas de precio | 가격표 |
| `a11y.minigame.realia.lineHint` | Tap to hear it | Toca para escucharla | 누르면 들려요 |
| `a11y.minigame.realia.found` | Found here | Está aquí | 여기 있어요 |
| `a11y.minigame.realia.lookHere` | Look here | Mira aquí | 여기를 봐요 |
| `a11y.minigame.realia.dir.left` | to the left | hacia la izquierda | 왼쪽으로 |
| `a11y.minigame.realia.dir.right` | to the right | hacia la derecha | 오른쪽으로 |
| `a11y.minigame.realia.dir.up` | straight ahead | hacia adelante | 앞으로 |

Reused, not new: `learner.minigame.backToQuest` (the empty state), `a11y.koreanItem` (the key word and Korean options), the answer-card state names of Listen & Pick (`a11y.minigame.option.correct` / `.wrong`: "Right answer: ...", "Not this one: ..."; the mock abbreviates them as ". Right" / ". Try another"), the shell's progress label. The ko `a11y.minigame.realia.kind.*` values are UI words in the Korean UI; the realia's own lines stay content (in every locale they are the same Korean).

## Notes for C-1, G-2 and the S6 rows

- **C-1** (schema): the screen reads the shape in the wireframe's Data needs: realia `kind`, `dressingRef`, an optional title, 1-8 lines `{ id, ko, value?, dir?, group? }`; 4-5 questions with 2-4 options and both `answerId` and `answerLineId`. The content test checks that `answerLineId` is a line of the realia and that one question's options use one number system.
- **G-2**: `RealiaSheet` renders one realia by `kind` (four layouts: menu rows with a leader, ticket label/place/time rows with a stub, sign plate and pointed boards, price-card grid); an unknown `dressingRef` falls back to the plain sheet (S11). The found and look-here states are props of the sheet, driven by the round. The Discover realia page (D-1) reuses the same `RealiaSheet` with glosses shown.
- **G-2 Playwright**: one spec at 320 and at 1024 x 768: the realia lines are buttons with the names above, a miss shows the amber card and "Look again", the second miss rings the answer line, a hit shows the found line with its gloss, and no telemetry payload contains realia text.
- **S6 rows**: the mock words are fixtures (spec section 3.6). The menu title `메뉴`, the ticket stations `서울` / `대전` and the counter forms (`3개`, `1시간`) count against each cell's new-word budget (rule 4) unless taught earlier; the wireframe lists the open choice for the ticket.

## Shots

Rendered in Chromium from `mock/` (pages at 2x for 320 and 375, 1x for tablet and boards; `-text200` is the browser text size at 200 %, which models the native text size: the text grows, the layout width stays). No page scrolls sideways at any of these sizes (checked in the render script).

| File | Size | Shows |
|---|---|---|
| `game-320.png`, `game-375.png` | full page | the menu round, asking; one option column at 320 (below 340), two at 375 |
| `game-320-first.png` | 320 x 568, first screen | the realia and the question on the first screen |
| `game-320-text200.png` | 320, text 200 % | the menu reflows (prices under dishes), nothing is cut |
| `game-768x1024.png` | tablet portrait | side by side (window class 700) |
| `game-1024x768.png` | tablet landscape | side by side, realia sticky |
| `game-sign-375.png`, `game-sign-1024x768.png`, `game-sign-320-text200.png` | | the trail sign with the summit board found, the right option green, the other disabled |
| `realia-375.png`, `realia-1280.png`, `realia-320-text200.png` | board | the four realia with their accessibility notes |
| `states-375.png`, `states-1280.png` | board | S1 to S12 |

## Review checklist (scene-art and the owner rules)

- No text, logo, brand, shop name, real product price or photograph in any drawing; every word is live text.
- Prices are round practice amounts in won inside the drawn sheet only (OD-11).
- Anti-shame: amber + Hoya thinking on a miss, no red, no timer, a bar that only fills.
- No speaking: line taps play audio for listening; nothing records or asks the learner to say anything.
- Any age: no age wording; the same screen for every learner.
- Tokens only; 320 px to tablet landscape; the accessibility tree above.
