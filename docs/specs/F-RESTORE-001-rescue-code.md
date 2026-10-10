# F-RESTORE-001 — Rescue Code (account-less restore)

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/mobile`
**Owner**: solo dev
**Rollout**: Roadmap S2 (`docs/roadmap/multi-persona-sync-platform.md` §5.1); owner decision 2026-09-20: **auto-generated for every learner**

Parent: F-SYNC-001 / F-SYNC-002 · wireframes `design/wireframes/sync/save-progress.md`, `sync/restore.md`, `sync/merge-notice.md`, `onboarding/welcome.md`

---

## 1. Context

Most learners have no adult account (P-A) and many never will. When their device is lost or the app is deleted, the only thing that can bring the collection back is something a grown-up wrote on paper: a **Rescue Code** — four child-readable English words and six digits, e.g. `TIGER-MOON-RIVER-APPLE-482139` (codes issued before 2026-10 are two words and four digits, `TIGER-MOON-4821`, and still work). The server keeps only its hash; presenting the code from a new device binds that device to the learner and pulls the snapshot.

## 2. User story

> As a parent, I want a short code I can write on the fridge that brings my child's cards back on any device — and I want to be able to replace it if someone else sees it.

## 3. Acceptance criteria

### 3.1 Format and generation

- Code = `WORD-WORD-WORD-WORD-DDDDDD` (SEC-5, 2026-10-09): four words from a 256-word list of simple English nouns (animals, nature, food), six digits — 4 × 8 + 6 × log₂10 ≈ **51.9 bits** (≈ 4.3 × 10¹⁵ codes). Drawn with `crypto.getRandomValues`: one byte per word (the list is exactly 256, so no modulo bias) and a rejection-sampled uint32 for the number. Normalized to upper case; hyphens and spaces are interchangeable on entry, digit groups (`482 139`) are joined.
- **Codes already issued** — `WORD-WORD-DDDD`, two words + four digits (≈ 29 bits, `Math.random`) — keep restoring until a parent rotates them; the schema (`normalizeRescueCode`, `RESCUE_CODE_FORMATS`) accepts both shapes and nothing else.
- `POST /api/recovery/issue` (device auth, or a family owner / caregiver account — see F-TCH-001 §10.2) generates a code for the learner, stores its hash in `learners.recovery_hash`, and returns the plaintext **once**. Issuing again replaces the hash (rotation): the old code stops working. A hash already held by another learner (`recovery_hash` is UNIQUE) makes the server draw again, up to 3 times (then 500 `code_unavailable`).
- **Hash at rest**: with the Worker secret `RESCUE_PEPPER` set, `HMAC-SHA-256(pepper, code)`; without it, `sha256(code)` — what every earlier code was stored under. Claims look a code up by the keyed hash, then by `sha256(code)`, so setting the pepper later strands no code. Once set, the pepper must never change or be deleted (codes hashed under it would stop matching).
- The client requests a code automatically after the learner's **first successful cloud sync** and keeps it locally (`sync:<learnerId>.rescueCode`) so a parent can read it later; it is never synced or logged.

### 3.2 Claim

- `POST /api/recovery/claim` `{ code, deviceId }` (no auth). On a hash match: binds `(learnerId, deviceId)` with a fresh secret and returns `{ learner, device: { secret }, snapshot: { rev, snapshot, summary } | null }`. `learner` never carries `recovery_hash`.
- The claiming device keeps the normalized code locally (same `rescueCode` slot as the issuing device) so `sync/save-progress` shows it there too and the next sync does **not** mint a replacement — the code on the fridge stays valid until a parent rotates it.
- Wrong code → 404 `code_not_found` (never distinguishes "no such code" from "wrong digits").
- **Rate limit**: 5 claims per client key per hour (`cf-connecting-ip`, else `x-forwarded-for`, else `anonymous`); beyond that 429 `too_many_attempts` with `retryAfterSeconds`. The counter lives in each Worker isolate, so it is not durable across isolates or redeploys. A D1-backed counter is a follow-up: it needs a new table, cleanup, and IP-as-personal-data handling, and at ≈ 52 bits online guessing is out of reach anyway. Legacy 29-bit codes are the weak spot until they are rotated.
- Claiming does **not** rotate the code (owner decision above: the code on the fridge stays valid until a parent rotates it).
- A claim always binds the device with scope `full`, which also widens a device a teacher's re-link bound with scope `class` (F-TCH-001 §10.1).

### 3.3 Client — `sync/save-progress` (PIN-gated)

- Shows the code as a large block, **Copy**, **Share** (text share sheet), **Save now** (forces a sync), "Last saved" line, and **Get a new code** (confirm → rotate). Copy addressed to the parent: "Write this down. It brings <name>'s cards back on any device."
- No code yet (never synced / no API): shows the status line from the Backup card instead and a **Save now** button.

### 3.4 Client — `sync/restore` code path

- Entered from `onboarding/welcome` ("I already have progress") and from `profile/settings`.
- One code field (typed or pasted; any case, spaces or hyphens; either code shape) → **Find my cards** → claim → local profile created (or merged when a profile with the same id exists) → credentials adopted → merge notice → `profiles/picker` / Home. (Was three WORD · WORD · 1234 fields, which could not take the four-word shape or a pasted code.)
- Errors: not found → "Check the code and try again." · 429 → "Let's wait a few minutes." · offline → "This needs internet." Nothing is worded at the child.

## 4. Out of scope

- Emailing the code (needs Resend keys; roadmap §5.1 keeps the option) → F-RESTORE-002.
- Sign-in path of `sync/restore` → F-AUTH-002. Teacher re-link → F-SPACE-001.

## 5. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/sync.test.ts` | code format + normalization schema, both shapes |
| `backend/__tests__/recovery.test.ts` | crypto generator (no `Math.random`, ≥ 50 bits, unbiased), issue returns plaintext once, rotation invalidates, claim binds + returns snapshot, 404 / 429, normalization, keyed hash with `RESCUE_PEPPER`, legacy codes restore with and without it, collision redraw, grown-up re-issue permission matrix |
| `backend/db/__tests__/db-contract.test.ts` | `recovery_hash` UNIQUE on both backends |
| `backend/lib/__tests__/rate-limit.test.ts` | sliding window |
| `mobile/logic/sync/__tests__/rescue-code.test.ts` | parse / format / normalize |
| `mobile/store/__tests__/sync-store.test.ts` | code issued after first sync, rotate, claim adopts learner |
| `mobile/platform/__tests__/share-text.test.ts` | share / clipboard fallback |
