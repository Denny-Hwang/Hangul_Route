# F-CARD-S7-001 — Stage 7 Card Illustrations

**Status**: `ready` — amended 2026-10-23 by F-CURR-002 row CM-23 part 3: one card per upper cell and the five album legendary cards, shipped behind the `upperCards` switch (built-in pct 0; the owner ramps it). Was `draft`, waiting on the stage's writing content, which now exists (F-CURR-001 Stage 7 cells).
**Scope**: row CM-23 part 3 — `packages/design-system/src/components/HeritageCardArt/UpperCellArt.tsx` and `upper-card-ids.ts` (`upperCellCardArtIds`, `albumLegendArtIds`), `apps/mobile/src/content/heritage-cards.ts` (`upperCellCards`, `albumLegendCards`), `content/award-world.ts` (`albumCardSets`), `content/upper-card-backs.ts`, `content/upper-cell-card-sources.ts`, the Stage 7 cell files' `rewardCardIds`, the Library albums and the Results album celebration
**Owner**: solo dev
**Rollout**: with the `upperCards` switch (F-CURR-002 sections 7.2 and 12.2)

---

> **Amended 2026-10-23 by F-CURR-002 row CM-23 part 3 (section 7.2 and its decision record, which settle F-CURR-001 OD-7).** The earlier plan of 30 legendary cards for the stage, its card seed, its age wording and its personalization slot are gone: the scope is **one card per upper cell**, earned by finishing the cell's first volume, plus **one legendary card per category album**. No card carries a learner's name, voice, drawing or any other personal detail, so the stage needs no user-generated content and no extra privacy review. The audience is anyone learning Hangul (CLAUDE.md section 1).

## 1. Context

Stage 7 of the Journey is **writing**: the learner builds short sentences from each cell's word bank. Each Stage 7 card shows **the card's word as a word-bank tile over a ruled page** holding a sentence the cell builds with it. The sentences use a neutral cast only: Hoya, Hoya's family and a friend.

Stage 7 is also where the five category albums can first be finished, so the five album legendary cards ship with it.

## 2. User story

> As **a learner who finished a Stage 7 cell**, I want its card to show the word I wrote with, in a sentence the lesson built, so the card keeps the act of writing in Korean.

> As **a learner who filled an album**, I want a card that marks it, so the goal that ran across the stages ends with something to keep.

## 3. Acceptance criteria (as built)

### 3.1 Cards

- Five rare cards, one per Stage 7 cell, each named in `unlockedBy: 'episode:stage7-<theme>'`, in the cell file's `rewardCardIds` and on no quest:

| Cell | Card | Korean | The page |
|---|---|---|---|
| Write Your Name (`letters`) | Name (`card:ireum`) | 이름 | 제 이름은 호야예요. |
| My Day in Korean (`life`) | Morning (`card:achim`) | 아침 | 아침에 빵을 먹어요. |
| My Holiday Memory (`rites`) | Birthday (`card:saengil`) | 생일 | 생일에 케이크를 먹었어요. |
| My Favorite Animal (`nature`) | Rabbit (`card:tokki`) | 토끼 | 토끼는 작아요. |
| Make & Share (`crafts`) | Plane (`card:bihaenggi`) | 비행기 | 비행기를 접어요. |

- Every word and sentence is the cell's own (word-bank framing only); none carries a learner's details.
- Each back-face fact cites the National Institute of Korean Language (the loanword spelling rules, 에, 돌, 토끼, 종이접기), held to the F-CURR-002 section 6.6 allowlist by the `culture-source` card check.

### 3.2 The album legendary cards

- One legendary card per album, `unlockedBy: 'set:album-<theme>'`; its set is the album's five upper-cell cards (Stages 2, 3, 4, 6 and 7), so the set rule brings it once all five are held, dated by the last of them, retroactively, once and the same on every device:

| Album | Card | Korean | Source |
|---|---|---|---|
| Letters | Hangul Book (`card:hunminjeongeum`) | 훈민정음 | UNESCO Memory of the World, Hunminjeongum Manuscript (inscribed 1997) |
| Food | Jang Making (`card:jang`) | 장 담그기 | UNESCO, Knowledge, beliefs and practices related to jang making in the Republic of Korea (inscribed 2024) |
| Holidays | Hangawi (`card:hangawi`) | 한가위 | National Institute of Korean Language |
| Nature | Jirisan (`card:jirisan`) | 지리산 | Korea National Park Service |
| Play | Ssireum (`card:ssireum`) | 씨름 | UNESCO, Traditional Korean wrestling (Ssirum/Ssireum) (inscribed 2018, a joint application of the DPR Korea and the Republic of Korea) |

- A UNESCO claim names the exact element under its UNESCO name with its inscription year; no fact claims an origin for heritage Korea shares with its neighbours.
- A run that fills an album shows its legendary card on Results with "Album complete!" and the F-MOTION-003 drop-in and sparkles; under reduced motion it is there at once, with no sparkles. A legendary card earned on a reconcile is named in Home's catch-up card. The Library album row says "Album complete" and shows the legendary card first.

### 3.3 Visual contract

- The shipped geometric minhwa style, theme tokens only (no new token), at most five fill colours besides the tint and the floor shadow (the earlier stages' cap; the plan's personal palette and ten colours are not used).
- Stage 7 pages draw the word tile in the `HoyaBubble` language (cream fill, sky-blue border) and the sentence in handwriting blue on a ruled page.
- Legendary cards sit in a frame of the legendary rarity token with their Korean name on a label.

### 3.4 Art

- `UpperCellCardArt` (`HeritageCardArt/UpperCellArt.tsx`) in the app's upper-cards chunk. Budget tests: each new drawing at most 1,700 B of source, the shared frames (`word`, `Page`, `Legend`) at most 3,200 B, the module at most 34,000 B.

## 4. Out of scope

- Recording, drawing or naming on a card; sharing beyond the shipped F-CARD-003 share.

## 5. Dependencies

Upstream: F-CURR-002 section 7.2, F-CARD-S6-001, F-CARD-001, F-CARD-002, F-STORY-006, F-MOTION-003.
