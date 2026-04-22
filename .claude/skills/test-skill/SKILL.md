---
name: test-skill
description: 테스트 작성·리뷰 시 자동 적용. TDD 강제, business vs platform 분리, rolling 커버리지 목표.
  *.test.ts(x) / *.spec.ts(x) 파일 생성·수정, vitest 설정 변경, 커버리지 문의 시 트리거.
---

# Test Skill

Hangul Route 의 모든 테스트 작성·리뷰 흐름을 규정한다. TDD 를 강제하고,
`apps/mobile` 의 비즈니스 로직과 플랫폼 의존 코드를 분리 측정한다.
상세 전략은 `docs/tests/strategy.md`, 목표 수치는 `docs/tests/coverage-targets.md`.

---

## 1. Trigger

자동 트리거 조건:

- 경로: `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`
- 경로: `**/vitest.config.ts`, `**/vitest.workspace.ts`
- 경로: `packages/test-utils/**`
- PR 레이블: `coverage`, `test`
- 사용자 요청 키워드: "테스트 추가", "커버리지", "TDD", "vitest 설정"

다른 Skill 과 거의 항상 동반 트리거:

- `component-skill` — 컴포넌트 구현은 반드시 테스트와 한 커밋
- `minigame-skill` — 미니게임은 로직·UX·fixture 3층 테스트
- `content-skill` — fixture 는 zod 스키마 통과 테스트 동반

---

## 2. Precondition (작업 전 필수 확인)

작업 전 반드시 확인한다. 하나라도 누락이면 즉시 중단하고 사용자에게 보고.

- [ ] `docs/specs/F-XXX-*.md` 가 존재하고 `status: ready` — 없으면 구현도 테스트도 시작 금지
- [ ] 대상 패키지가 `apps/mobile` 이라면, 변경 파일이 `src/logic/` 인지 `src/platform/` 인지 분류
- [ ] `packages/test-utils` 에 필요한 fixture helper 존재 확인 — 없으면 helper 먼저 추가하는 별도 커밋
- [ ] 커버리지 측정 제외 대상 (`**/*.d.ts`, `**/*.stories.tsx`, `**/index.ts` re-export, `**/__generated__/**`) 은 테스트 작성 대상이 아님
- [ ] vitest 설정이 two-report (logic / platform) 분리되어 있는지 확인 — 누락 시 `coverage-gate.yml` 실패

누락 시 보고 예시:

> "F-042 사양이 draft 상태라 테스트·구현 모두 시작할 수 없습니다.
> 사양을 ready 로 승격하거나, 다른 F-XXX 로 작업 전환을 지시해 주세요."

---

## 3. Standard Procedure

### 3.1 TDD 3단계 — 레드 → 그린 → 리팩터

모든 구현은 다음 순서를 따른다. 커밋 경계도 이 순서와 일치시킨다.

1. **레드 (failing test).**
   - 실패하는 테스트를 먼저 작성하고 실행하여 **실제로 실패하는 것을 확인**.
   - 커밋: `test(<scope>): add failing spec for F-XXX ...`
2. **그린 (minimum impl).**
   - 테스트를 통과시키는 최소 구현만. 리팩터·추상화 금지.
   - 커밋: `feat(<scope>): implement F-XXX ...` (또는 `fix(...)`)
3. **리팩터 (선택).**
   - 테스트를 계속 통과시키면서 구조 개선.
   - 커밋: `refactor(<scope>): ...`

세 단계가 한 PR 에 포함된다. 1·2 를 같은 커밋에 섞지 않는다.

### 3.2 레이어별 테스트 도구

| 대상 | 도구 | 타깃 |
|---|---|---|
| `packages/content-schema` (zod) | vitest | 100% |
| `packages/backend` (Workers) | vitest + miniflare (in-memory D1) | 90% |
| `packages/design-system` | vitest + @testing-library/react-native | 85% |
| `apps/mobile/src/logic/` | vitest (순수 TS) | 90% → 100% |
| `apps/mobile/src/platform/` | vitest (smoke) + Detox (nightly) | 70% → 80% |
| `apps/web` — verification | vitest | 90% → 100% |
| E2E | Detox (mobile) · Playwright (web) | PR 아님, nightly |

### 3.3 테스트 피라미드 (강제 비율)

- **Unit 70%** — 함수·hook·컴포넌트 단독
- **Integration 20%** — zustand store + 여러 컴포넌트 + mocked API
- **E2E 10%** — Episode 처음부터 끝까지 (nightly 에서만)

이 비율을 R4 Coverage Monitor 가 리포트한다.

### 3.4 작성 순서 (실전)

