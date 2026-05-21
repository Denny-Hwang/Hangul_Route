# F-CARD-S3-001 — Stage 3 Card Illustrations (deferred)

**Status**: `draft` — implementation **blocked** on Stage 3 content (sentence library) being authored.
**Scope**: `packages/design-system/src/components/HeritageCardArt/` + `apps/mobile/src/content/`
**Owner**: solo dev
**Rollout**: Stage 3 unlock (after Stage 2 alpha + sentence content authoring)

---

## 1. Context

Stage 3 of the Heritage Journey is **Sentences** — children move from individual words to simple subject-verb constructions like "이건 책이에요" (This is a book) or "나는 김치를 먹어요" (I eat kimchi). Per CLAUDE.md §1, each grid cell rewards a Heritage card.

Stage 3 cards visually represent **mini-scenes** — a sentence in one frame. Where Stage 1 cards were one object (a tiger, a book) and Stage 2 cards are one word (a school, a friend), Stage 3 cards have a tiny tableau: subject + verb + object suggested by 2–3 shapes interacting.

Card count target: 30 (matching Stage 1 / Stage 2 density — 6 per theme).

## 2. User story

> As **P5** (5–11 yo, completed Stage 2 with 60 cards collected) entering Stage 3, I want each new sentence I master to come with a tiny **scene** card — visually distinct from Stages 1 and 2 — so my Library grows in storytelling depth, not just count.

## 3. Acceptance criteria (when implemented)

### 3.1 Card content

- `heritage-cards.ts` gains a Stage 3 section: 30 entries with `stage: 'stage3'`.
- Each card represents a **sentence pattern** (e.g., subject + verb + object). Sample titles:
  - "I read a book" (책을 읽어요)
  - "Mom cooks rice" (엄마가 밥을 해요)
  - "We bow on Seollal" (설날에 절을 해요)
  - "The tiger sleeps" (호랑이가 자요)
  - "I fly a kite" (연을 날려요)

### 3.2 Visual contract (extends F-CARD-001)

- Same geometric minhwa style — rounded primitives, ~3px stroke
- **Max colors per card raised to 6** (was 5 in Stages 1-2) — sentence scenes need slightly more visual elements (subject + object minimum)
- **Two-actor compositions** — at minimum 2 shapes interacting (e.g., child + book; tiger + tree)
- Theme tinting preserved — letter / life / rites / nature / crafts wash at 8% opacity
- **Stage 3 watermark**: small `3` glyph in the corner OR a slightly thicker rarity border to distinguish from Stages 1 / 2 in the Library

### 3.3 Rarity distribution

Same as Stage 1 / Stage 2: ~3 common + ~2 uncommon + ~1 legendary per theme. Legendary cards anchor the major "sentence pattern" milestone (e.g., the first negation sentence "I don't like kimchi" might be legendary because it's a structural leap).

### 3.4 HeritageCardArt extension

- 30 new switch cases in `HeritageCardArt.tsx`
- `supportedCardIds` includes all 90 Stage 1 + 2 + 3 cards
- Per-card SVG follows the Frame + composition pattern

## 4. Out of scope

- **Animated scene** (subject + verb mini-animation when card is unlocked) — F-MOTION-010 (Phase 2)
- **Card backs** (Stage 3 cards inherit F-CARD-002 contract automatically)
- **Voice acting** of the sentence ("이건 책이에요" spoken) — see F-009 narration framework; future per-card narration is F-CARD-S3-NAR-001
- **Localization to other UI languages** — UI stays English

## 5. Suggested 30-card seed (subject to native-Korean editorial review)

### Letters & Books (6)
- 책을 읽어요 (I read a book) · common
- 글씨를 써요 (I write letters) · common
- 책상에서 공부해요 (I study at the desk) · uncommon
- 친구에게 편지를 써요 (I write a letter to a friend) · rare
- 한글을 배워요 (I learn Hangul) · uncommon
- 한글날이에요 (It's Hangul Day) · legendary

### Food & Daily Life (6)
- 밥을 먹어요 (I eat rice) · common
- 우유를 마셔요 (I drink milk) · common
- 엄마가 김치를 만들어요 (Mom makes kimchi) · uncommon
- 가족이 함께 식사해요 (Family eats together) · rare
- 한복을 입어요 (I wear hanbok) · uncommon
- 잘 먹었습니다 (I'm done eating — thank you) · legendary

### Holidays & Traditions (6)
- 설날에 절을 해요 (I bow on Seollal) · uncommon
- 떡국을 먹어요 (I eat tteokguk) · common
- 송편을 만들어요 (I make songpyeon) · uncommon
- 추석에 달을 봐요 (I watch the moon on Chuseok) · rare
- 연등을 들어요 (I hold a lantern) · common
- 새해 복 많이 받으세요 (Happy New Year — formal) · legendary

### Nature & Animals (6)
- 호랑이가 산에 살아요 (Tiger lives in the mountain) · common
- 까치가 노래해요 (Magpie sings) · uncommon
- 꽃이 피어요 (Flowers bloom) · common
- 바다에 가요 (I go to the sea) · rare
- 비가 와요 (It's raining) · uncommon
- 무궁화가 피었어요 (The mugunghwa has bloomed) · legendary

### Play & Crafts (6)
- 윷놀이를 해요 (We play yutnori) · common
- 연을 날려요 (I fly a kite) · uncommon
- 종이학을 접어요 (I fold a paper crane) · rare
- 가야금을 켜요 (I play gayageum) · uncommon
- 춤을 춰요 (I dance) · common
- 우리 함께 놀아요 (Let's play together) · legendary

## 6. Ship-when triggers

Implement when **all** are true:
1. **Stage 3 sentence content authored** in `apps/mobile/src/content/stage3-sentences.ts`
2. **Stage 3 quests drafted** (the 5-step pattern that unlocks each card)
3. **Stage 2 beta complete** (real-user feedback on word-level cards before doubling complexity)

## 7. Dependencies

Upstream: F-CARD-001 (✅), F-CARD-002 (✅), Stage 3 content (BLOCKED).
Downstream: F-CARD-S4-001 onwards.
External: native-Korean editorial review for sentence selection.
