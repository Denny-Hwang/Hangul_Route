Status: ready

# Amendment: teachers and families see a learner's full progress; class moves at the teacher's discretion

> **Owner decisions of 2026-10-14 (in chat).** They override two holds that were waiting for counsel: "`CLASS_TRANSFER` stays off until counsel (F-SPACE-002 T-8, flip gate G2)" and "F-VOC-005 P-4b waits for counsel gate G2". Every change below is marked **[TV]** where it lands in a spec, test or comment.
>
> **No legal review has taken place.** These are the owner's product decisions. Nothing in this amendment, in the privacy page, the terms or any consent text says or implies that a lawyer, counsel or any expert reviewed the wording. The counsel packet (`docs/legal/counsel-packet-2026-10.md`, #683) stays useful for a later review and now carries a note pointing here; this amendment does not wait for it.
>
> Basis: `origin/main` `ce583aa01`. Every `file:line` below is at that commit.

**Owner request (2026-10-14, Korean, translated):** "Teachers and parents must be able to see all of a student's information and settings. Moving a student to another class should be at the teacher's discretion. On the teacher screen, show each student's full learning progress. Go ahead."

**Standing rules that apply here:**
- D1 changes are additive only (a merge applies the migration to production) and the Worker deploys before any client that calls a new route.
- No PII in URLs, page titles or telemetry: routes carry opaque ids (`move:<uuid>`, `profile:…`, the space id); events carry codes only.
- UI strings come from `packages/i18n` (`useMessages()`), with English, Spanish and Korean in the same PR (the `es` and `ko` coverage ratchets), written to the F-I18N-001 section 3.10 style guide and glossary. Design-system tokens only. No emoji.
- Audience is any age: no age wording. Anti-shame: no ranking, no red failure states, nothing earned is ever taken away.
- Child safety: a child profile never sees a grown-up screen; the grown-up gate (PIN) is unchanged.
- Stripe stays in sandbox; no price appears in anything this amendment adds.
- Reading, listening and writing focus: nothing here measures or shows speaking.

---

## 1. Decisions

