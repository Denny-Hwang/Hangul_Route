# 1인 개발 워크플로우 설계 v1
## Claude 생태계로 어린이 한국어 앱 만들기

> **목적**: 1인 개발자가 Claude Code, Claude Design, GitHub, 그리고 UX/UI 결정을 어떻게 하루·한 주 리듬으로 엮을지 구체적 설계.
>
> **전제**: 본인 1명 + Claude 구독 + GitHub + Cloudflare 스택. 외주·팀원 없음.
> **버전**: v1.0
> **기준일**: 2026.04
> **특성**: 이 문서는 "이상적 워크플로우"가 아니라 "2주 써보고 수정할 초안". 실제 사용 피드백으로 v2 갱신 예정.

---

## 0. 워크플로우 설계의 출발 질문

1인 개발에서 가장 위험한 건 "무한히 가능해 보이는 Claude의 속도에 홀려 모든 걸 동시에 벌여놓고 아무것도 끝내지 못하는 것".

그래서 워크플로우가 답해야 할 질문은:
1. **오늘 뭘 해야 하는지** 매일 아침 30초 안에 알 수 있는가?
2. **어제 뭘 했는지** 1주일 뒤에도 재현 가능한가?
3. **Claude가 엉뚱한 방향으로 가는 걸** 어떻게 빨리 감지·복구하는가?
4. **맥락(context)**이 Claude에 일관되게 전달되는가?
5. **디자인·코드·콘텐츠** 세 트랙이 서로 어긋나지 않는가?

이 질문 5개를 하나씩 풀어가는 구조로 설계했어요.

---

## 1. 도구 역할 분담 (Who Does What)

### 1.1 도구별 책임 영역

| 도구 | 주 담당 | 부 담당 | 하지 않음 |
|---|---|---|---|
| **Claude (채팅)** | 기획·전략·문서 작성 | 콘텐츠 JSON 초안 | 실제 코드 직접 실행 |
| **Claude Code** | 코드 작성·리팩토링·테스트 | 로컬 실행·디버깅 | 장기 기획 결정 |
| **Claude Design** | UI 시안·프로토타입 | 디자인 시스템 유지 | 최종 디자인 저장소 (Git이 역할) |
| **GitHub** | 단일 진실 원천 (Source of Truth) | CI/CD · 이슈 관리 | 기획 토론 (채팅 Claude가) |
| **Obsidian** (기존) | 개인 기획 노트·아이디어 | 주간 회고 | 공식 문서 (GitHub docs/에) |
| **Cloudflare** | 호스팅·DB·스토리지 | 분석·에러 추적 | - |

### 1.2 가장 중요한 원칙: Git이 Source of Truth

Claude Design·Claude Code·Claude 채팅 모두 **휘발성**이에요. 채팅은 며칠 뒤 사라지고, Design은 프리뷰 단계고, Code의 컨텍스트는 세션별로 리셋돼요. 

**결정·코드·디자인·콘텐츠의 최종 상태는 반드시 Git에 커밋**돼야 해요. Claude는 Git으로 들어가는 내용을 "생성"하는 도구로만 쓰고, 내용 자체는 Git이 가지고 있는 구조.

구체적으로:
- 기획 문서 → `docs/` 디렉토리에 .md로
- 코드 → 당연히 Git
- 디자인 시안 → Claude Design에서 내보내기(PNG·HTML) → `design/snapshots/`에 저장
- 콘텐츠 → `content/` 디렉토리에 JSON
- 아이디어·미결정 사항 → `docs/ideas/` 또는 Issues

"Claude Design 안에서 최신본 찾아야지" 같은 상황이 생기면 이미 망가진 거예요.

---

## 2. 저장소 구조 (Monorepo)

### 2.1 최상위 구조

