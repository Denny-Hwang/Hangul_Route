# F-CARD-S6-001 — Stage 6 Card Illustrations

**Status**: `ready` — amended 2026-10-23 by F-CURR-002 row CM-23 part 3: one card per upper cell, shipped behind the `upperCards` switch (built-in pct 0; the owner ramps it). Was `draft`, waiting on the stage's real-use content, which now exists (F-CURR-001 Stage 6 cells).
**Scope**: row CM-23 part 3 — `packages/design-system/src/components/HeritageCardArt/UpperCellArt.tsx` and `upper-card-ids.ts` (`upperCellCardArtIds`), `apps/mobile/src/content/heritage-cards.ts` (`upperCellCards`), `content/upper-cell-cards.ts`, `content/upper-card-backs.ts`, `content/upper-cell-card-sources.ts`, the Stage 6 cell files' `rewardCardIds`, the Library albums
**Owner**: solo dev
**Rollout**: with the `upperCards` switch (F-CURR-002 sections 7.2 and 12.2)

---

> **Amended 2026-10-23 by F-CURR-002 row CM-23 part 3 (section 7.2 and its decision record, which settle F-CURR-001 OD-7).** The earlier plan of 30 cards for the stage, its card seed and its age wording are gone: the scope is **one card per upper cell**, earned by finishing the cell's first volume, and the audience is anyone learning Hangul (CLAUDE.md section 1). The cards fill the five category albums of the Library.

## 1. Context

Stage 6 of the Journey is **real use**: the learner reads Korean out in the world, on a menu board, at a table, on a train ticket, on a trail sign and on a market price card. Each Stage 6 card shows **one real-world artifact with its Korean drawn in the picture**, the thing its cell teaches the learner to read.

## 2. User story

> As **a learner who finished a Stage 6 cell**, I want its card to look like the thing I just learned to read, a menu or a sign with real Korean on it, so the card keeps the act of reading something real.

## 3. Acceptance criteria (as built)

### 3.1 Cards

- Five rare cards, one per Stage 6 cell, each named in `unlockedBy: 'episode:stage6-<theme>'`, in the cell file's `rewardCardIds` and on no quest (`upperCellCards` in `apps/mobile/src/content/heritage-cards.ts`):

| Cell | Card | Korean | The picture |
|---|---|---|---|
| Read the Menu (`letters`) | Won (`card:won`) | 원 | a menu board, 김밥 이천 원 and 라면 삼천 원, a won coin |
| Order Food (`life`) | Over Here! (`card:yeogiyo`) | 여기요 | a friend at a table calls 여기요! to the server |
| Travel for Chuseok (`rites`) | Train Ticket (`card:gichapyo`) | 기차표 | a ticket, 서울 → 부산 at 두 시 |
| Hike & Ask (`nature`) | Summit (`card:jeongsang`) | 정상 | a trail sign, 정상 ↑ and 한 시간 |
| Buy at Market (`crafts`) | A Little Extra (`card:deom`) | 덤 | a price card, 사과 세 개 이천 원, and one apple more |

- Every Korean word on a card and in its picture is taught in its own cell. Amounts are round practice amounts in won. No brand, store name or logo is drawn.
- Each back-face fact cites a public institution from F-CURR-002 section 6.6 (`content/upper-cell-card-sources.ts`, held to the allowlist by the `culture-source` card check): the National Institute of Korean Language (원, 여기요, 역귀성, 덤) and the Korea National Park Service (the trail start times).
- A card is awarded from the cell's first finishes (`questDoneAt`), retroactively for a cell finished before the row shipped, once and the same on every device. Never random, never sold.

### 3.2 Visual contract

- The shipped geometric minhwa style of `HeritageCardArt` (design/brief/illustrations/heritage-card-art.md): rounded primitives, a ~3 px stroke, the theme tint, theme tokens only (no new token), at most five fill colours besides the tint and the floor shadow.
- **Diegetic Korean**: the artifact's Korean is drawn as text in the picture (`word` in `UpperCellArt.tsx`), never as a reading aid; the card's own Korean and romanization stay on the card face.

### 3.3 Art

- The drawings are `UpperCellCardArt` (`HeritageCardArt/UpperCellArt.tsx`), loaded in the app's upper-cards chunk, so the start bundle carries none of them. Budget tests: each new drawing at most 1,700 B of source; the module at most 34,000 B.

## 4. Out of scope

- Tap-to-hear on the drawn Korean.
- Photography and brand logos.

## 5. Dependencies

Upstream: F-CURR-002 section 7.2, F-CARD-001, F-CARD-002, F-STORY-006, F-MOTION-003.
