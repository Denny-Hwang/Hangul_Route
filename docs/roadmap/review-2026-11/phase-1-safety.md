# Phase 1 — 데이터 안전과 규칙 위반 수정 (WO-01 – WO-09)

먼저 `README.md` 를 읽는다. 여기 있는 WO 는 프로젝트 규칙을 실제로 어기는 항목이다. 근거의 **확인** 은 계획 작성 시 해당 줄을 직접 열어 본 것, **보고** 는 리뷰 단계의 판독이라 집행 세션이 다시 읽어야 하는 것이다.

---

## WO-01 진도를 잃지 않는 읽기와 쓰기

**목표.** 저장소 읽기가 실패하거나 값이 손상됐을 때 "저장된 것이 없다"로 처리하지 않는다. 쓰기가 실패하면 알고, 다시 시도하고, 학습자에게 차분히 알린다.

**왜.** 지금은 읽기 실패 한 번이 빈 프로필·빈 진도로 이어지고, 다음 쓰기가 원래 저장본을 덮어쓴다. "얻은 것은 빼앗지 않는다" 규칙이 조용히 깨진다.

**근거.**
- 확인: `apps/mobile/src/platform/storage.ts:11-18` — `readJson` 이 읽기 오류와 파싱 오류를 모두 `null` 로 돌려준다. 같은 파일에 `readJsonStrict`(읽기 실패는 throw, 파싱 실패는 null), `readJsonExact`(둘 다 throw) 가 이미 있다.
- 확인: `apps/mobile/src/store/progress-store.ts:311-315` — `save()` 가 `void writeJson(...)` 이고 catch 가 없다.
- 확인: `apps/mobile/src/store/progress-store.ts:500-523` — `hydrate` 가 `readJson` 결과가 없어도 `hydratedFor` 에 프로필을 넣는다.
- 확인: `apps/mobile/src/store/profile-store.ts:352-367` — `hydrate` 가 `readJson` 으로 프로필 목록을 읽고 빈 목록이어도 `hydrated: true`.
- 확인: `apps/mobile/App.tsx:148-149` — `hydrateLearnerData().catch(() => undefined)`.
- 웹 쪽 래퍼 `storage.web.ts` 의 동작은 보지 못했다. 사양 행에서 읽는다.

**사양.** 새 파일 `docs/specs/AMENDMENTS-DURABLE-PROGRESS.md`. `F-APP-001`, `F-PROF-*`, `F-SYNC-002` 를 수정한다(정확한 대상은 사양 행에서 인용으로 확정). `AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` §13.2 가 `hr:profiles:locks` 에 대해 같은 문제를 이미 풀었으니 그 방식을 따른다.

| 행 | 모델 | 내용 |
|---|---|---|
| DP-0 | Opus 5.5 | 사양 작성. 아래 "사양이 정해야 할 것" 을 모두 결정 |
| DP-1 | Opus 5.5 | 프로필·진도 hydrate 를 실패를 구분하는 읽기로 교체 + 읽기 실패 화면 |
| DP-2 | Sonnet 5.5 | 진도 쓰기 실패 감지, 재시도, `saveFailed` 표시 |
| DP-3 | Sonnet 5.5 | 손상 값 격리(원본을 다른 키로 보존) + telemetry |

**사양이 정해야 할 것 (DP-0).**
1. 세 가지 결과를 구분하는 읽기 계약: `missing`(키 없음) / `value` / `failed`(읽기 오류 또는 파싱 불가). `readJsonExact` 가 이미 이 구분을 throw 로 준다.
2. `failed` 일 때의 동작: 한 번 재시도(`readJsonExactFresh`) → 그래도 실패면 store 를 hydrated 로 표시하지 않고, 그 프로필에 대한 **모든 쓰기를 막는다**.
3. 파싱 불가 값의 처리: 지우지 않는다. `hr:<key>:damaged:<timestamp>` 로 옮겨 두고 telemetry 를 보낸다. 키 이름은 write fence(`writePasses`) 규칙과 맞춘다.
4. 학습자가 보는 화면: 기존 `OopsScreen`(`App.tsx:227-230`, "Your cards and stars are safe")을 재사용할지, 새 화면인지. 문구는 "We could not read your progress. Try again." 수준으로 짧게. 버튼은 Try again 하나. "새로 시작" 버튼은 두지 않는다(보호자 영역의 복원 흐름으로만).
5. 동기화와의 관계: `F-SYNC-002` 의 서버 사본이 있으면 복원 제안을 어디서 하는지. 범위를 넘으면 Out of scope 로 적는다.
6. 쓰기 실패: 재시도 횟수와 간격(권고 3회, 1s/4s/15s), 그동안 메모리 상태 유지, `saveFailed` 가 어디에 보이는지(Results 와 Profile 의 한 줄), 다음 성공 시 자동 해제.
7. `notifyProgressPersisted` 는 쓰기가 성공한 뒤에만 부른다(지금은 쓰기 결과와 무관하게 부른다).

