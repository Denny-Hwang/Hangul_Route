# Lecture mode v2: presets home, preset preview and the new slide families (design mocks v2, LV-0b)

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` (sections 4, 5, 10, 12; PR table row **LV-0b**). Wireframes: `design/wireframes/classroom/lecture-presets.md` (Panels A to E), `design/wireframes/classroom/lecture-big-screen-v2.md` (Panels 1 to 7). Tokens: `design/tokens/presenter.v1.md`. Entry points (homes, nav, learner app): `design/screens/app-shell/lecture-card.md`, `design/screens/lecture-entry/learner-card.md`.
This folder's `README.md` (design mocks v1) still holds: every rule, constant and decision D1 to D19 applies here unchanged unless a decision below says otherwise.

Built by:

- **LV-3** (presenter home and preview): `presets.md` (`mock/presets*.html`, `mock/preset-preview.html`).
- **LV-S1** (reading slides): `slide-sentence.md`, `slide-pattern.md`, `slide-read-along.md`, `slide-realia.md` (the realia page).
- **LV-S2** (question slides): `slide-listen-reply.md`, the realia question in `slide-realia.md`.
- **LV-S3** (sentence building): `slide-sentence-build.md`.
- **LV-S4** (write together): `slide-write-together.md`.

## What is here

| File | Mock pages | Shots |
|---|---|---|
| `presets.md` | `presets.html` (something to follow), `presets-chosen.html` (Hangul week 1 open), `presets-stage.html` (Stage by stage open, Stage 3), `presets-empty.html` (nothing to follow: Next lesson last with its fallback line, empty Recent), `presets-words-fallback.html`, `presets-customize.html`, `preset-preview.html` | `presets-320.png`, `-320-text200`, `-768`, `-1180`; each state at 375 and 1180; `presets-stage-320-text200`; `preset-preview-375`, `-1280`, `-320-text200` |
| `slide-sentence.md` | `slide-sentence.html` | `slide-sentence-1280x720`, `-1920x1080`, `-b0-1280x720` |
| `slide-pattern.md` | `slide-pattern.html` | `slide-pattern-*` |
| `slide-read-along.md` | `slide-read-along.html` (line B playing), `slide-read-along-a.html` (line A playing) | `slide-read-along-*`, `-gray` |
| `slide-realia.md` | `slide-realia.html`, `slide-realia-question.html` | `slide-realia-*`, `slide-realia-question-*` (`-b0` question, default answer, `-gray`) |
| `slide-listen-reply.md` | `slide-quiz-listen.html` (pictures), `slide-quiz-listen-text.html` (no Korean voice), `slide-quiz-reply.html` | `slide-quiz-listen-*`, `-gray`, `slide-quiz-listen-text-*`, `slide-quiz-reply-*` |
| `slide-sentence-build.md` | `slide-build-0.html`, `slide-build-2.html`, `slide-build-4.html` (whole), `slide-build-particle.html` | `slide-build-*` |
| `slide-write-together.md` | `slide-write-type.html`, `slide-write-trace.html`, `slide-write-frame.html`, `slide-write-own-name-0/1/2.html` | `slide-write-*` |
| `mock/presenter-v2.css` | the new rules, loaded after `presenter.css`; tokens and constants of that sheet, plus the constants below | |

Every slide page uses `presenter.js` as before: `#b=<n>` shows builds 0 to n (default: every build), `#gray=1` renders in greyscale. Shots are 128-colour palette PNGs, as in v1. Projected surfaces are shot at **1280 x 720** and **1920 x 1080** (1x); teacher pages at 320 (2x), 375 (2x), 768 (2x), 1180 / 1280 and **320 with the browser text size at 200 %**.

**The mocks are a design reference, not shipped code.**

