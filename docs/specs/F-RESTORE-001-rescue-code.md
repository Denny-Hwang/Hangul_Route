# F-RESTORE-001 — Rescue Code (account-less restore)

**Status**: `ready`
**Scope**: `packages/content-schema` · `packages/backend` · `apps/mobile`
**Owner**: solo dev
**Rollout**: Roadmap S2 (`docs/roadmap/multi-persona-sync-platform.md` §5.1); owner decision 2026-09-20: **auto-generated for every learner**

Parent: F-SYNC-001 / F-SYNC-002 · wireframes `design/wireframes/sync/save-progress.md`, `sync/restore.md`, `sync/merge-notice.md`, `onboarding/welcome.md`

---

## 1. Context

Most learners have no adult account (P-A) and many never will. When their device is lost or the app is deleted, the only thing that can bring the collection back is something a grown-up wrote on paper: a **Rescue Code** — two child-readable English words and four digits, e.g. `TIGER-MOON-4821`. The server keeps only its hash; presenting the code from a new device binds that device to the learner and pulls the snapshot.

## 2. User story

> As a parent, I want a short code I can write on the fridge that brings my child's cards back on any device — and I want to be able to replace it if someone else sees it.

## 3. Acceptance criteria

### 3.1 Format and generation

- Code = `WORD-WORD-DDDD`: two words from a 256-word list of simple English nouns (animals, nature, food), four digits. ≈ 6.5 × 10⁸ combinations. Normalized to upper case; hyphens and spaces are interchangeable on entry.
- `POST /api/recovery/issue` (device auth) generates a code for the learner, stores `sha256(code)` in `learners.recovery_hash`, and returns the plaintext **once**. Issuing again replaces the hash (rotation): the old code stops working.
- The client requests a code automatically after the learner's **first successful cloud sync** and keeps it locally (`sync:<learnerId>.rescueCode`) so a parent can read it later; it is never synced or logged.

### 3.2 Claim

- `POST /api/recovery/claim` `{ code, deviceId }` (no auth). On a hash match: binds `(learnerId, deviceId)` with a fresh secret and returns `{ learner, device: { secret }, snapshot: { rev, snapshot, summary } | null }`. `learner` never carries `recovery_hash`.
- The claiming device keeps the normalized code locally (same `rescueCode` slot as the issuing device) so `sync/save-progress` shows it there too and the next sync does **not** mint a replacement — the code on the fridge stays valid until a parent rotates it.
- Wrong code → 404 `code_not_found` (never distinguishes "no such code" from "wrong digits").
- **Rate limit**: 5 claims per client key per hour (`cf-connecting-ip`, else `x-forwarded-for`, else `anonymous`); beyond that 429 `too_many_attempts` with `retryAfterSeconds`.

### 3.3 Client — `sync/save-progress` (PIN-gated)

- Shows the code as a large block, **Copy**, **Share** (text share sheet), **Save now** (forces a sync), "Last saved" line, and **Get a new code** (confirm → rotate). Copy addressed to the parent: "Write this down. It brings <name>'s cards back on any device."
- No code yet (never synced / no API): shows the status line from the Backup card instead and a **Save now** button.

### 3.4 Client — `sync/restore` code path

- Entered from `onboarding/welcome` ("I already have progress") and from `profile/settings`.
- Inline fields WORD · WORD · 1234 → **Find my cards** → claim → local profile created (or merged when a profile with the same id exists) → credentials adopted → merge notice → `profiles/picker` / Home.
- Errors: not found → "Check the code and try again." · 429 → "Let's wait a few minutes." · offline → "This needs internet." Nothing is worded at the child.

## 4. Out of scope

- Emailing the code (needs Resend keys; roadmap §5.1 keeps the option) → F-RESTORE-002.
- Sign-in path of `sync/restore` → F-AUTH-002. Teacher re-link → F-SPACE-001.

## 5. Tests

| File | Coverage |
|---|---|
| `content-schema/__tests__/sync.test.ts` | code format + normalization schema |
| `backend/__tests__/recovery.test.ts` | issue returns plaintext once, rotation invalidates, claim binds + returns snapshot, 404 / 429, normalization |
| `backend/lib/__tests__/rate-limit.test.ts` | sliding window |
| `mobile/logic/sync/__tests__/rescue-code.test.ts` | parse / format / normalize |
| `mobile/store/__tests__/sync-store.test.ts` | code issued after first sync, rotate, claim adopts learner |
| `mobile/platform/__tests__/share-text.test.ts` | share / clipboard fallback |
