# Claude Code Routines 활용 계획 v1
## "매일 자동 개발"의 현실과 실용적 로드맵

> **선행 문서**: 1인개발_워크플로우 v1
> **이 문서가 다루는 것**: Claude Code Routines를 이 프로젝트에 어떻게 언제 어떤 범위에서 도입할지
> **버전**: v1.0
> **기준일**: 2026.04 (Routines 출시 후 1주차)

---

## 0. 먼저 정직하게 말하고 시작

사용자 요청은 "Routine으로 매일 자동 개발 및 반영"이에요. 이게 **이상적인 목표**이지만, 지금 단계에서 그대로 구현하면 세 가지 문제가 생겨요:

**문제 1: 프로젝트가 아직 Routine에 맡길 수 없는 상태**
- 저장소도 없고, CLAUDE.md도 없고, 테스트도 없고, 코딩 컨벤션도 없음
- Routine은 "잘 정돈된 저장소를 돌리는 도구"지 "0에서 1을 만드는 도구"가 아님
- 불안정한 코드베이스에 자동 커밋 풀면 엉킴의 속도만 빨라짐

**문제 2: 할당량 충돌**
- Pro 플랜 Routine 자동 실행은 일 5회. 인터랙티브 세션과 **같은 구독 한도를 공유**
- 현재처럼 본인이 적극적으로 Claude Code를 쓰는 초기 단계에서 Routine이 한도를 가져가면 본인 작업이 막힘
- 안 쓸 때(밤·주말)에 돌리면 해결되는데, 그것도 의미 있는 결과물이 나오려면 프롬프트가 잘 다듬어져 있어야 함

**문제 3: "자동 개발"의 실제 가능 범위가 제한적**
- Routine이 가장 잘하는 건 **반복 작업·검증·기계적 변환**
- 새 기능 설계·복잡한 의사결정은 여전히 본인이 주도해야 함
- "매일 자동으로 기능이 추가되는" 마법은 기대하면 실망

그럼에도 불구하고 Routine은 **이 프로젝트에 매우 유용한 도구**예요. 단지 "매일 자동 개발"보다는 **"매일 자동 유지·보조·검증"**으로 포지셔닝하면 진짜 힘을 발휘해요. 이 문서는 그 방향으로 설계합니다.

---

## 1. Claude Code Routines 사실 체크

### 1.1 기능 개요
- Anthropic 관리 클라우드에서 실행되는 저장된 Claude Code 작업. 프롬프트, 하나 이상의 저장소, 커넥터 세트를 묶어 자동 실행
- 본인 기기 꺼져 있어도 실행됨
- 출시일: 2026년 4월 14일, 현재 리서치 프리뷰 단계

### 1.2 트리거 3종

| 트리거 | 설명 | 우리 용도 |
|---|---|---|
| **Schedule** | 시계 기반 반복 (매시/매일/평일/매주 + cron) | 야간 유지 작업 |
| **API** | HTTP POST로 외부에서 호출 | 모니터링·알림 연계 |
| **GitHub** | PR·release 등 repo 이벤트 | 자동 PR 리뷰·검증 |

### 1.3 할당량과 제약

- **자동 실행 한도**: Pro 일 5회 / Max 일 15회 / Team·Enterprise 일 25회
- 수동 실행("Run now" 버튼)은 한도에서 제외되고 인터랙티브 세션처럼 취급됨
- 토큰 소비는 인터랙티브 세션과 같은 구독 한도를 공유
- 기본적으로 `claude/` 접두 브랜치에만 푸시 가능 — 메인 브랜치 보호 장치
- cron 표현식은 시간당 1회보다 자주 실행 불가 (거부됨)

### 1.4 이전 기능과의 관계
- 기존 `/schedule` CLI 명령은 Routine으로 자동 이관
- CLI에서 `/schedule list/update/run`으로 관리 가능
- 웹 `claude.ai/code/routines`에서도 관리

### 1.5 관련 있지만 다른 개념들

| 이름 | 어디서 | 언제 쓰나 |
|---|---|---|
| **Routine** | 클라우드 | 자동 반복 실행 (이 문서 주제) |
| **Desktop scheduled task** | 로컬 Mac | 앱 열려있을 때만, 지금은 덜 중요 |
| **`/loop`** | CLI 세션 안 | 세션 중 반복 (세션 종료시 소멸) |
| **Skill** | 저장소 내 | 재사용 가능한 프로세스 문서 |