| # | Decision | Replaces | Why |
|---|---|---|---|
| TV-D1 | **A family sees everything about its learner.** A family space (owner or caregiver) reads every key of the learner's progress summary except `schemaVersion`: the current family projection plus `vocab` (with `firstTryRate`), `stage1Anchor`, and day-by-day word counts (`activity.*.w`) as sent. | `TEACHER_HIDDEN_SUMMARY_KEYS` applied to families too (`roster-summary.ts:68-77`, `transfer-consent.ts:141`) | Owner decision (1). A family caregiver already holds `snapshot.read` (the whole saved progress, `lib/can.ts:46`); the console projection was narrower than what the family may already read. |
| TV-D2 | **A teacher sees a learner's full progress once the family has read the update (full scope).** A class teacher or owner, and a school admin over the class, read for a learner with a current acknowledgement (TV-D4) everything a family reads (TV-D1), with two exceptions: `planProgress` keeps only the viewing space's own plans (another space's plan ids carry no titles a teacher can read), and the roster list never carries `firstTryRate` (F-VOC-005 section 3.8: a student's detail view only; the learner report carries it). Activity history before the learner joined the class is no longer clipped for a full-scope learner. | F-SPACE-002 T16a / 4.11 allow-list, F-REPORT-001 section 3.8 join-date clipping, F-PLAN-002 section 3.10 "selfRoute: family only", Learning Route LR-W1 "routeGoal: family only" | Owner decision (1): "teachers see the full learning progress including words". |
| TV-D3 | **Until then, the old scope (base scope).** For a learner with no acknowledgement at a full-scope version, a class or school reads exactly what it reads on `ce583aa01`: the allow-list `TEACHER_VISIBLE_SUMMARY_KEYS`, words zeroed, no `vocab`, history clipped at `joinedAt`. | — | Owner decision (3): "until they acknowledge, teachers see only the old scope for that learner". |
| TV-D4 | **One versioned class-scope text, acknowledged once per learner.** New `CLASS_SCOPE_TEXT_VERSION = 'class-scope-2026-10'` and `FULL_SCOPE_TEXT_VERSIONS = ['class-scope-2026-10']` (content-schema). A learner's acknowledgement is one row `class_scope_acks` (learner, version, basis, evidence, time). It is written by a guardian in the console (guard 9a of F-SPACE-002 4.2: an owner or caregiver of a live family space the learner is in) or by the learner's own **full-scope** device (a class-scoped tablet cannot, `403 scope_limited`). In the app a child profile reaches the acknowledgement only through the grown-up gate. A guardian's consent to a family-started class move at the current transfer text (TV-D6) also writes the acknowledgement, because that sheet shows the same full list. | — | Owner decision (3). The server cannot tell who read a screen, so the record says how it was given (`caregiver` or `device`), never "verified". |
| TV-D5 | **Old texts stay accepted, the scope follows the acknowledgement.** Every earlier transfer text stays in `ACCEPTED_CONSENT_TEXT_VERSIONS` (so an older app's consent sheet is not locked out); a consent at an older transfer text writes no acknowledgement. Families who joined under an older text (that is, every family today: there was no class-join text before) see the acknowledgement once on their next visit: on the parent home in the console, and on the learner's Home in the app (grown-up gated for a child profile). | — | Owner decision (3). |
| TV-D6 | **The class-move consent text is bumped to `transfer-2026-10d`.** The visible list gains the items of TV-D2 (`words`, `letter_check`, `own_route`, `learner_settings`) and one new line `teacher_moves` ("A teacher may move {learner} to another class later. We tell you when it happens."). `ACCEPTED_CONSENT_TEXT_VERSIONS = ['transfer-2026-10d', 'transfer-2026-10c', 'transfer-2026-10b', 'transfer-2026-10']`; pinned hashes per locale. | F-SPACE-002 4.11 table, F-VOC-005 P-4b's "bump `TRANSFER_CONSENT_TEXT_VERSION`" | Owner decisions (2) and (3): the in-app consent copy describes what teachers see and that a teacher may move the learner. |
| TV-D7 | **A teacher may move a learner directly between two classes they manage.** When the acting account holds `learner.transfer` on **both** the source and the destination (the owner or teacher of both classes, or a school owner or admin over both through the cascade, F-SPACE-002 4.5), the move happens at once: no learner or guardian consent, no second teacher, no 48-hour cooling-off. | F-SPACE-002 T2, T4, T11, T12 for this case | Owner decision (2). |
| TV-D8 | **Into another teacher's class, the receiving class must accept.** When the actor holds `learner.transfer` on the source only, the destination is named by its live join code (as join and the existing start sheet do) and the move waits for a manager of the destination to **Accept** (or **Not now**). No family consent and no cooling-off. Before it accepts, the receiving class sees initials, picture and level only (F-SPACE-002 T8 alias rule kept) and the source class name (the source teacher chose to send it there). Open for 14 days, then expired. | F-SPACE-002 T2/T4 for teacher-started requests | Owner decision (2): "keeps the receiving teacher's acceptance (the receiving class must agree to take the learner) but not the family consent". |
| TV-D9 | **Teacher moves are a new record, `class_moves`, not a `transfer_requests` row.** The transfer table's CHECKs require a consented learner slot with a basis of `caregiver` or `device_attested` before `approved` or `executed` (`0005_class_transfer.sql`), and a CHECK cannot be changed additively. A new additive table holds teacher moves; the swap reuses the self-guarding gate pattern of F-SPACE-002 4.6 (one D1 batch, the first statement is the gate, every later statement carries the gate's token). | — | Additive-only migrations. |
| TV-D10 | **The family is told once, after the move.** The family sees a one-time notice: on the parent home in the console ("{name} moved to a new class: {class}." with **OK**, which records `family_seen_at` server-side) and on the learner's Home in the app (the same sentence with **OK**, remembered on the device). Shown for 30 days after the move. The notice is addressed by the opaque move id; no name reaches a URL or an event. | — | Owner decision (2). |
| TV-D11 | **What stays from F-SPACE-002.** The family-started move (a guardian in the console, three slots, 48-hour cooling-off, device veto) is unchanged. A teacher no longer starts a three-slot request from the console: the Move action opens the teacher move of TV-D7 / TV-D8. The server route that creates a source-started request stays (an older console build may call it) and keeps its rules; nothing new calls it. The guardian switch "Do not accept move requests from teachers" (`blockTeacherRequests`) keeps blocking source-started *requests*; it does not stop a teacher move, so the family page no longer shows it while class moves are on (the copy would promise more than it does). The device consent route stays behind `CLASS_TRANSFER_DEVICE_CONSENT` (unset, gate G6 unchanged). | F-SPACE-002 4.8 family page switch | Owner decision (2) leaves no family veto over a teacher move; a switch that looks like one would mislead. |
| TV-D12 | **Teachers see the learner's settings that live on the server.** The learner report carries `settings.classNotes` (the family's class-notes setting, F-FEEDBACK-001 7.4 `learner_note_prefs.classes`: `all`, `presets` or `off`) for a full-scope learner and for a family. Device-only settings (level, who is learning, sound) never reach the server and are not added. | F-FEEDBACK-001 8.2 (the setting was family-only) | Owner decision (1): "information and settings". |
| TV-D13 | **`CLASS_TRANSFER` turns on, with its kill switch.** The Worker treats `CLASS_TRANSFER` as on when it is unset, empty or `enabled`; any other value (the kill switch is `disabled`) locks, so a typo fails closed; the console treats `NEXT_PUBLIC_CLASS_TRANSFER` as on unless it is `false`, `0` or `disabled` (the reports pattern). Kill switch: set the Worker variable `CLASS_TRANSFER=disabled` in the dashboard (every move route answers `422 transfers_locked` at once, a pending accept stops, the inbox says `transfersEnabled: false`), then optionally `NEXT_PUBLIC_CLASS_TRANSFER=disabled` on the console build. `CLASS_TRANSFER_DEVICE_CONSENT` is untouched (stays unset). | F-SPACE-002 T15 ("leave UNSET", "flipped by the owner, never by a PR") | Owner instruction: "Then turn CLASS_TRANSFER on (keep its kill switch)." |
| TV-D14 | **Privacy page, terms and in-app copy say this plainly**, as the owner's decision: `/privacy` and `/terms` in English (English-authoritative on `/es` and `/ko`, F-I18N-001 L10); the in-app consent and class-scope copy in en, es and ko. They say who sees what (families everything; teachers and school admins of a class the full progress after the family has read the update, the earlier list before), that a teacher may move a learner to another class they teach, or to another class that accepts, without asking the family first, and that the family is told. No claim of legal or expert review. | F-SPACE-002 T-8 (counsel-gated) | Owner decision (4). |
| TV-D15 | **Full-scope teacher visibility has its own kill switch.** A Worker text variable `CLASS_SCOPE_FULL`, on when unset, empty or `enabled`; any other value (the kill switch is `disabled`) makes every class and school reader read the base scope at once, without a deploy. Families always read full scope; acknowledgements still record while it is off and count again once it is on. A failed acknowledgement read (for example a Worker running before migration 0009) also answers the base scope instead of an error. `GET /health` shows `features.classScopeFull`. Independent of `CLASS_TRANSFER`. | — | Review of TV-B: a new disclosure of learner data needs a runtime rollback like `NOTES_SEND` and `CLASS_TRANSFER`. |

