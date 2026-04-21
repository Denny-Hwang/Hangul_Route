---
date: week-01 / Wednesday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/tokens/spacing.v1.md  (spacing + radii + shadows)
depends_on:
  - design/tokens/colors.v1.md
  - design/tokens/typography.v1.md (line-height paired with spacing)
unblocks:
  - packages/design-system/src/tokens.ts (spacing/radii/shadows exports)
  - design-token-sync.yml first green run
  - layout of every future component
---

# Day 03 — Wednesday · Spacing Tokens (+ Radii, Shadows)

## 오늘의 목표
4pt 기반 간격 스케일 v1, 코너 반경 4단계, 그림자(elevation) 3단계. **터치 영역 최소 64dp** 정책을 숫자로 박아둔다.

## 왜 오늘
- 간격·반경·그림자가 없으면 화면 레이아웃 시작을 못한다.
- 한 번 확정되면 그 후 모든 컴포넌트가 따른다. 조기에 깊이 생각할 가치 있음.
- 5–11세 손가락 크기 기준으로 터치 타겟이 64dp 이상이어야 오터치 줄어든다.

## 사전 준비 (1분)
- Day 01 / Day 02 마크다운 두 개 열어두기.
- 아동 손가락 기준 확인 — iOS HIG 44pt / Android Material 48dp 는 **성인** 기준. 아동은 여유 더 필요.

## Claude Design 프롬프트 (복붙)

```prompt
Design a spacing + radii + shadows token set v1 for Hangul Route.

Audience: kids ages 5-11. Touch targets must be at least 64dp.

Attached:
- colors v1 (design/tokens/colors.v1.md)
- typography v1 (design/tokens/typography.v1.md)

Produce:
1. Spacing scale on a 4pt base. Name tokens by *index*
   (spacing[0], spacing[1], ...) and provide the raw value too.
   Propose: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Explain which index
   to use where (gap inside buttons, gap between cards, screen padding, ...).
2. Radii scale: sm / md / lg / full. Give hex-like values (e.g., 4 / 8 / 16 /
   9999) and example uses (buttons = md, cards = lg, avatar = full).
3. Shadows: elev-1 / elev-2 / elev-3. For each: y-offset, blur, spread,
   opacity, color reference (use neutral from palette, not hardcoded).
4. Touch-target policy statement — minimum 64dp, how padding contributes.
5. One layout sample: a card with title, body, and CTA button, showing
   which tokens are used for padding / gap / corner / shadow.

No colors hardcoded — shadows reference neutral scale.
No typography — but line-height from yesterday should visually fit.
```

## 작업 흐름 (10분)
1. 위 프롬프트로 세션 시작. 이전 두 토큰 파일 첨부.
2. 스케일 제안 받기. 11단계가 많으면 줄이기.
3. 레이아웃 샘플 시각화 받고 "if the button is 64dp tall, does padding match?" 자가 검증.
4. Radii / Shadow 는 과하지 않게 (부드러운 elevation 1-2 정도로).

## 결과 저장 (3분)
1. `design/tokens/spacing.v1.md` 한 파일에 spacing + radii + shadows 묶기 (분리 안 함 — 같이 쓰이기 때문).
2. 레이아웃 샘플 이미지 → `design/tokens/spacing.v1.png`.
3. `design/prompts.md` 로그.
4. 커밋: `design(tokens): add spacing / radii / shadows v1`.

## Code 다음 단계 안내
- 이 커밋 이후 `design-token-sync.yml` 을 처음으로 **실제 비교 대상**이 생긴 상태로 돌려볼 수 있다.
- 금요일 승격 PR 에서 `packages/design-system/src/tokens.ts` 의 `spacing`, `radii`, `shadows` 세 export 를 동시에 채운다.

## 막힐 때 대응
- 스케일이 너무 많음 → "reduce to 8 steps and map by semantic use".
- 그림자가 너무 강함 → "think subtle — elev-1 for cards, elev-2 for overlays only".
- 64dp 보장이 애매 → 세션에 "show me a button at 64dp with spacing[3] padding: does the label still fit at body size 18px?" 물어본다.

## 검토 체크리스트
- [ ] 모든 interactive target ≥ 64dp 달성 가능한가 (스페이싱 인덱스 3-5 조합으로)
- [ ] Radii 4단계가 과하지 않은가 (sm / md / lg / full 이면 충분)
- [ ] Shadow 색이 하드코딩 대신 neutral 참조하는가
- [ ] 하나의 샘플 카드에 쓰인 토큰 이름이 semantic 한가

## 다음 시안 연결
- 내일(Thu) 호야 포즈 프레임 크기가 오늘 spacing 스케일의 배수로 떨어지면 이상적 (예: 128dp = spacing[11]*2).
- Fri 아이콘 viewBox 는 24 또는 32 에서 고르고 이는 radii / stroke 와 조화.
- Week 02 화면 와이어프레임의 grid 간격 = 오늘 스페이싱.
