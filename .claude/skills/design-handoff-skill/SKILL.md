---
name: design-handoff-skill
description: 디자인 시안을 코드(토큰·컴포넌트·아이콘)로 승격할 때 자동 적용.
  design/ → packages/design-system / apps 의 .tsx 이행. 값 변경 없는 1:1 이전.
---

# Design Handoff Skill

`design/` 의 확정 시안 (tokens·components·characters·icons·screens) 을
`packages/design-system` 또는 `apps/` 의 코드로 승격하는 절차.
**값 변경 없이 1:1 이전** 이 원칙. 차이는 `design-token-sync.yml` 이 차단.

근거: `docs/blueprints/02-core-feature-spec.md`, `docs/workflows/design-to-code.md`.

---

## 1. Trigger

자동 트리거 조건:

- 경로 쌍 변화: `design/tokens/**` 과 `packages/design-system/src/tokens/**` 중 한쪽만 변경
- 경로 쌍 변화: `design/components/<Name>/spec.md` ↔ `packages/design-system/src/components/<Name>/`
- 경로 쌍 변화: `design/icons/*.svg` ↔ `packages/design-system/src/icons/`
- 경로 쌍 변화: `design/characters/hoya/**` ↔ `packages/design-system/src/characters/Hoya/`
- 경로 쌍 변화: `design/screens/<flow>/<screen>/` ↔ `apps/mobile/src/screens/` 또는 `apps/web/`
- 사용자 요청 키워드: "시안 승격", "코드로 올려", "handoff", "design-to-code"

동반 Skills:
- 선행: `frontend-design-skill` (시안 확정)
- 병행: `design-system-skill` (토큰 승격 절차 consume)
- 병행: `component-skill` (컴포넌트 구현 시)
- 병행: `test-skill` (승격 후 테스트 동반)

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `design/<...>/v<n>/spec.md` 가 "확정" 상태 (draft 아님)
- [ ] 시안의 모든 색·간격·타이포가 기존 토큰에 매칭되거나 신규 토큰 승격 대기 중
- [ ] `design/wireframes/` 의 대응 와이어프레임 링크 존재
- [ ] `docs/specs/F-XXX-*.md` 가 `status: ready`
- [ ] 시안 스크린샷이 PR 본문에 첨부될 수 있는 해상도 (2× 이상)

누락 시:

> "design/screens/quest-play/match-sound/v3 의 spec.md 가 draft 상태라
> 승격 금지. 먼저 frontend-design-skill 로 시안을 확정해 주세요."

---

## 3. Standard Procedure

### 3.1 승격 대상 자산별 경로 매핑

| design (원본) | packages/apps (승격) |
|---|---|
| `design/tokens/<cat>.v<n>.md` | `packages/design-system/src/tokens/<cat>.ts` |
| `design/icons/<name>.svg` | `packages/design-system/src/icons/<IconName>.tsx` (generated) |
| `design/characters/hoya/v<n>/` | `packages/design-system/src/characters/Hoya/` |
| `design/components/<Name>/v<n>/` | `packages/design-system/src/components/<Name>/` |
| `design/screens/<flow>/<screen>/v<n>/` | `apps/mobile/src/screens/<Screen>/` 또는 `apps/web/src/app/<route>/` |

### 3.2 승격 순서 (아래로 갈수록 상위 의존)

```
tokens → icons → characters → components (design-system) → screens (apps)
```

한 PR 에 한 레이어만 승격 권장. 여러 레이어가 변경되면 레이어 단위로 커밋 분리.

### 3.3 절차 — tokens

1. `design/tokens/<cat>.v<n>.md` 에서 값·rationale 읽기
2. `packages/design-system/src/tokens/<cat>.ts` 에 **값 그대로** 반영
3. `design-system-skill` §3.3 절차로 검증 (contrast·generator·사용처)
4. `design-token-sync.yml` dry-run 통과
5. 커밋: `design-system: promote <cat> tokens v<n>`

### 3.4 절차 — components (design-system)

1. `design/components/<Name>/v<n>/spec.md` 의 props·states·motion 확인
2. `component-skill` §3.1 폴더 구조로 파일 생성
3. `test-skill` §3.1 TDD — 레드 → 그린 → 리팩터
4. 스타일은 **토큰만** 사용 (신규 값이 필요하면 tokens 승격 별도 PR 선행)
5. Storybook 스토리 (variant·state) 추가
6. 시안 vs 구현 **시각 비교** 스크린샷 PR 본문 첨부
7. `design/components/<Name>/IMPLEMENTED.md` 추가 (구현 경로·PR 링크·이슈)
8. 커밋 시퀀스:
   ```
   test(design-system): add failing spec for <Component>
   feat(design-system): implement <Component> from design/<...>/v<n>
   design(handoff): mark <Component> v<n> as implemented
   ```