**구현 메모 (DP-1).**
- `progress-store.ts` 의 `hydrate` 안 `readJson<ProgressSnapshot>` 를 새 읽기로 바꾼다. `failed` 면 `hydratedFor` 에 넣지 않고 `loadFailedFor` 같은 집합에 넣는다.
- `save()` 맨 앞에서 `loadFailedFor.has(profileId)` 면 쓰지 않는다. 이 한 줄이 덮어쓰기를 막는 핵심이다.
- `profile-store.ts` 의 `PROFILES_KEY`, `ACTIVE_KEY`, `PROFILE_TOMBSTONES_KEY` 세 읽기 모두 같은 계약으로. 목록 읽기가 실패하면 `hydrated: true` 로 두지 않는다. Welcome(새 프로필) 화면으로 가면 안 된다.
- `App.tsx:148-149` 의 `.catch(() => undefined)` 는 실패 상태를 store 에 남기는 것으로 바꾼다.
- 다른 store(`story`, `memory`, `sync` 등)의 `readJson` 은 이번 범위가 아니다. 사양의 Out of scope 에 목록으로 적어 둔다.

**테스트.**
- `storage` 단위: 읽기 throw, 파싱 불가, 빈 문자열, 정상 값 네 경우.
- `progress-store`: (a) 읽기 실패 → hydrated 아님, 이후 `recordQuestComplete` 가 `writeJson` 을 부르지 않음. (b) 재시도 성공 → 정상 hydrate. (c) 쓰기 1회 실패 후 성공 → `saveFailed` 가 켜졌다 꺼짐, `notifyProgressPersisted` 는 성공 뒤 1회.
- `profile-store`: 목록 읽기 실패 → `hydrated` false, 프로필 0개로 취급하지 않음.
- 화면: 읽기 실패 상태에서 Welcome 이 아니라 실패 화면이 그려진다.

**수용 기준.**
- 저장된 진도가 있는 상태에서 AsyncStorage `getItem` 이 한 번 throw 해도 저장본이 바뀌지 않는다(테스트로 증명).
- 쓰기 실패가 telemetry 와 화면 한 줄로 드러난다.
- 손상된 값은 지워지지 않고 격리 키에 남는다.
- **[실기기]** 저장 공간이 가득 찬 기기에서 퀘스트를 끝내면 안내가 보이고, 공간을 비운 뒤 다시 저장된다.

**하지 말 것.** 실패 화면에 danger 색을 쓰지 않는다. 저장 실패를 이유로 학습을 막지 않는다(읽기 실패만 막는다). `readJson` 자체의 시그니처를 바꿔 다른 호출부를 한꺼번에 건드리지 않는다.

**예상.** 사양 0.5d, 구현 1.5d.

---

## WO-02 따라 쓰기의 무입력 자동 채점을 없앤다

**목표.** 낱자 따라 쓰기(Trace Stroke)에서 손을 떼고 1.5초가 지났다는 이유만으로 미완성 글자를 오답 처리하지 않는다.

