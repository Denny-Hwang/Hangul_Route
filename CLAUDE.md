# CLAUDE.md — Hangul Route

> 이 문서는 모든 Claude Code 세션에서 가장 먼저 참조되는 프로젝트 헌장(charter)이다.
> 작업을 시작하기 전, 반드시 이 문서를 읽고 규칙을 준수할 것.

---

## 1. 프로젝트 개요

**Hangul Route** 는 영어권 어린이(5–11세)를 위한 한국어 학습 모바일 앱이다.

### 타겟
- **P4 (Primary)**: 해외 동포(Heritage) 어린이
- **P5 (Primary)**: K-컬처에 관심 있는 해외 어린이

### 핵심 컨셉 — "Heritage Journey"
학습은 **격자(grid) 구조** 위에서 진행된다.

- **Stage 축 (7단계)**: 한글 → 단어 → 문형 → 대화 → 이야기 → 실전 → 자기표현
- **문화 테마 축 (5개)**: 문자 · 생활 · 의례 · 자연 · 공예

학습자는 이 격자 위에서 자신만의 **"Route(경로)"** 를 그리며 진행한다.

### 가이드 캐릭터
**호야(Hoya)** — 어린 호랑이. 학습 전반의 페르소나이자 피드백 채널.

### 보상 시스템
주요 보상은 **문화유산 카드 수집**. 진도 자체보다 "한국 문화 조각"을 모은다는
수집 동기를 우선한다.

### MVP 범위
- **Stage 1 (한글)** — 풀 구현
- **Stage 2 / Stage 4** — 맛보기(taste) 구현
- 그 외 Stage / 축은 블루프린트 수준만 유지

---

## 2. 디렉토리 구조 (계획)

현재 저장소는 킥오프 상태로 비어있다. 계획된 구조는 아래와 같다.

```
Hangul_Route/
├── CLAUDE.md                 # 이 문서
├── README.md
├── package.json              # Turborepo root
├── pnpm-workspace.yaml
├── turbo.json
│
├── apps/
│   ├── mobile/               # Expo React Native (TypeScript)
│   ├── web/                  # Next.js (TypeScript) — 랜딩 / 웹 체험
│   └── api/                  # Cloudflare Workers (Hono 등)
│
├── packages/
│   ├── design-system/        # 토큰, 컴포넌트, 아이콘 (호야 포함)
│   ├── content-schema/       # Episode / Card / Grid 스키마 (zod)
│   ├── content/              # 실제 학습 컨텐츠 (JSON/MDX)
│   ├── shared/               # 공통 유틸, 타입
│   └── hooks/                # safe-storage 등 안전 훅
│
├── infra/
│   ├── cloudflare/           # wrangler.toml, D1 migrations, R2 buckets
│   └── github-actions/       # 참고용 워크플로우 스니펫
│
├── docs/
│   └── blueprints/
│       ├── 01-competitor-wireframe-analysis.md
│       ├── 02-core-feature-spec.md
│       ├── 03-engineering-blueprint-v2.md
│       ├── 04-main-content-outline.md
│       ├── 05-episode-learning-goals.md
│       ├── 06-mini-game-catalog.md
│       ├── 07-solo-dev-workflow.md
│       └── 08-claude-code-routines.md
│
└── .github/
    └── workflows/            # CI/CD (lint, test, deploy)
```

> 이 구조에서 벗어나는 새 디렉토리/패키지가 필요하면, 먼저 제안하고 승인받을 것.

---

## 3. 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | |
| Mobile | Expo React Native (TypeScript) | |
| Web | Next.js (TypeScript) | App Router |
| Backend | Cloudflare Workers + D1 (SQLite) + R2 | 제로 비용 스택 |
| Auth | Clerk 무료 티어 | 자체 구축도 검토 대상 |
| 배포 | Cloudflare Pages / Workers | |
| CI/CD | GitHub Actions | |

---

## 4. 코딩 규칙

- **TypeScript strict mode** 를 모든 패키지에서 활성화한다. (`"strict": true`)
- React는 **함수형 컴포넌트 + hooks** 만 사용한다. 클래스 컴포넌트 금지.
- **상태 관리**: `zustand`
- **서버 상태 / API**: `@tanstack/react-query`
- **테스트**: `vitest` (unit/integration), 필요 시 Playwright/Detox (E2E)
- **스타일**: `packages/design-system` 의 **토큰만** 사용한다.
  - 색상, 간격, 타이포, 반경, 그림자 — 하드코딩 금지
  - 색상 리터럴(`#fff`, `rgb(...)`) 직접 사용 금지
