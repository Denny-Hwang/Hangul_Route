# Lecture mode setup page, presets first (screen spec, LV-0b; revised 2026-10-16)

> **Revision 2026-10-16 (owner report; `docs/specs/AMENDMENTS-LECTURE-V2.md` section 18, LV-4 widened; `AMENDMENTS-DISPLAY-NAV.md` 7.3).** No **Helper picker** anywhere on the page (LV-D7: every deck `picker: null`; its privacy line is gone). **Open presenter** and **Copy link** move from the open card into a **sticky footer** with the outline's "about {n} min". **Customize** holds Source, the shared **grouped chooser** (tabs Lessons, Stories, Word topics, Letters; stage chips; "{n} lessons inside"; it adds and removes Outline blocks), the Outline, Options with **Slides language** (default **Same as this device**, which writes no `options.uiLocale`, and the hint "A copied link uses the language of the device that opens it."), the title and the checks. The frame has the **PageBack** and the **Learner app** exit (`adult-frame.md` revision). All three mocks and their shots are redrawn; the new shot `lecture-setup-footer-375.png` shows the footer while Customize scrolls. Struck text below is kept so the change stays readable.

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` sections 4.1, 4.6, 6, 8, 9, 12.1, 12.2 · wireframe `design/wireframes/classroom/lecture-presets.md` Panel F and its States · row **LV-4**
Mock: `mock/lecture-setup.html` (teacher, opened from "Present this plan", `?from=plan`), `mock/lecture-setup-family.html` (family, Hangul week 1 chosen, Customize open), `mock/lecture-setup-states.html` (loading, roster or plans failed, family of one learner, flag off), `mock/lecture-setup.css` (loaded after `app-shell.css`; tokens only)
Shots: `lecture-setup-320`, `-375`, `-1280`, `-320-text200`; `lecture-setup-family-320`, `-375`, `-1280`, `-320-text200`; `lecture-setup-states-375`, `-1280`
The preset cards are the presenter home's (`design/screens/presenter/presets.md`) written with the console's rem / em method; the console keeps its own frame, back link and hand-off (Open presenter, Copy link).

## Anatomy (top to bottom)

1. **Frame** with the **Lecture mode** nav item current (`lecture-card.md`, E3).
2. **Back link** (`console.lecture.back`, unchanged), h1 **Lecture mode** (`lecture.title`, changed), the intro (`lecture.intro`, changed, neutral for both space kinds).
3. **Ready-made lessons** (h2, `console.lecture.presets.title`) and the lead (`presets.lead`). Six preset cards in the section 4.1 order, one column below 45em and two from 45em (the page keeps `layout.maxWidth.reading`). Each card is one disclosure button (`aria-expanded`, `aria-controls`; one open at a time): title, line, "about {n} min", the `arrow-right` glyph.
   - **Next lesson** line by source and space kind: `next.plan` "From this week's plan: {plan}" when a published plan exists (teacher and family); else `next.class` (class space) or `next.family` (family space). With nothing to follow it is last with `fallback.zero` (states board).
4. **Open card** (spans the row, thick `text.primary` border): **How long?** chips (radiogroup; Word review 10 / 20, Warm-up none), **What's in this lesson** (`presets.preview.title`) with the total (`outline.about`) and the resolved blocks read-only (content title or block row label, "{n} min"), ~~**Helper picker** (radio row `none` / `numbers` / `initials` / `names`, the section 3.10 default: `names`, `initials` when the space hides names, `none` for a family with one or no learner) with the neutral privacy line (`picker.privacy`, changed), then~~ **[[ Open presenter ]]** (`touchTarget.hero`, full width on phones) and **[ Copy link ]**, now in the sticky footer (2026-10-16). Changing a chip re-resolves the list at once; nothing else moves.
5. **Customize** (`presets.customize.cta`, `plus` glyph, `dash` when open) and its lead. Open, it shows today's sections with the **Outline prefilled** from the chosen preset (rows with Move up, Move down, Remove; `+ Quiz`, `+ Activity`, `+ Class code` or, on a family space, **`+ Family code`**), the unchanged Source, Catalogue, Options, Lesson title (hint "Do not put anyone's name in the title.") and the check list, titled **Check the classroom device** or, on a family space, **Check the TV or screen** (`check.titleFamily`). With a family code added, Copy link asks `copyHasFamilyCode`.

## Opened from a source (`?from=`)

`?from=plan` opens with **Next lesson** open and the plan's own blocks as its list (`lecture-setup.html`); `?from=revisit` opens with **Quick 10-minute warm-up** open and the revisit letters. The page scrolls nowhere: the open card is already the first one.

## States drawn (`lecture-setup-states.html`)

- **Loading**: heading and lead at once, a skeleton of six cards (`aria-busy` on the section, "Loading…" for screen readers); nothing tappable until the roster and plans answer or fail.
- **Roster or plans failed**: the page's existing notice (`plansFailed`) stays; Word review shows `fallback.warmUp`, Next lesson is last with `fallback.zero`; the other four work (section 9).
- **Family of one learner**: the same page; ~~the picker starts at `none` (section 6)~~ there is no picker (2026-10-16).
- **Flag off** (`lectureModeEnabled()` false): `comingSoon` only, no card, nav item or button.

## Accessibility

Cards, chips, radios and buttons at least `touchTarget.min`; Open presenter and Copy link `touchTarget.hero`. 320 px at 200 % text: one column, chips and radios wrap, no sideways scroll (`-320-text200` shots, measured `scrollWidth <= clientWidth`). The open card's list is a plain list, read in order; radios and chips are native groups with a legend or `aria-labelledby`.

## Strings

All drawn strings are dictionary values (`console.lecture.*`, unchanged) or section 12.1 / 12.2 keys: `lecture.title`, `lecture.intro`, `presets.*` (title, lead, next.plan, next.family, zero.*, stage.*, story.*, words.*, warmup.*, length.*, preview.title, customize.*, fallback.zero, fallback.warmUp), `check.titleFamily`, `outline.addFamilyCode.cta`, ~~`picker.privacy` (changed)~~ (removed 2026-10-16), `titleField.hint` (changed), `comingSoon` (changed). No gap found beyond `outline.block.words` (Word review's outline row, added to section 12.1 in this PR).

## Review

Privacy: no learner name on the page at all (2026-10-16: no picker), none in the URL or the deck title; the console context builder carries aggregates only (section 8). Anti-pressure: no badge, no count, no "recommended" mark. Copy: no age words, no emoji; family wording by space kind only where section 6 lists it.

## Revision 2026-10-16: strings

New for LV-4 (`AMENDMENTS-LECTURE-V2.md` section 12.6): `console.lecture.presets.chooser.label`, `.tab.lessons`, `.tab.stories`, `.tab.words`, `.tab.letters`, `.lessonsIn`, `.showMore`; `console.lecture.options.languageSame`, `.languageHint`; changed `console.lecture.options.language` ("Slides language"). Removed: `console.lecture.picker.*`, `console.lecture.copyNoNames`, `console.lecture.catalogue.*`. Frame: `console.pageBack.to`, `console.shell.backToLearning` (changed), `common.display.*` (AMENDMENTS-DISPLAY-NAV section 10).