**근거.**
- 확인: `apps/mobile/src/logic/trace-evaluator.ts:13` `TRACE_IDLE_MS = 1500`. 머리말이 F-004 §3.3("on Done, or after a 1.5 s idle timer")을 인용한다.
- 확인: `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx:138-141` — `createTraceEvaluator({ idleMs, onEvaluate })` 에 준비 조건이 없다. `:227-240` 실패 시 `answerRound(roundIdx, false)` 뒤 1.8–2.0초 후 `setStrokes([])`.
- 확인: 단어 따라 쓰기는 이미 조건이 있다. `apps/mobile/src/logic/trace-word/evaluate.ts:210-234` 의 `createTraceWordGate({ idleMs, onEvaluate, ready })` 는 `ready()` 일 때만 idle 카운트를 시작한다. 테스트 `logic/trace-word/__tests__/evaluate.test.ts:242`.

**사양.** `docs/specs/AMENDMENTS-TRACE-IDLE.md` — F-004 §3.3, F-005, F-008 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| TI-0 | Opus 5.5 | 사양. 아래 결정 포함 |
| TI-1 | Sonnet 5.5 | `createTraceEvaluator` 에 `ready` 추가, TraceStrokeGame 연결 |
| TI-2 | Sonnet 5.5 | 실패 후 처리(전체 삭제 → 다시 그릴 부분만 표시), 피드백 문구 유지 시간 |

