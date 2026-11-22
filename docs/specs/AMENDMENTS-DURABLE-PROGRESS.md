# AMENDMENTS-DURABLE-PROGRESS — a failed read is never "nothing saved"; a failed write is never silent

Status: draft, revision 2 (2026-11-21, written for work order WO-01 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row DP-0). The multi-agent review of 2026-11-21 (§11) is adjudicated in this revision. It becomes `ready` when the owner accepts §10 OD-DP1 – OD-DP3.

**Amends**: F-PROF-001 §3.1 (cold launch: the list read at launch) · F-SYNC-002 §3.2 (sync triggers: no sync for a learner whose record could not be read) · F-RESTORE-001 (restore over a record that could not be read) · F-STORY-006 §3.3 (the welcome card on a record that was never read) · AMENDMENTS-ONE-ACCOUNT-MANY-USERS §13.4 (one new grown-up destination) · tag **[DP]**
**Scope**: `apps/mobile` — `platform/storage(.web).ts` (two new exports, no signature change), `store/durable-read.ts` (new), `store/progress-store.ts`, `store/profile-store.ts`, `store/profile-keys.ts`, `store/sync-store.ts`, `store/plan-store.ts`, `store/bootstrap.ts`, `App.tsx`, `logic/memory/memory-chunk.ts`, `screens/stage-check/stage-ceremony-latch.ts`, `screens/restore/RestoreScreen.tsx`, the chooser and Home (one check each), one system screen and one grown-up sheet; `packages/i18n` (en, es, ko); `packages/content-schema` and `packages/backend` (telemetry names and Worker rule)
**Owner**: solo dev
**Rollout**: next release; no migration; Worker before app for telemetry (§3.9)
**UI sketch**: §5

---

## 1. Context

The charter promises that earned stars, cards and collection progress are never taken away (CLAUDE.md §1, anti-shame rules). Two storage paths in the learner app can break that promise without anyone seeing it. Re-read on `5573e1072`.

**A failed read looks like an empty device.**

