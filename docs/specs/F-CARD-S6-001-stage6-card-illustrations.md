# F-CARD-S6-001 — Stage 6 Card Illustrations (deferred)

**Status**: `draft` — implementation **blocked** on Stage 6 real-use content (menus, signs, calls) being authored.
**Scope**: `packages/design-system/src/components/HeritageCardArt/` + `apps/mobile/src/content/`
**Owner**: solo dev
**Rollout**: Stage 6 unlock

---

## 1. Context

Stage 6 of the Heritage Journey is **Real-use** — children take Korean out into the world. Reading actual menus, store signs, transit announcements, video-call conversations with grandparents. The vocabulary is grounded in concrete daily situations.

Stage 6 cards visually represent **real-world artifacts** — a photo-realistic-ish menu page, a transit sign, a phone screen showing a video call. Where Stage 5 cards were atmospheric story scenes, Stage 6 cards are **functional documents** with diegetic Korean.

Card count target: 30 (6 per theme).

## 2. User story

> As **P5** (12+, Stage 6 unlocked after 5 stages of vocabulary + sentences + stories) earning a "Read the Menu" card, I want it to **look like an actual menu** — Korean dishes listed, prices, photos hinted — so the card preserves the *act* of reading something real.

## 3. Acceptance criteria (when implemented)

### 3.1 Card content

- `heritage-cards.ts` gains a Stage 6 section: 30 entries with `stage: 'stage6'`.
- Each card represents **one real-world artifact**. Sample titles:
  - "Read the Korean Menu" — bibimbap, kimbap, naengmyeon listed in Hangul + romanization
  - "Subway Sign" — line color + station name in 한글
  - "Phone Call with Grandma" — phone screen with Korean caller display
  - "Mailbox with Korean Address" — postcode + 우편번호 visible
  - "Store Sign 김밥천국" — recognizable Korean franchise sign

### 3.2 Visual contract (extends previous stages)

- **Diegetic typography** — actual Korean characters embedded as the artifact's *content*, not just the card title
- Max colors per card raised to **8** (same as Stage 5)
- **Documentary feel** — more rectilinear, less storybook-atmospheric
- Theme tinting LOW (4% — lets the artifact's own colors lead)
- **Stage 6 watermark**: `6` glyph + a tiny "world" / globe icon

### 3.3 Rarity distribution

Same density. Legendary cards represent the most empowering real-world moments — e.g., "First call to grandma" or "First menu order without help".

### 3.4 HeritageCardArt extension

- 30 new switch cases bringing total to 180 supported cards (Stages 1-6)
- Per-card SVG uses heavy Korean typography rendering — embed `<text>` elements with actual Hangul characters

## 4. Out of scope

- **Interactive menus** (tap to hear pronunciation) — F-MOTION-014 (Phase 2)
- **Real-world photography** — illustrations only; photos require licensing
- **Brand logos** (KakaoTalk, Samsung, etc.) — generic representations only

## 5. Suggested 30-card seed (subject to native-Korean editorial review)

### Letters & Books (6) — documents
- "Library card" 도서관 카드 · common
- "School schedule" 시간표 · common
- "Korean newspaper page" 신문 한 면 · uncommon
- "Letter from a friend" 친구 편지 · rare
- "Bookstore receipt" 서점 영수증 · uncommon
- "Library application form" 도서관 신청서 · legendary

### Food & Daily Life (6) — menus + receipts
- "Korean BBQ menu" 고깃집 메뉴 · uncommon
- "Convenience store snack" 편의점 간식 · common
- "Restaurant receipt" 식당 영수증 · common
- "Lunchbox label" 도시락 포장지 · uncommon
- "Recipe card" 레시피 카드 · rare
- "Order at the food truck" 푸드트럭 주문 · legendary

### Holidays & Traditions (6) — festival flyers
- "Seollal greeting card" 설날 카드 · uncommon
- "Chuseok poster" 추석 포스터 · common
- "Lantern festival ticket" 연등회 티켓 · rare
- "Lunar calendar page" 음력 달력 한 면 · common
- "Tea ceremony invitation" 다도 초대장 · uncommon
- "Family gathering invitation" 가족 모임 초대 · legendary

### Nature & Animals (6) — signs + warnings
- "Park sign 공원" · common
- "Mountain trail marker" 산악 표지판 · uncommon
- "Beach safety sign" 바다 안전 표시 · common
- "National park map" 국립공원 지도 · rare
- "Animal exhibit label" 동물원 안내판 · uncommon
- "Weather forecast" 일기 예보 · legendary

### Play & Crafts (6) — store signs
- "Toy store window" 장난감 가게 · common
- "Stationery shop" 문구점 · uncommon
- "Craft supplies receipt" 공예 재료 영수증 · common
- "Karaoke price list" 노래방 가격표 · rare
- "Playground sign" 놀이터 표지 · uncommon
- "Hangul-themed gift shop" 한글 선물 가게 · legendary

## 6. Ship-when triggers

Implement when **all** are true:
1. **Stage 6 real-use content authored** — menus, signs, document samples
2. **Stage 6 quests drafted** — read-then-act pattern
3. **Stage 5 beta complete**

## 7. Dependencies

Upstream: F-CARD-S5-001, F-CARD-002, F-CARD-001.
Downstream: F-CARD-S7-001.
External: native-Korean editorial review; brand-safety review for any depicted store/franchise.
