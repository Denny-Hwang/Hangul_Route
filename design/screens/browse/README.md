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
| `lesson-display.md` | the bottom sheet: Romanization, Language (hidden while only English ships), Done |
| `episode.md` | the episode outline: lesson rows, closed rows, a taste, coming later, a story episode |
| `item.md` | the item page: focus line, What this teaches, Where it sits, the card, the primary action, the closed forms, a story |
| `preview-player.md` | the learner lesson under the strip, the leave confirm, the story reader, a game step, the error screen |
| `preview-end.md` | the end screen and its variants: last lesson, no card, a story |
| `topic.md` | the word topic page (BR-9): every word with its picture, romanization, gloss and Hear button; the flashcard button once F-VOC-003 ships; closed |
| `mock/` | a static HTML mock on one stylesheet, `browse.css`. Pages: `access.html`, `home-route.html`, `home-journey.html`, `home-library.html`, `lesson-display.html`, `episode.html`, `item.html`, `preview-player.html`, `preview-end.html`, `topic.html`. Boards (frames 320 wide): `access-states.html`, `home-states.html`, `lesson-display-states.html`, `episode-states.html`, `item-states.html`, `preview-states.html`, `preview-end-states.html`, `topic-states.html` |
| `shots/` | the mock rendered in Chromium at 2x, every page and board at 375 and 1280 (file names give the page and the viewport width). Extra checks: `-320`, `-320-first` (the first screen), `-375-first`, and `-320-text200` (browser text size 200 %, which models the native text size: the text grows, the layout width stays) |

**The mock is a design reference, not shipped code.**

