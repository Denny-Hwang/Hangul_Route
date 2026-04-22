---
name: minigame-skill
description: 미니게임(Stage 1 타일 등) 구현 시 자동 적용. 4 family / 12종 카탈로그 기반.
  apps/mobile/src/minigames/ 신규·수정, packages/content-schema/src/minigames/ 변경 시 트리거.
  비즈니스 로직과 플랫폼 레이어 분리.
---

# Minigame Skill

`docs/blueprints/06-mini-game-catalog.md` 의 4 family / 12 종 미니게임을
구현할 때의 표준. **순수 비즈니스 로직** (scoring·rule·round progression)
과 **플랫폼 의존 레이어** (RN Animated·Audio·Camera·STT) 를 분리해
테스트 가능하게 만든다. 모든 게임은 공통 인터페이스를 준수한다.

근거: `docs/blueprints/06-mini-game-catalog.md`, `docs/design/interaction-patterns.md`.

---

## 1. Trigger

자동 트리거 조건:

- 경로: `apps/mobile/src/minigames/**`
- 경로: `packages/content-schema/src/minigames/**`
- 경로: `content/minigames/**`, `content/fixtures/minigames/**`
- 사용자 요청 키워드: "미니게임 추가", "Match Sound 구현", "Voice Echo", "새 라운드 규칙"
- PR 레이블: `minigame`

동반 Skills (자동):
- `component-skill` — 게임 UI 는 component-skill 준수
- `test-skill` — 로직·UX·fixture 3층 테스트
- `content-skill` — content/minigames/ 의 fixture·라운드 JSON
- `design-handoff-skill` — 게임별 시안 승격

---

## 2. Precondition (작업 전 필수 확인)

- [ ] `docs/specs/F-XXX-*.md` 가 `status: ready` 이고 해당 미니게임 지정
- [ ] `docs/blueprints/06-mini-game-catalog.md` 에서 대상 게임 스펙·MVP phase 확인
- [ ] `packages/content-schema/src/minigames/<type>.ts` zod 스키마 존재 (없으면 먼저 추가)
- [ ] `design/screens/minigame-<type>/v<n>/` 시안 존재·확정
- [ ] MVP phase 인지 확인 — 현재 MVP 는 5종 (Match Sound / Build a Letter / Pic-Word / Trace Stroke 약식 / Voice Echo 1 시나리오)
- [ ] 필요한 토큰 (motion·sound) 존재 확인

누락 시:

> "F-XXX 가 대상 미니게임을 지정하지 않았거나, content-schema 의
> <type>.ts 스키마가 없습니다. 사양·스키마 먼저 확정해 주세요."

---

## 3. Standard Procedure

### 3.1 공통 인터페이스 (강제)

모든 미니게임 컴포넌트는 이 Props 와 Result 를 따른다:

```ts
// packages/shared-types/src/minigame.ts
export interface MinigameProps<TContent> {
  content: TContent;                    // 게임 타입별 content-schema 타입
  onComplete: (result: MinigameResult) => void;
  onSkip?: () => void;                  // 호야의 "건너뛰기" 요청
  reducedMotion?: boolean;              // prefers-reduced-motion
}

export interface MinigameResult {
  score: number;         // 0-100
  correctCount: number;
  totalRounds: number;
  timeMs: number;
  attempts: number;      // 총 시도 수 (오답 포함)
}
```

이 인터페이스를 구현하지 않으면 `EpisodePlayer` 가 게임을 실행하지 않는다.

### 3.2 로직 / 플랫폼 분리 (강제)

```
apps/mobile/src/minigames/<game-type>/
├── logic/
│   ├── scoring.ts           # 순수 함수 (vitest 100%)
│   ├── reducer.ts           # useReducer action·state
│   ├── progression.ts       # 라운드 전환 규칙
│   └── types.ts             # 로직 전용 타입
├── platform/
│   ├── SoundCue.ts          # expo-av wrapper
│   ├── HapticFeedback.ts    # expo-haptics wrapper
│   └── useAnimatedFeedback.ts  # RN Animated wrapper
├── <GameType>.tsx           # presentational
├── <GameType>.test.tsx
├── <GameType>.stories.tsx
└── index.ts
```