**사양이 정해야 할 것 (TI-0).**
1. idle 자동 채점 조건: **그린 획 수 ≥ 기대 획 수** 일 때만 카운트를 시작한다. 그 전에는 Done 버튼만 채점한다. (대안: idle 채점을 완전히 없애고 Done 만. 어린 학습자가 Done 을 못 찾을 위험이 있어 권고하지 않는다.)
2. idle 로 채점됐고 결과가 fail 인 경우 `answerRound(…, false)` 를 기록할지. 권고: 기대 획 수를 채운 뒤의 채점은 Done 과 같게 취급한다(기록함). 조건 1 덕분에 미완성 글자는 더 이상 여기 오지 않는다.
3. WO-03 과의 관계: 획순 데이터가 교정되기 전까지 "기대 획 수"는 현재 데이터의 `strokes.length` 를 쓴다. WO-03 이 머지되면 자동으로 따라간다.
4. 실패 후: 획 전체를 지우지 말고, 맞은 획은 남기고 다시 그릴 획만 가이드로 강조. 구현이 크면 "전체 삭제 유지 + 지우기 전 문구 유지" 로 축소하고 그 이유를 적는다.
5. 안내 문구(획 순서·방향)는 타이머로 지우지 않고 다음 획을 시작할 때 지운다(리뷰 접근성 #16, 보고: `TraceStrokeGame.tsx:219-240`).

**구현 메모 (TI-1).** `createTraceEvaluator` 의 옵션에 `ready?: () => boolean` (기본 `() => true`) 를 넣고 `strokeEnded` 에서 `ready()` 일 때만 타이머를 건다. `createTraceWordGate` 가 같은 일을 감싸서 하고 있으니, 가능하면 그쪽을 얇게 만들어 중복을 없앤다(동작 변경 없이).

**테스트.** `trace-evaluator` 단위: 기대 3획 중 2획 뒤 `TRACE_IDLE_MS * 3` 경과 → `onEvaluate` 0회. 3획 뒤 1.5s → 1회. Done 은 언제든 1회. 기존 테스트 전부 통과.

**수용 기준.** 미완성 글자가 시간만으로 채점되지 않는다. Done, Clear, Skip, "Show me" 동작은 그대로다. **[실기기]** ㅂ·ㅊ 를 획 사이에 3초 쉬며 그려도 끝까지 그릴 수 있다.

**하지 말 것.** `TRACE_IDLE_MS` 값만 늘리는 것으로 끝내지 않는다. 채점 임계값(coverage)은 건드리지 않는다.

**예상.** 0.5d + 0.5d.

---

## WO-03 표준 획순으로 교정

**목표.** 30개 자모의 획 수·순서·방향 데이터를 표준에 맞추고, 검수가 끝난 글자만 순서를 채점한다.

**근거.**
- 확인: `apps/mobile/src/content/jamo-strokes.ts:14-15` "not perfectly anatomical Hangul stroke order". `:92-96` ㅁ 이 한 획(사각형). `:151-158` ㅌ 이 4획. `:218-231` ㅗ·ㅛ 가 가로획 먼저. `:298` `reviewedStrokeIds = []`.
- 확인: `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx:207` `checkOrder: true`.
- 보고: 안내 문구 "Next time, try drawing the top line first." (`packages/i18n/src/messages/en/learner.ts:835`).
- 계획 작성자의 판단: ㅗ(짧은 세로 → 가로), ㅛ, ㅁ(3획), ㅌ(3획: 가로 → 가로 → ㄴ 모양)은 확신이 높다. ㅈ·ㅊ 획수와 나머지 글자는 **외부 자료로 대조해야 한다.**

**사양.** `docs/specs/AMENDMENTS-STROKE-ORDER-STANDARD.md` — F-004, F-005, F-006 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| SO-1 | Sonnet 5.5 | **당장 하는 임시 조치.** `reviewedStrokeIds` 에 없는 글자는 순서·방향을 채점하지 않고 순서 안내 문구도 내지 않는다 |
| SO-0 | Opus 5.5 | 사양 + 30자 획순 표(글자, 획 수, 각 획의 시작점·방향, 출처) |
| SO-2 | Opus 5.5 | `jamo-strokes.ts` 30자 교정, "Show me" 시연과 말로 하는 획순 설명 동기화 |
| SO-3 | 오너 / 교사 | 표와 시연 화면 검수 → `reviewedStrokeIds` 채우기 |

**SO-1 을 먼저 하는 이유.** 교정과 검수에는 시간이 걸린다. 그동안 틀린 순서를 "가르치는" 것을 멈추는 것이 한 줄 변경으로 가능하다. `reviewedStrokeIds` 가 이미 그 용도로 있다. coverage(모양) 채점은 그대로 둔다.

**SO-0 의 출처 규칙.** 획순 표의 각 행은 출처를 적는다. 1순위 국립국어원 자료, 2순위 초등 1학년 국어 교과서의 자모 쓰기 순서. 집행 세션은 웹 검색으로 출처를 찾아 URL 과 접근 날짜를 적고, 두 출처가 다르면 둘 다 적고 오너 결정으로 넘긴다. **기억에 의존해 채우지 않는다.**

**SO-2 구현 메모.**
- 좌표계는 200 × 200 viewBox, `p(x, y)`, 원은 `loop` 헬퍼로 샘플링한다(직접 찍지 않는다).
- 받침 6개(`jamo:*-batchim`) 스켈레톤도 같은 순서로 맞춘다.
- 획 수가 바뀌면 영향받는 곳: coverage 허용치, 방향 판정(F-006), 스크린리더용 획순 설명 문자열, 시각 회귀 스냅샷(F-VR-001).
- 표준 획순 일반 원칙(위에서 아래, 왼쪽에서 오른쪽, 가로 먼저는 교차할 때)을 표의 검산에 쓴다.

**테스트.** 30자 각각 획 수 스냅샷. `reviewedStrokeIds` 에 없는 글자는 `orderCorrect` 가 결과에 영향을 주지 않음. 순서가 반대여도 coverage 가 충분하면 통과(임시 조치 기간).

**수용 기준.** 표준대로 쓴 ㅗ 가 교정 안내를 받지 않는다. 검수가 끝난 글자만 순서 안내가 나온다. 표의 모든 행에 출처가 있다.

**하지 말 것.** 출처 없이 획순을 "고치지" 않는다. `reviewedStrokeIds` 를 모델이 채우지 않는다(사람 검수 표시다).

**예상.** SO-1 0.25d, SO-0 0.5d, SO-2 1d.

---

## WO-04 색 말고도 알 수 있는 정답·오답 피드백과 결과 알림

**목표.** 모든 미니게임에서 결과가 (a) 색 외의 표시로 보이고 (b) 스크린리더에 한 번 전달된다. iOS·Android·웹 모두.

**근거.**
- 확인: `apps/mobile/src/screens/minigames/CultureQuizGame.tsx:150` — `tone = showCorrect ? 'success' : isWrongLocked ? 'nudge' : 'secondary'`. `packages/design-system/src/tokens.ts:28` secondary `#2672A6`, `:51` success `#397952`.
- 보고: 두 채움의 대비 1.00:1. `TapRespondGame.tsx:172` 같은 패턴. `CultureQuizGame.tsx:83-92` 700ms 뒤 다음 라운드.
- 보고: `CardMatchGame.tsx:69, 184-193, 202-219` — 오답이 600ms `nudgeLight` 깜빡임뿐, 레이블 `:250, :285` 고정.
- 보고: `packages/design-system/src/components/HoyaBubble/HoyaBubble.tsx:55` `accessibilityLiveRegion="polite"` 만 사용(iOS 미지원). `announceForScreenReader` 호출처는 7개 파일뿐. `apps/mobile/src/components/PromptPanel.tsx` 주석이 "wrapper stays mounted" 패턴을 이미 설명한다.
- 보고: `packages/design-system/src/components/Tile/Tile.tsx:28` `wrong: '#B5862A'` 리터럴, mark 없음. `ChoiceCard` 는 wrong 에 mark 가 필수다.

**사양.** `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` (INBOX T-015 가 예고한 F-A11Y-001 을 이 범위로 시작한다).

| 행 | 모델 | 내용 |
|---|---|---|
| AF-0 | Opus 5.5 | 사양 + 와이어프레임(`design/wireframes/minigame/answer-feedback.md`) |
| AF-0b | Opus 5.5 | 시안: 결과 mark 가 붙은 Button / Tile / 카드 (`design/components/`) |
| AF-1 | Opus 5.5 | 공통 훅 `useAnswerAnnouncement` + 상시 마운트 알림 영역 컴포넌트 |
| AF-2 | Sonnet 5.5 | Culture Quiz, Tap & Respond: mark + 레이블 + 알림 |
| AF-3 | Sonnet 5.5 | Card Match: mark, 오답 표시 유지, 맞춘 카드 레이블 |
| AF-4 | Sonnet 5.5 | MatchSound, OddOneOut, BuildLetter 및 나머지 게임에 훅 적용 |
| AF-5 | Sonnet 5.5 | `Tile` 에 상태 mark, 리터럴 제거 |

**사양이 정해야 할 것 (AF-0).**
1. 결과 표시의 한 가지 규칙: 정답 = check mark + success, 다시 = replay(또는 기존 ChoiceCard 의 wrong mark) + nudge. 아이콘은 `packages/design-system` 아이콘 세트에 있는 것만.
2. 알림 문장의 형식과 사전 키(`a11y` 네임스페이스). 예: "Correct. 사과, sagwa, apple." / "Not this one. Try again." 한글 부분의 언어 처리는 WO-40 과 맞춘다.
3. 알림 채널: 상시 마운트된 polite 영역(웹·Android) + iOS 는 `AccessibilityInfo.announceForAccessibility`. 한 결과에 한 번만.
4. 자동 진행 시간: 700ms 는 mark 를 읽기에 짧다. 스크린리더가 켜져 있으면 알림이 끝난 뒤 진행(placement 의 `announceAndWait` 패턴 재사용), 꺼져 있으면 현재 값 유지 또는 소폭 연장.
5. 오답 표시는 다음 입력까지 유지(Card Match).
6. 버튼 레이블의 상태 반영: 정답 버튼 ", correct", 잠긴 오답 ", try another".

**구현 메모 (AF-1).** 훅은 `apps/mobile/src/logic` 에 순수 부분(문장 만들기)과 `platform` 부분(announce)으로 나눈다. `platform/screen-reader.web.ts` 는 스크린리더 감지가 항상 false 이므로 웹에서는 live region 만 믿는다. 컴포넌트는 내용이 바뀌어도 언마운트되지 않아야 한다.

**테스트.** 게임별: 정답 후 정답 버튼에 mark 가 렌더되고 접근성 레이블이 바뀐다. 알림 영역 텍스트가 결과마다 한 번 바뀐다. iOS 경로에서 announce 가 1회 호출된다(mock). 리터럴 색이 design-system 에 남지 않는다(기존 토큰 테스트).

**수용 기준.** 흑백 스크린샷에서 정답·오답·미선택이 구분된다. **[실기기]** VoiceOver·TalkBack 에서 결과가 한 번 읽힌다.

**하지 말 것.** 오답에 danger 색이나 X 아이콘을 쓰지 않는다. 결과 알림을 assertive 로 만들지 않는다.

**예상.** 사양·시안 1d, 구현 2.5d.

---

## WO-05 소리가 안 들릴 때의 안내 (iOS 무음 스위치)

**선행.** OD-R6.

**목표.** 하드웨어 무음이나 볼륨 0 때문에 소리가 안 나도 학습자가 방법을 찾을 수 있다.

**근거.**
- 확인: `apps/mobile/src/config/audio.ts:4-10` `PLAY_IN_SILENT_MODE = false`, 주석 "the visible text prompt keeps every round playable".
- 확인: `apps/mobile/src/logic/audio/prompt-state.ts:37-39` — `result === 'played'` 이면 `phase: 'ok'`. 텍스트는 `muted` / `no_voice` / `error` 에서만(`showText`, `:65-67`).
- 보고: `apps/mobile/src/platform/audio-player.ts:135` 가 `playsInSilentModeIOS` 에 값을 넘긴다. 무음 스위치가 켜져도 재생은 `played` 로 끝난다(실기기 확인 필요).

**사양.** `AMENDMENTS-AUDIO-CLIPS.md` 에 절 추가 또는 `AMENDMENTS-AUDIO-CANT-HEAR.md`.

| 행 | 모델 | 내용 |
|---|---|---|
| CH-0 | Opus 5.5 | 사양 + 와이어프레임 |
| CH-1 | Sonnet 5.5 | 스피커 줄의 "Can't hear it?" 진입점과 "Show the letters" 토글 |

**설계.** iOS 는 무음 스위치 상태를 직접 읽는 공식 API 가 없다. 그래서 감지하지 않고 **항상 닿는 출구**를 둔다.
- 스피커 버튼 옆에 작은 "Can't hear it?" (첫 miss 뒤 또는 replay 2회 뒤에 나타남. 조건은 사양에서).
- 누르면: 플랫폼별 한 줄 안내(iOS: 무음 스위치와 볼륨, Android: 미디어 볼륨, 웹: 탭 음소거) + "Show the letters" 버튼. 후자는 그 라운드의 프롬프트 상태를 `text` 로 바꾼다(`promptReducer` 에 `'show_text'` 이벤트 추가).
- 이 토글은 농인·난청 학습자의 게임 안 텍스트 전환(리뷰 접근성 #14)도 겸한다. 프로필 설정으로 기억할지는 사양에서 정한다.
- 안내 문구는 `logic/audio/voice-help.ts:56` 과 같은 방식으로 `Platform.OS` 로 걸러, 해당 OS 줄만 보인다(같은 파일의 기존 시트도 이번에 필터링: 리뷰 모바일 P2-22).

**테스트.** `promptReducer`: `show_text` → `phase: 'text'`, 이후 `played` 가 와도 텍스트 유지(기존 규칙과 동일). 화면: 조건 충족 시 진입점이 보이고, 누르면 텍스트 프롬프트가 뜬다.

**수용 기준.** **[실기기]** iPhone 무음 스위치를 켠 채 Match Sound 를 열어 두 번 안에 텍스트 프롬프트에 도달할 수 있다.

**하지 말 것.** `PLAY_IN_SILENT_MODE` 를 바꾸지 않는다(오너 결정). 무음 감지를 위한 네이티브 모듈을 새로 넣지 않는다.

**예상.** 0.5d + 0.75d.

---

## WO-06 미니게임에서 실수로 나가지 않게

**목표.** 게임 중 뒤로가기(헤더 X, Android back, iOS edge swipe)가 확인 없이 진행을 버리지 않는다.

**근거.**
- 확인: `apps/mobile/src/navigation/root.tsx:165` 의 `Minigame` 화면에 `gestureEnabled` 가 없다. `:169-178`, `:208` 의 평가 화면들은 `gestureEnabled: false`.
- 보고: `apps/mobile/src/navigation/screen-header-variants.ts:62` `Minigame: 'close'`. `apps/mobile/src/screens/minigames/MinigameScreen.tsx:88, 143-155` — step 별 key 로 remount, back 은 `navigation.goBack()`. `useRouteBackGuard` 를 쓰는 게임은 `StoryCheckGame.tsx` 하나.
- 보고: 공통 가드 `apps/mobile/src/screens/use-back-guard.ts:26-40`.

**사양.** `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` (WO-07 과 한 파일. 행을 나눈다).

| 행 | 모델 | 내용 |
|---|---|---|
| LR-0 | Opus 5.5 | 사양(WO-06 + WO-07 공통) + 와이어프레임 |
| LR-1 | Sonnet 5.5 | `Minigame` route 에 `gestureEnabled: false` + `useRouteBackGuard` |

**설계.** 답을 하나도 하지 않았으면 그냥 나간다. 하나라도 했으면 확인 시트: 제목 "Keep playing?", 버튼 "Keep playing"(기본, 먼저) / "Leave". 문구는 사전에. 시트는 네이티브에서도 앱의 `ConfirmSheet` 를 쓴다(WO-37 의 CS 행이 선행이면 그걸 쓰고, 아니면 현재 `platform/dialog.ts` 를 쓰되 `destructive` 는 넣지 않는다).

**테스트.** 답 0개 → back 이 바로 나감. 답 1개 이상 → 시트가 뜨고 "Keep playing" 이면 라운드 인덱스가 유지됨. Android hardware back, 헤더 X 모두 같은 가드를 탄다.

**수용 기준.** 세 가지 back 경로가 같은 동작을 한다. **[실기기]** iOS 왼쪽 edge swipe 로 게임이 닫히지 않는다.

**예상.** 0.5d (사양은 WO-07 과 공유).

---

## WO-07 퀘스트와 긴 평가를 이어서 하기

**선행.** WO-06 의 LR-0.

**목표.** 퀘스트, Hangul Check, Stage Check 가 앱 종료나 전화 뒤에 이어진다. 저장 실패는 성공 화면으로 가리지 않는다.

**근거.**
- 보고: `apps/mobile/src/screens/quest/QuestPlayerView.tsx:126` "run kept in quest-run-store (memory only)", `:306-323` leave 가 run 을 reset. 문구 `learner.ts:712-717` "Stars from this try will not be saved."
- 보고: `apps/mobile/src/store/review-run-store.ts:6` "Ephemeral: it persists nothing". `screens/reviews/StageReviewScreen.tsx:160-161`.
- 보고: `screens/reviews/DailyReviewScreen.tsx:299-301, 456-465` 와 `screens/stage-check/StageCheckScreen.tsx:167` 가 저장 실패 시 "All refreshed today" 로 간다. 올바른 예 `screens/cell-check/CellCheckScreen.tsx:168, 180-188`(`failed` phase + Try again).
- 이미 재개되는 것: 스토리(bookmark), 레벨 체크(저장된 run). 그 구현을 본보기로 삼는다.

| 행 | 모델 | 내용 |
|---|---|---|
| LR-2 | Opus 5.5 | 퀘스트 run 저장·복원 (`quest-run-store`), Home hero "Continue" |
| LR-3 | Sonnet 5.5 | Hangul Check / Stage Check: 청크 사이 저장과 Continue |
| LR-4 | Sonnet 5.5 | Daily Review / Stage Check 저장 실패 → `failed` phase + Try again |
| LR-5 | Sonnet 5.5 | leave 시트 문구를 실제 동작에 맞춤 |

**사양이 정해야 할 것 (LR-0).**
1. 저장하는 것: `questId`, `stepIndex`, 첫 시도 기록(`tries`, `missed`), 시작 시각. 게임 **안**의 라운드 인덱스는 저장하지 않는다(단계 단위 재개). 이유: 게임 상태는 종류마다 달라 범위가 커진다.
2. 수명: 같은 프로필, 24시간(또는 다음 날 첫 실행까지). 지나면 조용히 버린다. 퀘스트 콘텐츠 버전이 바뀌면 버린다.
3. 첫 시도 채점과의 정합: 재개 뒤 이미 채점된 라운드는 다시 채점하지 않는다(`logic/first-try.ts`, `logic/round-keys.ts`).
4. Home: 저장된 run 이 있으면 hero 버튼이 "Continue". 처음부터 하는 길도 남긴다(확인 시트 안).
5. 저장 위치는 진도와 다른 키. WO-01 의 읽기 계약을 쓴다(읽기 실패 → 재개 없음, 진도에는 영향 없음).
6. LR-5 문구: 재개가 있으면 "You can keep going later.", 없는 화면은 "Next time you start from the beginning." 사실과 다른 문구를 남기지 않는다.

**테스트.** store: step 3 에서 저장 → 새 인스턴스 hydrate → step 3, 첫 시도 기록 유지. 24시간 경과 → 없음. Daily Review: 저장 mock 실패 → `failed` 화면, 답 유지, Try again 성공 → 완료 화면.

**수용 기준.** 6단계 중 5단계에서 앱을 강제 종료하고 다시 열면 Home 에 Continue 가 있고 5단계로 돌아간다. 저장 실패 시 "All refreshed" 가 보이지 않는다.

**하지 말 것.** 재개 때문에 별 계산 규칙을 바꾸지 않는다. 게임 내부 상태까지 저장하려고 범위를 넓히지 않는다.

**예상.** 사양 0.75d, 구현 2.5d.

---

## WO-08 CI 에 접근성 검사를 넣는다

**목표.** WO-04 류의 회귀가 CI 에서 걸린다.

**근거.**
- 확인: `apps/mobile/package.json:13`, `apps/web/package.json:10`, `packages/design-system/package.json:45` 의 `lint` 가 `echo '(no lint yet …)'`.
- 보고: ESLint 설정 파일 없음, axe 계열 0건, `.github/workflows/ci.yml:65` 의 `turbo run lint` 가 no-op. Playwright 는 `web-app.yml` 에서 이미 돈다.

**사양.** `F-A11Y-001` 에 행 추가(WO-04 와 같은 파일) 또는 `F-COV-001` 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| AC-0 | Opus 5.5 | 사양: 규칙 세트, 기준선(baseline) 방식, 실패 조건 |
| AC-1 | Sonnet 5.5 | Playwright + `@axe-core/playwright` 스모크 (학습자 PWA) |
| AC-2 | Sonnet 5.5 | 사이트·콘솔 axe 스모크 |
| AC-3 | Sonnet 5.5 | ESLint 도입: `eslint-plugin-jsx-a11y`(apps/web), `eslint-plugin-react-native-a11y`(mobile, design-system) |

**결정 사항.**
- **새 의존성 추가는 오너 승인 사항**이다. AC-0 에서 패키지와 버전을 적어 승인받는다.
- 처음부터 0건을 요구하지 않는다. AC-1/2 는 현재 위반을 기준선 파일로 고정하고 "새 위반만 실패". WO-04, WO-40, WO-41 이 머지될 때마다 기준선을 줄인다.
- axe 스모크 대상(권고): Home, 퀘스트 Discover, Match Sound 1라운드, Culture Quiz 정답 직후, PIN 입력, 콘솔 로그인, 교사 반 페이지.
- ESLint 는 a11y 규칙만 켠다. 스타일 규칙을 함께 넣어 수백 건을 만들지 않는다. 기존 위반은 규칙별 `warn` 으로 시작해 사양에 적은 날짜에 `error` 로 올린다.

**수용 기준.** 일부러 `accessibilityLabel` 없는 버튼을 넣은 브랜치에서 CI 가 실패한다. `main` 은 통과한다.

**하지 말 것.** 기존 위반을 `eslint-disable` 로 덮지 않는다.

**예상.** 1.5d.

---

## WO-09 수업 화면에서 학습자별 약점이 보이지 않게 (우선 조치)

Phase 4 의 WO-30 을 앞당겨 한다. 내용은 `phase-4-console-site.md` 의 WO-30 을 본다. 이유: 반 화면을 프로젝터에 띄우면 학습자별 "다시 볼 글자"가 함께 보여 공개 비교 금지 규칙에 닿는다. 다른 Phase 1 항목과 파일이 겹치지 않아 병렬로 할 수 있다.
