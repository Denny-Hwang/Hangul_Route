# Lecture mode card, nav item and space button (screen spec, LV-0b)

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` sections 3 (E1 to E4), 6, 7, 12.1 · wireframe `design/wireframes/classroom/lecture-entry-points.md` Panels E1 to E4 · row **LV-5** (and the renamed keys of LV-4)
Mock: `mock/teacher-home-lecture.html`, `mock/parent-home-lecture.html`, `mock/lecture-card-states.html`, `mock/lecture-card.css` (loaded after `app-shell.css`; tokens only)
Shots: `teacher-home-lecture-375`, `-1280`, `-320-text200`, `-375-first`; `parent-home-lecture-375`, `-768`, `-1280`, `-320-text200`, `-375-first`; `lecture-card-states-375`, `-1280`
The learner app card (E5) is in `design/screens/lecture-entry/learner-card.md`; the setup page the card opens (presets first, LV-4) is in `lecture-setup.md`.

## The card (E1 teacher home, E2 family home)

- A section with `id="lecture-mode"` (the nav item's target when there are zero or several spaces; focus goes to its heading): `brand.secondaryLight` ground, a `borderWidth.base` `brand.secondary` border, `radii.lg`, `spacing.lg` padding. `text.primary` on `brand.secondaryLight` is 12.35:1.
- h2 **Lecture mode** (`console.lecture.card.title`, `size.title`), the line **Teach on a big screen** (`card.tagline`, `size.bodyLg` semibold), one body line: `card.bodyClass` on the teacher home, `card.bodyFamily` on the family home (both say nobody's progress changes, section 3 rule).
- **Which class?** / **Which family?** (`card.chooseClass` / `card.chooseFamily`): with two or more composable spaces, a radio group of rows by space name, most recent first, at least `touchTarget.min`, the chosen row with a thick `text.primary` border. No counts, no ranking.
- **[[ Start lecture mode ]]** (`card.cta`): `btn-primary`, `touchTarget.hero` tall; full width on phones, its own width from 45em. One space: the space's lecture page (presets first). None (or a school admin with no `teacher` / `owner` role in any class): the no-space line and Start opens `/present` in a new tab, with the description "Opens in a new tab".
- **Loading**: the title and lines draw at once; Start shows `console.space.loading` ("Loading…") disabled with `aria-busy` until the spaces list answers, so nothing jumps. **Error**: as no space (Start opens `/present`), the home's own error notice unchanged.
- No badge, no "new", no count, never drawn disabled except while loading; nothing at all while `lectureModeEnabled()` is off.

## Placement

- **Teacher home**: first in the content column, above Classes, at every width.
- **Family home** (the wireframe's open question, measured; spec section 3 E2 amended to match): with the card above the learner cards, the first learner card no longer fits the first screen at 375 x 667 (frame, family heading and the card already take 667 px). So below 70em the card goes **directly after the first learner card** (one column below 45em; from 45em, where learner cards go two across, after the first row of them: `grid-row: 2` spanning the row). The first screen at 375 x 667 then keeps the whole first learner card and shows the top of the card (`parent-home-lecture-375-first.png`), and with two or more learners the card is never pushed below them all (`parent-home-lecture-375.png`, `-768.png`, two learners). From 70em it is first in the side column, level with the learner cards, above the family actions (`parent-home-lecture-1280.png`). The mock draws both slots and shows one per width; LV-5 renders one card, in the slot for the current width (`useWindowDimensions` against 70em), with `id="lecture-mode"` on it.

## Nav item (E3) and space button (E4)

- **Lecture mode** (`console.shell.nav.lecture`) after Lessons, before Billing, for both personas; `aria-current="page"` on any `/…/space/lecture` page. At 375 the tab row scrolls sideways as it already does (`adult-frame.md`); the family row's fifth and sixth items start off-screen there (`parent-home-lecture-375-first.png` shows "Lecture m…" cut at the edge), so the nav item is not the phone's quick way in by itself. **Requirement for LV-5** (spec section 3 E3 and the LV-5 row): the tab row scrolls its current item into view on load (`scrollIntoView({ inline: 'nearest' })` without smooth motion), which also fixes the same case for Billing; on the family home the card after the first learner card is the first-screen entry.
- Space page: the button keeps its place and secondary weight and reads **Lecture mode** (`console.lecture.entry.cta`, changed).

## Strings

Section 12.1 keys drawn: `console.shell.nav.lecture`, `console.lecture.entry.cta` (changed), `card.title`, `card.tagline`, `card.bodyClass`, `card.bodyFamily`, `card.cta`, `card.chooseClass`, `card.chooseFamily`, `card.noSpace`. Existing: the frame and home strings, `console` "Loading…".
Gaps found against section 12 (add in LV-5, es and ko to F-I18N-001 §3.10; now in the spec's section 12.1 table):

| Key | en | es | ko | Note |
|---|---|---|---|---|
| `console.lecture.card.noSpaceFamily` | You can show a lesson without a family space. | Puedes mostrar una lección sin un espacio familiar. | 가족 공간이 없어도 수업을 띄울 수 있어요. | `card.noSpace` says "No class needed", which is wrong on the family home of a parent with no family |
| `console.lecture.card.opensTab` | Opens in a new tab | Se abre en una pestaña nueva | 새 탭에서 열려요 | accessible description of Start when it opens `/present` |

## Review (lenses as in `design/screens/presenter/lecture-v2.md`)

Design: first-screen budget on the family home → placement rule above. Accessibility: radio rows and Start at least `touchTarget.min` / hero, no sideways scroll at 320 with 200 % text, focus target for the nav item. Privacy: no learner name in the card, the URL or the nav. Anti-pressure: no badge or count. Copy: no age words, no emoji; "Teach on a big screen" on both homes as section 12 sets it.
