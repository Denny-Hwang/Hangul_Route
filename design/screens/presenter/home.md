# Presenter home: Recent lessons and Quick lesson (screen spec v1)

Spec: F-TCH-004 sections 3.1 (without the console), 3.12, 3.13 · wireframe `classroom/lecture-presenter.md` A · PR 8
Mock: `mock/home.html`, `mock/home-empty.html` · shots `shots/home-375.png`, `-1280.png`, `-320-text200.png`, `home-empty-*`
Code: `apps/mobile/src/screens/presenter/HomeScreen.tsx` (PR 8), `logic/lecture/recent.ts` (PR 5)

## Anatomy

- A teacher page on `surface.paper` in rem (not stage-scaled), `layout.maxWidth.full`, gutters `layout.gutter.*`.
- **Header**: Hoya `waving` (64 px), h1 **Lecture** (`learner.presenter.home.title`, `size.title`), then the language chips **English / Español / 한국어** (`LOCALE_META` endonyms, each `lang`-tagged, a radio group named by `learner.presenter.language.title`) and **Keys and help** (opens the Help overlay of `overlays.md`). The chips change the presenter chrome for this session only (section 3.12); the persisted device locale is not written.
- **Recent lessons** (h2): up to 10 rows from `lecture:recent`, newest first. Each row: the deck title (teacher text, `size.bodyLg` bold) and when it was saved (`common.date.today` / `common.date.yesterday`, the capitalised standalone forms, else `formatDate` short); a remove button (`close` glyph, `touchTarget.min`, named `a11y.presenter.removeRecent`); **Resume** (primary, opens the start screen at `lastSlideKey`) and **Start over**. No row ever holds a name (the deck type has none).
- **Quick lesson** (h2) with the line "Choose what to teach. No sign-in, no names.", then groups (h3): Episodes, Single lessons, Letter sets (Consonants, Vowels), Word topics, Stories. Each item is a checkbox row (64 px): a `spacing.xxl` box with the `check` glyph when chosen, the title and a second line (about N min, or N letters). A chosen row gets a `borderWidth.thick` `text.primary` outline (shape, not colour alone). Groups appear only when the bundle has items for them (stories from the Library's review gate; topics with PR 12).
- **Build row** in flow after the last group: the chosen count (`role="status"`) and **Build lesson** (primary). With nothing chosen, Build lesson is disabled and the count line reads "Choose at least one item to build a lesson."; at 30 items more checkboxes are disabled with `learner.presenter.home.quick.full`.
- The line "Only for this session. Korean always shows romanization and a meaning." under the list.

## Layout

- Below 900 px: one column, Recent first (the common case is resuming). From 900 px: two columns, Recent left and Quick lesson right.
- At 320 px with 200 % text everything wraps; no sideways scroll (`home-320-text200.png`).

## States

| State | Drawn |
|---|---|
| Recent with three lessons, three items chosen | `home.html` |
| Nothing yet (empty Recent, nothing chosen) | `home-empty.html`: the dashed empty line `learner.presenter.home.recent.empty`, Build lesson disabled |
| Storage unavailable | the Recent list is replaced by `learner.presenter.home.recent.storageOff`; Quick lesson works (not drawn) |
| Landing after Exit or an invalid link | the same page; focus on the h1 |

## Accessibility

- Every control at least `touchTarget.min`; the chips are `role="radio"` with `aria-checked`; checkboxes are real inputs behind the drawn box.
- Build lesson's count line is a polite status.