```
hangul-route/
├── apps/
│   ├── mobile/              # Expo React Native (어린이 + 부모)
│   └── web/                 # Next.js (교사·Projection)
│
├── packages/
│   ├── backend/             # Cloudflare Workers
│   ├── design-system/       # 공유 컴포넌트·토큰
│   ├── content-schema/      # Content JSON 타입 정의 (zod)
│   └── shared-types/        # 백·프론트 공유 타입
│
├── content/                 # ★ 콘텐츠 저장소 (가장 자주 수정됨)
│   ├── stages/
│   │   └── stage_1/
│   │       ├── episode_1_a1.json
│   │       └── ...
│   ├── quests/
│   ├── minigames/
│   ├── characters/
│   ├── cards/               # Heritage Cards
│   └── assets/              # 이미지·오디오 참조 (실제 파일은 R2)
│
├── design/                  # ★ 디자인 아티팩트
│   ├── system/              # 디자인 토큰·컴포넌트 명세
│   │   ├── tokens.json
│   │   └── components.md
│   ├── snapshots/           # Claude Design 내보내기 (날짜별)
│   │   ├── 2026-04-20-onboarding-v1.png
│   │   └── ...
│   └── claude-design-prompts.md   # 프롬프트 히스토리
│
├── docs/                    # ★ 기획·의사결정 문서
│   ├── README.md            # 프로젝트 개요
│   ├── architecture.md      # 시스템 설계
│   ├── content-guide.md     # 콘텐츠 제작 가이드
│   ├── blueprints/          # 이미 작성한 v1·v2 블루프린트들
│   ├── specs/               # Episode·미니게임 명세서
│   ├── adr/                 # Architecture Decision Records
│   ├── ideas/               # 미정 아이디어
│   └── weekly/              # 주간 회고
│       └── 2026-w17.md
│
├── scripts/                 # 운영 스크립트
│   ├── validate-content.ts  # 콘텐츠 JSON 검증
│   └── generate-tts.ts      # TTS 자동 생성
│
├── .github/
│   └── workflows/           # CI/CD
│
├── CLAUDE.md                # ★ Claude Code 최상위 컨텍스트
├── AGENTS.md                # 에이전트 역할·프롬프트 정의
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 2.2 Git 브랜치 전략 (단순화)

1인 개발이니 복잡한 GitFlow 금지. 단순 규칙:

- **`main`**: 언제나 deploy 가능한 상태
- **`feat/<기능명>`**: 기능 단위 브랜치 (1~3일 안에 merge)
- **`content/<episode-id>`**: 콘텐츠 작업 브랜치
- **`design/<sprint>`**: 디자인 일괄 업데이트

PR은 본인이 리뷰 (Claude Code도 셀프 리뷰 코멘트 가능). 절대 `main`에 직접 push 금지 — CI 통과 확인용으로라도 PR 사용.

### 2.3 Commit 메시지 규칙 (Conventional Commits)

```
feat(mobile): Match Sound 미니게임 기본 구현
fix(backend): JWT 갱신 로직 누락
content(stage1): Episode 1.A1 Quest 1 초안
design(tokens): 색상 팔레트 집현전 테마 추가
docs(spec): Episode 명세서 템플릿 v1
chore: pnpm 업데이트
```

Claude Code에 "Conventional Commits 형식으로 커밋 메시지 작성해줘"라고 CLAUDE.md에 적어두면 자동화.

---

## 3. 하루 일과 (Daily Rhythm)

매일 반복되는 동작 템플릿. 본인 컨디션·일정에 맞게 조정.

### 3.1 아침 15분: 오늘 정하기

```
[1] 지난번 커밋 확인
    git log --oneline -10
    "어제 어디까지 했지?"

[2] 오늘의 목표 1~3개 선정
    Obsidian 또는 docs/weekly/에 한 줄씩
    · 오늘은 Episode 1.A1 Quest 1 JSON 완성
    · Match Sound 컴포넌트 Pic-Word Match로 확장
    · (선택) 디자인 시안 1개

[3] Claude 채팅 세션 시작
    "어제 이어서 한다. @docs/weekly/2026-w17.md 확인하고
     오늘 목표는 [...] 이야. 먼저 무엇부터 할까?"
```

### 3.2 본작업: 2~3시간 집중 블록

집중 블록은 한 종류 작업만 — **작업 전환 비용**이 가장 큰 적:
- 오전 블록: 코드 or 콘텐츠 중 하나
- 오후 블록: 다른 하나 또는 디자인

작업 전환 최소화를 위한 규칙:
- **코드 작업 중 떠오른 콘텐츠 아이디어** → `docs/ideas/TODO.md`에 한 줄 적고 즉시 돌아오기
- **디자인 작업 중 떠오른 코드 버그** → GitHub Issue로 만들고 즉시 돌아오기
- 새 Claude 세션 시작은 작업 전환 신호

### 3.3 저녁 10분: 오늘 정리

```
[1] 커밋 정리
    - 오늘 작업한 걸 의미 있는 단위로 커밋
    - 실험용 코드는 별도 WIP 브랜치에
    - 최소 3개 커밋 (느낌: 하루에 작은 PR 1개)

[2] 내일 첫 작업 적어두기 (1줄)
    docs/weekly/2026-w17.md 맨 아래
    "내일: Quest 2 시작 — 모음 ㅏ ㅓ"

