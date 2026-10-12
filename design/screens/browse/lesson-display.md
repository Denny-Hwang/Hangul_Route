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
