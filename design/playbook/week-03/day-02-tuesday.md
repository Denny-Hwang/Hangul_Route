---
date: week-03 / Tuesday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/components/Card/spec.md
  - design/components/Card/v1.png
depends_on:
  - design/components/Button/spec.md (어제 산출물 — radius / shadow 룰 상속)
  - design/wireframes/journey/episode-select.md (Card 가 episode row)
  - design/wireframes/library/gallery.md (Card 가 grid cell)
  - design/wireframes/library/card-detail.md (Card 가 wrapper)
unblocks:
  - 목 Progress (Card 위에 progress bar 가 얹힘)
  - 금 promotion PR (Card → packages/design-system/src/components/Card/)
  - F-007 (Heritage Card detail, deferred) — Card 가 그 외피
---

# Day 02 — Tuesday · Card component v1

## 오늘의 목표
**Card v1** — 한 컴포넌트로 (a) episode row, (b) library grid cell, (c) card-detail wrapper 세 자리를 모두 채울 수 있는 유연한 컨테이너 시안 확정. 어제 Button 의 radius / shadow / spacing 룰을 상속해 시각 일관성 유지.

## 왜 오늘
- W2 와이어프레임 3 화면이 Card 를 가정한다 (episode-select / library/gallery / card-detail). 한 컴포넌트로 세 자리를 채우지 못하면 시각 분기가 늘어남.
- Card 는 "container with optional press" 라서 props 모양이 자칫 거대해지기 쉬움 (variant 4 + state 3 + composition slot 3 = …). 오늘 그 범위를 명시적으로 잘라낸다.
- F-007 Heritage Card detail (deferred) 가 이 Card 위에 얹힐 예정 — outer wrapper 의 padding / radius 가 그것을 가능케 해야.

## 사전 준비 (1분)
- 어제 `design/components/Button/spec.md` 에서 radius.md / shadow.sm 토큰값 확인.
- W2 의 3 화면 와이어프레임 (`episode-select`, `library/gallery`, `library/card-detail`) 의 Card 자리 박스 비례를 1 분 스캔.
- 금지 상기: 카드 거래·SNS 공유·친구 비교 anti-pattern (그대로 Card 시안에 반영되면 안 됨).

## Claude Design 프롬프트 (복붙)

```prompt
Design Card v1 for Hangul Route — a flexible container used for episode
rows, library/gallery grid cells, and library/card-detail wrappers.

Audience: English-speaking children 5–11.

Strict constraints (component-skill §3 & §4, CLAUDE.md §4):
- Token-only visual props (radius, shadow, spacing, color.surface,
  color.border).
- Inherit radius.md from Button v1 (yesterday's spec).
- Tappable variant ≥ 64 × 64 dp touch target (hit-slop comfortable).
- Loading / empty / error states required.
- WCAG AA for any text rendered inside.

Variants (3):
1. row       — full-width, fixed height ~88dp, leading slot + label
               column + trailing slot. Used in journey/episode-select.
2. cell      — square / near-square (1:1 or 4:5), used in library/gallery
               grid. Lock-icon slot when not earned, thumbnail slot when
               earned.
3. wrapper   — full-width / full-screen padding container with no press
               affordance. Used in library/card-detail.

Composition slots (3, optional per variant):
- leading (icon / thumbnail / hoya-mini)
- title + subtitle (text column, 2 lines max each)
- trailing (chevron / lock / badge / ProgressBar slot reserved for Thu)

States (3):
- default  — bg = colors.surface.elevated, shadow.sm
- pressed  — opacity.pressed, scale 0.99 (row & cell only; wrapper not
             tappable)
- disabled — opacity.disabled, hit-slop OFF (locked cell)

Empty state for cell: subtle dashed border in colors.border.muted, "lock"
slot only. Empty for row: lockable title placeholder.
Error state: shimmer placeholder (no animation if prefers-reduced-motion).

Output:
- design/components/Card/v1.png  (one row + one cell + one wrapper, side
  by side, default state)
- design/components/Card/spec.md with sections:
  1. Purpose (1 paragraph)
  2. Variants × slots × states matrix
  3. Props table (variant, leading, title, subtitle, trailing, onPress,
     disabled, loading, error)
  4. Accessibility (role per variant: row=button when onPress else
     listitem; cell=button if tappable; wrapper=region)
  5. Token usage table
  6. Anti-patterns (5 bullets, including: no trading / no SNS share /
     no comparison badge — explicit per CLAUDE.md §8)
  7. Open questions (≤ 3)

Compose vs prop note: prefer named slot props (leading / trailing) over
generic `children` to keep accessibility hints attachable.
```

## 작업 흐름 (10분)
1. 프롬프트 실행 → `v1.png` 의 3-variant 사이드바이사이드 확인.
2. **cell variant 가 너무 작아서 leading + title 이 다 안 들어가면** → "cell can omit title; rely on accessibilityLabel for screen reader".
3. **wrapper 가 padding 룰이 어색하면** → "match scroll-view content padding = spacing.lg".
4. Props 표에서 `children` 이 들어가 있으면 → "use named slots instead so we can attach accessibilityHint per slot".
5. Anti-patterns 에 카드 거래 / SNS 공유 / 친구 비교 명시 확인.

## 결과 저장 (3분)
1. 2 파일을 `design/components/Card/` 아래 저장.
2. `design/prompts.md` 로그.
3. 커밋: `design(component): add Card v1 spec`.

## Code 다음 단계 안내
- 금요일 promotion PR 에서 `packages/design-system/src/components/Card/` 5-파일 세트로 이동.
- 목요일 Progress 는 Card 의 trailing 슬롯에 들어갈 수 있도록 spec 의 슬롯 크기 호환.
- F-007 (Heritage Card detail, deferred) spec 작성 시 Card wrapper 변형 인용.

## 막힐 때 대응
- 3 variant 가 한 컴포넌트로 무리 → "row + cell only; wrapper becomes a Section component in W4". 우선 row + cell 확정.
- Slot 이 너무 많음 (≥ 5) → 가장 안 쓰는 슬롯 (leading or trailing) 을 빼고 v1 에서 단순화.
- 15 분 초과 → spec.md 의 §6 Anti-patterns / §7 Open questions 는 수요일 앞 3 분으로 분리.

## 검토 체크리스트
- [ ] 3-variant 시각이 일관된 radius (어제 Button 과 동일 radius.md)
- [ ] tappable variant 가 64dp 보장 (hit-slop 명시)
- [ ] empty / error 상태 시각 명시
- [ ] color-blind 안전 (lock / earned / shimmer 가 색 + 형상 둘 다)
- [ ] anti-pattern 5 개에 trading / SNS / comparison 포함
- [ ] `children` 대신 named slot

## 다음 시안 연결
- 수(Wed) HoyaBubble 은 Card 와 다른 모양 (bubble tail) 이지만 동일 shadow.sm 토큰 공유.
- 목(Thu) Progress 의 bar 변형은 Card row 의 trailing slot 안에 들어감.
- F-007 spec 작성 시 §8 dependencies 에 Card v1 명시.