[3] Claude 세션 마무리
    "오늘 작업 요약 한 문단 만들어줘. 내일 세션 시작할 때 붙여넣을게."
```

이 저녁 정리 10분이 **내일 아침 15분을 구원**해요.

---

## 4. 주간 리듬 (Weekly Rhythm)

하루 단위로는 일을 쫓아다니기 쉬워서, 주 단위로 방향 점검이 필수.

### 4.1 주간 템플릿 (docs/weekly/YYYY-wNN.md)

```markdown
# 2026 W17 (4/20 ~ 4/26)

## 이번 주 목표 (월요일 작성)
- [ ] Episode 1.A1 명세서 완성
- [ ] Match Sound 미니게임 프로토타입
- [ ] 공공누리 자료 5개 수집

## 일별 로그
### 4/20 (월)
- Episode 1.A1 Quest 1 JSON 초안 작성
- Claude Design에서 집현전 배경 시안 2개
- 커밋: abc123, def456

### 4/21 (화)
...

## 금요일 회고
### 했다
- ✅ Episode 1.A1 명세서 완성
- ✅ 자료 5개 수집

### 못 했다
- ❌ 미니게임 프로토타입 (Build a Letter 한글 조합 로직에서 막힘)

### 배운 것
- 한글 조합은 Hangul-Utils 라이브러리 쓰면 간단
- Claude Design의 주간 할당량 생각보다 넉넉 (약 40 프롬프트)

### 다음 주로 넘어가는 것
- Build a Letter 프로토타입
- Episode 1.A2 명세서 시작
```

### 4.2 주간 루틴

**월요일 아침 30분 — 계획**
- 지난 주 회고 훑어보기
- 이번 주 목표 3~5개 설정
- 주간 문서 새로 생성

**수요일 점심 10분 — 중간 점검**
- 진도 확인. 밀리면 범위 축소 결정
- "이번 주 3개 중 2개만 해도 OK" 선언 가능

**금요일 저녁 30분 — 회고**
- 했다/못 했다/배운 것/다음 주로 이월
- 다음 주 목표 초안

### 4.3 격주 Reflection (2주마다 토요일 1시간)

"내가 방향 잘 가고 있나?" 큰 질문:
- 격자 진도: Stage 1 5 Episode 중 N개 완료
- 사용자 베타 준비도 변화
- 축적되는 부채 (기술·콘텐츠) 점검
- 다음 2주 방향 조정

이건 Claude와 함께 하면 좋아요 — 문서·커밋·이슈를 보여주고 "객관적 피드백 줘"라고 요청.

---

## 5. 각 도구 다루기 (실무 상세)

### 5.1 Claude (채팅) — 기획·설계의 파트너

**언제 쓰나**
- 새로운 기능·구조 브레인스토밍
- 문서 작성·편집
- 콘텐츠 JSON 초안 생성
- 전략 질문 ("이 기능을 Phase 1에 넣어야 하나?")

**잘 쓰는 법**
- **세션 초반 컨텍스트 주입**: 매번 "이 프로젝트는 Hangul Route, 격자 구조로..." 붙여넣지 말고, **Project 기능**을 써서 핵심 문서를 상시 컨텍스트에 유지
- **Artifact로 문서 바로 다운로드**: 긴 문서는 artifact로 생성 → markdown 내려받아 GitHub commit
- **세션 끝에 요약 요청**: "오늘 대화 핵심을 3줄 요약해줘" → `docs/weekly/`에 붙여넣기

**피해야 할 함정**
- 코드를 채팅에서 길게 짜면 안 됨 → Claude Code에게 넘기기
- "모든 걸 한 세션에서 해결" → 주제별로 세션 분리
- 이전 대화 맥락이 휘발 → 중요한 결정은 Git에 즉시 저장

### 5.2 Claude Code — 코드 작업의 중심

**세션 시작 템플릿**
```
@CLAUDE.md 읽고 
@docs/specs/current-task.md 도 확인해줘.
오늘 작업: [구체적으로 한 문장]
제약: [어떤 파일만 건드릴지, 테스트 요구사항 등]
```

**잘 쓰는 법**
- **작은 단위 위임**: "이 기능 다 만들어줘" 말고 "이 컴포넌트의 props 타입부터 정의해줘"
- **테스트 우선 요청**: "먼저 테스트 케이스 보여주고 그 다음 구현해줘"
- **변경 범위 명시**: "apps/mobile/features/lesson/ 디렉토리만 건드려줘"
- **세션 끝에 요약 PR 설명 요청**: "이번 변경사항을 PR 설명으로 정리해줘"

**CLAUDE.md 핵심 내용 (예시)**
```markdown
# Hangul Route Monorepo

