# F-011 — Stage 2 taste: Lunch Box Words

**Status**: `ready`
**Scope**: Mobile (content)
**Owner**: solo dev
**Rollout**: MVP (Stage 2 taste)

---

## 1. Context

CLAUDE.md §1 MVP scope: "Stage 2 / Stage 4 — taste only". Until now only
Stage 1 had real content; Stages 2–7 were `preview` placeholders. This adds
**one shipped Stage 2 episode** so players who finish Stage 1 get a glimpse of
what's next.

- Episode: `episode:stage2-life` "Lunch Box Words" (status `shipped`).
- One quest `quest:stage2-life-q1` (5-step) reusing existing minigames — no new
  game code:
  - present: **card-match** (food words)
  - practice: **culture-quiz** (word → meaning)
  - apply: **build-letter** (build batchim syllables 물/산/달/곰)
- 4 heritage cards (사과/우유/빵/도시락).

A second taste episode `episode:stage2-nature` "Outdoor Words" follows the same
shape (card-match / culture-quiz / build-letter; cards 하늘/꽃/나무/별), reusing
Stage 1 nature vocab (산/바다) for review.

No gating work needed: `unlockedByDefault` is unused; JourneyScreen gates on
`episode.status === 'preview'`, and HomeScreen picks the next unfinished quest
from `questsAll` sequentially — so Stage 2 surfaces naturally after Stage 1.

## 2. Vocabulary scaffolding (content-skill §3.4)

- New words: 사과, 우유, 빵, 물, 도시락.
- Stage 1 review (≥ some reappearance): 밥, 김밥, 김치, 산, 달.
- All Korean shown with romanization + English (card-match / quiz columns).

## 3. Acceptance criteria

- `episode:stage2-life` is `shipped`, in `episodesAll`, removed from preview set.
- `quest:stage2-life-q1` in `questsAll`; HomeScreen surfaces it after Stage 1.
- 4 stage2 cards in `heritageCardsAll`, unlocked by the episode; reward card
  `card:dosirak` exists.
- 3 stage2 minigame scopes resolve via `scopeFor`.
- mobile typecheck + tests pass.

## 4. Out of scope

- Other Stage 2 themes (still preview).
- Stage 4 taste.
- New minigame types or new heritage card art (geometric placeholders).

## 5. Tests

- Existing content typing guarantees enum/shape; mobile typecheck covers it.

## 6. Dependencies

- **Upstream**: F-010 (culture-quiz), Stage 1 content, build-letter.
- **Downstream**: none.
