# 2026-11 리뷰 기반 개선 계획

Status: proposal (오너 승인 전). 작성 2026-11-21, 기준 커밋 `5573e1072`; 같은 날 main `d5ba0217c`(#1033 – #1044) 에 맞춰 재확인했다. WO 마다 제목 아래 `> 재확인` 줄이 그 결과다(일부 완료·줄 이동·충돌). WO-01 – WO-03 은 사양 revision 3 이 최신 근거다.

이 폴더는 2026-11-21 리뷰(UX/UI·접근성, 한글 교육학)에서 나온 103건을 **집행 가능한 작업지시(Work Order, WO)** 로 바꾼 것이다. 계획은 Fable 5.2 가 세웠고, 각 WO 는 Sonnet 5.5 또는 Opus 5.5 세션이 이 폴더의 문서만 읽고 시작할 수 있게 썼다.

- 리뷰 전체 목록(오너 전용 페이지): https://claude.ai/artifact/3iRRqR1trEFYUN8eE2LGYx
- 이 문서는 계획이다. 코드는 한 줄도 바뀌지 않았다.

## 1. 폴더 구성

| 파일 | 내용 | WO |
|---|---|---|
| `README.md` | 순서, 오너 결정, 공통 규칙, 세션 시작 프롬프트 | — |
| `phase-1-safety.md` | 진도 유실, 숨은 타이머, 획순, 색만의 피드백, CI 접근성 검사 | WO-01 – WO-09 |
| `phase-2-hangul.md` | Stage 1 평가 타당도, 로마자, 변별 훈련, 콘텐츠 정확도, 레벨 체크 | WO-10 – WO-18 |
| `phase-3-upper-stages.md` | Stage 2–7 수준 표기, 높임법, 문법 설명, 이야기, 어휘, 말하기 | WO-19 – WO-27 |
| `phase-4-console-site.md` | 콘솔 타임아웃·입력 유실, 교실 화면, PIN 재설정, 사이트 | WO-28 – WO-34 |
| `phase-5-native-a11y.md` | 네이티브 첫 실행·플랫폼 기본기, 화면 다듬기, 접근성 P2 | WO-35 – WO-42 |

## 2. 순서와 이유

1. **Phase 1 을 먼저 끝낸다.** 여기 있는 것은 프로젝트 규칙을 실제로 어기는 항목이다: 얻은 것이 사라질 수 있음(WO-01), 문항별 실패 타이머(WO-02), 틀린 획순을 가르침(WO-03), 색만으로 주는 피드백(WO-04).
2. **Phase 2 는 "한글을 읽을 수 있다"를 참으로 만드는 일**이다. Stage 1 이 MVP 의 본체(CLAUDE.md §1)라서 Phase 3 보다 앞선다.
3. **Phase 3 은 콘텐츠 작업**이라 사람 검수(WO-27)와 오너 결정이 많이 걸린다. 결정이 필요 없는 WO-19, WO-20, WO-25 부터 한다.
4. **Phase 4, 5 는 Phase 1 과 병렬로 진행할 수 있다.** 서로 다른 파일을 만진다(§6 충돌 표).

각 Phase 안에서는 WO 번호 순서가 권장 순서다. `선행` 칸에 적힌 것만 실제 의존이다.

## 3. 모델 배정 기준

| 일의 성격 | 모델 | 이유 |
|---|---|---|
| 사양(F-XXX / AMENDMENTS) 작성, 여러 store·화면에 걸친 상태 변경, 접근성 구조 설계 | **Opus 5.5** | 기존 사양 92개와 충돌 없이 써야 하고 판단이 많다 |
| 한국어 학습 콘텐츠를 새로 쓰는 일(퀘스트, 미니 이야기, 문항), 교육학 판단이 드는 일 | **Opus 5.5** | 자연스러운 한국어와 단계 통제를 함께 봐야 한다 |
| 사양이 `ready` 인 구현 행(row), 기계적 일괄 수정, 테스트 추가, 문구 교정 | **Sonnet 5.5** | 수용 기준이 명확하고 양이 많다 |
| 시안(design pass) | **Opus 5.5** | CLAUDE.md §5: 에이전트 시안 허용, multi-agent review 로 승인 |

대부분의 WO 는 **사양 행(Opus) → 구현 행(Sonnet)** 두 단계다. WO 마다 행별 모델을 적었다. 구현 세션이 사양에 없는 결정을 만나면 추측하지 말고 멈춰서 보고한다.

## 4. 오너 결정이 필요한 것

이 결정들이 나기 전에는 해당 WO 의 사양을 `ready` 로 올릴 수 없다. 각 항목에 권고를 붙였다.

| ID | 결정할 것 | 권고 | 막히는 WO |
|---|---|---|---|
| OD-R1 | 로마자 기본 표시를 단계에 따라 줄일 것인가 (현재 전 단계 `always`. 단, 퀘스트 Check 선택지는 2026-11-15 오너 승인으로 이미 숨김 — AU-8, CLAUDE.md §1) | Stage 1 q11 부터 배운 글자만으로 된 읽기 단어는 `tap`, Word Builder 완료 후 기본 `tap`. Check 계열은 항상 숨김 | WO-10, WO-11 |
| OD-R2 | 글자 이름 우선 재생(AU-OD-1, 2026-10-29)을 유지하되 Discover 버튼 순서를 소리 먼저로 바꿀 것인가 | 바꾼다. 결정 자체는 유지, 사양의 옵션 B("one table change") 사용. AU-10 (#1035) 이후 Discover 가 열리면 글자 이름이 자동 재생되므로 더 급해졌다 | WO-13 |
| OD-R3 | 말하기 제외 결정(2026-10-10, `speaking-later.md`)을 유지할 것인가 | 유지하되 `speaking-later.md` 의 2번(어른이 확인하는 "같이 말하기")과 3번(honor-system Voice Echo)만 연다. 음성 수집·채점 없음 | WO-26 |
| OD-R4 | Stage 2–7 의 수준 표기를 A1 안팎으로 낮출 것인가 | 낮춘다. 스토어·학부모 문구에 A2/TOPIK 2급을 쓰지 않는다 | WO-19 |
| OD-R5 | 한국어 UI 에서 뜻풀이를 무엇으로 보여줄 것인가 | 그림 우선, 선택 시 en/es. 한국어 사전식 풀이는 보호자 도움말로. ko 는 이미 `'shipped'` 이므로 "16b 전" 조건은 지났다 — 가능한 한 빨리 결정 | WO-24 |
| OD-R6 | iOS 무음 스위치: 학습자가 직접 누른 재생은 무음에서도 낼 것인가 | 내지 않는다(2026-10-10 결정 유지). 대신 안내와 "글자로 보기"를 붙인다 | WO-05 |
| OD-R7 | 검증 가능한 부모 동의를 어느 시점에 받는가 (현재 콘솔 가입은 자기 선언 체크박스) | WO-34 의 조사 결과를 보고 결정. 법률 검토 필요. 2026-11-18 오너는 기본값 유지(FN-0 b/e: 서버 동의 기록 없음)로 사실상 보류했고, AU-1 이 개인정보처리방침에서 "verifiable" 을 뺐다. CLAUDE.md §1 은 아직 "verifiable parental consent" 를 약속하므로 둘 중 하나를 맞춰야 한다 | WO-34, WO-31 의 15번(가족 링크·QR) |
| OD-R8 | 간격 복습 계열 플래그(`currBuiltInPcts` 0%)의 출시 기준 | 운영 설정의 현재 값을 먼저 확인. 0% 라면 내부 프로필부터 단계적으로 | 없음(운영) |
| OD-R9 | Stage 1 종성 범위: 7종성 퀘스트를 Stage 1 에 넣을 것인가, 완료 문구를 낮출 것인가 | 문구 낮추기는 AU-15 (#1035) 가 끝냈다. 남은 것: 7종성 퀘스트를 Stage 2 앞에 추가(WO-15) | WO-15 |
| OD-R10 | 네이티브에 게스트 첫 레슨을 열 것인가 (현재 웹 전용) | 연다. 스토어 설치 사용자의 퍼널이 웹보다 길다 | WO-35 |
| OD-R11 | 한국어 교원 자격자 1회 통독(153퀘스트 + 이야기 210문장) | 진행한다. 모델이 대신할 수 없는 일이다 | WO-27 |

결정이 나면 이 표에 날짜와 결과를 적고, 해당 사양 머리말에 "owner decision YYYY-MM-DD" 로 인용한다.

## 5. 모든 WO 의 공통 규칙

집행 세션은 시작 전에 저장소 루트의 `CLAUDE.md` 를 읽는다. 아래는 그 규칙을 이 계획에 맞춰 풀어 쓴 것이다.

### 5.1 순서 (건너뛰지 않는다)

1. **인용 재확인.** WO 의 `근거` 에 적힌 `파일:줄` 을 모두 열어 읽는다. 이 계획의 인용 중 직접 재확인된 것은 일부다(WO 마다 `확인` 표시). 줄이 옮겨졌으면 사양에는 새 줄을 적는다. 인용이 사실과 다르면 **구현하지 말고** 그 사실을 보고한다.
2. **사양.** `docs/specs/` 에 WO 가 지정한 파일을 쓴다. 기존 사양을 바꾸는 일은 `AMENDMENTS-<TOPIC>.md`, 새 기능은 `F-<AREA>-<NNN>-<slug>.md`. 구성은 `docs/specs/README.md` 의 템플릿 8개 섹션을 따르고, 행(row) 단위 PR 표를 둔다. 수정되는 기존 사양 머리말에는 "Amended YYYY-MM-DD by …" 한 줄을 넣는다. `draft` → multi-agent review → `ready`.
3. **와이어프레임 → 시안.** UI 가 바뀌는 WO 는 `design/wireframes/` → `design/screens/` 또는 `design/components/` 를 거친다. 에이전트가 만든 시안은 multi-agent review 로 승인한다(CLAUDE.md §5).
4. **TDD.** 실패하는 테스트를 먼저 쓰고 구현한다. 한 커밋 = 테스트 + 구현. 비즈니스 로직은 `apps/mobile/src/logic/`, 플랫폼 의존 코드는 `apps/mobile/src/platform/`.
5. **PR.** `main` 직접 push 금지. 브랜치는 `fix/<slug>`, `feat/<slug>`, `content/<id>`, `design/<sprint>`, `ci/<slug>`. 제목은 Conventional Commits. 본문에 사양 링크, 테스트 출력, 커버리지 델타, UI 는 스크린샷.
6. **마무리.** multi-agent review 를 돌리고, 사양 상태를 갱신하고, `docs/specs/README.md` 인덱스에 한 줄을 넣는다.

### 5.2 코드 규칙

- TypeScript strict. `any` 금지(`unknown` + 내로잉).
- 스타일은 `packages/design-system` 토큰만. 색 리터럴 금지.
- UI 문자열은 `packages/i18n/src/messages/en/*.ts` 에 영어로 넣는다(같은 PR). es/ko 는 R8 번역 PR 이 맡는다. 영어는 CEFR Pre-A1 수준으로 짧게.
- 가르치는 한국어에는 항상 로마자와 UI 언어 gloss 가 붙는다. 로마자를 "숨긴다"는 WO 도 데이터에서 지우는 것이 아니라 화면 표시 방식을 바꾸는 것이다.
- 저장소는 래퍼만: 앱은 `apps/mobile/src/platform/storage(.web).ts`, 웹은 `apps/web/src/lib/i18n/safe-storage.ts`.
- `console.log` 금지. telemetry 이름은 `TELEMETRY_EVENT_NAMES` 와 `docs/roadmap/TELEMETRY-NAMES-2.md` 에 맞춘다.
- `--no-verify`, `--force` 금지. WO 가 지정하지 않은 파일은 고치지 않는다.

### 5.3 반-수치심 규칙 (모든 UI 변경에 적용)

- 학습자의 miss 에 `colors.feedback.danger` 를 쓰지 않는다. amber(`colors.feedback.nudge`) 와 Hoya `thinking`.
- 미터는 줄지 않는다. 얻은 별·카드는 빼앗지 않는다.
- 문항별 실패 타이머 없음. 시간이 끝나도 항목을 틀리게 만들지 않는다.
- 학습자 간 비교·순위 없음.

### 5.4 보고

"테스트 없는 다 됐어요" 금지. PR 과 세션 마지막 보고에 실제 실행한 명령과 출력을 붙인다. 실기기나 스크린리더로 확인하지 못한 것은 "확인 불가"로 적는다. 이 계획의 `수용 기준` 중 실기기가 필요한 항목은 **[실기기]** 로 표시했고 오너가 확인한다.

## 6. 같은 파일을 만지는 WO (직렬로 머지)

| 파일 | WO |
|---|---|
| `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx` | WO-02, WO-03, WO-14 |
| `apps/mobile/src/screens/minigames/CultureQuizGame.tsx`, `TapRespondGame.tsx`, `CardMatchGame.tsx`, `MatchSoundGame.tsx` | WO-04, WO-06, WO-40, WO-41(#6: `MatchSoundGame`, `TraceStrokeGame`) |
| `apps/mobile/src/store/progress-store.ts`, `profile-store.ts`, `App.tsx` | WO-01, WO-37(foreground sync) |
| `apps/mobile/src/screens/quest/QuestPlayerView.tsx`, `store/quest-run-store.ts`, `store/quest-run-saved.ts`, `logic/quest-flow/saved-run.ts`, `check-launcher.ts`, `StepActions.tsx` | WO-06, WO-07, WO-38(launcher) |
| `apps/mobile/src/screens/quest/DiscoverStep.tsx`, `logic/stage1/discover-flow.ts` | WO-12(#13), WO-13, WO-14(b) |
| `apps/mobile/src/logic/audio/sound-pacing.ts`, `reply-advance.ts` | WO-04(결정 4), WO-41(#6) |
| `apps/mobile/src/logic/minigame-config.ts`, `content/quests.ts` | WO-11, WO-12, WO-13, WO-14, WO-15 |
| `apps/mobile/src/content/jamo.ts`, `content/episodes/stage-1/jamo.json` | WO-12 |
| `packages/design-system/src/components/KoreanText/`, `Heading/`, `Tile/`(`style.ts` 포함), `HoyaBubble/` | WO-39, WO-40, WO-41 (WO-04 의 AF-5 는 AU-17a 로 완료) |
| `packages/design-system/src/tokens.ts`, `__tests__/contrast.test.ts`, `design/tokens/` | WO-41 (token sync CI 가 검사) |
| `apps/web/src/app/(console)/teach/space/plan/page.tsx` | WO-28, WO-29 |
| `apps/web/src/app/(console)/teach/space/page.tsx` | WO-30, WO-31 |
| `packages/i18n/src/messages/en/learner.ts`, `console.ts` | 거의 모든 UI WO. 충돌은 기계적으로 리베이스 |

## 7. 세션 시작 프롬프트

오너가 집행 세션에 그대로 붙여 넣는다. `<…>` 만 바꾼다.

```
저장소 루트의 CLAUDE.md 와 docs/roadmap/review-2026-11/README.md 를 먼저 읽어라.
그다음 docs/roadmap/review-2026-11/<phase 파일> 의 <WO-NN> 을 읽고, 그 WO 의 <행 ID> 만 수행하라.

지켜야 할 것:
1. README §5.1 의 순서를 건너뛰지 마라. 먼저 WO 의 근거에 적힌 파일:줄을 모두 열어 읽고,
   사실과 다르면 구현하지 말고 무엇이 다른지 보고하라.
2. 사양이 ready 가 아니면 코드를 쓰지 마라. 이 행이 사양 행이면 사양만 쓰고 멈춰라.
3. WO 의 "하지 말 것"과 README §5.2, §5.3 을 지켜라. 지정되지 않은 파일은 고치지 마라.
4. 테스트를 먼저 써라. 끝나면 실행한 명령과 출력을 그대로 보여라.
5. 사양이나 WO 에 없는 결정이 필요하면 추측하지 말고 선택지와 권고를 적어 멈춰라.
6. <브랜치 이름> 브랜치에서 작업하고, 커밋과 PR 은 내가 요청할 때만 만들어라.
```

## 8. 이 계획에 넣지 않은 것

- 리뷰가 보지 못한 범위(리뷰 목록의 "보지 못한 것")는 WO 가 없다. 미니게임 나머지 약 15종의 정독, 스페인어 번역 품질, 실기기 스크린리더 점검은 별도 리뷰가 필요하다.
- `docs/tasks/INBOX.md` 에는 아무것도 넣지 않았다. R1 이 매일 맨 위 항목을 자동으로 집어가므로, 어떤 WO 를 언제 넣을지는 오너가 정한다. 넣을 때의 형식은 `- [ ] T-XXX <사양 링크> WO-NN <행> <요약> — <예상 시간>`.
- 예상 시간은 모델 세션 기준의 대략값이다. 사람 검수와 오너 결정 대기 시간은 들어 있지 않다.