1. 테스트 파일을 대상 파일과 **같은 디렉토리** 에 생성 (`Foo.tsx` ↔ `Foo.test.tsx`)
2. `describe` 로 대상 식별 (한국어 OK), `it` 로 단일 행동 기술
3. AAA 패턴 준수: **Arrange · Act · Assert**
4. fixture 는 인라인 금지 → `@hangul-route/test-utils` 에서 import
5. `vitest --coverage --run` 으로 로컬 측정, 커버리지 델타 확인
6. `vitest --watch` 로 레드→그린 전환 반복

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ AAA 패턴 (Arrange · Act · Assert) — 한 `it` 당 한 관심사
- ✅ 사용자 행동 기준 쿼리 — `getByRole`, `getByLabelText` 선호
- ✅ `userEvent` 로 터치·타이핑·드래그 시뮬
- ✅ 결정론 확보 — `Date.now`, `Math.random` 은 인자 주입 또는 vitest fake timers
- ✅ fixture 는 `@hangul-route/test-utils` 경유만
- ✅ miniflare 로 Workers 테스트 (실제 네트워크 금지)
- ✅ 접근성 테스트 포함 (`toHaveAccessibleName`, role 존재 여부)

### ❌ 하지 말아야 하는 것

- ❌ 네트워크·파일시스템 실접근 — 반드시 mock
- ❌ 거대 snapshot 기반 UI 테스트 — 인터랙션 기준으로 대체
- ❌ `any` 타입 — `unknown` + narrowing 또는 정확한 타입
- ❌ `xtest` / `it.skip` 을 PR 에 남기기 — 남겨야 하면 이유를 주석 + 이슈 링크
- ❌ 테스트가 구현 내부 (private 함수, internal state) 에 의존
- ❌ `console.log` 디버그 코드 커밋

### 코드 예시

```ts
// ✅ 좋은 테스트 — AAA, 사용자 행동 기준, 결정론
import { render, screen } from '@testing-library/react-native';
import userEvent from '@testing-library/user-event';
import { MatchSound } from './MatchSound';
import { matchSoundFixture } from '@hangul-route/test-utils/minigames';

describe('MatchSound', () => {
  it('정답 터치 시 onComplete 에 score=100 을 전달한다', async () => {
    // Arrange
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<MatchSound content={matchSoundFixture.singleRound} onComplete={onComplete} />);

    // Act
    await user.press(screen.getByRole('button', { name: /ㄱ/ }));

    // Assert
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ score: 100, correctCount: 1, totalRounds: 1 }),
    );
  });
});
```

```ts
// ❌ 나쁜 테스트 — 구현 내부 의존, 인라인 fixture, 스냅샷 남발
it('renders correctly', () => {
  const tree = render(
    <MatchSound
      content={{ type: 'match_sound', version: 1, rounds: [/* 80줄... */] }}
      onComplete={() => {}}
    />,
  );
  expect(tree.toJSON()).toMatchSnapshot(); // 거대 snapshot
  expect((tree as any).instance._currentRound).toBe(0); // internal state
});
```

---

## 5. Output Validation

### 자동 검증 (CI)

- `.github/workflows/ci.yml` — `pnpm vitest --run` 전 패키지 통과
- `.github/workflows/coverage-gate.yml` — rolling target 미달 시 머지 차단
  - `apps/mobile` 은 logic / platform 두 리포트를 별도 비교
- PR 본문에 커버리지 델타 (+X.X% / –X.X%) 명시

### 수동 체크리스트 (PR 제출 전)

- [ ] 레드 커밋과 그린 커밋이 분리되어 있나
- [ ] 실제 실패 로그 → 통과 로그 (PR 본문 또는 커밋 메시지에 기록)
- [ ] 커버리지 델타 확인 (`pnpm vitest --coverage --run`)
- [ ] 새로 추가한 파일이 측정 제외 대상이 아닌지
- [ ] E2E 가 필요한 변경이면 nightly 대상에 추가했나

---

## 6. Failure Handling

### 6.1 커버리지가 rolling target 에 미달

1. 원인 분류 — (a) 테스트 누락 (b) 측정 제외 대상 (c) dead code
2. (a) 이면 테스트 추가 커밋
3. (b) 이면 vitest 설정의 `coverage.exclude` 패턴 업데이트 PR (별도)
4. (c) 이면 dead code 삭제 커밋 (별도 PR 권장)
5. 어느 경로도 불가능하면 **커버리지 목표 조정 제안 이슈** 를 올리고 중단 — 임의로 낮추지 말 것

### 6.2 플레이키 테스트 (가끔 실패)

1. 재현 시도 — `vitest --repeat=20 <file>`
2. 시간·랜덤 의존 → fake timers / seed 주입
3. 네트워크 의존이 숨어있는지 확인
4. 해결까지 시간 걸리면 `it.skip` + 이슈 링크 주석 → 별도 PR 로 복구

