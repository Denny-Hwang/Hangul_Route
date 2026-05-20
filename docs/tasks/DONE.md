# DONE

최근 30일 완료 태스크. 그 이후엔 `tasks/archive/YYYY-Www.md` 로 롤오버.

## Completed

### 2026-05 / W2 (service-review bootstrap)

- [x] T-INFRA F-INFRA-001 Cloudflare Workers Bootstrap (Hello-Hoya worker, wrangler.toml, spec) — PR #7 (squashed `9a048f8`)
- [x] T-003 pnpm-lock.yaml 생성 후 main 에 커밋 (CI `--frozen-lockfile` 통과 가능) — PR #7
- [x] T-001 F-001 "Hangul Tile Game" spec 초안 작성 (Stage 1, Theme A, Match Sound) — PR #8 (squashed `5fb507b`)
- [x] T-004 vitest 워크스페이스 설정 + 첫 4 passing tests (zod sanity ×2, Hono router ×2) — PR #8
- [x] T-005 design playbook week-02 본문 작성 (5 일치 + README) — PR #8
- [x] T-006 F-COV-001 coverage gate enforcement (`scripts/coverage-gate.mjs` + `coverage-targets.json` + `coverage-gate.yml` 갱신) — PR #9 (squashed `7d6ae7a`)
- [x] T-007 F-CNT-001 content language policy validator (`scripts/validate-content.mjs` + `content-validation.yml` 갱신) — PR #9
- [x] T-008 F-DES-001 design token drift detector (`scripts/check-token-drift.mjs` + `design-token-sync.yml` 갱신) — PR #9
- [x] T-009 design playbook week-03 본문 작성 (5 일치 + README) — PR #10 (squashed `974bfa4`)
- [x] T-010 F-002 "Hoya Feedback Bubble" component spec 작성 (status: ready, props surface 닫힘, anti-shame 계약 명문화) — PR #10
- [x] T-019 scripts/__tests__/ 단위 테스트 (3 enforcement script × 8 positive/negative cases = 24 passing tests via Node built-in `node:test`, HANGUL_ROUTE_ROOT env override) + ci.yml 통합 — this PR
- [x] T-020 `@vitest/coverage-v8` 설치 + per-package coverage 활성화 (content-schema / backend / api) + `test:coverage` turbo task + coverage-gate.yml 갱신. coverage-gate.mjs 가 처음으로 진짜 % 측정: 3 pass · 3 skip · 0 fail (W4 alpha) — this PR

### 2026-05 / W3 (v1.0 full-vision prototype)

- [x] T-V1 design tokens v1 실값 (단청 orange + Hoya sky blue + hanji surfaces, 7 stage × 5 theme × 4 rarity tints, anti-shame nudge color, 3 touch-target sizes 64/80/96) — `feat(design-system)`
- [x] T-V2 12 design-system components (Button / Card / Tile / Screen / Progress / StarRow / Pill / Heading / Body / Caption / Spacer / Icon × 19 / Hoya × 5 poses / HoyaBubble F-002 contract) — `feat(design-system)`
- [x] T-V3 content-schema 8 zod modules (Jamo / HeritageCard / Episode / Quest / Grid / Minigame 12-kind / Profile / ProgressSnapshot) + shared-types (ApiEnvelope / TelemetryEvent ×10 / AuthSession) — `feat(content-schema, shared-types)`
- [x] T-V4 Stage 1 real content seed (30 jamo + 30 Heritage cards × 5 themes + 5 episodes + 9 quests) + Stages 2–7 preview seed (30 placeholder episodes) — `content(stage1)`
- [x] T-V5 apps/mobile full Expo shell (App.tsx + navigation: root stack + onboarding stack + 5 main tabs + 6 stack screens) — `feat(mobile)`
- [x] T-V6 6 working minigames (Match Sound F-001 anti-shame nudge / Build a Letter / Trace Stroke / Card Match / Story Sequence / Voice Echo TTS honor-system) — `feat(mobile)`
- [x] T-V7 zustand stores (profile / progress / quest-run / ui) + AsyncStorage wrapper + expo-speech audio / expo-haptics anti-startle / reduced-motion hook — `feat(mobile)`
- [x] T-V8 ParentGate (multiplication challenge per Apple/Google child category) + ParentDashboard — `feat(mobile)`
- [x] T-V9 apps/web landing + Parent Dashboard pages (/, /about, /parent, /parent/[childId]) — `feat(web)`
- [x] T-V10 apps/api v1 router (auth / profiles / progress / cards / content / telemetry × 11 events) + Cloudflare D1 schema.sql + ApiEnvelope helpers + in-memory store — `feat(api)`
- [x] T-V11 56 passing tests across 9 files (design-system × 10 / content-schema × 14 / mobile-logic × 18 / web × 2 / api × 8 + legacy × 2 + backend × 2); `pnpm -r run typecheck` all 8 packages green — `feat(api,tests)`

### 2026-05 / W4 (design system + visual polish)

- [x] T-D1 Full Claude Design prompt library — 37 documents in `design/brief/` (foundation 3 + character 1 + illustrations 2 + components 11 + screens 20) — PR #14 `design(brief)`
- [x] T-D2 `design/tokens/*.v1.md` 5 spec docs (colors / typography / spacing / radii / shadows) — activates F-DES-001 drift gate (was no-op without .v1.md files) — PR #15 `design(tokens)`
- [x] T-D3 `/design-preview` route in apps/web — 17-section visual identity validation surface (palettes, typography, spacing, radii, shadows, touch targets, motion, z, buttons / cards / pills / tiles / Hoya placeholder, all consuming only `@hangul-route/design-system/tokens`) — PR #15 `design(web)`
- [x] T-D4 Hoya v1 SVG placeholder refined per `design/brief/character/hoya-character-sheet.md`: thinking pose looks UP-RIGHT (anti-shame), pose-conditional cheek visibility, 3 stripes per side, eye glints on open-eye poses, reading pose adds a book, cheering adds 4-point pinwheel sparkles — PR #16 `design(hoya)`
- [x] T-D5 Heritage Card Art SVG component — 6 cards initial (Tiger / Book / Kimchi / Seollal / Mountain / Yutnori, 1 per theme + 1 legendary) consumed by LibraryScreen + CardDetailScreen — PR #17 `design(card-art)`
- [x] T-D6 Heritage Card Art complete — all 30 Stage 1 cards illustrated (+24: hanji / brush / ink / origami / hangul-day · rice / chopsticks / hanbok / kimbap / family-table · chuseok / tteokguk / songpyeon / sebae / lantern · magpie / mugunghwa / sea / moon · jegi / kite / top / pottery / gayageum). `supportedCardIds` exports full 30-entry list — PR #18 `design(card-art)`
- [x] T-D7 F-XXX spec back-fill: F-003 Build a Letter / F-CARD-001 Heritage Card Art / F-HOYA-001 Hoya Character System / F-PREV-001 Design Preview Surface — this PR (fulfills the CLAUDE.md §5 promise from PR #13 to back-fill specs for code that landed under the "v1.0 prototype" exception)