## 개요
어린이를 위한 한국어 학습 앱. Heritage Journey 테마.
상세: @docs/blueprints/ 참고.

## 디렉토리
- apps/mobile: Expo RN
- apps/web: Next.js
- packages/backend: Cloudflare Workers
- content: 학습 콘텐츠 JSON
- docs: 기획·명세서

## 코딩 규칙
- TypeScript strict
- 함수형 컴포넌트, hooks 만
- 상태는 zustand
- API는 tanstack/react-query
- 테스트는 vitest
- 스타일: design-system/tokens 만 사용

## 금지사항
- localStorage 직접 사용 (uservalidatedStorage 훅 통해서)
- any 타입
- console.log를 production 코드에 남기기

## 일반 작업 가이드
- 새 미니게임 추가: @docs/specs/minigame-template.md
- 새 Episode 추가: @docs/specs/episode-template.md
- 커밋: Conventional Commits, 한국어 OK

## 도움 받을 때
디자인 시안: @design/snapshots/
최신 이슈: @docs/weekly/ 최근 파일
```

**위험 신호 감지하기**
- Claude Code가 관련 없는 파일을 수정하기 시작 → 즉시 중단, 변경 되돌리기
- 같은 실수를 반복 → CLAUDE.md에 명시적 규칙 추가
- 테스트 없이 "다 됐어요" → "실제 실행한 결과 보여줘" 요청

### 5.3 Claude Design — UI 시안·프로토타입

**언제 쓰나**
- 새 화면 시안 빠르게 3~5개 만들기
- 디자인 시스템 초기 구축
- 프로토타입 → Claude Code 핸드오프

**잘 쓰는 법**
- **프로젝트 시작 시 디자인 시스템 업로드**: 앱 브랜드 가이드·토큰·이미 있는 컴포넌트 참조 파일을 Claude Design에 등록해서 일관성 확보
- **스크린샷 기반 변형**: 기존 화면 스크린샷 올리고 "집현전 버전으로 바꿔줘" 식으로 지시
- **웹 캡처 활용**: 우리 베타 웹 URL이 있으면 Claude Design이 실제 요소 읽어서 일관성 유지

**워크플로우 예시**
```
1. 채팅 Claude에서 와이어프레임 요구사항 정리
2. Claude Design 열기
3. 프롬프트: "이런 온보딩 화면을 집현전 테마로 3 시안 만들어줘"
4. 마음에 드는 시안 고르기 → 세부 조정
5. PNG·HTML로 내보내기
6. design/snapshots/에 날짜별로 저장 (손으로 Git에 커밋)
7. Claude Code로 핸드오프 번들 생성 → 구현
```

**주의사항 (현실적)**
- 리서치 프리뷰라 주간 할당량 있음. 20~40 프롬프트 정도가 일반적. 소진하면 한 주 기다리거나 다음 주 계획
- 협업 기능은 기본 수준 — 1인 개발에선 문제 없음
- 복잡한 애니메이션·인터랙션은 Claude Design 결과만으론 부족 → Lottie·Rive를 별도로
- **중요**: 내보낸 코드/이미지를 Git에 저장하지 않으면 사라질 수 있음

**Claude Design 프롬프트 히스토리 관리**
```
design/claude-design-prompts.md

## 2026-04-20 온보딩 시안
프롬프트: "...."
결과: @design/snapshots/2026-04-20-onboarding-v1.png
평가: 3시안 중 2번이 좋음. 색감만 따뜻하게 조정 필요.

