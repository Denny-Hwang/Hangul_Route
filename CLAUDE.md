# CLAUDE.md — Hangul Route (v2.2)

> 이 문서는 모든 Claude Code 세션이 가장 먼저 참조하는 프로젝트 헌장(charter)이다.
> 작업 시작 전 반드시 읽고 규칙을 준수한다.

---

## 1. Project Overview

**Hangul Route** is a Korean language learning mobile app for **English-speaking children, ages 5–11**.

### Target audience (authoritative)

- **Primary users**: English-speaking children, ages 5–11.
  - **P4**: Korean heritage children — parents speak Korean, the child does not.
  - **P5**: International children interested in K-culture (no Korean background).
- **Native language = English.**
- **Korean = the target language** being learned (zero or near-zero baseline).
- **UI text = English** (CEFR Pre-A1, 5–7 year old vocabulary).
- **Korean text = ONLY for content being taught** (자모, 단어, 문장).
- **Romanization** is always shown alongside Korean as a pronunciation guide.
- **English gloss / visual** is always shown alongside Korean for meaning.

### Core concept — "Heritage Journey"

학습은 **격자(grid) 구조** 위에서 진행된다.

- **Stage axis (7)**: Hangul → Word → Sentence → Dialogue → Story → Real-use → Self-expression
- **Culture-theme axis (5)**: Letters · Life · Rites · Nature · Crafts

학습자는 이 격자 위에서 자신만의 **"Route"** 를 그리며 진행한다.

### Guide character
**Hoya (호야)** — a young tiger. Persona + feedback channel throughout learning.

### Reward system
주요 보상은 **cultural heritage card collection**. 진도 자체보다 "한국 문화 조각"을 모은다는 수집 동기를 우선한다.

### MVP scope
- Stage 1 (Hangul) — full build
- Stage 2 / Stage 4 — taste only
- Remaining stages / axes — blueprint level only

---

## 2. Directory Structure

```
Hangul_Route/
├── CLAUDE.md
├── README.md
├── package.json                # Turborepo root
├── pnpm-workspace.yaml
├── turbo.json
│
├── .claude/
│   └── skills/                 # 8 Skills auto-triggered by Claude Code
│       ├── README.md
│       ├── wireframe-skill/
│       ├── design-system-skill/
│       ├── frontend-design-skill/
│       ├── design-handoff-skill/
│       ├── component-skill/
│       ├── minigame-skill/
│       ├── test-skill/
│       └── content-skill/
│
├── .github/
│   ├── workflows/              # ci / coverage-gate / content-validation /
│   │                           # design-token-sync / routine-validation / preview-deploy
│   ├── pull_request_template.md
│   ├── ISSUE_TEMPLATE/
│   └── CODEOWNERS
│
├── apps/
│   ├── mobile/                 # Expo React Native (TypeScript)
│   ├── web/                    # Next.js (TypeScript)
│   └── api/                    # Cloudflare Workers (Hono)
│
├── packages/
│   ├── design-system/          # tokens, components, icons, Hoya
│   ├── content-schema/         # Episode / Card / Grid (zod)
│   ├── backend/                # Worker handlers
│   ├── shared-types/           # cross-package types
│   └── test-utils/             # shared test helpers
│
├── content/
│   ├── fixtures/               # test-only content
│   └── ...                     # real episodes / cards / quests (later)
│
├── design/                     # manual Claude Design working space
│   ├── playbook/               # ★ daily guides (week-01..12)
│   ├── tokens/
│   ├── wireframes/
│   ├── components/
│   ├── screens/
│   ├── characters/
│   ├── illustrations/
│   └── prompts.md              # daily prompt log
│
├── routines/                   # R1 / R2 / R3 / R4 / R6 (no R5)
│
├── docs/
│   ├── blueprints/             # 8 original design docs
│   ├── specs/                  # F-XXX feature specs (source of truth)
│   ├── tests/                  # strategy + coverage targets
│   ├── design/                 # tokens / components / illustration / interaction rules
│   ├── workflows/              # 5 SOPs
│   ├── beta/                   # Hangul school beta cycles
│   ├── roadmap/                # forward planning
│   ├── tasks/                  # INBOX / DOING / DONE
│   └── weekly/                 # retros (R6 output)
│
└── infra/                      # Cloudflare (later)
```

