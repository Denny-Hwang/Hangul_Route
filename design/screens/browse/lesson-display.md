# Lesson display sheet (BR-7)

Wireframe: `design/wireframes/browse/show-as.md` · Spec: F-BROWSE-001 §4.9 · Mock: `mock/lesson-display.html`, `mock/lesson-display-states.html` · Shots: `shots/lesson-display-375.png`, `-1280.png`, `shots/lesson-display-states-375.png`

Opened from [ Lesson display ] on home and on the item page. It is a bottom sheet on the compact class and a centred dialog (32rem) from the regular class, over a `surface.overlay` scrim.

| Part | Look |
|---|---|
| Sheet | `surface.paper`, `radii.xl` top corners (all four as a dialog), `shadows.modal`, padding `spacing.sm`/`spacing.xl` and the gutter; a 32 x 4 `border.strong` handle |
| Title | "Lesson display", Heading `prompt`, the dialog's name |
| Romanization | "Romanization" (Body bold), two radio rows 64 tall: (o) Always shown / ( ) Hidden until tap. The 24 ring is `text.primary` `borderWidth.base`, with a 12 dot when selected |
| Language | hidden while only English ships (`LOCALE_STATUS`). Shipped: "Language" and endonym chips (English, Español, 한국어), each 64 tall with `lang` set; selected chip is `brand.primary` with `text.onPrimary` |
| Note | "These choices change only this preview. No learner's settings change." Body (18) `text.secondary` |
| Done | `Button` primary, full width |

- `role="dialog"`, `aria-modal`, labelled by the title. Each group is a `radiogroup`.
- Escape, the scrim and Done close the sheet; focus returns to [ Lesson display ].
- A choice applies at once; Done only closes.
- It writes `browse:prefs` only when the keep switch is on; never a profile or the device locale.

## Revision 2026-10-17: the Romanization sheet (DN-7)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` sections 6 and 10 (F-BROWSE-001 §4.9 as amended) · mock `mock/romanization-sheet.html` (rules `mock/browse-dn7.css`) · shots `shots/romanization-sheet-375.png`, `-1280.png`, `-320-text200.png`

All lessons follows the device language, so the Language row goes and the sheet holds only the romanization choice. It is renamed for it: the header chip and the title read **Romanization** (`caregiver.browse.home.lessonDisplay.cta`, `caregiver.browse.display.title`, changed), because "Lesson display" next to the device-wide **Display** sheet read as one thing. The bold group label goes (the title names the radio group, `aria-labelledby`), so `caregiver.browse.display.romanization` is no longer drawn. The note, the two radio rows and Done are unchanged. The header gains the **Display (Aa)** control at the right (`.aa-btn`, accessible name "Aa, Display: language and text size"), which opens the shared Display sheet. The other browse shots (home, item, topic) still show the old chip name and no Aa; DN-7's PR attaches new screenshots of those pages.