- `logic/` 는 `apps/mobile/src/logic/` coverage target (90% → 100%) 적용
- `platform/` 는 `src/platform/` coverage target (70% → 80%) 적용
- 컴포넌트 파일은 둘을 연결하는 얇은 레이어

### 3.3 표준 작업 흐름

1. `content-schema/src/minigames/<type>.ts` zod 스키마 확인 (없으면 선행 PR)
2. `logic/scoring.ts`, `logic/reducer.ts`, `logic/progression.ts` 를 먼저 구현
   - 레드 테스트 작성 → 그린 구현 → 리팩터
3. `platform/` 래퍼는 smoke 테스트 (70% 범위)
4. `<GameType>.tsx` 컴포넌트 — props / state 결합 (component-skill 준수)
5. fixture 추가 (`content/fixtures/minigames/<type>.*.fixture.json`)
6. Storybook 스토리 — variant·state·fixture 별
7. `design/screens/minigame-<type>/v<n>/` 시안 vs 실제 렌더 스크린샷 비교

### 3.4 라운드 라이프사이클 (강제)

모든 게임의 한 라운드는 다음 흐름을 따른다:

```
idle → presented → awaiting-input → [correct | incorrect] → reveal → next
```

- **presented (0-300ms)**: 문제 노출, 음성 재생 (있으면)
- **awaiting-input**: 사용자 입력 대기. 5초 미반응 시 힌트 제시 (게임별)
- **correct**: 200ms 시각 효과 + `tokens.sound.positive-short`
- **incorrect**: 150ms shake × 2, 정답 강조 400ms, `tokens.sound.gentle-oops`
- **reveal**: 정답 2초 유지 (오답 시에만)
- **next**: 다음 라운드 자동. 모든 라운드 종료 시 `onComplete` 호출

### 3.5 필수 UX (5-11세)

- 터치 영역 ≥ 64dp (component-skill 규약)
- 색상만으로 정답·오답 전달 금지 — 아이콘·모양·애니메이션 병행
- VoiceOver / TalkBack 라벨 (정답 여부·라운드 번호)
- 시각·청각 중복 피드백 (sound off 사용자도 식별 가능)
- `reducedMotion` 시 스케일·쉐이크 제거, 색·아이콘만

### 3.6 점수 산정

```ts
// logic/scoring.ts — 예시
export function computeScore({ correctCount, totalRounds, attempts }: {
  correctCount: number; totalRounds: number; attempts: number;
}): number {
  if (totalRounds === 0) return 0;
  const accuracy = correctCount / totalRounds;    // 0~1
  const efficiency = totalRounds / Math.max(attempts, totalRounds);  // 0~1
  return Math.round(accuracy * 0.8 * 100 + efficiency * 0.2 * 100);
}
```

별 개수 매핑 (Quest celebrate 단계):
- 80-100 → ⭐⭐⭐
- 50-79 → ⭐⭐
- 0-49 → ⭐
- 3회 시도 불가 → pass (별 1개)

### 3.7 MVP 5종 우선순위 (blueprint 06 §6)

| 순서 | 게임 | 주차 |
|---|---|---|
| 1 | Match Sound | W4 |
| 2 | Build a Letter | W5 |
| 3 | Pic-Word Match | W6 |
| 4 | Trace Stroke (약식) | W7 |
| 5 | Voice Echo (1 시나리오) | W7 |

나머지 7종은 Week 9+ (Phase 2 이후).

### 3.8 Voice Echo 특수 규칙

- STT API 통합 (OpenAI Whisper / Google / Naver Clova)
- **일일 사용자당 5회 제한** (무료 한도 관리)
- 한글 유사도 평가: 자모 분해 후 Levenshtein
- 관용적 평가: 80% 이상 → ⭐⭐⭐, 50-80% → ⭐⭐, < 50% → ⭐ + 재시도
- **3회 인식 실패 시 통과 처리** (좌절 방지)
- STT 호출 실패 시: UI 에 "나중에 다시" + 텍스트 대체 선택지