우리는 **Routine** (클라우드 자동)만 집중.

---

## 2. 우리 프로젝트에 Routine을 도입하는 4단계

Routine 도입을 "지금 당장 전부"가 아니라 **프로젝트 성숙도에 맞춰 점진적으로** 확장하는 계획.

### Phase 0: Routine 없이 기초 다지기 (지금 ~ Week 2)

**목표**: Routine이 "믿고 맡길 수 있는 환경" 구축

- GitHub 저장소 생성
- CLAUDE.md 완성
- 최소한의 테스트 구축 (lint·타입 체크는 반드시)
- 첫 커밋·첫 PR 흐름 확립
- 본인 개발 리듬이 안정된 후 다음 단계

**왜 이 단계가 필요한가**: Routine이 만드는 PR을 본인이 판단할 수 있어야 하고, CI가 통과/실패를 알려줘야 하며, 롤백이 가능해야 함. 이 기초 없이 Routine 도입하면 "무엇이 잘못됐는지 모르는" 상태가 됨.

### Phase 1: 안전한 Routine부터 (Week 3 ~ Week 6)

**목표**: **코드를 건드리지 않는** Routine부터 시작. 읽기·보고·알림 위주.

이 단계 Routine 3~4개:

**R1. Daily Standup Report** (매일 오전 7시)
- 지난 24시간 커밋·PR·이슈 읽어서 Slack·이메일로 요약
- 본인은 아침 15분 계획 세울 때 이 리포트 기반
- 코드 변경 없음, 읽기만

**R2. Content Validation** (매시)
- `content/` 디렉토리의 JSON들을 `validate-content.ts`로 검증
- 스키마 오류·출처 누락 등 발견 시 이슈 생성
- 코드 변경 없음, 검증만

**R3. Weekly Docs Sync** (매주 월요일)
- `docs/specs/`와 실제 코드·콘텐츠 사이의 drift 감지
- 예: 명세서엔 있지만 구현 안 된 기능, 반대로 코드엔 있지만 문서 없는 것
- 이슈만 생성, 수정은 본인

**R4. License Compliance Check** (매주 금요일)
- `content/assets-license.csv`와 실제 사용된 자산 매핑 검증
- 공공누리 출처 표시 누락 감지
- 이슈만 생성

이 단계 Routine의 공통점:
- 모두 **읽기/보고**만 함
- 본인이 **의사결정 주체** 유지
- 실수해도 피해 없음
- 한도 소진: 일 4회 (Pro 5회 중 4개만 자동, 1개는 본인 수동 여유)

### Phase 2: 지원 작업 Routine (Week 6 ~ Month 3)

**목표**: **낮은 위험·높은 반복** 작업을 Routine에 위임

이 단계 Routine 추가:

**R5. PR Review Assistant** (GitHub trigger: PR opened)
- 본인이 PR 올리면 Routine이 리뷰 코멘트 생성
- 본인이 최종 판단, Routine은 "눈 하나 더"
- 타입 체크·테스트 통과 외에 스타일·의도 확인

**R6. Content Draft Generation** (수동 API 호출)
- 본인이 Episode 명세서를 `docs/specs/`에 올리면
- API 트리거로 Routine 실행 → Quest JSON 3개 초안 생성
- `claude/content-draft-<episode-id>` 브랜치로 PR 생성
- 본인이 검토·수정 후 merge

**R7. TTS Generation** (스케줄: 매일 밤)
- 새로 추가된 콘텐츠의 음성 클립을 자동 생성 (Naver Clova 연동)
- R2에 업로드 + 콘텐츠 JSON 참조 업데이트
- PR 생성

**R8. Translation Sync** (수동 또는 PR 머지 시)
- 영어 UI 문자열이 추가되면 다국어 초안 생성 (추후)

이 단계부터는 Routine이 **PR을 만듭니다**. 다만:
- 모든 PR은 본인 승인 후 merge
- `claude/` 접두 브랜치로만 가는 기본 가드레일 활용
- 이상 동작 시 즉시 비활성화

### Phase 3: 관측·자가 개선 Routine (Month 3 이후)

**목표**: 제품 운영 지원 자동화