### 3.5 절차 — screens (apps)

1. `design/screens/<flow>/<screen>/v<n>/spec.md` 확인
2. 필요한 design-system 컴포넌트·토큰이 모두 존재하는지 검증
3. 누락 있으면: **design-handoff 중단**, 먼저 design-system 쪽 승격
4. `apps/<app>/src/screens/<Screen>/` 구현 (component-skill 준수)
5. 화면 단위 e2e 시나리오 1개 추가 (test-skill)
6. 스크린 시안 vs 실제 렌더 스크린샷 비교 첨부

### 3.6 시각 비교 방법

- 시안 PNG 과 구현 스크린샷을 같은 viewport 로 생성
- 차이 나는 부분에 박스 표시·주석 달기
- 1px 단위 수치 차이는 허용, 색·레이아웃·애니메이션은 일치 필수
- 비교 결과를 PR 본문 "Visual diff" 섹션에 포함

### 3.7 시안에 없는 상태가 발견될 때 (예: loading)

- 구현 전에 frontend-design-skill 로 되돌아가서 시안 보강
- 이 Skill 에서 상태를 **임의 추가 금지**

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ 값 그대로 1:1 이전 (리팩터링은 별도 커밋)
- ✅ 토큰 없으면 토큰 승격 **먼저**, 그 후 사용
- ✅ 시안 vs 구현 시각 비교 첨부 (PR 본문)
- ✅ `IMPLEMENTED.md` 로 승격 상태 기록
- ✅ 레이어별 (tokens / icons / components / screens) 커밋 분리
- ✅ 시안에 없는 상태·동작은 frontend-design-skill 로 백트래킹

### ❌ 하지 말아야 하는 것

- ❌ 시안 추출 색·간격 하드코딩 (반드시 토큰 승격 후 사용)
- ❌ 픽셀 magic number (`marginTop: 14`) — spacing token
- ❌ 시안에 없는 state·애니메이션·인터랙션 임의 추가
- ❌ 여러 레이어 (tokens + components + screens) 를 한 커밋에 섞음
- ❌ `design/<...>/IMPLEMENTED.md` 누락한 승격
- ❌ `--force` / `--no-verify` 로 CI 우회

### 코드 예시

```tsx
// ✅ 좋은 예 — spec.md 의 값이 모두 토큰으로 매핑됨
// design/components/ProgressBar/v2/spec.md:
//   background: tokens.color.surface.muted
//   fill: tokens.color.brand.primary
//   height: tokens.spacing.md
//   radius: tokens.radius.pill

import { View } from 'react-native';
import { tokens } from '../../tokens';
import type { ProgressBarProps } from './types';

export const ProgressBar = ({ value, max, accessibilityLabel }: ProgressBarProps) => {
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: value, min: 0, max }}
      style={{
        height: tokens.spacing.md,
        backgroundColor: tokens.color.surface.muted,
        borderRadius: tokens.radius.pill,
      }}
    >
      <View
        style={{
          width: `${ratio * 100}%`,
          height: '100%',
          backgroundColor: tokens.color.brand.primary,
          borderRadius: tokens.radius.pill,
        }}
      />
    </View>
  );
};
```

```tsx
// ❌ 나쁜 예 — 시안 값 하드코딩, spec 위반 상태 추가
export const ProgressBar = ({ value, max }) => (
  <View style={{ height: 8, backgroundColor: '#F4F1FA', borderRadius: 999 }}>  // ❌ 리터럴
    <View style={{ width: `${value / max * 100}%`, backgroundColor: '#5B3FFF' }}/>
    {value === max && <ConfettiBurst />}   {/* ❌ 시안에 없는 동작 */}
  </View>
);
```

---

## 5. Output Validation

### 자동 검증 (CI)

- `design-token-sync.yml` — tokens diff 차단
- ESLint: 리터럴 색상·수치 금지 rule
- `ci.yml` — typecheck + lint + test
- Storybook snapshot (있으면) 시각 회귀 탐지

### 수동 체크리스트 (PR 제출 전)

