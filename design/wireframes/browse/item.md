# Browse/Item — what this lesson teaches, and Preview (wireframe v1)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.6, §4.2, §4.4 (focus line), §4.11 (Present this)
Audience: **parent or teacher** in Browse. No age wording, no price, no "Premium".
Code (planned): `apps/mobile/src/screens/browse/BrowseItemScreen.tsx` (one template for `quest`, `story`, `vocab-topic`), `logic/browse/facts.ts`, `logic/browse/access.ts`
Notation: as `browse/home.md`.

## Scenario (Given-When-Then)

Given: a grown-up opened a lesson from the episode outline, a story tile, a word topic, a report chip ("needs work: ㄴ") or a plan row
When: the item page opens
Then: in one screen they read what it teaches (letters, words, skills, minutes, the card, where it sits on the route) and can play it exactly as a learner does

## Screen goal

"Understand this lesson, then preview it." (primary: [[ Preview this lesson ]])

## Box diagram

### A. Quest, full pass, opened from a report letter

```
┌──────────────────────────────────┐
│ [<]  More letters                │
│ ┌──────────────────────────────┐ │
│ │ Preview. Nothing is saved.   │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Taught here: ~~ ㄴ ~~ n      │ │   focus line: only when opened for a letter
│ └──────────────────────────────┘ │
│ Lesson · About 5 minutes         │
│                                  │
│ What this teaches                │
│  Letters  ~~ ㄷ ~~ d  ~~ ㄴ ~~ n*│   * the focus letter highlighted (shape + label, not colour only)
│  Words    ~~ 나 ~~ na  me        │   romanization + gloss in the UI language
│  Skills   (Read) (Listen) (Write)│   never speaking
│  Steps    Meet the letters ·     │   the player's own step names, in order
│           Practice · Check · Card│
│                                  │
│ On the Learning Route            │
│  Stage 1 · Letters · lesson 2/3  │
│                [ See on route ]  │   -> browse/home, Journey, this cell
│                                  │
│ The card it awards               │
│  [card] Hanji Paper              │   -> library/card-detail (preview)
│                                  │
│ [[   Preview this lesson   ]]    │   primary -> browse/preview-player
│ [ Present this ]                 │   only with a full pass and the presenter shipped
└──────────────────────────────────┘
```

### B. Sampler outline (lesson outside the free set)

```
│ What this teaches  (as A)        │
│ ...                              │
│ ┌──────────────────────────────┐ │
│ │ Included with a plan         │ │   replaces the primary button; no price, no countdown
│ │                [ See plans ] │ │   -> billing page on the app host
│ └──────────────────────────────┘ │
```

### C. Story

```
│ Story · About 6 minutes          │
│ What this teaches                │
│  Levels   (o) Level 1 ( ) Level 2│   picks the level the preview opens
│  Scenes   8                      │
│  Key words ~~ 호랑이 ~~ horangi tiger …
│  Sources  [ See the sources ]    │   -> story/sources (existing screen)
│ [[   Preview this story   ]]     │   -> learner story reader, replay mode
│ [ Preview the questions ]        │   -> the story quest's checks in preview
```

### D. Word topic

```
│ Words · 12 words                 │
│ ┌──────────────────────────────┐ │
│ │ [pic] ~~ 밥 ~~ bap   rice [>)]│ │   every word: picture, Korean, romanization, gloss,
│ │ [pic] ~~ 물 ~~ mul   water[>)]│ │   [>)] plays the word (learner audio)
│ │ …                            │ │
│ └──────────────────────────────┘ │
│ [[   Preview the flashcards  ]]  │   only once F-VOC-003 screens exist; until then the
                                       list above is the preview and no button shows
```

## Interaction points

- [[ Preview this lesson ]] -> `browse/preview-player` (quest, story or flashcards)
- [ See plans ] (sampler) -> billing page (new tab); `browse.outline_tapped { kind }`
- [ See on route ] -> `browse/home` Journey at this cell
- Card -> `library/card-detail` (preview state)
- [ See the sources ] -> `story/sources`
- [>)] on a word -> plays it (no write)
- [ Present this ] -> opens `/present#d=…` with a one-block deck (new tab)
- [<] -> previous screen

## Navigation graph

Enter from: `browse/episode` · `browse/home` (story tile, topic row) · deep link `quest:` / `story:` / `vocab-topic:` / `jamo:` / `char:` (report, plan, roster chip) · `browse/preview-end` [ Back to the lesson page ]
Exit to: `browse/preview-player` · `library/card-detail` · `story/sources` · `browse/home` · billing (sampler) · `classroom/lecture-presenter` (Present this)

## States

- **success, play**: A / C / D with the primary button.
- **success, outline**: B; the facts are identical, only the action differs.
- **focus letter not in this lesson** (should not happen; resolver bug): the focus line is omitted, the page still renders.
- **no card** (a lesson without `rewardCardId`): the card block is hidden.
- **no words / no letters** (a story or a taste quest): the empty row is hidden, never "0 letters".
- **unknown id**: never renders; resolution sends the grown-up to `browse/home` with the "not in this version" line.
- **error**: `OopsScreen` with [ Back ].

## Data needs

- reads: bundle only (`questById`, `scopeFor`, `questTeaches`, `questSkills`, `questStepLabel`, `storyById`, `topicItems`, `cardById`, `episodeById`); the pass scope; the free-content registry (sampler)
- writes: none
- telemetry: `browse.item_viewed`, `browse.preview_started` (on the primary), `browse.outline_tapped`

## Open questions

- Should "Steps" show minutes per step? Default: no, the quest minutes are enough.
- For a report letter that no shipped quest teaches (a batchim), the resolver lands on home with a note; beta will show whether a "letters" index page is needed.