- **R9. User Feedback Digest**: 베타 사용자 피드백 수집·분류
- **R10. Error Pattern Analysis**: Sentry 에러 로그에서 패턴 찾기
- **R11. Retention Report**: 주간 지표 자동 리포트
- **R12. Staging Deploy Verification**: 배포 후 smoke test

이 단계는 MVP 출시 후.

### Phase 4: 진짜 "자동 개발" (Month 6+ 시점 재평가)

진짜 자동 기능 추가·버그 수정까지 Routine에 맡기는 건 **프로젝트가 다음 조건을 만족할 때**:

- 테스트 커버리지 70%+ (Routine 변경을 CI가 검증)
- 안정적 CI/CD (통과/실패 자동 감지)
- 최소 3개월 제품 운영 경험 (패턴 파악 완료)
- 본인이 Routine의 출력을 리뷰만 해도 되는 리듬 확립

조건 만족 시:
- **R-auto-bug**: Sentry에서 에러 잡히면 Routine이 원인 분석·수정 PR 초안
- **R-auto-refactor**: 매주 한 번 중복 코드·복잡도 핫스팟 자동 리팩토링 PR
- **R-auto-content**: 콘텐츠 템플릿에 맞춰 자동 Episode 생성 (검증 포함)

**중요**: 이 단계도 여전히 "자동 병합"이 아니라 "자동 PR → 인간 승인"이 기본.

---

## 3. "매일 자동 개발" 포지셔닝 재정의

사용자가 원한 그림과 현실 사이의 거리를 좁히기 위해 포지셔닝을 명확히:

### 3.1 "자동 개발"의 현실적 의미

**❌ 잘못된 기대**: 잠자는 동안 Claude가 새 기능을 알아서 만들고 본인은 아침에 확인만

**✅ 올바른 기대**: 본인이 주도하지만 Routine이 **반복·지루한 작업을 대신 해주는** 상태

구체적으로:

| 본인 담당 | Routine 담당 |
|---|---|
| 새 기능 설계·결정 | 기존 기능 검증 |
| 복잡한 디버깅 | 간단한 패턴 교정 |
| 콘텐츠 명세서 작성 | 명세서 → JSON 초안 변환 |
| UX 판단 | 스타일·린트 체크 |
| PR 최종 승인 | PR 리뷰 코멘트 초안 |

### 3.2 "매일 반영"의 실제 모습

하루 사이클은 이렇게 바뀝니다:

```
08:00  본인 일어남
       └─ 받은편지함: R1 Daily Standup Report
          "어제 merge 3건, 새 이슈 2건, 콘텐츠 검증 OK"

08:15  오늘 계획 (워크플로우 문서 참고)

09:00  본작업 시작
       └─ Episode 1.A1 Quest 2 작업

12:00  명세서 초안 완료 → API로 R6 트리거
       └─ Routine이 클라우드에서 JSON 생성 시작

13:00  점심 복귀, R6 완료 통보 확인
       └─ claude/content-draft-q2 PR 검토 → 수정 → merge

14:00  Match Sound 컴포넌트 리팩토링
       └─ PR 올림 → R5 (PR Review Assistant) 자동 실행
          리뷰 코멘트 받고 반영 → merge

18:00  하루 마무리, 커밋 정리

23:00  (본인 잘 때)
       └─ R7: 오늘 추가된 음성 스크립트 → TTS 생성 → PR
       └─ R3: (월요일이면) 문서 drift 검증

00:00  R1이 내일 아침 리포트 준비 시작
```

즉 Routine은 "본인이 못 하는 일을 대신"이 아니라 "본인이 하기엔 지루한 일을 뒤에서 돌리기".

### 3.3 왜 이 정도만 해도 혁명적인가

- **본인이 안 자고 컴퓨터 붙어 있을 필요 없음** — 시간 해방
- **실수 줄어듦** — 검증·린트·drift 자동 감지
- **반복 제거** — TTS·번역·스키마 검증 등
- **컨텍스트 유지** — 본인이 잊어도 Routine은 기억

이게 지속되면 **하루 체감 속도가 2배**가 돼요. "매일 자동 기능 추가"는 못 하지만, "매일 기능 추가하는 본인의 시간이 2배 남는" 효과.

---

## 4. 구체적 Routine 설계 (Phase 1·2 상세)

### 4.1 R1. Daily Standup Report

**목적**: 매일 아침 리포트로 계획 세우기 지원

**트리거**: Schedule — 매일 06:00 (본인 기상 1~2시간 전)

