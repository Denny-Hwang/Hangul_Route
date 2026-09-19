# App Store 메타데이터 — v1.0.0 (붙여넣기용)

> 글자 수 제한을 이미 맞췄다. 바꾸면 다시 세어야 한다.
> 카피 규칙: `docs/launch/product-review-2026-06-09.md` §"카피 수치 정합성" — **8 mini-games (active)**, **30 Stage 1 cards** (+ 12 taste cards 는 언급 안 함), "streak" 표현은 스토어 카피에서 제외.

## 1. 이름 · 부제 (각 ≤ 30자)

| 필드 | 값 | 글자 |
|---|---|---|
| Name | `Hangul Route` | 12 |
| Subtitle | `Korean for kids, with Hoya` | 26 |

대안 부제 (tagline-decision.md): `Korean for kids who don't speak it — yet.` 는 41자로 초과 → 프로모션 텍스트로 이동.

## 2. 프로모션 텍스트 (≤ 170자, 심사 없이 수정 가능)

```
Korean for kids who don't speak it — yet. Learn the Korean alphabet with Hoya the tiger, one heritage card at a time. No ads. No red X. Plays offline.
```

## 3. 설명 (≤ 4000자)

```
Hangul Route is a Korean learning app for English-speaking children ages 5–11 — made first for heritage families, where the parents speak Korean and the child does not yet.

MEET HOYA
Hoya is a young tiger who guides every quest. Hoya never frowns and never says "wrong." When a child slips, Hoya thinks it over with them and tries again. There are no red marks anywhere in the app.

LEARN THE LETTERS
Stage 1 teaches the Korean alphabet (Hangul) through short quests — about five minutes each:
• Match the sound to the letter
• Build a syllable from its parts
• Trace each stroke with your finger, in order
• Spot the odd one out
• Match Korean words to pictures
• Put a story in order
• Answer a friendly quiz about Korean culture
• Tap to respond in a tiny dialogue

Every Korean word is shown with romanization and an English meaning, so a child (and a parent) always knows what they are saying.

COLLECT KOREA
Finishing quests earns heritage cards — kimchi, hanbok, the moon, the gayageum, Chuseok and more. Thirty Stage 1 cards to collect, each with a short story a seven-year-old can follow. Flip a card, and tap to hear its Korean name.

FOR GROWN-UPS
• Several learner profiles on one device — siblings keep their own journeys
• A PIN-protected grown-up zone with each child's quests, cards and minutes — framed as growth, never as comparison
• A daily three-card mission so a child always knows what to do next
• No account needed. No ads. No data sold. Everything stays on the device.
• Works offline — on the plane, at grandma's house, anywhere

WHAT'S COMING
Stages 2–7 take the journey from words to sentences, stories and real conversation, each tied to a Korean culture theme. Stage 1 is free.

Hangul Route is built by a solo developer and a small circle of heritage parents. If your grandparents and your child don't share a language yet, this is where they start.
```

## 4. 키워드 (≤ 100자, 쉼표 구분, 이름·부제 단어 중복 금지)

```
hangul,korean alphabet,learn korean,kids,children,heritage,language,letters,reading,tiger,culture
```
(글자 수: 98)

## 5. 스크린샷 구성 (5장 × 3 세트)

프레임 프롬프트: `design/brief/launch-assets.md` §4. 캡션은 프레임 상단, ≤ 6 단어.

| # | 화면 | 캡션 | 캡처 조건 |
|---|---|---|---|
| 1 | Home — Today with Hoya (3 카드) | `Five minutes a day with Hoya` | 프로필 "Suni", 카드 2장 획득 상태 |
| 2 | Minigame — Trace Stroke (ㅁ) | `Trace every letter, stroke by stroke` | 2획 완료, 힌트 표시 |
| 3 | Results — 3 stars + card banner | `Earn a heritage card` | 3별, 배너 드롭인 후 |
| 4 | Library — 카드 그리드 | `Collect thirty pieces of Korea` | 12장 획득, 나머지 잠김 |
| 5 | Family Dashboard (grown-up zone) | `Grown-ups see growth, never grades` | 학습자 1명, Quests/Cards/Minutes 합계 + Recent 3건 |

iPad 세트는 같은 5장을 iPad 에서 다시 캡처 (세로).

## 6. App Review Notes (붙여넣기)

```
Hangul Route is a Kids Category app (ages 6–8 band; content suits 5–11). No account or sign-in exists.

How to test:
1. On first launch, create a learner profile (any name, any age band, tick the parent consent box). The parent email field is optional and is stored on the device only.
2. Tap "Start my journey" to enter the first quest. Mini-games record correct/incorrect rounds; the results screen awards stars and, from 2 stars, a heritage card.
3. Grown-up zone (Profiles & settings → "Grown-up zone") is protected by a 4-digit PIN. There is NO preset PIN: the first entry asks you to create one, the next entries verify it. Five wrong entries start a 30-second cooldown.
4. The app has no in-app purchases, no ads, no external links, and no third-party analytics. Anonymous product-interaction events are sent to our own server only when an API base URL is configured in the build; this build sends none.

Voice practice is disabled by feature flag and the microphone permission is not requested.
```

## 7. What's New (1.0.0)

```
Hoya's first adventure: learn the Korean alphabet through eight mini-games and collect thirty heritage cards. Several learners per device, a PIN-protected grown-up zone, and everything works offline.
```

## 8. 저작권 · 연령

- Copyright: `© 2026 Hangul Route`
- Age rating: 4+ (설문 전부 None)
- Kids band: Ages 6–8
