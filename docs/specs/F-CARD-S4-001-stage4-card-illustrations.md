# F-CARD-S4-001 — Stage 4 Card Illustrations (deferred)

**Status**: `draft` — implementation **blocked** on Stage 4 dialogue content being authored.
**Scope**: `packages/design-system/src/components/HeritageCardArt/` + `apps/mobile/src/content/`
**Owner**: solo dev
**Rollout**: Stage 4 unlock

---

## 1. Context

Stage 4 of the Heritage Journey is **Dialogue** — children move from sentences to short multi-turn exchanges:
- *"안녕!"* "Hi!"
- *"잘 지냈어?"* "How have you been?"
- *"응, 너는?"* "Yes, and you?"

Stage 4 cards visually represent **two-character exchanges** — a Hoya + friend, or two abstract figures with speech bubbles. The card is the *moment* of a conversation, frozen.

Card count target: 30 (6 per theme).

## 2. User story

> As **P5** (entering Stage 4 with 90 cards collected) earning a "Greetings" card, I want it to **show me a tiny dialogue** — two figures with little speech bubbles — so the card feels like a recorded conversation, not just an object.

## 3. Acceptance criteria (when implemented)

### 3.1 Card content

- `heritage-cards.ts` gains a Stage 4 section: 30 entries with `stage: 'stage4'`.
- Each card represents a **2-turn dialogue** at minimum. Sample titles:
  - "Greetings" (안녕! / 안녕!)
  - "How are you" (잘 지냈어? / 응, 너는?)
  - "Excuse me" (실례합니다 / 네, 말씀하세요)
  - "Where is the bathroom" (화장실이 어디예요? / 저쪽에 있어요)
  - "Goodbye" (안녕히 가세요 / 안녕히 계세요)

### 3.2 Visual contract (extends F-CARD-001 + F-CARD-S3-001)

- **Two figures minimum**, positioned facing each other or side-by-side
- **One or two speech bubbles** per card — using `HoyaBubble` token language (warm cream + sky-blue border, NOT red)
- Max colors per card raised to 7 (vs Stage 3's 6, Stage 1-2's 5) — dialogue scenes need more variety
- Theme tinting preserved
- **Stage 4 watermark**: `4` glyph in corner

### 3.3 Rarity distribution

Same density as previous stages. Legendary cards anchor cultural-pragmatic milestones (e.g., 존댓말 vs 반말 register switches — first formal-speech card is legendary).

### 3.4 HeritageCardArt extension

- 30 new switch cases bringing total to 120 supported cards (Stage 1-4)
- Per-card SVG includes 2 figure shapes + speech bubble glyphs

## 4. Out of scope

- **Animated dialogue playback** — F-MOTION-011 (Phase 2)
- **Multi-language dialogue UI** — Korean only
- **Honorific level toggle** (반말 vs 존댓말) — content layer handles via separate cards

## 5. Suggested 30-card seed (subject to native-Korean editorial review)

### Letters & Books (6)
- "안녕, 책 친구" (Hi, book friend) · common
- "이거 읽어 볼래?" (Want to read this?) · common
- "재밌었어!" (It was fun!) · uncommon
- "도서관에서 만나자" (Let's meet at the library) · rare
- "한글 배우러 가자" (Let's go learn Hangul) · uncommon
- "한글날 축하해!" (Happy Hangul Day!) · legendary

### Food & Daily Life (6)
- "맛있어요?" (Is it tasty?) · common
- "더 줄까?" (Want more?) · common
- "잘 먹겠습니다" (formal: thanks for the meal) · uncommon
- "한 그릇 더 주세요" (One more bowl, please) · rare
- "엄마, 김치 좋아요" (Mom, I like kimchi) · uncommon
- "가족이라 좋아요" (Glad to be family) · legendary

### Holidays & Traditions (6)
- "새해 복 많이 받으세요" (Happy New Year, formal) · uncommon
- "추석 잘 보내!" (Have a good Chuseok!) · common
- "할머니, 절 받으세요" (Grandmother, please receive my bow) · rare
- "송편 같이 만들어요" (Let's make songpyeon together) · uncommon
- "한복 이뻐!" (Hanbok is pretty!) · common
- "가족 모두 사랑해" (I love the whole family) · legendary

### Nature & Animals (6)
- "호랑이다!" (It's a tiger!) · common
- "까치야, 어디 가?" (Magpie, where are you going?) · uncommon
- "꽃이 너무 예뻐" (The flower is so pretty) · common
- "산 정상이 보여" (I can see the mountaintop) · rare
- "바다 색이 변해" (The sea's color changes) · uncommon
- "무궁화처럼 강해" (Strong as the mugunghwa) · legendary

### Play & Crafts (6)
- "같이 놀자!" (Let's play together!) · common
- "내가 이겼어!" (I won!) · common
- "연 잘 날린다" (You fly kites well) · uncommon
- "윷놀이 좋아해?" (Do you like yutnori?) · rare
- "팽이 돌릴 줄 알아?" (Can you spin a top?) · uncommon
- "함께라면 더 재밌어" (More fun together) · legendary

## 6. Ship-when triggers

Implement when **all** are true:
1. **Stage 4 dialogue content authored** with 2-turn exchanges
2. **Stage 4 quests drafted**
3. **Stage 3 beta complete**

## 7. Dependencies

Upstream: F-CARD-S3-001, F-CARD-002, F-CARD-001.
Downstream: F-CARD-S5-001 onwards.
External: native-Korean editorial review.
