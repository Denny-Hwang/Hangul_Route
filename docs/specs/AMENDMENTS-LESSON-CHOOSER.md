# Amendments: one grouped lesson chooser (console half, row LV-3a)

Status: ready (2026-10-17, written with row **LV-3a**, PR #729, after its two reviews). Amends F-PLAN-001 section 3.5 (the plan builder's catalogue), F-PLAN-002 section 3.8 step 5 (the builder of a route draft), F-TCH-004 section 3.11 (the lecture setup page's Catalogue section) and `AMENDMENTS-LECTURE-V2.md` rows LV-3 and LV-4 (section 7 here). Wireframe `design/wireframes/console/plan-builder.md` panel G; mock `design/screens/app-shell/lesson-picker.md`.

Owner report 2026-10-16, item 5: "the lesson items are all shown open below in one list, too many to take in at once; improve it". Item 7 asked for UX improvements in general. The console also showed English content titles in the es and ko UI (CLAUDE.md section 1).

## 0. Summary

One pure model, `chooserGroups()` in `packages/content-schema/src/schemas/lesson-chooser.ts`, groups the shared `CATALOG` the same way for every surface that picks lessons: the console plan builder, the console lecture catalogue (this row), and the presenter's Customize (LV-3b). The console draws it as `GroupedLessonPicker`: a search field, one chip per group, one row per episode with a whole-episode checkbox and a disclosure that shows the episode's lessons. A press changes the page's own list in place, so plan items keep their dates, weeks and notes. The plan builder lists only the stages the space's learners can open, by the curriculum wizard's rule, and says why with the wizard's own line. Content titles follow the console language.

## 1. Measured before this row (main at `426384b45`)

| Surface | What it drew | Rows open at once |
|---|---|---|
| Plan builder, "Catalog (Stage 1)" | the 5 Stage 1 episodes, each with all its quests listed open | 20 (5 + 15); Stages 2 to 7 could not be put in a plan from the builder |
| Lecture page, Catalogue | the same Stage 1 block, then every ready story (24) and every word topic (12) | 56 in one column |
| Titles in both, in es and ko | `CATALOG`'s English titles | all |

## 2. Decisions

| Id | Decision | Why |
|---|---|---|
| LC-D1 | **One model, three surfaces.** `chooserGroups` (Stage 1 to 7 in order, one row per ready cell in theme order with its lessons; Stage 1's letter sets when the surface offers them; a Stories group and a Word topics group from the ids the surface can show) and `searchChooser`; selection keys are content ids. The console uses it here; the presenter's Customize (LV-3b) uses the same functions. | The three lists drifted apart (different groups, orders and search); one tested model keeps them alike. |
| LC-D2 | **The console form: chips, one group at a time.** A radio group of chips (Stage 1 to 7, then Stories and Word topics where offered), the chosen group's rows under its heading, every episode folded. Typing in the search field hides the chips and lists every matching group. If `AMENDMENTS-LECTURE-V2` section 18.3 later draws the console's catalogue as tabs (Lessons / Stories / Word topics / Letters), LV-4 may restyle the chips that way. The model, the search and the selection rules here stay. | Few rows open at once: one stage holds 5 episode rows. |
| LC-D3 | **The plan builder lists the stages the space opens** (section 4). | On learner devices a plan item past Stage 1 becomes homework only for a learner a Family Plan or a Group License covers (F-ENT-003 section 3.4: `unlockedStagesFor`, `isStageEntitled`, `canAssignQuest` `stage-locked`), whether or not the free-plan switch is on. Offering Stage 2+ to an uncovered space would let a grown-up publish homework nobody receives. |
| LC-D4 | **A press never loses what a grown-up typed** (section 5). | A plan item carries a date, a route week and a note; replacing items must carry them. |
| LC-D5 | **Titles in the UI language** (section 3). | CLAUDE.md section 1. |

## 3. Titles in the UI language

- `scripts/build-lecture-catalogue.mjs` also writes `apps/web/src/data/catalogue-titles.generated.ts`: the `title` of every grid episode, quest, story and word topic in `content/i18n/<locale>/` (es, ko). `--check` (content validation and `test:scripts`) fails on drift.
- `catalogTitle(id, locale)` / `catalogTitleEntry()` in `apps/web/src/data/catalog.ts`: the overlay title, else `CATALOG`'s English (`fallback: true`, the marker tests read), else the id.
- Used by the picker (both uses), the plan items (`itemTitle`, `catalogLabel`), the curriculum week table and readout, the lecture outline rows, the report's next quest, and the notes composer's quest picker, preview and history (`questOptions`, `questTitle`).
- The Korean title (Hangul) and its Revised Romanization are searched in every UI language; so are a lesson's taught letters.

## 4. The stages the plan builder lists (amends F-PLAN-001 section 3.5 and F-PLAN-002 section 3.8 step 5)

- **Rule.** The builder reads `GET /api/entitlements` with the roster and lists `unlockedStagesForSpace(entitlements, space, now)`: every ready stage when an active entitlement covers the space or its school, else Stage 1. This is the curriculum wizard's rule (F-PLAN-002 section 3.8, assumption 9a), so both grown-up planners offer the same lessons. Before the list is read, and when the read fails, the builder lists Stage 1 only: honest, and never more than the learners get.
- **The line.** While fewer stages than are ready are listed, a line sits under the chips. It is the wizard's left-out line, word for word, with the count of the ready lessons not listed. It names no price.

| Free-plan switch | Coverage (`spaceCoverage`) | Line | Link |
|---|---|---|---|
| on | `uncovered` (the viewer owns the space and sees every entitlement that could cover it) | `curriculum.freeDays.warningNoLessons(n, access.product[kind])` | **Open billing** |
| on | `unknown` (a co-teacher, a co-caregiver, a class in a school someone else owns, a failed read) | `curriculum.freeDays.warningNeutral(n)` | none |
| off | any | `curriculum.preview.warnings.premium(n)` | **See plans**, for a class only (as the wizard) |

- **What does not change.** Items already in a plan whose stage is not listed (an older plan, a link's `?add=`) stay in the plan with their dates and notes. The picker simply does not hold them. The readout's "not ready yet" count stays the learner device's authority. The lecture catalogue keeps every ready stage, because a class display writes no learner progress (F-TCH-004 section 3.9).
- F-PLAN-001 section 3.5's sentence "no client-side gating warning (every catalog item is Stage 1, which every learner has)" is replaced by this section.

## 5. Selection rules (in place; `applyChooserSelection`, `applyToPlan`, `applyToOutline`)

1. A row's checkbox chooses the **whole episode**: one plan item, or one deck block. It is mixed (`indeterminate`) while some of the episode's lessons are chosen.
2. **Ticking a partly chosen row.** On a deck outline (`merge`, the default) the whole episode takes the place of its chosen lessons, as one block. On the plan builder (`merge: false`) the missing lessons are added right after the last chosen one, and the chosen lesson items stay exactly as they are. A plan never merges items, so no date or note is dropped.
3. **Unticking one lesson of a whole episode** puts the episode's other lessons at its place (on the plan builder; on the lecture page a chosen whole episode locks its lessons and unticking the episode clears them, AMENDMENTS-LECTURE-V2 section 18.3, row LV-4). On a plan, each lesson keeps the episode item's date, week and note. A copy of that lesson chosen on its own as well (an older plan) goes in the same press.
4. **Carry-over.** `make(key, replaced)` receives the items a new key stands in for (`lessonParents`): the episode item for a lesson that comes out of it, or the lesson items when a whole episode takes their place (a deck). On a route draft, a lesson added beside lessons of its own episode takes the week and date of the last of them, so it lands in their week, not under "Not in a week yet". A plain new item on a classic plan comes undated, as before (wireframe: `+ add` leaves `targetDate` empty).
5. **Search** narrows only what is drawn. `searchChooser` keeps every lesson of a row and names the matching ones in `shown`, so every press acts on the real episode. The row's detail line is the whole episode's ("6 lessons · about 26 min").
6. **Room.** A classic plan holds `PLAN_MAX_ITEMS` (30), a route `CURRICULUM_MAX_ITEMS` (260), and a deck outline 30 blocks. A box whose press would add more than fits is off (`surface.sunken`). This includes a chosen lesson whose untick would add the other lessons of its whole episode. A press that removes is never off. The page's full line shows while nothing more fits.
7. Items the picker does not hold (a story's listen quest that a route added, a quiz or an activity block) keep their place.

## 6. The plan builder's sticky bar and accessibility

- Under the builder, a bar sticks to the bottom of the window (`position: sticky`, `surface.canvas`, a `border.subtle` top line, bottom padding `max(spacing.sm, safe-area-inset-bottom)`). It holds the count line (`chooser.chosen` "2 chosen · about 17 min", a status, rem text) above **Publish plan**, **Save draft** and Cancel. It is a labelled region (`chooser.bar`). Publish plan is in sight without scrolling at 360 x 640 and at 320 with 200 % text.
- Focus is never hidden under the bar (WCAG 2.4.11). The bar is measured (`useStickyClearance`, again when it wraps), and while it is on the page the document's `scroll-padding-bottom` is that tall, so Tab onto a row the bar covers scrolls the row above the bar (a `scroll-margin` on the rows does not: Chromium does not scroll an element that is already inside the viewport).
- **Clear** keeps keyboard focus in the search field. The status line ("4 matches") is a polite live region that stays in the accessibility tree, only visually hidden while empty.
- Every chip, box and button is at least `touchTarget.min`. The picker's text is rem, so 200 % browser text doubles it and nothing scrolls sideways at 320.
- When the page replaces its list (a stored draft loads, a link's `?add=`, another plan opened), the picker opens on the group of the first chosen item in the plan's order, with the search cleared and every episode folded. An edit never moves the open chip.

## 7. Rows

| Row | Content | Depends on |
|---|---|---|
| **LV-3a** (PR #729) | `feat(content-schema,web,i18n)`: the model (`lesson-chooser.ts`), the generated title maps and `catalogTitle`, `GroupedLessonPicker` on the plan builder and the lecture catalogue, the stage rule and line of section 4, the selection rules of section 5, the sticky bar of section 6, `console.chooser.*` strings in en / es / ko; this file, the F-PLAN-001 pointer and wireframe panel G | LV-1 (merged) |
| **LV-3b** | `feat(mobile)`: the rest of `AMENDMENTS-LECTURE-V2` row LV-3 (presenter presets home, `preset-source.ts`, Customize over the same model, kept home state, `useTypeScale`) | LV-3a, LV-2, LV-M1, OR-DISPLAY |
| **LV-4** | as in `AMENDMENTS-LECTURE-V2`, except the console catalogue chooser, which LV-3a delivers: LV-4 reorders the setup page presets-first and may restyle the chips (LC-D2) | LV-3a, LV-3b |

## 8. Tests

- `packages/content-schema/src/__tests__/lesson-chooser.test.ts`: groups and counts pinned; all seven stages, stories and topics; search in en, es (accents) and ko, Hangul, romanization and taught letters; `shown` keeps whole rows; the toggles with `merge` and without, the doubled-lesson press, `lessonParents`, and the carry-over of `applyChooserSelection` (100 % covered).
- `apps/web/src/lib/console/__tests__/lesson-picker.test.ts`: `planStages`, `lessonsPastStages`, `planStagesNotice` for every switch and coverage case (no price), `addsItems` against the toggles for every row and lesson, `applyToPlan` keeping dates, weeks and notes, `planRoom`, `planBarLine`.
- `apps/web/src/components/console/__tests__/grouped-lesson-picker.test.tsx`: chips, disclosure, mixed state, search acting on whole episodes, room, `resetKey`, Clear focus, the hidden live region.
- `apps/web/src/components/console/__tests__/plan-builder-wiring.test.tsx`: the page with a covered class, an uncovered class with the switch off and on, a co-teacher, a failed read, a stored draft, classic and route room, and the clearance.
- `apps/web/src/data/__tests__/catalog.test.ts`, `notes.test.ts`, `notes-page.test.ts`: every catalogue id resolves in es and ko, else the fallback marker shows; note quest titles in ko and es.
- Playwright `apps/web/e2e/lesson-picker.spec.ts` (console e2e export, `CURRICULUM_E2E=1 LECTURE_E2E=1`; run locally, as `curriculum.spec.ts` and `reports.spec.ts` are): Stage 2 into a licensed class's plan at 360 with Publish in the viewport and a focused row above the bar; an uncovered class offered Stage 1 with the wizard's line; search; 1280; 320 with 200 % text; the grouped lecture catalogue.

## 9. Out of scope and follow-ups

- The console's shared `Button` and form controls use px text sizes, so they do not grow with the browser's text size. Text size on every page belongs to the display rows (`AMENDMENTS-DISPLAY-NAV.md`, OR-DISPLAY), not to this picker.
- Wiring the console e2e export into a CI workflow (`web-app.yml`) is a separate `ci` row. This row edits no workflow.
- The notes composer's stage headings (`STAGE_TITLES`) are content in English only. They need overlay titles first (F-I18N-001 section 3.6).
- Copy follow-up for the next console review (MAR, F-I18N-001 section 3.10): "Your plan" names an episode item "{title} (3 quests)" (`plan.catalog.episodeLabel`) beside the picker's "3 lessons"; it should say lessons in en, es and ko ("(3 lessons)", "(3 lecciones)", "(수업 3개)"). The Korean `plan.yours.empty` should name the panel's heading `chooser.planTitle` ("수업"), not "수업 목록". Both change reviewed strings, so they wait for a reviewer pass and a console re-sign in `review-ledger.json`.

## 10. Review log

- 2026-10-17, LV-4 (row of `AMENDMENTS-LECTURE-V2`): the lecture page's chooser moves under Customize and is restyled as tabs, as LC-D2 allows (`GroupedLessonPicker` `tabs`): **Lessons** with the stage chips, **Stories** and **Word topics** 8 rows at a time with Show {n} more, a "{n} lessons inside" disclosure per episode, one panel at a time; the search, the model and the selection rules of section 5 stay. On the lecture page the whole episode locks its lessons (one tri-state choice, AMENDMENTS-LECTURE-V2 section 18.3); the plan builder keeps the chips and rule 3 of section 5. The console offers no letter sets, so no Letters tab.
- 2026-10-17, two reviews of #729, adjudicated in a PR comment. Accepted: this spec, the F-PLAN-001 pointer and wireframe panel G (blocker: no ready spec); the stage rule of section 4 (major: an uncovered space could publish Stage 2+ items its learners never get); the carry-over and the no-merge plan rule of section 5 (major: collapsing or splitting dropped dates, weeks and notes); search acting on whole episodes (major: unticking the one lesson a search showed removed the whole episode); the doubled-lesson press; a chosen lesson's box is off when its untick would overflow; the opening chip follows a replaced draft; note quest titles localized; the Stage 1 list helpers leave production code; the bar's count and the a11y items of section 6. Rejected or deferred, with reasons in the PR comment: wiring the e2e into CI here (a workflow change outside the row); rem sizes for the console's shared Button (section 9); the "lessons" wording of `plan.catalog.episodeLabel` and the Korean `plan.yours.empty` heading name (section 9: a string change re-opens the console sign-off in `review-ledger.json`, which needs its own reviewer pass).
