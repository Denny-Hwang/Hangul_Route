# Browse/Show-as — Lesson display: how lessons are shown during preview (wireframe v2, bottom sheet)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.9
Audience: **parent or teacher** in All lessons.

v2 (review of 2026-10-11): the sheet and its header button are named **Lesson display** ("Show as" did not say what it changes); the file keeps its name so links stay stable; romanization covers every learner call site; the language choice stays in memory.
Code (planned): `apps/mobile/src/screens/browse/LessonDisplaySheet.tsx`, `BrowseSettingsProvider` + `useRomanizationMode()` (BR-5c), `locale-store.setSessionLocale` (memory only)
Notation: as `browse/home.md`.

## Scenario (Given-When-Then)

Given: a grown-up wants to see a lesson the way a learner with a different setting sees it (romanization hidden for reading practice), or in another UI language
When: they open Lesson display from the header
Then: they change it in one tap and every lesson they open next follows it

## Screen goal

"Change how lessons are shown." (one sheet, two choices)

## Box diagram

```
┌──────────────────────────────────┐
│ ──                               │   sheet handle; Escape / swipe down closes
│ Lesson display                   │
│                                  │
│ Romanization                     │
│  (o) Always shown                │
│  ( ) Hidden until tap            │   the learner setting of the same name (D2)
│                                  │
│ Language                         │
│  ( English )( Español )( 한국어 ) │   endonym chips; only locales that have shipped
│                                  │
│ These choices change only this   │
│ preview. No learner's settings   │
│ change.                          │
│                                  │
│ [[          Done           ]]    │
└──────────────────────────────────┘
```

## Interaction points

- Romanization radio -> applies at once to open and later lessons (every learner call site: Discover, the games, story checks and ordering, the story reader, checkpoints and word recaps)
- Language chip -> re-renders Browse and lessons in that UI locale (glosses through overlays; taught Korean unchanged)
- [[ Done ]] / Escape / swipe -> closes; focus returns to [Lesson display]

## Navigation graph

Enter from: `browse/home` header · `browse/item` header (same button)
Exit to: the screen it opened over

## States

- **success**: as above.
- **one locale shipped** (today, English only): the Language row is hidden.
- **kept on device**: when the keep switch is on, choices persist in `browse:prefs` for 7 days; otherwise they last for the tab.
- **error**: not applicable (no data).

## Data needs

- reads: shipped locale list (`packages/i18n` `LOCALE_STATUS`), the current browse settings
- writes: `browse:prefs` only when the keep switch is on; never the device locale, never a profile's settings
- telemetry: none

## Open questions

- Audio speed follows the default learner level in preview; a "slower audio" choice could be added if teachers ask. Default: not offered.
