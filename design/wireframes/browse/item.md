# Browse/Item — what this lesson teaches, and Preview (wireframe v2)

Spec: `docs/specs/F-BROWSE-001-adult-content-browser.md` §4.6, §4.2, §4.4 (focus line), §4.11 (Present this)
Audience: **parent or teacher** in All lessons. No age wording, no price, no "Premium".
Code (planned): `apps/mobile/src/screens/browse/BrowseItemScreen.tsx` (one template for `quest`, `story`, `vocab-topic`), `logic/browse/facts.ts`, `logic/browse/access.ts`
Notation: as `browse/home.md`.

v2 (review of 2026-10-11): "Where it sits" with [ See on the Journey ] (the Learning Route is its own page); a closed lesson uses the learner's words "Opens with the full route", with [ See plans ] for account passes only; no preview strip on this catalogue page.

## Scenario (Given-When-Then)

Given: a grown-up opened a lesson from the episode outline, a story tile, a word topic, a report ("practice next: ㄴ") or a plan row
When: the item page opens
Then: in one screen they read what it teaches (letters, words, skills, minutes, the card, where it sits) and can play it exactly as a learner does

## Screen goal

"Understand this lesson, then preview it." (primary: [[ Preview this lesson ]])

## Box diagram

### A. Quest, full pass, opened from a report letter

```
┌──────────────────────────────────┐
│ [<]  More letters                │
│ ┌──────────────────────────────┐ │
│ │ Taught here: ~~ ㄴ ~~ n      │ │   focus line: only when opened for a letter
│ └──────────────────────────────┘ │
│ Lesson · About 5 minutes         │
│                                  │
│ What this teaches                │
│  Letters  ~~ ㄷ ~~ d  ~~ ㄴ ~~ n*│   * the focus letter marked (shape + label, not colour only)
│  Words    ~~ 나 ~~ na  me        │   romanization + gloss in the UI language
│  Skills   (Read) (Listen) (Write)│   never speaking
│  Steps    Meet the letters ·     │   the player's own step names, in order
│           Practice · Check · Card│
│                                  │
│ Where it sits                    │
│  Stage 1 · Letters · lesson 2/3  │
│           [ See on the Journey ] │   -> browse/home, Journey, this cell
│                                  │
│ The card it awards               │
│  [card] Hanji Paper              │   -> library/card-detail (preview)
│                                  │
│ [[   Preview this lesson   ]]    │   primary -> browse/preview-player
│ [ Present this ]                 │   only with a full pass and the presenter shipped
└──────────────────────────────────┘
```

### B. Closed lesson (sampler pass, content switch ON only)

```
│ What this teaches  (as A)        │
│ ...                              │
│ ┌──────────────────────────────┐ │
│ │ [lock] Opens with the full   │ │   the learner's own caption and glyph (F-ENT-003);
│ │        route                 │ │   replaces the primary button; no price, no countdown
│ │                [ See plans ] │ │   account pass only (not kept, not fallback)
│ └──────────────────────────────┘ │   -> billing page on the app host (same tab)
```

- With the switch off (production today) this state cannot appear.
- Gate or kept pass: the caption only, no [ See plans ].

### C. Story

```
│ Story · About 6 minutes          │
│ What this teaches                │
│  Levels   (o) Level 1 ( ) Level 2│   picks the level the preview opens
│  Scenes   8                      │
│  Key words ~~ 호랑이 ~~ horangi tiger …
│  Sources  [ See the sources ]    │   -> story/sources (copy-only links in this section)
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
- [ See plans ] (closed, account pass) -> billing page, same tab; `browse.plans_tapped { kind }`
- [ See on the Journey ] -> `browse/home` Journey at this cell
- Card -> `library/card-detail` (preview state)
- [ See the sources ] -> `story/sources` (Copy link only; no Open, no PIN)
- [>)] on a word -> plays it (no write)
- [ Present this ] -> opens `/present#d=…` with a one-block deck (new tab)
- [<] -> previous screen

## Navigation graph

Enter from: `browse/episode` · `browse/home` (story tile, topic row) · deep link `quest:` / `story:` / `vocab-topic:` / `jamo:` / `char:` (report, plan, roster chip) · `browse/preview-end` [ Back to the lesson page ]
Exit to: `browse/preview-player` · `library/card-detail` · `story/sources` · `browse/home` · billing (closed, account) · `classroom/lecture-presenter` (Present this)

## States

- **success, open**: A / C / D with the primary button.
- **success, closed**: B; the facts are identical, only the action differs.
- **focus letter not in this lesson** (resolver bug): the focus line is omitted, the page still renders.
- **no card**: the card block is hidden.
- **no words / no letters** (a story or a taste quest): the empty row is hidden, never "0 letters"; a taste quest shows its first three words.
- **unknown id**: never renders; resolution sends the grown-up to `browse/home` with the "not in this version" line.
- **error**: `OopsScreen` with [ Back ].

## Data needs

- reads: bundle only (`questById`, `scopeFor`, `questTeaches`, `questSkills`, `questStepLabel`, `storyById`, `topicItems`, `cardById`, `episodeById`); the pass (scope, source, kept, fallback); `flags.contentGatingEnabled`; F-ENT-003 `isQuestOpen` and `isContentLocked` (sampler)
- writes: none
- telemetry: `browse.item_viewed { access: 'open' | 'closed' }`, `browse.preview_started` (on the primary), `browse.plans_tapped`

## Open questions

- Should "Steps" show minutes per step? Default: no, the quest minutes are enough.
- For a report letter that no shipped quest teaches (a batchim), the resolver lands on home with a note; beta will show whether a "letters" index page is needed.
