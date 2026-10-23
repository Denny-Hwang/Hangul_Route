# F-CARD-S4-001 — Stage 4 Card Illustrations

**Status**: `ready` — amended 2026-10-23 by F-CURR-002 row CM-23 part 2: one card per upper cell, shipped behind the `upperCards` switch (the note below). Was `draft`, waiting on the stage's dialogue content, which now exists (F-CURR-001 Stage 4 cells).

> **Amended 2026-10-23 by F-CURR-002 row CM-23 part 2 (section 7.2 and its decision record):** its row ships the cards behind the `upperCards` switch (built-in pct 0; the owner ramps it). The scope is now **one card per upper cell**, earned by finishing the cell's first volume, not the earlier plan of 30 cards for the stage: Read Along 이게 뭐예요? (card:mwoyeyo), Kitchen Talk 맛있어요 (card:masisseoyo), Park Conversations 비가 와요 (card:biga-wayo), Playdate Talk 같이 할까요? (card:gachi). Each card is a polite (haeyo) line its cell teaches. Greeting Dialogues keeps its shipped four cards exactly; its album card is its q1 card, card:insa, now drawn as a Stage 4 talk too. Each card's back-face fact cites a public institution from F-CURR-002 section 6.6 (`apps/mobile/src/content/upper-cell-card-sources.ts`), and the review is the multi-agent review recorded there, not an outside editorial review. The cards fill the five category albums of the Library. Sections 1 (the card count), 2, 3.1, 3.3, 3.4, 5, 6 and 7 below are superseded by F-CURR-002 section 7.2 and its decision record, and the audience is anyone learning Hangul (CLAUDE.md section 1). Of the visual contract in 3.2, these lines still hold: two figures facing each other, speech bubbles in the `HoyaBubble` language (cream fill, sky-blue border, never red), theme tint and theme tokens only. Its line raising the cap to 7 colours and its Stage 4 watermark line are superseded: the drawings keep the five-fill-colour cap of the earlier stages (besides the frame's theme tint), and the stage is named by the album and the card page, not by a glyph in the corner. The drawings are `UpperCellCardArt` (`HeritageCardArt/UpperCellArt.tsx`), loaded in the app's upper-cards chunk; built shots are in `design/screens/library-albums/`.

**Scope**: `packages/design-system/src/components/HeritageCardArt/` + `apps/mobile/src/content/` · amended (row CM-23 part 2): `packages/design-system/src/components/HeritageCardArt/UpperCellArt.tsx` and `upper-card-ids.ts` (`upperCellCardArtIds`), `apps/mobile/src/content/heritage-cards.ts` (`upperCellCards`), `content/upper-cell-cards.ts`, the Stage 4 cell files' `rewardCardIds`, the Library albums
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
- Max colors per card raised to 7 (vs Stage 3's 6, Stage 1-2's 5) — dialogue scenes need more variety *(superseded by the amendment above: the five-colour cap holds)*
- Theme tinting preserved
- **Stage 4 watermark**: `4` glyph in corner *(superseded by the amendment above: no watermark)*

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
