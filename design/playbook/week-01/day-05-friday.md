---
date: week-01 / Friday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/icons/core.v1/*.svg  (12 icons)
  - design/icons/spec.md
  - Week 01 retro filled in design/playbook/week-01/README.md
  - Open promotion PR to packages/design-system
depends_on:
  - design/tokens/colors.v1.md
  - design/tokens/spacing.v1.md (stroke weight tied to grid)
  - design/characters/hoya/spec.md (shared line/corner language)
unblocks:
  - first components (Button with icon, Nav bar)
  - Week 02 wireframes (icons appear in every screen)
---

# Day 05 — Friday · Icon Set v1 (+ Week retro)

## 오늘의 목표
**12개 코어 아이콘** SVG v1, 공통 스펙(stroke / corner / grid), 그리고 이번 주 회고 + 토큰 승격 PR 준비.

## 왜 오늘
- 네비게이션·Stage 1 UI 에 당장 필요. 아이콘 없이는 버튼 디자인도 못 시작.
- 주말 전에 **Week 01 산출물을 코드로 승격** 하는 PR 을 열어두면, 월요일에 merge 만 하면 Week 02 화면 작업 착수 가능.

## 12 아이콘 목록
1. home
2. card-collection (= 수집함)
3. star
4. sound-on
5. sound-off
6. mic
7. heart
8. check
9. x (close / incorrect)
10. arrow-back
11. arrow-next
12. settings

## 사전 준비 (1분)
- Day 01 팔레트, Day 03 spacing/radii 파일 열어두기.
- 금지: 한국 학습지 빨간 X / 빨간 동그라미 스타일.

## Claude Design 프롬프트 (복붙)

```prompt
Design an icon set v1 for Hangul Route — 12 core icons for navigation
and Stage 1 UI.

Audience: kids 5-11, English-speaking, learning Korean. Style reference:
Duolingo Kids, Khan Academy Kids. NOT Korean workbook icons.

Shared spec:
- 24×24 viewBox
- 2px stroke, rounded line caps and joins
- Consistent corner radius of 2px on rectangles (matches tokens.radii.sm)
- Two-tone option not needed — single-color line icons for v1
- Stroke uses neutral[700] from the attached palette; do not hardcode
- Works at 16×16 down to 48×48 without falling apart
- Shares visual language with Hoya (soft, rounded, friendly)

List (12 icons):
1. home
2. card-collection (imagine a stack of cards with a heart-ish spark)
3. star
4. sound-on (speaker with waves)
5. sound-off (speaker with small X — kid-friendly, not alarming)
6. mic (for pronunciation practice)
7. heart (favorite / lives)
8. check (correct)
9. x (close / incorrect — soft, not aggressive)
10. arrow-back
11. arrow-next
12. settings (gear — kept simple, 6 teeth max)

Deliverables:
- One sheet view showing all 12 at 24×24 in a 4×3 grid.
- Individual SVG source per icon.
- A spec.md with shared rules (grid, stroke, caps, joins, corner, color).

Attached palette: [paste colors.v1.md]
Attached spacing / radii: [paste spacing.v1.md]
```

## 작업 흐름 (9분)
1. 위 프롬프트로 세션 시작. 관련 토큰 2개 첨부.
2. 첫 시트 검토 — "x" 아이콘이 빨간 느낌이면 세션에 "keep as neutral stroke; color is applied by consumer at usage time".
3. 하나라도 모양이 애매한 것 (card-collection / settings 이 주의 필요) 은 한 번 재설계 요청.
4. 12개 SVG 확정.

## 결과 저장 (3분)
1. `design/icons/core.v1/<name>.svg` 12개 저장.
2. `design/icons/core.v1.png` — 12종 preview sheet.
3. `design/icons/spec.md` — shared rules.
4. `design/prompts.md` 로그.
5. 커밋: `design(icons): add 12 core icons v1`.

## Week 01 회고 + 승격 PR (2분)
1. `design/playbook/week-01/README.md` 의 "금요일 회고" 체크리스트 채움.
2. 승격 PR 열기:
   - 브랜치: `design/promote-w1-tokens`
   - 변경:
     - `packages/design-system/src/tokens.ts` 의 `colors` / `typography` / `spacing` / `radii` / `shadows` 실제 값으로 교체
     - `design/tokens/*.v1.md` 링크를 해당 export 상단 주석에 기재
   - PR 제목: `design: promote W1 tokens to design-system`
   - 라벨: `design`, `design-system`
   - CI: `design-token-sync.yml` 통과하는지 확인.

## Code 다음 단계 안내
- 월요일(Week 02) 월요일 작업은 이 PR merge 가 전제. merge 가 지연되면 Week 02 의 첫 1-2일은 wireframe (시각 토큰 무관) 부분만 진행.

## 막힐 때 대응
- 12개 일관성 깨짐 → 아이콘별로 돌리지 말고 "give me all 12 in one unified pass" 요청.
- SVG 를 얻지 못하고 PNG 만 받는 경우 → "export each as SVG source" 재요청. 안 되면 주말에 SVG 수기 변환 후 월요일 추가 커밋.
- 시간 초과 → Core 8개 먼저 (home / card-collection / check / x / arrow-back / arrow-next / settings / heart) 마감, 나머지 4개는 다음 주 월요일 첫 30분.

## 검토 체크리스트
- [ ] 12개 모두 24×24 viewBox, 2px stroke 통일
- [ ] "x" 가 아기에게 비난 느낌 주지 않는가 (부드러운 라운드)
- [ ] 썸네일 16×16 에서 모양 유지
- [ ] 색 하드코딩 없음 (consumer 가 색 주입)
- [ ] 호야와 시각 언어 공유 (둥근 stroke, 부드러운 코너)

## 다음 시안 연결 (Week 02 준비)
- 월요일(Week 02) 주제: 인트로 화면 wireframe. 오늘의 home · arrow-next 아이콘이 들어간다.
- 화요일: 홈(Route) 와이어프레임. card-collection · settings 사용.
- 토큰 승격 PR 이 merge 되면 금요일 컴포넌트 시안 작업부터 실제 토큰으로 디자인 가능.