---

## 4. Rules (강제)

### ✅ 해야 하는 것

- ✅ 공통 `MinigameProps<T>` / `MinigameResult` 준수
- ✅ 로직 / 플랫폼 디렉토리 분리
- ✅ fixture 는 `content/fixtures/minigames/` 에만, 실 콘텐츠와 섞지 않음
- ✅ `reducedMotion` props 지원
- ✅ 모든 시각 피드백에 청각·모양·아이콘 보조
- ✅ 라운드 라이프사이클 5단계 준수
- ✅ `onComplete` 는 `MinigameResult` 전달 시 1회만 호출
- ✅ Voice Echo 는 일일 5회 제한 + 3회 실패 시 통과 처리

### ❌ 하지 말아야 하는 것

- ❌ 로직·플랫폼 혼재 (같은 파일에 pure function + RN Animated)
- ❌ 색상만으로 정답·오답 구분
- ❌ `onComplete` 를 중복 호출 또는 result 누락
- ❌ fixture 에 실제 Episode 의 콘텐츠 (fixture 전용 데이터만)
- ❌ 시안에 없는 피드백·애니메이션 추가
- ❌ STT 호출을 서버 토큰 없이 클라이언트에서 (비용 누수)
- ❌ MVP 외 7종을 MVP 주차에 구현

### 코드 예시

```ts
// ✅ 좋은 예 — logic/reducer.ts 는 순수 함수, RN 의존 없음
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'input': {
      const correct = action.optionIndex === action.answerIndex;
      return {
        ...state,
        status: correct ? 'correct' : 'incorrect',
        correctCount: state.correctCount + (correct ? 1 : 0),
        attempts: state.attempts + 1,
      };
    }
    case 'next': return { ...state, status: 'presented', roundIndex: state.roundIndex + 1 };
    case 'timeout': return { ...state, status: 'reveal' };
  }
}
```

```tsx
// ❌ 나쁜 예 — 로직·플랫폼 혼재 + onComplete 누락
export const MatchSound = ({ content }) => {
  const [idx, setIdx] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;   // 컴포넌트에 Animated
  const play = (i: number) => {
    if (i === content.rounds[idx].answer) {             // 점수·라운드 진행 섞임
      Animated.timing(anim, { toValue: 1 }).start();
    }
    // onComplete 호출 없음
  };
};
```

---

## 5. Output Validation

### 자동 검증 (CI)

- `ci.yml` — typecheck + lint + test
- `coverage-gate.yml` — logic 90% / platform 70% 분리 리포트
- `content-validation.yml` — fixture 의 zod 통과
- R2 Content Validator — fixture·라운드 수 검증 (3 라운드 최소 등 휴리스틱)

### 수동 체크리스트

- [ ] 공통 `MinigameProps<T>` 인터페이스 준수
- [ ] logic/ 커버리지 ≥ 90% (신규 코드 100%)
- [ ] platform/ 커버리지 ≥ 70%
- [ ] `reducedMotion` prop 분기 확인
- [ ] 에뮬레이터·시뮬레이터에서 3 연령대 (5-6 / 7-9 / 10-11) 체감 플레이
- [ ] `onComplete` 가 `MinigameResult` 로 1회 호출됨을 테스트
- [ ] VoiceOver / TalkBack 으로 정답 여부·라운드 번호 읽힘
- [ ] Voice Echo 는 일일 5회 제한 + 3회 실패 통과 구현 확인

---

## 6. Failure Handling

### 6.1 zod 스키마 위반 fixture

1. 위반 메시지에서 라운드·필드 식별
2. fixture 수정 (스키마는 source of truth)
3. 스키마 자체가 문제면 `packages/content-schema` 별도 PR

### 6.2 STT 호출 실패 (Voice Echo)

