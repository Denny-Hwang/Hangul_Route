# v1.0 Prototype Build — Summary

**Branch**: `claude/app-review-improvements-DvtMu`
**Date**: 2026-05-18

This document records the "full vision" prototype build that lifted the
repo from scaffold to a runnable end-to-end Korean learning app. CLAUDE.md
spec-first / TDD-first rules were intentionally relaxed for this single
sprint per explicit user authorization; follow-up specs back-fill the work.

## What runs end-to-end

### apps/mobile (Expo React Native)

- **Onboarding**: Welcome → CreateProfile (name + age 5–7 / 8–9 / 10–11 + Hoya
  avatar in 5 colors) → FirstQuestPreview
- **5 main tabs**: Today (streak + next quest) · Journey (7×5 grid) · Library
  (30 cards, theme-filtered, rarity-bordered) · Homework · Me (profile switcher)
- **Episode flow**: EpisodeDetail → QuestPlayer (5-step intro → present →
  practice → apply → reward) → Results (3-tier stars, Hoya tone shifts)
- **Heritage cards**: CardDetail with Korean + romanization + fun fact +
  "Hear it" TTS button
- **Parent**: ParentGate (multiplication challenge per Apple/Google child
  category rules) → ParentDashboard (per-profile stats)
- **6 minigames** across all 4 catalog families:
  - Recognition: Match Sound (F-001) — replay button, anti-shame nudge tone,
    auto-replay 800ms after wrong tap
  - Construction: Build a Letter, Trace Stroke (3-tap placeholder for F-004)
  - Interaction: Voice Echo (TTS + honor-system checkbox; real STT deferred)
  - Discovery: Card Match, Story Sequence
- **State**: zustand profile / progress / quest-run / ui stores, persisted
  via `platform/storage` AsyncStorage wrapper (sole sanctioned surface).
- **Audio**: `expo-speech` ko-KR TTS as F-001 §3.3 audio failure fallback.

### apps/web (Next.js App Router)

- `/` — landing with hero, 3-card explainer, app store CTA
- `/about` — anti-shame / no-ads / local-first / parent-gate promises
- `/parent` — Family Dashboard (per-kid summary cards, totals, privacy panel)
- `/parent/[childId]` — child detail (recent quests w/ stars, weekly bar
  chart, recent cards, assign-homework stub)

### apps/api (Cloudflare Workers + Hono)

- Legacy `GET /` + `GET /health` preserved (F-INFRA-001 self-test passes).
- `/api/auth/family` POST/GET
- `/api/profiles` CRUD (validates age + name length 1–20)
- `/api/progress/:profileId` PUT/GET
- `/api/cards/catalog`, `/api/cards/:profileId/unlocked`
- `/api/content/{jamo|stages|themes}` catalogs
- `/api/telemetry` POST (11 allow-listed event names) + GET recent
- In-memory store mirrors `db/schema.sql` (D1-ready: families / profiles /
  progress / card_unlocks / sessions / events / homework_assignments)

### packages

- `design-system` — token v1 (`#E8743B` dancheong + `#4A9DD6` Hoya sky +
  hanji cream surfaces + 7 stage tints + 5 theme tints + 4 rarity tints +
  3 touch-target sizes), 12 components (Button / Card / Tile / Screen /
  Progress / StarRow / Pill / Heading / Body / Caption / Spacer / Icon
  19-glyph set / Hoya 5-pose SVG / HoyaBubble F-002 contract)
- `content-schema` — full zod schemas: Jamo / HeritageCard / Episode / Quest
  (5-step) / GridCell / Minigame (12-kind discriminated union) / Profile /
  ProgressSnapshot (with homework + reviews + sessions + cards + streak)
- `shared-types` — ApiEnvelope, AuthSession, TelemetryEvent (10 events), LogEvent

### content seed

- 30 jamo (14 consonants + 10 vowels + 6 batchim) with romanization, IPA,
  example word
- 30 Heritage cards (5 themes × 6 cards) — book / hanji / brush / ink /
  origami / Hangul-day · kimchi / rice / chopsticks / hanbok / kimbap /
  family-table · seollal / chuseok / tteokguk / songpyeon / sebae / lantern ·
  tiger / magpie / mugunghwa / mountain / sea / moon · yutnori / jegi /
  kite / top / celadon / gayageum
- 5 Stage 1 episodes (one per theme) + 9 Stage 1 quests with full step graphs
- 30 preview episodes for Stages 2–7 (UI navigable, "coming soon" surface)
- 25 minigame configs in `logic/minigame-config.ts` mapping ref → jamo /
  syllable / card pair / story step scopes

## Tests

