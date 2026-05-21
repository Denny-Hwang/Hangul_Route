# F-CARD-S2-001 — Stage 2 Card Illustrations (deferred)

**Status**: `draft` — implementation **deferred** until Stage 2 content (60 Korean words) is authored. Spec exists to plan the visual contract.
**Scope**: `packages/design-system/src/components/HeritageCardArt/` extension · `apps/mobile/src/content/` · Stage 2 cards
**Owner**: solo dev
**Rollout**: Stage 2 unlock (after Stage 1 alpha + Word content authoring)

---

## 1. Context

F-CARD-001 + F-004 shipped all 30 Stage 1 Heritage cards. Stage 2 is "Words" — 60 Korean words across the same 5 themes (Letters / Life / Rites / Nature / Crafts). Per CLAUDE.md §1, each grid cell rewards a Heritage card.

Stage 2 grid: 5 themes × N cards per cell × 5 cells = ~30 new cards needed (matches Stage 1's count).

This spec defines the visual contract and content plan so Stage 2 ships uniformly.

## 2. User story

> As **P5 (a child who finished Stage 1 with 30 cards collected)** beginning Stage 2, I want each new word I learn to come with its own **card** — visually distinct from Stage 1 but in the same Hangul Route style — so my collection keeps growing.

## 3. Acceptance criteria (when implemented)

### 3.1 Card content authoring

- `apps/mobile/src/content/heritage-cards.ts` gains a Stage 2 section: 30 new card entries (6 per theme, matching Stage 1's density).
- Each card has `stage: 'stage2'` and follows the existing `HeritageCard` zod schema.
- Selection: focus on **concrete nouns** the child can visualize (e.g., `학교 school`, `친구 friend`, `책상 desk`) — easier to illustrate than abstract concepts.

### 3.2 Visual contract (inherits from F-CARD-001)

- Same geometric minhwa style — rounded primitives, ~3px stroke, max 5 colors
- Same theme tinting (`theme.letters`, `theme.life`, etc.)
- Same rarity distribution: ~3 common / ~2 uncommon / ~1 rare per theme
- **One legendary card per theme** — the "summit" card unlocked at theme completion (Stage 2 has 5 legendaries; Stage 1 had only 1)
- New visual marker for Stage 2 cards: a small `2` watermark in the corner OR a slightly different border treatment to distinguish from Stage 1 cards in the Library

### 3.3 HeritageCardArt extension

- `packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx` adds 30 new switch cases
- `supportedCardIds` includes all 60 Stage 1 + Stage 2 cards
- Per-card SVG follows the established pattern (Frame + geometric shapes)

### 3.4 Backwards compatibility

- Stage 1 cards unchanged
- Card art component API unchanged

## 4. Out of scope

- **Stage 3 cards** (Sentences) — own spec F-CARD-S3-001
- **Real illustrator art** — placeholder SVGs, like Stage 1
- **Card back face** changes — F-CARD-002 contract inherited
- **Animated reveal** beyond F-MOTION-003 — already covers all stages

## 5. Cost estimate

- Content authoring: 1 day for 30 word entries + blurbs + fun facts
- SVG illustration: ~15-20 min per card × 30 cards = ~8 hours
- Testing: typecheck + Library page check = ~1 hour
- Total: ~2 dev days when triggered

## 6. Ship-when triggers

Implement F-CARD-S2-001 when **all** are true:

1. **Stage 2 word content** authored (`apps/mobile/src/content/stage2-words.ts` or similar exists with the 60 target words)
2. **Stage 2 quests** drafted (the quests that unlock these cards)
3. **Stage 1 beta** has completed (real-user feedback on the Heritage Library experience before doubling the surface area)

## 7. Suggested 30-card seed list (per theme)

When triggered, start with these candidates (subject to editorial review):

### Letters & Books (6)
가족 family · 학교 school · 친구 friend · 선생님 teacher · 책상 desk · 의자 chair

### Food & Daily Life (6)
물 water · 우유 milk · 사과 apple · 떡볶이 tteokbokki · 라면 ramyeon · 빵 bread

### Holidays & Traditions (6)
생일 birthday · 추석상 chuseok table · 한복저고리 hanbok top · 가야금 (returns) · 윷판 yut board · 색동저고리 colorful jeogori

### Nature & Animals (6)
나무 tree · 꽃 flower · 물고기 fish · 새 bird · 해 sun · 비 rain

### Play & Crafts (6)
공 ball · 인형 doll · 그림 painting · 종이학 paper crane (returns?) · 노래 song · 춤 dance

## 8. Dependencies

Upstream: F-CARD-001 + F-CARD-002 (✅ shipped), Stage 2 content (BLOCKED — not authored).
Downstream: F-CARD-S3-001 (Stage 3) through F-CARD-S7-001 (Stage 7).
External: native-Korean editorial review for word selection.