## 2026-04-22 홈 화면 시안
...
```

이 히스토리가 있으면 한 달 뒤 "그때 시안 어떻게 뽑았더라?"가 풀려요.

### 5.4 GitHub — 모든 결정의 영구 저장소

**Issues 활용**
- 버그·기능 요청 — 태그로 분류 (bug, feature, content, design)
- 결정 필요한 질문 → 이슈로 만들고 Close 시 결론 적기 (검색 가능)
- "나중에 할 일" 대기실

**Projects (선택)**
- 칸반 보드로 주 단위 작업 관리
- 1인이면 단순한 TODO.md로 대체 가능 — 본인 취향

**PR 규칙**
- 크기 작게 (100~300 라인 변경)
- 본인이 리뷰하되 **24시간 이상 묵혀두고 다음 날** 리뷰 (자기 객관화)
- Claude Code에게 "이 PR 리뷰해줘"로 셀프 더블 체크

**Actions (CI/CD)**
- `on: pull_request` — 린트·타입 체크·테스트
- `on: push to main` — 스테이징 배포
- 프로덕션 배포는 수동 트리거

### 5.5 Cloudflare — 운영 환경

**환경 분리**
- `dev`: 로컬만
- `staging`: Cloudflare Pages 프리뷰 URL (PR마다 자동)
- `production`: 메인 도메인 (수동 배포)

**모니터링**
- Cloudflare Web Analytics 대시보드 주 1회 확인
- Sentry 알림 이메일로 설정 (critical error 시만)
- D1 사용량 주 1회 확인 (무료 한도 관리)

**백업**
- D1 export 주 1회 자동 → R2에 저장
- Git repo는 GitHub 자체가 백업
- 콘텐츠 JSON은 Git에 있으므로 별도 백업 불필요

---

## 6. 트랙별 작업 흐름

세 트랙이 **평행으로** 돌아가되 서로 간섭 최소화.

### 6.1 Track A: 코드 (Apps/Packages)

```
Issue 생성 (기능·버그)
    ↓
feat/xxx 브랜치 생성
    ↓
Claude Code 세션 시작 (CLAUDE.md 참조)
    ↓
구현 + 테스트
    ↓
로컬 실행 확인
    ↓
커밋 (Conventional Commits)
    ↓
PR → CI 통과 확인 → 셀프 리뷰 → merge
    ↓
스테이징 자동 배포 → 모바일 OTA
```

한 기능 lifecycle: **2~4일**

### 6.2 Track B: 콘텐츠 (content/)

```
Episode 선택 (격자 위치 확정)
    ↓
content/<episode-id>.md 명세서 작성 (사람이)
    ↓
공공누리 자료 수집 · 메타데이터 기록
    ↓
Claude 채팅: 명세서 → Quest JSON 초안 3개
    ↓
로컬에서 validate-content.ts 실행 (스키마 검증)
    ↓
Claude Code: 누락된 assets 생성 요청 (TTS 스크립트 실행 등)
    ↓
로컬 앱에서 실제 체험 (QA)
    ↓
커밋 → content/ 브랜치 → PR → merge
    ↓
CDN 캐시 무효화 → 앱에 자동 반영
```

한 Episode lifecycle: **3~5일** (익숙해지면 2~3일)

### 6.3 Track C: 디자인 (design/)

```
Claude 채팅: 화면 요구사항 정리
    ↓
Claude Design: 시안 3~5개 생성
    ↓
선택·조정 → PNG·HTML 내보내기
    ↓
design/snapshots/에 저장
    ↓
claude-design-prompts.md 업데이트
    ↓
Claude Code: 디자인 번들 → 컴포넌트 코드 구현
    ↓
(Track A의 코드 흐름으로 합류)
```

한 화면 lifecycle: **1~2일**

### 6.4 트랙 간 의존성 관리

```
Track C (디자인) ──제공──→ Track A (코드)
Track B (콘텐츠) ──요구──→ Track A (코드 스키마 변경 시)
Track A (코드) ──노출──→ Track B (콘텐츠 테스트 환경)
```

**주의**: 한 트랙이 다른 트랙을 블로킹하기 전에 **선제 작업**하기:
- 콘텐츠 스키마는 코드 착수 전에 확정 (content-schema 패키지)
- 디자인 시스템 토큰은 코드 착수 전에 1차 확정
- 새 기능은 콘텐츠보다 먼저 코드가 나와야 함 (콘텐츠가 테스트 가능)

---

## 7. 콘텐츠 중심 워크플로우 (가장 자주 쓸 흐름)

Stage 1 만드는 동안 대부분의 시간이 콘텐츠 작업이에요. 이걸 최적화하는 게 핵심.

### 7.1 Episode 한 개 만드는 표준 흐름 (3~5일)

**Day 1 — 명세서 작성 + 자료 수집**

```
오전:
  - docs/specs/episode-template.md 복사 → episode_1_a1.md
  - 학습 목표·캐릭터 대사·시나리오 작성 (사람이 직접)
  - 이 단계에서 Claude 채팅과 캐치볼

오후:
  - 공공누리 사이트에서 이번 Episode용 자료 다운로드
  - content/assets-license.csv에 메타데이터 기록
  - design/snapshots/에 참조 이미지 저장
```

**Day 2 — JSON 생성 + 시각 자산**

```
오전:
  - Claude 채팅에서 명세서 → Quest 1/2/3 JSON 변환
  - content/stages/stage_1/에 저장
  - validate-content.ts로 검증

