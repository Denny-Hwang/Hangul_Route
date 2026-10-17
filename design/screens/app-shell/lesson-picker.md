# The grouped lesson picker on the console (screen spec, LV-3)

Spec: owner report 2026-10-16 item 5 ("the lesson list is shown all at once, too many to take in"), `docs/specs/AMENDMENTS-LECTURE-V2.md` row **LV-3** (widened: the grouped chooser on the plan builder and the lecture page's catalogue) · wireframes `design/wireframes/classroom/lecture-presets.md` Panel F ("the shared grouped chooser") and `design/wireframes/console/plan-builder.md` (the builder's catalogue panel, which this replaces)
Built by: `apps/web/src/components/console/GroupedLessonPicker.tsx` over `chooserGroups` (`packages/content-schema/src/schemas/lesson-chooser.ts`); used by `teach/space/plan/page.tsx` (heading **Lessons**) and `LectureParts.tsx` `LectureCatalogueSection` (heading **Catalogue**)
Shots (Chromium, from `apps/web/e2e/lesson-picker.spec.ts` on the console e2e export): `shots/lesson-picker-plan-360.png`, `shots/lesson-picker-plan-1280.png`, `shots/lesson-picker-plan-320-text200.png`, `shots/lesson-picker-lecture-360.png`

## Why

The plan builder listed only Stage 1 (heading "Catalog (Stage 1)"), every episode with all its quests open; the lecture page listed the same Stage 1 block, then every story and topic, one long column. Stages 2 to 7 (all shipped) could not be put in a plan from the builder at all, and titles were English in the es and ko console.

## Anatomy (top to bottom)

1. **h2**: the page's name for it (`console.chooser.planTitle` "Lessons" on the plan builder; `console.lecture.catalogue.title` "Catalogue" on the lecture page).
2. **Search** (`chooser.search.label`, a `type="search"` field at `touchTarget.min`) with its hint under it (`chooser.search.hint`, `aria-describedby`): matches the title in the console language, the Korean title in Hangul, its Revised Romanization, and a lesson's taught letters; accents folded, every word must match. While text is in it: **Clear** (`chooser.clearSearch.cta`), no chips, every matching group under its heading with its lessons shown, and a polite status line ("4 matches" / `chooser.noMatch`).
3. **Chips** (a native radio group, legend `chooser.groups` for screen readers only): Stage 1 to Stage 7 (only stages with a ready cell), then **Stories** and **Word topics** on the lecture page. One group shows at a time; the picker opens on the group of the first chosen item, else Stage 1. A chip is `touchTarget.min` tall, `radii.pill`, `border.strong`; the chosen chip has a `borderWidth.thick` `text.primary` border (shape, not colour alone).
4. **Group heading** (h3): `chooser.heading.stage` "Stage 2 · 18 lessons", `.stories` "Stories · 24 stories", `.topics` "Word topics · 12 topics".
5. **Rows**, one per episode in theme order (five per stage): a checkbox row (title, then `chooser.episodeDetail` "3 lessons · about 13 min") that chooses the **whole episode**, and beside it a square button (`radii.md`, `touchTarget.min`, a CSS chevron of `borderWidth.thick` `text.primary` strokes that points right when closed and down when open) named `chooser.lessonsOf` "Lessons: {title}" with `aria-expanded` and `aria-controls` that shows the episode's lessons as indented checkbox rows ("about {n} min"). The whole-episode box is **mixed** (`indeterminate`, drawn as a dash) while some of its lessons are chosen. Stories and topics are single checkbox rows ("about {n} min").
6. **Full**: while nothing more fits (a classic plan holds 30 items, a route 260, a lecture outline 30 blocks), a box that would add more is off (`surface.sunken`) and the page's line shows on `feedback.nudgeLight` with a `feedback.nudge` edge (`chooser.full` on the plan builder, `lecture.outline.full` on the lecture page). A box that removes is never off.

### The plan builder's sticky bar

Under the builder, a bar fixed to the bottom of the window while the page scrolls (`position: sticky`, `surface.canvas`, a `border.subtle` top line, bottom padding `max(spacing.sm, safe-area-inset-bottom)`): the count line (`chooser.chosen` "2 chosen · about 17 min", a status) above **Publish plan**, **Save draft** and Cancel. It is a labelled region (`chooser.bar` "Your choices"). Publish plan is in sight without scrolling at 360 x 640 and at 320 with 200 % text.

## Behaviour

- A press changes the page's own list **in place**: a plan item keeps its date and note, a lecture outline keeps its quizzes, activities, letters and class code where they are; the whole episode takes the place of its first chosen lesson; unticking one lesson of a whole episode puts the other lessons at its place; a new item goes at the end.
- Items the picker does not list (a story's listen quest a route added) stay in the plan untouched.
- Titles follow the console language (`catalogTitle`, the generated `catalogue-titles.generated.ts`), English where no overlay has a title.

## Accessibility

Every chip, box and button at least `touchTarget.min`; the focus ring is `borderWidth.thick` `border.focus` on the row label, the chip or the button. Text sizes are rem, so 200 % browser text doubles them; at 320 the chips and rows wrap and nothing scrolls sideways (`lesson-picker-plan-320-text200`). The lesson list of a closed episode is in the page with `hidden`, so `aria-controls` always names a real element.