- **Hoya.** The cheering pose's second raised arm is the scene's mirrored group (`translate(128 0) scale(-1 1)`, `scene-art/hoya.ts` `armsFor`); an earlier dump wrote it as an invalid `<group>` element, which dropped that arm in the quiz, activity, timer and picker mocks (the picker mocks are deleted 2026-10-16). Those mocks and their shots are redrawn in this pass.
- **Content is real.** Every Korean line, romanization, gloss, speaker name, prompt, sheet entry, option, tile, bank word and sound-table block is shipped content read from `content/episodes/` on the LV-0 branch (`d88da098e`): Stage 3 life q1 (sentence, pattern, Check), q3 (order-it r1); Stage 4 life q1 (exchange, tap-respond turn 1); Stage 6 life q1 (realia, type-hangul t3) and q3 (realia-read r1); Stage 7 life q1 (trace-word w1), q2 (order-it r4, write-frame f1) and letters q3 (the free-entry name round). Pictures are `WordArt` (`wordArtModel`) and the menu's awning is `drawProp('prop:realia-awning')`, dumped from the design-system modules with every colour written as its token.
- **The preset preview's numbers are real.** "46 slides" and "3 parts of this lesson are not shown as slides" are what the shipped `expandDeck` gives for the Hangul week 1 deck at 20 minutes (q1 to q3 plus a 4-question quiz, section 4.2 H); the 10-minute deck is 27 slides, the 30-minute one 47. The minutes, "about 19 minutes", are the amended rule 12 (section 4.4, observation O1).
- **Tokens.** No new colour, size or radius: every value in `presenter-v2.css` is a token of `presenter.css`'s first `:root` block in stage units or rem, or a named constant below.
- **Font.** Korean that is not yet in the `HR Presenter KR` subset falls back to the system Korean stack in the mock. The LV-S rows extend the subset (spec section 5.1 "Font") and `presenter-glyphs.test.ts` covers every new slide.

## Constants (new; PRs write them as named constants beside `stage-scale.ts` or the home's style module)

| Name | Value | Derived from |
|---|---|---|
| `--preset-col-2` / `--preset-col-3` | 30rem / 46rem container width | preset cards go two across at 768 and three beside Recent at 1180 (wireframe Panels B and C); a container query cannot read a custom property, so the sheet writes the values in its comment |
| `--side-col` | 18rem | the Recent column from `layout.breakpoint.wide`; leaves 46rem for three preset cards at 1180 |
| `--slot-w` | 160 units | the gap box of a pattern or frame: two Hangul blocks at `presenter.size.title` |
| `--sheet-w` | 420 units | the realia sheet on the stage; leaves 716 units for the question column |
| sheet dressing | `spacing.xl` units (24) | `REALIA_TOP_DRESSING` (40 dp) does not fit 504 units with four entries; the stage draws the same art lower |
| `--pic-md` | 300 units | the picture beside a sentence or a type prompt |
| `--pic-opt` | 112 units | a picture option of a listen quiz: two option rows and the prompt line fit 504 units |
| `--cell-w` | 84 units | one sound-table block: 13 across the 1184-unit content area |
| `--tile-gap` | `spacing.md` units (12) | gaps inside the dense slides (`.tight`): pattern, read along, the question slides, the name round |
| `--trace-stroke` | 6 units | the trace ghost outline (V11): at `presenter.size.glyph` it reads from the back of a room and keeps the counters of ㅁ, ㅇ and ㅎ open |
| tile height | 108 units | a `presenter.size.title` (80) Hangul tile plus `spacing.sm` units above and below and the stage border |
| `SHEET_CARDS_W` (LV-S1) | 600 units | price cards stand side by side: three cards each hold a price such as 오천 원 and its romanization on one line |
| `SHEET_MAX_W` (LV-S1) | 700 units | on a small phone the 18 px floor draws the sheet's romanization bigger than its units, so the sheet grows with it; 436 units stay for the caption and key words |
| `SHEET_ROOMY_LINES` (LV-S1) | 4 lines | a longer sheet (the five-board trail sign) draws each romanization beside its Korean |
| read-along glyph (LV-S1) | `spacing.xxl` units | the speaker glyph of the playing line is one caption line tall, so lighting a line moves nothing (the mock drew 48 units) |
| `PIC_OPT` (LV-S2) | 112 units | `--pic-opt` as built: a picture option's side, smaller with a shorter row, its art never below 48 units |
| `REALIA_ASK_MIN` (LV-S2) | 240 units | a realia question's lead line, then "Hoya's answer" in its place: under the key word when the column leaves less |
| `REALIA_GRID_MIN` (LV-S2) | 480 units | the narrowest column beside a realia sheet that holds picture options in the 2 x 2 grid; a narrower one lists them as rows |
| sentence line places (LV-S3) | the widest tile | every place on a sentence line, empty or placed, is as wide as the slide's widest tile (or its particle tile with both endings) and as tall as a tile (`buildPlaceWidth`): the line never reflows, the fit holds from the bank build and no empty box gives its tile away; the mock's 200-unit box is its empty place |