오후:
  - Claude Design으로 Episode 고유 시각 자산 생성
  - 배경·캐릭터 포즈·카드 디자인
  - design/snapshots/에 저장
```

**Day 3 — TTS 생성 + 자산 업로드**

```
오전:
  - scripts/generate-tts.ts 실행
    (Naver Clova 또는 ElevenLabs로 음성 자동 생성)
  - 결과 오디오 수동 QA (본인이 듣기)

오후:
  - 자산 → Cloudflare R2 업로드
  - content JSON의 URL 참조 업데이트
  - 스테이징 환경 배포
```

**Day 4 — 직접 플레이 테스트 + 다듬기**

```
종일:
  - 본인 기기로 Episode 처음부터 끝까지 플레이
  - 어색한 부분 메모
  - Claude Code에게 수정 지시
  - 자녀·조카·친구 아이에게 시연 가능하면 시도
```

**Day 5 (선택) — 베타 반영**

```
- 가까운 가정에 Episode 공유
- 피드백 수집
- 다음 Episode에 반영
```

### 7.2 Episode 템플릿 (docs/specs/episode-template.md)

```markdown
# Episode [ID] — [Title]

## 격자 좌표
- Stage: [1~7]
- Pillar: [A~E]
- Theme: [ID]

## 학습 목표
- Anchor: [이 Episode의 단일 핵심 목표]
- Quest 1: [세부 목표]
- Quest 2: [세부 목표]
- Quest 3: [세부 목표]

## 어휘·문형
- 노출 어휘 N개: [...]
- 노출 문형 (해당 시): [...]

## 문화유산 자료
- 자료 ID: [공공누리 출처]
- 라이선스: [제1유형 / 저작권 만료]
- 사용 방식: [배경 / 카드 / 학습 요소]

## 캐릭터 & 시나리오
- 등장: 호야 + [보조 캐릭터]
- 장면: [시대·장소]
- 대사 (Hook): "..."
- Quest별 서사: [...]

## 미니게임 매핑
- Quest 1 Play: [카탈로그 ID, 예: match_sound]
- Quest 2 Play: [...]
- Quest 3 Play: [...]

## 보상
- Episode 완료 카드: [card_id + 설명]
- Heritage Pillar 진도 기여: [...]

## 의존성
- 필수 선행 Episode: [있으면]
- 공유 자산: [캐릭터·배경 재사용 여부]

## 제작 체크리스트
- [ ] Quest 1 JSON
- [ ] Quest 2 JSON
- [ ] Quest 3 JSON
- [ ] 음성 녹음 (TTS)
- [ ] 배경 이미지
- [ ] 캐릭터 포즈
- [ ] Heritage Card 디자인
- [ ] 로컬 플레이 테스트
- [ ] 베타 공유 (선택)
```

이 템플릿을 각 Episode마다 복사해서 채우면 일관성·속도 둘 다 확보.

### 7.3 Claude 프롬프트 템플릿 (명세서 → JSON)

```
[프롬프트]

다음 Episode 명세서를 바탕으로 Quest 3개의 JSON을 생성해줘.

@docs/specs/episode_1_a1.md

스키마는 @packages/content-schema/src/quest.ts 참조.

제약:
- Quest 하나는 3~4분 이내
- Hook 15~20초, Discover 45~60초, Play 90~120초, Check 30~45초, Celebrate 15~20초
- 새 학습 요소 Quest당 1~2개만
- 캐릭터 대사는 영어 UI 기준, 한국어 학습 요소만 한국어
- 미니게임은 카탈로그 ID로만 참조 (match_sound, build_letter 등)

출력 형식: 3개의 .json 파일 내용. 각각 아래 형태로:

// content/quests/quest_1_a1_1.json
{...}

// content/quests/quest_1_a1_2.json
{...}

