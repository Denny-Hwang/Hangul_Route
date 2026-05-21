# F-CARD-S5-001 — Stage 5 Card Illustrations (deferred)

**Status**: `draft` — implementation **blocked** on Stage 5 story content (folk tales + short narratives) being authored.
**Scope**: `packages/design-system/src/components/HeritageCardArt/` + `apps/mobile/src/content/`
**Owner**: solo dev
**Rollout**: Stage 5 unlock

---

## 1. Context

Stage 5 of the Heritage Journey is **Stories** — children move from dialogue to **multi-sentence narratives**: Korean folk tales (호랑이와 곶감 / 흥부와 놀부), short modern children's stories, and personal mini-stories.

Stage 5 cards visually represent **story moments** — a single illustrated scene from a tale, complete with character, setting, and a hint of action. Where Stage 4 cards were dialogue exchanges, Stage 5 cards are **storybook pages** condensed to one frame.

Card count target: 30 (6 per theme).

## 2. User story

> As **P5** (entering Stage 5 with 120 cards collected) earning a "Tiger and Persimmon" card, I want it to **look like a page from a storybook** — moody scene, atmospheric — so the card carries the *feeling* of the story, not just its title.

## 3. Acceptance criteria (when implemented)

### 3.1 Card content

- `heritage-cards.ts` gains a Stage 5 section: 30 entries with `stage: 'stage5'`.
- Each card represents one **scene moment** from a story. Sample titles:
  - "Tiger and Persimmon" (호랑이와 곶감) — the moment the tiger flees thinking 곶감 is a monster
  - "Heungbu's Gourd" (흥부의 박) — the moment treasures pour out
  - "Tortoise's Letter" (토끼의 간) — the rabbit tricks the dragon king

### 3.2 Visual contract (extends previous stages)

- **Atmospheric backgrounds** — gradient hints, time of day, weather suggested
- Max colors per card raised to **8** (vs Stage 4's 7) — story scenes need more atmosphere
- **Single character + setting** composition — no dialogue bubbles (those are Stage 4)
- Theme tinting may be **less prominent** (8% → 4%) to let the scene's own colors lead
- **Stage 5 watermark**: `5` glyph + a tiny "story" book icon

### 3.3 Rarity distribution

Same density. Legendary cards anchor the most culturally iconic folk tales (호랑이와 곶감, 흥부와 놀부, 단군신화 if appropriate for the age).

### 3.4 HeritageCardArt extension

- 30 new switch cases bringing total to 150 supported cards (Stages 1-5)
- Per-card SVG includes atmospheric background gradient + single-scene composition

## 4. Out of scope

- **Animated story playback** — F-MOTION-012 (Phase 2)
- **Audio narration of the full story** — F-MOTION-013 (paired with F-CARD-S5-AUDIO)
- **Branching story choices** — Stage 5 is read-only narrative

## 5. Suggested 30-card seed (subject to native-Korean editorial review)

### Letters & Books (6) — myths and origins
- 한글 창제 (Creation of Hangul) · uncommon
- 세종대왕 (King Sejong) · rare
- 글자 짓는 학자들 (Scholars writing letters) · common
- 책방의 아이 (Child in the bookshop) · common
- 한지 만드는 사람 (Hanji maker) · uncommon
- 한글 가족 모두 함께 (Hangul family altogether) · legendary

### Food & Daily Life (6) — table tales
- 김치 담그는 날 (Kimchi-making day) · uncommon
- 가족 식사 (Family dinner scene) · common
- 시장 가는 길 (Going to the market) · common
- 할머니의 떡 (Grandmother's tteok) · rare
- 식탁 위의 한 그릇 (One bowl on the table) · uncommon
- 우리집 부엌 이야기 (Our home kitchen story) · legendary

### Holidays & Traditions (6) — festival moments
- 설날 아침 (Seollal morning) · uncommon
- 추석 보름달 (Chuseok harvest moon) · rare
- 단오의 그네 (Dano swing) · uncommon
- 단군신화 (Tan-gun foundation myth — age-appropriate version) · legendary
- 한가위 한낮 (Chuseok afternoon) · common
- 연등의 밤 (Night of lanterns) · common

### Nature & Animals (6) — folk tales
- 호랑이와 곶감 (Tiger and Persimmon) · legendary
- 흥부와 박 (Heungbu's gourd) · rare
- 까치의 보은 (Magpie's gratitude) · uncommon
- 토끼와 거북이 (Rabbit and Turtle) · common
- 까치집 (Magpie's nest) · common
- 산속의 호랑이 가족 (Tiger family in the mountains) · uncommon

### Play & Crafts (6) — craft scenes
- 연 만드는 아이 (Child making a kite) · common
- 가야금 켜는 할머니 (Grandmother playing gayageum) · uncommon
- 도자기 굽는 사람 (Pottery firing) · rare
- 윷판 위의 가족 (Family at the yut board) · common
- 종이학 1000마리 (1000 paper cranes) · uncommon
- 우리 동네 축제 (Our neighborhood festival) · legendary

## 6. Ship-when triggers

Implement when **all** are true:
1. **Stage 5 story content authored** — at least 30 short tales (5–10 sentences each)
2. **Stage 5 quests drafted** — reading + comprehension pattern
3. **Stage 4 beta complete**

## 7. Dependencies

Upstream: F-CARD-S4-001, F-CARD-002, F-CARD-001.
Downstream: F-CARD-S6-001 onwards.
External: native-Korean editorial review; possible folk-tale licensing review.
