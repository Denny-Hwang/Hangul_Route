# Lecture presenter: home, start screen, stage and control bar, every slide kind, overlays and states (design mocks v1)

Spec: `docs/specs/F-TCH-004-lecture-mode.md` (sections 3.1 to 3.13; PR table rows 6 to 12). F-BROWSE-001 BR-13 for `present-this.md`.
Wireframe: `design/wireframes/classroom/lecture-presenter.md` (screens A to L). Tokens: `design/tokens/presenter.v1.md` (PR 2, #238). Font: `HR Presenter KR` (PR 3, #466). Layout: F-LAYOUT-001 PR 2a (#174, uncapped `#root`, manifest `any`).
Section 6 says "a UI PR waits for its mock"; this folder is that mock. It is a design pass, not a row of the PR table.

Built by:

- **PR 6** (presenter shell): `start-screen.md`, `stage-and-bar.md`, `slide-title.md`, `slide-letter.md`, `slide-end.md`, `states.md`, and the Exit confirm in `overlays.md`.
- **PR 7** (slides): `slide-syllable.md`, `slide-vocab.md`, `slide-sequence.md`, `slide-card.md`, `slide-activity.md`.
- **PR 8** (presenter home): `home.md`.
- **PR 9** (quiz, overlays, voice fallbacks): `slide-quiz.md`, `overlays.md`, the status chips in `stage-and-bar.md`, the no-voice letter in `slide-letter.md`.
- **PR 11** (stories): `slide-story.md`.
- **PR 12** (vocabulary topics): `slide-topic.md`.
- **F-BROWSE-001 BR-13** ([ Present this ] on the item page): `present-this.md`.
- PR 10 (the console setup page) is merged; wireframe K stays its reference and nothing is redrawn here.

## What is here

| File | What it fixes |
|---|---|
| `home.md` | PR 8: Recent lessons, Quick lesson groups, the language chips, Keys and help, empty and storage-off states, phone and wide layouts |
| `start-screen.md` | PR 6: deck facts, the device checks, skipped parts and their list, the picker row in each hand-off case, the font wait, Start |
| `stage-and-bar.md` | PR 6 and PR 9: the stage box and unit, the docked bar band, the nine controls, status chips, auto-hide, the counter, focus and the live region |
| `slide-title.md`, `slide-letter.md`, `slide-end.md` | PR 6: the three slides of the shell |
| `slide-syllable.md`, `slide-vocab.md`, `slide-sequence.md`, `slide-card.md`, `slide-activity.md` | PR 7 |
| `slide-quiz.md` | PR 9: Match Sound (voice and text), word to meaning, odd one out, story checks; markers and the reveal |
| `overlays.md` | PR 9 (and PR 6 for Exit): timer corner, full and done; picker ready, drawn, numbers, empty; blank; pause; grid; help; exit |
| `slide-story.md`, `slide-topic.md` | PR 11 and PR 12 |
| `states.md` | PR 6: invalid link, loading, too small, portrait |
| `present-this.md` | BR-13 |
| `mock/presenter.css`, `mock/presenter.js` | one sheet for every page (the tokens block, the constants block, the rules) and a ten-line helper: `#b=<n>` shows builds 0 to n, `#v=<name>` picks a variant, `#bar=hidden` fades the bar, `#gray=1` renders in greyscale |
| `mock/*.html` | one page per screen or state (50 pages); `builds-board.html` shows every build of each slide kind side by side |
| `shots/` | the pages in Chromium as 128-colour palette PNGs. Projected surfaces at **1280 x 720** and **1920 x 1080** (1x; a projector shows the window as is), plus 1024 x 768 (4:3), 2560 x 1080 (21:9), 768 x 1024 (iPad portrait) and 375 x 667 (too small) where the layout changes. Teacher setup (home, start) at **375** and **1280** (2x, full page) and **320 with the browser text size at 200 %** (`-320-text200`). **Greyscale** checks (`-gray`): letter, quiz answer, sequence order, end, corner timer, picker |

**The mocks are a design reference, not shipped code.**

- **Content is real.** Every letter, word, gloss, title, Hoya line, card fact, quiz option and slide count was produced by PR 5's own `expandDeck` over `lectureBundle('en')` on `origin/main` at `eabe6cbd1`, for three decks: "Week 3 letters" (Meet the Letters, a 5-round quiz over all, Write it in the air for 3 minutes, Hello Kimchi & Rice, Hanbok and the Bow, class code; 71 slides, about 56 minutes, 6 skipped steps), the reviewed story "King Sejong's New Letters" (13 slides, through the `story` port the deck builder already declares), and the Food topic with four words (10 slides, through the `vocabTopic` port). Each deck was expanded with a Korean voice, without one, and with `romanization: 'tap'`. Story art is F-STORY-002's `drawScene` output for the scene, word art is F-VOC-002's `glyphToSvgString`, the card face is `HeritageCardArt` for `card:book` (taken from the merged browse mock), Hoya is `hoyaNodes(pose)`, glyphs are `Icon/glyphs.ts` paths, and the stroke guide is `jamo-strokes.ts` drawn as `StrokeHint` draws its still diagram.
- **Tokens.** Every value in the first `:root` block of `mock/presenter.css` is a token of `packages/design-system/src/tokens.ts`, generated from the module and named after it (`--spacing-xl` is `spacing.xl`, `--presenter-size-glyph` is `presenter.size.glyph`; `--spacing-n-xl` is the same token as a plain number for stage math). Colours in drawings are written as the token they resolve to. No colour, spacing or radius literal appears outside that block; the few numbers that are not tokens are named once in the second block and listed under "Constants".
- **Two kinds of size.** Everything the room reads on the stage is `unit x a presenter token` (the stage unit `--u` is `stageScale`'s unit, computed in CSS on the stage box with container units, so a taller bar band letterboxes the stage exactly as PR 6 will). Controls, overlays' buttons and the teacher screens are real pixels and rem (`touchTarget.hero` 96 in the bar, `touchTarget.min` 64 elsewhere), so the browser text size enlarges them and the 200 % shots are meaningful.
- **Taught Korean** uses `HR Presenter KR` (the committed subset, loaded from `apps/mobile/public/fonts/`); every Korean string drawn is in its glyph sidecar. UI text and the deck title use the system stack. Every Korean string carries its romanization and, where the content has one, its gloss.
- **Words.** See "Strings": every UI string drawn is either an existing dictionary value (12 keys) or a new key listed with its English, Spanish and Korean value for the PR that draws it. Content (titles, glosses, facts, Hoya lines) is the bundle's own text.
- **Names.** The only learner label drawn anywhere is the helper picker's result ("Mina", a fixture first name, and "7" in numbers mode). Recent rows show deck titles; the grid shows kind labels and slide titles; the start screen shows only how many names arrived.

Open any page in a browser from a local static server at the repo root (the font is loaded by relative path; `file://` blocks it in Chromium). Links are placeholders.

## Constants

Numbers that are not tokens, each named once in the second `:root` block of `mock/presenter.css` (or in the generator where it is SVG geometry). PR 6 to PR 12 write them as named constants beside `stage-scale.ts`, never as literals.

| Name | Value | Derived from |
|---|---|---|
| `--bar-h` (bar band) | `touchTarget.hero + 2 x spacing.md` = 120 px | one row of hero buttons with `spacing.md` above and below; the band grows when chips wrap above the buttons |
| `--u` (stage unit) | `min(box width / 1280, box height / 600)` | `stageScale` (PR 4) on the stage box, the window minus the band; `presenter.stage.width`, `presenter.stage.minHeight` |
| stage padding | `spacing.xxxl` x unit (48 units) | every slide keeps this margin; at 1280 x 720 the content area is 1184 x 504 |
| gaps | `spacing.xxxl` x unit between slide parts, `spacing.xl` x unit inside a part | |
| stage borders | `borderWidth.thick` x unit (3 units); the revealed option `spacing.sm` x unit (8 units) | a 1 or 2 px border vanishes on a projector; the revealed border is a shape change, not colour alone |
| stage card radius | `radii.xl` x unit | |
| `--stroke-panel` | 360 units | `StrokeHint size = unit x 360` (section 3.6) |
| `--art-lg` | 360 units | card and word pictures match the stroke panel, so slides line up |
| `--scene-w` | 400 units (400 x 300) | the scene canvas is 400 x 300: one unit per scene point |
| `--hoya-stage` | 240 units | Hoya on title, activity, blank and pause; the small Hoya beside "Hoya's answer" is `touchTarget.hero` units (96) |
| `--marker` | 2 x `presenter.size.body` = 80 units | the shape marker reads as a large glyph beside 140-unit Korean; shape stroke 6 and numeral 40 (30 in the triangle and star) on a 100 viewBox |
| `--ring` | 420 units; numbers at `presenter.size.display` (140 units, 33.3 on the 100 viewBox) | the full-screen timer fills the stage height beside its controls |
| `--ring-corner` | 160 px; numbers `typography.size.display` (36 px) | the corner timer is a control (real pixels), 10 x `spacing.lg` |
| ring stroke | 10 on the 100 viewBox | the track and the fill are one width; the fill starts at 12 o'clock and only grows (TD5) |
| stroke guide | stroke 14 on the 200 viewBox; start dot r 14 with a 4-unit `brand.secondaryDark` ring, numeral `text.primary` | `jamo-strokes.ts` viewBox 200; the numeral pair is `text.primary` on paper (in the pair table) |
| `.ctl` width | at least `touchTarget.hero`, at most 1.5 x hero; Next / Reveal at least 1.5 x hero | nine labelled buttons fit 1280 px with the chips; Spanish labels wrap to two lines inside 96 (section 3.13) |
| Start button | 1.25 x `touchTarget.hero` tall, `typography.size.display` label | the one primary action of the start screen |
| stage button (speaker, Start timer) | `max(touchTarget.hero, unit x touchTarget.hero)`; Start timer `max(hero, unit x 112)` | a stage control never drops below the bar's target size on a small window |
| End slide fit | at most two rows of letters and two of words, then one "+ n more" pill each; the sample holds 11 letters and 6 words (4 syllables, 2 glossed words) | measured at 1280 x 720 with the class code panel (D7); glosses are never dropped to fit, fewer items show instead; PR 6 measures rows instead of counting |
| Picker label box | at least 480 x 140 units | a 20-character label (the schema maximum) at `presenter.size.title` fits on one line |
| Code panel | 400 units wide | "HYRA42" (a valid `JOIN_CODE_RE` code) at `presenter.size.title` in the mono stack plus padding |
| Grid thumb | at least 13 rem wide, 8 rem tall | five thumbs across at 1280; text grows with the browser text size |
| Dialog widths | `--dialog-w` Exit 40 rem; `--help-w` Help 56 rem with two key columns from 900 px | |
| Help key column | `--key-col` 10 rem (one column), `--key-col-2` 9 rem (two columns); `--kbd-min` 2.25 rem per key cap | the widest cap row fits one line at 18 px |
| Status basis | `--status-min` 12 rem | the chips' flex basis beside the bar controls; below it they wrap above the buttons (D1) |
| Picker label basis | `--picker-label` 14 rem | the start screen's picker row label beside its stepper |
| Readable line | `--line-max` 32 rem | state pages and the full timer's controls |
| Grid thumb (named) | `--thumb-w` 13 rem, `--thumb-h` 8 rem | the row above |
| Media queries | 600 px and 900 px | `layout.breakpoint.regular` / `.wide`; a media query cannot read a custom property, so the sheet says so in a comment |
| `builds-board.html` frames | 640 x 420 / 520 px | mock scaffolding only, never a presenter surface |
| Teacher page columns | one column below 900 px (`layout.breakpoint.wide`), two from it; gutters `layout.gutter.*` at 600 / 900 | the app's window classes |
| Font stacks | system stack for UI (`typography.family.sans` 'System'); `"HR Presenter KR", system` for taught Korean (`presenter.font`, web only) | PR 3 review note 2 |

## Measured on the mocks (Chromium)

| Check | Target | Mock |
|---|---|---|
| Smallest text on the stage | `presenter.size.caption` x unit, never below `typography.size.body` (18) | 28 px at 1280 x 720, 42 px at 1920 x 1080, 22.4 px at 1024 x 768 (unit 0.8), 44.8 px at 2560 x 1080 |
| Smallest text anywhere in the presenter | `typography.size.body` (presenter.v1.md rule 2) | 18 px: bar labels, chips, grid, help, home and start rows |
| Stage overflow | none: every slide fits the 1184 x 504 content area of a 1280 x 720 window | none on any of the 74 projected shots (scroll size equals the stage box) |
| Sideways scroll | none, including 320 px at 200 % text | none on any shot |
| Targets | every control at least `touchTarget.min` (64); bar buttons `touchTarget.hero` (96) | met on every presenter page (checked by script); the browse item page's own back link and text links on `present-this.html` are #421's and unchanged |
| Ids | no duplicate id | none |
| Console errors | none | none |
| Contrast (from the token values; every pair is a row of `presenter.v1.md`) | text 7:1, non-text 3:1 | `text.primary` on paper 16.10, on sunken 13.58, on `feedback.successLight` 13.24, on `brand.secondaryLight` 12.35; `text.secondary` on paper 8.44; Start and Next `text.onPrimary` on `brand.primaryDark` 7.65; dimmed options `text.primary` at 0.8 on paper 8.4; success border 5.21 and check 4.28; timer fill on its track 4.59; chip border 5.20, speaker 7.59; focus ring 4.30 on paper, 3.63 on sunken |
| Greyscale | the answer, the marker, the timer and the picker read without colour | the revealed option keeps a thicker border and the check mark; markers are four shapes with numbers; the timer is the ring length and m:ss; see the `-gray` shots |

## Decisions this pass takes (each within the spec; the PRs follow them)

- **D1. The stage box is the window minus a docked band.** The bar sits in its own band under the stage (`--bar-h`), never over a slide. When the bar auto-hides (`presenter.autoHideMs`) its controls fade (no fade under reduced motion) and the band stays, so no slide moves or rescales. PR 6 passes the stage box, not the window, to `stageScale`; with one row of controls a 1280 x 720 window gives unit 1 and a logical height of 600, the minimum the slides are designed for. Status chips that do not fit beside the controls wrap above them; the band grows and the stage letterboxes (`bar-chips-1024x768.png`).
- **D2. No text below 18 px anywhere.** presenter.v1.md rule 2 ("nothing on screen below `typography.size.body`") covers the bar, chips, grid, help and the teacher screens, so none of them uses `bodySm` or `caption`.
- **D3. Control bar.** Back, Next, Sound, Timer, Helper, Blank, Slides, Full screen, Exit, each a labelled 96 px button. Glyphs only where `Icon/glyphs.ts` has one (`arrow-left`, `arrow-right`, `speaker` / `speaker-off`, `close`); this pass adds no icon. Next reads **Reveal** while the slide has builds left and **Next** on its last build (one button, two keys). Full screen shows a pressed state. Focus order: the bar, then the stage (section 3.13).
- **D4. Letter slide in three columns** (glyph and romanization | stroke guide | sound, name, hint, example word); see `slide-letter.md`. The stroke guide's start dots carry their numeral in `text.primary` on paper inside a `brand.secondaryDark` ring, so no new colour pair is needed.
- **D5. Syllable: the parts become the block.** Build 0 shows `ㄱ + ㅏ` at `presenter.size.display`; build 1 replaces them with the block at `presenter.size.glyph` (the taught item of the slide) and keeps the parts small beside it. `presenter.v1.md`'s "Used for" column is updated to say so (wording only; no value changes, and the parity and contrast tests pass). *As built (PR 7):* with motion the join slides a two-part syllable's parts together and fades them over `motion.duration.base` (a syllable with a final consonant only fades); under reduced motion it is an instant swap with no fade (spec sections 3.4 and 3.13).
- **D6. Quiz.** A 2 x 2 grid of options, each with its shape-and-number marker. The answer build gives the correct option a `spacing.sm`-unit `feedback.success` border, the `feedback.successLight` ground and the `check-circle` glyph; the others drop to `presenter.dimOpacity` with every line in `text.primary`. "Hoya's answer" and a cheering Hoya join the question row at the reveal, so the options never move. A story check's explanation sits under the options. The projected Match Sound prompt is "Which letter makes this sound?" (`learner.presenter.quiz.sound`), not the learner's "Tap the letter you hear" (section 3.4 cites the learner text): on a projector the room points or holds up fingers and nobody taps.
- **D7. End slide fit rule.** Letters are Korean-and-romanization pairs; words are Korean, romanization and, when the word has one, its gloss in the presenter locale (owner decision D2, section 3.13; a syllable such as 가 has none). A chip per item does not fit. At most two rows of each; the rest is one "+ n more" pill (`learner.presenter.slide.end.more`). Glosses are never dropped to fit: fewer items show before the pill. The class code sits in a panel on the right at `presenter.size.title` in the mono stack, with the Join line built from the shipped Join label. The practice line closes the left column.
- **D8. Story slide.** The scene (400 x 300 units) and the narration share the first row; the scene's Korean line and gloss run full width under them. The scene caption is the art's accessible name and is not drawn: the narration already says it and the slide has no room for a third text block.
- **D9. Topic word pictures (PR 12).** The word's WordArt is drawn as an `art` build after the gloss. Today `buildsFor` adds `art` only for a `cardId`; PR 12's adapter passes the word's visual key and adds the build (a `build-steps.ts` change inside PR 12, spec section 3.4 "F-VOC WordArt").
- **D10. Skipped parts.** The start screen says how many parts are not shown as slides ("6 parts of this lesson are not shown as slides.") rather than "not in this version of the app": in the sample deck all six are listening steps the presenter does not draw, which the old line would misstate. [ See which ] lists each part by the lesson that holds it with one reason line per `SkipReason`.
- **D11. Picker.** The question at `presenter.size.prompt`, the drawn label at `presenter.size.title` in a bordered box, Draw / Undo / Another / Close, and the mode chips of the modes the presenter actually has (the received mode and numbers). Undo and Another are disabled before the first draw. Another is the reducer's `skip`: the label goes back into the bag and nobody is told why. Empty bag: "Everyone has had a turn" with [ Start again ]. No count, list, history or "skipped" mark ever shows (TD5).
- **D12. Timer.** Corner: a real-pixel card at the bottom right of the stage box (ring, Pause, +30 s, Big, Close), over the slide, which still advances. Full: the ring at 420 units with numbers at `presenter.size.display`, presets and controls beside it. At zero the ring is complete, Hoya cheers and the line is "All done!"; there is no alarm word and no red.
- **D13. Grid and help are teacher tools drawn in real pixels.** Grid: number, kind label and title text per thumbnail (no Korean, no names, no notes); the open slide marked "Now"; a hidden slide dashed with [ Show ]; the End slide has no Hide (section 3.5 amendment 4). Help lists every key of section 3.5, the romanization switch, the language chips and Keep controls visible; it scrolls when taller than the stage box.
- **D14. Presenter home.** Two columns from 900 px (Recent, Quick lesson), one column below with Recent first; [ Build lesson ] in flow at the end of the list with the chosen count beside it; language chips and Keys and help in the header.
- **D15. Start screen** is a teacher page in rem on paper (not stage-scaled): deck title, facts, the device checks, skipped parts, the picker row and one big Start. The same page is what a projector shows before Start (`start-projected-*`). *As built (PR 6):* the app draws teacher pages from the px design tokens, as every learner and grown-up screen does (React Native Web has no rem), so the start screen and the state pages grow with browser zoom (Ctrl/Cmd +), which scales every px value, rather than with the browser's default text size setting. The mock's rem values are the same px at the 16 px default.
- **D16. BR-13.** [ Present this ] is a ghost button under [ Preview this lesson ] in the item page's action bar; its explanation is the button's accessible description.
- **D18. Pause opens from Blank.** Section 3.5 gives Pause no key and the bar no button; the Blank overlay carries a ghost **Pause** button (`learner.presenter.blank.pause.cta`) that swaps Blank for Pause in the covering slot. The Blank dialog focuses its container, so `Space` / `Enter` still clear it (`overlays.md`).
- **D19. Chip groups are radiogroups.** The picker's mode chips and the Help overlay's Romanization and language chips: one tab stop, arrows move and select, the selected chip takes focus on entry; the presenter keys keep their meaning (`overlays.md`).
- **D17. The deck title** (teacher text) appears on the start screen and as a small caption line above the first slide's title; never in `document.title` (fixed `learner.presenter.docTitle`).

## Content observations for other PRs (not changed here)

- The Week 3 deck's `taught` letters hold ㄱ twice (`g/k` from Meet a, eo, g, n and `k` as a final from Hanbok and the Bow). PR 6 decides whether the End slide merges one character into one item; the fit rule hides it in this sample.
- The fact of `card:book` reads "Korean kids first learn to read books printed left-to-right ...". It is shipped content projected on a shared surface; CLAUDE.md section 1's copy rule asks a content PR to reword it ("In Korea, people first learn ..."). Not edited here; tracked in #589 (https://github.com/Denny-Hwang/Hangul_Route/issues/589).
- The first draft drew the class code "HOYA42", which `JOIN_CODE_RE` rejects (the alphabet has no O). The mock and the PR 6 fixtures use "HYRA42".

## Review log (multi-lens review of this pass)

This environment has no sub-agent tool, so the four lenses ran as separate passes in one session, each against the shots and the measurement script, and every finding was applied. Language lenses (Spanish, Korean) follow F-I18N-001 section 3.10.

| Lens | Finding | Outcome |
|---|---|---|
| Design | End slide, story slide, syllable slide, no-voice letter slide, full timer and quiz reveal line overflowed the 504-unit content height at 1280 x 720 | D7, D8, D5, compact "Say it" row, D12 side-by-side timer, D6 reveal in the question row; zero overflow now |
| Design | the bar overlapped slides and did not letterbox when chips wrapped | D1 (band + container units) |
| Legibility (back of the room) | bar labels and chips at 16 px | D2: 18 px everywhere; stage text never below 28 px at 1280 |
| Legibility | quiz letters shrunk below `presenter.size.display` | removed; letters at 140 units |
| Accessibility | two colour pairs outside `presenter.v1.md` (a chip button in `brand.primaryDark` on paper, white numerals on `brand.secondaryDark`) | both redrawn in `text.primary` on paper; every pair drawn is a table row |
| Accessibility | help overlay taller than the stage box | scrolls inside the cover; two key columns from 900 px |
| Accessibility | greyscale | answer, markers, timer, picker read without colour (`-gray` shots) |
| Anti-shame | every new string (en, es, ko) against `banned-words.json` (learner and caregiver lists) | 0 hits; no "wrong", "fail", "miss", "incorrect", no score, no ranking, no alarm |
| Anti-shame | the picker's skip | labelled "Another", gives no reason, leaves no trace (D11) |
| Privacy | names on the projected screen | only the picker result; Recent, grid, titles, start screen (count only) and `document.title` hold none; the mock's "Mina" is a fixture |
| Privacy | the skipped list | shows lesson titles and reasons, never refs or anything about a person |
| Copy (owner rules) | age words, "kids" in UI | none in UI strings; one in shipped card content (observation above) |
| Copy (owner rules) | speaking | "Say it:" and "No Korean voice here. You say it!" are the spec's teacher-says fallback (the teacher reads aloud); nothing records or measures speech; the `say-together` preset is not drawn |
| Spanish | length budget (1.5x, `cta` 28) | button labels are `.cta` keys; eight strings shortened (two after the PR review: `present.cta` "Proyectar", `startOver.cta` "Desde el inicio"); six keys need an `ES_LENGTH_ALLOW_LIST` line in the PR that adds them, listed under "Length budget" below |
| Spanish | register | tú everywhere, Latin-American "armar", no gendered adjective about the reader |
| Korean | particles on variables | none: the Join line uses "‘{cta}’ 버튼을"; counts attach particles to 개 only |
| Second review (PR #588) | End slide dropped word glosses; length-budget claim; "Nothing is saved." not true (Recent stores the deck); three "same values as" rows drifted; missing preset, Show numbers and install-hint keys; Help missing up and down arrows; no Pause trigger; picker case for a numbers deck; Exit orientation; apostrophes, Spanish plural hedge, gendered "¡Todos atentos!", lowercase "today"; unnamed rem literals; BR-13 shown before stories and topics expand; radiogroup keys; spec text stale for D1, D6, D10 | all applied: D7 and `slide-end*` re-shot with glosses; "Length budget" below; `presentNote` now says no one's progress changes; values copied from the shipped console strings; keys added; D18, D19; `start-screen.md` fourth case; `overlays.md`; `common.date.*`; constants named; `present-this.md` condition; spec sections 3.4, 3.5, 3.6 amended inline |
| Korean | register and glossary | 해요체 throughout; 낱말, 문화 카드, 레슨 (as the browse pages), 퀘스트 not needed; "오늘 함께 본 것" for "Today we met" |

## Strings

Every UI string a mock draws. Values with `{x}` are functions; plural keys follow `plural()` (one / other) as noted. Spanish and Korean are drafted to the F-I18N-001 section 3.10 style guide and glossary and go into the same PR as their English (the es / ko coverage ratchets); the PR's reviewer checks them. "(specified, not drawn)" keys belong to states the PR draws from the spec text without a separate mock.

### Existing keys reused

| Key | Use |
|---|---|
| `caregiver.spaces.join.cta` | drawn |
| `common.buttons.back` | drawn |
| `common.buttons.close` | drawn |
| `common.buttons.next` | drawn |
| `common.date.today` | drawn (the capitalised standalone form; `common.time.today` is the in-sentence form) |
| `common.date.yesterday` | drawn |
| `console.lecture.titleField.placeholder` | drawn; fixture deck title; the real title is the teacher's text |
| `learner.audio.action.turn_on.cta` | drawn |
| `learner.audio.soundIsOff` | drawn |
| `learner.audio.tapToHear` | specified, not drawn |
| `learner.audio.voice.needsInternet` | specified, not drawn |
| `learner.minigame.cultureQuiz.heading` | drawn |

### New keys for the implementing PRs

| Key | en | es | ko | Note |
|---|---|---|---|---|
| `a11y.presenter.answerMark` | Hoya's answer | La respuesta de Hoya | 호야의 답 | on the check mark of the revealed option |
| `a11y.presenter.option` | Option {n}, {shape} | Opción {n}, {shape} | {n}번, {shape} |  |
| `a11y.presenter.removeRecent` | Remove: {t} | Quitar: {t} | 지우기: {t} |  |
| `a11y.presenter.shape.circle` | circle | círculo | 동그라미 |  |
| `a11y.presenter.shape.square` | square | cuadrado | 네모 |  |
| `a11y.presenter.shape.star` | star | estrella | 별 |  |
| `a11y.presenter.shape.triangle` | triangle | triángulo | 세모 |  |
| `a11y.presenter.slide` | Slide {i} of {n}, {what} | Diapositiva {i} de {n}, {what} | 슬라이드 {i}/{n}, {what} | live region; what = the grid kind label plus the slide's title text or the taught item |
| `a11y.presenter.timerLeft` | Time left: {t} | Tiempo que queda: {t} | 남은 시간: {t} |  |
| `caregiver.browse.item.present.cta` | Present this | Proyectar | 큰 화면에 띄우기 | F-BROWSE-001 BR-13; cta budget 28 in every locale; es is the verb of console.lecture.title "Proyección" |
| `caregiver.browse.item.presentNote` | Opens the lesson as slides for a classroom screen or a TV. No one's progress changes. | Abre la lección como diapositivas para una pantalla de clase o un televisor. No cambia el progreso de nadie. | 교실 화면이나 TV에 슬라이드로 띄워요. 누구의 진도도 바뀌지 않아요. | F-BROWSE-001 BR-13; the presenter keeps the deck in this device's Recent lessons, so the line promises only what is true (it matches `learner.presenter.exit.line`) |
| `learner.presenter.activity.air-write` | Write it in the air | Escribir en el aire | 허공에 써 보기 | same values as console.lecture.activity |
| `learner.presenter.activity.copy-on-paper` (specified, not drawn) | Copy it on paper | Copiar en papel | 종이에 따라 쓰기 | same values as console.lecture.activity |
| `learner.presenter.activity.pair-share` (specified, not drawn) | Pair and share | En parejas | 짝과 나누기 | same values as console.lecture.activity |
| `learner.presenter.activity.say-together` (specified, not drawn) | Say it together | Decirlo en grupo | 함께 소리 내어 읽기 | same values as console.lecture.activity; a teacher-led choral reading, nothing records or measures speech |
| `learner.presenter.activity.stretch-break` (specified, not drawn) | Stretch break | Pausa para estirarse | 기지개 켜기 | same values as console.lecture.activity |
| `learner.presenter.bar.blank.cta` | Blank | En blanco | 화면 가리기 |  |
| `learner.presenter.bar.counter` | {i} / {n} | {i} / {n} | {i} / {n} |  |
| `learner.presenter.bar.exit.cta` | Exit | Salir | 나가기 |  |
| `learner.presenter.bar.fullscreen.cta` | Full screen | Pantalla completa | 전체 화면 |  |
| `learner.presenter.bar.grid.cta` | Slides | Diapositivas | 슬라이드 |  |
| `learner.presenter.bar.label` | Lesson controls | Controles de la lección | 수업 조작 | toolbar accessible name |
| `learner.presenter.bar.noVoice` | No Korean voice here. You say it! | Aquí no hay voz coreana. ¡Dilo tú! | 여기는 한국어 음성이 없어요. 직접 읽어 주세요! | spec §3.7 |
| `learner.presenter.bar.offline` | Offline. Everything still works. | Sin internet. Todo sigue funcionando. | 오프라인이에요. 모두 그대로 돼요. |  |
| `learner.presenter.bar.picker.cta` | Helper | Ayudante | 도우미 |  |
| `learner.presenter.bar.reveal.cta` | Reveal | Mostrar | 다음 보기 | Next while the slide has builds left |
| `learner.presenter.bar.sound.cta` | Sound | Sonido | 소리 |  |
| `learner.presenter.bar.timer.cta` | Timer | Temporizador | 타이머 |  |
| `learner.presenter.bar.update` | Update ready. It applies when you exit. | Hay una actualización. Se aplica al salir. | 업데이트가 준비됐어요. 나갈 때 적용돼요. | spec §3.8 |
| `learner.presenter.blank.line` | Eyes on me | ¡Miren aquí! | 여기를 봐요 | spec §3.5; es avoids a gender-agreeing adjective (F-I18N-001 §3.10) |
| `learner.presenter.blank.pause.cta` | Pause | Pausa | 잠깐 멈춤 | D18: opens the Pause overlay from Blank |
| `learner.presenter.docTitle` (specified, not drawn) | Hangul Route lecture | Clase de Hangul Route | Hangul Route 수업 | document.title, fixed (§3.2) |
| `learner.presenter.exit.keepGoing.cta` | Keep going | Seguir | 계속하기 |  |
| `learner.presenter.exit.line` | Nothing about anyone's progress changes. | No cambia el progreso de nadie. | 누구의 진도도 바뀌지 않아요. |  |
| `learner.presenter.exit.title` | Leave the lesson? | ¿Salir de la lección? | 수업을 나갈까요? |  |
| `learner.presenter.grid.hidden` | Hidden | Oculta | 숨김 |  |
| `learner.presenter.grid.hide.cta` | Hide | Ocultar | 숨기기 |  |
| `learner.presenter.grid.hint` | Choose a slide to go there. Hide a slide for this lesson only. | Elige una diapositiva para ir a ella. Oculta una solo para esta lección. | 슬라이드를 고르면 그리로 가요. 숨기기는 이번 수업에만 적용돼요. |  |
| `learner.presenter.grid.kind.activity` | Activity | Actividad | 활동 |  |
| `learner.presenter.grid.kind.card` | Card | Tarjeta | 카드 |  |
| `learner.presenter.grid.kind.end` | End | Final | 마무리 |  |
| `learner.presenter.grid.kind.letter` | Letter | Letra | 글자 |  |
| `learner.presenter.grid.kind.quiz` | Question | Pregunta | 문제 |  |
| `learner.presenter.grid.kind.sequence` | Order | Orden | 순서 |  |
| `learner.presenter.grid.kind.story` | Story | Historia | 이야기 |  |
| `learner.presenter.grid.kind.syllable` | Syllable | Sílaba | 음절 |  |
| `learner.presenter.grid.kind.title` | Title | Título | 제목 |  |
| `learner.presenter.grid.kind.vocab` | Word | Palabra | 낱말 |  |
| `learner.presenter.grid.now` | Now | Ahora | 지금 |  |
| `learner.presenter.grid.show.cta` | Show | Mostrar | 보이기 |  |
| `learner.presenter.grid.title` | All slides | Diapositivas | 전체 슬라이드 |  |
| `learner.presenter.help.clicker` | A presentation clicker works with no setup. | Un control de presentaciones funciona sin configurarlo. | 프레젠테이션 리모컨은 따로 설정하지 않아도 돼요. |  |
| `learner.presenter.help.keepVisible` | Keep controls visible | Dejar los controles a la vista | 조작 버튼 계속 보이기 | spec §3.5 |
| `learner.presenter.help.key.backspace` | Backspace | Retroceso | 백스페이스 |  |
| `learner.presenter.help.key.space` | Space | Espacio | 스페이스 바 |  |
| `learner.presenter.help.romanization` | Romanization | Romanización | 로마자 |  |
| `learner.presenter.help.romanizationAlways` | always | siempre | 항상 | same values as console.lecture.options.romanizationAlways |
| `learner.presenter.help.romanizationTap` | hide until tapped | oculta hasta tocar | 누를 때까지 숨기기 | same values as console.lecture.options.romanizationTap |
| `learner.presenter.help.row.back` | Back | Atrás | 뒤로 |  |
| `learner.presenter.help.row.blank` | Blank the screen | Pantalla en blanco | 화면 가리기 |  |
| `learner.presenter.help.row.close` | Close or exit | Cerrar o salir | 닫기와 나가기 |  |
| `learner.presenter.help.row.first` | First and last slide | Primera y última | 처음과 마지막 슬라이드 |  |
| `learner.presenter.help.row.fullscreen` | Full screen | Pantalla completa | 전체 화면 |  |
| `learner.presenter.help.row.grid` | All slides | Diapositivas | 전체 슬라이드 |  |
| `learner.presenter.help.row.help` | This help | Esta ayuda | 이 도움말 |  |
| `learner.presenter.help.row.next` | Next | Avanzar | 다음 |  |
| `learner.presenter.help.row.picker` | Helper picker | Elegir ayudante | 도우미 뽑기 |  |
| `learner.presenter.help.row.romanization` | Romanization on or off | Mostrar u ocultar la romanización | 로마자 보이기와 숨기기 |  |
| `learner.presenter.help.row.sound` | Play the sound again | Repetir el sonido | 소리 다시 듣기 |  |
| `learner.presenter.help.row.strokes` | Replay the stroke guide | Repetir los trazos | 획순 다시 보기 |  |
| `learner.presenter.help.row.timer` | Class timer | Temporizador | 수업 타이머 |  |
| `learner.presenter.help.title` | Keys and controls | Teclas y controles | 키와 조작 |  |
| `learner.presenter.home.help.cta` | Keys and help | Teclas y ayuda | 키와 도움말 |  |
| `learner.presenter.home.quick.build.cta` | Build lesson | Armar la lección | 수업 만들기 |  |
| `learner.presenter.home.quick.chosen` | {n} chosen | Elegiste {n} | {n}개 골랐어요 | plural one: "1 chosen" / "Elegiste 1" / "1개 골랐어요" |
| `learner.presenter.home.quick.consonants` | Consonants | Consonantes | 자음 |  |
| `learner.presenter.home.quick.full` (specified, not drawn) | A lesson holds {max} items at most. | Una lección tiene {max} elementos como máximo. | 수업에는 {max}개까지 담을 수 있어요. |  |
| `learner.presenter.home.quick.group.episodes` | Episodes | Episodios | 에피소드 |  |
| `learner.presenter.home.quick.group.lessons` | Single lessons | Lecciones sueltas | 레슨 하나씩 |  |
| `learner.presenter.home.quick.group.letterSets` | Letter sets | Grupos de letras | 글자 묶음 |  |
| `learner.presenter.home.quick.group.stories` | Stories | Historias | 이야기 |  |
| `learner.presenter.home.quick.group.topics` | Word topics | Temas de palabras | 낱말 주제 |  |
| `learner.presenter.home.quick.letters` | {n} letters | {n} letras | 글자 {n}개 | plural: one "1 letter" / "1 letra" / "글자 1개" |
| `learner.presenter.home.quick.line` | Choose what to teach. No sign-in, no names. | Elige qué enseñar. Sin iniciar sesión y sin nombres. | 가르칠 것을 골라요. 로그인도 이름도 필요 없어요. |  |
| `learner.presenter.home.quick.minutes` | about {n} min | aprox. {n} min | 약 {n}분 | one es form for every n ("unos 1 min" would read wrong) |
| `learner.presenter.home.quick.nothing` | Choose at least one item to build a lesson. | Elige al menos un elemento para armar la lección. | 수업을 만들려면 하나 이상 골라요. |  |
| `learner.presenter.home.quick.title` | Quick lesson | Lección rápida | 빠른 수업 |  |
| `learner.presenter.home.quick.vowels` | Vowels | Vocales | 모음 |  |
| `learner.presenter.home.recent.empty` | Lessons you open appear here. Names are never saved. | Aquí aparecen las lecciones que abras. Los nombres nunca se guardan. | 연 수업이 여기에 나와요. 이름은 저장하지 않아요. |  |
| `learner.presenter.home.recent.resume.cta` | Resume | Seguir | 이어 하기 |  |
| `learner.presenter.home.recent.startOver.cta` | Start over | Desde el inicio | 처음부터 | fits 1.5x |
| `learner.presenter.home.recent.storageOff` (specified, not drawn) | Recent lessons are off on this device. Lessons still work. | Aquí no hay lecciones recientes. Las lecciones funcionan igual. | 이 기기에서는 최근 수업을 쓸 수 없어요. 수업은 그대로 할 수 있어요. |  |
| `learner.presenter.home.recent.title` | Recent lessons | Lecciones recientes | 최근 수업 |  |
| `learner.presenter.home.title` | Lecture | Proyección | 강의 | same values as console.lecture.title |
| `learner.presenter.language.note` | Only for this session. Korean always shows romanization and a meaning. | Solo para esta sesión. El coreano siempre muestra la romanización y el significado. | 이번 수업에만 바뀌어요. 한국어에는 늘 로마자와 뜻이 함께 나와요. |  |
| `learner.presenter.language.title` | Presenter language | Idioma de la presentación | 발표 언어 | same values as console.lecture.options.language |
| `learner.presenter.pause.gloss` | wait a moment | espera un momento | 잠시 기다려 달라는 말 | glossKey of PAUSE_WORD, logic/lecture/content.ts |
| `learner.presenter.picker.another.cta` | Another | Otro turno | 다시 뽑기 | the reducer's skip: returns the label and draws again, no reason |
| `learner.presenter.picker.draw.cta` | Draw | Sacar | 뽑기 |  |
| `learner.presenter.picker.empty` | Everyone has had a turn | Ya participaron todos | 모두 한 번씩 했어요 | spec §3.5 |
| `learner.presenter.picker.mode.initials` | initials | iniciales | 이니셜 | same values as console.lecture.picker.mode |
| `learner.presenter.picker.mode.names` | names | nombres | 이름 | same values as console.lecture.picker.mode |
| `learner.presenter.picker.mode.numbers` | numbers | números | 번호 | same values as console.lecture.picker.mode |
| `learner.presenter.picker.ready` | Choose Draw. | Elige Sacar. | 뽑기를 고르세요. |  |
| `learner.presenter.picker.startAgain.cta` | Start again | Empezar otra vez | 다시 시작 |  |
| `learner.presenter.picker.title` | Who's helping next? | ¿Quién ayuda ahora? | 다음 도우미는 누구일까요? | spec §3.5 |
| `learner.presenter.picker.undo.cta` | Undo | Deshacer | 되돌리기 |  |
| `learner.presenter.quiz.answer` | Hoya's answer | La respuesta de Hoya | 호야의 답 | spec §3.10 |
| `learner.presenter.quiz.oddOneOut` | Which one is different? | ¿Cuál es diferente? | 어느 것이 다를까요? | same values as learner.placement shapeOddOneOut |
| `learner.presenter.quiz.playPrompt` | Play the sound | Escuchar el sonido | 소리 듣기 | speaker button label on the stage |
| `learner.presenter.quiz.sound` | Which letter makes this sound? | ¿Qué letra hace este sonido? | 어떤 글자의 소리일까요? |  |
| `learner.presenter.slide.activity.minutes` | {n} minutes | {n} minutos | {n}분 | plural one |
| `learner.presenter.slide.activity.startTimer.cta` | Start timer | Iniciar temporizador | 타이머 시작 |  |
| `learner.presenter.slide.card` | Heritage card | Tarjeta cultural | 문화 카드 |  |
| `learner.presenter.slide.deckTitle` | Lesson | Lección | 수업 | accessible label before the teacher's deck title on the first slide |
| `learner.presenter.slide.end.codeTitle` | Join our class | Únete a nuestra clase | 우리 반에 들어와요 |  |
| `learner.presenter.slide.end.exitHint` | To finish, choose Exit. | Para terminar, elige Salir. | 마치려면 나가기를 고르세요. | shown when Next is pressed on the last slide |
| `learner.presenter.slide.end.howToJoin` | Tap “{cta}” in Hangul Route and type this code. | Toca «{cta}» en Hangul Route y escribe este código. | Hangul Route에서 ‘{cta}’ 버튼을 누르고 이 코드를 입력해요. | cta = caregiver.spaces.join.cta, so the line follows the shipped Join label (§3.3 rule 9) |
| `learner.presenter.slide.end.letters` | Letters | Letras | 글자 |  |
| `learner.presenter.slide.end.more` | + {n} more | + {n} más | 외 {n}개 | the End slide fit rule (README D7) |
| `learner.presenter.slide.end.practice` | Practice at home in Hangul Route | Practica en casa con Hangul Route | 집에서 Hangul Route로 연습해요 | spec §3.3 rule 10 |
| `learner.presenter.slide.end.title` | Today we met | Hoy conocimos | 오늘 함께 본 것 |  |
| `learner.presenter.slide.end.words` | Words | Palabras | 낱말 |  |
| `learner.presenter.slide.letterName` | Letter name: {name} | Nombre de la letra: {name} | 글자 이름: {name} |  |
| `learner.presenter.slide.order` | What comes first? | ¿Qué va primero? | 무엇이 먼저일까요? |  |
| `learner.presenter.slide.sayIt` | Say it: | Dilo así: | 이렇게 읽어요: | teacher-says text (no Korean voice or sound off) |
| `learner.presenter.slide.strokeCaption` | Simplified stroke guide | Guía de trazos simplificada | 간단한 획순 안내 | spec §3.6, until a jamo is reviewed |
| `learner.presenter.start.awake` | The screen stays on during the lesson | La pantalla queda encendida durante la lección | 수업 중에는 화면이 꺼지지 않아요 |  |
| `learner.presenter.start.awakeNone` | Keep the screen awake in system settings. | Mantén la pantalla encendida en los ajustes del sistema. | 시스템 설정에서 화면이 꺼지지 않게 해 주세요. |  |
| `learner.presenter.start.checks` | Before you start | Antes de empezar | 시작하기 전에 |  |
| `learner.presenter.start.cta` | Start | Empezar | 시작 |  |
| `learner.presenter.start.fullscreen` | Full screen opens when you start | La pantalla completa se abre al empezar | 시작하면 전체 화면이 돼요 |  |
| `learner.presenter.start.fullscreenNone` | This browser has no full screen. The lesson still works. | Este navegador no tiene pantalla completa. La lección funciona igual. | 이 브라우저는 전체 화면이 안 돼요. 수업은 그대로 할 수 있어요. |  |
| `learner.presenter.start.hideWhich.cta` | Hide the list | Ocultar la lista | 목록 닫기 |  |
| `learner.presenter.start.installHint` | You can also add it to the home screen from the browser menu. | También puedes agregarla a la pantalla de inicio desde el menú del navegador. | 브라우저 메뉴에서 홈 화면에 추가할 수도 있어요. | spec §3.8: plain text under offlineNotReady; `InstallGuideSheet` is not mounted |
| `learner.presenter.start.loading` | Getting the big letters ready | Preparando las letras grandes | 큰 글자를 준비하고 있어요 | the font wait, at most 1.5 s |
| `learner.presenter.start.minutes` | about {n} minutes | alrededor de {n} minutos | 약 {n}분 | plural one: "about 1 minute" / "alrededor de 1 minuto" / "약 1분" (one hedge in both forms) |
| `learner.presenter.start.offlineNotReady` | Open this page once with Wi-Fi to use it offline. | Abre esta página una vez con wifi para usarla sin internet. | 오프라인에서 쓰려면 와이파이로 이 페이지를 한 번 열어요. |  |
| `learner.presenter.start.offlineReady` | Ready for offline | Funciona sin internet | 오프라인에서도 쓸 수 있어요 |  |
| `learner.presenter.start.picker.fewer` | Fewer | Menos | 줄이기 | accessible name of the stepper minus |
| `learner.presenter.start.picker.initials` (specified, not drawn) | {n} initials received | {n} iniciales recibidas | 이니셜 {n}개를 받았어요 | plural one |
| `learner.presenter.start.picker.more` | More | Más | 늘리기 | accessible name of the stepper plus |
| `learner.presenter.start.picker.names` | {n} names received | {n} nombres recibidos | 이름 {n}개를 받았어요 | plural one |
| `learner.presenter.start.picker.noOpener` | Names come from the console page that opened this lesson. Using numbers. | Los nombres llegan desde la página de la consola que abrió esta lección. Se usan números. | 이름은 이 수업을 연 콘솔 페이지에서 와요. 지금은 번호를 써요. | spec §3.2 step 5 |
| `learner.presenter.start.picker.notKept` | Names are not kept on this device. Using numbers. | Los nombres no se guardan en este dispositivo. Se usan números. | 이름은 이 기기에 남기지 않아요. 지금은 번호를 써요. | spec §3.5 Exit (a resumed lesson) |
| `learner.presenter.start.picker.numbers` | Numbers 1 to {n} | Números del 1 al {n} | 번호 1부터 {n}까지 |  |
| `learner.presenter.start.picker.title` | Helper picker | Elegir ayudantes | 도우미 뽑기 | same values as console.lecture.picker.title |
| `learner.presenter.start.reason.no-romanization` (specified, not drawn) | Left out until it has romanization | Se omite hasta que tenga romanización | 로마자 표기가 생길 때까지 빼 두었어요 |  |
| `learner.presenter.start.reason.not-ready` (specified, not drawn) | Not ready to show yet | Todavía no se puede mostrar | 아직 보여 줄 수 없어요 |  |
| `learner.presenter.start.reason.scope-too-small` (specified, not drawn) | Too few letters or words for this quiz | Hay pocas letras o palabras para este quiz | 이 퀴즈를 하기에는 글자나 낱말이 적어요 |  |
| `learner.presenter.start.reason.unknown-id` (specified, not drawn) | Not in this version of the app | No está en esta versión de la app | 이 버전의 앱에 없어요 |  |
| `learner.presenter.start.reason.unsupported-step` | A step the slides do not show | Un paso que las diapositivas no muestran | 슬라이드에 나오지 않는 단계예요 |  |
| `learner.presenter.start.seeWhich.cta` | See which | Ver cuáles | 목록 보기 |  |
| `learner.presenter.start.skipped` | {n} parts of this lesson are not shown as slides. | {n} partes de esta lección no se muestran como diapositivas. | 이 수업에서 {n}개 부분은 슬라이드로 나오지 않아요. | plural one: "1 part of this lesson is not shown as a slide." / "1 parte de esta lección no se muestra como diapositiva." / same ko |
| `learner.presenter.start.slides` | {n} slides | {n} diapositivas | 슬라이드 {n}장 | plural one: "1 slide" / "1 diapositiva" / "슬라이드 1장"; needs an allow-list line (see "Length budget") |
| `learner.presenter.start.voiceLocal` | Korean voice: {name}, on this device | Voz coreana: {name}, en este dispositivo | 한국어 음성: {name} (이 기기) |  |
| `learner.presenter.start.voiceNetwork` (specified, not drawn) | Korean voice: {name}, uses the internet | Voz coreana: {name}, usa internet | 한국어 음성: {name} (인터넷 사용) |  |
| `learner.presenter.start.voiceNone` | No Korean voice on this device. You say the sounds; the slides show them. | No hay voz coreana en este dispositivo. Tú dices los sonidos; las diapositivas los muestran. | 이 기기에는 한국어 음성이 없어요. 소리는 직접 읽어 주세요. 슬라이드에 소리가 글자로 나와요. |  |
| `learner.presenter.state.invalid.cta` | Open Quick lesson | Abrir lección rápida | 빠른 수업 열기 | spec §3.2 |
| `learner.presenter.state.invalid.line` | Open a Quick lesson, or get a new link from the console page. | Abre una lección rápida o pide un enlace nuevo en la página de la consola. | 빠른 수업을 열거나 콘솔 페이지에서 새 링크를 받아요. |  |
| `learner.presenter.state.invalid.title` | This link does not work | Este enlace no funciona | 이 링크는 열리지 않아요 | spec §3.2 |
| `learner.presenter.state.loading` | Loading lesson | Cargando la lección | 수업을 불러오고 있어요 |  |
| `learner.presenter.state.portrait` | Turn the screen for a bigger view | Gira la pantalla para verlo más grande | 화면을 돌리면 더 크게 보여요 | spec §3.8 |
| `learner.presenter.state.tooSmall` | Make the window bigger or turn the screen. | Agranda la ventana o gira la pantalla. | 창을 키우거나 화면을 돌려 주세요. | stageScale tooSmall (§3.6 amendment) |
| `learner.presenter.timer.add.cta` | +30 s | +30 s | +30초 |  |
| `learner.presenter.timer.big.cta` | Big | Grande | 크게 |  |
| `learner.presenter.timer.done` | All done! | ¡Listo! | 다 됐어요! |  |
| `learner.presenter.timer.hideNumbers.cta` | Hide numbers | Ocultar números | 숫자 숨기기 |  |
| `learner.presenter.timer.showNumbers.cta` (specified, not drawn) | Show numbers | Mostrar números | 숫자 보이기 | replaces Hide numbers while the numbers are hidden |
| `learner.presenter.timer.minutes` | {n} min | {n} min | {n}분 |  |
| `learner.presenter.timer.pause.cta` | Pause | Pausa | 멈춤 |  |
| `learner.presenter.timer.reset.cta` | Reset | Reiniciar | 처음으로 |  |
| `learner.presenter.timer.resume.cta` (specified, not drawn) | Go on | Seguir | 계속 |  |
| `learner.presenter.timer.seconds` | {n} s | {n} s | {n}초 |  |
| `learner.presenter.timer.small.cta` | Small | Pequeño | 작게 |  |
| `learner.presenter.timer.title` | Class timer | Temporizador | 수업 타이머 |  |

### Length budget (`packages/i18n/src/__tests__/length-budget.test.ts`)

Every es value must be at most `max(8, ceil(1.5 x en))` unless `ES_LENGTH_ALLOW_LIST` names it with a reason. Checked for every row above; six keys fail it, and the PR that adds each key adds its allow-list line with this reason:

| Key | es / en | Reason for the allow-list line | PR |
|---|---|---|---|
| `learner.presenter.bar.blank.cta` | "En blanco" 9 / "Blank" 5 (limit 8) | one letter over; the Spanish for a blanked screen needs the preposition; a bar label that wraps inside 96 | PR 9 |
| `learner.presenter.bar.grid.cta` | "Diapositivas" 12 / "Slides" 6 (limit 9) | the one Spanish word for slides; a bar label that wraps inside 96 | PR 9 |
| `learner.presenter.bar.timer.cta` | "Temporizador" 12 / "Timer" 5 (limit 8) | the standard Spanish word for a timer; a bar label that wraps inside 96 | PR 9 |
| `learner.presenter.slide.activity.startTimer.cta` | "Iniciar temporizador" 20 / "Start timer" 11 (limit 17) | "temporizador" again; inside the 28-character cta budget, a stage button that wraps | PR 7 |
| `learner.presenter.start.slides` | "12 diapositivas" 15 / "12 slides" 9 (limit 14) | "diapositivas" is the only Spanish word; a facts line that wraps | PR 6 |
| `learner.presenter.timer.reset.cta` | "Reiniciar" 9 / "Reset" 5 (limit 8) | the standard Spanish button word, one letter over; inside the 28-character cta budget | PR 9 |

## Not drawn here

- The console setup page `/teach/space/lecture` (PR 10, merged; wireframe K) and its entry points.
- The dual-screen notes window and server-saved decks (section 3.15, later phase).
- The `say-together`, `pair-share`, `copy-on-paper` and `stretch-break` activity slides: the same layout as `slide-activity.md` with their console-identical names (keys listed above).