- [ ] 시안 경로 (`design/<...>/v<n>/`) 가 PR 본문에 링크됨
- [ ] Visual diff 스크린샷 첨부 (시안 vs 구현)
- [ ] `IMPLEMENTED.md` 추가됨
- [ ] 레이어별 커밋 분리됨
- [ ] 시안 외 상태·동작 추가 없음 (있으면 spec 보강이 먼저)
- [ ] 새 토큰이 필요했다면 선행 PR 링크
- [ ] Storybook / 에뮬레이터 실제 렌더 확인 완료

---

## 6. Failure Handling

### 6.1 매칭 토큰 없음

1. 시안 값 중 기존 토큰으로 커버 안 되는 부분 식별
2. 먼저 `design-system-skill` 절차로 토큰 승격 PR
3. 머지 후 컴포넌트·화면 승격 PR 진행
4. 임시 하드코딩 절대 금지

### 6.2 시안과 구현 시각 차이

- 색·레이아웃·애니메이션 일치 실패 → 원인 분석
  - (a) 토큰 값 불일치 → design-token-sync 검토
  - (b) 시안의 비정형 값 → spec.md 보강
  - (c) 구현 버그 → 수정
- 1px 단위 오차는 OK. 그 외는 차이 원인 해결 후 머지

### 6.3 시안에 없는 상태를 코드가 필요로 함 (loading, error 등)

- 승격 중단, frontend-design-skill 로 돌아가 시안 보강 (별도 PR)
- PR 본문에 "blocked by design spec gap" 표시

### 6.4 `IMPLEMENTED.md` 이 이미 있지만 경로·구현과 불일치

- 이전 승격의 잔재 — 업데이트 (구현 경로·PR 링크 최신)
- 신규 PR 링크는 머지 후 다시 한 번 정리

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `frontend-design-skill` | 선행 — 시안 확정 | frontend-design → design-handoff |
| `design-system-skill` | 병행 — 토큰·컴포넌트 승격 절차 | design-system 이 core, design-handoff 가 orchestrate |
| `component-skill` | 병행 — 승격된 컴포넌트의 구현 규약 | design-handoff 가 component-skill consume |
| `test-skill` | 병행 — 승격 PR 은 테스트 동반 | 병행 |

---

## 8. Examples

### 8.1 좋은 예 — IMPLEMENTED.md 템플릿

```markdown
# design/components/ProgressBar/IMPLEMENTED.md

## v2 — implemented 2026-05-12

- Code: packages/design-system/src/components/ProgressBar/
- Used by: apps/mobile/src/screens/JourneyHome (F-028)
- Storybook: http://localhost:6006/?path=/story/progressbar--primary
- Tokens consumed: color.surface.muted, color.brand.primary, spacing.md, radius.pill
- PR: #127 (handoff), #124 (tokens v2)

## Visual diff
- design/components/ProgressBar/v2/default.png
- design/components/ProgressBar/v2/implementation/default.png  (2026-05-12 screenshot)
- diff: acceptable (≤1px padding variance)

## Known deltas
- Animation on value change: deferred to v3 spec (motion not in v2)
```

### 8.2 좋은 예 — 커밋 시퀀스

```
# 1) tokens 먼저 (분리 PR)
design-system: promote color tokens v2 (add feedback.info)

# 2) 이어서 컴포넌트 PR
test(design-system): add failing spec for ProgressBar
feat(design-system): implement ProgressBar from design/ProgressBar/v2
design(handoff): mark ProgressBar v2 as implemented
```

### 8.3 나쁜 예 — 회피할 패턴

```
# 한 커밋에 레이어 혼재
feat: add ProgressBar + new tokens + use in JourneyHome screen
     ^ tokens·component·screen 을 한 커밋에 — 리뷰 불가, 롤백 어려움
```

```tsx
// 시안에 없는 confetti 를 임의로 추가
{value === max && <ConfettiBurst />}   // ❌ spec 보강 없이 기능 덧붙임
```

---

## 9. Quick Reference

```
design/                                packages/design-system/src/
├── tokens/color.v2.md        ──▶     ├── tokens/color.ts
├── icons/star-filled.svg     ──▶     ├── icons/StarFilled.tsx
├── components/Button/v3/     ──▶     ├── components/Button/
└── characters/hoya/v2/       ──▶     └── characters/Hoya/

design/screens/<...>/v<n>/   ──▶     apps/<app>/src/screens/<Screen>/
```

승격 순서: tokens → icons → characters → components → screens (apps)

커밋 메시지:
```
design-system: promote color tokens v2
design(handoff): mark ProgressBar v2 as implemented
feat(mobile): implement JourneyHome screen from design/screens/journey-home/v1
```
