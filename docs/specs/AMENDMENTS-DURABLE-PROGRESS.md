# AMENDMENTS-DURABLE-PROGRESS — a failed read is never "nothing saved"; a failed write is never silent

Status: ready (owner decision 2026-11-22: OD-DP1 and OD-DP3 accepted as recommended, OD-DP2 moot; owner decisions 2026-11-23, OD-DP4 to OD-DP8 as recommended, §10, add row DP-1e; revision 3a adjudicates the revision-3 review of 2026-11-22, §11). Revision 3 (2026-11-21, re-based on `d5ba0217c`; written for work order WO-01 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row DP-0). Revision 2 was written on `5573e1072`; since then AMENDMENTS-AUDIT-2026-11 rows AU-3 and AU-11 (#1034, #1035) fixed the progress half of the read problem, and this revision builds on their mechanisms (§11).

**Amends**: F-PROF-001 §3.1 (cold launch: the list read at launch) · F-SYNC-002 §3.2 (the first push after a damaged record was kept) · F-RESTORE-001 (a restore over a record that could not be read says so) · AMENDMENTS-AUDIT-2026-11 AU-3 (the unread set becomes store state; a failed write is told apart from a failed read) · AMENDMENTS-ONE-ACCOUNT-MANY-USERS §13.4 (one new grown-up destination) · tag **[DP]**
**Scope**: `apps/mobile` — `store/durable-read.ts` (new, built only from existing `platform/storage` exports), `store/progress-store.ts`, `store/profile-store.ts`, `store/sync-store.ts`, `App.tsx`, `screens/sync/RestoreScreen.tsx`, the chooser and Home (one check each), one system screen and one grown-up sheet; `packages/i18n` (en, es, ko); `packages/content-schema` and `packages/backend` (telemetry names and Worker rule). No change to `platform/storage(.web).ts`.
**Owner**: solo dev
**Rollout**: next release; no migration; Worker before app for telemetry (§3.9)
**UI sketch**: §5

---

## 1. Context

The charter promises that earned stars, cards and collection progress are never taken away (CLAUDE.md §1, anti-shame rules). Re-read on `d5ba0217c`. What upstream already fixed is marked; what is left is this amendment's work.

**The storage helpers.** `readJson` still returns `null` for a missing key, a read that threw and bytes that do not parse (`apps/mobile/src/platform/storage.ts:11-18`; web `storage.web.ts:12`). Next to it: `readJsonStrict` (a failed read throws, unparsable is `null`, `storage.ts:25-33`), `readJsonExact` (both throw, `:40-44`), `readJsonExactFresh` (one retry on a fresh connection, `:50-52`; web `storage.web.ts:56`), `updateJson` with `{ exact }` (a read-modify-write that writes nothing over a value it could not read, `:72-82`; web `:85`), and, new in AU-3, `keepRawCopy(from, to, { onlyUnparsable })` (copies the raw stored string once, never over an existing copy, `storage.ts:91-98`; web `storage.web.ts:116`). Together these cover every read outcome this amendment needs; no new platform export is required.

**A failed read looks like an empty device.**

- **Progress — fixed by AU-3, one gap left.** Every read and write of `progress:<id>` is now one storage transaction, `withStored` (`store/progress-store.ts:349-387`, `updateJson(..., { exact: true })`). A read error leaves the profile out of `hydratedFor` and in the module-private set `unread` (`:414`, set at `:788`); writes are held in memory (`writeStep` refuses an un-hydrated profile, `:464`; `persist` keeps them in `pendingFor`, `:618-626`), `replaceSnapshot` holds a sync, restore or plan answer instead of making it final (`:1033-1036`), and the next `hydrate` reads again and merges (test `store/__tests__/progress-store-unreadable.test.ts:198-238`). Bytes that do not parse, or parse to a non-object, are copied to `progress-corrupt:<id>` (`PROGRESS_CORRUPT_KEY`, `:53`; registered in `PER_PROFILE_KEYS`, `profile-keys.ts`; removed with the learner, `:1132`) and the profile then **starts fresh** (`:374-382`); if the copy cannot be made, nothing is written and the profile stays unread. **Left:** the learner whose read failed sees an empty Home with no word of why (nothing reads `unread`; it is not store state), and what they earn meanwhile exists only in memory until a read succeeds.
- **Sync — fixed by AU-3 for a failed read; open for a damaged one.** `runSync` returns before any registration or push while the learner is not in `hydratedFor` (`store/sync-store.ts:423-425`); `requestSync` goes through `runSync`, and the server adopt and `applyServerSnapshot` end in `replaceSnapshot`, which holds (above). **Left:** after AU-3 starts a damaged record fresh, the learner is hydrated, so the next `runSync` pushes the fresh snapshot with the stored `rev` (`sync-store.ts:443-452`). With no other device in between, `baseRev` matches and the Worker stores it (`packages/backend/src/routes/sync.ts:100-125`): the cloud copy is replaced by the fresh record. The conflict fold that would keep it (`logic/sync/engine.ts:52-58`) runs only on a 409.
- **Plan derive — fixed by AU-3.** `derive` (`store/plan-store.ts:105-114`) hydrates, `ensure`s and calls `replaceSnapshot`, which holds while unread.
- **Restore — data fixed by AU-3, message open.** File restore (`screens/sync/RestoreScreen.tsx:83-93`) and the server adopt (`sync-store.ts:559-603`) end in `replaceSnapshot`, which holds and later merges, so nothing is lost. **Left:** the screen still says "restored" for a learner whose record was not read, and the restore lives only in memory until a read succeeds.
- **Profiles — still open (file unchanged since `5573e1072`).** `hydrate` reads the list, the active id and the tombstones with `readJson` (`store/profile-store.ts:353-358`) and sets `hydrated: true` whatever came back (`:366`), so a failed list read shows first-run Welcome. `persistList` → `flushLocked` (`:211-238`) re-reads with `readStored` (`readJsonStrict`, `:192-195`) and merges; on a read error it writes nothing, but **unparsable bytes read as `null`, so the stored list counts as empty and is overwritten** (the tombstones the same way, `:227`; `promoteGuest`'s confirm read, `:500`, likewise).
- **Boot — still open, in a new form.** `progress.hydrate` no longer rejects (AU-3), so `hydrateLearnerData` (`store/bootstrap.ts:79-80`) throws only for other stores, and `App.tsx:155-156` drops that error anyway. Nothing at boot looks at the unread set or at a profile list that could not be read.

**A failed write is silent.**

- **Ordering — fixed by AU-11.** Writes for one profile run one after another (`enqueue`, `progress-store.ts:393-402`), a waiting write is not queued twice and stores the snapshot held when it runs (`writeWaiting`, `:408`; `writeStored`, `:506-531`), so an older snapshot never lands after a newer one. On the web a page that comes back to the front writes again every hydrated profile it holds (`followProgressChanges`, `:544-548`; `platform/progress-channel.web.ts:68-77`), and every new write stores the whole memory snapshot, so a failed write is retried by the next one.
- **Still open.** A write that throws after its step ran ends as `'unread'` (`withStored`, `:371`), the same answer as a failed read, and `writeStored` then does nothing (`:515-519`): no retry on native, no flag, no line for the learner or a grown-up. `ran` is set before `step` is called (`:357`), so a step that throws ends there too and cannot be told from a storage write that rejected. The damaged path answers `'done'` (`:384`), the same as a normal write, so nothing after it knows a record was started fresh. `replaceSnapshot` is synchronous and its write is fire-and-forget (`writeStored`, `:1046`), so no caller can wait for it. `save` calls `notifyProgressPersisted` before the write runs (`:533-537`), and `replaceSnapshot` after starting it (`:1047-1048`); `memory-chunk.ts:92-93, 103-104, 200-201, 255-256` and `stage-ceremony-latch.ts:23-24` do the same. That notify only asks for a sync, and the push sends the snapshot in memory, so on a full disk it gives the learner a second copy; this revision keeps it (§3.7). On a full disk the learner keeps playing and loses what they earned at the next launch unless a sync went through.

The profile-lock record already solved the read half (`AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` §13.2: unparsable counts as failed, one retry on a fresh connection, then fail closed). AU-3 applied a version of it to progress. This amendment surfaces AU-3's state to the learner, closes its sync gap, applies the rule to the profile list, and makes a failed progress write visible.

## 2. User story

> As a learner coming back to the app, I see my cards and stars, or I see that the app could not open them and can try again. I never see an empty app that then replaces what I had.
>
> As a parent, if the device could not save today's progress, I find that out on the device, in the Grown-up area, not weeks later.
>
> As an adult learning on my own phone, the message tells me what I can do, not to "ask a grown-up".

## 3. Acceptance criteria

### 3.1 One read contract (profile records)

| Outcome | Meaning | How (existing exports only) |
|---|---|---|
| `missing` | the key is absent or `''` | `readJsonExact` (or, after a first read error, `readJsonExactFresh`) returns `null` |
| `value` | the bytes parse | `readJsonExact` (or `readJsonExactFresh`) returns the value |
| `failed` / `parse` | the bytes were read and do not parse | `readJsonExact` (or `readJsonExactFresh`) rejects with a `SyntaxError` (`JSON.parse`, `storage.ts:43`, `storage.web.ts:44`) |
| `failed` / `read` | the read threw, and the one retry on a fresh connection threw too | `readJsonExact` rejects with anything other than a `SyntaxError`; `readJsonExactFresh` is called once and also rejects with anything other than a `SyntaxError` |

- **The cause comes from the read, never from `keepRawCopy`.** A `SyntaxError` from either read is `parse`; any other rejection of the first read triggers the one fresh retry, whose answer is classified the same way (a `SyntaxError` on the retry is `parse`, a value is `value`, `null` is `missing`).
- **`kept` is set only by `keepRawCopy`, only for `parse`.** With a `copyKey`, `durableRead` calls `keepRawCopy(key, copyKey, { onlyUnparsable: true })`: resolves `true` → `kept: true`; resolves `false` (the write fence rejects the copy key, `storage.ts:92`, or the bytes changed to something that parses meanwhile) → `kept: false`; rejects → `kept: false`. With `copyKey` `null` (`ACTIVE_KEY`, `PROFILE_TOMBSTONES_KEY`) `keepRawCopy` is never called and `kept` is `false`. For `read`, `keepRawCopy` is never called and `kept` is `false`.
- `store/durable-read.ts`: `durableRead(key, copyKey | null) → { kind: 'missing' } | { kind: 'value', value: unknown } | { kind: 'failed', cause: 'read' | 'parse', kept: boolean }`, composed from the three exports above. Never rejects. No raw-string export, no direct AsyncStorage or idb-keyval (CLAUDE.md §8).
- Under the contract: `PROFILES_KEY` (copy key `profiles-corrupt`, the same naming as AU-3's `progress-corrupt:<id>`), `ACTIVE_KEY` and `PROFILE_TOMBSTONES_KEY` (copy key `null`: they hold nothing earned). `readStored` (`profile-store.ts:192-195`) and `promoteGuest`'s confirm read (`:500`) use it too, so damaged list or tombstone bytes are never merged as empty.
- **Progress is not moved onto `durableRead`.** AU-3's `withStored` already is its contract (§1); this amendment only reads its outcome (§3.2).
- `readJson` and `readJsonStrict` are unchanged; other stores keep them (§4). Schema repair is unchanged (`withSnapshotDefaults`, `storedProfileItems`).

### 3.2 Progress: build on AU-3

- **The unread set becomes store state.** AU-3's module set `unread` (`progress-store.ts:414`) is promoted to `loadFailedFor: ReadonlySet<string>` in the store's state (the same set, set and cleared at the same places, `:765`, `:788`, `:1127`), so boot, the chooser and Home can subscribe. No second structure.
- **AU-3's re-read stays.** The next `hydrate` reads again, including the one `persist` and `ensure` start (`:625`, `:806`): a read that failed once heals at the next write. Try again (§3.5) is the learner's way to start that read on purpose. Telemetry fires on the transition into `loadFailedFor` only (§3.9), so repeated re-reads do not flood it.
- **`withStored`'s outcomes (DP-1a).** The answer becomes `'done' | 'fresh' | 'fenced' | 'unread' | 'unsaved' | 'step-failed'`. A second flag, `stepped`, is set right after `step` **returns** (in each of the three places `step` is called: the exact transaction `:358`, the fenced read `:365`, the damaged-path transaction `:383`); `ran` keeps its meaning (step was called).

| Outcome | When | What the callers do |
|---|---|---|
| `done` | the read worked, `step` returned, and its value was stored (or there was nothing to store) | as today |
| `fresh` | the stored bytes were damaged, `keepRawCopy` kept them at `progress-corrupt:<id>`, `step` ran on `null`, and the fresh record was stored (`:383-384`, was `'done'`) | as `done` for `seen` and `postProgressChanged` (`:517`, `:780-783`); in addition the profile enters `freshFor` (below) and `storage.read_failed` fires (§3.9) |
| `fenced` | the write fence is up (unchanged) | as today |
| `unread` | the read failed; or the damaged copy could not be kept (`keepRawCopy` resolved `false` or rejected); or the learner was removed meanwhile (unchanged, `:374-380`) | as today (AU-3: `loadFailedFor` when not hydrated) |
| `unsaved` | `stepped` is true and the storage write (`setItem` inside `updateJson`) rejected, in the exact transaction or the damaged-path one | DP-2's retries and `saveFailedFor` (§3.7); `storage.write_failed` (§3.9). In `hydrate`, `step` has already put the profile in `hydratedFor`, so it is hydrated and only its write is pending |
| `step-failed` | `ran` is true and `stepped` is false: `step` itself threw (a snapshot the merge cannot read, a bug) | no retry, no `saveFailedFor`, no "free up space" line, no `write_failed` event: retrying the same step would throw again. `hydrate` treats it as `unread` does today (the profile stays out of `hydratedFor`, `:788`); `writeStored` does nothing, as today for `:371`. Logged through the shared logger (CLAUDE.md §8) |

- **A damaged record keeps its cloud copy (the fold, DP-1a).** When AU-3 starts a learner fresh (`fresh`), the learner's next push must fold the server copy in first; otherwise it is pushed with the stored `rev` and replaces the cloud copy (§1).
  - **Trigger: the kept copy, which is durable before the fresh record.** `keepRawCopy` writes `progress-corrupt:<id>` (`:374`) before the damaged-path transaction writes the fresh record (`:383`); if the copy cannot be made, nothing fresh is written (`unread`). So the copy key is the marker: no new marker is written by `progress-store`, and nothing has to land in the same transaction as the fresh record. `progress-store` never imports or writes `sync-store` (today `sync-store.ts:36` imports `progress-store`, never the reverse; this stays so).
  - **The "folded" flag.** `LearnerSyncState` (`sync-store.ts:46`) gains `copyFolded: boolean`; a stored record without it reads `false`. It is written `true` only after a push that went through the fold landed (below), in the same `update` that stores the new `rev`.
  - **When `runSync` folds**: after the AU-3 guard (`:423-425`) and registration, before `syncLearner` (`:443`), when (a) `hasKeptCopy(id)` and `copyFolded` is `false`, or (b) the id is in `useProgressStore.getState().freshFor` (this session's fresh starts, whatever `copyFolded` says: AU-3 keeps only the first copy, so a second damage after an earlier fold leaves the copy key unchanged).
  - **`hasKeptCopy(id)`** (in `sync-store`, existing exports only): `readJsonExact(PROGRESS_CORRUPT_KEY(id))` resolves non-`null`, or rejects with a `SyntaxError` → kept; resolves `null` → none; any other rejection → unknown, and `runSync` returns before the push (as the AU-3 guard does), so the next run asks again.
  - **The fold**: `client.getSnapshot(id, creds)` (`platform/sync-api.ts:636`; no store calls it today):
    - `ok` → `local = reconcile(mergeSnapshots(local, server.snapshot, { now }))` (`logic/sync/merge`, the same merge and plan `reconcile` that `syncLearner` uses on a conflict, `engine.ts:53-56`) and `localRev = server.rev`, the server's real revision; then `syncLearner` as today. A 409 in between (another device pushed) is folded by `syncLearner` as now. On `synced`, memory takes `outcome.snapshot` through `applyServerSnapshot` (as for `outcome.merged`, `sync-store.ts:461`: the fold is a merge even when the push itself saw no conflict), then `copyFolded: true` and `useProgressStore.getState().clearFresh(id)`.
    - `none` (404: no server copy) → push as today; on `synced`, `copyFolded: true` and `clearFresh(id)`.
    - `error` → no push in this run; `status: 'error'`, `lastError` the code; the next run folds again. The fresh record is never pushed without the fold.
    - A learner registered in this pass (`!state.secret`, `:434`) has no server copy: `copyFolded: true` and `clearFresh(id)` with the first push.
    - A push that answers `retry-later` or `error` leaves `copyFolded` as it was.
  - **`baseRev` is always a revision the server gave** (the stored `rev`, or `server.rev` from the fold, or a 409's `rev`): a non-negative integer, as `SnapshotPutSchema` requires (`packages/content-schema/src/schemas/sync.ts:212`, `nonnegative`). No sentinel is sent: `-1` would be a 422 on every run and the learner would never sync again.
  - **`freshFor: ReadonlySet<string>`** in the progress store's state: a profile enters on a `fresh` outcome and leaves through `clearFresh(id)` (and with the learner's removal, `:1127`). `sync-store` subscribes and, when an id enters, writes `copyFolded: false` to `sync:<id>` at once, so a relaunch before the next sync still folds (via the copy key).
  - A learner with no kept copy and not in `freshFor` syncs exactly as today. A device that already holds an AU-3 copy from before this release folds once at its first sync (a union merge: nothing is lost) and then sets the flag.
  - This replaces revision 2's "Get it back from the cloud save" action: for progress, the fold is automatic.
- **Restore says what happened.** A file restore or server adopt for a learner in `loadFailedFor` keeps AU-3's hold (no refusal, nothing written). `RestoreScreen` chooses its line only after the restore's write has run: the progress store gains `whenWritten(profileId): Promise<void>`, which resolves when the profile's write chain as it is at the call (`chains.get(profileId)`, `progress-store.ts:393`; already resolved when the profile has none) has settled, and never rejects. The file restore awaits it after `replaceSnapshot` (`RestoreScreen.tsx:87`); `adoptServerLearner` awaits it after its `replaceSnapshot` (`sync-store.ts:598`) before it resolves, so the code path (`:555`) waits too. The screen then shows `caregiver.restore.saveLater` instead of "restored" when the learner is in `loadFailedFor` or `saveFailedFor` (§3.7). It does not wait for DP-2's timed retries.
- A `missing` record is a new learner: unchanged (blank record, welcome card in memory until the first real write, F-STORY-006 §3.3).
- Not repeated here (already true upstream, with tests in `progress-store-unreadable.test.ts`): no write over an unreadable record, writes held and merged, sync and plan derive held, the damaged copy kept once and removed with the learner.

### 3.3 Profiles: a list that could not be read never shows first run

- **Given** the list read is `failed`, **when** `useProfileStore.hydrate` finishes, **then** `hydrated` stays `false`, `loadFailed: 'read' | 'parse'` is set, and `profiles` stays empty. While `loadFailed` is set nothing writes `PROFILES_KEY`, `ACTIVE_KEY` or the tombstones: `persistList`, `flushLocked`, `refresh`, `promoteGuest`, `persistActive` (from `followMerged` `:290` and `commitSet` `:334`), the tombstone sweep (`:363`) and the legacy-hash rewrite (`:367`) all check it. The device gate and the native gate already wait for `hydrated` (`store/device-gate.ts:111`, `store/native-gate-state.ts:50`).
- **`PROFILE_TOMBSTONES_KEY` failed alone:** the list is shown **without** any profile whose per-profile keys are already gone (no `progress:<id>` key: it was swept), the sweep is skipped, and list writes are held as above until a tombstone read succeeds (Try again, or the next launch). A removed learner never comes back.
- **`ACTIVE_KEY` failed alone:** with one profile, use it; with two or more, open the chooser (OA-D6), never a sibling's record. The active key may be written again after the learner picks (it holds nothing earned).

### 3.4 Boot

- `App.tsx` decides from store state, not from the thrown error: when `useProfileStore.loadFailed` is set, or the active profile is in `loadFailedFor`, it renders **ProgressReadFailedScreen** instead of the navigator. Other hydrate rejections are ignored as today (`App.tsx:155-156`).
- The post-hydrate chain (`App.tsx:170-180`: `setReady`, `prefetchWhenIdle`, `rederiveAllLocal`, `activateMemory`, `syncAll`) runs once, after the first boot that is not blocked.
- A failed progress read for a profile that is **not** active does not block boot. The chooser marks nothing; when that learner is chosen (chooser, or their Home), they get the screen in its learner variant.

### 3.5 ProgressReadFailedScreen

Layout and variants: the wireframe (§5). `OopsScreen`'s layout (`screens/system/OopsScreen.tsx`: Hoya `thinking`, title, body, bubble, hero button), same tokens, no `colors.feedback.danger`, no X or warning icon.

| Button | Shown | Does |
|---|---|---|
| **Try again** (hero) | always | **List variant:** reruns `hydrateLearnerData` in full (the per-profile hydrates were built from an empty list, `bootstrap.ts:57-71`). **Learner variant:** reruns that learner's `progress.hydrate` (AU-3's re-read). Busy state; cannot be pressed twice during a try. On success the screen goes and held writes are merged and saved (AU-3). |
| **Choose another learner** (secondary) | learner variant, when the device has 2 or more profiles | opens the chooser; locks still apply (OA-D9) |
| **A grown-up can help** (ghost) | list variant, `parse` with `kept: true` only | opens the grown-up gate (AMENDMENTS-ONE-ACCOUNT-MANY-USERS §13.4) to the new destination `RecoverRecord` (appended to `GrownUpDestination`, `navigation/types.ts:37`) |

- The learner variant is reached by a read error, and also by damaged progress bytes whose copy could not be kept (`withStored` answers `unread` when `keepRawCopy` resolves `false` or rejects, `progress-store.ts:374`; e.g. a full disk): nothing is written, so "Nothing was erased" holds, and Try again is the way out (it retries the copy, then AU-3 starts fresh). Damaged progress whose copy **was** kept never reaches the screen (AU-3 starts it fresh, §3.2 folds its cloud copy back in). So there is no learner-variant grown-up button.
- After 3 tries in a session a line shows under the bubble (polite live region, announced once): `progressReadFailed.stillStuck`.
- There is no "Start over" or "New learner" button on this screen.
- **Note 2026-11-22 (DP-1c, as built):** "2 or more profiles" counts learner profiles, as the chooser does (a legacy grown-up row is not a learner), and the button is not drawn while `flags.whoChooserEnabled` is off (there is no chooser to open). Choose another learner at boot opens the app on the chooser (`manual`) unless the launch opens a chooser of its own. While the screen holds the boot it follows store state (a list or record read meanwhile, e.g. by another tab, opens the app). The design's D3 scroll-to-end when the still-stuck line fills is not built (the `Screen` component exposes no scroll handle); the line is in a polite live region and, on iOS, said with the bubble.

### 3.6 A damaged profile list: kept, then recoverable by a grown-up

- When the list read is `failed/parse`, `durableRead` has already copied the raw bytes to `profiles-corrupt` with `keepRawCopy` (first copy kept, never overwritten; the AU-3 rule). If the copy cannot be made, `kept` is false, the list key is untouched, and **A grown-up can help** is not offered.
- `profiles-corrupt` is removed 30 days after the list reads `value` again or a grown-up recovery replaced it, and by Remove from this device of any learner (it may hold their name).
- **The grown-up sheet (`RecoverRecord`).** Default focus on **Not now** (the safe choice first).

| Action | Does |
|---|---|
| **Start fresh on this device** | writes an empty list with `recoverProfileList()`; Welcome then shows with Restore, as on a new device (each learner with a Rescue Code comes back through it, and AU-3's records under `progress:<id>` are still on the device). Per-profile keys are left untouched. |
| **Not now** | closes |

- `recoverProfileList` is the only write past the §3.3 guards: it checks that `profiles-corrupt` exists, writes once, clears `loadFailed` and runs the post-hydrate chain.
- If the gate's own record cannot be read, the sheet is not offered (fail closed; Try again stays).
- The sheet has a second line under its body, `caregiver.recoverRecord.comeBack` (owner decision 2026-11-23, OD-DP4 item O2; §3.8): after Start fresh, learners come back only through Restore.
- **Note 2026-11-23 (DP-1d, as built; multi-agent review adjudicated):**
  - **The gate at boot.** While the boot is held the app's navigator is not mounted (§3.4), so the screen of a damaged list whose copy was kept is drawn in a stack of its own (`navigation/recover-stack.tsx`: an independent navigation container holding `RecoverHold`, the screen, and the root's `PinEntry` and `PinReset`, for the `RecoverRecord` destination only; no route of the app can be reached from it). The PIN screen is unchanged: with no PIN on the device the family PIN is made first, as for every grown-up action (open owner question below). A correct PIN (or face or fingerprint) goes back to the screen with the gate open and one return marked, and the sheet shows over it; Cancel and Close show no sheet. Start fresh empties the list, so, as Remove from this device (CS-12), it needs a PIN entered in the last 2 minutes (`needsFreshPin`, action `start_fresh`): the sheet opens only then, a PIN made just now counts (as for Who is joining?, CS-11) and a reset's new PIN does not (the button asks it once more), and a sheet answered later starts nothing. The session the PIN opened ends with the sheet's answer (CS-1). Focus is put on A grown-up can help before the sheet opens and after it closes (design D5). While Start fresh runs the screen is held as during a try (D2); one that did not open the app says the bubble again.
  - **"The gate's own record cannot be read"** is the account store's PIN hash read failing (`pinHashReadFailed`): the button is not drawn (frame A), and Try again's full read reads the hash again.
  - **The sheet** is the platform `confirm()` (the ConfirmSheet on the web, the `Alert` on native); `ConfirmOptions` gains `detail`, the sheet's second paragraph (after a blank line in the native message), for the O2 line. Not now is the cancel (first, focused); Start fresh is primary, never danger.
  - **`recoverProfileList`** (`store/profile-store.ts`) runs in the tab's queue and inside the `hr:profiles` lock, only while `loadFailed` is `parse`, and only when a read made then still finds bytes that do not parse with `profiles-corrupt` holding them (`keepRawCopy`'s `kept` is the "copy exists" check: it answers true only once the copy key holds a copy). It writes `[]` once and reads the list again (`hydrate`, which clears `loadFailed`); BootGate then reruns `hydrateLearnerData` as Try again does and opens the app, so the post-hydrate chain runs once. The active key, the tombstones and every per-profile key are not written. A list that reads meanwhile (another tab) is never written over: nothing is written and Try again opens it.
  - **The 30 days.** A mark, `profiles-corrupt:settled` (`{ v: 1, at }`), is written by the first launch whose list reads while a copy is kept (after a recovery, the read right after it); from 30 days after it, a launch removes the copy, then the mark (`logic/profiles/list-copy.ts`; a mark dated in the future is written again). The copy key is read first and the `hr:profiles` lock is taken only when a copy is kept, so a launch with none never waits on it. A copy, a list or a mark that cannot be read is left as it is. Remove from this device of any learner removes both, inside the lock.
  - **A second damage within those 30 days.** `keepRawCopy` keeps the first copy, which then holds the earlier, settled bytes, not the ones Start fresh replaces. The boot only reads (the button shows; nothing is removed without a grown-up). At a confirmed Start fresh, inside the lock and only while the list is still damaged, a copy whose mark is written gives way: the copy, then its mark, are removed and the current bytes kept, before the empty list is written. If a removal or the new copy fails, nothing is written over the list; the settled copy may then be gone before its 30 days (its damage had been recovered from). A mark that cannot be read offers no button (fail closed).
  - **The guest sweep** (`store/guest-sweep.ts`, GU-D13) sweeps no id's keys while a list copy is kept: after Start fresh an id the empty list does not name may be a learner of the damaged list, whose per-profile keys stay (§3.6).
  - **Korean Not now** is 지금은 안 함, the declining form of the transfer consent sheet, not 나중에 ("later"), so the safe choice never reads as "yes, later" (design D9).
  - **Accepted residual:** a copy is marked settled only by a launch whose list reads. If an older bundle overwrote the damaged list and it is damaged again before this bundle reads it, the earlier copy has no mark and is taken for the second damage's (rare; the second damage's bytes stay in the list key until a Start fresh).
  - **Open for the owner:** (1) on a device with no PIN, A grown-up can help leads to making the family PIN, as every grown-up action on such a device does; whoever is holding the device then reaches Start fresh, and that PIN becomes the family PIN (the alternative, a verify-only gate, leaves a device with no PIN and a damaged list with no way out, against OD-DP1). (2) "A grown-up can help" (§3.8, design D4) also shows on an adult's own device (the list that would say so cannot be read). (3) On the web, the browser back while the PIN screen or the sheet is open at boot is not caught (the held stack keeps no history entry): it leaves the page and confirms nothing; Close, Cancel and Not now go back, as for the held screen itself (DP-1c).

### 3.7 Writes: detect, retry, tell

- Builds on AU-11's per-profile queue (§1): no new queue. When `withStored` answers `'unsaved'` (§3.2: the storage write rejected after `step` returned; never for `'step-failed'`, `'unread'` or `'fenced'`), `writeStored` schedules the same write again after 1 s, 4 s and 15 s; then on each app foreground (native; the web already does this through `followProgressChanges`), before backgrounding (best effort), and with each new write (already true). Each retry is an ordinary `writeStored`, so it stores the latest snapshot and never an older one.
- `saveFailedFor: ReadonlySet<string>` in store state holds a profile from its first `'unsaved'` until a write of it lands (`done` or `fresh`). A `'step-failed'` answer neither adds nor clears it, schedules no retry and shows no line: the step would throw again, and "free up some space" would be untrue.
- `notifyProgressPersisted` keeps its present timing (§1): it asks for a sync of the snapshot in memory, which is a second copy when the disk is full. No change to `memory-chunk.ts` or `stage-ceremony-latch.ts`.
- Where it shows (one quiet line, `tone="secondary"`, no error icon), while the learner is in `saveFailedFor` or `loadFailedFor`:
  - Results (`screens/results/ResultsScreen.tsx`, under the headline `:504`): `results.saveLater`.
  - Profile (`screens/profile/ProfileScreen.tsx`, above the grown-up section): `profile.saveTrouble` (`saveFailedFor` only).
  - Grown-up area dashboard, at the top: `grownUp.saveTrouble` (`caregiver.dashboard.saveTrouble`, note below), while any learner on the device is in `saveFailedFor`.
  - Restore (`RestoreScreen.tsx`): `caregiver.restore.saveLater` (the namespace the screen reads, `messages.caregiver.restore`, `RestoreScreen.tsx:37`) in place of "restored" when the restored learner is in `loadFailedFor` or `saveFailedFor` once `whenWritten` has resolved (§3.2).
- Nothing is blocked while a save is failing.
- **Row DP-2 notes (2026-11-22; DP-0b owner items O1, O3 and O4 confirmed by the owner 2026-11-23, §10 OD-DP4):**
  - **O1 (confirmed 2026-11-23):** there is no `grownUp` namespace in `packages/i18n`; the Grown-up area line is `caregiver.dashboard.saveTrouble` (DP-0b README D9).
  - **O3 (confirmed 2026-11-23):** Restore while the save is still waiting keeps this section's version (design frame N: the line in place of the notice text; card, Hoya and Great stay), not proposal N2.
  - **O4 (confirmed 2026-11-23):** Profile is a learner screen, possibly a child's: on a family device `learner.profile.saveTrouble.family` asks for a grown-up's help and never asks the learner to free up space; a self-only device (never "grown-up", F-LEARN-001 L7) gets the spec's line as `learner.profile.saveTrouble.self`. The Grown-up area line keeps the space ask.
  - A reset that did not land is retried as a reset (`replace`), never as a merge. A retry of a marked profile that meets a failed read or the write fence keeps the mark and tries the next slot.
  - Open for the owner: on Results the line usually appears just after the screen opens (Results writes the run on mount) and can go again about 1 s later when the first retry lands; a hold before showing it would stop the flicker but is not in the design (D8).
  - The foreground and background retries bind `platform/app-state`'s `subscribeAppActive` on every platform (on the web it is `visibilitychange`; the writes coalesce with `followProgressChanges`'). A step that throws is not logged: the app has no shared logger yet (CLAUDE.md §8), so §3.2's "logged through the shared logger" waits for one.