- 파일/폴더명: `kebab-case`. React 컴포넌트 파일은 `PascalCase.tsx`.
- Import 경로: 패키지는 `@hangul-route/*` 별칭 사용.

---

## 5. 금지사항 (Do NOT)

- ❌ `localStorage` / `AsyncStorage` **직접 사용 금지** — `packages/hooks` 의 안전 훅을 통해서만.
- ❌ `any` 타입 사용 금지. 불가피하면 `unknown` + 내로잉, 또는 정확한 타입 정의.
- ❌ `console.log` 를 production 코드에 남기지 말 것. (개발 중엔 OK, 커밋 전 제거)
  - 로깅이 필요하면 `packages/shared` 의 logger 유틸 사용.
- ❌ **메인 브랜치(`main`) 직접 push 금지.** 모든 변경은 PR을 거친다.
- ❌ `--no-verify`, `--force` 계열 옵션으로 훅/검증 우회 금지.
- ❌ 명시적으로 지정되지 않은 파일/패키지에 "겸사겸사" 수정 금지.

---

## 6. Git 규칙

### 커밋 메시지 — Conventional Commits
```
<type>(<scope>): <subject>

<body (선택)>
```

- `type`: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `content` / `design`
- 예시
  - `feat(mobile): add Hoya intro screen`
  - `content(stage1): add ㄱ-ㅎ consonant cards`
  - `fix(api): correct D1 migration order`

### 브랜치 네이밍
- 기능: `feat/<기능-이름>` — 예: `feat/hangul-tile-game`
- 컨텐츠: `content/<id>` — 예: `content/stage1-ep01`
- 디자인: `design/<sprint>` — 예: `design/sprint-w3`
- 버그픽스: `fix/<간단설명>`

### PR
- PR 제목도 Conventional Commits 형식을 따른다.
- 본문에는 **변경 요약 / 테스트 방법 / 스크린샷(UI인 경우)** 을 포함.

---

## 7. 작업 시 기본 원칙

1. **범위 준수**
   - 사용자가 명시적으로 지정하지 않은 파일/패키지는 건드리지 않는다.
   - 리팩터링/정리는 별도 세션·별도 커밋으로.

2. **"테스트 없는 다 됐어요" 금지**
   - 빌드 통과 ≠ 기능 동작. 실제 실행 결과(출력, 스크린샷, 테스트 결과)를 보여줄 것.
   - UI 변경은 브라우저/에뮬레이터에서 직접 확인했는지 명시.
   - 확인이 불가능한 환경이면, **"확인 불가"라고 솔직히** 보고한다.

3. **작은 커밋**
   - 큰 작업은 논리적 단위로 쪼갠다.
   - 한 커밋 = 한 가지 변경 의도.

4. **질문 우선**
   - 요구사항이 애매하면 구현 전에 명확화 질문을 먼저.
   - 2-3문장의 짧은 권고 + 트레이드오프 먼저 제시.

5. **파괴적 작업은 반드시 확인**
   - `rm -rf`, `git reset --hard`, 강제 푸시, 의존성 다운그레이드 등은
     실행 전 사용자 승인 필수.

---

## 8. 참조 문서

작업 컨텍스트에 따라 아래 문서를 먼저 읽는다.
(현재는 로컬 초안 상태, 이후 `docs/blueprints/` 에 배치 예정)

| # | 문서 | 언제 참조 |
|---|---|---|
| 01 | `docs/blueprints/01-competitor-wireframe-analysis.md` | UX/화면 기획 |
| 02 | `docs/blueprints/02-core-feature-spec.md` | Journey/Library/Classroom/Companion 4축 기능 |
| 03 | `docs/blueprints/03-engineering-blueprint-v2.md` | 인프라/백엔드/배포 |
| 04 | `docs/blueprints/04-main-content-outline.md` | 격자 구조, 전체 컨텐츠 방향 |
| 05 | `docs/blueprints/05-episode-learning-goals.md` | 에피소드 단위 학습목표 |
| 06 | `docs/blueprints/06-mini-game-catalog.md` | 미니게임 4 family / 12종 |
| 07 | `docs/blueprints/07-solo-dev-workflow.md` | 1인개발 운영 원칙 |
| 08 | `docs/blueprints/08-claude-code-routines.md` | Claude Code 세션 운용 루틴 |

---

## 9. 현재 진행 상황

- **Week 1 / Day 1 — 기초 다지기**
  - [x] CLAUDE.md 초안 작성
  - [ ] Turborepo 스캐폴드
  - [ ] Cloudflare 첫 hello world 배포

---

_Last updated: 2026-04-21 (Week 1, Day 1)_