- `readJson` returns `null` for a missing key, for a read that threw, and for a value that does not parse (`apps/mobile/src/platform/storage.ts:11-18`; web `storage.web.ts:12-19`). The same files have reads that tell these apart: `readJsonStrict` (a failed read throws, but unparsable bytes return `null`, `storage.ts:25-33`), `readJsonExact` (a failed read and unparsable bytes both throw; only a missing key or `''` is `null`, `:40-44`), and `readJsonExactFresh` for one retry on a new connection (`:50-52`; web: a new IndexedDB connection, `storage.web.ts:56-65`). None returns the raw bytes.
- **Progress.** `hydrate` reads the record with `readJson` (`store/progress-store.ts:504`) and always marks the profile hydrated (`:521`). After that every write goes straight to storage (`persist` → `save`, `:385-389`; 15 callers, `:577-843`). So after one failed read, the next finished quest saves a record built on a blank one over the real one.
- **Sync.** At launch `App.tsx:170-173` runs `rederiveAllLocal()` (plan derive: `await hydrate` then `ensure()`, `plan-store.ts:106-113`, which puts a blank snapshot in `byProfile`) and then `syncAll()`; `runSync` (`sync-store.ts:420-422`) uploads `byProfile[learnerId]` once hydrate has run. Its guard ("never upload what is in memory before the saved snapshot has loaded") trusts "hydrated" to mean "read". After a failed read, a blank record with a newer `updatedAt` can be pushed and win last-write-wins fields on the server.
- **Profiles.** `hydrate` reads the list, the active id and the tombstones with `readJson` (`store/profile-store.ts:352-358`) and sets `hydrated: true` whatever came back (`:366`), so a failed list read shows first-run Welcome. Whether a later write then replaces the stored list depends on the failure: `persistList` → `flushLocked` (`:211-228`) re-reads with `readStored` (`readJsonStrict`, `:192-194`) and merges; on a read error it writes nothing, but **unparsable bytes read as `null`, so the stored list counts as empty and is overwritten** (the tombstones the same way, `:227`; `promoteGuest`'s re-read, `:500`, likewise).
- **Boot.** `hydrateLearnerData` throws when any hydrate rejected (`store/bootstrap.ts:79-80`); `App.tsx:148-149` drops that error and starts the app anyway.

**A failed write is silent.**

- `save` calls `void writeJson(...)` with no `catch` and then `notifyProgressPersisted` as if it had worked (`progress-store.ts:311-315`); `replaceSnapshot` writes the same way and notifies when the reconcile changed something (`:779-780`). Outside the store, `logic/memory/memory-chunk.ts:92-93, 103-104, 200-201, 255-256` and `screens/stage-check/stage-ceremony-latch.ts:23-24` call `notifyProgressPersisted` right after `replaceSnapshot`, without waiting for the write. On a full disk the learner keeps playing and earning, and loses it at the next launch.

The profile-lock record already solved the read half (`AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` §13.2: unparsable counts as failed, one retry on a fresh connection, then fail closed). This amendment applies that rule to the records that hold everything a learner has earned.

## 2. User story

> As a learner coming back to the app, I see my cards and stars, or I see that the app could not open them and can try again. I never see an empty app that then replaces what I had.
>
> As a parent, if the device could not save today's progress, I find that out on the device, in the Grown-up area, not weeks later.
>
> As an adult learning on my own phone, the message tells me what I can do, not to "ask a grown-up".

## 3. Acceptance criteria

### 3.1 One read contract

| Outcome | Meaning | How |
|---|---|---|
| `missing` | the key is absent or `''` | `readRawExact` returns `null` |
| `value` | the bytes parse | `JSON.parse` of the raw string |
| `failed` / `read` | the read threw, and the one retry on a fresh connection threw too | `readRawExact`, then `readRawExactFresh`, both throw |
| `failed` / `parse` | the bytes were read and `JSON.parse` threw a `SyntaxError` | — |

- New exports in **both** `storage.ts` and `storage.web.ts`: `readRawExact(key): Promise<string | null>` and `readRawExactFresh(key)` (throw on a failed read, like `readJsonExact`), and `writeRaw(key, raw: string): Promise<void>` (through `writePasses`, no `JSON.stringify`). The store never calls AsyncStorage or idb-keyval directly (CLAUDE.md §8).
- `store/durable-read.ts`: `durableRead(key) → { kind: 'missing' } | { kind: 'value', value: unknown } | { kind: 'failed', cause: 'read' | 'parse', raw?: string }`.
- Under the contract: `progress:<profileId>` (including a guest's, `bootstrap.ts:68`), `PROFILES_KEY`, `ACTIVE_KEY`, `PROFILE_TOMBSTONES_KEY`. `readStored` (`profile-store.ts:192-194`) and `promoteGuest`'s re-read (`:500`) use it too, so damaged list or tombstone bytes are never merged as empty.
- `readJson` and `readJsonStrict` are unchanged; other stores keep them (§4).
- Schema repair is unchanged: a value that parses but holds an old or partial shape still goes through `withSnapshotDefaults` / `storedProfileItems`.

### 3.2 Progress: a record that could not be read is never written over

- **Given** a profile whose progress read is `failed`, **when** hydrate finishes, **then** the profile is **not** in `hydratedFor`; it is in `loadFailedFor: Map<string, 'read' | 'parse'>`.
- **Given** a profile in `loadFailedFor`, **when** any write path runs (`save`, `persist`, `reset`, `replaceSnapshot`, `ensure`), **then** nothing is written and `notifyProgressPersisted` is not called. Changes stay in memory in `pendingFor`, as a write before the read is held today (`progress-store.ts:379-392`), and a later successful read merges them the same way (`:507-516`).
- **No automatic re-read.** `persist` and `ensure` start `hydrate()` for a profile that is not hydrated (`:385-393`, `:545-546`); for a profile in `loadFailedFor` they do not. Only Try again (§3.5) re-reads. (So `storage.read_failed` fires once per Try again, not once per tap.)
- **Sync.** `runSync`, `requestSync` and `applyServerSnapshot` (`sync-store.ts:393-400, 420-422`) do nothing for a learner in `loadFailedFor`: no push, no pull, no registration. `plan-store.derive` does nothing for one.
- **Restore.** `RestoreScreen` (file restore, `:84-87`) and the server adopt (`sync-store.ts:595`) refuse a learner in `loadFailedFor` and show `progressReadFailed.restoreBlocked`; recovery for that learner goes through the grown-up sheet (§3.6).
- **Who notifies.** `replaceSnapshot` takes `{ notify?: boolean }` and calls `notifyProgressPersisted` itself, after the awaited write (§3.7). The direct calls in `memory-chunk.ts` and `stage-ceremony-latch.ts` are removed in favour of the option.
- `reset` has no production caller today; it is refused (no write) for a profile in `loadFailedFor`.
- A `missing` record is a new learner: unchanged (blank record, welcome card in memory until the first real write, F-STORY-006 §3.3).

### 3.3 Profiles: a list that could not be read never shows first run

- **Given** the list read is `failed`, **when** `useProfileStore.hydrate` finishes, **then** `hydrated` stays `false`, `loadFailed: 'read' | 'parse'` is set, and `profiles` stays empty. While `loadFailed` is set nothing writes `PROFILES_KEY`, `ACTIVE_KEY` or the tombstones: `persistList`, `flushLocked`, `refresh`, `promoteGuest`, `persistActive` (from `followMerged` `:290` and `commitSet` `:334`), the tombstone sweep (`:363`) and the legacy-hash rewrite (`:367`) all check it. The device gate and the native gate already wait for `hydrated` (`device-gate.ts:111`, `native-gate-state.ts:49`).
- **`PROFILE_TOMBSTONES_KEY` failed alone:** the list is shown **without** any profile whose per-profile keys are already gone (no `progress:<id>` key: it was swept), the sweep is skipped, and list writes are held as above until a tombstone read succeeds (Try again, or the next launch). A removed learner never comes back.
- **`ACTIVE_KEY` failed alone:** with one profile, use it; with two or more, open the chooser (OA-D6), never a sibling's record. The active key may be written again after the learner picks (it holds nothing earned).

### 3.4 Boot

- `App.tsx` stops dropping the error and decides from store state, not from the thrown error: when `useProfileStore.loadFailed` is set, or the active profile is in `loadFailedFor`, it renders **ProgressReadFailedScreen** instead of the navigator. Other hydrate rejections are ignored as today.
- The post-hydrate chain (`App.tsx:156-173`: `setReady`, `rederiveAllLocal`, `activateMemory`, `syncAll`) runs once, after the first boot that is not blocked.
- A failed progress read for a profile that is **not** active does not block boot. The chooser marks nothing; when that learner is chosen (chooser, or their Home), they get the screen in its learner variant.

### 3.5 ProgressReadFailedScreen

Layout and variants: the wireframe (§5). `OopsScreen`'s layout (Hoya `thinking`, title, body, bubble, hero button), same tokens, no `colors.feedback.danger`, no X or warning icon.

| Button | Shown | Does |
|---|---|---|
| **Try again** (hero) | always | **List variant:** reruns `hydrateLearnerData` in full (the per-profile hydrates were built from an empty list, `bootstrap.ts:50-71`). **Learner variant:** reruns that learner's progress hydrate. Busy state; cannot be pressed twice during a try. On `value` or `missing`, the screen goes and held writes are merged and saved. |
| **Choose another learner** (secondary) | learner variant, when the device has 2 or more profiles | opens the chooser; locks still apply (OA-D9) |
| **A grown-up can help** (ghost) | `parse` only (the bytes are damaged and Try again cannot change them), and only once §3.6's copy is kept | opens the grown-up gate (AMENDMENTS-ONE-ACCOUNT-MANY-USERS §13.4) to the new destination `RecoverRecord` (appended to `GrownUpDestination`) |

- After 3 tries in a session a line shows under the bubble (polite live region, announced once): `progressReadFailed.stillStuck`.
- There is no "Start over" or "New learner" button on this screen.

### 3.6 Damaged bytes: kept, then recoverable by a grown-up

**Keeping a copy.**

- When a read is `failed/parse`, the raw string is written with `writeRaw` to one slot before anything else: `progress-damaged:<profileId>` (registered in `PER_PROFILE_KEYS` as `'progress-damaged'`, so the id stays at the end and Remove from this device sweeps it, `profile-key-sweep.ts:9`) or `profiles-damaged` for the list. `ACTIVE_KEY` and the tombstones get no copy (they hold nothing earned).
- **One slot, never overwritten**: if the slot already holds a copy, no new copy is made (the first copy is the one closest to the learner's real record). No pile-up.
- The slot is removed only (a) by Remove from this device for that learner, (b) 30 days after the original key reads `value` again or a grown-up recovery replaced it. Removing any learner also removes `profiles-damaged` (it may hold their name).
- If the copy write fails (fence refusal or a full disk), `kept` is false, the original key is still untouched, and **A grown-up can help** is not offered (only Try again).

**The grown-up sheet (`RecoverRecord`).** Default focus on **Not now** (the safe choice first).

| Action | Shown | Does |
|---|---|---|
| **Get it back from the cloud save** | learner variant, when the learner has a server copy (F-SYNC-002) | pulls the server snapshot and writes it with `recoverRecord(profileId, snapshot)` |
| **Start fresh on this device** | always | writes a blank record (learner) or an empty list (list variant; then Welcome shows with Restore, as on a new device) with `recoverRecord`. Per-profile keys of the old profiles are left untouched |
| **Not now** | always | closes |

- `recoverRecord` is the only write path past the §3.2/§3.3 guards: it checks that the damaged copy exists and reads back equal to what was read, writes once, then clears `loadFailedFor` / `loadFailed` and runs the post-hydrate chain.
- If the gate's own record cannot be read, the sheet is not offered (fail closed; Try again stays).

### 3.7 Writes: detect, retry, tell

- `save` and `replaceSnapshot` await the write; `notifyProgressPersisted(profileId)` is called only after it resolves.
- **One queue per profile**: writes run in order; an older write's retry never lands after a newer write. A newer snapshot replaces a queued retry of an older one (only the latest is retried).
- A rejected write is retried after 1 s, 4 s and 15 s; then again on each app foreground, before backgrounding (a best-effort flush), and with each new write.
- `saveFailedFor: Set<string>` holds a profile while it has an unsaved snapshot after its first failed try; the next successful write clears it.
- Where it shows (one quiet line, `tone="secondary"`, no error icon):
  - Results (`screens/results/ResultsScreen.tsx`, under the headline `:504`): `results.saveLater`.
  - Profile (`screens/profile/ProfileScreen.tsx`, above the grown-up section): `profile.saveTrouble`.
  - Grown-up area dashboard, at the top: `grownUp.saveTrouble`, while any learner on the device is in `saveFailedFor`.
- Restore waits for its write to resolve; on a rejected write it shows `results.saveLater`'s meaning in its own line (`restore.saveLater`), not "restored".
- Nothing is blocked while a save is failing.

### 3.8 Strings (`packages/i18n/src/messages/{en,es,ko}/`)

Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:31-35`), so each PR that adds a key carries reviewed es and ko values (R8 draft, F-I18N-001 §3.10 two-lens review, ledger re-signed). The persona-neutral wording serves children and adults on the same screen (CLAUDE.md §1).

| Key | English | Row |
|---|---|---|
| `learner.progressReadFailed.title` | We could not open your progress. | DP-1c |
| `learner.progressReadFailed.body` | Nothing was erased. Let's try again. | DP-1c |
| `learner.progressReadFailed.bubble` | Hmm, the box is stuck. | DP-1c |
| `learner.progressReadFailed.tryAgain` | Try again | DP-1c |
| `learner.progressReadFailed.chooseAnother` | Choose another learner | DP-1c |
| `learner.progressReadFailed.grownUpHelp` | A grown-up can help | DP-1d |
| `learner.progressReadFailed.stillStuck` | Still stuck? Close the app and open it again. | DP-1c |
| `learner.progressReadFailed.restoreBlocked` | We can't restore here yet. Open the learner first. | DP-1a |
| `grownUp.recoverRecord.title` | This record is damaged. | DP-1d |
| `grownUp.recoverRecord.body` | We kept a copy of it on this device. | DP-1d |
| `grownUp.recoverRecord.cloud` | Get it back from the cloud save | DP-1d |
| `grownUp.recoverRecord.fresh` | Start fresh on this device | DP-1d |
| `grownUp.recoverRecord.notNow` | Not now | DP-1d |
| `learner.results.saveLater` | We could not save this yet. Keep the app open and we will try again. | DP-2 |
| `learner.profile.saveTrouble` | This device is having trouble saving. Free up some space, then open the app again. | DP-2 |
| `grownUp.saveTrouble` | This device could not save some progress. Free up some space on it. | DP-2 |
| `learner.restore.saveLater` | We could not save this yet. Keep the app open and we will try again. | DP-2 |

"Nothing was erased" is true for both `read` and `parse` (the original key is never written while it cannot be read). No string promises recovery.

### 3.9 Telemetry (Worker first)

| Name | When | Payload |
|---|---|---|
| `storage.read_failed` | a contract read ends `failed` after its retry (once per launch or Try again) | `{ record: 'progress' \| 'profiles' \| 'active' \| 'tombstones', cause: 'read' \| 'parse', kept: boolean }` |
| `storage.write_failed` | a progress write is rejected (first failure of a run only) | `{ record: 'progress' }` |
| `storage.write_recovered` | a write succeeds after `write_failed` | `{ record: 'progress', tries: integer 1–4 }` |

- DP-3 adds the names to `TELEMETRY_EVENT_NAMES` (append-only) and section W of `docs/roadmap/TELEMETRY-NAMES-2.md`, a strict `STORAGE_TELEMETRY_PAYLOADS` schema, and a Worker rule in `packages/backend/src/lib/server-events.ts` (`keptEventFields`) that drops `profileId` and any other key, with the exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts`) and a Worker test sending a smuggled `profileId`. The Worker deploys before the app build that sends them.
- On a full disk the telemetry queue (`telemetry:queue`, `writeJson`) may itself fail; the event is then lost. Accepted.

## 4. Out of scope

- Every other store that calls `readJson` (stories, tiers, memberships, audio, layout, locale, account, memory, sync queue, the guest *record* of `hydrateGuest`). A later amendment takes them one by one; `hydrateGuest` first.
- Detecting low disk space before a write.
- Changing `readJson`'s signature.
- Reads that keep failing (`read`, not `parse`) on a device that otherwise works: Try again only; telemetry will show if this happens (OD-DP3).

## 5. UI sketch

- Wireframe: `design/wireframes/shell/progress-read-failed.md` (revision 3 in this PR: matches §3.5–§3.8; its "grown-up report line" is replaced by the Grown-up area line of §3.7).
- Row DP-0b: a design pass in `design/screens/system/progress-read-failed/` (screen, both variants, the sheet, the three save lines), approved by multi-agent review (CLAUDE.md §5).

## 6. Tests

Unit (vitest, `apps/mobile/src/store/__tests__/`, `platform/storage` mocked as `progress-store.test.ts` does, `:6`, plus the raw-read mocks):

1. `durableRead`: absent and `''` → `missing`; value → `value`; `readRawExact` throws once, `readRawExactFresh` succeeds → `value`; both throw → `failed/read`; unparsable → `failed/parse` with `raw`.
2. **Core regression:** a stored record with 3 completed quests; both reads throw; `hydrate`; `recordQuestComplete`; **`writeJson` never called for that key, stored value unchanged, `notifyProgressPersisted` not called**.
3. Same, then Try again succeeds → the held completion is merged with the 3 stored quests and saved once. A later `persist` before Try again does **not** re-read.
4. `missing` → unchanged behaviour (existing tests stay green).
5. `reset`, `replaceSnapshot`, `ensure` on a `loadFailedFor` profile write nothing.
6. Sync: `runSync`, `requestSync`, `applyServerSnapshot` for a `loadFailedFor` learner push and pull nothing; `plan-store.derive` writes nothing.
7. Restore (file and server adopt) for a `loadFailedFor` learner is refused with `restoreBlocked`.
8. `memory-chunk` and `stage-ceremony-latch` paths: notify only after the awaited write; none while load-failed.
9. Profiles: list `failed` → `hydrated` false, `loadFailed` set; `persistList`, `flushLocked`, `refresh`, `promoteGuest`, `persistActive` and the sweep write nothing; creating a profile writes nothing.
10. Profiles: unparsable list bytes and `flushLocked` → the damaged bytes are not overwritten (was: merged as empty).
11. Tombstones `failed` alone → a swept learner is not shown; no list write; sweep skipped.
12. Active `failed` alone, two profiles → chooser; one profile → that profile.
13. Damaged copy: written once to `progress-damaged:<id>`; a second launch with the same damage writes no second copy; Remove from this device deletes it (`remove-from-device.test.ts`); `profile-keys.test.ts` passes with the new template; a failed copy write → `kept: false` and no grown-up button.
14. `recoverRecord`: refuses without a kept copy; with one, writes once, clears `loadFailedFor`, runs the post-hydrate chain.
15. Writes (DP-2): first write rejects, second resolves → `saveFailedFor` set then cleared, notify once after the resolve; three newer snapshots during a retry → only the latest written, never an older one after a newer one; a retry on foreground.
16. Boot (testing-library): list `failed` → ProgressReadFailedScreen, not Welcome; active progress `failed` → the screen; Try again reruns `hydrateLearnerData` in full (list) or the one hydrate (learner); Choose another learner shown with 2 profiles only; A grown-up can help shown on `parse` only.
17. Web: `readRawExact` / `writeRaw` in `storage.web.ts` against the IndexedDB mock.

Coverage: `apps/mobile` business logic stays at or above 90 %.

**[On device, owner]** Fill an Android emulator's storage, finish a quest, see the Results and Grown-up lines; free space, finish another, the lines go and the record holds both. Write garbage to a learner's progress key with a debug build, open the app: the screen shows, the copy exists, the grown-up sheet starts fresh only after the PIN.

## 7. Rollout

Next release; nothing to migrate. If `storage.read_failed` is common on one platform, the out-of-scope stores (§4) come next.

## 8. Dependencies

- `platform/storage(.web).ts` (present; two new exports).
- `OopsScreen` layout, the grown-up gate (present).
- WO-07 (`AMENDMENTS-QUEST-LEAVE-RESUME.md`, not yet written) stores a quest run under its own key and must use the §3.1 contract.

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| DP-0b | Opus 5.5 | §5 wireframe revision 3 and design pass; multi-agent review | — | this spec `ready` | `design/durable-progress` |
| DP-1a | Opus 5.5 | §3.1 raw exports and `durableRead`; §3.2 progress guards, no auto re-read, sync and plan gating, restore refusal, `replaceSnapshot({ notify })` and the two external callers; `restoreBlocked` string (en, es, ko) | 1–8, 17 | this spec `ready` | `fix/durable-progress-read` |
| DP-1b | Opus 5.5 | §3.3 profiles (list, tombstones, active), `readStored` and `promoteGuest` on the contract | 9–12 | DP-1a | `fix/durable-progress-profiles` |
| DP-1c | Sonnet 5.5 | §3.4 boot, §3.5 screen (Try again, Choose another learner, still-stuck line); its strings (en, es, ko) | 16 | DP-1b, DP-0b | `fix/durable-progress-boot` |
| DP-1d | Opus 5.5 | §3.6 damaged copies, `PER_PROFILE_KEYS`, `RecoverRecord` destination and sheet, `recoverRecord`; its strings (en, es, ko) | 13, 14, 16 (grown-up button) | DP-1c | `fix/durable-progress-recover` |
| DP-2 | Sonnet 5.5 | §3.7 awaited writes, per-profile queue, retries, `saveFailedFor`, the four lines; their strings (en, es, ko) | 15 | DP-1a | `fix/durable-progress-write` |
| DP-3 | Sonnet 5.5 | §3.9 Worker rule and names first, then the client emits | Worker and exact-list tests | DP-1d, DP-2 | `fix/durable-progress-telemetry` |
| DP-4 | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-DURABLE-PROGRESS" lines in F-PROF-001, F-SYNC-002, F-RESTORE-001, F-STORY-006, AMENDMENTS-ONE-ACCOUNT-MANY-USERS; `docs/specs/README.md` index line; status `shipped` **after** the owner's on-device check (§6) | — | DP-3, owner check | `docs/durable-progress-shipped` |

One commit = test + implementation (CLAUDE.md §5). WO-01 put damaged-value handling in its DP-3; it is DP-1d here because the recovery sheet needs it.

## 10. Owner decisions

- **OD-DP1 — Start fresh exists, but only for a grown-up and only for damaged bytes.** WO-01 says not to start fresh over unreadable data. This spec keeps that for the learner and for read errors, and allows it behind the grown-up gate only when the bytes cannot be parsed **and** a copy is kept and read back. Without it, damaged bytes leave a device stuck for good and the only way out is uninstalling, which loses the copy too. Recommended: accept.
- **OD-DP2 — the cloud action in the sheet** pulls the server copy over a damaged local record (and is the only restore path for that learner). Recommended: accept.
- **OD-DP3 — reads that keep failing (`read`)** get Try again only, no grown-up action, until telemetry shows how often it happens. Recommended: accept.

## 11. Review log

- 2026-11-21, multi-agent review (two lenses: code truth; charter, learner experience, child safety). Adjudicated in revision 2:
  - Fixed, blockers: damaged bytes had no way out (Try again rereads the same bytes; the Grown-up area was unreachable; restore was refused by the new guard) → grown-up sheet behind the PIN with cloud and start-fresh actions after a kept copy (§3.6, OD-DP1, OD-DP2); write paths that skipped the guard (sync push/pull, plan derive, external `notifyProgressPersisted` callers, `flushLocked`/`refresh`/`promoteGuest`/`persistActive`, `readStored` reading damaged bytes as empty) → all named and gated (§3.2, §3.3); the damaged-copy key ended in a timestamp, so Remove from this device left a child's data behind, and copies piled up → one slot per record, id last, registered, never overwritten (§3.6); `readJsonExact` cannot return the raw bytes → `readRawExact`/`writeRaw` exports (§3.1); the wireframe contradicted the spec → the spec takes the wireframe's design, wireframe revision 3 aligns copy.
  - Fixed, majors: one learner's failed read blocked siblings → Choose another learner; Try again after a failed list read reruns `hydrateLearnerData` in full and the post-hydrate chain runs once; boot decides from store state; tombstones failing alone no longer bring back removed learners; the active-key fallback opens the chooser on a shared device; "we will keep trying" made true (retries on foreground and before background) and a Grown-up area line added; strings move into the rows that use them, with es and ko (both shipped); a design row (DP-0b); one branch per row, DP-1 split into four; automatic re-reads removed so telemetry does not flood; telemetry follows the Worker-first house rules.
  - Fixed, minors: copy is persona-neutral (adults use the same screens); "still on this device" → "Nothing was erased"; the bubble no longer repeats the body; `reset` has no production caller; guest progress is under the contract; restore waits for its write; §1's claim about the list overwrite corrected (only unparsable bytes); `remember` writes nothing (dropped from the list); profile reads span `:352-358`; section numbers in Amends; F-APP-001 dropped from Amends (no section describes `hydrateLearnerData`); `shipped` only after the owner's device check.
  - Open: whether the grown-up gate's own record can be read when the list cannot — fail closed (§3.6) until DP-1d checks it.