## Measured on the mocks (Chromium, the script in this pass)

| Check | Target | Mock |
|---|---|---|
| Stage overflow | none at 1280 x 720 and 1920 x 1080 | none on all 48 projected shots (every element inside the 1184 x 504 content box) |
| Smallest stage text | `presenter.size.caption` units, never below 18 | 28 px at 1280 x 720, 42 px at 1920 x 1080 (sound-table blocks and their romanization included) |
| Smallest text on teacher pages | `typography.size.body` (18) | 18 px on every presets page and the preview |
| Sideways scroll | none, including 320 px at 200 % text | none |
| Targets | at least `touchTarget.min` | met on every page (preset cards, chips, Start, Customize, Recent rows) |
| Duplicate ids, console errors | none | none |

## Decisions this pass takes (within the spec; the PRs follow them)

- **V1. Preset cards open in place** (wireframe Panel D): one open card at a time spans the whole grid row with a `borderWidth.thick` `text.primary` outline; its button has `aria-expanded="true"` and `aria-controls` naming the panel (opening one closes the others); the length chips, the stage chips (Stage by stage) and the fallback line sit inside it with **Start** at the end. The card's own button stays one tab stop.
- **V2. Recent beside the presets from 900 px**, below them on narrow screens; **Customize** is a disclosure (`plus` / `dash` glyph, `aria-expanded`) under both, closed by default, opening today's Quick lesson panel unchanged.
- **V3. The fallback line** (`presets.fallback.*`) shows inside the open card on `surface.sunken`, in `text.primary` (13.58:1); it is information, never a warning colour.
- **V4. Preview = start screen.** The start screen of a preset adds **What's in this lesson** (numbered rows: the content title and `about {n} min`) above **Before you start**, and a ghost **Customize** under Start. ~~The picker row is the numbers stepper (LV-D7).~~ No picker row (LV-D7 as rewritten 2026-10-16); the preview is re-shot without it, and with **Back to lessons** and the **Display (Aa)** control in one top row.
- **V5. Kind label on reading and building slides.** Sentence, Sentence pattern, Read along, Build the sentence together and Write together draw their kind label at `presenter.size.caption` top left (the slot the topic label already uses); question slides keep the question as their heading.
- **V6. Read along has no stage speaker button.** The bar's **Sound** (and `S`) plays the current line; the line that plays gets a `spacing.sm`-unit `brand.secondary` border, the `brand.secondaryLight` ground and the speaker glyph beside the speaker's name (shape, not colour alone). The wireframe's on-stage [ Read ] did not fit two turns in 504 units.
- **V7. The realia question** keeps the sheet on the left; the question is the heading of the right column, the key word chip sits under it with "Look closely and find the answer." beside it, and at the reveal "Hoya's answer" takes that line's place, so the options never move. The answer entry on the sheet gets RealiaSheet's `found` look (`feedback.successLight`, a thick `feedback.success` border, the `check` glyph in `feedback.successDark`) only at the answer build.
- **V8. Question options with text** are one row each (marker, Korean, romanization; the gloss joins the same row at the answer build) in one column; picture options keep the 2 x 2 grid. A reply or sentence option that would wrap past the content box drops its Korean to `presenter.size.body`; the PR measures rows, as the End slide does (README D7).
- **V9. Sentence build**: the sentence line above a `surface.sunken` bank; each click moves the next tile from the bank to the line and leaves a dashed ghost in its bank place (nothing reflows); empty line slots are dashed boxes; at the whole build the romanization and the meaning appear and the distractor stays in the bank at `presenter.dimOpacity`, unmarked. The particle tile shows the stem with both endings in dashed boxes; the next click keeps the one that fits.
- **V10. Write together** carries the kind label and the line "Write on paper or on your own device. Nothing is typed here." with the `pencil` glyph on one row at the top of every write slide, then the variant line.
- **V11. Trace ghost**: the open question of the wireframe is decided for the presenter font drawn as an outline (CSS text stroke, `text.secondary`, 6 units, web only) at `presenter.size.glyph`; the variant line and, at the answer build, the romanization and meaning sit to its right.
- **V12. The name round's sound table needs two builds.** The free-entry round's table has 120 blocks in 10 groups; with each block's romanization under it at the 28-unit floor, five groups fill the 504-unit content area. Builds become `[frame, sound table 1 (groups 1-5), sound table 2 (groups 6-10)]`: one more build than section 5.2 lists. This is a builds-only change inside LV-S4 (no new key); the spec's 5.2 row for `own-name` is amended to three builds in this PR, so LV-S4's build-steps test pins three.