> 이 구조에서 벗어나는 새 디렉토리/패키지가 필요하면 먼저 제안하고 승인받는다.

---

## 3. Tech Stack

| 영역 | 선택 | 비고 |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | |
| Mobile | Expo React Native (TypeScript) | |
| Web | Next.js (TypeScript) | App Router |
| Backend | Cloudflare Workers + D1 (SQLite) + R2 | 제로 비용 스택 |
| Auth | Clerk 무료 티어 | 자체 구축도 검토 대상 |
| 배포 | Cloudflare Pages / Workers | |
| CI/CD | GitHub Actions | 6 workflows |
| 테스트 | vitest (unit/int) · Detox / Playwright (e2e) | TDD 강제 |

---

## 4. Coding Rules

- **TypeScript strict mode** 를 모든 패키지에서 활성화. (`"strict": true`)
- React: **함수형 컴포넌트 + hooks** 만. 클래스 컴포넌트 금지.
- **상태 관리**: `zustand`
- **서버 상태 / API**: `@tanstack/react-query`
- **테스트**: `vitest`. E2E 는 Detox / Playwright (nightly).
- **스타일**: `packages/design-system` 의 **토큰만** 사용.
  - 색상·간격·타이포·반경·그림자 하드코딩 금지.
  - 색상 리터럴(`#fff`, `rgb(...)`) 직접 사용 금지.
- 파일/폴더명: `kebab-case`. React 컴포넌트는 `PascalCase.tsx`.
- Import 경로: 패키지는 `@hangul-route/*` 별칭.

---

## 5. Workflow Rules (강제)

- **"사양(F-XXX) 없는 코드 금지."** 구현 전 `docs/specs/F-XXX-*.md` 가 `ready` 상태여야 한다.
- **"테스트 없는 컴포넌트 금지."** 한 커밋 = 테스트 + 구현 (TDD).
- **"디자인 시안 없는 컴포넌트 금지."** UI 컴포넌트는 `design/components/` 또는 `design/screens/` 의 시안 링크 필수.
- **"와이어프레임 없는 시안 금지."** 시안 전 `design/wireframes/` 를 거친다.
- **`.claude/skills/` 8개 Skills 자동 트리거.** Claude Code + Routines 가 해당 파일·경로 변경 시 자동 적용.
- **디자인은 수동.** `design/playbook/` 의 일일 가이드를 본인이 따라간다 (R5 없음).
- **동기화는 CI.** `design/tokens/` ↔ `packages/design-system/` 일치는 `.github/workflows/design-token-sync.yml` 이 검증.
- **`main` 브랜치 직접 push 금지.** 루틴 PR 은 `claude/*` 브랜치만.

---

## 6. Coverage Targets (rolling)

상세는 `docs/tests/coverage-targets.md`.

| 영역 | W4 (알파) | 6 months |
|---|---|---|
| `packages/content-schema` | 100% | 100% |
| `packages/backend` | 90% | 90% |
| `packages/design-system` | 85% | 85% |
| `apps/mobile` — business logic | 90% | 100% |
| `apps/mobile` — platform-dependent | 70% | 80% |
| `apps/web` — verification logic | 90% | 100% |

**Business vs platform 분리**: `apps/mobile/src/logic/` (비즈니스) vs `apps/mobile/src/platform/` (RN Animated, Camera, AsyncStorage 래퍼). coverage-gate.yml 이 두 경로를 분리 리포트.

---

## 7. Routines (5)

상세는 `routines/` 및 `docs/workflows/routine-operations.md`.

| ID | 이름 | 트리거 |
|---|---|---|
| R1 | Daily Task Runner | 매일 06:00 KST |
| R2 | Content Validator | PR opened (paths: `content/**`) |
| R3 | PR Reviewer | PR opened (label: `routine-generated`) |
| R4 | Coverage Monitor | push to `main` |
| R6 | Weekly Report | 매주 금 18:00 KST |

> **R5 제거**. 디자인은 수동이며, 토큰 sync 는 `design-token-sync.yml` CI 가 담당.