...
```

이 템플릿을 `docs/prompts/`에 저장해두고 재사용.

---

## 8. Claude 할당량 관리

1인 개발이라도 Claude 생태계 여러 개를 동시에 쓰면 할당량이 빡빡해져요. Claude Design은 기존 Claude 채팅·Claude Code 한도와 별도로 추적되지만, Claude 채팅과 Claude Code는 구독 한도를 공유하는 구조.

### 8.1 할당량 분산 전략

**월 구독 기준 (Pro/Max)**
- Claude 채팅·Claude Code: 공동 주간 한도 (메시지 기반)
- Claude Design: 별도 주간 한도 (~20~40 프롬프트 정도)

**우선순위**
- Claude Code: 실제 코드 생산 — 최우선
- Claude 채팅: 기획·콘텐츠 생성 — 차선
- Claude Design: 새 시안 필요 시만 — 주당 집중 1회

**한도 소진 시 대응**
- 긴 세션을 잘게 나눠 재시작 (컨텍스트 낭비 적음)
- 주말에 과외 구독 일시 업그레이드 (Max 전환)
- 실제 코드 실행·디버깅은 Claude 없이 진행 (이미 있는 지식으로)

### 8.2 세션 관리 팁

- **Project 기능 적극 활용**: 공통 컨텍스트(CLAUDE.md·핵심 문서)를 매번 첨부하지 말고 Project에 고정
- **세션 한 주제 원칙**: "오늘 코드 세션 / 오늘 기획 세션" 분리
- **세션 끝 요약 저장**: 채팅 종료 전 "핵심 결정 3줄 요약" → Git에 커밋

### 8.3 Claude Code 비용 폭주 주의

Claude Code는 코드베이스가 클 때 컨텍스트로 많은 파일을 불러와 토큰이 폭증할 수 있어요. 방지:
- `.claudeignore` 같은 설정으로 불필요한 파일 제외 (node_modules·dist·assets 등)
- 명시적 파일 참조 (`@file.ts`) 사용, 전체 탐색 피하기
- 큰 작업은 단계별로 쪼개기

---

## 9. 위기 대응 플레이북

1인 개발에서 "망한 상황"들을 미리 시나리오화해 두면 실제 터졌을 때 침착하게 대응할 수 있어요.

### 9.1 "Claude Code가 의도치 않게 파일 많이 수정함"

```
즉시: Claude Code 중단
검사: git diff로 변경 확인
복구: git checkout -- <바람직하지 않은 파일>
재시도: 변경 범위를 더 명시적으로 지정해서 새 세션
```

**예방**: CLAUDE.md의 "금지사항" 섹션에 "다음 경로 밖은 건드리지 마" 명시.

### 9.2 "Claude Design 한도 소진 & 시안 필요"

```
대안 1: 이전 시안 참고해 수동 조정 (Figma 무료 또는 Excalidraw)
대안 2: 다음 주로 미루기, 다른 트랙 작업
대안 3: 단기 Max 업그레이드 ($20~$100)
```

### 9.3 "1주일째 Episode 하나도 못 끝냄"

```
원인 진단:
  □ 스코프가 너무 큼? → Episode 단위 쪼개기
  □ 막힘이 있는가? (특정 기술·콘텐츠) → 블로킹 이슈로 분리
  □ 다른 작업 침투? → 이번 주 다른 트랙 정지
  □ 의욕 저하? → 이번 주 Episode 2 Quest만 목표로 축소

