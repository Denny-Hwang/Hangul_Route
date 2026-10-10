# Hangul Route

Korean language learning app (web PWA first, same code on iOS/Android) for anyone learning Hangul from zero, at any age — kids, teens and adults, Korean heritage families (parents or grandparents speak Korean, the learner does not yet) and K-culture fans. Everyone plays the same quests and cards; many learners are children, so child-safety design (parent gate, no ads, local-first data) stays everywhere. The UI is English by default, with Korean and Spanish planned as selectable UI languages. Learning unfolds on a **Heritage Journey** grid — Stage (Hangul → Word → Sentence → Dialogue → Story → Real-use → Self-expression) × Culture theme (letters · life · rites · nature · crafts) — and each learner draws their own **Route** through it. Guide character is a young tiger named **Hoya (호야)**, and the main reward is a **cultural heritage card collection**.

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