### 3.8 Strings (`packages/i18n/src/messages/{en,es,ko}/`)

Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:32-34`), so each PR that adds a key carries reviewed es and ko values (R8 draft, F-I18N-001 §3.10 two-lens review, ledger re-signed). The persona-neutral wording serves children and adults on the same screen (CLAUDE.md §1).

| Key | English | Row |
|---|---|---|
| `learner.progressReadFailed.title` | We could not open your progress. | DP-1c |
| `learner.progressReadFailed.body` | Nothing was erased. Let's try again. | DP-1c |
| `learner.progressReadFailed.bubble` | Hmm, the box is stuck. | DP-1c |
| `learner.progressReadFailed.tryAgain` | Try again | DP-1c |
| `learner.progressReadFailed.chooseAnother` | Choose another learner | DP-1c |
| `learner.progressReadFailed.grownUpHelp` | A grown-up can help | DP-1d |
| `learner.progressReadFailed.stillStuck` | Still stuck? Close the app and open it again. | DP-1c |
| `caregiver.recoverRecord.title` (was `grownUp.recoverRecord.title`) | This record is damaged. | DP-1d (O1) |
| `caregiver.recoverRecord.body` (was `grownUp.recoverRecord.body`) | We kept a copy of it on this device. | DP-1d (O1) |
| `caregiver.recoverRecord.comeBack` | After this, learners come back only with their Rescue Code or a saved file. | DP-1d (O2) |
| `caregiver.recoverRecord.fresh` (was `grownUp.recoverRecord.fresh`) | Start fresh on this device | DP-1d (O1) |
| `caregiver.recoverRecord.notNow` (was `grownUp.recoverRecord.notNow`) | Not now | DP-1d (O1) |
| `learner.results.saveLater` | We could not save this yet. Keep the app open and we will try again. | DP-2 |
| `learner.profile.saveTrouble.family` | This device is having trouble saving. Ask a grown-up to help. | DP-2 (O4, §3.7 note) |
| `learner.profile.saveTrouble.self` | This device is having trouble saving. Free up some space, then open the app again. | DP-2 (O4, §3.7 note) |
| `caregiver.dashboard.saveTrouble` (was `grownUp.saveTrouble`) | This device could not save some progress. Free up some space on it. | DP-2 (O1, §3.7 note) |
| `caregiver.restore.saveLater` | We could not save this yet. Keep the app open and we will try again. | DP-2 |

"Nothing was erased" is true on this screen: the list key is never written while it cannot be read, and a progress record reaches the screen only when it was not written (AU-3). No string promises recovery.

- **Note 2026-11-22 (DP-1c; DP-0b owner question O1, confirmed by the owner 2026-11-23, OD-DP4):** `packages/i18n` has no `grownUp` namespace (the Grown-up area's strings live in `caregiver`). The `grownUp.*` keys above are built as DP-0b's README D9 proposes: `grownUp.recoverRecord.*` → `caregiver.recoverRecord.*` (DP-1d) and `grownUp.saveTrouble` → `caregiver.dashboard.saveTrouble` (DP-2). The English words do not change. DP-1c's own keys (`learner.progressReadFailed.*`) are unaffected.
- **Note 2026-11-22 (DP-0b owner question O4, confirmed by the owner 2026-11-23, OD-DP4):** a line a possibly-child learner reads never asks them to "free up some space"; it asks them to get a grown-up instead (applies to `learner.profile.saveTrouble`, DP-2). No DP-1c string is affected: the still-stuck line asks only to close and open the app.
- **Note 2026-11-23 (DP-1d; DP-0b owner question O2, accepted by the owner 2026-11-23, OD-DP4):** the RecoverRecord sheet gets a second line, `caregiver.recoverRecord.comeBack`, so the grown-up knows what Start fresh costs. The owner's words: learners come back only through Restore (the DP-0b README proposal: "Learners come back with their Rescue Code."). The line names the ways Restore really has today, so "only" stays true: the Rescue Code and a saved file (`caregiver.restore.file`). Its account sign-in is not open yet (`caregiver.restore.signIn.comingSoon`, `RestoreScreen.tsx`), so the account is not named; the line gains it when that ships. es and ko through the F-I18N-001 process (ledger re-signed for `learner` and `caregiver`).

### 3.9 Telemetry (Worker first)

| Name | When | Payload |
|---|---|---|
| `storage.read_failed` | a profile record's `durableRead` ends `failed`; a progress profile enters `loadFailedFor`; `withStored` answers `fresh` (AU-3 kept a damaged progress copy and started fresh: `cause: 'parse', kept: true`; once per profile per launch) | `{ record: 'progress' \| 'profiles' \| 'active' \| 'tombstones', cause: 'read' \| 'parse', kept: boolean }` |
| `storage.write_failed` | a progress write answers `'unsaved'` (first failure of a run only; never for `'step-failed'`) | `{ record: 'progress' }` |
| `storage.write_recovered` | a write lands after `write_failed` | `{ record: 'progress', tries: integer 1–4 }` |

- DP-3 adds the names to `TELEMETRY_EVENT_NAMES` (append-only) and section W of `docs/roadmap/TELEMETRY-NAMES-2.md`, a strict `STORAGE_TELEMETRY_PAYLOADS` schema, and a Worker rule in `packages/backend/src/lib/server-events.ts` (`keptEventFields`) that drops `profileId` and any other key, with the exact-list test (`packages/content-schema/src/__tests__/telemetry.test.ts`) and a Worker test sending a smuggled `profileId`. The Worker deploys before the app build that sends them.
- On a full disk the telemetry queue (`telemetry:queue`, `writeJson`) may itself fail; the event is then lost. Accepted.

## 4. Out of scope

- Every other store that calls `readJson` (stories, tiers, memberships, audio, layout, locale, account, memory, sync queue, the guest *record* of `hydrateGuest`). A later amendment takes them one by one; `hydrateGuest` first.
- AU-3's choice to start damaged progress fresh after the copy is kept (owner-approved with the audit's stage 2, 2026-11-15): unchanged here. Reading a kept `progress-corrupt:<id>` back by hand is not a product path.
- A one-time retry of the progress read on a fresh connection: AU-3 re-reads at the next write, which covers a passing failure.
- Detecting low disk space before a write. Changing `readJson`'s signature.
- Reads that keep failing (`read`, not `parse`) on a device that otherwise works: Try again only; telemetry will show if this happens (OD-DP3).
- A second damage of the same learner after an earlier fold, where the app is closed in the moment between the fresh write and `sync-store` writing `copyFolded: false` (§3.2) and before any sync in that session: at the next launch the copy key is unchanged and `copyFolded` is still `true`, so the fold is missed and the fresh record is pushed. AU-3 keeps only the first copy, so a second damage is already outside its guarantee; accepted.
- A sentinel `baseRev` to force a conflict: not used (§3.2); the fold reads the server copy instead.

## 5. UI sketch

- Wireframe: `design/wireframes/shell/progress-read-failed.md` (revision 4a: matches §3.5–§3.8 of revision 3a; the grown-up button and sheet are for the list variant only, the sheet has no cloud action, and damaged progress whose copy could not be kept reaches the learner variant).
- Row DP-0b: a design pass in `design/screens/system/progress-read-failed/` (screen, both variants, the sheet, the save lines), approved by multi-agent review (CLAUDE.md §5).

## 6. Tests

Unit (vitest, `apps/mobile/src/store/__tests__/`, `platform/storage` mocked through `test-support/storage-transactions.ts` `withTransactions` as `progress-store.test.ts:11` and `progress-store-unreadable.test.ts` do). AU-3's tests already pin the progress core (no write over an unreadable record, held writes merged, `replaceSnapshot` held, the copy kept once, removed with the learner); they stay green and are not repeated.

1. `durableRead`: absent and `''` → `missing`; value → `value`; `readJsonExact` rejects (not a `SyntaxError`) once, `readJsonExactFresh` succeeds → `value`; both reject (not a `SyntaxError`) → `failed/read`, `kept: false`, `keepRawCopy` not called; unparsable → `failed/parse` (from the `SyntaxError`), `kept: true`, copy equals the raw bytes; first read rejects, fresh read throws a `SyntaxError` → `failed/parse`; `keepRawCopy` resolves `false` (copy key fenced) → `failed/parse`, `kept: false`; `keepRawCopy` rejects → `failed/parse`, `kept: false`; `copyKey` `null` and unparsable → `failed/parse`, `kept: false`, `keepRawCopy` not called; `durableRead` never rejects.
2. `loadFailedFor` is store state: a subscriber sees the profile enter on a failed read and leave on the next successful `hydrate`.
3. Damaged progress and the cloud (mocked client): AU-3 starts fresh over a kept copy (`withStored` → `fresh`, the profile in `freshFor`); the next `runSync` calls `getSnapshot` before `putSnapshot`, pushes with `baseRev` equal to the server's `rev`, and the pushed snapshot and memory hold the server's cards and quests; `copyFolded` is `true` and `freshFor` empty after it. Relaunch before the sync (fresh store modules, `copyFolded` `false` on disk, `progress-corrupt:<id>` present) → the fold still runs. `getSnapshot` answers `error` → no `putSnapshot` in that run, `copyFolded` stays `false`. `getSnapshot` answers `none` → pushes from the stored `rev`, then `copyFolded` `true`. `copyFolded` `true` and no `freshFor` entry → no `getSnapshot`, push as today. The copy read rejects (not a `SyntaxError`) → no push in that run. A learner without a kept copy pushes exactly as before.
4. Restore: for a `loadFailedFor` learner, nothing written, `caregiver.restore.saveLater` shown, the restored snapshot merged at the next successful read; for a hydrated learner whose write rejects, the screen awaits `whenWritten` and shows `caregiver.restore.saveLater` (not "restored"); `whenWritten` resolves for a profile with no chain and never rejects; `adoptServerLearner` resolves only after its write ran.
5. `withStored` answers: `'unread'` for a rejected read; `'unsaved'` for a write that rejects after `step` returned (exact transaction and damaged path); `'step-failed'` when `step` throws (no retry scheduled, `saveFailedFor` unchanged, no `write_failed`); `'fresh'` for damaged bytes kept and replaced (was `'done'`); `'done'` otherwise.
6. Profiles: list `failed` → `hydrated` false, `loadFailed` set; `persistList`, `flushLocked`, `refresh`, `promoteGuest`, `persistActive` and the sweep write nothing; creating a profile writes nothing.
7. Profiles: unparsable list bytes and `flushLocked` → the damaged bytes are not overwritten (was: merged as empty); `profiles-corrupt` holds them.
8. Tombstones `failed` alone → a swept learner is not shown; no list write; sweep skipped.
9. Active `failed` alone, two profiles → chooser; one profile → that profile.
10. `recoverProfileList`: refuses without `profiles-corrupt`; with it, writes once, clears `loadFailed`, runs the post-hydrate chain; Remove from this device deletes `profiles-corrupt` (`remove-from-device.test.ts`).
11. Writes (DP-2): first write rejects, second resolves → `saveFailedFor` set then cleared; three newer snapshots during a retry → only the latest written; a retry on native foreground.
12. Boot (testing-library): list `failed` → ProgressReadFailedScreen, not Welcome; active progress in `loadFailedFor` → the screen; Try again reruns `hydrateLearnerData` in full (list) or the one hydrate (learner); Choose another learner shown with 2 profiles only; A grown-up can help shown on list `parse` with `kept` only.
13. The fold never sends an invented revision: across test 3's cases every `putSnapshot` body has an integer `baseRev` ≥ 0 that is either the stored `rev` or a `rev` the mocked server returned, and passes `SnapshotPutSchema`; no `-1`.

Coverage: `apps/mobile` business logic stays at or above 90 %.

**[On device, owner]** Fill an Android emulator's storage, finish a quest, see the Results and Grown-up lines; free space, finish another, the lines go and the record holds both. With a debug build, make a learner's progress read throw: the screen shows, Try again after the fault is removed brings the record back. Write garbage to `hr:profiles`: the screen shows, the copy exists, the grown-up sheet starts fresh only after the PIN. Write garbage to a synced learner's progress key: after the next sync the learner's cards are back from the cloud.

## 7. Rollout

Next release; nothing to migrate. If `storage.read_failed` is common on one platform, the out-of-scope stores (§4) come next.

## 8. Dependencies

- `platform/storage(.web).ts` (present, unchanged: `readJsonExact`, `readJsonExactFresh`, `keepRawCopy`).
- AMENDMENTS-AUDIT-2026-11 AU-3 and AU-11 (shipped: `withStored`, `unread`, `progress-corrupt:<id>`, the per-profile write queue, `followProgressChanges`).
- `OopsScreen` layout, the grown-up gate (present).
- WO-07 (`AMENDMENTS-QUEST-LEAVE-RESUME.md`, not yet written): the quest run's own key already exists (AU-12, `quest-run:<id>`, `store/quest-run-saved.ts:50`); its read already treats a failure as "no saved run" and never touches progress, which is what WO-07 item 5 asks. No change from this amendment.

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| DP-0b | Opus 5.5 | §5 wireframe revision 4a and design pass; multi-agent review | — | this spec `ready` | `design/durable-progress` |
| DP-1a | Opus 5.5 | §3.2: `loadFailedFor` as store state; `withStored`'s outcomes (`fresh`, `unsaved`, `step-failed`); `freshFor`, `clearFresh`, `copyFolded`, `hasKeptCopy` and the cloud fold (server pull, then push from the server's rev); `whenWritten` and the awaits in `RestoreScreen` and `adoptServerLearner` | 2–5, 13 | this spec `ready` | `fix/durable-progress-read` |
| DP-1b | Opus 5.5 | §3.1 `durableRead`; §3.3 profiles (list, tombstones, active), `readStored` and `promoteGuest` on the contract | 1, 6–9 | DP-1a | `fix/durable-progress-profiles` |
| DP-1c | Sonnet 5.5 | §3.4 boot, §3.5 screen (Try again, Choose another learner, still-stuck line); its strings (en, es, ko) | 12 | DP-1b, DP-0b | `fix/durable-progress-boot` |
| DP-1d | Opus 5.5 | §3.6 `profiles-corrupt`, `RecoverRecord` destination and sheet, `recoverProfileList`; its strings (en, es, ko) | 7, 10, 12 (grown-up button) | DP-1c | `fix/durable-progress-recover` |
| DP-2 | Sonnet 5.5 | §3.7 retries on `'unsaved'`, `saveFailedFor`, the four lines; their strings (en, es, ko) | 4 (line), 11 | DP-1a | `fix/durable-progress-write` |
| DP-3 | Sonnet 5.5 | §3.9 Worker rule and names first, then the client emits | Worker and exact-list tests | DP-1d, DP-2 | `fix/durable-progress-telemetry` |
| DP-1e | Opus 5.5 | OD-DP5 damaged tombstones rebuilt; OD-DP6 every learner tab held; OD-DP7 Results line after the first retry; OD-DP8 §3.3 text; a Restore-by-Rescue-Code screen test on a full disk | tombstone parse / read tests; a tab test for each learner tab; a Results timing test; the Restore test | DP-1d | `fix/durable-progress-followups` |
| DP-4 | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-DURABLE-PROGRESS" lines in F-PROF-001, F-SYNC-002, F-RESTORE-001, AMENDMENTS-AUDIT-2026-11, AMENDMENTS-ONE-ACCOUNT-MANY-USERS; `docs/specs/README.md` index line; status `shipped` **after** the owner's on-device check (§6) | — | DP-3, DP-1e, owner check | `docs/durable-progress-shipped` |

One commit = test + implementation (CLAUDE.md §5). WO-01 put damaged-value handling in its DP-3; for progress AU-3 already did it, and for the list it is DP-1d because the recovery sheet needs it.

## 10. Owner decisions (decided 2026-11-22: all as recommended)

- **OD-DP1 — a damaged profile list: Start fresh only behind the grown-up gate.** For progress this decision is **moot**: AU-3 (owner-approved, 2026-11-15) already starts a damaged record fresh, automatically, once its copy is kept. For the list this spec does not follow AU-3's automatic rule: a fresh list hides every learner on the device and shows first-run Welcome, which is the "empty device" this amendment exists to prevent. So the list keeps its damaged bytes, shows the screen, and offers Start fresh behind the PIN only when the copy is kept. Without it, damaged list bytes leave a device stuck for good. Recommended: accept. (Alternative: AU-3's automatic rule for the list too — simpler, no sheet, no DP-1d.)
- **OD-DP2 — the cloud action in the sheet: moot.** For progress the cloud copy is now folded in automatically on the next sync (§3.2); the profile list has no server copy of its own (its learners come back through Restore). The action is dropped.
- **OD-DP3 — reads that keep failing (`read`)** get Try again only, no grown-up action, until telemetry shows how often it happens. AU-3 also re-reads at each write. Recommended: accept.

### Owner decisions 2026-11-23 (all as recommended)

- **OD-DP4 — DP-0b owner items O1 to O4.** O1, O3 and O4 are confirmed as built in DP-1c and DP-2 (the `grownUp.*` keys live under `caregiver.*`; Restore keeps frame N; a line a possibly-child learner reads asks for a grown-up, never to free up space). O2 is accepted: the RecoverRecord sheet says, in a second body line, that after Start fresh learners come back only through Restore (row DP-1d).
- **OD-DP5 — tombstones whose bytes are damaged.** A `parse` failure never reads again, and §3.3 holds list writes until a tombstone read works, so list changes on that device would stay in memory for good. Instead: keep a raw copy under `tombstones-corrupt` (`keepRawCopy`), rebuild the tombstone set from the device (a learner of the stored list with no per-profile key left is tombstoned), write it and release the hold. A `read` failure keeps holding and is read again on the next hydrate or Try again (row DP-1e).
- **OD-DP6 — a held learner sees the screen on every learner tab.** §3.4 gated Home only; a learner whose progress could not be read now gets the learner variant of the read-failed screen on every learner tab, so no tab shows an empty record that looks like lost progress (row DP-1e).
- **OD-DP7 — Results' save line waits for the first retry.** The line shows only when the first retry (1 s) has also not landed, so a save that lands on its retry never flashes the line (row DP-1e).
- **OD-DP8 — DP-1b's as-built rules join §3.3.** A tombstones failure that would leave no learner of a non-empty stored list, or keys that cannot be listed, fails closed (`loadFailed: 'read'`); the hidden-learner filter counts any per-profile key (`keyOfProfile`), not only `progress:<id>`, so a learner who never played still shows (row DP-1e writes the §3.3 text).

## 11. Review log

- 2026-11-21, multi-agent review (two lenses: code truth; charter, learner experience, child safety). Adjudicated in revision 2:
  - Fixed, blockers: damaged bytes had no way out (Try again rereads the same bytes; the Grown-up area was unreachable; restore was refused by the new guard) → grown-up sheet behind the PIN with cloud and start-fresh actions after a kept copy (§3.6, OD-DP1, OD-DP2); write paths that skipped the guard (sync push/pull, plan derive, external `notifyProgressPersisted` callers, `flushLocked`/`refresh`/`promoteGuest`/`persistActive`, `readStored` reading damaged bytes as empty) → all named and gated (§3.2, §3.3); the damaged-copy key ended in a timestamp, so Remove from this device left a child's data behind, and copies piled up → one slot per record, id last, registered, never overwritten (§3.6); `readJsonExact` cannot return the raw bytes → `readRawExact`/`writeRaw` exports (§3.1); the wireframe contradicted the spec → the spec takes the wireframe's design, wireframe revision 3 aligns copy.
  - Fixed, majors: one learner's failed read blocked siblings → Choose another learner; Try again after a failed list read reruns `hydrateLearnerData` in full and the post-hydrate chain runs once; boot decides from store state; tombstones failing alone no longer bring back removed learners; the active-key fallback opens the chooser on a shared device; "we will keep trying" made true (retries on foreground and before background) and a Grown-up area line added; strings move into the rows that use them, with es and ko (both shipped); a design row (DP-0b); one branch per row, DP-1 split into four; automatic re-reads removed so telemetry does not flood; telemetry follows the Worker-first house rules.
  - Fixed, minors: copy is persona-neutral (adults use the same screens); "still on this device" → "Nothing was erased"; the bubble no longer repeats the body; `reset` has no production caller; guest progress is under the contract; restore waits for its write; §1's claim about the list overwrite corrected (only unparsable bytes); `remember` writes nothing (dropped from the list); profile reads span `:352-358`; section numbers in Amends; F-APP-001 dropped from Amends (no section describes `hydrateLearnerData`); `shipped` only after the owner's device check.
  - Open: whether the grown-up gate's own record can be read when the list cannot — fail closed (§3.6) until DP-1d checks it.
- 2026-11-21, revision 3: re-based from `5573e1072` to `d5ba0217c` (12 commits; every `file:line` re-read). What moved because of AMENDMENTS-AUDIT-2026-11:
  - **AU-3** (`withStored`, `unread`, `progress-corrupt:<id>`, `keepRawCopy`, `runSync` guard) already does §3.2's core for progress: no write over an unreadable record, held writes merged at the next read, sync push/pull and plan derive held, restore held instead of lost, the damaged copy kept once, registered and swept. Dropped: `readRawExact` / `readRawExactFresh` / `writeRaw` (`durableRead` now composes `readJsonExact`, `readJsonExactFresh`, `keepRawCopy`, and covers the profile records only); the `loadFailedFor` Map (AU-3's `unread` set is promoted instead); "no automatic re-read" (reversed: AU-3's re-read stays, telemetry fires on the transition); the restore refusal and `restoreBlocked` (AU-3 holds the restore; the screen now says `restore.saveLater`); the progress damaged-copy slot `progress-damaged:<id>` (AU-3's `progress-corrupt:<id>` is it; the list copy is renamed `profiles-corrupt` to match); the learner-variant grown-up button, the cloud action, `grownUp.recoverRecord.cloud` and `recoverRecord` for progress (AU-3 starts damaged progress fresh); OD-DP1 narrowed to the list; OD-DP2 moot.
  - **AU-3 gap found:** the fresh start after a kept copy is pushed with the stored `rev` and replaces the cloud copy; §3.2 adds the conflict fold before that push.
  - **AU-11** (per-profile write queue, latest-snapshot coalescing, re-write on page foreground on the web) already does §3.7's ordering and part of its retry. Dropped: the new queue, `replaceSnapshot({ notify })` and the edits to `memory-chunk.ts` / `stage-ceremony-latch.ts` (the early notify only asks for a sync of what is in memory, a second copy on a full disk). Kept: telling a failed write from a failed read, timed and native-foreground retries, `saveFailedFor`, the lines.
  - **AU-12** (`quest-run:<id>`) meets the WO-07 dependency of §8.
  - Unchanged and still open: profiles (§3.3, `profile-store.ts` has not changed), boot (§3.4), the screen (§3.5), telemetry (§3.9). #1037 (quest Previous) and #1044 (AMENDMENTS-FINISH-2026-11) touch no path in this spec.
- Revision 3 review (2026-11-22), adjudicated as revision 3a (every point re-checked against `5e84e0d85`):
  - Fixed, blockers: the cloud fold could not send an "impossible" `baseRev` (`SnapshotPutSchema.baseRev` is `nonnegative`, `packages/content-schema/src/schemas/sync.ts:212`; `-1` is a 422 on every run) → before the first push after a fresh start, `runSync` pulls the server copy (`getSnapshot`, `platform/sync-api.ts:636`), merges it with `mergeSnapshots` and pushes from the server's real `rev`; no sentinel; test 13 pins that no negative or invented `baseRev` is sent (§3.2, §4, §6). The sync-record marker could be lost (the damaged path writes the fresh record, `progress-store.ts:383`, before any `sync:<id>` write could be durable) and would have made `progress-store` import `sync-store` (a cycle; `sync-store.ts:36` already imports the other way) → the trigger is AU-3's own `progress-corrupt:<id>`, written by `keepRawCopy` before the fresh record; `sync:<id>` keeps only `copyFolded`, written after a fold's push lands; `freshFor` covers a second damage in the same session (§3.2; residual case in §4).
  - Fixed, majors: the damaged path answered `'done'` (`:384`) → a `'fresh'` outcome, used by `freshFor` and `storage.read_failed` (§3.2, §3.9). The §3.1 table took the cause from `keepRawCopy`, which resolves `false` when fenced (`storage.ts:92`) and cannot be called for keys with no copy key → the cause comes from the read (`SyntaxError` from `readJsonExact` / `readJsonExactFresh` = `parse`), `keepRawCopy` only sets `kept` (§3.1, test 1). `'unsaved'` covered a throwing step too (`ran` is set before `step` runs, `:357`, `:371`) → a `stepped` flag; `'unsaved'` only when the storage write rejects; a throwing step is `'step-failed'` (no retry, no `saveFailedFor`, no line, no event) (§3.2, §3.7, test 5). Restore could not wait for its write (`replaceSnapshot` is synchronous, `writeStored` fire-and-forget, `:1046`) → `whenWritten(profileId)` over the profile's `chains` entry, awaited by `RestoreScreen` and `adoptServerLearner` before the line is chosen (§3.2, §3.7, test 4).
  - Fixed, minors: the wireframe said damaged progress never reaches the screen, but it does when the copy cannot be kept (§3.5) → wireframe revision 4a and §3.5 say so; `learner.restore.saveLater` → `caregiver.restore.saveLater`, the namespace `RestoreScreen` reads (`RestoreScreen.tsx:37`) (§3.7, §3.8). §1 notes the three code facts behind these fixes; row DP-1a lists the new work and test 13.