즉시 대응: 가장 작은 성공 단위 찾기 (Quest 1 JSON 완성)
```

### 9.4 "베타 사용자가 너무 어렵다고 함"

```
기록: 구체적으로 어느 Quest의 어느 지점에서 막혔나
분석: 난이도·설명·UI 중 어느 문제?
수정: 다음 업데이트에서 해당 Quest 재설계
콘텐츠는 Git이므로 immutable → 새 버전 릴리즈로
```

### 9.5 "Cloudflare 무료 한도 초과 경고"

```
확인: 어느 리소스가 터졌나 (D1 쓰기? R2 용량?)
단기: 가벼운 쓰기 최적화·캐싱 추가
중기: 유료 플랜 전환 ($5/월부터)
장기: 사용자 증가 좋은 신호 → 유료화 전환 시점 고려
```

---

## 10. 첫 2주 구체 계획 (킥오프)

워크플로우가 말만 있으면 안 쓰게 돼요. 첫 2주 구체적으로:

### 10.1 Week 1 — 셋업 & 첫 산출물

**Day 1 (월)**
- GitHub 저장소 생성 (`hangul-route`)
- Turborepo 스캐폴드
- CLAUDE.md 초안 작성 + 커밋
- Cloudflare 계정 생성·도메인 구매
- Claude Design 열어보기 (할당량 확인)

**Day 2 (화)**
- Expo 기본 앱 + 실행 확인
- Next.js 기본 앱 + Cloudflare Pages 배포
- Cloudflare Workers hello world + D1 연결

**Day 3 (수)**
- Claude Design에서 로고·브랜드 컨셉 시안 (3안)
- 디자인 토큰 초안 (colors·typography)
- design/system/tokens.json 커밋

**Day 4 (목)**
- `content-schema` 패키지 스키마 정의 (Stage·Episode·Quest)
- validate-content.ts 스크립트 작성
- Episode 템플릿 (docs/specs/episode-template.md)

**Day 5 (금)**
- 공공누리 자료 수집 (Episode 1.A1용)
- 훈민정음 해례본 이미지·메타데이터 기록
- 주간 회고 작성

### 10.2 Week 2 — 첫 Episode + 첫 게임

**Day 6 (월)**
- Episode 1.A1 명세서 작성 (docs/specs/episode_1_a1.md)
- 캐릭터 호야·훈이 기본 포즈 Claude Design

**Day 7 (화)**
- Claude 채팅: 명세서 → Quest 1 JSON 초안
- Quest 2·3 JSON 초안

**Day 8 (수)**
- Claude Code: Match Sound 미니게임 컴포넌트 구현
- 로컬에서 Quest 1 실제 플레이

**Day 9 (목)**
- Build a Letter 미니게임 시작 (한글 조합)
- 디자인 시스템 컴포넌트 완성 (Button·Card)

**Day 10 (금)**
- Quest 2·3 구현 진도
- Week 2 회고 + Week 3 계획
- 2주 워크플로우 반성: 어디서 시간 낭비했나? 무엇을 바꿀까?

**2주 말 보고 싶은 상태**:
- `git log` 기준 30+ 커밋
- 로컬에서 Episode 1.A1 Quest 1을 끝까지 플레이 가능
- 워크플로우 자체에 대한 첫 피드백 기록

---

## 11. 성공·실패 기준

워크플로우가 잘 작동하는지 2주·1개월 단위로 평가:

### 11.1 건강한 신호
- 주간 회고에서 "했다" ≥ "못 했다"
- 금요일마다 작동하는 소프트웨어가 있음
- Claude 세션 종료 후 다음날 맥락 복원 쉬움
- 트랙(코드·콘텐츠·디자인) 사이 갈팡질팡 적음
- 하루 집중 블록 2회 이상 확보

### 11.2 위험 신호
- 월요일마다 "뭐부터 하지?" 멍때림 (→ 금요일 계획 실패)
- 같은 일을 두 번 한 기억 (→ Git·Obsidian에 저장 안 됨)
- Claude에게 같은 컨텍스트 반복 설명 (→ CLAUDE.md 업데이트 필요)
- 한 트랙이 2주 이상 멈춰 있음 (→ 스코프 축소 신호)
- 번아웃 징후 (→ MVP 스코프 재검토)

### 11.3 워크플로우 자체의 iteration

이 문서는 **v1 초안**. 2주 후 실제로 써보고 수정:
- 어느 단계가 실제로 안 지켜졌는지
- 어디에 시간이 예상보다 많이 들었는지
- 어떤 도구가 덜 쓰였는지

→ v2 작성 시점: **2026 W20 (약 3주 후)**

---

## 12. 다음 즉시 할 것

이 문서 읽은 뒤 30분 안에 시작할 수 있는 것들:

1. **GitHub 저장소 생성** (`hangul-route` 또는 최종 브랜드명)
2. **CLAUDE.md 초안 만들기** — 위 섹션 5.2 예시를 본인 상황에 맞게
3. **docs/weekly/2026-w17.md 만들기** — 이번 주 목표 1~3개만 적기
4. **Claude Design 열어보기** — 첫 시안 "호야 캐릭터 스케치" 요청
5. **도메인 결정 + 구매** — Cloudflare Registrar 원가

이 5개만 오늘 끝내면 워크플로우가 시작돼요.

---

## 부록: 한 화면 치트시트 (프린트해 두기 좋은 버전)

```
매일:
  아침 15분  →  git log + 오늘 목표 1~3개 + Claude 세션
  본작업     →  집중 블록 2~3시간, 한 종류만
  저녁 10분  →  커밋 정리 + 내일 첫 작업 한 줄

주간:
  월 30분    →  목표 3~5개 설정
  수 10분    →  중간 점검
  금 30분    →  회고 + 다음 주 초안

도구:
  채팅 Claude  →  기획·문서
  Claude Code  →  실제 코드
  Claude Design →  시안
  GitHub        →  Source of Truth
  Cloudflare    →  운영

원칙:
  Git이 모든 것의 최종 저장소
  트랙 전환 최소화
  스코프 의심되면 축소
  매일 작은 성공 1개
```

---

*문서 버전 v1.0 — 2026.04.20*
*다음 업데이트: 실제 2~3주 운용 후 v2.0*