## Observations for the implementing rows (not changed here)

- **O1 (LV-2, LV-3) Preview minutes.** The 20-minute Hangul week 1 preset is 19 catalogue minutes (section 4.2 H), but the shipped rule 12 (`deck-builder.ts:410, 718`) gives "about 38 minutes" for the same deck: it adds each quest's catalogue minutes (3 x 5) and then 1 minute for every quiz slide, including the 19 Match Sound rounds the three quests already hold, plus the 4 quiz rounds. Section 4.3 accepts a difference, but a card that says "about 20 min" opening a preview that says "about 38 minutes" reads as a broken promise. Decided for LV-2 (spec section 4.4 amended in this PR): count 1 minute only for quiz slides outside a quest's or story's own slides, so the preview never says more than the card (15 + 4 = 19 here). The mock and its shots show that target number, "about 19 minutes"; the shipped code gives 38 until LV-2 lands.
- **O2 (LV-S4) The frame example's particle.** "For example" fills the gap with the first bank word, but a frame such as `아침에 ___을/를 먹어요.` carries both particles; the example must resolve the one that fits the word (밥 ends in a consonant: 밥을, romanization `babeul`). The builder needs the same final-consonant rule the Sentence Builder's particle rounds already teach.
- **O3 (LV-S2) Long reply options.** The longest shipped replies in Stage 6 ("네, 우유 세 개 주세요.") still fit one row at 1280 x 720; V8's fallback is for future content.

## Strings

### Section 12 keys drawn here (values as section 12; en shown)

