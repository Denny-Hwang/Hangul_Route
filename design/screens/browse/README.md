# All lessons screens: Access, preview strip, home, episode outline, item page, Lesson display, preview player, preview end, word topic (design mocks v1)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md`. Section 11 says UI PRs link their design mock (`design/screens/…`, CLAUDE.md section 5); this folder is that mock. It is a design pass, not a row of the PR table.
Wireframes: `design/wireframes/browse/{access,home,episode,item,preview-player,preview-end,show-as,entry-points}.md`.
Marks: `design/components/RouteMarkers/spec.md` (F-ENT-003 E3-D, #407): the dotted ring and the words "Not open yet", never a lock glyph.
Built by:
- **BR-6**: `PreviewFrame` (the strip) and the Access screen (`access.md`, `preview-frame.md`).
- **BR-7**: home with the header, how-to, scope and pointer lines, Route · Journey · Library and the keep switch (`home.md`); the episode outline (`episode.md`); the item page with "Where it sits" (`item.md`); the Lesson display sheet (`lesson-display.md`).
- **BR-8**: the preview player and the preview end screen (`preview-player.md`, `preview-end.md`).
- **BR-9**: the word topic page (`topic.md`).
- **BR-12a** needs no screen of its own here: its button sits on the parent dashboard (`design/wireframes/browse/entry-points.md`, panel 6) and opens the home drawn here.

## What is here

| File | What it fixes |
|---|---|
| `access.md` | the Access screen for the gate, account and unknown sources, offline, and the form it takes until BR-12b ships |
| `preview-frame.md` | the strip on lesson screens and on the end screen: placement, the Leave preview button, wrapping, announcement |
| `home.md` | the home header and its lines, the section control, the Route trail, the Journey grid (two panes on wide windows), the Library groups, the keep switch, and every pass and switch state |
| `lesson-display.md` | the bottom sheet: Romanization, Language (hidden while only English ships), Done; **revision 2026-10-17 (DN-7)**: no Language row, renamed **Romanization**, the header's Display (Aa) control (`mock/romanization-sheet.html`) |
| `episode.md` | the episode outline: lesson rows, closed rows, a taste, coming later, a story episode |
| `item.md` | the item page: focus line, What this teaches, Where it sits, the card, the primary action, the closed forms, a story |
| `preview-player.md` | the learner lesson under the strip, the leave confirm, the story reader, a game step, the error screen |
| `preview-end.md` | the end screen and its variants: last lesson, no card, a story |
| `topic.md` | the word topic page (BR-9): every word with its picture, romanization, gloss and Hear button; the flashcard button once F-VOC-003 ships; closed |
| `mock/` | a static HTML mock on one stylesheet, `browse.css`. Pages: `access.html`, `home-route.html`, `home-journey.html`, `home-library.html`, `lesson-display.html`, `episode.html`, `item.html`, `preview-player.html`, `preview-end.html`, `topic.html`. Boards (frames 320 wide): `access-states.html`, `home-states.html`, `lesson-display-states.html`, `episode-states.html`, `item-states.html`, `preview-states.html`, `preview-end-states.html`, `topic-states.html` |
| `shots/` | the mock rendered in Chromium at 2x and stored as palette PNGs: every page at 375 and 1280, every board at 375 only (a board's frames are 320-wide iframes, so a wider window shows the same frames). File names give the page and the viewport width. Extra checks: `-320`, `-320-first` (the first screen), `-375-first`, and `-320-text200` (browser text size 200 %, which models the native text size: the text grows, the layout width stays) |

**The mock is a design reference, not shipped code.**

- **Content is real.** Every lesson, letter, word, gloss, minute count, step, skill, card and "Where it sits" line is the shipped bundle read through BR-4's own functions (`defaultBrowseBundle`, `browseRouteTrail`, `browseJourneyRows`, `browseLibrary`, `episodeOutline`, `itemFacts`) on `origin/main` at `6610ae87` (after #410, which completed Stage 1 Nature and Crafts). The sampler grid of `home-states.html` is `browseJourneyRows` with a sampler pass and the switch on.
- **Tokens.** Every value in `mock/browse.css` is a token of `packages/design-system/src/tokens.ts`, copied once into a custom property named after it, generated from the tokens module: `--spacing-xl` is `spacing.xl`, `--colors-border-shape` is `colors.border.shape`. The few derived values are under "Constants".
- **Drawn parts are the shipped geometry.**
  - Card faces are `HeritageCardArt` rendered to SVG, or CardArt's Korean-word face on the theme tint where the design system draws no picture (`design/components/CardArt/spec.md`).
  - Word pictures are `WordArt` render lists (`word-art/model.ts`), or PictureArt's text tile where a key has no drawing yet (most Animals words today).
  - Glyphs come from `Icon/glyphs.ts`, Hoya is a static port of `Hoya.tsx` (poses `idle`, `waving`, `cheering`, `thinking`), and the dotted rings are E3-D's geometry (`RouteMarkers/spec.md`, "Geometry").
  - Colours in those drawings are written as the token they resolve to.
- **Units.** Text sizes are in rem, so the 200 % shots enlarge every line. Rings, badges, glyphs, card art and Hoya keep their dp size (`design/components/PipRow/spec.md`).
- **Board frames are iframes 320 wide.** The window classes (600 and 900) therefore apply to the frame, as they would on a 320 phone, not to the board.
- **Pinned bars in full-page shots.** The item page's primary action and the preview strip are pinned on a screen (`position: sticky`). A full-page shot draws them in flow, at the end and at the top. The `-first` shots show them pinned on the first screen.
- **Words.** See "Strings" below.
- **Annotations.** Grey dashed boxes and monospace labels are design-board notes, not UI.

Open any file in a browser (`design/screens/browse/mock/home-route.html`). Links are placeholders.

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `access-375.png`, `-1280.png`, `-320-text200.png` | page | the unknown source (a typed URL, a new tab): Hoya waving, the title, the line, Back to the grown-up area, Sign in |
| `access-states-375.png` | board | gate, account, unknown; account offline; gate and unknown until BR-12b |
| `home-route-375.png`, `-1280.png`, `-320.png`, `-320-first.png`, `-320-text200.png` | page | full account pass, Route section (the default while the learner Route tab is on): header, how-to, pointer line, the section control, the trail, the keep switch |
| `home-journey-375.png`, `-1280.png`, `-320.png` | page | Journey section; at 1280 the grid and the outline of Meet the Letters in two panes |
| `home-library-375.png`, `-1280.png` | page | Library: Cards (6 of 42 drawn, annotated), Words (the four topics); Story Time and Culture left out (no reviewed story in this build) |
| `home-states-375.png` | board | D sampler with the switch on (scope line, legend, dotted rings), E fallback with the switch on, gate pass, Route section absent (two segments, the stage line expanded), offline (the chip, no pointer line) and the letter note, the not-in-this-version line, the keep switch on, keyboard focus on a segment and a Route row, the Library with Story Time and a closed tile |
| `lesson-display-375.png`, `-1280.png` | page | the sheet over home (a bottom sheet on phones, a centred dialog from the regular class) |
| `lesson-display-states-375.png` | board | today (no Language row) and with Korean and Spanish shipped |
| `episode-375.png`, `-1280.png` | page | Meet the Letters: three lessons with their letters, skills and minutes, the five cards with their English titles and Korean with romanization |
| `episode-states-375.png` | board | closed rows (Lunch Box Words, sampler with the switch on), Tigers, Mountains, Moon (two lessons that introduce no letter show their first three words), coming later (Word Builder: no subtitle, one line), a story episode |
| `item-375.png`, `-375-first.png`, `-1280.png`, `-320-text200.png` | page | Meet a, eo, g, n opened from a report letter ㄴ: focus line, the marked chip, What this teaches, Where it sits, the card, Preview this lesson |
| `item-states-375.png` | board | closed with Open billing (account pass), closed without it (gate or kept pass), both on Lunch Box Words, whose Build a Letter syllables 산, 달 and 곰 are bundle words and so sit under Words with their glosses (decision 11); a lesson that introduces no letter (Mountain, River, Sea), a story |
| `preview-player-375.png`, `-375-first.png`, `-1280.png`, `-320.png`, `-320-text200.png` | page | the strip above the learner quest player (Discover, page 2 of 2: ㄱ and ㄴ) |
| `preview-states-375.png` | board | the leave confirm, the story reader, a game step, the error screen |
| `preview-end-375.png`, `-1280.png` | page | That is the whole lesson: the card Book, Next lesson, Preview again, Back to the lesson page |
| `preview-end-states-375.png` | board | last shipped lesson (no Next lesson; Back to the lesson page leads), a lesson with no card, a story |
| `topic-375.png`, `-1280.png` | page | Food: twelve words with picture, Korean, romanization, gloss and Hear |
| `topic-states-375.png` | board | with F-VOC-003 flashcards; closed (no Hear buttons, decision 23) |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| Sideways scroll | none at 320, 375 and 1280, and at 320 with 200 % text | none on any of the 38 measured renders (`scrollWidth` equals the viewport), and no board frame scrolls sideways inside its 320 width |
| Targets | at least `touchTarget.min` (64), section 7 | every button, link, segment, radio, chip button, theme filter chip, card row, Journey cell from 375 up, and the keep row is at least 64 tall and 64 wide (a segment is a third of the control's width, never under 93 at 320). The keep switch is the whole row (full width, 64 tall), not its 48 x 24 track. Recorded exception: at 320 the Journey cells are 54 to 56, because the learner `JourneyGrid` is reused unchanged (its cells share the row's width); the same gap exists in the learner app. It is not widened here; spec §7, §11 (design-pass note) and §15 record it, BR-7's target check exempts only Journey cells at 320 by their `journey-stage-<stage>` row selector with a comment naming this exception, and the fix belongs to the learner grid (F-LAYOUT-001), not to Browse. The learner `FilterChip` is about 40 tall; Browse draws its theme chips at `touchTarget.min` (BR-7 gives the browse use a 64 minimum height, the learner chip is unchanged) |
| Section control at 320 | one row, three segments, never wraps (section 7) | one row at 320, 375 and 1280; segments 93, 111 and 157 wide; no label clipped. At 200 % text the label stops at the 1.3 x cap (23.4 px) and still fits ("Journey" is the widest English label) |
| Body text | at the charter floor (18), section 7 | every full sentence a grown-up reads is `typography.size.body` or larger: the how-to, scope, pointer and note lines, the Access line and its offline line, the Lesson display note, Hoya's line, the topic glosses and the stage list's one-liners. These stay at `bodySm` (16), as in the learner app, because they are labels or meta, not running text: "About N minutes", "· N words", "N words", the facts labels (`dt`), the romanization inside a `KoreanText` chip, the episode kicker's theme title, the theme filter chip labels, the legend label, and the card titles in the Library gallery. Pills and the Journey column labels are `caption`. The learner quest player under the strip is the learner's own screen, unchanged |
| Item page primary on the first screen at 375 x 812 | one tap away (section 4.6, screen goal) | Preview this lesson is pinned to the bottom edge on phones; its bottom edge at 804 of 812 |
| Strip height | a slim line that never covers the lesson's close or a target (sections 4.7, 7) | 73 at 375 and 1280, 82 at 320 (the text wraps to two lines beside the button), 135 at 320 with 200 % text (the text and the button label both stop at the 1.3 x cap; the text wraps between words, one word per line there, "Preview. / Nothing / is / saved.", and the button keeps "Leave preview" on one line, `shots/preview-player-320-text200.png`). Checked on every strip: the text never overflows its box and never meets the button. The quest player's close control starts below the strip at every size |
| Strip contrast | an existing pair pinned by the contrast test, no new token (section 7) | `text.primary` on `surface.sunken` (the pair the RouteMarkers preview card uses); the button is the ghost `brand.primary` pair on sunken, which `contrast.test.ts` pins |

These are the mock's numbers. BR-6 to BR-9 measure the real screens (`apps/mobile/e2e/web/browse.spec.ts`).

## Constants

Values that are not tokens. Each derives from code or a token. The PRs that build them write them as named constants (CLAUDE.md section 4).

| Where | Value | Derived from |
|---|---|---|
| Section control and preview strip label cap | 23.4 px (1.3 x `typography.size.body`) | the Learning Route tab label cap (`design/screens/learning-route/README.md`, Constants): measured, the three English labels fit a 93 px segment up to that size. BR-7 sets `maxFontSizeMultiplier` 1.3 with `numberOfLines` 1 and `adjustsFontSizeToFit` on native, so a longer ES or KO label shrinks instead of being cut. BR-6 sets `maxFontSizeMultiplier` 1.3 on the strip text and the Leave preview label (no `numberOfLines`: both may wrap; which one wraps first is left to layout and is not tested) |
| Preview strip height ceiling | 135 at 320 with 200 % text (measured) | BR-6 names it (`PREVIEW_STRIP_MAX_HEIGHT`) and `browse.spec.ts` checks the strip at 320 with 200 % text stays at or under it, and that the text and the button never intersect |
| Card thumbnails in rows | 64 (`spacing.jumbo`) | RouteMarkers D9 (episode cards, the item page's card) |
| Card face inside a 64 thumbnail | 58 | 64 (`touchTarget.min`) minus 2 x `borderWidth.thick` (the rarity border) |
| Library gallery card face | 132 | CardArt's gallery sizing (`design/components/CardArt/spec.md`): the learner gallery slot at the compact class, unchanged |
| Card on the end screen | 96 (`touchTarget.hero`) wrapper, `borderWidth.thick` rarity border, 90 face | CardArt's `CardArtThumb` (Results), unchanged |
| Lesson number disc | 44 | `EpisodeDetailView`'s disc, unchanged (RouteMarkers) |
| Trail badge | 40 | `BADGE_SIZE`, `screens/my-route/StageBadge.tsx` |
| Journey cell theme glyph | `spacing.xl` (24), scaled by `useMediaSize` (29 regular, 34 wide) | decorative cell art (`design/components/Icon/theme-glyphs.md`; it replaced the cell initial on 2026-10-14) |
| Word-face text on a card | `min(0.4 x size, 0.8 x size / glyphs)`, never under `caption` | CardArt spec, "Korean word" face |
| App breakpoints | 600 px, 900 px | `layout.breakpoint` (F-LAYOUT-001) |
| Shadows | `0 2 8` at 0.06; `0 12 32` at 0.18 | `shadows.card`, `shadows.modal` (shadowColor `text.primary`) |
| Font stack | the system stack | `typography.family.sans` is `'System'`, which the web build resolves to this stack |
| Annotation box heights | 420, 560 (min-height) | board only: they size the grey dashed note boxes on the boards and are not UI; no PR builds them |

## Strings

Every drawn string comes word for word from one of these sources, except the accessible names listed last, which are new `caregiver.browse` keys (the F-ENT-003 marks excepted: they are read by reference).

- **Spec section 6 drafts**: All lessons; the how-to line; the sampler scope line; the fallback line; the pointer line; Preview. Nothing is saved.; This page is for parents and teachers.; Keep lessons on this device for 7 days, also offline; That is the whole lesson.
- **Spec sections 4.2 to 4.9**: Close; Lesson display; Route, Journey, Library; Offline; 7 stages, from letters to your own words; This letter is practiced across Stage 1.; This lesson is not in this version of the app yet.; About N minutes; What this teaches; Where it sits; See on the Journey; The card it awards; Taught here; Preview this lesson; Lesson, Story, Words; See the sources; Preview the questions; Opens with the Family Plan or a Group License [BY]; Open billing; Leave preview; At this point a learner sees 1 to 3 stars and collects:; A learner can read it again any time.; Next lesson; Preview again; Back to the lesson page; Romanization; Language; the three Access lines and their buttons; Go back to the app, then open the grown-up area again. (the gate line until BR-12b, amended in §4.3)
- **Wireframe placeholders** (`browse/*.md`), final in `caregiver.browse` when each PR adds them: Lessons, Cards in this episode, Coming later, Letters, Words, Syllables, Skills, Steps, Levels, Scenes, Key words, Sources, Preview this story, Preview the flashcards, N words, Leave this preview?, Keep going, Leave, Always shown, Hidden until tap, These choices change only this preview. No learner's settings change., Done, Grown-up pages need the internet., That is the whole story., Next story, Read again, Back to the story page, lesson n of m, N levels · N scenes, Stories (the story episode's list heading, beside Lessons), Back (the header back button's accessible name on the item and topic pages), At this point a learner sees 1 to 3 stars. (the end line for a lesson with no card; the spec's line without "and collects:").
- **Dictionary values, read by reference**: the learner step names (`learner.quest.step.*.pill`: Hello, Look and listen, Look and learn, Practice, Try it, Quick check, Finish); skills (`learner.myRoute.skill`: Read, Listen, Write); trail and Journey words (Open, A taste, Coming later, Stages 5 to 7, the taste note); Library labels (Cards, Story Time, All, the rarity words); Hear it; Continue; Page n of m; the endonyms (`LOCALE_STATUS`); the learner story tile subtitle "A short story" (`learner.storyShelf.home.subtitle.next`, the not-started form, since Browse has no learner state); "Not open yet" (`learner.access.notOpen`) and the closed Journey cell label "{episode}: not open yet. Opens the lesson page." (`a11y.access.notOpen(title)`), F-ENT-003's keys. Neither is on `main` yet: `a11y.access` comes with F-ENT-003 E3-5 and `learner.access` with E3-6. BR-7 renders them by reference through the learner `JourneyGrid` and tile, never copies them, and its switch-on closed-mark tests need those rows merged; until then the switch is off and no closed cell or tile can be drawn (spec §12).
- **Content**: titles, subtitles, Hoya lines, letters, words, glosses, sound hints and card names come from the bundle.
- **Accessible names (new `caregiver.browse` keys; BR-7 and BR-9 add them through `packages/i18n`, never inline)**: "Show lessons by" (home, the section control); "Themes" (home Library, the filter group); "Dismiss" (home, the note line); "{stage row label} Shows it on the Journey." (home Route); "{title}, {Korean} {romanization}. Opens the card." (episode Cards row, item page card, Library slot, which adds the rarity word); "{topic}, N words. Opens the topic." (Library Words); "Back to all lessons" (episode back); "Open {lesson title}" (episode lesson row); "{letter}, {romanization}, taught here" (item page, the focus chip); "Level" (story item, the levels radiogroup); "Hear {romanization}" (topic row, BR-9).

All of them pass the caregiver banned list (`behind`, `lazy`) and the spec's list ("kids", an age range, "Premium", "upgrade now", "unlock", "fail", "wrong", "behind"). "Browse" appears in no drawn string, and no price appears anywhere.

## Decisions taken in this design pass

1. **Header in two rows.** Close (or the back arrow) sits in the one fixed top-left position, and Lesson display is the chip button at the right of the same row. The title sits below them, with the Offline chip beside it. "All lessons" between two 64-tall buttons does not fit 320 on one row. The order the spec gives (Close, title, Lesson display) is kept for reading and focus order. At 200 % text the row wraps.
2. **The section control is a segmented track, not `SectionTabs`.** `SectionTabs` is a wrapping tablist; section 7 asks for a radiogroup that never wraps. The selected segment takes `SectionTabs`' selected look (`brand.primary` fill, `text.onPrimary`, bold), so it reads like the learner Library's tabs. From the regular class the track is capped at 30rem, so it does not stretch across a wide window.
3. **The pointer line is a link sentence with an arrow.** It is underlined in `brand.primary` (the ghost-label pair on canvas) and is 64 tall. It is drawn for account passes that are not kept (a fallback included, since a fallback is still an account pass), and never for a gate or kept pass, nor offline (decision 24). This narrows spec §4.5 item 4, which a kept pass would otherwise meet (§4.3 counts a kept pass as an account pass): §8 says no account surface is reachable from a kept pass, and the persona home is one. The spec is amended to match (§4.5, §11 design-pass note).
4. **Access until BR-12b, unknown source** (historical: BR-12b shipped the `gate=browse` intent, so the gate and unknown sources now lead to [[ Back to the grown-up area ]]). The spec names the pre-BR-12b form only for the gate source. The unknown source's primary also goes to `/?gate=browse`, so until BR-12b ships its primary becomes [[ Back to the app ]] and Sign in stays. Its line is the spec's line unchanged: it already says to open lessons from the grown-up area, and "again" would be wrong for a visitor who was never there. BR-6 builds both.
5. **Route rows go to the Journey; later rows are not buttons.** A stage row with a chevron is one button ("…. Shows it on the Journey."). Coming-later rows (Sentences, Stages 5 to 7) have no lesson to show, so they are plain rows. This matches `expandable={false}` (spec section 11, BR-5b note): no row opens in place.
6. **No pips on the browse trail.** `browseRouteTrail` returns no pip groups and no fill (the browse state). Each row is its badge, title, state pill and one-liner.
7. **Journey cells keep E3-D's shapes.** Coming later is an empty `surface.sunken` cell with no lock glyph (E3-D D5). A closed cell is the dotted ring at the class sizes 40, 48 and 56. The legend line ("Not open yet") shows only while the grid draws a ring (E3-D D4). The taste note shows only on a row with an open cell (E3-D D11), so it is left out on Stages 2 and 4 in the sampler frame.
8. **Lesson rows put skills and Open on one line.** Title, minutes, the letters (or a taste lesson's first three words), then the skills chips with [ Open ] at the right of the same line. A closed row adds the grown-up caption above that line. [ Open ] is a ghost button: the outline has no primary action (wireframe, "home is a map").
9. **The item page's primary is pinned on phones.** With five fact rows the button would sit below the fold at 375. It is pinned to the bottom edge on the compact class, with a `border.subtle` top rule on canvas, and is inline from the regular class up. This keeps the wireframe's order (facts first) and makes the action one tap away.
10. **Focus marking.** The focus line "Taught here: ㄴ n" sits on `surface.sunken` above the title; the letter and its romanization are a `KoreanText` chip, not the spec's parenthesised "ㄴ (n)" (spec §4.6 amended to match). The focused chip in the Letters row gets a `borderWidth.thick` `text.primary` outline (shape) and the label "…, taught here" (words), never colour alone.
11. **Syllables get their own row.** `itemFacts` returns syllables apart from words, because a syllable has no gloss. The wireframe has no row for them, so "Syllables" is drawn after Words. An empty row is hidden: no Skills row for a lesson whose `questSkills` is empty, and no Letters row for any lesson that introduces no letter (taste lessons and some later Stage 1 lessons, such as Mountain, River, Sea). On the episode outline such a lesson's row shows its first three words instead of letters; spec §4.6 names that fallback for taste lessons only, so this widens it to every lesson without a letter (spec §11 design-pass note). BR-7 tests both a taste lesson and a Stage 1 lesson without a letter. A Build a Letter syllable that is a bundle word with a gloss is listed under Words with its gloss (Lunch Box Words: 산 san mountain, 달 dal moon, 곰 gom bear, `item-states.html`), so that lesson has no Syllables row; a true non-word block stays under Syllables (거 geo on Meet a, eo, g, n, `item.html`).
12. **Steps are the player's own names, in order.** "Hello · Look and learn · Practice · Try it · Quick check · Finish" (`questStepLabel`), not the wireframe's sample ("Meet the letters · Practice · Check · Card").
13. **"Where it sits" uses the Journey column label.** "Stage 1 · Letters · lesson 1 of 3" uses `themeColumnLabel` (the first word of the theme title), the same word as the Journey's columns. A shelf story's quest reads "Stage n · Theme", with no position.
14. **The closed box replaces the primary, in place.** On `surface.sunken`: the grown-up line in Body semibold, then [ Open billing ] as a ghost button for an account pass (not kept, not a fallback). It has no glyph, no price, and no learner word. The facts above it are the same as on the open page.
15. **The strip is one row.** "Preview. Nothing is saved." is on the left, and [ Leave preview ] (a compact ghost button, 64 tall) is on the right. The text wraps beside the button instead of the button dropping to a second row, which keeps the strip at 73 to 82 tall. Both labels stop growing at 1.3 x body. The text takes the width the button leaves and wraps between words, never inside one; the button keeps its label on one line while it fits (at 320 with 200 % text the text is one word per line and "Leave preview" stays on one line, 135 tall). The two never meet. BR-6 does not choose which one wraps first: `browse.spec.ts` checks only that the two boxes do not intersect, that no text overflows its box, and that the strip stays at or under `PREVIEW_STRIP_MAX_HEIGHT`. The strip uses the `surface.sunken` / `text.primary` pair with a `border.strong` rule under it. On the end screen it has no button and is 64 tall.
16. **The end screen shows the card as a still thumbnail.** It is CardArtThumb at 96 with the card's English title and its Korean with romanization. It has no flip and no burst. Next lesson is the primary, and the other two are ghost buttons. When there is no next lesson, Back to the lesson page becomes the primary and Preview again stays a ghost button (wireframe `browse/preview-end.md`, States).
17. **Lesson display is a bottom sheet on phones and a centred dialog from the regular class.** Romanization is two radio rows. Language is a row of endonym chips (radiogroup), hidden while only English ships. Done is the primary, and Escape and the scrim also close the sheet.
18. **The word topic page is a list, not a grid.** Each row is the 64 picture tile, the Korean with romanization, the gloss, and a 64 Hear button (a `brand.secondary` outline, "Hear {romanization}"). Until F-VOC-003 ships there is no primary action (wireframe D).
19. **Covers carry no Korean.** Story covers are their theme tint here, because the story scene art is not drawn in this mock. Taught Korean always appears with its romanization in a `KoreanText` chip, never bare on a picture. The only exception is CardArt's word face, which is the shipped card face, and its Korean and romanization are printed beside it. The episode's "Cards in this episode" rows do the same: each 64 thumbnail has its English title and its Korean with romanization beside it.
20. **Keyboard focus is a `border.focus` ring.** Every target that takes focus (segments, rows, buttons, chips, radios, the keep row) draws a `borderWidth.thick` outline in `colors.border.focus`, `spacing.xxs` outside its edge, on keyboard focus only (`:focus-visible` on web). BR-7 draws it on its Pressables with the focus state, since React Native Web varies the browser's own outline. `home-states.html` draws it on a segment and a Route row.
21. **The keep switch is the whole row.** The label and the track are one `role="switch"` button, full width and at least 64 tall; the 48 x 24 track is drawing only.
22. **Fallback lines need the switch.** The fallback line "Showing free lessons. We could not check your plan." shows only with the content switch on, like the sampler line. With the switch off a fallback pass changes nothing visible (spec §4.3 step 3) and no scope line appears anywhere (§4.2, §10).
23. **A closed topic has no Hear buttons.** The topic's preview is its F-VOC-003 flashcards (BR-9b, spec §4.7), and the words' sound is lesson material that opens with them (§4.2). So the closed topic keeps every word, picture, romanization and gloss, and drops the Hear buttons with the primary (`topic-states.html`). Kept as decided before BR-9b, when the word list's audio was the preview.
24. **No pointer line offline.** The persona home needs the internet, so offline the pointer line is hidden, as the Access screen's account actions are paired with "Grown-up pages need the internet." (`home-states.html`, offline frame).
25. **Close never reaches an account page from a kept pass.** With no same-origin referrer, Close goes to `/` for a gate or kept pass (spec §4.1, amended), for the same reason as decision 3.
26. **The Route shows the learner trail's own rows.** The learner trail draws Stages 1 to 4 one row each and merges the later stages into one "Stages 5 to 7" Coming later row (`laterRowView`), so the browse Route has five rows today, not seven (spec §4.5 amended to match).

## Deviations from the spec and wireframes (also in spec §11, design-pass note)

- The unknown source's pre-BR-12b Access form (decision 4; replaced by the spec's form once BR-12b shipped).
- A separate Syllables row on the item page (decision 11).
- Step labels are the player's own `questStepLabel` names, not the wireframe's sample (decision 12).
- An empty Skills row is hidden (decision 11).
- The first-three-words fallback covers every lesson without a letter, not only taste lessons (decision 11).
- No pointer line for a kept pass (decision 3).
- No subtitle on a coming-later episode: the wireframe's one "Coming later" line only.
- The Route has the learner trail's five rows (Stages 1 to 4 and a merged "Stages 5 to 7"), not seven stage rows (decision 26).
- The focus line is "Taught here: ㄴ n" with a `KoreanText` chip, not "ㄴ (n)" (decision 10).
- A Build a Letter syllable that is a bundle word sits under Words with its gloss (decision 11).
- A closed topic drops its Hear buttons (decision 23).
- No pointer line offline (decision 24); Close from a kept pass with no referrer goes to `/` (decision 25).
- The gate line until BR-12b read "Go back to the app, then open the grown-up area again." (spec §4.3 amended); since BR-12b it is the spec's "Your time in the grown-up area ended." with [[ Back to the grown-up area ]].
- Journey cells are 54 to 56 at 320, under 64 (Measured, Targets; spec §15).

## Notes for the PRs

- **BR-7: Stage 2 lessons have no skills, on purpose.** On `main`, `questSkills` returns an empty list for `quest:stage2-life-q1` and `quest:stage2-nature-q1`: card-match, culture-quiz and build-letter map to `[]` in `SKILL_OF_KIND` (`logic/my-route/skills.ts`) by F-ROUTE-001 OD-5 (words and culture do not need decoding; tiles are counted separately). BR-7 keeps that mapping and hides the empty Skills row and chips (`item-states.html`, `episode-states.html`); it never draws an empty "Skills". Remapping would change learners' Route skill marks, so it is not a BR-7 change. Whether such lessons should list skills (spec Goal 2) is an owner question under F-ROUTE-001 OD-5.
- **BR-7: build-letter syllables that are words.** `itemFacts` files every Build a Letter target as a syllable, so on `main` Lunch Box Words would list 산, 달 and 곰 under Syllables without a gloss, though they are bundle words (mountain, moon, bear); the mock draws them as BR-7 must, under Words with the gloss. BR-7 looks each syllable up in the bundle's words: one with a gloss moves to Words with its gloss (an `itemFacts` change with a `facts.test.ts` case); a block that is not a word stays under Syllables without a gloss, on purpose.
- **BR-7: turning the keep switch off on a kept-only pass.** When the kept pass is the tab's only active pass (a new tab, or the session pass had expired and was removed), turning the switch off removes `browse:pass` and `browse:prefs` as §4.3 says, and the tab keeps the pass it resolved in memory until the tab closes or reloads, so nothing changes on screen. A reload or new tab then shows the Access screen (source `account` from `lastPersona`, else `unknown`). No confirm is drawn. Spec §4.3 and §10 (`pass.test.ts`) carry it.
- **BR-7: the Library today has only Cards and Words.** No story in `content/stories/` is reviewed (F-STORY-004 D14), so `browseLibrary` returns no Story Time or Culture group. The Story Time frames are drawn with draft stories and labelled so; their facts (levels, scenes, key words) are read from the draft files and will change with review.
- **BR-9: Animals pictures.** At `6610ae87` eight of the twelve Animals words had no WordArt drawing (`word:animal-*`), so PictureArt draws its text tile here, as the learner topic would; F-VOC-002 W-4 (#432, open) adds them. Before building, BR-9 re-reads PictureArt's coverage and the learner `VocabTopicScreen` (#414: the romanization reveal and the closed route) instead of copying the text tiles in `topic-states`. F-VOC-003 T8 (`canRender`) decides whether such a topic is listed at all; BR-9 passes that check (spec section 11, BR-4 note).
- **BR-6: the Access screen has no Close.** It is the root's only screen when there is no pass, and it has nothing to return to.
- **BR-8: the strip at 200 % text** is 135 tall at 320 with the 1.3 x cap (the ceiling constant above). That is still above the lesson and never over its controls, as section 7 asks. If beta shows it crowds the games, the wireframe's open question (collapse after the first screen) applies; the default is unchanged.
- **BR-8: reused screens in the preview state** are listed in `preview-player.md` (CardDetail, StorySources).
