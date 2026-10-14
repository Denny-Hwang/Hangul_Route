# Sentence Builder and the sentence Discover pages (design mock v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md`, PR **D-1** in the section 6 table. The mock draws sections 3.4 (Stage 3 practice, the pattern page), 3.5 (the exchange page and Read Along's audio-synced line highlight), 3.6 (the realia page), 3.7 (Stage 7 Build and Check), 3.10 (the four Discover item types), 3.14 (accessibility, audio, layout) and 3.15 behaviour 3.
Wireframes: `design/wireframes/minigame/sentence-builder.md` (A to F) and `design/wireframes/quest/discover-sentences.md` (S1 to S4). This pass is an agent design pass (owner decision 2026-10-12, CLAUDE.md section 5), reviewed by the multi-agent review.
Built by:
- C-1: the `order-it` round schema and the four Discover item types (the shapes in each wireframe's "Data needs").
- G-1: the Sentence Builder game, its strings, the `order-it` skills change.
- S3-1: the first `sentence` and `pattern` pages (the item components in `DiscoverStep`).
- S4-1: the `exchange` page and Read along.
- G-2 / S6-1: the `realia` page (the drawing itself is D-2's).

Audience: any learner, any age. Tone: calm, warm, proud of small wins; nothing childish, nothing exam-like.

## What is here

| File | What it fixes |
|---|---|
| `mock/sentence-builder.html` | the game at one moment: one tile placed, a wrong tile slid back and marked tried, Hoya's thinking bubble |
| `mock/sentence-builder-states.html` | board: A start, B miss, the verb-last hint, the second-miss ring, C particle round (start, miss with the Discover note, right with the joined word), D round complete, E Stage 7 Check, sound off, empty |
| `mock/sentence-builder-check.html` | the Stage 7 Check round alone (dots, Quick check, no Skip) |
| `mock/discover-exchange.html` | the exchange page with Read along playing line 1 |
| `mock/discover-pattern.html` | the pattern page (frame, note, two examples) |
| `mock/discover-realia.html` | the realia page (drawing placeholder, key words) |
| `mock/discover-pages.html` | board: S1 sentence page, S2 pattern page, S3a exchange at rest, S3b line 1 and line 2 playing, S3b sound off, S3c casual line with the page caption, S4 realia page |
| `mock/sentence-builder.css` | one stylesheet on the app-shell mock's token block |
| `shots/` | the mock rendered in Chromium at 2x (file names give the page and the viewport width; `-text200` = the browser text size at 200 %) |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/sentence-builder.css` is a token of `packages/design-system/src/tokens.ts`, copied once into a custom property named after it (`--spacing-xl` is `spacing.xl`). The base block comes from `design/screens/app-shell/mock/app-shell.css`; this stylesheet adds `colors.feedback.nudge`, `colors.feedback.successDark`, `colors.hoya.nose` and `radii.xl`.
- **Looks reused from shipped components**: a tile's idle, right and tried looks are `Tile`'s idle, correct and wrong states (paper / `successLight` + `success` / `nudgeLight` + `nudge`); Hoya's bubble is `HoyaBubble` tone `thinking` (`nudgeLight` fill, `nudge` edge); the meaning card and Discover items are `Card`; buttons are `Button` (secondary for Hear it and Read along, primary for Continue, quiet for Skip); the progress bar is `Progress`. G-1 builds no new component look.
- **Drawn parts.** Hoya is a static port of `Hoya.tsx` (poses `idle` and `thinking`). Glyphs are `Icon/glyphs.ts` (`speaker`, `speaker-off`, `play`, `check`, `close`, `dash`, `profile`). The pictures (a rice bowl, a book) are **stand-ins** for `card:rice` and `card:book` (`HeritageCardArt`). The realia drawing is a labelled placeholder: D-2 draws it.
- **Korean content** is sample content from the spec's tables (sections 3.4, 3.5, 3.6, 3.7), with the spec's romanization. The cell rows author and review the real content.
- **Words.** Every UI string is either a dictionary value that exists today (`learner.quest.discover`, `learner.minigame`, `learner.audio`) or a draft in "Strings" below.
- **Annotations.** Monospace labels and dashed board frames are design-board notes, not UI.

Open any file in a browser (`design/screens/minigame-sentence-builder/v1/mock/sentence-builder.html`).

## Constants

Values that are not tokens. Each one derives from a token or from code; G-1 and the Discover rows write the UI ones as named constants, never as bare literals (CLAUDE.md section 4).

| Where | Value | Derived from |
|---|---|---|
| Hoya beside a bubble or the Discover Hoya line | 64 | `touchTarget.min` (DiscoverStep draws Hoya at `touchTarget.min`) |
| Speaker portrait | 40 | `spacing.xxl + spacing.sm`; it sits inside the 64 px speaker row and is never a target |
| Meaning-card picture | 96 | `touchTarget.hero`, the size of DiscoverStep's `PictureArt` |
| Narrowest slot and tile | 80 wide, 80 tall | `touchTarget.child`: a one-syllable word plus padding; every tile stays at least `touchTarget.min` in both directions |
| Attached (particle) slot overlap | -2 | `-borderWidth.base`: the particle slot shares its border with the word before it |
| Read along / Stop button width | 128 min | `2 x touchTarget.min`, so the button does not jump when its label changes |
| App breakpoints | 600, 900 | `layout.breakpoint` (written in px in media queries; the app's classes follow the window in dp) |
| Font stack | the system stack | `typography.family.sans` is `'System'` (as in the app-shell mock) |

Motion (for G-1 and the Discover rows; the mock is static): a tile slides in `motion.duration.base` with `easing.standard`; a wrong tile waits `motion.duration.fast` in the slot before it slides back; Read along pauses `motion.duration.slow` between two lines; the round-complete fallback without sound waits `motion.duration.crawl`. Reduced motion: no slide, no pulse, the highlight changes at once.

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `shots/sentence-builder-320.png` | 320, full page | Stage 3 practice, round 2 of 5: meaning card, one placed tile, the next slot outlined, a tried tile, Hoya thinking, Skip |
| `shots/sentence-builder-320-text200.png` | 320, text 200 % | the same, every line enlarged; tiles wrap; no sideways scroll |
| `shots/sentence-builder-768.png`, `-1024.png` | tablet portrait and landscape | stacked in the reading column; the meaning card in one row |
| `shots/sentence-builder-check-320.png` | 320 | the Stage 7 Check round: two dots, Quick check, three slots on one width, no Skip |
| `shots/sentence-builder-states-375.png`, `-1280.png` | board | every state of the game (A to E, sound off, empty) |
| `shots/discover-exchange-320.png`, `-320-text200.png`, `-1024.png` | 320, 200 % text, tablet | Read along playing line 1: Stop, the lit line with its start border, tint, glyph and "Reading now"; line 2 at full contrast |
| `shots/discover-pattern-320.png`, `-1024.png` | 320, tablet | the pattern page: frame with dashed slots, its romanization and meaning, the note with Korean chips, two examples with solid slot boxes; side by side on tablet |
| `shots/discover-realia-320.png`, `-1024.png` | 320, tablet | the realia page: drawing placeholder and four key words; side by side on tablet |
| `shots/discover-pages-375.png`, `-1280.png` | board | S1 to S4 with the Read along states |

## Measured on the mock (Chromium)

| Check | Target | Mock |
|---|---|---|
| Sideways scroll | none at 320, 768, 1024 and 1280, and at 320 with 200 % text (§3.14) | none on any of the 16 shots (`scrollWidth` equals the viewport) |
| Tile and button targets | at least `touchTarget.min` (64) | tiles 80 x 80 minimum; Hear it, Read along, Stop, Skip and each line's speaker 64 tall; Continue 80 |
| Korean wraps | at spaces only (§3.14) | `word-break: keep-all` on every `lang="ko"` node; one tile is one unbreakable word |
| Colour never the only cue | §3.14, CLAUDE.md anti-shame | placed: success fill + check glyph; tried: amber + `dash` glyph; ring: focus outline; lit line: thick start border + tint + play glyph + "Reading now"; pattern slot: dashed (frame) vs solid (example), ending underlined |
| No red on a miss | anti-shame | the miss uses `nudge` / `nudgeLight` and Hoya `thinking` only; `feedback.danger` appears nowhere |
| Text contrast on the lit line | 4.5:1 | `text.primary` on `brand.secondaryLight` |

## Decisions taken in this design pass

- **Sentence Builder answers each tap; no Done button** (wireframe Decision 1): a slip of the finger is a retry, the round scores on its first real miss, and §3.15 behaviour 3 ("the tile slides back") already reads this way.
- **A placed tile stays placed**, and a tried tile stays tappable (it may be right for a later slot).
- **The verb-last hint is the game's one built-in grammar hint**; a particle miss shows the quest's own Discover note again.
- **The sentence's romanization appears only when the round is done**, so building stays reading Korean, not matching Latin letters.
- **No "Read it here" text fallback in Sentence Builder**: it would show the answer; the meaning card carries the round without sound.
- **Stacked at every width** for the game; side by side for the pattern, realia and sentence Discover pages on tablet; the exchange stays one column.
- **Read along = line highlight**, started by the learner, one button per exchange item, no highlight without sound (wireframe S3b).

## Strings (drafts for G-1 and the Discover rows)

New keys only; existing keys are reused as named. Spanish follows the F-I18N-001 section 3.10 style guide (neutral international Spanish, informal tu, no gender-agreeing adjectives); Korean is 해요체, no particle after a variable, the glossary's 낱말 for a word being learned. Taught Korean is never typed into a string: `{word}` and `{speaker}` are content passed in and drawn by `KoreanText`. The rows that ship each screen add these to `messages/{en,es,ko}/learner.ts` in the same PR (es and ko coverage ratchets).

`learner.minigame.sentenceBuilder` (G-1):

| Key | en | es | ko |
|---|---|---|---|
| `heading` | Build the sentence | Arma la oración | 문장을 만들어 봐요 |
| `instruction` | Tap the words in order. | Toca las palabras en orden. | 낱말을 순서대로 눌러요. |
| `particleInstruction` | Tap the piece that fits. | Toca la parte que encaja. | 알맞은 조각을 눌러요. |
| `meaning` | Meaning | Significado | 뜻 |
| `miss` | Not that one yet. Try another word. | Esa todavía no. Prueba otra palabra. | 그건 아직 아니에요. 다른 낱말을 골라 봐요. |
| `missLastWord` | In Korean, the doing or describing word comes last. | En coreano, la palabra que dice qué pasa o cómo es algo va al final. | 한국어에서는 동작이나 모습을 말하는 낱말이 맨 끝에 와요. |
| `missParticle` | Look at how the word before it ends. | Mira cómo termina la palabra de antes. | 앞 낱말이 어떻게 끝나는지 봐요. |
| `lookHere` | This one comes next. | Esta va ahora. | 다음은 이 낱말이에요. |
| `built` | You built the sentence! | ¡Armaste la oración! | 문장을 만들었어요! |
| `empty` | Nothing to play here | No hay nada para jugar aquí | 여기에는 할 게임이 없어요 |
| `a11y.slotEmpty(n, total)` | Place {n} of {total}, empty | Lugar {n} de {total}, vacío | {total}칸 중 {n}번째 칸, 비어 있어요 |
| `a11y.slotFilled(n, total, word)` | Place {n} of {total}: {word} | Lugar {n} de {total}: {word} | {total}칸 중 {n}번째 칸: {word} |
| `a11y.slotAttached(n, total)` | Place {n} of {total}, joins the word before it, empty | Lugar {n} de {total}, se une a la palabra de antes, vacío | {total}칸 중 {n}번째 칸, 앞 낱말에 붙어요, 비어 있어요 |
| `a11y.tried(word)` | {word}, tried | {word}, ya probada | {word}, 이미 골라 봤어요 |

Reused unchanged: `learner.minigame.progress.pill`, `learner.minigame.skip`, `learner.minigame.backToQuest`, `learner.minigame.listenPick.checkTitle` (the Check pill), `learner.audio.hearIt`, `learner.audio.soundIsOff` and `learner.audio.action.turn_on` (the `PromptPanel` status line).

`learner.quest.discover` (S3-1 adds the pattern keys, S4-1 the exchange keys, G-2 or S6-1 the realia key):

| Key | en | es | ko |
|---|---|---|---|
| `pattern.label` | Sentence pattern | Modelo de oración | 문장 틀 |
| `pattern.examples` | Examples | Ejemplos | 예문 |
| `pattern.slot` (a11y) | a word goes here | aquí va una palabra | 여기에 낱말이 들어가요 |
| `exchange.readAlong` | Read along | Leer juntos | 함께 읽기 |
| `exchange.stop` | Stop | Parar | 멈추기 |
| `exchange.readingNow` | Reading now | Leyendo ahora | 지금 읽는 중 |
| `exchange.lineLabel(line, total, speaker)` (a11y) | Line {line} of {total}, {speaker} | Línea {line} de {total}, {speaker} | {total}줄 중 {line}번째 줄, {speaker} |
| `realia.keyWords` | Words on it | Palabras que aparecen | 여기 나온 낱말 |

Reused unchanged: `hearIt`, `showHowToSay`, `continue`, `pageLabel`, `heard`, `empty`.

Content strings (not dictionary keys; each cell's overlay carries their es and ko): the meaning gloss of each round, the pattern frame's meaning and `noteEn`, speaker names and roles, page captions, realia alt text, Hoya lines.

## Not in this pass

- The realia drawings (D-2), the keyboard and the trace and frame games (D-3).
- Word-by-word highlight for Read along, a register badge on casual lines and cast portraits beyond Hoya: open questions in `discover-sentences.md`.