**Marked done as owner decisions (no counsel step):** F-SPACE-002 **T-8** (privacy and terms wording for teachers, classes, rosters and moves: written by PR TV-D on the owner's decision; the counsel review it named did not happen and is not claimed) and flip gates **G1-G5, G7** for both move paths that `CLASS_TRANSFER` opens: the teacher move of TV-D7 / TV-D8 and the family-started three-slot request (`/transfer-requests`, `/transfer-prefs`, `settle`), which reaches production for the first time with the same flip. The owner's decision to turn `CLASS_TRANSFER` on replaces those gates for both paths (G7's statement budget is checked for the new path in section 6; the family-started path met G7 in F-SPACE-002 T-5c); F-VOC-005 **P-4b** (the words consent item and the `vocab` projection: delivered by PR TV-B, words visible at full scope). Gate **G6** (device consent, `CLASS_TRANSFER_DEVICE_CONSENT`) stays closed for both paths.

## 2. Visibility rules (one table)

Viewer = who reads the roster (`GET /api/spaces/:id/roster`), the learner report (`GET /api/spaces/:id/learners/:learnerId/report`) and the class report (`GET /api/spaces/:id/class-report`).

| Field | Family (owner, caregiver) | Class or school, **full scope** | Class or school, **base scope** |
|---|---|---|---|
| allow-list `TEACHER_VISIBLE_SUMMARY_KEYS` | yes | yes | yes |
| `activity` days, months, milestones | whole history | whole history (`total.since` kept) | from the learner-local day of `joinedAt` (unchanged) |
| `activity.*.w` (words per day) | as sent | as sent | 0 |
| `vocab` on the roster | yes, without `firstTryRate` | yes, without `firstTryRate` | no |
| `vocab` on the learner report | yes, with `firstTryRate` | yes, with `firstTryRate` | no |
| `stage1Anchor` | yes | yes | no |
| `selfRoute`, `routeGoal` | yes (unchanged) | yes | no |
| `planProgress` | the family's own plans (unchanged) | the viewing space's own plans | the viewing space's own plans |
| `settings.classNotes` (report only) | yes | yes | no |
| `schemaVersion` | no | no | no |
| `payload_json` (the saved progress) | `snapshot.read` routes only (unchanged) | never | never |

Scope is decided per learner, per request: `scope = 'full'` when the learner has a `class_scope_acks` row whose `text_version` is in `FULL_SCOPE_TEXT_VERSIONS`, else `'base'`; a family viewer is always `'full'`. The roster row and the learner report carry `scope` so the console can say why a line is missing ("Words and more show once the family has read the update."). The class report aggregates each learner's own projection, so a base-scope learner's words never reach a class total.

**What does not change.** F-FEEDBACK-001's note rules (who may send, the reaction a teacher sees only while the learner's class-notes setting is `all`, no `readAt`) are unchanged: a note is a message, not progress. The unauthenticated `lookup` roster (F-SPACE-002 O-5) is unchanged. A teacher never gains `snapshot.read` (`can.test.ts` keeps its assertion).

## 3. The class-scope text (content-schema `schemas/class-scope.ts`)

One keyed list, rendered by the console card and the app screen with the same ids in the same order. English at Pre-A1, at most 16 words per sentence (a placeholder counts as one word), the transfer copy test's rule. Spanish and Korean (formal polite style, no particle attached to a placeholder) land in the same PR.

| id | text (en) |
|---|---|
| `intro` | "There is an update about the classes {learner} is in." |
| `sees_all` | "The teacher of each class {learner} is in can see all of {learner}'s progress, including words." |
| `list` | "What a teacher sees:" followed by one item per visible item id (below) |
| `moves` | "A teacher may move {learner} to another class. We tell you when it happens." |
| `keeps` | "Cards, stars and finished lessons always stay with {learner}." |
| `leave` | "{learner} can leave a class in Profile at any time." |
| `until` | "Until you press OK, teachers see what they saw before." |

The `list` items are the transfer text's items (`name_picture_level`, `activity`, `quests`, `cards_letters`, `level_check`, `plan_progress`, `sync_time`, `note_replies`) plus four new ones, generated from data like the transfer list (F-SPACE-002 4.11):

| item id | summary keys | text (en) |
|---|---|---|
| `words` | `vocab`, `activity.*.w` | "Words collected, words known well, first-try answers and words to look at again" |
| `letter_check` | `stage1Anchor` | "The Hangul check result and letters that were tricky" |
| `own_route` | `selfRoute`, `routeGoal` | "Lessons {learner} picked and the Learning Route goal" |
| `learner_settings` | report `settings.classNotes` | "Whether {learner} gets notes from the class" |

`TEACHER_FULL_SCOPE_EXTRA_KEYS = ['vocab', 'stage1Anchor', 'selfRoute', 'routeGoal']` with `TEACHER_FULL_SCOPE_ITEMS` mapping each to its item. The classification test of F-SPACE-002 4.11 extends: every `ProgressSummarySchema` key is on the allow-list, on the full-scope list or on the hidden list (`schemaVersion` only for full scope); every allow-listed and full-scope key has an item; every locale has the same line ids and placeholders; a hash per locale is pinned to `CLASS_SCOPE_TEXT_VERSION`, so editing a word forces a version bump. The transfer text (TV-D6) carries the same four items and pins its own hashes at `transfer-2026-10d`.

`TEACHER_HIDDEN_SUMMARY_KEYS` keeps meaning "hidden at base scope": it still lists `vocab`, `stage1Anchor`, `selfRoute`, `routeGoal` and `schemaVersion`. F-VOC-005 P-4b's literal step "move `vocab` to `TEACHER_VISIBLE_SUMMARY_KEYS`" is replaced by "add `vocab` to `TEACHER_FULL_SCOPE_EXTRA_KEYS`", and F-REPORT-001 RP-1's coupling test reads "`w` is zeroed exactly when the viewer's scope is base".

## 4. Data and API (all additive)

### 4.1 Migration `0009_class_scope_moves.sql` (the next free prefix; `scripts/check-migrations.mjs` fails CI on a duplicate)

```sql
CREATE TABLE IF NOT EXISTS class_scope_acks (
  learner_id     TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  text_version   TEXT NOT NULL,
  basis          TEXT NOT NULL CHECK (basis IN ('caregiver','device')),
  evidence       TEXT NOT NULL,          -- account id (caregiver) or device id; never a name
  acked_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_moves (
  id                 TEXT PRIMARY KEY,   -- move:<uuid>
  learner_id         TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  source_space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  dest_space_id      TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('direct','accept')),
  status             TEXT NOT NULL CHECK (status IN ('requested','executed','declined','cancelled','expired')),
  actor_account_id   TEXT NOT NULL,
  actor_via          TEXT NOT NULL CHECK (actor_via IN ('owner','teacher','school_admin')),
  decided_account_id TEXT,
  decided_via        TEXT CHECK (decided_via IN ('owner','teacher','school_admin')),
  end_reason         TEXT CHECK (end_reason IN ('not_now','cancelled','expired','no_room','learner_left','destination_archived')),
  token              TEXT,               -- the gate's one-off token, cleared by the batch's last statement
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  expires_at         TEXT NOT NULL,      -- created_at + 14 days
  executed_at        TEXT,
  ended_at           TEXT,
  family_seen_at     TEXT,               -- a guardian pressed OK on the notice
  CHECK (source_space_id <> dest_space_id),
  CHECK (status <> 'executed' OR executed_at IS NOT NULL),
  CHECK (status NOT IN ('declined','cancelled','expired') OR (end_reason IS NOT NULL AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_moves_open_learner ON class_moves(learner_id) WHERE status = 'requested';
CREATE INDEX IF NOT EXISTS idx_class_moves_source ON class_moves(source_space_id, status);
CREATE INDEX IF NOT EXISTS idx_class_moves_dest ON class_moves(dest_space_id, status);
CREATE INDEX IF NOT EXISTS idx_class_moves_learner ON class_moves(learner_id, executed_at);
```

Nothing existing is altered. Both tables cascade from `learners` (an older Worker's erase still works) and from `spaces`. `D1Db.deleteLearner` names them only once they exist (the `presentTables` guard of F-SPACE-002 4.7); `reset()` lists them first. Retention: open and ended rows are purged 90 days after `ended_at`, executed rows 90 days after `executed_at` (the notice is shown for 30), and an ask that expired without anyone settling it 90 days after `expires_at`. The purge runs daily from the Worker's Cron Trigger (`runScheduledPurge`, next to the notes purge, at most 5 rounds of 200 rows) and, as a backstop, once per create (bounded at 50); so the 90-day promise of TV-D14 holds even when nobody creates a move. A row holds ids only: names are read live when a view is built.

### 4.2 `Db` (both `MemoryDb` and `D1Db`, contract-tested on both)

`getClassScopeAck(learnerId)`, `classScopeAcksOf(learnerIds)` (set-based, `IN` chunks of 100), `putClassScopeAck(row)` (upsert; a newer version replaces an older one); `createClassMove(row)` → `'created' | 'already_open'` (`INSERT … WHERE NOT EXISTS` an open row of the learner); `getClassMove(id)`; `classMovesOfSpace(spaceId, role, limit)`; `openClassMoveOf(learnerId)`; `executedClassMovesOf(learnerIds, since)`; `endClassMove(id, status, reason, decider, now)` (CAS from `requested`); `markClassMoveSeen(id, now)` (CAS on `family_seen_at IS NULL`); `executeClassMove(input)` → `{ executed, devicesRevoked, relinksClosed }`; `purgeClassMoves(endedBefore, executedBefore, limit)`.

`executeClassMove` is one batch whose first statement is the gate:

```sql
UPDATE class_moves SET status='executed', executed_at=:now, token=:token, updated_at=:now,
       decided_account_id=:decider, decided_via=:via
WHERE id=:id AND status='requested' AND expires_at > :now AND source_space_id <> dest_space_id
  AND EXISTS (SELECT 1 FROM learners WHERE id=:learner)
  AND EXISTS (SELECT 1 FROM memberships WHERE space_id=:source AND member_kind='learner' AND member_id=:learner)
  AND EXISTS (SELECT 1 FROM spaces WHERE id=:source AND kind='class')
  AND EXISTS (SELECT 1 FROM spaces WHERE id=:dest AND kind='class' AND archived_at IS NULL)
  AND ( EXISTS (SELECT 1 FROM memberships WHERE space_id=:dest AND member_kind='learner' AND member_id=:learner)
        OR ( (SELECT COUNT(*) FROM memberships WHERE space_id=:dest AND member_kind='learner') < :destCap
             AND (SELECT COUNT(*) FROM memberships m JOIN spaces s ON s.id=m.space_id
                  WHERE m.member_kind='learner' AND m.member_id=:learner AND s.kind='class' AND s.archived_at IS NULL AND m.space_id<>:source) < :learnerCap ) );
```

then, each guarded by `EXISTS (SELECT 1 FROM class_moves WHERE id=:id AND status='executed' AND token=:token)`: insert the destination membership (`student`, `joined_at` = now, `ON CONFLICT DO NOTHING`), delete the source membership, deny the source's pending re-links, revoke class-scoped devices minted by the source's re-links (the F-SPACE-002 4.6 statement), delete the source's live/hidden/withdrawn notes of the learner (F-FEEDBACK-001 7.5, reported ones stay), and last clear the token. Exactly the guarantees of F-SPACE-002 4.6: a full destination or a learner at three other classes changes nothing (the source membership stays), two concurrent executes run one swap, an erased learner leaves no orphan row. The school student limit (`cap_school`) is checked in JS before the batch (the same residual check-then-act as `/join`).

### 4.3 Routes (`packages/backend/src/routes/class-moves.ts`, mounted under `/api/spaces`; envelope `{ ok, data | error }`)

Every handler checks the `CLASS_TRANSFER` lock first (`422 transfers_locked`). Bodies are `.strict()`. Anything the caller may not act on answers `404 not_found`, never 403.

| Method · path | Who | Result |
|---|---|---|
| `GET /:id/class-moves/destinations?learnerId=` | `learner.transfer` on `:id` (the source class) | `{ destinations: [{ id, name }] }`: the live classes, other than `:id`, the caller holds `learner.transfer` on and the learner is not in (TV-D7). Names only of the caller's own classes. |
| `POST /:id/class-moves/preview` `{ learnerId, code }` | `learner.transfer` on `:id` | `{ destination: { id, name }, direct }`. Resolves the code exactly as `/join` and the transfer preview do (failed codes count in `rate_hits`, `429 too_many_attempts`); writes nothing else. |
| `POST /:id/class-moves` `{ learnerId, destinationSpaceId, code? }` | `learner.transfer` on `:id` | Guards in order: learner is a member of `:id`; `:id` and the destination are live classes, different (`422 not_transferable`, `409 same_space`); `code` required and checked (`409 destination_changed`) unless the caller also holds `learner.transfer` on the destination; not already a member (`409 already_member`); no open class move and no open transfer request for the learner (`409 already_open`); advisory seats (`409 cap_class` / `cap_school` / `cap_learner`). **Direct** (TV-D7): the row is created and executed in the same call → `200 { move }` with `status: 'executed'`, or `409 move_blocked` when the gate changed no row (the row ends `cancelled`, reason `no_room`). **Accept** (TV-D8): `201 { move }` with `status: 'requested'`. |
| `GET /:id/class-moves` | class: `learner.transfer` on `:id` · family: guardian (9a) of at least one learner of `:id` | Class: `{ outgoing: [...], incoming: [...] }`, open first then the last 30 days; settles expiry first (CAS). Incoming rows before acceptance show `learner: { alias, avatar, level }` (T8) and `from: { name }`; after execution the destination reads the learner like any roster member. Outgoing rows show `learner: { name, avatar }` while still a member, then `null`. Family: `{ notices: [{ id, learnerId, learnerName, to: { spaceId, name }, executedAt }] }` for the family's learners, executed in the last 30 days, `family_seen_at` null. |
| `POST /:id/class-moves/:mid/accept` | `learner.transfer` on the destination (`:id`) | Executes (4.2). `200 { move }`; `409 move_blocked` with `reason` (`cap_class`, `cap_school`, `cap_learner`) when there is no room (the row stays `requested` until it expires, so the class can try again); `409 not_open` / `expired`. |
| `POST /:id/class-moves/:mid/decline` | `learner.transfer` on the destination | `declined`, reason `not_now`. The source sees "This move ended." with no actor (anti-shame, F-SPACE-002 4.2 views). |
| `POST /:id/class-moves/:mid/cancel` | `learner.transfer` on the source | `cancelled`. |
| `POST /:id/class-moves/:mid/seen` | family guardian (9a) of the move's learner | Sets `family_seen_at`; idempotent `200`. |
| `GET /:id/class-scope` | family guardian (9a) | `{ current, learners: [{ learnerId, name, needed }] }` for the family's learners who are in at least one live class. |
| `POST /:id/learners/:learnerId/class-scope` `{ version }` | family guardian (9a) of that learner | Writes the acknowledgement (basis `caregiver`). `422 class_scope_stale` with `current` when `version` is not the current text. |
| `PUT /api/sync/learners/:id/class-scope` `{ version }` | the learner's **full-scope** device (`authorizeDevice` without `allowClassScope`) | Writes the acknowledgement (basis `device`). Same stale rule. |

**Sync inbox** (`GET /api/sync/learners/:id/inbox`) gains, read lock-independently and lenient on the client: `classScope: { needed: boolean, current: string } | null` (null when the learner is in no live class or the device is class-scoped) and `classMoves: [{ id, to: { spaceId, name }, executedAt }]` (executed in the last 30 days; `[]` while `CLASS_TRANSFER` is off or for a class-scoped device). Both parse with `.catch` defaults, so a malformed value never costs an installed app its plans or premium cache (the F-SPACE-002 4.4 rule).

**Roster and reports.** Each roster row and the learner report gain `scope: 'base' | 'full'`; the learner report gains `settings: { classNotes } | null` (TV-D12). `rosterSummary(summary, planIds, kind, { joinedAt, scope, detail })` is the one projection: `detail` (the learner report) keeps `vocab.firstTryRate`, the roster never does. `ReportSummarySchema` gains `vocab` and `stage1Anchor` (optional).

**Transfers.** A guardian consent recorded through `POST …/transfer-requests` or `…/approve` on the family route **at the current transfer text** also writes the class-scope acknowledgement (TV-D4).

### 4.4 Telemetry (names Worker-first in `TELEMETRY_EVENT_NAMES`, codes only, no profile id)

| Name | Payload | Recorded by |
|---|---|---|
| `space.move.requested` | none | Worker, on an accept-type create |
| `space.move.completed` | `{ via: 'direct' \| 'accepted' }` | Worker, on execution |
| `space.move.declined` | none | Worker |
| `space.move.cancelled` | none | Worker |
| `space.move.notice_seen` | `{ seenOn: 'device' \| 'console' }` | Worker (`console`) and app (`device`) |
| `space.scope.acknowledged` | `{ basis: 'caregiver' \| 'device' }` | Worker |

`lib/server-events.ts` restricts `space.move.*` to the keys `via` and `seenOn` and `space.scope.*` to the key `basis`, with their enum values, as it does for `space.transfer.*`. Telemetry is never evidence; the D1 rows are.

## 5. Surfaces

Wireframes: `design/wireframes/console/teacher-move-and-scope.md` (this PR). Mockups: `design/screens/class-moves/README.md` (this PR; agent-made, approved by the multi-agent review, as T-0b was, CLAUDE.md section 5 and F-SPACE-002 T-0b).

**Console, teacher.**
- *Settings, learner row* (class): **Move to another class** opens the teacher move sheet: step 1 lists "Your classes" (from `destinations`, one radio per class) and "A class of another teacher" (the shipped class-code field, **Find class**); step 2 confirms: direct "Move {name} to {class}? This happens now. The family gets a short notice." with **Move now**; accept "Ask {class} to take {name}? The teacher of {class} needs to accept." with **Send**. Done: "Moved. {name} is now in {class}." or "Sent. {class} needs to accept."
- *Class moves page* (`/teach/space/transfers?id=`): a **Teacher moves** section: *Asked to join this class* (alias card, from class, **Accept** / **Not now**, "No room in this class right now." with **Try again**), *Sent from this class* (waiting, **Cancel**), and *Done* (30 days; "Moved to {class}." / "This move ended."). The existing family-request sections stay.
- *Learner report* (per-learner detail): a **Words** block (full scope): "Words: N collected · M known well", "First try: P %" and "Words to look at again: 사과 sagwa (apple) · …" (taught Korean with romanization and gloss, `vocab-catalog.ts`), plus the `words_revisit` insight (F-REPORT-001 P5) that now fires; a **Settings** line "Notes from the class: on / set messages only / off". At base scope one muted line: "Words and more show once the family has read the update." No ranking, no comparison, amber only.
- *Roster*: the dormant word lines of F-VOC-005 P-4 (`StudentWordsLines`, `WeekWordsRevisit`) show for full-scope learners with no code change beyond the projection.

**Console, family** (`/parent`, the parent home): one card per learner who needs the acknowledgement ("An update about {name}'s classes", the lines of section 3, **OK**), and one card per unseen move notice ("{name} moved to a new class: {class}." **OK**). Neither card is red; both are dismissed only by **OK**. The class moves page for a family hides the teacher-requests switch while class moves are on (TV-D11).

**Learner app.**
- *Home*: a move notice line "{name} moved to a new class: {class}." with **OK** (remembered per profile on the device through the storage wrapper; never a grown-up screen). A class-scope line when `classScope.needed`: for a child profile "A grown-up has an update about your class." with **Open**, which goes through the grown-up gate (PIN) to the `ClassScope` screen; for a self profile "There is an update about your class." with **Open**, straight to it.
- *`ClassScope` screen* (grown-up destination, added to `GrownUpDestination` and the `PinEntryScreen.proceed()` chain): the lines of section 3 and **OK**, which sends `PUT …/class-scope`; offline: "This needs internet." and nothing is queued.

## 6. PR breakdown (stacked, each with base `main` and "Stacked on #N")

| PR | Contents | Depends on | Deploy note |
|---|---|---|---|
| **TV-A** docs | This amendment; pointers in F-SPACE-002 (header, T11, T-8, section 7), F-VOC-005 (P-4b done by TV-B), F-REPORT-001 (3.8 scope), F-FEEDBACK-001 (8.2 settings line), F-LEARN-001 (consent pointer); wireframe and mockup | — | no code |
| **TV-B** Worker + content-schema | `schemas/class-scope.ts` (text, versions, keys, bodies, inbox fields, telemetry names), transfer text `transfer-2026-10d` (en/es/ko, new items and line, pinned hashes); migration `0009`; `Db` methods on both adapters; `roster-summary.ts` scope projection; roster, learner report and class report pass the scope; `routes/class-moves.ts`; ack routes (console and device); inbox fields; guardian consent writes the ack; server-events filter; tests (memory + sqlite) | TV-A | **Worker first**: the migration applies on merge, the routes ship behind `CLASS_TRANSFER` (still unset → locked); the visibility change needs an acknowledgement, which nobody can give until TV-C, so nothing a user sees changes |
| **TV-C** console + app | console API client, teacher move sheet, teacher moves section, learner report Words and Settings blocks, family cards (ack and notice), family switch hidden; app inbox mapping, store, Home lines, `ClassScope` screen and gate destination; en/es/ko strings; unit tests; Playwright e2e (console move, family acknowledgement, teacher words view) | TV-B deployed | ships inert where the Worker is locked: the move entries need `NEXT_PUBLIC_CLASS_TRANSFER` and the first `transfers_locked` hides them; the acknowledgement surfaces work regardless |
| **TV-D** flip + legal copy + runbook | `CLASS_TRANSFER` on by default with `disabled` as the kill switch (Worker and console), wrangler comment; `/privacy` and `/terms` in English (English-authoritative on `/es` and `/ko`, F-I18N-001 L10) describing TV-D1 to TV-D11 as the owner's decision; in-app consent and class-scope copy in en, es and ko (TV-B, TV-C); `docs/launch/owner-runbook.md` kill-switch steps | TV-C | Worker first: the Worker opens moves on deploy; the console build follows |

**Statement budget (G7 (b) for the new path).** A direct move runs: auth and memberships (3-4 statements), the source and destination spaces and their parents (2-4), the learner, membership and open checks (3), seat counts (3-5), the create batch (1) and the execute batch (1 batch of 8 statements). Under 40 on the Free plan's 50, measured by a test on the sqlite shim that counts prepared statements per call. The destinations list reads each distinct parent once (not once per class), so a school admin with 60 classes stays under 20 statements (tested).

## 7. Tests

| File | Covers |
|---|---|
| `content-schema/__tests__/class-scope.test.ts` | versions, keys classified, items for every key, line parity and pinned hashes per locale, 16-word cap, bodies strict, inbox fields lenient (a frozen pre-change `SyncInboxSchema` still parses; a malformed `classMoves` element is dropped), telemetry names |
| `content-schema/__tests__/transfer-consent.test.ts` (extend) | `transfer-2026-10d` pinned; every earlier version still accepted; new items and the `teacher_moves` line in every locale |
| `backend/lib/__tests__/roster-summary.test.ts` (extend) | family reads everything; full scope reads the family view with own plans only; base scope byte-identical to today; `firstTryRate` only with `detail`; the `w` coupling follows the scope |
| `backend/__tests__/class-moves.test.ts` | lock; direct move (owner of both, teacher of both, school admin over both); accept flow (create, list views without name or id before execution, accept, not now, cancel, expiry); guards and error codes; IDOR (foreign `:id`, foreign `:mid`, source manager cannot accept, destination cannot cancel); capacity block keeps the source membership; class devices revoked and re-links closed; family notices and seen; no name in any path; telemetry codes only; statement budget |
| `backend/__tests__/class-scope.test.ts` | console and device acks, the `CLASS_SCOPE_FULL` kill switch, a failed ack read answering base, the daily purge of executed and expired-unsettled rows, an open teacher ask blocking a family-started request, stale version, class-scoped device refused, roster and reports switch from base to full only after the ack, guardian consent at the current transfer text writes the ack, inbox fields |
| `backend/db/__tests__/db-contract.test.ts` (extend) | every new method on both adapters; the execute gate cases; `deleteLearner` removes the new rows; `reset()` |
| `web/lib/console/__tests__/class-moves.test.ts`, component tests | API client calls, sheet steps and states, page sections, family cards, report blocks, copy passes `isCaregiverSafe`, no colour literals, URLs carry the space id only |
| `mobile` unit tests | inbox mapping, store, Home line rules (child vs self, seen list), `ClassScope` screen and gate destination |
| `apps/web/e2e/class-moves.spec.ts` | the console move sheet (direct and accept), the family acknowledgement card, the teacher's Words block, against the e2e fixtures |

## 8. Owner decision log

| Date | Decision (as given) | Where it lands |
|---|---|---|
| 2026-10-14 | Teachers and parents see all of a learner's information, settings and learning progress, including the words summary per learner on the teacher console. | TV-D1, TV-D2, TV-D12; F-VOC-005 P-4b done |
| 2026-10-14 | Class transfer is at the teacher's discretion: direct when the teacher manages both classes (or a school admin); the receiving class's acceptance is kept when it is another teacher's class; no family consent; the family sees a one-time notice. | TV-D7 to TV-D11 |
| 2026-10-14 | Bump the consent text with the new wording; families under an older version acknowledge once; until then teachers see the old scope; old versions stay accepted. | TV-D3 to TV-D6 |
| 2026-10-14 | Update `/privacy`, `/terms` and the in-app consent copy in en/es/ko as the owner's decision, without claiming legal review; then turn `CLASS_TRANSFER` on and keep its kill switch. | TV-D13, TV-D14; F-SPACE-002 T-8 done |

## 9. Risks the owner accepted by these decisions (recorded, not blocking)

- **No family consent before a teacher move.** A teacher who manages two classes can move a learner between them, and any teacher can send a learner to a class that accepts, without asking the family first; the family learns afterwards. The family can still leave a class from the learner's Profile and join by code (unchanged).
- **The acknowledgement is not verified consent.** A guardian account cannot prove parenthood (F-SPACE-002 O-3) and a device acknowledgement is a tap behind the grown-up PIN (F-SPACE-002 A4). The record says which.
- **No counsel has seen this wording.** The privacy page, terms and consent texts are the owner's own decision; the counsel packet can still be sent and its answers applied by a later text version (the version mechanism makes a later change explicit to every family).
