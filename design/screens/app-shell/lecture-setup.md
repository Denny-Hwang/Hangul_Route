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

New for LV-4 (`AMENDMENTS-LECTURE-V2.md` section 12.6): `console.lecture.presets.chooser.label`, `.tab.lessons`, `.tab.stories`, `.tab.words`, ~~`.tab.letters`~~ (not added: the console offers no letter sets, review log 2026-10-17 item 1), `.lessonsIn`, `.showMore`; `console.lecture.options.languageSame`, `.languageHint` (under the select while Same as this device is chosen; the mock's state), `.languageHintChosen` ("Slides show in {endonym} on every device, a copied link too.", while a language is chosen; review 2026-10-17); changed `console.lecture.options.language` ("Slides language"). Removed: `console.lecture.picker.*`, `console.lecture.copyNoNames`, `console.lecture.catalogue.*`. Frame: `console.pageBack.to`, `console.shell.backToLearning` (changed), `common.display.*` (AMENDMENTS-DISPLAY-NAV section 10).

## Built (LV-4, 2026-10-17)

Shots of the built page (console e2e export, mocked API, `apps/web/e2e/console-lecture-presets.spec.ts` with `HR_SHOTS=1`; teacher on a class with no plan and no summaries unless named):

- `shots/lv4-lecture-setup-320.png`, `-768.png`, `-1180.png`: the page as it opens. Nothing to follow, so **Start from zero: Hangul week 1** is first and open (20 min: its three lessons and the quick quiz, about 19 min), **Next lesson** is last; Next lesson's line is its fallback ("Nothing to follow yet, so this starts with Hangul week 1."); no Word review card before `LECTURE_V2_LINKS_FROM` (2026-11-01, the section 4.5 rollout rule). The sticky footer holds the outline's minutes, **Open presenter** and **Copy link**.
- `shots/lv4-lecture-customize-320.png`, `-768.png`, `-1180.png`: Stage by stage on Stage 2, then Customize open: Source, **What to add** (tabs Lessons · Stories · Word topics, the stage chips, Word Builder's six lessons open and drawn mixed), the Outline prefilled from the preset, Options with Slides language (Same as this device), the title (the preset's name) and the checks. `shots/lv4-lecture-customize-footer-320.png`: the first screen of the open chooser with the footer under it.
- `shots/lv4-lecture-setup-from-plan-1180.png`: opened from "Present this plan" (`?from=plan`): Next lesson first and open, "From this week's plan: Week 3 letters", the plan's own two lessons, Customize with the plan title.
- `shots/lv4-lecture-setup-family-320.png`, `-320-text200.png`: a family space with a learner on the Learning Route: Next lesson first, "Picks up where your family is.", **Check the TV or screen**, **+ Family code**; at 200 % text nothing scrolls sideways and each episode row puts its "{n} lessons inside" button on its own line.

- `shots/lv4-lecture-popup-blocked-320.png` (LV-4 review): Open presenter pressed with the page at its top and the pop-up blocked: the answer is the footer's status line, above the buttons.
- `shots/lv4-lecture-footer-568x320.png`, `shots/lv4-lecture-footer-320-text200.png` (LV-4 review): a landscape phone keeps the footer sticky in one row (the minutes beside the buttons, `touchTarget.min` below `layout.compactHeight`); at 320 px with 200 % text the footer would cover more than a third of the window, so it sits at the end of the page.

Differences from the mock, for the reviewers (`AMENDMENTS-LECTURE-V2.md` review log 2026-10-17, the LV-4 build and its review): no **Letters** tab (the console offers no letter sets); the length and stage chips are native radios in a fieldset (one tab stop, the arrows move); the whole episode locks its lessons (one tri-state choice); the page keeps the console's PageBack and title line above the h1; a roster that does not load keeps the page's error line and Try again instead of the presets (the page words itself by the space kind and checks a typed title against the roster; plans that do not load leave every card working, as the states mock draws); the answer to Open presenter or Copy link and the title problem (Customize closed) show in the sticky footer above its buttons; the footer is sticky only while it covers at most a third of the window, and its buttons step down from `touchTarget.hero` to `touchTarget.min` in a window shorter than `layout.compactHeight` (the F-STORY-002 rule for a pinned hero button).