---

## 8. Do NOT

- ❌ `localStorage` / `AsyncStorage` **직접 사용 금지** — `packages/hooks` 의 안전 훅 경유 (별도 PR 예정).
- ❌ `any` 타입 금지. 불가피하면 `unknown` + 내로잉, 또는 정확한 타입.
- ❌ `console.log` 를 production 코드에 남기지 말 것. 로깅은 `packages/shared-types` (또는 shared logger) 경유.
- ❌ `main` 브랜치 직접 push. 모든 변경은 PR.
- ❌ `--no-verify` / `--force` 계열 옵션으로 훅·검증 우회.
- ❌ 명시적으로 지정되지 않은 파일/패키지에 "겸사겸사" 수정.
- ❌ UI 문자열을 한국어로. **UI = English**, **Korean = content being taught only**.

---

## 9. Git

### Conventional Commits
```
<type>(<scope>): <subject>
```
- `type`: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `content` / `design` / `ci` / `skill`
- 예시
  - `feat(mobile): add Hangul tile game (F-001)`
  - `content(stage1): add 가-하 consonant cards`
  - `fix(api): correct D1 migration order`
  - `skill: add frontend-design-skill body`

### 브랜치
- 기능: `feat/<slug>`
- 콘텐츠: `content/<id>`
- 디자인: `design/<sprint>`
- 버그: `fix/<slug>`
- 루틴: `claude/*` (예: `claude/daily-2026-04-22`)
- 인프라: `chore/<slug>` 또는 `ci/<slug>`

### PR
- 제목은 Conventional Commits.
- 본문에 F-XXX 링크 / 테스트 결과 / 커버리지 델타 / 스크린샷(UI) 필수.

---

## 10. Working Principles

1. **범위 준수.** 사용자가 지정하지 않은 파일/패키지는 건드리지 않는다. 리팩터링은 별도 세션·별도 커밋.
2. **"테스트 없는 다 됐어요" 금지.** 실제 실행 결과(출력·스크린샷·테스트 로그) 제시. UI 는 브라우저/에뮬레이터 확인 명시. 불가능하면 "확인 불가"로 솔직히 보고.
3. **작은 커밋.** 한 커밋 = 한 가지 변경 의도.
4. **질문 우선.** 요구사항이 애매하면 구현 전 명확화 질문. 2–3문장 권고 + 트레이드오프 먼저.
5. **파괴적 작업은 사용자 승인.** `rm -rf`, `git reset --hard`, 강제 푸시, 의존성 다운그레이드 등.

---

## 11. Reference Docs

작업 컨텍스트에 따라 아래를 먼저 읽는다.

| # | 문서 | 언제 참조 |
|---|---|---|
| 01 | `docs/blueprints/01-competitor-wireframe-analysis.md` | UX/화면 기획 |
| 02 | `docs/blueprints/02-core-feature-spec.md` | Journey/Library/Classroom/Companion |
| 03 | `docs/blueprints/03-engineering-blueprint-v2.md` | 인프라/백엔드/배포 |
| 04 | `docs/blueprints/04-main-content-outline.md` | 격자 구조, 전체 콘텐츠 |
| 05 | `docs/blueprints/05-episode-learning-goals.md` | 에피소드 학습목표 |
| 06 | `docs/blueprints/06-mini-game-catalog.md` | 미니게임 4 family / 12 |
| 07 | `docs/blueprints/07-solo-dev-workflow.md` | 1인 개발 운영 |
| 08 | `docs/blueprints/08-claude-code-routines.md` | Claude Code 루틴 운용 |

그 외: `docs/tests/strategy.md`, `docs/design/*`, `docs/workflows/*`, `routines/*`, `.claude/skills/*/SKILL.md`.

---

## 12. Status

- **v2.2 architecture pass** (Week 1)
  - [x] CLAUDE.md 재작성
  - [x] 디렉토리 구조 확장
  - [x] Routines 5 (R5 제거)
  - [ ] Turborepo 빌드 그린
  - [ ] Cloudflare hello world
  - [ ] Week 1 design playbook 실행

---

_Last updated: 2026-04-21 (v2.2 pass)_
