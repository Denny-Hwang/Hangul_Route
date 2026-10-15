Status: ready (spec and wireframe pass LV-0; amends F-TCH-004, F-APP-001 entry points and F-SITE-002 copy; implementation rows in section 15)

# Amendment: Lecture mode v2 — parents and teachers, easy to find, ready-made lessons, every stage on the big screen

> Basis: `origin/main` `3b52a3969` (2026-10-15). Every `file:line` below is at that commit. F-TCH-004 rows 0 to 12 are all merged; this amendment changes what they built and adds rows LV-0b to LV-7 and LV-S1 to LV-S4 (section 15).
>
> Wireframes (this PR): `design/wireframes/classroom/lecture-presets.md` (presenter home with presets at 320 / 768 / 1180, the preset preview, the console setup page presets-first), `design/wireframes/classroom/lecture-big-screen-v2.md` (the new slide families on the big screen), `design/wireframes/classroom/lecture-entry-points.md` (the entry cards, the nav item, the learner app's grown-up card, the site lines).

**Owner request 2026-10-15 (translated):** "Let parents and teachers both use lecture mode, and make 'lecture mode' much easier for users to notice. Also suggest a variety of default curricula for lecture mode: making a first-time presenter pick detailed items is too hard."

**Standing rules that apply here:** audience is anyone at any age (no age wording) · UI strings only through `packages/i18n` (`useMessages`), en + es + ko in the same PR, F-I18N-001 §3.10 style guide and glossary, one reviewer checks them · tokens only, no emoji · reading, listening and writing only (no speaking measurement and no speaking UI) · anti-shame (CLAUDE.md §1) · D1 migrations additive only (this amendment adds none) and server-first deploy order · no prices, Stripe sandbox only · never enable `CLASS_TRANSFER` · production level: every row ships finished, reviewed by the multi-agent review.

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | Lecture mode is **switched off in every build**: `lectureModeEnabled()` is true only when `NEXT_PUBLIC_LECTURE_MODE === 'enabled'` (`apps/web/src/lib/console/config.ts:84-86`), and no flip PR exists (F-SITE-002 §3.9 table: "F-TCH-004 names no flip PR yet"). Every console entry point and the setup page (it shows `console.lecture.comingSoon`) hide behind it, and the site claim `lectureMode` is `false`. | **LV-D1**: the flag becomes a launch default (on unless set to `false`, `0`, `off`, `no` or `disabled`), the `browseEnabled()` pattern; the site claim flips in the same PR (row LV-7). |
| 2 | Where it is on, it is **one plain button among up to nine** in a space's action row (`app/(console)/teach/space/page.tsx:224-250`), labelled "Lecture" in English, "Proyectar" in Spanish and "강의" in Korean; nothing on the teacher home, the family home, the navigation, the learner app or `/parents`. | **LV-D2 / section 3**: one plain name, **Lecture mode** ("Teach on a big screen"), a card at the top of both homes, a nav item for both personas, a card in the learner app's grown-up area, a line on `/teachers` and `/parents`. |
| 3 | **Parents can already compose** (the setup page is visible to `family` `caregiver`, F-TCH-004 §3.11 `:325`; `/parent/space/lecture` re-exports the page, F-APP-001 A-5b), but the page speaks only to classrooms ("Check the classroom device", "Class code on the last slide", "a student's name") and needs a family space. | **LV-D3 / section 6**: family wording, a family needs no roster, and `/present` with presets needs no space at all. |
| 4 | A first-time presenter must **pick items one by one** (console Source + Outline, or the presenter's Quick lesson multi-select). | **LV-D4 / section 4**: six ready-made presets with a default length and one-tap start; item-by-item stays behind **Customize**, never required. |
| 5 | The deck builder **drops most of Stages 2-7**: 177 steps (536 rounds) skipped as `unsupported-step`, 141 Discover sentence / pattern / exchange / realia items flattened into plain word cards, zero quiz slides, and repeated word cards (Stage 2: 433 word slides for 144 different words). | **LV-D5 / section 5**: new slide families (reading pages, questions, sentence building, write together), one card per word per deck, a coverage ratchet test that ends at zero skipped steps. |

---

## 1. Measurement: what the presenter builds today (Stages 1-7)

**Method** (read-only, reproducible; nothing committed by LV-0): a throw-away vitest file in `apps/mobile/src/logic/lecture/__tests__/` expanded one deck per shipped grid episode (`{ kind: 'episode', id }`, `seed: 1`, English bundle `lectureBundle('en')`, a Korean voice present) with the shipped `expandDeck`, and walked each quest's steps through `bundle.scopeFor` to count the step kinds the builder skips and the rounds those steps hold. Row LV-2 commits the same walk as `deck-coverage.test.ts` (section 14), so these numbers become a ratchet.

Columns: **slides** built (title, letter, vocab, quiz, card, sequence, end) · **word cards** (vocab slides) and the number of **different words** among them · **quiz** slides · **skipped** steps (all `unsupported-step`), by step kind with the rounds they hold · **Discover flattened**: upper-stage Discover items that reach the class only as plain word cards (their sentence frame, speaker turns or drawn realia are lost; `discoverItemTexts`, `packages/content-schema/src/schemas/quest.ts:97-112`, `deck-builder.ts:395-407`).

| Stage · theme (cell) | Quests | Slides | Word cards (different) | Quiz | Skipped steps (rounds) | Discover flattened |
|---|---|---|---|---|---|---|
| 1 · letters | 3 | 43 | 0 (0) | 19 | listen-pick check 3 (6) | — |
| 1 · life | 3 | 49 | 12 (12) | 19 | listen-pick check 3 (6) | — |
| 1 · rites | 3 | 36 | 4 (4) | 5 | listen-pick 2 (12), check 3 (6) | — |
| 1 · nature | 3 | 32 | 16 (14) | 0 | listen-pick 3 (18), check 3 (6) | — |
| 1 · crafts | 3 | 38 | 20 (17) | 0 | listen-pick 2 (12), check 3 (6) | — |
| 2 · letters (Word Builder) | 6 | 172 | 139 (75) | 0 | listen-pick check 6 (12) | — |
| 2 · life | 3 | 86 | 76 (19) | 0 | listen-pick check 3 (6) | — |
| 2 · rites | 3 | 83 | 70 (15) | 0 | listen-pick check 3 (6) | — |
| 2 · nature | 3 | 84 | 70 (17) | 0 | listen-pick check 3 (6) | — |
| 2 · crafts | 3 | 83 | 78 (18) | 0 | listen-pick check 3 (6) | — |
| 3 · letters | 3 | 16 | 11 (11) | 0 | order-it 3 (15), listen-pick 3 (12), check 3 (6) | sentence 5, pattern 3 |
| 3 · life | 3 | 53 | 48 (31) | 0 | order-it 3 (15), check 3 (6) | sentence 6, pattern 3 |
| 3 · rites | 3 | 19 | 14 (14) | 0 | order-it 3 (15), listen-pick 3 (12), check 3 (6) | sentence 6, pattern 3 |
| 3 · nature | 3 | 17 | 12 (12) | 0 | order-it 3 (15), listen-pick 3 (12), check 3 (6) | sentence 6, pattern 3 |
| 3 · crafts | 3 | 53 | 48 (15) | 0 | order-it 3 (15), check 3 (6) | sentence 6, pattern 3 |
| 4 · letters | 3 | 20 | 12 (12) | 0 | tap-respond 3 (9), check 3 (6) | exchange 6 |
| 4 · life | 3 | 20 | 12 (12) | 0 | tap-respond 3 (9), check 3 (6) | exchange 6 |
| 4 · rites | 3 | 21 | 12 (12) | 0 | tap-respond 3 (9), check 3 (6) | exchange 6 |
| 4 · nature | 3 | 20 | 12 (11) | 0 | tap-respond 3 (9), check 3 (6) | exchange 6 |
| 4 · crafts | 3 | 20 | 12 (10) | 0 | tap-respond 3 (9), check 3 (6) | exchange 6 |
| 5 · all five books | 14 | 186 | 0 | 42 | none | — |
| 6 · letters | 3 | 16 | 11 (11) | 0 | realia-read 3 (12), type-hangul 3 (9), check 3 (6) | realia 5 |
| 6 · life | 3 | 33 | 28 (27) | 0 | realia-read 3 (13), tap-respond 2 (8), type-hangul 1 (3), check 3 (6) | realia 3, exchange 4, sentence 2 |
| 6 · rites | 3 | 22 | 17 (17) | 0 | realia-read 3 (15), type-hangul 3 (9), check 3 (6) | realia 3 |
| 6 · nature | 3 | 20 | 15 (15) | 0 | realia-read 3 (12), type-hangul 2 (8), tap-respond 1 (4), check 3 (6) | realia 4, exchange 3 |
| 6 · crafts | 3 | 23 | 18 (17) | 0 | realia-read 3 (12), type-hangul 2 (6), tap-respond 1 (4), check 3 (6) | realia 4, sentence 5 |
| 7 · letters | 3 | 15 | 10 (9) | 0 | type-hangul 2 (7), trace-word 2 (8), order-it 1 (4), write-frame 1 (3), order-it check 3 (6) | sentence 2, pattern 2 |
| 7 · life | 3 | 20 | 15 (15) | 0 | type-hangul 2 (8), write-frame 2 (6), trace-word 1 (4), order-it 1 (4), order-it check 3 (6) | sentence 2, pattern 3 |
| 7 · rites | 3 | 19 | 14 (13) | 0 | order-it 2 (8), write-frame 2 (6), type-hangul 1 (4), trace-word 1 (4), order-it check 3 (6) | sentence 4, pattern 3 |
| 7 · nature | 3 | 17 | 12 (12) | 0 | order-it 2 (8), type-hangul 2 (7), trace-word 1 (4), write-frame 1 (3), order-it check 3 (6) | sentence 6, pattern 3 |
| 7 · crafts | 3 | 17 | 12 (12) | 0 | type-hangul 3 (12), order-it 2 (6), write-frame 1 (3), order-it check 3 (6) | sentence 6, pattern 3 |

Stage 5 (the five story books) and the 24 shelf stories expand completely (story, sequence and check slides; 0 skipped). "check" = the quest's Check step (F-QUEST-002), a `listen-pick` round set in Stages 1-6 and an `order-it` set in Stage 7.

**Totals, the 25 grid cells of Stages 2, 3, 4, 6 and 7:** 969 slides, **0 quiz slides**, **177 skipped steps holding 536 rounds** (listen-pick check 63 / 126 rounds · order-it 23 / 105 · type-hangul 21 / 73 · tap-respond 19 / 61 · realia-read 15 / 64 · order-it check 15 / 30 · listen-pick 9 / 36 · write-frame 7 / 21 · trace-word 5 / 20), and **141 Discover items flattened** (56 sentences, 37 exchanges, 29 patterns, 19 realia). Stage 1 loses 22 listen-pick steps (72 rounds).

**Three findings beyond the skip list:**
1. **Repeated word cards.** `card-match` and `pic-word-match` push a vocab slide per pair of every board, with no "already shown" set (`deck-builder.ts:311-331`; letters have `seenJamo`, words have none). Stage 2's five cells show 433 word cards for 144 different words; Stage 2 · letters alone is 172 slides.
2. **No questions after Stage 1.** Practice and apply steps of the word games become more word cards, never a quiz, and every Check step is skipped, so an upper-stage deck has no question slide at all.
3. **Rule 12's minutes** count only quests, activities and quiz slides; a `revisit`, `jamo-set`, `cards` or vocabulary block counts 0, so a warm-up made of those shows "about 0 min" (section 4.4).

---

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| LV-D1 | **Lecture mode is on by default, with two kill switches.** Web: `lectureModeEnabled()` follows the `browseEnabled()` pattern (`config.ts`: trim, lower-case, a list of off values; `reportsEnabled()` accepts only `false` / `0` and is not the model): on when unset; only `false`, `0`, `off`, `no` or `disabled` (case and surrounding spaces ignored) switch it off; it hides E1-E4. The site lines (E7) do not read this flag: they follow the `lectureMode` site claim, a code constant by design (`apps/web/src/data/site-claims.ts`: "A code constant, not a build variable", so no stray environment value switches a claim; and hangulroute.com is a separate build from app.hangulroute.com, so the console variable never reaches it). Learner app: a new `flags.lectureModeEnabled` reads `EXPO_PUBLIC_LECTURE_MODE` with the same off values (`parseKillSwitch` plus `disabled`) and hides E5. LV-6 adds the app flag with launch default **off**; LV-7 turns both launch defaults on in one PR with the `lectureMode` site claim, after the presets (LV-3, LV-4) and the entry points (LV-5, LV-6), so first-time presenters land on one-tap lessons. Both variables are build-time (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`): switching one off needs a Pages rebuild and redeploy of that app. They hide the **entry points only**; `/present` and its presets stay reachable by URL, by design (F-TCH-004 TD2), so during a kill-switch incident the site line still describes a feature that is served. **Coordinated rollback of the site line**: if lecture mode is withdrawn for longer than an incident (more than one day off, or `/present` itself taken down), a one-line PR sets `SITE_CLAIMS.lectureMode` back to `false` (its tests pin both states) and the site redeploys; LV-7 writes this step into the owner runbook and the `site-claims.ts` hand-off table. | The presenter (F-TCH-004 PR 6-12) is merged and served at `app.hangulroute.com/present`; a flag nobody sets hides a finished feature. The kill switches stay for an incident. |
| LV-D2 | **One plain name in every locale**: **Lecture mode** with the line **Teach on a big screen** (es **Modo proyección** · "Enseña en una pantalla grande"; ko **강의 모드** · "큰 화면으로 가르쳐요"). The console page title (and its `titleFor` tab title and `comingSoon` line), its entry button, the nav item, the cards, the presenter's own home title and tab title (`learner.presenter.home.title`, `learner.presenter.docTitle`) and the site lines all use it (section 12, rows marked changed). A test asserts the same title value across `console.lecture.title`, `console.shell.nav.lecture`, `caregiver.lecture.title` and `learner.presenter.home.title` in each locale. | Today the same feature is "Lecture", "Proyectar" and "강의" in three places and has no line saying what it does. |
| LV-D3 | **Parents and teachers have the same lecture mode.** Every family `owner` / `caregiver` and class `owner` / `teacher` can open it (the existing `plan.write` predicate, `canComposeIn`); a family needs no learners; the presenter itself still needs no sign-in (F-TCH-004 TD2). Copy addresses a family as a family (section 6). | The spec already allows `family` `caregiver` (§3.11); the gap is wording, findability and the flag. |
| LV-D4 | **Six presets, one tap, Customize optional.** A preset is a rule that turns what is known (a plan, the Learning Route position, what this screen showed before, the bundled catalogue) into ordinary deck blocks. The same pure resolver runs in the console, the presenter and the learner app (`resolvePreset`, content-schema, section 4.3). The resolved outline is shown before Start. On the console, **Customize** opens the item editor prefilled with that outline; on the presenter it opens Quick lesson (which cannot hold every block kind) with nothing chosen (section 4.6). | A first-time presenter should not need to know the catalogue. Ordinary blocks keep one deck format, one builder and one codec. |
| LV-D5 | **Every shipped step kind gets a slide.** Reading pages (sentence, pattern, read along, realia), questions (listen, reply, realia question), sentence building, and write together (type, trace, frame). The class writes on paper or on its own devices; the big screen never takes typed input and stores nothing typed. | Stages 2-7 must be teachable from the front; the skip list (section 1) is the defect list. |
| LV-D6 | **Deck format v2, additive and only when needed.** Only a deck holding a `word-review` block is v2 (it may also carry an optional `preset` id). Every other preset resolves to an ordinary **v1** deck with an existing `source` (`plan` for N1, `revisit` for a revisit warm-up, `catalogue` for every other console preset, `quick` for presets resolved on the presenter or in the learner app), so an older cached presenter opens it. The encoder writes the lowest version the deck needs; the presenter accepts v2 (LV-2) before any surface emits one (LV-3, LV-4, LV-6). Which preset was used reaches telemetry through the presenter's own in-session state when it resolved the preset itself, or the v2 `preset` field; never through a v1 deck. | F-TCH-004 §3.2 amendment (6): a new block kind means `v: 2`, accepted before emitted. Emitting v2 for every preset would make every preset link fail (`unsupported_version`) on a classroom PC still running an older cached build. |
| LV-D7 | **Presets never add names or codes.** A preset never adds a `class-code` block (the join code would ride in the link, F-TCH-004 §8 item 4) and never puts a learner's name in the deck title (titles are the localized preset names). The picker default is `numbers` on `/present`, the roster rule of §3.10 on the console, and `none` for a family of one. | Privacy by default; a teacher can still add the class code and choose names in Customize. |
| LV-D8 | **Write together, never type here.** Write-together slides show a prompt, a frame or a ghost word and reveal an answer on the next click. The Stage 7 "Write your name" free-entry round becomes "Write your own name in Hangul on paper" with the sound table shown; no name is ever typed, shown or stored. | Keeps the presenter free of user text (TD8) and of any learner name (§3.10). |
| LV-D9 | **No speaking.** Presets use only the activities `air-write`, `copy-on-paper` and `stretch-break`; no new slide asks the room to speak, and nothing is recorded or measured. `say-together` and `pair-share` stay available in Customize as they shipped. | Owner rule: reading, listening and writing focus. |

---

## 3. Entry points per persona (amends F-TCH-004 §3.1 and §3.11, F-APP-001 §3.8, F-SITE-002 §3.5 / §3.6)

E1-E4 are drawn only while the web `lectureModeEnabled()` is on; E7 only while the `lectureMode` site claim is on (a code constant, flipped by LV-7; rolled back by its own PR, LV-D1); E5 only while the learner app's `flags.lectureModeEnabled` is on (both on by default from LV-7, LV-D1). E1-E3 count only spaces where `canComposeIn` (`lib/console/lecture.ts:251-257`) is true: a school admin with no `teacher` or `owner` role in any class gets the no-space path (`/present`). Wireframe: `classroom/lecture-entry-points.md`.

| # | Where | Who | What | Opens |
|---|---|---|---|---|
| E1 | **Teacher home** `/teach/home` (`shell/teacher-home`) | teacher (class `owner` or `teacher`); a school admin without either role sees the card with the no-space target | A **Lecture mode** card at the top, above Classes: title, the line "Teach on a big screen", one body line, **[[ Start lecture mode ]]**. | One composable class: `ROUTES.spaceLecture(id)`. Several: a class choice inside the card (radio rows by class name, most recent first; no counts, no ranking), then the setup page. None: `${APP_URL}/present` in a new tab (presets work with no class). |
| E2 | **Family home** `/parent` (`shell/parent-home`) | family owner or caregiver | The same card, with the family body line ("Put a lesson on your TV and learn together at home. No setup needed."). Placement (measured in LV-0b, `design/screens/app-shell/lecture-card.md`): from 70em first in the side column, beside and level with the learner cards, above the family actions; below 70em directly after the first learner card (after the first row of learner cards from 45em), so the first screen at 375 x 667 keeps the whole first learner card and shows the card's top (`parent-home-lecture-375-first.png`). | One family: `ROUTES.spaceLecture(id, …, 'family')` (`/parent/space/lecture?id=`). Several families: a family choice inside the card. No family: `/present`. |
| E3 | **Navigation** (`ADULT_NAV`, `lib/console/shell-nav.ts`) | both personas | A **Lecture mode** item (`console.shell.nav.lecture`) after Lessons, shown when `lectureModeEnabled()`. | The persona's single composable space's lecture page; with zero or several, the persona home scrolled to the card (`#lecture-mode`). On a phone the tab row scrolls sideways (the family row's fifth and sixth items start off-screen at 375), so the row scrolls its current item into view on load (LV-5). |
| E4 | **Space page** action row (`teach/space/page.tsx:230-235`) | composers | The button keeps its place and its secondary weight but reads **Lecture mode** (one primary per row; the home cards and the nav item carry the visibility). "Present this plan" and "Revisit together" stay. | Unchanged. |
| E5 | **Learner app, grown-up area** (`ParentDashboardScreen`, behind the grown-up gate; web only, as `GateLessonsButton`; drawn only while `flags.lectureModeEnabled`, LV-D1) | whoever passed the gate | A **Lecture mode** card after `GrownUpHomeCard`: one line, **[ Open lecture mode ]** (`/present`, same tab, nothing handed over), and per learner on this device a **Next lesson for {name}** row (the learner name is on the grown-up screen only, never in the deck or link). | `/present#d=<deck>` built in the app root from that learner's `routeNext` (section 4.2, rule N3). The press asks the gate again after the grown-up session lapses (`gateOpensDirectlyNow`), like See report. |
| E6 | **Presenter home** `/present` | anyone | **Ready-made lessons** (the six presets) is the first section; Recent lessons second; Quick lesson becomes **Customize** (folded). | Section 4. |
| E7 | **Site** `/teachers` §3.6 item 4 and `/parents` §3.5 item 4 | visitors | `/teachers`: the existing `lectureMode` line is reworded to name the feature. `/parents`: a new line behind the same claim. Both are claim lines (F-SITE-002 §3.9), shown by `SITE_CLAIMS.lectureMode`, not by the console kill switch (LV-D1); no link to `/present` or to a console path (the site never links grown-up paths, §3.8). | — |
| E8 | **Class report** "Plan a lesson" (F-REPORT-001) and plan page "Present this plan" | composers | Unchanged; they open the setup page, which now leads with presets (the source they carry, plan or revisit, is preselected as the outline under the presets). | Unchanged. |

**Rules for every entry point:** never drawn disabled (F-APP-001 nav rule) · no learner name in any URL, title or telemetry · the card body says once that nobody's progress changes · touch targets at least `touchTarget.min`, the primary button `touchTarget.hero` on the homes · no "new" badge, no count, no pill (anti-pressure; D5 "no Premium pill").

---

## 4. Presets (amends F-TCH-004 §3.11 and §3.12)

### 4.1 The list, defaults and what each builds

`LECTURE_PRESETS` in `packages/content-schema/src/schemas/lecture-presets.ts` (new, exported from `src/index.ts`, 100 % covered):

| Preset id | Name (en) | Default | Length chips | Builds (rules in 4.2) | Fallback |
|---|---|---|---|---|---|
| `next-lesson` | **Next lesson** | 20 min | 10 · 20 · 30 | This week's plan items; else the lessons after the class's / family's / this screen's place on the Learning Route | `hangul-week-1`, with the line "Nothing to follow yet, so this starts with Hangul week 1." |
| `hangul-week-1` | **Start from zero: Hangul week 1** | 20 min | 10 · 20 · 30 | The quests of the Stage 1 letters cell (`episode:stage1-letters`) in order, then, as time allows, a quiz (20 and 30 min) and writing in the air (30 min) | — |
| `by-stage` | **Stage by stage** | 20 min | 10 · 20 · 30 | One tap on a stage chip (only stages with a ready cell are drawn); the next lessons of that stage | First lesson of the stage |
| `story-time` | **Story time** | 20 min | 10 · 20 · 30 | Ready stories this screen (or this class) has not had, in order, filled to the chosen length; title "Story time" | When all were shown: the first story again, with the line "Every story was shown here, so this starts again from the first." |
| `word-review` | **Word review** | 10 min | 10 · 20 | Words from recent lessons (section 4.2, W1-W3), up to 10 / 20 word cards then a 5 / 10-round word-to-meaning quiz | `warm-up`, with the line "No words this week yet, so this is the warm-up instead." |
| `warm-up` | **Quick 10-minute warm-up** | 10 min | 10 (no chips) | Letters to revisit (topped up to at least 4), a 4-question sound quiz, writing in the air | Hangul week 1's first six letters (and the top-up source) |

Order on every surface: the table order, except that `next-lesson` is first only when there is something to follow (a plan, a position or a Recent lesson); with nothing to follow, `hangul-week-1` is first and `next-lesson` is drawn last with its fallback line under it.

### 4.2 Exact deck rules

Common terms: **route quests** = `routeCatalogOf(CATALOG)` (`packages/content-schema/src/catalog/route-catalog.ts:15`), lesson quests only (`grid`), `playable` only, in route order. **m(block)** = the catalogue minutes of a quest or story (`CatalogQuest.minutes`, `CatalogStory.minutes`), an activity's own minutes, 1 per quiz round, and 1 per two slides for `revisit`, `jamo-set`, `cards` and `word-review` (section 4.4). **T** = the chosen length.

**Fill rule `fillToLength(candidates, T, review)`** (pure):
1. Take candidate content blocks in order while `running + m(block) <= T`; the first candidate is always taken (a lesson is never empty).
2. If `review` and `T - running >= 5`, add `{ kind: 'quiz', from: 'previous', rounds: 4 }` (4 minutes). The resolver does not count taught items: it reads the catalogue only, and Stage 3-7 quests carry `teaches: []` (`catalog/data.ts`), so a count there would drop the quiz from every upper-stage preset. The builder already skips a quiz whose scope has fewer than 4 letters or words (`scope-too-small`, `deck-builder.ts:644-656`), so the decision stays pure and gives the same blocks on every surface.
3. If `T - running >= 2`, add one activity: `air-write` when the taken blocks are all Stage 1 quests (at least one), otherwise `copy-on-paper` (so a Story time deck, which holds only stories, gets `copy-on-paper`), with `minutes = min(5, T - running)`.
4. At most `LECTURE_MAX_BLOCKS` (30) blocks; never a `class-code` block (LV-D7).

**N — `next-lesson`**
- **N1, console, a live plan this week**: the blocks of `planOutline(plan, today)` (`lib/console/lecture.ts:96`, the existing "Present this plan" rule), then `fillToLength(…, review: true)`. Deck title: the plan title when it passes `titleProblem` (`lecture.ts:346`), else the preset name.
- **N2, console, no plan: the Learning Route position.** From the roster rows' `summary.journey` (`JourneySummarySchema`, `schemas/sync.ts:49`): learners with a non-null `here`; **S** = the stage most of them are in (ties: the earlier stage); **p** = the smallest `done + known` of `stages.find(s => s.stage === S)` among them (`known` = placed out and not done, so a class that placed out of early lessons does not restart at them; a missing entry counts 0). Candidates: route quests of stage S from index p, then the following stages' route quests. One learner (a family of one) gives that learner's place. Only these two numbers are read; no learner is named, compared or counted on screen. No usable summary: fallback.
- **N3, learner app grown-up card (E5)**: the learner's `routeNext` quest (`apps/mobile/src/logic/route-next.ts`; a `quest` result only; `free-end` and `rest` give the fallback) and the route quests after it in route order. `routeNext` can return a homework or plan quest that is not a route quest (not among the `routeCatalogOf` grid quests); then the candidates start instead at the route quest after the learner's furthest done route quest by route order (the first route quest when none is done). Built in the app root, which owns the profile; the deck holds quest ids only.
- **N4, presenter `/present`, no console**: the route quest after the furthest route quest that any Recent lesson started in the last 60 days contains (by route order; a lesson's quests are `questIdsOfBlocks` of its deck, section 4.3); no Recent lesson: fallback.
- Then `fillToLength(candidates, T, review: true)`. Deck title: "Next lesson" (`presets.next.title`) in the presenter language.

**H — `hangul-week-1`**: candidates = the quests of the Stage 1 letters cell in cell order (q1, q2, q3: 5 catalogue minutes each, `catalog/data.ts:131-133`); `fillToLength(…, review: true)`. What the rule gives: **10 min**: q1 + q2 (10; nothing fits after). **20 min**: q1-q3 + quiz (15 + 4 = 19; 1 minute left, no activity). **30 min**: q1-q3 + quiz + air-write 5 (24). Title: "Hangul week 1". `lecture-presets.test.ts` holds a table of every preset at every length against `CATALOG`, and these three rows are in it.

**S — `by-stage`** (needs the stage chip; one more tap, nothing else): candidates = the route quests of the chosen stage from the first one this context has not shown (console: the class position N2 when S is the class's stage, else the stage's first quest; presenter: the first route quest of S that no Recent lesson in the last 60 days contained, by `questIdsOfBlocks`), in route order, continuing through that stage only. Stage 5 uses its cell quests (`quest:story-<slug>-read`) as ordinary quest blocks, like every other stage; they already expand completely (section 1). `fillToLength(…, review: true)`. Title: "Stage {n}" (`presets.stage.chip`).

**T — `story-time`**: candidates = ready stories (`CatalogStory.status === 'ready'`, the Library's review gate, F-TCH-004 §3.3 rule 5) by `order`: first the ones this context has not shown (presenter: not a `story` block of a Recent lesson of the last 60 days; console: all), then, when those run out, the shown ones by `order`; a story is never twice in one deck. The console never takes a story whose `recommendedStage` is more than one above stage S of N2. Each candidate is a story block `{ kind: 'story', storyId, checks: T >= 20 }` whose m is the story's catalogue minutes (4 to 6; its check slides are inside them, rule 12), and `fillToLength(…, review: true)` fills to the chosen length like every other preset (the quiz covers the stories' words; the activity is `copy-on-paper`), so the 10 / 20 / 30 chips give decks of about that length. The restart line shows when no candidate was unshown. Title: **"Story time"** (`presets.story.title`) in the surface locale, never the story's own title: catalogue story titles are English only, and one ("Pansori Tales: Heungbu's Swallow and the Clever Rabbit (Traditional Tales)", 75 characters) is over the 60-character `LectureDeckSchema.title` limit (`lecture.ts:126`).

**W — `word-review`** (deck v2 block, section 4.5):
- **W1 console**: quest ids of the plan items of this week and last week (≤ 12, this week first), plus the `rollup.vocabRevisit` word ids (at most 3, `lib/console/rollup.ts:21-26`) only when at least 2 learners in the space carry `summary.vocab`, so a family of one or a class of one never projects one person's needs-practice list. `vocab` is in `TEACHER_HIDDEN_SUMMARY_KEYS` (`schemas/transfer-consent.ts:149`), so a class space never has rollup words: they exist for family spaces only.
- **W2 presenter**: `questIdsOfBlocks` of the Recent lessons started in the last 7 days (≤ 12, newest lesson first, section 4.3).
- **W3 learner app**: quest ids that learner finished in the last 7 days (≤ 12, from the app's own progress; nothing leaves the device but ids).
- Block: `{ kind: 'word-review', questIds, vocabIds, rounds: T === 10 ? 5 : 10 }`; the presenter shows at most 10 (10 min) or 20 (20 min) word cards, so under rule 12 (4.4) the full deck is exactly the chosen length: **10 min** = `ceil(10 / 2)` + 5 rounds = 10; **20 min** = `ceil(20 / 2)` + 10 rounds = 20 (fewer words give a shorter deck, never a longer one). No ids, or fewer than 4 words once expanded: fallback.

**U — `warm-up`** (10 min, fixed): `{ kind: 'revisit', chars }` (it ends with a sound quiz of `min(4, letters)` rounds, §3.3 rule 3, `deck-builder.ts` `revisitBlock`) + `{ kind: 'activity', preset: 'air-write', minutes: 3 }`. `chars`: console `rollup.revisit` (≤ 3, topped up from the plan's taught letters to 6); presenter and learner app: the letters taught by Recent lessons of the last 7 days (≤ 6). On every surface only entries matching `LECTURE_REVISIT_CHAR_RE` (one compatibility jamo, `lecture.ts:59`) are kept, before de-duplication and the top-up: catalogue `teaches` also holds final-consonant entries such as `ㄴ/final` (Stage 1 rites and nature), which the `revisit` block cannot hold. No letters at all on any surface: ㄱ ㄴ ㄷ ㅏ ㅓ ㅗ (the first six letters of Hangul week 1). **Top-up on every surface**: when `chars` holds 1 to 3 different letters, the next of ㄱ ㄴ ㄷ ㅏ ㅓ ㅗ not already in it is appended until it holds 4, so every warm-up has at least 4 letters and exactly 4 quiz questions (as the console already tops up toward 6). Minutes under rule 12: 4 letters = 2 + 4 + 3 = 9, 6 letters = 3 + 4 + 3 = 10. Title: "Quick warm-up".

Every resolved deck: `seed` from the caller's clock (`Date.now() % 2^31`, as Quick lesson), `options` = the defaults (romanization `always`, stroke guide on, 5 quiz rounds, sound on, `uiLocale` = the surface's locale), `picker` per LV-D7, `source` per LV-D6 (`plan`, `revisit`, `catalogue` on the console; `quick` on the presenter and in the learner app). Only a deck with a `word-review` block is v2, and only it may carry `preset: <id>`.

### 4.3 One resolver, three callers

```ts
// packages/content-schema/src/schemas/lecture-presets.ts (pure; 100 %)
export const LECTURE_PRESETS = ['next-lesson', 'hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up'] as const;
export const PRESET_DEFAULT_MINUTES: Record<LecturePreset, 10 | 20 | 30>;
export const PRESET_LENGTHS: Record<LecturePreset, readonly (10 | 20 | 30)[]>;
export interface PresetContext {
  catalog: Catalog;                         // CATALOG (both apps already import it)
  plan?: { title: string; blocks: LectureBlock[] } | null;   // N1, W1 (console only)
  position?: { questId: string } | null;    // N2 (console), N3 (app), N4 (presenter)
  shown?: { questIds: readonly string[]; storyIds: readonly string[] };   // Recent, last 60 days (presenter)
  recentWords?: { questIds: readonly string[]; vocabIds: readonly string[] };   // W1-W3
  revisitChars?: readonly string[];         // U
  stage?: StageKey;                         // S
}
export type ResolvedPreset = { blocks: LectureBlock[]; titleKey: PresetTitleKey; fallback: 'zero' | 'warm-up' | 'restart' | null };
export function resolvePreset(preset: LecturePreset, minutes: 10 | 20 | 30, ctx: PresetContext): ResolvedPreset;
export function classPosition(rows: readonly { journey?: JourneySummary }[], catalog: Catalog): { questId: string } | null;   // N2
export function questIdsOfBlocks(blocks: readonly LectureBlock[], catalog: Catalog): string[];   // N4, S, W2
```

- `questIdsOfBlocks` is the one reading of a stored deck's quests: a `quest` block gives its id; an `episode` block gives its cell's quests in cell order; every other kind (story, revisit, jamo-set, cards, word-review, activity, quiz, class-code) gives none; de-duplicated, first occurrence kept. A deck's shown stories are its `story` blocks' `storyId`s. The presenter (N4, S, W2, T) uses only these, so every surface reads a Recent lesson the same way.
- The caller turns `titleKey` into the localized title and builds the deck (`buildDeck` in the console, `quick-lesson.ts`'s deck maker on the presenter, `logic/browse/present.ts`'s on the app).
- The console estimates minutes from the catalogue; the presenter's start screen shows the exact slide count and its own estimate (rule 12 as amended in 4.4). A difference is expected and is not shown as an error.
- **Parity**: `resolvePreset` reads only its arguments and the catalogue, so the same preset, length and context give identical blocks on the console, the presenter and the app. `lecture-presets.test.ts` asserts this with the three callers' context builders fed the same inputs.

### 4.4 Rule 12 amendment (minutes)

F-TCH-004 §3.3 rule 12 adds: a `revisit`, `jamo-set`, `cards` or `word-review` block counts `ceil(slides / 2)` minutes for its non-quiz slides (its quiz slides keep 1 each). Quest and story minutes stay the catalogue's, and they already include the quest's or story's own quiz and check slides: the 1 minute per quiz slide counts only quiz slides outside a quest's or story's own slides (LV-0b observation O1: today the 20-minute Hangul week 1 deck previews as "about 38 minutes" because the 19 Match Sound rounds inside its three quests are counted again). So a preset's preview minutes never exceed the length on its card and are no less than that length minus 5 (LV-2, tested in `lecture-presets.test.ts` and `deck-builder.test.ts`). The console's `aboutMinutes` (`lecture.ts:197`) mirrors this from the block size (letters, cards, words) so both sides round the same way.

### 4.5 Deck v2 (amends F-TCH-004 §3.2)

```ts
export const LECTURE_DECK_VERSIONS = [1, 2] as const;
// v2 adds, and only v2 may hold:
z.object({ kind: z.literal('word-review'),
  questIds: z.array(z.string().regex(/^quest:[a-z0-9-]+$/)).max(12),
  vocabIds: z.array(VocabIdSchema).max(24),
  rounds: z.number().int().min(1).max(10) }).strict()      // refine: questIds.length + vocabIds.length >= 1
// `source` is unchanged (plan | catalogue | revisit | quick); presets use those values (LV-D6)
preset: z.enum(LECTURE_PRESETS).optional()   // v2 only (a deck that already holds word-review), telemetry only
```

- `encodeDeck` writes the lowest version the deck needs (`deckVersion(deck)`); a v1 deck is byte-for-byte what it is today. `decodeDeck` accepts 1 and 2; a v1 fragment holding a v2 feature is `invalid`. The worst-case size test adds a v2 deck with 12 quest ids and 24 vocab ids (still under 8192 characters and 6144 bytes).
- **Builder** (`expandDeck`): `word-review` expands each quest silently (no slides) to collect its `taught` words, adds the `vocabIds` words through the vocab adapter, de-duplicates by Korean, keeps the first 10 (`rounds` 5) or 20 (`rounds` 10), pushes one `vocab` slide each, then the word-to-meaning quiz (`buildCultureQuizRounds`, ≥ 4 words). Unknown ids are counted skips (`unknown-id`), never a crash.
- **Recent pass-through (LV-2, before any surface emits v2).** Today `parseRecent` (`apps/mobile/src/logic/lecture/recent.ts:59-69`) drops every item that fails the strict v1 `RecentItemSchema`, and the next Start saves the filtered list, so a build that cannot read an item would erase it. LV-2 changes the load and save path to keep items it cannot parse unchanged in the raw list it writes back (still capped at `RECENT_MAX` by position, de-duplicated by deck id where readable); only parsed items are shown. A build from before LV-2 still drops them; that is bounded because only `word-review` decks are v2 (LV-D6). `recent.test.ts` adds: a list holding an unknown-version item, then a Start, still holds that item.
- **Stale presenter** (`unsupported_version`): the invalid-link screen asks the service worker to update (`registration.update()`) and offers **Reload** (`learner.presenter.invalid.reload`, section 12.3), so an older cached presenter recovers in one step. Tested with a stubbed service-worker registration (section 14, `presenter-presets.spec.ts`): `update()` is called and Reload reloads; CI does not replay a real previous build.

### 4.6 Customize (never required)

- **Presenter**: the preview (start screen) of a preset has **Customize**: it opens today's Quick lesson (`home.md`) under a disclosure; Quick lesson itself is folded under **Customize** on the home. Nothing in the preset path needs Customize.
- **Console setup page**: the page opens on **Ready-made lessons** (the six presets, the length chips and **[[ Open presenter ]]** for the chosen one, with the resolved outline listed read-only under it). **Customize** expands today's Source / Catalogue / Outline / Options / Helper picker sections with the outline prefilled from the preset. A page opened from "Present this plan" or "Revisit together" (`?from=plan|revisit`) preselects `next-lesson` (plan) or `warm-up` (revisit) and keeps the exact plan or revisit blocks as the outline.

---

## 5. Upper-stage slides (amends F-TCH-004 §3.3 rule 2 and §3.4)

### 5.1 Builder rules (replace "any other kind ... skipped `unsupported-step`")

| Source step (scope kind) | Slides | Notes |
|---|---|---|
| Discover `sentence` item | one **sentence** slide | `ko`, `romanization`, gloss in the presenter locale, the item's picture when `hasPicture` |
| Discover `pattern` item | one **pattern** slide | frame with its `___` slots drawn as boxes, `noteEn` (overlay-localized), the two examples |
| Discover `exchange` item | one **read-along** slide | speaker A and B lines; Read along plays each line and lights it |
| Discover `realia` item | one **realia** slide | the drawn realia (`RealiaSheet`) and its key words as chips |
| `listen-pick` (practice, apply, check) | **quiz** slides, `ask: 'listen'` | one per round; options text or picture with the shape + number markers |
| `tap-respond` | **quiz** slides, `ask: 'reply'` | prompt = the other speaker's line (ko, romanization, gloss); options = replies (ko, romanization), glosses at the answer build |
| `realia-read` | one **realia** slide, then one **realia question** slide per round | the sheet stays on screen beside the question; the answer build rings the answer entry (`answerEntryId`) and marks the option |
| `order-it` (practice, apply, and the Stage 7 check) | one **sentence build** slide per round | section 5.2 |
| `type-hangul` | one **write together** slide per round, variant `type` | prompt (`promptEn`, picture) then the answer |
| `trace-word` | one **write together** slide per round, variant `trace` | the word as a large outline ghost, then romanization and gloss |
| `write-frame` | one **write together** slide per round, variant `frame` (or `own-name` for `freeEntry`) | frame + word bank; `own-name` shows the frame and the sound table, never a name |
| `card-match`, `pic-word-match` | **vocab** slides only for words not yet shown in this deck; when every word of the step was already shown and it has ≥ 4 pairs, the step becomes **quiz** slides (word to meaning, `min(quizRounds, scope.rounds)` rounds) | ends the repeated word cards and gives Stages 2-4 questions |
| any other step without slides | still a counted `unsupported-step` skip | expected count after LV-S4: 0 |

- **One card per word per deck**: a `seenWords` set by Korean text, like `seenJamo`; a repeat is not a skip (nothing is lost). A word taught again with a gloss still upgrades `taught` (§3.3 amendment).
- **Romanization rule** (§3.3 rule 11) applies to every new slide: Korean with no romanization is omitted and counted `no-romanization`. Content validation already requires it on these fields (`KoTextSchema`).
- **Text without a Korean voice** (§3.7): `listen` quizzes show the prompt's romanization only, with the teacher chip ("No Korean voice here. You say it!"), and its Hangul at the answer build (showing the Hangul at once would give the answer away); read along shows every line and the speaker button reads as text.
- **Font** (§3.6): `scripts/build-presenter-font.mjs` derives its glyph list from the new fields too (Discover sentence / pattern / exchange / realia, realia entries and options, listen-pick prompts and options, dialogue lines, order-it sentences, distractors and particle choices, type-hangul targets, trace-word words, write-frame frames, banks and sound tables); `presenter-glyphs.test.ts` covers every new slide. Estimate: about 650 more code points, about 85 KB in all, inside the 150 KB budget; if the measured font passes 150 KB the §3.6 fallback ladder applies (sentence lines at `presenter.size.body` use the system Korean stack).
- **Isolation** (§3.9): the new slides reuse leaf visuals only: `RealiaSheet` (design-system), `PictureArt` (moved from `screens/minigames/` to `components/` with a re-export, as `StrokeHint` was), `KoreanText` / `TaughtKo`. No `*Game.tsx` import; `presenter-isolation.test.ts` unchanged.

### 5.2 Builds of the new kinds

| Kind | Builds (`always`) | With `romanization: 'tap'` |
|---|---|---|
| `sentence` | `[ko+rom, gloss, picture]` (no picture: `[ko+rom, gloss]`) | `[ko, rom, gloss, picture]` |
| `pattern` | `[frame, note, example 1, example 2]` (each example ko+rom+gloss) | the romanization of the frame and of each example at their own build |
| `read-along` | `[line A, line B]`; the `sound` build plays the current line and lights it | romanization of each line one build after its Korean |
| `realia` | `[sheet, key words]` | key-word romanization at its own build |
| `realia-question` | `[question (+ key word), answer]` | option romanizations at the answer build (as quizzes) |
| `quiz` `listen` / `reply` | `[question, answer]` | as quizzes today |
| `sentence-build` | `[bank, tile 1 … tile n, (particle), whole]`: the bank shows the shuffled tiles (seeded, never already in order) and the distractors; each click moves the next correct tile into the sentence line; a particle round shows both choices on its tile, then the one that fits stays; `whole` adds romanization and gloss; the distractors stay in the bank, set back (`presenter.dimOpacity`), never marked wrong | romanization at `whole` only |
| `write-together` `type` / `trace` / `frame` | `[prompt, answer]` (`frame`: `[frame, bank, example]`, the example fills the slot with the first bank word and is labelled "For example") | romanization at the answer build |
| `write-together` `own-name` | `[frame, sound table groups 1-5, sound table groups 6-10]` (120 blocks with their romanization at the 28-unit floor fill 504 units at five groups; LV-0b decision V12) | — |

Reduced motion: every tile move and highlight is an instant swap. Keyboard and clicker: unchanged (`next` is the next build).

### 5.3 Write together (LV-D8)

- The slide always carries the line "Write on paper or on your own device. Nothing is typed here." and a variant line (type, trace, frame, own name; section 12).
- The answer appears only on the teacher's click; there is no timer by default (the teacher may open the class timer, §3.5).
- Nothing on the slide accepts input; no draw-on-slide (F-TCH-004 §4 unchanged).

---

## 6. Parents (amends F-TCH-004 §3.10 and §3.11)

- **Who**: family `owner` and `caregiver` see every entry point of section 3 for their family spaces (`canComposeIn`, unchanged).
- **No roster needed**: a family with no learners opens the setup page with presets; the picker is `none` by default (a parent with one or no child does not need a turn-taking tool). Two or more learners: the §3.10 rule (`names`, or `initials` when the family hides names).
- **Wording by space kind** (`roster.space.kind === 'family'`): "Check the TV or screen" instead of "Check the classroom device"; "Family code on the last slide" instead of "Class code on the last slide"; "+ Family code" instead of "+ Class code" (Customize); the copied-link warning names the family join code; the title hint reads "Do not put anyone's name in the title." for both kinds; the page intro is neutral for both ("Show a slide lesson on a projector or TV, in class or at home."); so are the picker privacy line ("not saved on the presenting device") and the presenter End slide's code title ("Join with this code"; the presenter does not know the space kind, and the `class-code` block carries only the code, so it is neutral rather than a second variant). Strings in section 12.
- **At home without the console**: E5 (learner app grown-up card) and `/present` with presets need no account, no space and no sign-in (TD2).

---

## 7. Child safety

1. **A child profile never reaches the presenter through the app without the grown-up gate.** The only learner-app entry (E5) is inside the grown-up area, which the gate guards (F-PAR-001, F-APP-001 §3.9); its buttons ask the gate again after the grown-up session lapses (`gateOpensDirectlyNow`). No learner screen (Home, Journey, Library, quest player, Results) gets a lecture entry.
2. **Console entries** (E1-E4) sit behind sign-in and the grown-up lock that every console page has (F-APP-001 A-4b, `GrownUpLock`).
3. **`/present` stays open by URL** (TD2, unchanged): it reads no profile, writes no progress, holds no personal data, sells nothing and links nowhere but its own home. The presenter root clears `hr:grownup:unlock` and `hr:console:session` on boot (F-APP-001 §3.9), so opening it never leaves a grown-up session open behind it.
4. **Deck building in the app root (E5)** reads the learner's next quest and recent quest ids and emits ids only; it never writes progress, never starts a quest and adds no telemetry with a `profileId`.

## 8. Privacy

- **No learner names on the big screen unless the presenter chooses names** in the picker (unchanged §3.10: names arrive by `postMessage` from the console only). Presets add no picker labels and E5 never sends one.
- **No name in a link or title**: preset titles are the localized preset names or, for N1 only, the plan title (plan titles still pass `titleProblem`); Story time never uses a story's title; the E5 row label "Next lesson for {name}" is on the grown-up screen only.
- **No class code by default** (LV-D7).
- **Aggregates only**: N2 reads two numbers from the roster summaries (the most common stage and the smallest done count in it); nothing about a single learner is shown, compared or kept.
- **Telemetry** (section 11): codes only; no ids of people, no deck title, no word.
- **Device data**: Recent keeps decks (ids, seed, options), never names (§3.12, unchanged); the 60-day and 7-day windows only read `savedAt`.

## 9. Offline

- Presets on `/present` and in the learner app resolve from the bundle (`CATALOG`, content) and Recent: fully offline after one online visit (§3.8).
- The console is online-only (unchanged); its presets need the roster and plans it already loads. If those fail, `hangul-week-1`, `by-stage`, `story-time` and `warm-up` (with its default letters) still resolve, and `next-lesson` / `word-review` show their fallback lines.
- New slides use bundled art (`RealiaSheet`, `PictureArt`) and the precached font; no network.

## 10. Accessibility

- Preset cards follow the disclosure pattern: each card is a button (one tab stop) named "{title}, about {n} minutes" with `aria-expanded` (`true` on the open card, `false` on the others) and `aria-controls` naming the panel that holds its length chips, preview and Start; opening one closes the others. The open card also has a `borderWidth.thick` outline (shape, not colour alone). No `aria-pressed`: the cards are not independent toggles. Length chips and stage chips are one-tab-stop radio groups (README D19, `radioAfter`).
- Every control at least `touchTarget.min`; the homes' Start button `touchTarget.hero`; the presenter home works at 320 px with 200 % text without sideways scroll.
- New slides: the slide announcement (§3.13) names the kind ("Slide 5 of 18, sentence, …"); the pattern's slot box has the accessible name "gap" (`a11y.presenter.slot`); a sentence-build move is announced ("{word} placed", polite); realia keep their accessible text (F-CURR-001 §3.14).
- Contrast: new text on `surface.paper` at ≥ 7:1; dimmed distractor tiles use the `text-dimmed` pair already pinned (§3.6 amendment).

## 11. Telemetry (amends F-TCH-004 §3.14)

- `lecture.start`'s `source` is the presenter's `StartSource` (`apps/mobile/src/logic/lecture/shell.ts:19`, `'console' | 'quick' | 'recent'`), not the deck's `source`. It gains **`'preset'`**: a start of a preset the presenter resolved itself (the in-session state, LV-D6) or of a v2 deck carrying `preset`. LV-3 fixes the mapping in `resolveBoot` / `startPayload` so such a start is not reported as `'console'`. The payload gains an optional **`preset`** key (a `LECTURE_PRESETS` value), present only with `source: 'preset'`. No new event names. **Decks built outside the presenter**: an E5 "Next lesson for {name}" deck (and any console preset other than Word review) is a v1 link that carries no preset id, so its start counts by the deck's `source` as today (`resolveBoot`: `quick` gives `'quick'`, any other gives `'console'`); only presets resolved on the presenter and v2 decks with `preset` count as `'preset'`. That split is by design (no preset id rides in a v1 link, LV-D6); the dashboards read `'preset'` as "presets started from the presenter home".
- **Worker first** (row LV-1): the Worker gains a payload rule for the four `lecture.*` events (the `BROWSE_PAYLOAD_RULES` pattern, `packages/backend/src/lib/server-events.ts:133-144, 220`): only these keys are kept, `profileId` is always dropped, and a key outside its rule is dropped. Today these payloads pass through unfiltered (`keptEventFields` falls through to `payload`).

| Event | Kept keys and rules |
|---|---|
| `lecture.start` | `source` one of `console`, `quick`, `recent`, `preset` · `preset` one of `LECTURE_PRESETS`, kept only when the same payload's `source` is `preset` (a payload-aware rule) · `blocks` integer 0-30 · `slides` integer 0-10000 · `skipped` integer 0-10000 · `picker` one of `none`, `names`, `initials`, `numbers` · `romanization` one of `always`, `tap` · `voice` one of `ready`, `none`, `unknown` · `offlineReady` boolean |
| `lecture.complete` | `slidesShown` integer 0-10000 · `minutes` integer 0-600 · `reveals` integer 0-100000 |
| `lecture.tool_used` | `tool` one of `timer`, `picker`, `blank`, `pause`, `grid`, `fullscreen` |
| `lecture.deck_rejected` | `reason` one of `LECTURE_DECODE_FAILURES` |

  The bounds come from the largest deck the schema allows, not from today's decks: `LECTURE_MAX_BLOCKS` (30) episode blocks of the largest cell (Stage 2 · letters, 172 slides today; LV-S1 to LV-S4 add slides) is about 5200 slides, so 10000 slides and skips, and 100000 reveals (several builds a slide), hold every valid deck; `deck-coverage.test.ts` asserts 30 × its largest measured per-block slide count stays under 10000, so a later slide row that breaks the bound fails there first. `server-events.test.ts` asserts that every key the shipped client sends today (`startPayload`, `completePayload`, the tool and rejected events) survives the rule, that a value at each bound (10000 slides) is kept and one past it dropped, that an extra key (a name) and `profileId` are dropped, and that `preset` is kept with `source: 'preset'` and dropped with any other `source`.
- The console and the learner app's E5 card send nothing (the console has no telemetry client; E5 hands off to the presenter, which sends `lecture.start` itself).

## 12. Strings (en / es / ko)

Every value below lands in the row that draws it, in all three locales, through `useMessages`; the row's reviewer checks es and ko against F-I18N-001 §3.10 (Spanish: neutral, informal tú, Latin-American words; Korean: 해요체, no particle attached to a variable; glossary: 학습 루트 Learning Route, 낱말 word, n단계 Stage n, 퀴즈). Changed existing keys are marked (changed); their namespaces are re-signed in the review ledger in that row.

### 12.1 Console (`console.*`) and navigation

| Key | en | es | ko |
|---|---|---|---|
| `shell.nav.lecture` | Lecture mode | Modo proyección | 강의 모드 |
| `lecture.title` (changed) | Lecture mode | Modo proyección | 강의 모드 |
| `lecture.entry.cta` (changed) | Lecture mode | Modo proyección | 강의 모드 |
| `lecture.intro` (changed) | Show a slide lesson on a projector or TV, in class or at home. | Muestra una lección con diapositivas en un proyector o una TV, en clase o en casa. | 프로젝터나 TV에 슬라이드 수업을 띄워요. 교실에서도, 집에서도 돼요. |
| `lecture.card.title` | Lecture mode | Modo proyección | 강의 모드 |
| `lecture.card.tagline` | Teach on a big screen | Enseña en una pantalla grande | 큰 화면으로 가르쳐요 |
| `lecture.card.bodyClass` | Show a ready lesson on a projector or TV: big letters, sounds and a few questions. Nobody's progress changes. | Muestra una lección lista en un proyector o una TV: letras grandes, sonidos y algunas preguntas. El progreso de nadie cambia. | 준비된 수업을 프로젝터나 TV에 띄워요. 큰 글자와 소리, 질문 몇 개가 나와요. 누구의 진도도 바뀌지 않아요. |
| `lecture.card.bodyFamily` | Put a lesson on your TV and learn together at home. No setup needed. | Pon una lección en tu TV y aprende en familia, en casa. No hace falta preparar nada. | TV에 수업을 띄우고 집에서 함께 배워요. 따로 준비할 것이 없어요. |
| `lecture.card.cta` | Start lecture mode | Empezar modo proyección | 강의 모드 시작 |
| `lecture.card.chooseClass` | Which class? | ¿Qué clase? | 어느 반인가요? |
| `lecture.card.chooseFamily` | Which family? | ¿Qué familia? | 어느 가족인가요? |
| `lecture.card.noSpace` | No class needed: you can still show a lesson. | No hace falta una clase: igual puedes mostrar una lección. | 반이 없어도 수업을 띄울 수 있어요. |
| `lecture.card.noSpaceFamily` | You can show a lesson without a family space. | Puedes mostrar una lección sin un espacio familiar. | 가족 공간이 없어도 수업을 띄울 수 있어요. |
| `lecture.card.opensTab` | Opens in a new tab | Se abre en una pestaña nueva | 새 탭에서 열려요 |
| `lecture.check.titleFamily` | Check the TV or screen | Revisa la TV o la pantalla | TV나 화면을 확인해요 |
| `lecture.outline.block.familyCode` | Family code on the last slide | Código de familia en la última diapositiva | 마지막 슬라이드에 가족 코드 |
| `lecture.copyHasFamilyCode` | This link holds your family join code. Anyone with the link can join until you make a new code. Copy it anyway? | Este enlace incluye el código de tu familia. Cualquiera con el enlace puede unirse hasta que crees un código nuevo. ¿Copiarlo de todos modos? | 이 링크에는 가족 참여 코드가 들어 있어요. 새 코드를 만들 때까지 링크가 있으면 누구나 참여할 수 있어요. 그래도 복사할까요? |
| `lecture.outline.addFamilyCode.cta` | + Family code | + Código de familia | + 가족 코드 |
| `lecture.outline.block.words` (`n`, plural) | {n} word / {n} words | {n} palabra / {n} palabras | 낱말 {n}개 |
| `lecture.picker.privacy` (changed) | Names are sent straight to the presenter tab and are not in the link. They are not saved on the presenting device. A copied link has no names. | Los nombres van directo a la pestaña de la presentación y no están en el enlace. No se guardan en el dispositivo que presenta. Un enlace copiado no tiene nombres. | 이름은 발표 탭으로 바로 전달되고 링크에는 들어가지 않아요. 발표하는 기기에 저장되지 않아요. 복사한 링크에는 이름이 없어요. |
| `lecture.titleField.hint` (changed) | Do not put anyone's name in the title. | No pongas el nombre de nadie en el título. | 제목에 이름은 넣지 마세요. |
| `lecture.titleFor` (`space`) (changed) | {space} · lecture mode | {space} · modo proyección | {space} · 강의 모드 |
| `lecture.comingSoon` (changed) | Lecture mode is coming soon: slide lessons you can show on a projector or TV. | El modo proyección llega muy pronto: lecciones con diapositivas para mostrar en un proyector o una TV. | 강의 모드는 곧 열려요: 프로젝터나 TV에 보여 줄 수 있는 슬라이드 수업이에요. |

### 12.2 Presets (the same values under `console.lecture.presets.*` and `learner.presenter.presets.*`)

| Key | en | es | ko |
|---|---|---|---|
| `title` | Ready-made lessons | Lecciones listas | 준비된 수업 |
| `lead` | Pick a ready lesson. You can look at it before you start. | Elige una lección lista. Puedes verla antes de empezar. | 준비된 수업을 골라요. 시작하기 전에 미리 볼 수 있어요. |
| `next.title` | Next lesson | Siguiente lección | 다음 수업 |
| `next.class` | Picks up where your class is. | Sigue desde donde va tu clase. | 우리 반이 배우고 있는 곳부터 이어 가요. |
| `next.family` | Picks up where your family is. | Sigue desde donde va tu familia. | 우리 가족이 배우고 있는 곳부터 이어 가요. |
| `next.plan` (`plan`) | From this week's plan: {plan} | Del plan de esta semana: {plan} | 이번 주 계획: {plan} |
| `next.device` | Picks up after the last lesson shown on this screen. | Sigue después de la última lección que se mostró en esta pantalla. | 이 화면에서 마지막으로 한 수업 다음부터 해요. |
| `zero.title` | Start from zero: Hangul week 1 | Desde cero: semana 1 de hangul | 처음부터: 한글 1주차 |
| `zero.short` (deck title) | Hangul week 1 | Semana 1 de hangul | 한글 1주차 |
| `zero.body` | The first letters, their sounds and simple syllables. | Las primeras letras, sus sonidos y sílabas sencillas. | 첫 글자와 소리, 쉬운 음절을 배워요. |
| `stage.title` | Stage by stage | Etapa por etapa | 단계별로 |
| `stage.body` | Pick a stage. The lesson is built for you. | Elige una etapa. La lección se arma sola. | 단계를 고르면 수업이 만들어져요. |
| `stage.choose` | Choose a stage | Elige una etapa | 단계를 골라요 |
| `stage.chip` (`n`) | Stage {n} | Etapa {n} | {n}단계 |
| `story.title` | Story time | Hora del cuento | 이야기 시간 |
| `story.body` | A Korean story with pictures, then a few questions. | Un cuento coreano con dibujos y luego algunas preguntas. | 그림과 함께 한국 이야기를 읽고 질문 몇 개를 풀어요. |
| `words.title` | Word review | Repaso de palabras | 낱말 복습 |
| `words.body` | Words from recent lessons, then a short quiz. | Palabras de las lecciones recientes y luego un quiz corto. | 최근 수업의 낱말을 보고 짧은 퀴즈를 풀어요. |
| `warmup.title` | Quick 10-minute warm-up | Calentamiento rápido de 10 minutos | 10분 가볍게 시작하기 |
| `warmup.short` (deck title) | Quick warm-up | Calentamiento rápido | 가볍게 시작하기 |
| `warmup.body` | Letters to revisit, a few questions and writing in the air. | Letras para repasar, algunas preguntas y escribir en el aire. | 다시 볼 글자, 질문 몇 개, 허공에 글자 쓰기를 해요. |
| `length.title` | How long? | ¿Cuánto tiempo? | 얼마나 할까요? |
| `length.option` (`n`) | {n} min | {n} min | {n}분 |
| `start.cta` | Start | Empezar | 시작 |
| `preview.title` | What's in this lesson | Qué hay en esta lección | 이 수업에 들어 있는 것 |
| `preview.quiz` (`n`, plural) | Quick quiz: {n} question / Quick quiz: {n} questions | Quiz rápido: {n} pregunta / Quiz rápido: {n} preguntas | 빠른 퀴즈: {n}문제 |
| `preview.words` (`n`, plural) | {n} word / {n} words | {n} palabra / {n} palabras | 낱말 {n}개 |
| `customize.cta` | Customize | Personalizar | 직접 고르기 |
| `customize.lead` | Choose each part yourself. You never have to. | Elige cada parte a tu gusto. Nunca es obligatorio. | 하나씩 직접 골라요. 꼭 하지 않아도 돼요. |
| `fallback.zero` | Nothing to follow yet, so this starts with Hangul week 1. | Todavía no hay nada que seguir, así que empieza con la semana 1 de hangul. | 아직 따라갈 기록이 없어서 한글 1주차부터 시작해요. |
| `fallback.warmUp` | No words this week yet, so this is the warm-up instead. | Todavía no hay palabras de esta semana, así que se hace el calentamiento. | 이번 주 낱말이 아직 없어서 가볍게 시작하기로 해요. |
| `fallback.restart` | Every story was shown here, so this starts again from the first. | Ya se mostraron todos los cuentos aquí, así que se empieza otra vez por el primero. | 모든 이야기를 이미 봤어요. 첫 이야기부터 다시 해요. |

### 12.3 Presenter (`learner.presenter.*`): its own title, new slides, and accessibility (`a11y.presenter.*`)

| Key | en | es | ko |
|---|---|---|---|
| `home.title` (changed) | Lecture mode | Modo proyección | 강의 모드 |
| `docTitle` (changed) | Hangul Route lecture mode | Modo proyección de Hangul Route | Hangul Route 강의 모드 |
| `invalid.reload` | Reload | Volver a cargar | 다시 불러오기 |
| `slide.end.codeTitle` (changed) | Join with this code | Únete con este código | 이 코드로 들어와요 |
| `slide.sentence.label` | Sentence | Oración | 문장 |
| `slide.pattern.label` | Sentence pattern | Patrón de oración | 문장 틀 |
| `slide.readAlong.label` | Read along | Leer juntos | 함께 읽기 |
| `slide.realia.ask` | Look closely and find the answer. | Mira con atención y busca la respuesta. | 잘 보고 답을 찾아요. |
| `slide.build.title` | Build the sentence together | Armar la oración en grupo | 함께 문장을 만들어요 |
| `slide.build.next` | Which word comes next? | ¿Qué palabra va después? | 다음 낱말은 뭘까요? |
| `slide.build.particle` | Which ending fits? | ¿Qué terminación va? | 어떤 말이 어울릴까요? |
| `quiz.listen` | Which one did you hear? | ¿Cuál escuchaste? | 어떤 것을 들었나요? |
| `quiz.reply` | Which answer fits? | ¿Qué respuesta va bien? | 어떤 대답이 어울릴까요? |
| `slide.write.title` | Write together | Escribir en grupo | 함께 써요 |
| `slide.write.where` | Write on paper or on your own device. Nothing is typed here. | Escribe en papel o en tu propio dispositivo. Aquí no se escribe nada. | 종이나 각자 기기에 써요. 이 화면에는 아무것도 입력하지 않아요. |
| `slide.write.type` | Type it on your own device, then look. | Escríbelo en tu propio dispositivo y luego mira. | 각자 기기로 입력해 보고 확인해요. |
| `slide.write.trace` | Trace it in the air, then on paper. | Trázalo en el aire y luego en papel. | 허공에 따라 쓰고 종이에 써 봐요. |
| `slide.write.frame` | Fill the gap with a word from the list. | Completa el espacio con una palabra de la lista. | 목록에서 낱말을 골라 빈칸을 채워요. |
| `slide.write.example` | For example | Por ejemplo | 예를 들면 |
| `slide.write.ownName` | Write your own name in Hangul on paper. | Escribe tu propio nombre en hangul en papel. | 자기 이름을 종이에 한글로 써 봐요. |
| `grid.kind.sentence` (LV-S1) | Sentence | Oración | 문장 |
| `grid.kind.pattern` (LV-S1) | Sentence pattern | Patrón de oración | 문장 틀 |
| `grid.kind.readAlong` (LV-S1) | Read along | Leer juntos | 함께 읽기 |
| `grid.kind.realia` (LV-S1; its question slide is `grid.kind.quiz`) | Look and read | Mira y lee | 보고 읽기 |
| `grid.kind.build` (LV-S3) | Build a sentence | Arma una oración | 문장 만들기 |
| `grid.kind.write` (LV-S4) | Write together | Escribir en grupo | 함께 써요 |
| `a11y.presenter.presetCard` (`title`, `n`) | {title}, about {n} minutes | {title}, unos {n} minutos | {title}, 약 {n}분 |
| `a11y.presenter.slot` | gap | espacio | 빈칸 |
| `a11y.presenter.tilePlaced` (`word`) | {word} placed | Se colocó: {word} | 놓은 낱말: {word} |

### 12.4 Learner app grown-up card (`caregiver.lecture.*`)

| Key | en | es | ko |
|---|---|---|---|
| `title` | Lecture mode | Modo proyección | 강의 모드 |
| `body` | Show a lesson on a TV or big screen and learn together. Nobody's progress changes. | Muestra una lección en una TV o una pantalla grande y aprende en familia. El progreso de nadie cambia. | TV나 큰 화면에 수업을 띄우고 함께 배워요. 누구의 진도도 바뀌지 않아요. |
| `open.cta` | Open lecture mode | Abrir modo proyección | 강의 모드 열기 |
| `next` (`name`) | Next lesson for {name} | Siguiente lección para {name} | 다음 수업: {name} |

### 12.5 Site (`landing.*`)

| Key | en | es | ko |
|---|---|---|---|
| `persona.teachers.class.lecture` (changed) | Lecture mode: teach from the front on a projector or TV, with ready-made lessons. | Modo proyección: enseña al frente con un proyector o una TV, con lecciones listas. | 강의 모드: 준비된 수업으로 프로젝터나 TV 앞에서 가르쳐요. |
| `persona.parents.follow.lecture` | Lecture mode puts a lesson on your TV so you can learn together. | El modo proyección pone una lección en tu TV para aprender en familia. | 강의 모드로 TV에 수업을 띄우고 함께 배워요. |

Length budgets (F-I18N-001 §3.11): every `cta` ≤ 28 in all locales (longest: "Empezar modo proyección", 23); Spanish lines over 1.5x English get an `ES_LENGTH_ALLOW_LIST` line with the reason in the row that adds them. Banned-word lint (`BANNED_WORDS`, the learner list) runs over all three locales.

---

## 13. Edits to the amended specs (applied in the rows named)

- **F-TCH-004**: §3.1 entry points → section 3 here (LV-5, LV-6); §3.2 deck v2 → section 4.5 (LV-1); §3.3 rule 2 and the new-kind rows → section 5.1 (LV-2, LV-S1 to LV-S4); rule 12 → section 4.4 (LV-2); §3.4 new kinds → section 5.2; §3.10 / §3.11 family wording and presets-first → sections 4.6 and 6 (LV-4); §3.12 presets on the home → section 4 (LV-3); §3.14 payload → section 11 (LV-1); §3.15 "Stage 2 / 4 `tap-respond` dialogue slides" moves from later phase to LV-S2. A pointer line goes at the top of F-TCH-004 in this PR.
- **F-APP-001**: §3.8 nav registry gains **Lecture mode** (both personas, `lectureModeEnabled()`); the teacher and family homes gain the card (LV-5); a pointer line in this PR.
- **F-SITE-002**: §3.5 item 4 gains the `lectureMode` claim line; §3.6 item 4's line is reworded; §3.9's table names **LV-7** as the `lectureMode` flip PR; OD-16 default (a) applies and LV-7 runs `site-budgets.spec.ts` with the claim on and records the outcome in §3.9 (LV-7); a pointer line in this PR.

## 14. Tests (per row)

| File | Row | Asserts |
|---|---|---|
| `packages/content-schema/src/__tests__/lecture-presets.test.ts` | LV-1 | an explicit table of every preset × every length against `CATALOG` (blocks and minutes; the section 4.2 H rows among them; `word-review` 10 = 10 cards + 5 rounds = 10 min and 20 = 20 cards + 10 rounds = 20 min, with 30 words available; `warm-up` minutes ≤ 10; for `word-review` and `warm-up` the rule-12 minutes never exceed the chosen length; `story-time` at 10 / 20 / 30 resolves to minutes no more than T and no less than T - 5 with the catalogue's ready stories, and with 0, 1 and all stories in Recent); fill rule (first block always, quiz only with ≥ 5 minutes left, activity choice, never `class-code`, ≤ 30 blocks); N2 `classPosition` (mode, ties, smallest `done + known`, a case with `known > 0`, no summaries); W1 rollup words only with ≥ 2 vocab summaries; warm-up top-up: Recent with 0, 1, 3 and 6 letters on the presenter and app contexts, and a console rollup of 1 letter with no plan, each gives at least 4 different letters (0 gives the six defaults; the 1- and 3-letter cases are topped up to 4 with the next default letters in order, no duplicate), and the expanded deck has exactly 4 sound-quiz slides; a Recent of the Stage 1 rites quests (`teaches` with `ㄴ/final` and the like) keeps only plain jamo, tops up to at least 4 and gives a deck that `LectureDeckSchema` accepts; Story time resolved for every ready story in every UI locale builds a deck whose title (`presets.story.title`) and blocks pass `LectureDeckSchema`; `questIdsOfBlocks` (quest, episode in cell order, every other kind ignored, de-duplicated); N3 with a `routeNext` quest off the route starts after the furthest done route quest; every fallback; determinism and console / presenter / app parity; only `word-review` decks are v2. (No roster property test here: `PresetContext` has no field that can carry a name, so the roster check sits on the callers' context builders, in the LV-3, LV-4 and LV-6 rows.) |
| `packages/content-schema/src/__tests__/lecture.test.ts` (extend) | LV-1 | v2 grammar; `word-review` bounds; a v1 deck encodes as v1 byte-for-byte; a v1 fragment with a v2 feature is `invalid`; v2 worst-case size |
| `packages/backend/src/lib/__tests__/server-events.test.ts` (extend) | LV-1 | the section 11 rule table: every key the shipped client sends survives; a value at each bound is kept and one past it dropped; `preset` kept only with `source: 'preset'`; an extra key (a name), `profileId` and out-of-bounds values are dropped |
| `apps/mobile/src/logic/lecture/__tests__/recent.test.ts` (extend) | LV-2 | an item the build cannot parse (unknown version) is kept through a Start and a save |
| `packages/i18n/src/__tests__/lecture-name.test.ts` (new) | LV-4, extended by LV-5 and LV-6 | an explicit list of required keys that must exist and hold the same value in each locale; a missing key fails (no "present so far" skip). LV-4 lists `console.lecture.title`, `console.lecture.entry.cta` and `learner.presenter.home.title` (renamed in LV-3, a dependency of LV-4); LV-5 appends `console.shell.nav.lecture` and `console.lecture.card.title`; LV-6 appends `caregiver.lecture.title` |
| `apps/mobile/src/logic/lecture/__tests__/deck-coverage.test.ts` (new) | LV-2, then every LV-S row | the section 1 walk over every shipped episode: per cell, `unsupported-step` skips ≤ the committed table, which each LV-S row lowers; after LV-S4 the table is all zero; repeated word cards = 0; `LECTURE_MAX_BLOCKS` × the largest per-block slide count < 10000 (the Worker bound, section 11) |
| `deck-builder.test.ts` (extend) | LV-2, LV-S1-S4 | `seenWords`; card-match / pic-word quiz when all shown; `word-review` (at most 10 cards with `rounds` 5 and 20 with `rounds` 10; `aboutMinutes` / rule 12 gives 10 and 20 for full decks); each new kind's slides and builds; romanization skips; text-variant prompts; seeds deterministic |
| `presenter-glyphs.test.ts`, `scripts/__tests__/build-presenter-font.test.mjs` (extend) | LV-S1-S4 | every projected glyph of the new slides is in the sidecar |
| `apps/mobile/src/logic/lecture/__tests__/preset-source.test.ts` (new) | LV-3 | presenter context from Recent (60-day and 7-day windows by `savedAt`, corrupt items ignored), deck from a resolved preset (v1, `source: 'quick'` unless it holds `word-review`), no name field; `lecture.start` `source: 'preset'` for a presenter-resolved preset, and `'quick'` for an E5-style v1 fragment with `source: 'quick'` |
| `apps/web/src/lib/console/__tests__/lecture.test.ts` (extend) | LV-4 | presets-first state, `?from=` preselects, family wording by kind (check title, outline family code, `+ Family code`, copy warning; the neutral picker privacy line for both kinds), family picker default `none` for ≤ 1 learner; roster rows with awkward names (accents, Hangul, apostrophes, one-letter and very long names) go through the console context builder for every preset and length, and the encoded fragment and the deck title contain no substring (3 characters or more) of any name |
| `apps/web/src/lib/console/__tests__/shell-nav.test.ts`, `teacher-home.test.ts`, `parent-home.test.ts` (extend) | LV-5 | nav item predicate and target (one space, several, none); only `canComposeIn` spaces count (a school admin without a teacher or owner role gets the no-space path); card targets; nothing drawn while the flag is off |
| `apps/web/src/lib/console/__tests__/config.test.ts` (extend), `apps/mobile/src/config/__tests__/flags.test.ts` (extend) | LV-6 (app flag, default off), LV-7 (both defaults on) | launch default; `false` / `0` / `off` / `no` / `disabled` off, case and spaces ignored |
| `apps/web/src/app/__tests__/persona-pages.test.tsx` (extend) | LV-7 | `/parents` line with the claim on; `/teachers` reworded line |
| `apps/mobile/src/screens/parent/__tests__/LectureCard.test.tsx` (new) | LV-6 | web only; card absent while `flags.lectureModeEnabled` is off; gate asked again after lapse; profiles with awkward names: the built fragment and deck title contain no substring of any name and no profile id |
| Playwright `apps/mobile/e2e/web/presenter-presets.spec.ts` (new) | LV-3, LV-S rows | at 320 / 768 / 1180: no horizontal overflow (`scrollWidth <= clientWidth`), every preset card reachable and named "{title}, about {n} minutes", opening a card sets its `aria-expanded="true"` (the others `false`) and its `aria-controls` panel holds Start, one tap then Start reaches slide 1; offline reload; IndexedDB keys unchanged except allowed; the stale-presenter path with a stubbed service-worker registration (an init script replaces `navigator.serviceWorker.getRegistration` with one whose `update()` is recorded and reports a waiting worker, and the page is fed a fragment of an unknown future version so `unsupported_version` is reached on the current build): the invalid screen calls `update()`, shows Reload, and Reload reloads the page (a real previous-build replay is not run in CI); each new slide family at 1280 x 720: its announced kind label is visible, its Korean text is non-empty and the slide does not overflow the stage (screenshots attached as well, never the only check) |
| Playwright `apps/web/e2e/console-lecture-presets.spec.ts` (new) | LV-4, LV-5 | teacher and family homes show the card; presets-first setup; Customize prefilled |
| i18n coverage ratchets (`es-coverage.ts`, `ko-coverage.ts`), `length-budget.test.ts`, banned-word lint | every UI row | es and ko present for every new key |

## 15. PR breakdown (implementation rows)

Every UI row waits for its mock (LV-0b) and attaches screenshots; every row adds en, es and ko in the same PR; shared files (`index.ts`, `telemetry.ts`, i18n messages, `scripts/i18n-migrated.json`) are touched append-only.

| Row | Content | Size | Depends on |
|---|---|---|---|
| **LV-0** (this PR) | `docs(specs,design)`: this amendment, the three wireframes, wireframe index rows, pointer lines in F-TCH-004, F-APP-001, F-SITE-002 | S | — |
| **LV-0b** | `design(presenter,console)`: agent design pass with multi-agent review: mocks under `design/screens/presenter/` (`presets.md` home with presets at 320 / 768 / 1180, preset preview, each new slide family at 1280 x 720 and 1920 x 1080) and `design/screens/app-shell/` (lecture card on both homes, nav item; the console setup page, wireframe Panel F, in `lecture-setup.md` for LV-4), `design/screens/lecture-entry/learner-card.md`; shots; strings table checked against section 12 | M | LV-0 |
| **LV-1** | `feat(content-schema,backend)`: deck v2 (`word-review`, optional `preset`), `deckVersion`, codec accepts 1 and 2; `lecture-presets.ts` (`LECTURE_PRESETS`, defaults, lengths, `resolvePreset`, `classPosition`, `fillToLength`); Worker payload rule for `lecture.*` (section 11 table; **worker first**: deploys before LV-3 sends `preset`) | M | LV-0 |
| **LV-2** | `feat(mobile)`: deck builder: `seenWords`, card-match / pic-word quiz when all shown, `word-review` expansion, rule 12 amendment; `deck-coverage.test.ts` with the committed section 1 table verbatim as the ratchet baseline; the presenter accepts v2 decks; Recent pass-through of unreadable items; the invalid-link Reload with a service-worker update | M | LV-1 |
| **LV-S1** | `feat(mobile)`: reading slides: `sentence`, `pattern`, `read-along` (Discover exchange), `realia` (Discover realia); `PictureArt` to `components/`; font glyphs; coverage table lowered | M | LV-2, LV-0b |
| **LV-S2** | `feat(mobile)`: question slides: `listen` quizzes (practice, apply, Check), `reply` quizzes (`tap-respond`), `realia` + `realia-question` (`realia-read`); text-variant prompts; font; coverage lowered | M | LV-S1 |
| **LV-S3** | `feat(mobile)`: `sentence-build` (`order-it`, including the Stage 7 Check): tiles, particle build, distractors set back, announcements; font; coverage lowered | M | LV-S1 |
| **LV-S4** | `feat(mobile)`: `write-together` (`type-hangul`, `trace-word`, `write-frame`, `own-name`); font; coverage table all zero | M | LV-S1 |
| **LV-3** | `feat(mobile)`: presenter home: **Ready-made lessons** (six preset cards, length chips, stage chips), preview with Customize, Quick lesson folded under Customize; `preset-source.ts` (Recent windows); renamed `learner.presenter.home.title` and `docTitle`, the neutral End slide `slide.end.codeTitle`; `lecture.start` `source: 'preset'` and `preset`, with the `resolveBoot` / `startPayload` mapping fixed | M | LV-2, LV-1 deployed, LV-0b |
| **LV-4** | `feat(web)`: console setup page presets-first, Customize prefilled, `?from=` preselects; parent access: family wording by space kind (including `+ Family code`), family picker default, neutral intro, title hint and picker privacy line; renamed `lecture.title`, `entry.cta`, `titleFor`, `comingSoon`; `lecture-name.test.ts` | M | LV-1, LV-2 **deployed to production** (the presenter, a separate build, must accept v2 before a console built from LV-4 can emit a v2 link; a merged LV-2 is not yet a live one), LV-3 (the presenter title rename that `lecture-name.test.ts` checks), LV-0b |
| **LV-5** | `feat(web)`: entry points: Lecture mode card on `/teach/home` and `/parent` (one, several, no space; `canComposeIn` spaces only), `ADULT_NAV` item (the tab row scrolls its current item into view on load), the space action button renamed at secondary weight; `card.noSpaceFamily`, `card.opensTab` | S | LV-4 |
| **LV-6** | `feat(mobile)`: learner app grown-up card (E5): Open lecture mode, Next lesson for each learner on the device (`routeNext`, W3 quest ids), gate re-ask; web only; the app flag `flags.lectureModeEnabled` (`EXPO_PUBLIC_LECTURE_MODE`) with launch default **off**, so the card stays hidden until LV-7; the existing "Family Dashboard" heading gets `overflow-wrap` (it runs 3 px past 320 at 200 % text, LV-0b `learner-card.md`) and the e2e asserts no sideways scroll there | S | LV-3 |
| **LV-7** | `feat(web,mobile,i18n)`: launch defaults of the web `lectureModeEnabled()` and the app `flags.lectureModeEnabled` on (kill switches kept), `lectureMode` claim on, `/parents` line, `/teachers` reworded line, F-SITE-002 §3.9 table and OD-16 outcome, `site-budgets.spec.ts` with the claim on; owner runbook lines updated (the variables are now only kill switches; switching one off needs a rebuild and redeploy of that app, and hides the entry points only, `/present` stays reachable by URL; the site line follows the claim, and withdrawing lecture mode for more than an incident means a PR setting `SITE_CLAIMS.lectureMode` back to `false`, LV-D1; deploy order for every lecture change: the presenter / learner-app web build first, then the console, so a console link never reaches a presenter that cannot read it); the `site-claims.ts` hand-off table row names LV-7 and that rollback | S | LV-3, LV-4, LV-5, LV-6 |

Parallel lanes: LV-S1 to LV-S4 can run beside LV-3 / LV-4 / LV-5 once LV-2 is in; LV-7 does not wait for the slide rows (Stage 1, 5 and the shelf stories are complete today, and every upper-stage skip is counted on the start screen until its row lands).

## 16. Open items

- **Upper-stage pace.** Catalogue minutes are a learner's pace, not a room's; a 20-minute preset of Stage 2 words may run long. The start screen shows the slide count, and the teacher can skip slides in the grid (§3.5). After LV-S4, if the slide counts per preset length run more than 50 % over (measured by `deck-coverage.test.ts`), a follow-up adds a per-preset slide cap. Not blocking.
- **`say-together` and `pair-share`** stay in Customize as shipped (F-TCH-004 PR 7); presets never use them (LV-D9). Whether to retire them from the catalogue is an owner call; nothing here depends on it.
- **N2 is an approximation**: `done` is a count, not a position, so a class that skipped around the stage starts at the earliest open lesson of the route order. The resolved outline is always shown before Start.

## 17. Review log

- 2026-10-15, LV-0b review (two reviews of #727, adjudicated in a PR comment). Majors: the family-home card goes directly after the first learner card below 70em (E2 row amended; the nav row scrolls its current item into view, LV-5); the console setup page (wireframe Panel F) is drawn for LV-4 in `design/screens/app-shell/lecture-setup.md`. Minors: rule 12 counts quiz minutes only outside a quest's or story's own slides (4.4, observation O1); the own-name builds are three (5.2, V12); the design's gap keys are in section 12 (`card.noSpaceFamily`, `card.opensTab`, `outline.block.words`, `presets.preview.quiz` / `.words`, `grid.kind.*`); the Family Dashboard heading overflow goes to LV-6.
- 2026-10-15, LV-0 review round 3 (two reviews of #724, adjudicated in a PR comment; all 15 findings accepted). Majors: Story time decks are titled "Story time" in the surface locale (a story title is English only and can pass the 60-character deck-title limit) and are filled to the chosen length with the next stories (`fillToLength`), with tests for every ready story in every locale and for 10 / 20 / 30 minutes. Minors: family `+ Family code`, a neutral picker privacy line and a neutral End slide code title; warm-up letters filtered to plain jamo before the top-up; Worker bounds from the schema's largest deck (10000) and a payload-aware `preset` rule; LV-4 depends on LV-2 deployed and on LV-3, and the deploy order (presenter first) goes in the runbook; Stage 5 uses quest blocks; N3 off-route start; class spaces have no rollup words; F-APP-001 §3.8 predicates paragraph names `lectureModeEnabled()` and LV-D1 cites the `browseEnabled()` pattern; E5 starts count as `quick` by design; `lecture-name.test.ts` lists its keys explicitly; the roster check moves to the callers' context builders; the stale-presenter e2e uses a stubbed service-worker registration; preset cards use the disclosure pattern (`aria-expanded`, `aria-controls`); the heading is "Ready-made lessons" and the es card CTA "Empezar modo proyección"; `questIdsOfBlocks` is the one reading of a Recent deck's quests.
- 2026-10-15, LV-0 review round 2 (Codex P2 findings on #724, adjudicated in a PR comment): (1) accepted: the site lines (E7) follow the `lectureMode` code-constant claim, not `lectureModeEnabled()` (hangulroute.com is a separate build and `site-claims.ts` forbids a build variable); LV-D1 defines the coordinated rollback (a PR setting the claim back to `false` when lecture mode is withdrawn for more than an incident) and LV-7 writes it into the runbook; LV-D1, section 3 and the entry-points wireframe now agree. (2) accepted: Word review caps at 10 / 20 cards with 5 / 10 rounds, so rule 12 gives exactly 10 / 20 minutes (was 12 + 5 = 11 and 24 + 10 = 22); section 4.1, 4.2 W, 4.5 builder line and the section 14 tests match. (3) accepted: every warm-up tops up to at least 4 different letters from ㄱ ㄴ ㄷ ㅏ ㅓ ㅗ, so it always has 4 quiz questions; test added. Minor: the Hangul week 1 row in 4.1 says the quiz and air-write come as time allows, matching 4.2. The school-admin finding was already fixed in round 1 (`canComposeIn` spaces only; no-space path).
- 2026-10-15, LV-0 review round 1 (two reviews, PR #724): fixed the Hangul week 1 worked examples to what the fill rule gives; the quiz condition no longer counts taught items (catalogue-only, upper-stage `teaches` is empty); one name everywhere including the presenter's own titles and the console tab title; a learner-app kill switch for E5, off until LV-7; deck v2 only for `word-review` (other presets stay v1 for cached presenters); Recent keeps unreadable items; the Worker rule table and the `StartSource` mapping; W1 vocab bound (≤ 3, only with ≥ 2 vocab summaries); N2 uses `done + known`; `canComposeIn` for E1 / E3; E4 stays secondary; flag-independent "Next lesson" lines; ko 음절; real Playwright assertions; build-time kill-switch notes.
- 2026-10-15, LV-0: measurement taken at `3b52a3969` (section 1); entry-point audit of the console (`teach/space/page.tsx`, `shell-nav.ts`, homes), learner app (`ParentDashboardScreen`), presenter home (`HomeScreen`, `quick-lesson.ts`), site (`site-claims.ts`, landing messages); deck builder and schema read in full. Wireframes in this PR; mocks in LV-0b.