**프롬프트** (CLAUDE.md 참조 포함):
```
저장소 `@koreankids`를 읽고 지난 24시간 변경사항을 아래 형식으로 요약해줘.

## 어제의 커밋 (최대 10개)
- <해시> <메시지 1줄>

## 어제 merge된 PR
- #<번호> <제목>

## 새 이슈
- #<번호> <제목> (label)

## 진도 체크
- content/: 완료된 Episode / 진행 중 Episode / 다음 대상
- 미결 결정 (docs/ideas/에서): 3개

## 빨간 깃발
- CI 실패 이력, 오래된 PR, 3일+ 묵은 이슈

결과는 Markdown으로 내 이메일에 보내줘.
```

**연결 커넥터**: GitHub (저장소), Email (Resend)

**할당량 영향**: 일 1회

**ROI**: 매일 아침 15분 계획 세우기를 3분으로 단축

---

### 4.2 R2. Content Validation

**목적**: 콘텐츠 JSON 스키마·참조 무결성 자동 검증

**트리거**: Schedule — 매시 정각 (cron 제한 내 최고 빈도)

**프롬프트**:
```
저장소 `@koreankids`에서 다음 작업을 해줘.

1. `content/**/*.json` 모든 파일 읽기
2. `packages/content-schema/src/` 의 zod 스키마로 각 파일 검증
3. 참조 무결성 체크:
   - Quest 참조하는 minigame_id가 실제 미니게임 카탈로그에 있는가
   - Episode 참조하는 Heritage Card가 실제 카드 정의에 있는가
   - 음성·이미지 URL이 유효한가 (HEAD request)
4. 문제 발견 시 GitHub 이슈 생성 (label: content-validation)
5. 문제 없으면 아무것도 하지 않기

새 이슈는 기존 이슈와 중복되면 안 됨. 기존 열린 이슈 확인 후 진행.
```

**연결 커넥터**: GitHub

**할당량 영향**: 일 24회 — 이게 Pro 한도 5회를 넘음. **실제로는 매시 X, 매일 1~2회로 축소** 필요

**수정**: Schedule을 매 6시간 or 하루 2회로 조정

---

### 4.3 R5. PR Review Assistant

**목적**: 본인이 PR 올리면 리뷰 코멘트 자동 생성

**트리거**: GitHub — `pull_request.opened`, `pull_request.synchronize` (filter: author가 본인)

**프롬프트**:
```
PR 이벤트로 호출됨. PR 정보는 자동 제공됨.

다음을 수행해줘:

1. PR diff 읽기
2. 변경된 파일들이 프로젝트 컨벤션 (@CLAUDE.md, @docs/architecture.md)을 따르는지 확인
3. 놓친 것으로 보이는 것 체크:
   - 테스트 누락
   - TypeScript 타입 안전성
   - 문서 업데이트 필요 여부
   - design-system/tokens만 쓰고 있는가 (하드코딩 색상 금지)
4. 리뷰 코멘트 3~5개로 집중 (모든 라인 코멘트 말고)
5. 의견은 **제안** 톤으로, 최종 판단은 본인이 함을 존중

코멘트는 PR 자체에 남기기.
```

**연결 커넥터**: GitHub

**할당량 영향**: PR 수만큼. 하루 PR 2~3개면 여유

---

### 4.4 R6. Content Draft Generation

**목적**: Episode 명세서 → Quest JSON 초안 자동 생성

**트리거**: API — 본인이 명세서 작성 후 호출

**호출 방법**:
```bash
curl -X POST https://api.claude.com/v1/routines/<ROUTINE_ID>/runs \
  -H "Authorization: Bearer $ROUTINE_TOKEN" \
  -d '{"episode_id": "episode_1_a1"}'
```

**프롬프트**:
```
입력으로 받은 episode_id (예: episode_1_a1)에 대해:

1. `docs/specs/<episode_id>.md` 읽기
2. `packages/content-schema/src/quest.ts` 스키마 참조
3. `docs/미니게임_카탈로그.md` 에서 미니게임 ID 가져오기
4. 명세서에 따라 Quest 3개의 JSON 생성
5. `content/quests/` 에 파일 작성
6. `validate-content.ts` 로컬 실행해서 검증
7. 새 브랜치 `claude/content-<episode_id>` 생성
8. 커밋 메시지: `content: <episode_id> Quest 1-3 초안`
9. PR 생성, 설명에 체크리스트 포함

본인이 검토·수정 후 merge함. 자동 병합 금지.
```