- 일일 한도 초과 → UI 에 "다음에 다시 해볼까?" + 텍스트 답 선택지
- 네트워크 오류 → 3초 재시도 × 1회, 그 후 pass 처리
- 한국어 유사도 임계값 조정 필요 → `docs/blueprints/06` 업데이트 제안 이슈

### 6.3 3회 시도 실패 (모든 게임)

- **통과 처리** — 좌절 방지 (blueprint 06 명시)
- 호야 대사: "Good try! Let's move on."
- 별 1개, `onComplete` 호출 정상

### 6.4 timer / 애니메이션 flaky 테스트

- `vi.useFakeTimers()` + `await flushPromises()` 로 결정론화
- `reducedMotion: true` 로 테스트 파라미터화

### 6.5 게임이 시안과 다르게 느껴짐

- 구현 vs `design/screens/minigame-<type>/v<n>/` 스크린샷 비교
- 차이 원인이 spec gap 이면 frontend-design-skill 로 백트래킹

---

## 7. Related Skills

| Skill | 관계 | 순서 |
|---|---|---|
| `component-skill` | 게임 UI 는 component-skill 규약 | 병행 필수 |
| `test-skill` | logic·platform 분리 + fixture 테스트 | 병행 필수 |
| `content-skill` | fixture·라운드 JSON 작성 | 병행 |
| `design-handoff-skill` | 게임별 시안 승격 | design-handoff → minigame |
| `design-system-skill` | 사운드·motion 토큰 공급 | 선행 |

---

## 8. Examples

### 8.1 좋은 예 — Match Sound 로직 테스트

```ts
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './reducer';
import { computeScore } from './scoring';

describe('MatchSound reducer', () => {
  it('정답 input 시 correct 상태 + correctCount + 1', () => {
    const s1 = reducer({ ...initialState, status: 'awaiting-input' },
      { type: 'input', optionIndex: 0, answerIndex: 0 });
    expect(s1.status).toBe('correct');
    expect(s1.correctCount).toBe(1);
    expect(s1.attempts).toBe(1);
  });

  it('오답 input 시 incorrect 상태, correctCount 유지', () => {
    const s1 = reducer({ ...initialState, status: 'awaiting-input' },
      { type: 'input', optionIndex: 1, answerIndex: 0 });
    expect(s1.status).toBe('incorrect');
    expect(s1.correctCount).toBe(0);
    expect(s1.attempts).toBe(1);
  });
});

describe('computeScore', () => {
  it('전부 정답 + 시도=라운드 → 100', () => {
    expect(computeScore({ correctCount: 5, totalRounds: 5, attempts: 5 })).toBe(100);
  });
  it('절반 정답 + 시도 1.5배 → 약 54', () => {
    expect(computeScore({ correctCount: 3, totalRounds: 6, attempts: 9 })).toBeGreaterThanOrEqual(50);
    expect(computeScore({ correctCount: 3, totalRounds: 6, attempts: 9 })).toBeLessThanOrEqual(60);
  });
});
```

### 8.2 좋은 예 — fixture

```json
// content/fixtures/minigames/match-sound.single-round.fixture.json
{
  "type": "match_sound",
  "version": 1,
  "rounds": [
    {
      "id": "r1",
      "prompt": { "audio_url": "fixtures/audio/g.mp3", "visual": "hoya_mouth_g" },
      "options": [
        { "label": "ㄱ", "is_answer": true },
        { "label": "ㄴ" },
        { "label": "ㄷ" }
      ]
    }
  ]
}
```

### 8.3 나쁜 예 — 회피 패턴

```
❌ MVP 주차에 Role Play (Phase 3) 구현 시도
❌ logic/ 파일에 react-native import
❌ STT API key 를 클라이언트에서 직접 사용 (서버 proxy 없이)
❌ 오답 피드백을 텍스트 "WRONG!" 으로
❌ onComplete 를 setInterval 안에서 여러 번 호출
```

커밋 메시지:
```
feat(mobile): implement Match Sound minigame logic (F-001)
content: add match-sound fixture for Stage 1 Q1
```
