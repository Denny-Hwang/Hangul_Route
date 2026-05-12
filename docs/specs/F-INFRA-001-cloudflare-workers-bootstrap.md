# F-INFRA-001 — Cloudflare Workers Bootstrap

**Status**: `ready`
**Scope**: Infra
**Owner**: solo dev
**Rollout**: MVP (foundational)

---

## 1. Context

CLAUDE.md §2 declares `apps/api` as the Cloudflare Workers entry, but the directory did not exist. Without a runnable Worker scaffold:
- `wrangler dev` cannot be invoked.
- `packages/backend` (handlers) has no consumer.
- `preview-deploy.yml` has nothing to deploy.

This spec covers the **minimum viable Worker** that proves the deploy path end-to-end. It is intentionally feature-empty: a `GET /` health endpoint returning JSON. Real handlers land via subsequent specs (F-002+).

## 2. User story

> As a solo developer, I want a runnable Worker scaffold so that I can verify the Cloudflare deploy path before writing any business logic — and so that downstream `F-XXX` specs can reference a real entry point.

## 3. Acceptance criteria

- **Given** the repo is freshly cloned and `pnpm install` has completed,
  **when** I run `pnpm --filter @hangul-route/api run typecheck`,
  **then** the command succeeds with no errors.

- **Given** a Cloudflare account is bound via `wrangler login` and `wrangler.toml` is committed,
  **when** I run `wrangler dev` from `apps/api/`,
  **then** the Worker listens on `localhost:8787` and `GET /` returns:
  ```json
  { "service": "hangul-route-api", "status": "ok", "message": "Hello, Hoya!" }
  ```

- **Given** `apps/api` exists in the workspace glob `apps/*`,
  **when** Turborepo runs `pnpm turbo run typecheck`,
  **then** `@hangul-route/api` is included in the task graph.

- **Given** the file `apps/api/src/index.ts`,
  **when** TypeScript strict mode is enforced (CLAUDE.md §4),
  **then** no `any` types appear and `tsc --noEmit` passes.

## 4. Out of scope

- D1 bindings, R2 bindings, KV bindings → separate specs (F-INFRA-002+).
- Authentication (Clerk integration) → F-AUTH-001.
- Hono router structure beyond `/` and `/health` → grows with first real handler spec.
- CI auto-deploy to Cloudflare staging → covered by `preview-deploy.yml` once `F-CFG-001` (secret bindings) ships.
- `pnpm-lock.yaml` generation → tracked as T-003 in INBOX, not blocked on this spec.

## 5. UI sketch

N/A — backend-only.

## 6. Tests

- **Unit (W4 target 90 %)**: route handler returns expected JSON shape. Lives in `apps/api/src/__tests__/index.test.ts` (added with first real handler — this spec only ships scaffold).
- **Integration**: deferred until first D1-bound handler.
- **E2E**: deferred until preview-deploy CI is functional.

> Tests are not required for this spec because no business logic ships. CLAUDE.md §6 coverage targets do not apply to a pure router stub. The first real handler PR will add the test scaffold.

## 7. Rollout

MVP — foundational infrastructure.

## 8. Dependencies

- **Upstream**: none.
- **Downstream blockers**:
  - F-AUTH-001 (Clerk integration)
  - F-INFRA-002 (D1 schema + bindings)
  - F-INFRA-003 (R2 asset bucket)
  - F-CFG-001 (wrangler secrets / env bindings)
- **External**: a Cloudflare account with Workers Free plan (50 K req/day, well within MVP).