**연결 커넥터**: GitHub

**할당량 영향**: 본인이 호출할 때만 (하루 0~2회)

---

### 4.5 R7. TTS Generation

**목적**: 새 스크립트 → 음성 파일 자동 생성

**트리거**: Schedule — 매일 23:00 (본인 잘 때)

**프롬프트**:
```
저장소에서 다음을 수행해줘.

1. `content/quests/**/*.json` 에서 음성 스크립트 모두 수집
2. 각 스크립트에 대해 `content/audio-index.json` 확인:
   - 이미 생성된 것은 skip
   - 새 스크립트만 대상
3. 새 스크립트 각각에 대해:
   - Naver Clova Dubbing API 호출 (음성 ID: 'vhyeri' 등)
   - 결과 mp3를 Cloudflare R2에 업로드
   - audio-index.json 업데이트
4. 변경사항을 `claude/tts-YYYYMMDD` 브랜치에 커밋
5. PR 생성

예산 체크: Clova 무료 월 한도 확인 후 초과 시 중단.
```

**연결 커넥터**: GitHub, Clova API (MCP 또는 직접)

**할당량 영향**: 일 1회

---

## 5. Routine 관리 원칙 (실패하지 않으려면)

### 5.1 Routine 라이프사이클

```
제안 (docs/ideas/routine-XX.md)
   ↓
7일 시험 운행 (수동 Run now로 검증)
   ↓
실 가동 (자동 스케줄)
   ↓
월 1회 점검
   ↓
(필요시) 비활성화 / 업데이트 / 삭제
```

### 5.2 안전장치 6가지

1. **메인 브랜치 보호 유지** — `claude/` 접두 기본 가드 활용, 해제 금지
2. **PR 자동 병합 금지** — 모든 Routine 출력은 본인 승인 필요
3. **Routine별 권한 최소화** — 읽기만 하면 되는 Routine에 쓰기 권한 주지 말기
4. **할당량 모니터링** — 주 1회 실제 소비량 체크
5. **이상 동작 감지** — Routine이 예상과 다른 파일 건드리면 즉시 비활성화
6. **docs/routines.md** — 모든 활성 Routine 목록을 Git에 문서화

### 5.3 할당량 현실적 분배 (Pro 플랜 5회/일 기준)

| Routine | 빈도 | 일 소비 |
|---|---|---|
| R1 Daily Standup | 매일 1회 | 1 |
| R2 Content Validation | 일 2회 | 2 |
| R5 PR Review | PR 수만큼 | 평균 1 |
| R7 TTS | 매일 1회 | 1 |
| **합계 (평균)** | | **5** |

→ R3·R4는 주간 단위로 유지
→ R6은 API 트리거라 위 합계에 포함 안 됨
→ **Pro 5회 꽉 찬 상태**. 여유 확보하려면 Max($100/월) 업그레이드 고려

### 5.4 할당량 압박 대응

- Phase 1 초기엔 Routine 3개만 돌리기
- 본인 활동이 많은 날은 일부 Routine 수동 비활성화
- 장기적으론 Max 플랜으로 이행 검토 (일 15회)

---

## 6. docs/routines.md 템플릿

Git에 저장할 Routine 목록 문서:

```markdown
# Active Routines

## R1. Daily Standup Report
- **ID**: routine_abc123
- **Trigger**: Schedule, daily 06:00 KST
- **Repos**: koreankids
- **Connectors**: GitHub, Resend
- **Output**: Email to dennyhwang@...
- **Started**: 2026-05-03
- **Last reviewed**: 2026-05-10
- **Status**: active
- **Notes**: 아침 계획 세우기용

## R2. Content Validation
...
```

이 문서가 있으면:
- 본인이 월 1회 점검 시 기준
- Claude 채팅에 "@docs/routines.md 참고" 할 수 있음
- 새 팀원·미래의 본인이 이해 가능

---

## 7. 단계별 체크리스트 (착수 가이드)

### Week 3 진입 시 (Phase 1 시작 조건)

- [ ] GitHub 저장소 존재
- [ ] CLAUDE.md 작성 완료
- [ ] 최소 10개 커밋 이상
- [ ] CI (lint + typecheck) 작동
- [ ] `content/` 디렉토리에 첫 JSON 스키마 정의
- [ ] Cloudflare 계정 + 배포 한 번 성공