### 6.3 miniflare / D1 초기화 실패

- 마이그레이션 순서 문제일 가능성 — `packages/backend/migrations/` 확인
- 통과할 때까지 **새 테스트 추가 금지** — 기존 테스트가 실행 가능한 상태 먼저 복구

### 6.4 막혔을 때 보고 형식

> "F-XXX 의 ... 테스트에서 ... 이유로 막혔습니다.
> 시도한 방법: A, B. 다음 후보: C, D.
> 사용자 판단이 필요한 이유: ...."

임의로 테스트를 삭제·skip 하지 않는다.

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `component-skill` | 컴포넌트 한 개 = 테스트 한 개 (동시 커밋) | test-skill 규약을 component-skill 이 따른다 |
| `minigame-skill` | 미니게임 3층 테스트 (로직·UX·fixture) | minigame-skill 이 test-skill 의 fixture 규약 사용 |
| `content-skill` | fixture 는 zod 스키마 통과 검증 | content-skill 작성 후 test-skill 이 스키마 테스트 |
| `design-system-skill` | 토큰 변경 시 사용처 테스트 재실행 | design-system-skill 이 트리거한 PR 에서 test-skill 자동 동반 |

---

## 8. Examples

### 8.1 좋은 예 — zod 스키마 테스트 (`packages/content-schema`)

```ts
import { describe, it, expect } from 'vitest';
import { MatchSoundContent } from './match-sound';
import {
  matchSoundValidFixture,
  matchSoundInvalidFixture,
} from '@hangul-route/test-utils/fixtures';

describe('MatchSoundContent schema', () => {
  it('5 라운드 fixture 는 스키마 통과한다', () => {
    const result = MatchSoundContent.safeParse(matchSoundValidFixture);
    expect(result.success).toBe(true);
  });

  it('options 가 2개 미만이면 거부한다', () => {
    const result = MatchSoundContent.safeParse(matchSoundInvalidFixture.tooFewOptions);
    expect(result.success).toBe(false);
  });

  it('is_answer=true 인 option 이 정확히 1개여야 한다', () => {
    const result = MatchSoundContent.safeParse(matchSoundInvalidFixture.multipleAnswers);
    expect(result.success).toBe(false);
  });
});
```

왜 좋은가:
- fixture 는 모두 test-utils 경유 (테스트 파일이 10줄로 간결)
- 한 `it` 은 한 판정 (성공 / tooFew / multipleAnswers)
- 한국어 describe 로 의도 명시

### 8.2 좋은 예 — Workers API 테스트 (miniflare)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('POST /episodes/:id/progress', () => {
  let worker: UnstableDevWorker;
  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  it('인증 토큰이 없으면 401', async () => {
    const res = await worker.fetch('/episodes/1.A1/progress', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('유효 토큰 + 정상 payload 는 200 + 저장된 progress 반환', async () => {
    const res = await worker.fetch('/episodes/1.A1/progress', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ questId: 'q1', stars: 3 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ questId: 'q1', stars: 3 });
  });
});
```

### 8.3 나쁜 예 — 회피해야 할 패턴

```ts
// 1. fetch 실접근 — 네트워크 의존
it('api 응답 확인', async () => {
  const res = await fetch('https://api.hangul-route.com/episodes');
  expect(res.ok).toBe(true);
});

// 2. 시간 의존 — 테스트가 자정 근처에 깨짐
it('오늘 날짜 표시', () => {
  expect(formatToday()).toBe(new Date().toLocaleDateString());
});

// 3. snapshot 남발 — 의도가 드러나지 않음, diff 가 노이즈
it('카드 렌더링', () => {
  expect(render(<Card />).toJSON()).toMatchSnapshot();
});

// 4. 여러 관심사 한 it 에 혼재
it('matchsound 전체 동작', async () => {
  // 라운드 진행, 오답 처리, onComplete, 스코어 계산 모두 한 it 에
  // 실패 시 어디가 깨졌는지 불명
});
```

---

## 9. Quick Reference

```bash
# 로컬 전체
pnpm vitest --run

# 커버리지
pnpm vitest --coverage --run

# 특정 파일 watch
pnpm vitest <file>

# mobile logic 만
pnpm --filter @hangul-route/mobile vitest --run src/logic

# 플레이키 재현 (20회 반복)
pnpm vitest --repeat=20 <file>
```

커밋 메시지 템플릿:

```
test(<scope>): add failing spec for F-XXX ...
feat(<scope>): implement F-XXX to pass spec
refactor(<scope>): ... (optional, keep tests green)
```
