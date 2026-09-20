# Hangul Route

Korean language learning app (web PWA first, same code on iOS/Android) for English speakers starting Korean from zero. Primary users are children ages 5–11 — Korean heritage kids (parents speak Korean, child does not) and international kids curious about K-culture; adult beginners use the same quests and cards (kids-first, never kids-only). Learning unfolds on a **Heritage Journey** grid — Stage (Hangul → Word → Sentence → Dialogue → Story → Real-use → Self-expression) × Culture theme (letters · life · rites · nature · crafts) — and the child draws their own **Route** through it. Guide character is a young tiger named **Hoya (호야)**, and the main reward is a **cultural heritage card collection**.

MVP scope: Stage 1 (Hangul) full build + Stage 2 / Stage 4 tastes. The
full-vision prototype (`feat: full v1.0 build`) ships an end-to-end runnable
app — see [`docs/build-v1-prototype.md`](./docs/build-v1-prototype.md).

## Documents

- Project charter & working rules → [`CLAUDE.md`](./CLAUDE.md)
- Blueprints, workflows, weekly retros → [`docs/`](./docs/)
- Daily design playbook → [`design/playbook/`](./design/playbook/)
- Routine specs (R1/R2/R3/R4/R6) → [`routines/`](./routines/)
- Skills (`.claude/skills/`) — 8 Skills auto-triggered by Claude Code

## Tech Stack

Turborepo + pnpm workspaces · Expo React Native · Next.js · Cloudflare Workers (D1 / R2) · TypeScript strict · vitest (TDD).

See `docs/blueprints/03-engineering-blueprint-v2.md` for rationale.