`learner.presenter.home.title` (changed) "Lecture mode" · `learner.presenter.presets.title`, `.lead`, `.next.title`, `.next.device`, `.zero.title`, `.zero.short`, `.zero.body`, `.stage.title`, `.stage.body`, `.stage.choose`, `.stage.chip`, `.story.title`, `.story.body`, `.words.title`, `.words.body`, `.warmup.title`, `.warmup.body`, `.length.title`, `.length.option`, `.start.cta`, `.preview.title`, `.customize.cta`, `.customize.lead`, `.fallback.zero`, `.fallback.warmUp` · `learner.presenter.slide.sentence.label`, `.pattern.label`, `.readAlong.label`, `.realia.ask`, `.build.title`, `.build.next`, `.build.particle`, `.write.title`, `.write.where`, `.write.type`, `.write.trace`, `.write.frame`, `.write.example`, `.write.ownName` · `learner.presenter.quiz.listen`, `.quiz.reply` · `a11y.presenter.presetCard`, `a11y.presenter.slot` (the gap box's name), `a11y.presenter.tilePlaced` (announced, not drawn).
Specified by section 12 and not drawn on a mock page: `next.class`, `next.family`, `next.plan` (console only, LV-4), `fallback.restart` (the same slot as the drawn fallback lines), `invalid.reload` (the invalid-link state, `states.md`), `docTitle` (tab title).

### Existing keys reused

`learner.presenter.home.help.cta`, `.home.recent.*`, `.home.quick.*` (Customize opens Quick lesson unchanged; from 2026-10-16 it opens the grouped chooser, `presets.md`), `learner.presenter.home.quick.minutes` ("about {n} min" on cards and preview rows), `learner.presenter.start.*` (back, slides, minutes, checks, the check lines, skipped, seeWhich, ~~picker numbers, fewer, more~~ (removed 2026-10-16), cta), `learner.presenter.bar.*`, `learner.presenter.quiz.playPrompt`, `.quiz.answer`, `learner.presenter.slide.sayIt`, `learner.presenter.bar.noVoice`.

### Gaps found against section 12 (new keys for the rows named; es and ko drafted to F-I18N-001 section 3.10; added to the spec's section 12 tables in this PR, so the rows' i18n tests list them)

| Key | en | es | ko | Row | Note |
|---|---|---|---|---|---|
| `learner.presenter.presets.preview.quiz` (`n`, plural) | Quick quiz: {n} question / Quick quiz: {n} questions | Quiz rápido: {n} pregunta / Quiz rápido: {n} preguntas | 빠른 퀴즈: {n}문제 | LV-3 | a quiz row of the preview; the same values as `console.lecture.outline.block.quiz` |
| `learner.presenter.presets.preview.words` (`n`, plural) | {n} word / {n} words | {n} palabra / {n} palabras | 낱말 {n}개 | LV-3 | the Word review row of the preview |
| `console.lecture.outline.block.words` (`n`, plural) | {n} word / {n} words | {n} palabra / {n} palabras | 낱말 {n}개 | LV-4 | the console outline row of a Word review block (not in `console.ts` today) |
| `learner.presenter.grid.kind.sentence` | Sentence | Oración | 문장 | LV-S1 | the live region and the slide grid name the kind (section 10); the same values as `slide.sentence.label` |
| `learner.presenter.grid.kind.pattern` | Sentence pattern | Patrón de oración | 문장 틀 | LV-S1 | same values as `slide.pattern.label` |
| `learner.presenter.grid.kind.readAlong` | Read along | Leer juntos | 함께 읽기 | LV-S1 | same values as `slide.readAlong.label` |
| `learner.presenter.grid.kind.realia` | Look and read | Mira y lee | 보고 읽기 | LV-S1 | the realia page; its question slide is `grid.kind.quiz` ("Question") |
| `learner.presenter.grid.kind.build` | Build a sentence | Arma una oración | 문장 만들기 | LV-S3 | the same values as `learner.minigame.*.sentenceBuilder` |
| `learner.presenter.grid.kind.write` | Write together | Escribir en grupo | 함께 써요 | LV-S4 | same values as `slide.write.title` |

Length budget: none is a `cta`; Spanish stays within 1.5x English. Banned-word lint: no hit in any locale (learner list).

## Review log (multi-lens review of this pass)

The session that made this pass has no sub-agent tool, so the lenses ran as separate passes against the shots and the measurement script, as the v1 pass did; every finding was applied. The PR's own multi-agent review follows.

| Lens | Finding | Outcome |
|---|---|---|
| Design (fit) | pattern, read along, realia, both question slides, the frame and the name round overflowed 504 units at 1280 x 720 (up to 145 units) | V5 to V12: tight gaps, one-row options, the sheet at 420 units, the key-row swap, two table builds; zero overflow on all 48 projected shots |
| Design | the read-along speaker button covered the slide counter | V6 |
| Design | at 1180 the preset grid stayed two across beside a 20rem Recent column | `--side-col` 18rem; three across at 1180, two at 768, one at 320 |
| Legibility | the key-word chip's romanization fell to 18 px (no stage size) | stage caption size; nothing on the stage below 28 units |
| Legibility | the preview's "Lecture mode" line was 16 px (copied from the v1 start page) | `typography.size.body` |
| Accessibility | the answer entry's check showed before the reveal | the glyph is part of the answer build |
| Accessibility | greyscale | the revealed option keeps the thicker border and the check; the playing line keeps its thicker border and speaker glyph; the found entry its check (`-gray` shots) |
| Anti-shame | distractor tiles, dimmed options | set back at `presenter.dimOpacity`, never red, never crossed, no count of hands |
| Speaking | listen quiz without a voice | the teacher reads the prompt (the shipped "Say it:" fallback); no slide asks the room to speak or records anything; presets use only `air-write`, `copy-on-paper`, `stretch-break` |
| Privacy | the name round | shows the frame and the sound table, never a name; Recent and the presets home hold deck titles only |
| Copy (owner rules) | age words, emoji | none |
| Spanish | register, glossary | tú, "Arma" (Latin-American), Etapa for Stage, quiz kept as in the console |
| Korean | register, particles | 해요체; "낱말 {n}개" puts the count after the noun, no particle on a variable |