56 tests passing across 9 files:

| Package | Tests | Focus |
|---------|-------|-------|
| `apps/api` | 8 | Hello-hoya + v1 router round-trips |
| `apps/mobile/logic` | 18 | starsForAccuracy, accuracy, round-builder F-001 §3.5 invariant, streak edge cases |
| `apps/web` | 2 | mock-family invariants |
| `packages/design-system` | 10 | Token sanity (palettes, touch targets, motion, z) |
| `packages/content-schema` | 14 | Zod schemas |
| `packages/backend` | 2 | Sanity |
| `packages/{shared-types, test-utils}` | — | (no tests yet) |
| `apps/api` legacy | 2 | F-INFRA-001 self-tests preserved |

`pnpm -r run typecheck` — all 8 typechecked packages green.
`pnpm -r run test` — all suites green.

## Known follow-ups (post-merge)

1. ~~**Spec back-fill** — write F-003 / F-004 / F-005 / F-CARD-001 /~~
   ~~F-TEL-001 specs for code that already landed.~~ → **Done** in this PR:
   F-003 / F-CARD-001 / F-HOYA-001 / F-PREV-001 specs land. F-004 / F-005
   / F-TEL-001 deferred (placeholder or out-of-scope).
2. **Real audio assets** — 30 jamo MP3s sourced from a single native
   speaker. Until then, TTS fallback is the default.
3. ~~**Hoya illustration** — geometric SVG is placeholder.~~ → Refined to
   the brief in PR #16. Still placeholder until commissioned illustrator
   art lands; the SVG contract is the design specification.
4. **STT** — real Voice Echo grading via on-device or Google Speech-to-Text
   (blocked on STT bench, INBOX T-013).
5. **D1 binding** — `wrangler.toml` to add `[[d1_databases]]` binding and
   run `wrangler d1 migrations apply` with `db/schema.sql`.
6. **Detox e2e** — nightly device run wiring up Welcome → Quest →
   Results → Library happy path.
7. **COPPA / PIPA / GDPR-K** — privacy policy + data minimization audit
   before any public beta.

---

## Post-v1.0 follow-on PRs (Week 4 design + visual polish)

What landed on `main` after PR #13:

| PR | Title | Highlights |
|---|---|---|
| **#14** | `design(brief): full Claude Design prompt library (37 docs) for v1.0` | 37 prompt-ready briefs in `design/brief/` covering foundation (3) + character (1) + illustrations (2) + components (11) + screens (20) |
| **#15** | `design(tokens,web): activate token drift gate + add /design-preview route` | 5 `design/tokens/*.v1.md` spec docs activate the previously-dormant F-DES-001 gate. `/design-preview` Next.js route reconstructs the entire design system from tokens for browser review (17 sections) |
| **#16** | `design(hoya): refine v1 SVG placeholder per character-sheet brief` | Hoya 5 poses differentiated: thinking looks UP-RIGHT (anti-shame), 3 stripes per side, reading adds a book, cheering adds 4-point sparkles, pose-conditional cheek visibility |
| **#17** | `design(card-art): add HeritageCardArt SVG component — 6 illustrated cards` | First 6 Heritage card SVGs (1 per theme + 1 legendary) consumed by LibraryScreen + CardDetailScreen |
| **#18** | `design(card-art): complete all 30 Stage 1 Heritage card illustrations` | All 30 Stage 1 cards illustrated. The Library tab now shows a true collection — every card the child can earn has unique art |
| this PR | F-XXX spec back-fill + DONE roll-up | F-003 / F-CARD-001 / F-HOYA-001 / F-PREV-001 specs document the work that landed. CLAUDE.md §5 governance debt cleared |

### What this means

The v1.0 prototype (PR #13) shipped under a temporary "build everything fast, back-fill specs later" exception. As of this PR, the exception is **closed**:

- All code that landed during the exception has a corresponding F-XXX spec (or is explicitly marked Phase 2 / placeholder).
- Future code changes follow CLAUDE.md §5 strictly: spec first, then code.
- Design briefs (`design/brief/`) and design tokens (`design/tokens/*.v1.md`) are the canonical sources of truth for visual work; both are CI-enforced.

### Open INBOX items aligned to this state

- F-004 Trace Stroke (real gesture-path matching, blocked on react-native-gesture-handler eval)
- F-CARD-002 Heritage Card back-face design
- F-MOTION-001 Hoya pose transitions
- F-VR-001 Visual regression coverage (Storybook + screenshot diffs)
- STT bench (T-013) — Korean child-voice STT viability
- Real illustrator commission for Hoya 5-pose + 30 cards (replaces SVG placeholders)
