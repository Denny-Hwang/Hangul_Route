# F-AUTH-003 — Ownership guards on profiles & progress

**Status**: `ready`
**Scope**: Backend
**Owner**: solo dev
**Rollout**: MVP (security)

---

## 1. Context

F-AUTH-001 gated subscription routes behind family ownership. The same hole
still exists on **profiles** and **progress**: anyone who knows a `familyId`
or `profileId` can read, create, or delete a child profile, or read/overwrite
a child's learning progress. This spec extends the `authorizeFamily` pattern
to those routes.

`telemetry` stays open: it is fire-and-forget anonymous analytics with no
read-back, so an ownership gate adds friction without protecting readable PII.

## 2. User story

> As a parent, I want only my account to see or change my children's profiles
> and learning progress.

## 3. Acceptance criteria

- New `authorizeProfile(c, profileId)` resolves the profile's family and
  reuses `authorizeFamily` (404 if the profile doesn't exist).
- `/api/profiles`:
  - `GET /?familyId=` → owner only
  - `POST /` (body.familyId) → owner only
  - `GET /:id`, `DELETE /:id` → owner of the profile's family
- `/api/progress/:profileId` GET + PUT → owner of the profile's family
- All: no bearer → 401, non-owner → 403, missing → 404.
- `telemetry` unchanged.
- api typecheck + tests pass (existing profile/progress tests send the owner bearer).

## 4. Out of scope

- Mobile sending the token (F-AUTH-002).
- Telemetry auth / rate-limiting.

## 5. Tests

- profiles + progress: owner passes, no-bearer 401, non-owner 403.
- Existing `api-v1` / `api-v1-extended` profile & progress calls updated to
  send the owner bearer.

## 6. Dependencies

- **Upstream**: F-AUTH-001.
- **Downstream**: F-AUTH-002 (mobile sign-in).