### Week 3: R1 시작

- [ ] Claude Code에서 `/schedule` 명령 테스트
- [ ] R1 프롬프트 작성·저장
- [ ] 수동 Run now로 7일 시험
- [ ] 만족스러우면 스케줄 활성화
- [ ] docs/routines.md에 등록

### Week 4: R2 추가

- [ ] validate-content.ts 스크립트 완성
- [ ] R2 프롬프트 작성·시험 운행
- [ ] 문제 탐지 감도 조정

### Week 6: R5·R6 추가

- [ ] PR 리뷰 프롬프트 다듬기
- [ ] Content API 트리거 테스트
- [ ] Routine token 환경변수 관리

### Month 3: Phase 2 완성

- [ ] R7 (TTS) 안정화
- [ ] 할당량 소비 패턴 파악
- [ ] Max 플랜 업그레이드 여부 결정

---

## 8. 위험 시나리오와 대응

### 8.1 "Routine이 이상한 PR을 계속 만듦"
- 즉시 해당 Routine 비활성화 (`/schedule pause`)
- 만든 PR들 일괄 close
- 프롬프트 재설계 or Routine 삭제

### 8.2 "할당량 초과로 본인 작업이 차단됨"
- Routine 일시 정지 (주말만, 특정 Routine만 등)
- Max 플랜 일시 업그레이드 ($100/월)
- Routine 빈도 낮추기

### 8.3 "클라우드 Routine이 로컬 환경과 안 맞음"
- Routine 실행 환경은 본인 로컬과 다를 수 있음
- `setup_script`로 환경 맞추기 (Node/Python 버전 등)
- 잘 안 되면 GitHub Actions로 대체 고려

### 8.4 "Routine이 생성한 PR을 리뷰할 시간이 없음"
- 이게 지속되면 Routine이 짐이 됨 → 축소 필요
- 하루 리뷰 할당 시간 정하기 (예: 오후 1시 30분)
- 그 시간에 처리 못 한 Routine PR은 다음날로 (쌓이면 Routine 중단 신호)

---

## 9. 2개월 로드맵 (Routine 관점)

```
M1 W1-2: 기초 다지기 (Phase 0)
  · 저장소, CLAUDE.md, CI, 첫 커밋들
  · Routine 없음

M1 W3: Phase 1 시작
  · R1 (Daily Standup) 도입
  · 일 1회, 읽기만

M1 W4: Phase 1 확대
  · R2 (Content Validation) 추가
  · 일 2~3회 자동 실행

M2 W1: Phase 2 진입
  · R5 (PR Review) 추가
  · Routine이 처음으로 GitHub에 코멘트 씀

M2 W2-3: R6 (Content Draft)
  · Routine이 처음으로 PR 만듦
  · 본인 승인 후 merge 흐름 정착

M2 W4: R7 (TTS) + 리뷰
  · Phase 2 완성
  · 일 5회 꽉 찬 상태
  · Phase 3 진입 여부 결정
```

---

## 10. 결론: "자동 개발"의 우리 버전

사용자 원래 요청인 "Routine으로 매일 자동 개발·반영"을 이 프로젝트에 맞게 번역하면:

> **"매일 본인이 주도해서 설계·결정·개발하되, 검증·반복·리포트·변환 같은 기계적 작업은 Routine이 백그라운드에서 처리해 하루 체감 속도를 2배로"**

이게 1~3개월 안에 도달 가능한 현실.

**6개월 후 다시 이 문서를 열어** "Phase 4 진짜 자동 개발" 조건이 만족됐는지 평가. 그때가 되면 테스트 커버리지·CI 안정성·운영 경험이 누적되어 있을 테니 훨씬 공격적으로 자동화 가능.

---

## 11. 다음 즉시 할 것

1. **이 문서 읽고 Phase 0의 중요성 동의 여부 확인**
2. **저장소 생성·Sprint 1 착수** (워크플로우 문서 10.1절)
3. **W3 시작 시점 R1 Daily Standup 도입**
4. (선택) Claude Code 유료 플랜 확인 (Pro면 충분, 장기적 Max 검토)

---

*문서 버전 v1.0 — 2026.04.21*
*다음 업데이트: R1~R3 운행 2주 후 v1.1*
