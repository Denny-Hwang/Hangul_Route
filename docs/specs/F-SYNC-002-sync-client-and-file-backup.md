# F-SYNC-002 — Sync client wiring + file backup/restore UI

**Status**: `ready`
**Scope**: `apps/mobile` (all platforms; web first)
**Owner**: solo dev
**Rollout**: Roadmap S1, second PR (after F-SYNC-001)

Parent: `docs/specs/F-SYNC-001-progress-sync.md` · wireframes `design/wireframes/sync/restore.md`, `sync/merge-notice.md`, `profile/settings.md`

---

## 1. Context

F-SYNC-001 shipped the server object and the pure merge/summary/engine. This spec wires them into the app so a learner's snapshot is uploaded in the background, merged on conflict, and — independently of any server — can be **exported to a file and restored from one** by a parent.

## 2. User story

> As a parent, I want my child's progress to save itself when we are online, and I want a file I can keep myself if I do not trust the cloud.

## 3. Acceptance criteria

### 3.1 Device identity and registration

- A per-device id (`device:id`, random UUID) is created once through `platform/storage`.
- The first sync for a learner registers it (`POST /api/sync/learners`) with the local profile id; the returned device secret is stored per learner (`sync:<learnerId>`), never synced, never shown.

### 3.2 When sync runs

- Only when `flags.syncEnabled` and an API base URL is configured (the placeholder endpoint sends nothing — same rule as telemetry).
- Triggers: app start (after hydration), every progress write (debounced **30 s** per learner), back-online.
- The engine's result is applied: a merged snapshot replaces the local one (never a subset of it), and the stored `rev` advances. `retry-later` and errors leave local data untouched and try again on the next trigger.
- Sync never blocks a quest, never shows a spinner on a child surface, and never throws.

### 3.3 Settings: "Progress backup" card (`profile/settings`)

- Status line: *Saved to the cloud · just now / 3 min ago* · *Saved on this device only* (no API) · *Couldn't reach the cloud — will retry* (last error).
- **Back up to a file** → writes `hangul-route-<name>-<date>.hangulroute.json` (web: download; native: share sheet).
- **Restore from a file** → PIN-gated → `sync/restore` file path: pick a file, decode (F-SYNC-001 §3.6), then:
  - a profile with the same id exists → **merge** into it (never overwrite) and show the merge notice ("We found <name>'s cards! Added N cards, M quests.")
  - otherwise → create the profile from the file and attach the snapshot.
  - malformed / unsupported → one calm line, the file is ignored.

### 3.4 Platform wrappers

- `platform/device.ts` (id), `platform/sync-api.ts` (fetch + device header, typed results, never throws), `platform/file.ts` (+ `.web.ts`): `saveTextFile`, `pickTextFile`.

## 4. Out of scope

- Rescue Code and account sign-in paths of `sync/restore` → F-RESTORE-001 / F-AUTH-002.
- Caregiver reads of `summary` → F-PAR-001 wiring after F-SPACE-001.

## 5. Tests

| File | Coverage |
|---|---|
| `platform/__tests__/device.test.ts` | id created once and reused |
| `platform/__tests__/sync-api.test.ts` | register / put / get / inbox result mapping, 409 → conflict, network → error |
| `platform/__tests__/file(.web).test.ts` | save + pick wrappers |
| `logic/sync/__tests__/scheduler.test.ts` | debounce per learner |
| `logic/sync/__tests__/restore.test.ts` | merge-into-existing vs create-new decisions + notice counts |
| `store/__tests__/sync-store.test.ts` | register-then-sync, applies merged snapshot, error keeps local |
| `e2e/web/backup.spec.ts` | export downloads a `.hangulroute.json`; restoring it into a fresh profile brings the cards back |
