---
date: week-03 / Thursday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/components/Progress/spec.md
  - design/components/Progress/v1.png
  - design/components/Progress/variants.png
depends_on:
  - design/components/Card/spec.md (Progress 가 Card trailing 슬롯에 들어감)
  - design/components/HoyaBubble/spec.md (동시 등장 시 시각 우선순위 룰)
  - design/wireframes/journey/home.md (Stage progress bar)
  - design/wireframes/quest/player.md (5-round dots)
unblocks:
  - 금 promotion PR (Progress → packages/design-system/src/components/Progress/)
  - F-001 §3.1 의 round counter 자리
  - journey/home Stage bar 자리
---

# Day 04 — Thursday · Progress component v1

## 오늘의 목표
**Progress v1** — 두 변형 (`bar` Stage 진도 / `dots` 5-round 진도) 을 한 컴포넌트로 다루는 시안 확정. 어제 HoyaBubble 과 동시 화면에 나올 때 시각 충돌이 없도록 weight 룰을 정한다.

## 왜 오늘
- W2 와이어프레임의 journey/home 과 quest/player 두 자리가 이 컴포넌트를 기다림.
- F-001 의 §3.1 acceptance criteria 의 "5 rounds 진행 표시" 가 dots 변형 — 이게 정해지지 않으면 F-001 구현 시작 불가.
- 컴포넌트 4종 중 마지막 — 금요일 promotion PR 의 마지막 퍼즐.

## 사전 준비 (1분)
- 어제 HoyaBubble spec 의 shadow.sm 값 확인 (Progress 는 shadow.none — bar 자체에 그림자 없음).
- W1 의 colors.brand.primary 와 colors.surface.muted 비례 확인 (filled vs empty 의 대비).
- W2 의 journey/home Box diagram 에서 progress bar 의 가로 비례 (≈ 80% width) 확인.

## Claude Design 프롬프트 (복붙)

```prompt
Design Progress v1 for Hangul Route — two variants of progress indicator
used across journey/home (Stage bar) and quest/player (5-round dots).

Audience: English-speaking children 5–11.

Strict constraints:
- component-skill §3 & §4: function + hooks, named export, token-only.
- WCAG: progress not communicated by color alone — include text label
  ("4 of 15") next to the bar variant, and pre/post round indicators
  in the dots variant.
- prefers-reduced-motion: progress fill transitions become instant (no
  120ms ease).
- No shadows (visual weight stays light next to HoyaBubble).
- Touch: Progress is NOT tappable in v1 (out of scope: tap to jump).

Variants (2):
1. bar  — horizontal track, fill from leading. Height ~10dp. Used in
          journey/home "Stage 1: Hangul — 4 of 15".
   - track bg: colors.surface.muted
   - filled: colors.brand.primary (with subtle 1dp inset highlight)
   - rounded ends: radius.full

2. dots — sequence of N round dots (N = 3–7 in v1, typically 5).
   - past-correct dot:    colors.brand.primary, filled
   - past-incorrect dot:  colors.feedback.nudge, outlined ring
                          (color + shape distinct, color-blind safe)
   - past-skipped dot:    colors.surface.muted, filled, no border
   - current dot:         colors.surface.muted with 2dp ring of
                          colors.brand.primary, slight scale 1.0→1.1
                          pulse (1s loop) — pulse skipped under
                          prefers-reduced-motion
   - future dot:          colors.surface.muted, filled, no border

States (per variant):
- default  — described above
- loading  — bar: shimmer along the track (skipped under
             prefers-reduced-motion → static muted). dots: all dots
             muted + a single current dot.
- error    — bar: track shows last-known fill + tiny "stale"
             accessibility hint. dots: same as loading.

Composition:
- bar always pairs with a sibling text label "<n> of <total>" (passed
  as `label` prop, not embedded inside the bar).
- dots: optional caption "Round <n> of <total>" for screen readers
  (visually hidden by default).

Output:
- design/components/Progress/v1.png  (bar at 4/15 + dots at 5 rounds
  with 2 correct, 1 incorrect, current at index 3, 2 future)
- design/components/Progress/variants.png  (2 variants × 3 states grid)
- design/components/Progress/spec.md with:
  1. Purpose
  2. Variants × states matrix
  3. Props table (variant, value, total, label, rounds[], error)
  4. Accessibility: role="progressbar" for bar (aria-valuenow,
     aria-valuemin, aria-valuemax); role="list" of "listitem" for dots
     with state announced per dot.
  5. Token usage table
  6. Anti-patterns (5 bullets, including: no color-only state, no
     percentage that ever shows > 100, no animation under reduced-motion,
     no shadows, no tappable jump-to-round in v1)
  7. Open questions (≤ 3)
```

## 작업 흐름 (10분)
1. 프롬프트 실행 → variants.png 6-cell (2 variants × 3 states) 확인.
2. **dot 의 past-incorrect 가 색 + 형상 둘 다 다른지 확인** (외곽 ring 으로 형상 차이). 색만 다르면 거부.
3. **current dot 의 pulse 가 prefers-reduced-motion 에서 정적으로 떨어지는지** spec.md 에 명시.
4. bar 의 percentage label 이 컴포넌트 내부에 있으면 → "label is a sibling prop, not inside the bar; rendering is the consumer's choice".
5. dots variant 의 accessibility 가 role=list 인지 확인 (progressbar 가 아니라 list — round status 가 더 풍부).

## 결과 저장 (3분)
1. 3 파일을 `design/components/Progress/` 아래 저장.
2. `design/prompts.md` 로그.
3. 커밋: `design(component): add Progress v1 spec`.

## Code 다음 단계 안내
- 금요일 promotion PR 에 Progress 5-파일 세트가 포함.
- F-001 의 §3.1 5-round 진행 표시 자리에 `<Progress variant="dots" total={5} rounds={…} />` 가 들어감.
- journey/home Stage bar 는 `<Progress variant="bar" value={4} total={15} label="Stage 1: Hangul — 4 of 15" />`.

## 막힐 때 대응
- past-incorrect 가 빨강만 다르고 형상 동일 → "ring vs filled — make it geometrically distinct".
- bar 의 fill 애니메이션이 너무 빠름/느림 → "240ms ease-out is fine; reduced-motion = instant".
- 15 분 초과 → variants.png 의 error 상태는 금요일 promotion PR 안에서 작성.

## 검토 체크리스트
- [ ] 2 variant × 3 state 가 시각·spec.md 모두 명시
- [ ] color-blind 안전 (ring vs fill 형상 차이)
- [ ] prefers-reduced-motion 명시적 fallback
- [ ] bar 가 사이드 라벨을 prop 으로 받음 (내부 임베드 X)
- [ ] role=progressbar (bar) / role=list (dots) 구분
- [ ] anti-pattern 에 "no tappable jump-to-round in v1" 포함 (W4 의 fast-forward 유혹 차단)

## 다음 시안 연결
- 금(Fri) promotion PR 에 4 컴포넌트 모두 안착.
- F-001 §3.1 의 5-round 진행 표시가 이 컴포넌트로 충족.
- journey/home Stage bar 가 이 컴포넌트의 bar 변형으로 충족.