- **Content is real.** Every lesson, letter, word, gloss, minute count, step, skill, card and "Where it sits" line is the shipped bundle read through BR-4's own functions (`defaultBrowseBundle`, `browseRouteTrail`, `browseJourneyRows`, `browseLibrary`, `episodeOutline`, `itemFacts`) on `origin/main` at `34aae58a`. The sampler grid of `home-states.html` is `browseJourneyRows` with a sampler pass and the switch on.
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
| `access-states-375.png`, `-1280.png` | board | gate, account, unknown; account offline; gate and unknown until BR-12b |
| `home-route-375.png`, `-1280.png`, `-320.png`, `-320-first.png`, `-320-text200.png` | page | full account pass, Route section (the default while the learner Route tab is on): header, how-to, pointer line, the section control, the trail, the keep switch |
| `home-journey-375.png`, `-1280.png`, `-320.png` | page | Journey section; at 1280 the grid and the outline of Meet the Letters in two panes |
| `home-library-375.png`, `-1280.png` | page | Library: Cards (6 of 42 drawn, annotated), Words (the four topics); Story Time and Culture left out (no reviewed story in this build) |
| `home-states-375.png`, `-1280.png` | board | D sampler with the switch on (scope line, legend, dotted rings), E fallback, gate pass, Route section absent (two segments, the stage line expanded), offline chip and the letter note, the not-in-this-version line, the keep switch on, the Library with Story Time and a closed tile |
| `lesson-display-375.png`, `-1280.png` | page | the sheet over home (a bottom sheet on phones, a centred dialog from the regular class) |
| `lesson-display-states-375.png`, `-1280.png` | board | today (no Language row) and with Korean and Spanish shipped |
| `episode-375.png`, `-1280.png` | page | Meet the Letters: three lessons with their letters, skills and minutes, the five cards |
| `episode-states-375.png`, `-1280.png` | board | closed rows (Lunch Box Words, sampler with the switch on), a taste (Tiger, Magpie, Moon), coming later (Word Builder), a story episode |
| `item-375.png`, `-375-first.png`, `-1280.png`, `-320-text200.png` | page | Meet a, eo, g, n opened from a report letter ㄴ: focus line, the marked chip, What this teaches, Where it sits, the card, Preview this lesson |
| `item-states-375.png`, `-1280.png` | board | closed with Open billing (account pass), closed without it (gate or kept pass), a taste lesson, a story |
| `preview-player-375.png`, `-375-first.png`, `-1280.png`, `-320.png`, `-320-text200.png` | page | the strip above the learner quest player (Discover, page 2 of 2: ㄱ and ㄴ) |
| `preview-states-375.png`, `-1280.png` | board | the leave confirm, the story reader, a game step, the error screen |
| `preview-end-375.png`, `-1280.png` | page | That is the whole lesson: the card Book, Next lesson, Preview again, Back to the lesson page |
| `preview-end-states-375.png`, `-1280.png` | board | last shipped lesson (no Next lesson), a lesson with no card, a story |
| `topic-375.png`, `-1280.png` | page | Food: twelve words with picture, Korean, romanization, gloss and Hear |
| `topic-states-375.png`, `-1280.png` | board | with F-VOC-003 flashcards; closed |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| Sideways scroll | none at 320, 375 and 1280, and at 320 with 200 % text | none on any of the 43 measured renders (`scrollWidth` equals the viewport) |
| Targets | at least `touchTarget.min` (64), section 7 | every button, link, segment, radio, chip button and row on the pages is at least 64 tall and 64 wide (a segment is a third of the control's width, never under 93 at 320) |
| Section control at 320 | one row, three segments, never wraps (section 7) | one row at 320, 375 and 1280; segments 93, 111 and 157 wide; no label clipped. At 200 % text the label stops at the 1.3 x cap (23.4 px) and still fits ("Journey" is the widest English label) |
| Body text | at the charter floor (18), section 7 | every running line is `typography.size.body` or larger; captions and pills are `caption`, as in the learner app |
| Item page primary on the first screen at 375 x 812 | one tap away (section 4.6, screen goal) | Preview this lesson is pinned to the bottom edge on phones; its bottom edge at 804 of 812 |
| Strip height | a slim line that never covers the lesson's close or a target (sections 4.7, 7) | 73 at 375 and 1280, 82 at 320 (the text wraps to two lines beside the button), 203 at 320 with 200 % text. The quest player's close control starts 4 below the strip at every size |
| Strip contrast | an existing pair pinned by the contrast test, no new token (section 7) | `text.primary` on `surface.sunken` (the pair the RouteMarkers preview card uses); the button is the ghost `brand.primary` pair on sunken, which `contrast.test.ts` pins |

These are the mock's numbers. BR-6 to BR-9 measure the real screens (`apps/mobile/e2e/web/browse.spec.ts`).

## Constants

Values that are not tokens. Each derives from code or a token. The PRs that build them write them as named constants (CLAUDE.md section 4).

| Where | Value | Derived from |
|---|---|---|
| Section control label cap | 23.4 px (1.3 x `typography.size.body`) | the Learning Route tab label cap (`design/screens/learning-route/README.md`, Constants): measured, the three English labels fit a 93 px segment up to that size. BR-7 sets `maxFontSizeMultiplier` 1.3 with `numberOfLines` 1 and `adjustsFontSizeToFit` on native, so a longer ES or KO label shrinks instead of being cut |
| Card thumbnails in rows | 64 (`spacing.jumbo`) | RouteMarkers D9 (episode cards, the item page's card) |
| Card on the end screen | 96 (`touchTarget.hero`) wrapper, `borderWidth.thick` rarity border, 90 face | CardArt's `CardArtThumb` (Results), unchanged |
| Lesson number disc | 44 | `EpisodeDetailView`'s disc, unchanged (RouteMarkers) |
| Trail badge | 40 | `BADGE_SIZE`, `screens/my-route/StageBadge.tsx` |
| Journey cell initial | 28 dp (`typography.size.title`, not scaled) | the cell initial is cell art (RouteMarkers) |
| Word-face text on a card | `min(0.4 x size, 0.8 x size / glyphs)`, never under `caption` | CardArt spec, "Korean word" face |
| App breakpoints | 600 px, 900 px | `layout.breakpoint` (F-LAYOUT-001) |
| Shadows | `0 2 8` at 0.06; `0 12 32` at 0.18 | `shadows.card`, `shadows.modal` (shadowColor `text.primary`) |
| Font stack | the system stack | `typography.family.sans` is `'System'`, which the web build resolves to this stack |

## Strings

Every drawn string comes word for word from one of these sources. No string is new to the spec.

- **Spec section 6 drafts**: All lessons; the how-to line; the sampler scope line; the fallback line; the pointer line; Preview. Nothing is saved.; This page is for parents and teachers.; Keep lessons on this device for 7 days, also offline; That is the whole lesson.
- **Spec sections 4.2 to 4.9**: Close; Lesson display; Route, Journey, Library; Offline; 7 stages, from letters to your own words; This letter is practiced across Stage 1.; This lesson is not in this version of the app yet.; About N minutes; What this teaches; Where it sits; See on the Journey; The card it awards; Taught here; Preview this lesson; Lesson, Story, Words; See the sources; Preview the questions; Opens with the Family Plan or a Group License [BY]; Open billing; Leave preview; At this point a learner sees 1 to 3 stars and collects:; A learner can read it again any time.; Next lesson; Preview again; Back to the lesson page; Romanization; Language; the three Access lines and their buttons; Then open the grown-up area again.
- **Wireframe placeholders** (`browse/*.md`), final in `caregiver.browse` when each PR adds them: Lessons, Cards in this episode, Coming later, Letters, Words, Syllables, Skills, Steps, Levels, Scenes, Key words, Sources, Preview this story, Preview the flashcards, N words, Leave this preview?, Keep going, Leave, Always shown, Hidden until tap, These choices change only this preview. No learner's settings change., Done, Grown-up pages need the internet., That is the whole story., Next story, Read again, Back to the story page, lesson n of m, N levels · N scenes.
- **Dictionary values, read by reference**: the learner step names (`learner.quest.step.*.pill`: Hello, Look and listen, Look and learn, Practice, Try it, Quick check, Finish); skills (`learner.myRoute.skill`: Read, Listen, Write); trail and Journey words (Open, A taste, Coming later, Stages 5 to 7, the taste note); Library labels (Cards, Story Time, All, the rarity words); Hear it; Continue; Page n of m; the endonyms (`LOCALE_STATUS`); "Not open yet" and the closed cell label, F-ENT-003's `learner.access.notOpen` and `a11y.access.notOpen`.
- **Content**: titles, subtitles, Hoya lines, letters, words, glosses, sound hints and card names come from the bundle.

All of them pass the caregiver banned list (`behind`, `lazy`) and the spec's list ("kids", an age range, "Premium", "upgrade now", "unlock", "fail", "wrong", "behind"). "Browse" appears in no drawn string, and no price appears anywhere.

## Decisions taken in this design pass

1. **Header in two rows.** Close (or the back arrow) sits in the one fixed top-left position, and Lesson display is the chip button at the right of the same row. The title sits below them, with the Offline chip beside it. "All lessons" between two 64-tall buttons does not fit 320 on one row. The order the spec gives (Close, title, Lesson display) is kept for reading and focus order. At 200 % text the row wraps.
2. **The section control is a segmented track, not `SectionTabs`.** `SectionTabs` is a wrapping tablist; section 7 asks for a radiogroup that never wraps. The selected segment takes `SectionTabs`' selected look (`brand.primary` fill, `text.onPrimary`, bold), so it reads like the learner Library's tabs. From the regular class the track is capped at 30rem, so it does not stretch across a wide window.
3. **The pointer line is a link sentence with an arrow.** It is underlined in `brand.primary` (the ghost-label pair on canvas) and is 64 tall. It is drawn for account passes only (fallback included, since a fallback is still an account pass), and never for a gate or kept pass.
4. **Access until BR-12b, unknown source.** The spec names the pre-BR-12b form only for the gate source. The unknown source's primary also goes to `/?gate=browse`, so it takes the same form until BR-12b ships: [[ Back to the app ]] with "Then open the grown-up area again." added to its line, and Sign in kept. BR-6 builds both.
5. **Route rows go to the Journey; later rows are not buttons.** A stage row with a chevron is one button ("…. Shows it on the Journey."). Coming-later rows (Sentences, Stages 5 to 7) have no lesson to show, so they are plain rows. This matches `expandable={false}` (spec section 11, BR-5b note): no row opens in place.
6. **No pips on the browse trail.** `browseRouteTrail` returns no pip groups and no fill (the browse state). Each row is its badge, title, state pill and one-liner.
7. **Journey cells keep E3-D's shapes.** Coming later is an empty `surface.sunken` cell with no lock glyph (E3-D D5). A closed cell is the dotted ring at the class sizes 40, 48 and 56. The legend line ("Not open yet") shows only while the grid draws a ring (E3-D D4). The taste note shows only on a row with an open cell (E3-D D11), so it is left out on Stages 2 and 4 in the sampler frame.
8. **Lesson rows put skills and Open on one line.** Title, minutes, the letters (or a taste lesson's first three words), then the skills chips with [ Open ] at the right of the same line. A closed row adds the grown-up caption above that line. [ Open ] is a ghost button: the outline has no primary action (wireframe, "home is a map").
9. **The item page's primary is pinned on phones.** With five fact rows the button would sit below the fold at 375. It is pinned to the bottom edge on the compact class, with a `border.subtle` top rule on canvas, and is inline from the regular class up. This keeps the wireframe's order (facts first) and makes the action one tap away.
10. **Focus marking.** The focus line "Taught here: ㄴ n" sits on `surface.sunken` above the title. The focused chip in the Letters row gets a `borderWidth.thick` `text.primary` outline (shape) and the label "…, taught here" (words), never colour alone.
11. **Syllables get their own row.** `itemFacts` returns syllables apart from words, because a syllable has no gloss. The wireframe has no row for them, so "Syllables" is drawn after Words. An empty row is hidden: no Skills row for a lesson whose `questSkills` is empty, no Letters row for a taste lesson.
12. **Steps are the player's own names, in order.** "Hello · Look and learn · Practice · Try it · Quick check · Finish" (`questStepLabel`), not the wireframe's sample ("Meet the letters · Practice · Check · Card").
13. **"Where it sits" uses the Journey column label.** "Stage 1 · Letters · lesson 1 of 3" uses `themeColumnLabel` (the first word of the theme title), the same word as the Journey's columns. A shelf story's quest reads "Stage n · Theme", with no position.
14. **The closed box replaces the primary, in place.** On `surface.sunken`: the grown-up line in Body semibold, then [ Open billing ] as a ghost button for an account pass (not kept, not a fallback). It has no glyph, no price, and no learner word. The facts above it are the same as on the open page.
15. **The strip is one row.** "Preview. Nothing is saved." is on the left, and [ Leave preview ] (a compact ghost button, 64 tall) is on the right. The text wraps beside the button instead of the button dropping to a second row, which keeps the strip at 73 to 82 tall. The strip uses the `surface.sunken` / `text.primary` pair with a `border.strong` rule under it. On the end screen it has no button and is 64 tall.
16. **The end screen shows the card as a still thumbnail.** It is CardArtThumb at 96 with the card's English title and its Korean with romanization. It has no flip and no burst. Next lesson is the primary, and the other two are ghost buttons. When there is no next lesson, Preview again becomes the primary.
17. **Lesson display is a bottom sheet on phones and a centred dialog from the regular class.** Romanization is two radio rows. Language is a row of endonym chips (radiogroup), hidden while only English ships. Done is the primary, and Escape and the scrim also close the sheet.
18. **The word topic page is a list, not a grid.** Each row is the 64 picture tile, the Korean with romanization, the gloss, and a 64 Hear button (a `brand.secondary` outline, "Hear {romanization}"). Until F-VOC-003 ships there is no primary action (wireframe D).
19. **Covers carry no Korean.** Story covers are their theme tint here, because the story scene art is not drawn in this mock. Taught Korean always appears with its romanization in a `KoreanText` chip, never bare on a picture. The only exception is CardArt's word face, which is the shipped card face, and its Korean and romanization are printed beside it.

## Notes for the PRs

- **BR-7: Stage 2 lessons have no skills.** On `main`, `questSkills` returns an empty list for `quest:stage2-life-q1` and `quest:stage2-nature-q1`. Their games are not mapped in `logic/my-route/skills.ts`, so the Skills row and the skills chips are hidden for them in this mock (`item-states.html`, `episode-states.html`). Before BR-7, either map those games or accept the hidden row; the item page must not draw an empty "Skills".
- **BR-7: the Library today has only Cards and Words.** No story in `content/stories/` is reviewed (F-STORY-004 D14), so `browseLibrary` returns no Story Time or Culture group. The Story Time frames are drawn with draft stories and labelled so; their facts (levels, scenes, key words) are read from the draft files and will change with review.
- **BR-9: most Animals pictures are text tiles.** Eight of the twelve Animals words have no WordArt drawing yet (`word:animal-*`), so PictureArt draws its text tile, as the learner topic would. F-VOC-003 T8 (`canRender`) decides whether such a topic is listed at all; BR-9 passes that check (spec section 11, BR-4 note).
- **BR-6: the Access screen has no Close.** It is the root's only screen when there is no pass, and it has nothing to return to.
- **BR-8: the strip at 200 % text** is 203 tall at 320. That is still above the lesson and never over its controls, as section 7 asks. If beta shows it crowds the games, the wireframe's open question (collapse after the first screen) applies; the default is unchanged.
