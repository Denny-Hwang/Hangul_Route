# Browse/Episode — one grid cell, its lessons and what each teaches (wireframe v3)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.6, §4.2
Audience: **parent or teacher** in All lessons (grown-up surface). No age wording.

v2 (review of 2026-10-11): no preview strip on this catalogue page; back can lead to the Route section.
v3 (2026-10-12, F-ENT-003 §6.4 adopted): a closed lesson row (only possible with the content switch on) carries the grown-up caption "Opens with the Family Plan or a Group License" [BY], with no lock glyph (F-ENT-003 OD-6).
Code (planned): `apps/mobile/src/screens/browse/BrowseEpisodeScreen.tsx`, `logic/browse/facts.ts` (`itemFacts`), `logic/my-route/skills.ts` (`questSkills`, read only), `logic/stage1/curriculum.ts` (`questTeaches`, read only)
Notation: as `browse/home.md`.

## Scenario (Given-When-Then)

Given: a grown-up tapped a Journey cell in All lessons, or followed a Learning Route or plan link to an episode
When: the episode outline opens
Then: they see the episode as its learner page introduces it, and for each lesson the letters, skills and minutes, so they know what the cell covers before opening any lesson

## Screen goal

"Pick the lesson to look at." (secondary: see the cards this episode awards)

## Box diagram

```
┌──────────────────────────────────┐
│ [<]  Meet the Letters            │   back -> where it came from (home: Route or Journey)
│ Stage 1 · Letters · About 14 min │   stage, theme, sum of quest minutes
│ (Hoya) "Hoya's intro line as the │   the learner episode page's own intro (hoyaIntroEn)
│  learner page shows it"          │
│                                  │
│ Lessons                          │
│ ┌──────────────────────────────┐ │
│ │ 1  First letters      ~5 min │ │   one row per quest, questIds order
│ │    ~~ ㄱ ~~ g  ~~ ㄴ ~~ n  … │ │   letters its Discover step introduces
│ │    (Read) (Listen) (Write)   │ │   skills chips; speaking is never listed
│ │                     [ Open ] │ │   -> browse/item (quest)
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ 2  More letters  ~5 min      │ │
│ │    ~~ ㄷ ~~ d …              │ │
│ │    Opens with the Family Plan│ │   closed (sampler + switch on only): the grown-up
│ │    or a Group License        │ │   caption, no glyph; [ Open ] still opens the page
│ │                     [ Open ] │ │
│ └──────────────────────────────┘ │
│                                  │
│ Cards in this episode            │
│ [card] [card] [card]             │   thumbnails -> library/card-detail (preview state)
└──────────────────────────────────┘
```

Story episode variant (format `story`):

```
│ Stories                          │
│ ┌──────────────────────────────┐ │
│ │ [cover] Story title          │ │   one row per storyId; levels offered, scene count
│ │ 2 levels · 8 scenes  [ Open ]│ │   -> browse/item (story)
│ └──────────────────────────────┘ │
```

## Interaction points

- [ Open ] on a lesson row -> `browse/item { kind: 'quest', id }`
- [ Open ] on a story row -> `browse/item { kind: 'story', id }`
- Letter chip -> nothing (read only; the item page explains it)
- Card thumbnail -> `library/card-detail` (preview state)
- [<] -> previous screen (home with this cell selected, or the route)

## Navigation graph

Enter from: `browse/home` (Journey cell) · deep link `episode:<id>` (plan builder episode row) · `browse/item` "See on the Journey" (back)
Exit to: `browse/item` · `library/card-detail` · `browse/home`

## States

- **success**: as above (full, or sampler with the switch off: identical, no closed row).
- **closed rows** (sampler, switch on): caption as row 2; never a price.
- **coming later** (episode `status: 'preview'` or no quests): title, stage and theme, one line "Coming later", no lesson rows, no cards row.
- **empty cards**: the cards row is hidden when the episode awards none.
- **unknown id** (deep link to an episode this app version lacks): goes to `browse/home` with the "not in this version" line; this screen never renders empty.
- **error**: `OopsScreen` with [ Back ].

## Data needs

- reads: `episodeById`, `questById`, `questTeaches`, `questSkills`, `cardById`, `storyById` (bundle only); the pass scope and `flags.contentGatingEnabled` (for closed rows)
- writes: none
- telemetry: `browse.item_viewed { kind: 'episode', itemId, access }`

## Open questions

- None blocking. Every lesson that introduces no letter (the Stage 2 and 4 taste quests, and some later Stage 1 lessons such as Mountain, River, Sea) shows its first three words (romanization and gloss) in place of the empty letters row (spec §4.6).
