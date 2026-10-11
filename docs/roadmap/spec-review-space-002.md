# REVIEW-SPACE-002 — F-SPACE-002 class transfer: findings applied

Files edited in place: `specs-out/F-SPACE-002-class-transfer.md` (rewritten around the findings; Status stays `ready`, scoped: T-0..T-5 ready with the flag off, T-6/T-7 wait for mockups T-0b, device consent route off until counsel, gate G6), `specs-out/wireframes/class-transfer.md` (v2).
Verified against `origin/main` `8083d5d` (main moved from `8602061` during the round; none of the files the spec cites changed in between).
Result: 18 privacy + 27 data + 22 ux = 67 findings; 7 blockers (all closed in the text), 34 majors, 26 minors. 63 accepted (8 of them reshaped, marked A*), 4 partly accepted (P7, D17, U15, U21); none rejected outright. Unresolved blockers: none. What remains are owner/counsel gates (bottom of this file).

## Findings table

Disposition: A = accepted as proposed, A* = accepted with a different shape (see note), P = partly accepted (reason in the note).

| # | Lens | Sev | Finding (short) | Disp. | What changed / why |
|---|---|---|---|---|---|
| P1 | privacy | blocker | "Guardian" = anyone with `snapshot.read` on a family; a teacher can build a family around the child | A* | Spec 4.2 guard 9: aged membership (24 h, guardian and learner) + separation of duties (no account membership in source/dest/school above, not owner, not initiator/consenter) checked at consent **and** execution (`conflicted_guardian`); `visibleToday` list; `old_space_still_has_access` audit event; B3 family-code hole raised to flip gate G4 / O-3. **Not applied:** the "code reissued after the request" clause, because `joinCodeExpiresAt` does not record when a code was issued and membership age is what is checkable. Test added (teacher joins as caregiver). |
| P2 | privacy | blocker | Device route cannot be verified; a teacher can complete a request through a Rescue-Code device | A | T3, guard 10, 4.4: device route only for learner-started requests, never for source-started (`caregiver_required_for_teacher_request`), basis `device_attested` (+ client `l_attest`), separate Worker var `CLASS_TRANSFER_DEVICE_CONSENT` (off), flip gate G6 with written counsel sign-off, behaviours 9-10. Consequence stated: class-only learners cannot be moved by transfer until G6 or B2. |
| P3 | privacy | major | Batch is atomic but not conditional; cancel between read and batch is ignored | A | 4.6: single gate `UPDATE` with all preconditions; every later statement guarded by the executed row; `meta.changes` of the gate decides; behaviour 15; contract test. |
| P4 | privacy | major | Learner consent stays valid 14 days though terms/guardian can change | A | 4.1 consent-time columns (`l_dest_*`, `l_source_name_hash`, `l_premium_change`); 4.6 step 5 compares and resets to `pending` (`consent_outdated`: `terms_changed` / `guardian_changed` / `lapsed`); 72 h blocked-validity; behaviours 16-17. |
| P5 | privacy | major | Consent says "nothing else" but roster returns lastActiveAt, accuracy, level-check, anchor | A | `TEACHER_VISIBLE_SUMMARY_KEYS` allow-list, roster projected to it (T-1a), consent bullets generated from it, test fails on drift; `stage1Anchor` dropped from the roster (nothing in `apps/web` reads it), `placement` kept (F-PLC-001 roster line). One canonical text for console and app (T18). |
| P6 | privacy | major | Pre-acceptance destination view shows the real name and learner id | A | T8, views: always `rosterAlias`, picture, level label; no learner id (address by transfer id); full name only after execution; test (behaviour 18). |
| P7 | privacy | major | Unauthenticated `lookup` keeps leaking the new class's roster to the old teacher | P | Gap documented in 4.10, consent wording narrowed ("in that class"), durable `lookup` limiter and "New class code" prompt, owner decision O-5 and gate G4. **Not applied:** restricting `lookup` rosters to proven devices or aliases: the roster is the re-link picker (`membership-store` lookup; `RelinkCreateSchema` needs `learnerId`), so closing it is an F-TCH-001 change. |
| P8 | privacy | major | Join codes can be probed through create (only successes counted) | A | Guard 4, 4.9: D1-backed failed-code counter (10/h, 30/day per account or learner) via new `rate_hits`; entitlement to the learner checked before any destination fact; create/preview answer class name only to a teacher. |
| P9 | privacy | major | No cooling-off or notice; one caregiver + cooperating teacher moves a child in minutes | A* | T12: 48 h cooling-off (`execute_after = l_at + 48 h`), any caregiver or the learner's device can cancel, family page/Home show "A move is planned". No scheduler exists, so execution is lazy in `settle` (documented). The "archived source: no wait" exception is dropped (see D17). |
| P10 | privacy | major | Caregiver alone consents for an adult learner; device locked out | A* | Learner-set `selfManaged` + guardian-set `blockTeacherRequests` (new `learner_transfer_prefs`), always-available device veto (guard 11), 48 h window; `options` limited to the family's own learners. **Different from the proposal:** the server cannot tell an adult, so "learner's consent in addition" became the learner-owned switch + veto instead of a second required consent. |
| P11 | privacy | major | Terminal rows incl. `executed` purged at 90 days, erasing consent evidence | A | 4.1 retention: purge declined/cancelled/expired only; keep `executed` while the learner and destination membership exist (or 90 days after execution if the learner left it); counsel to confirm. |
| P12 | privacy | major | Destination identified only by an unchecked class name | A | Learner-side view/preview shows owner display name, school name, class age bucket, learner count; consent lines `typed_names` and `from_teacher`; owner id and name hash stored in the consent record. |
| P13 | privacy | minor | 30-day rule only per (learner, destination); teacher sees refusal | A | `lastLearnerRefusal(learnerId, since)` for any destination; source gets neutral `cannot_send`; per-learner `blockTeacherRequests` switch. |
| P14 | privacy | minor | Consent English-only; locale not recorded | A | `l_locale`, reviewed en/ko/es texts before the surface flips (G2), language switch on the sheet, per-locale hashes under one version, counsel in T-8. |
| P15 | privacy | minor | Ids guessable; ownership of `:tid` not stated | A | 4.4 ownership rules (404), `crypto.randomUUID()` ids, IDOR tests. |
| P16 | privacy | minor | Telemetry stores profileId with transfer events; forgeable | A | Sent without `profileId`; server restricts payload keys for `space.transfer.*`; "telemetry is never evidence" (T13, 4.12). |
| P17 | privacy | minor | Future notifications could leak PII/tokens; silence-as-consent could creep | A | Section 8 constraints on F-NOTIF-001; A3(ii) limited to the source slot. |
| P18 | privacy | minor | Source can end a guardian-started request by archiving | A | 4.13: archiving after the learner side agreed sets `s_state = not_required`, request continues; only destination archive cancels; behaviour 23. |
| D1 | data | blocker | `putTransfer` whole-row read-modify-write loses consents/declines | A | 4.6/4.7: no `putTransfer`; single-statement CAS methods returning changes; multi-slot approve one UPDATE; `settle` promotes/executes idempotently; MemoryDb check-then-write; race tests with a decorator (`transfer-races.test.ts`). |
| D2 | data | blocker | Unconditional batch can leave a child in no class, double-execute, orphan membership | A | 4.6 gate SQL (status, expiry, cooling-off, learner exists, source membership, dest live, capacity counts inside the gate) and guarded dependants; school limit named the one residual check-then-act; contract tests for each failure. |
| D3 | data | major | Consent covers facts not stored; no rev/updated_at/CHECKs | A* | 4.1: `rev`, `updated_at`, consent-time columns, `l_locale`, four CHECKs. **Different:** the proposed `terms_changed` block reason is merged into the single `consent_outdated` reset (a block reason is for capacity). `CHECK (d_state <> 'not_required')` is expressed by the narrower `d_state` enum instead. |
| D4 | data | major | Wireframes need a name before create; `lookup` is no substitute | A | New `preview` routes (console + device), create takes `destinationSpaceId` + code and re-verifies; wireframe "Check" -> "Find class". |
| D5 | data | major | Strict `transfers` array in the inbox can discard plans and tier | A | 4.4: `lenientArray`, loose enums on the wire, defaults; tests in the right direction (frozen old schema parses new payload; malformed element still yields memberships/plans/tier). |
| D6 | data | major | Clients cannot see the lock; console/Worker flip independently | A | `transfersEnabled`, `transferDeviceConsent` in the inbox; console hides on first `422 transfers_locked`; flip order and rollback in T15 and 4.8. |
| D7 | data | major | One shared consent version string locks out old app builds on any copy fix | A | `ACCEPTED_CONSENT_TEXT_VERSIONS`, `current` in the 422 body, `l_locale`, per-locale parity test (4.11). |
| D8 | data | major | Zod strips unknown keys; approve body lets textVersion be omitted | A | All transfer bodies `.strict()`; approve is a discriminated union with `.superRefine`; tests. |
| D9 | data | major | `:tid` not tied to `:id`; family predicate satisfied by any family | A | 4.4 ownership rules per route; 404; per-route foreign `:id`/`:tid` tests. |
| D10 | data | major | "Entitlement follows the learner" is false in the model; tierAfterMove duplicates the rule | A | T6b with evidence and A1 owner choice; `tierFromSpaces` shared helper + parity test; family_lifetime test. |
| D11 | data | major | A price appears in prose | A | Removed; A1 cites `lib/entitlement.ts:26-31` and `schemas/entitlement.ts:64-67` (the `per: 'year'` line) only. |
| D12 | data | major | Purge deletes evidence; purge on GET; `DELETE … LIMIT` portability | A | Retention as P11; purge on create only, bounded sub-select, indexes `(status, ended_at)`. |
| D13 | data | major | Consent list vs roster contents | A | As P5. |
| D14 | data | minor | Device creates have no durable limit; teacher request blocks the only slot | A | 3 per learner per day (`rate_hits`); `already_open` body says who started it (learner side only). |
| D15 | data | minor | Create not idempotent | A | 200 with the same request for the same caller identity. |
| D16 | data | minor | Cooldown punishes self-cancel | A | 7-day pair cooldown only after another side declined a learner-side request; not after own cancel/withdraw/expiry. |
| D17 | data | minor | Archived-source path contradictory and unreachable | P | Contradiction fixed (guard 1 requires a live source at creation; 4.13 says what happens after). `s_state = not_required` is **kept** but reachable only through the archive transition, never at creation, because P18 requires an archive not to veto. `l_state`/`d_state` lose `not_required`. |
| D18 | data | minor | Steps 3-4 skip order | A | `classSeatCheck` skipped for an existing member; also inside the gate; test with a full destination that already holds the learner. |
| D19 | data | minor | `batch` breaks the d1-snapshot-cas fake; reset lists; shim must be synchronous | A | 4.7 file list, per-statement results, synchronous shim loop, reset lists (T-3a). |
| D20 | data | minor | Test plan cannot show rollback/races on MemoryDb | A* | Transaction rollback is proven at `D1Like.batch` level, guard semantics on both adapters, races with a decorator, fake timers. **Different:** the proposed "non-existent destination id forces an FK error" cannot work with a gate that changes 0 rows on a missing destination, so a CHECK-violating last statement is used. |
| D21 | data | minor | T-4 refactors live `/join` | A | Own PR T-4a with a characterization test before anything uses it. |
| D22 | data | minor | Missing indexes; inbox must read the flag first | A | Three indexes added; inbox reads the lock before any query. |
| D23 | data | minor | N+1 view building | A | Cap 50, set-based `getLearners`/`getSpaces`, Db-call-count test. |
| D24 | data | minor | Device revocation SQL missing; client silently keeps stale rows on 401 | A | SQL in 4.6; client 401 handling "Join your new class again." (4.6, 4.12, behaviour 8). |
| D25 | data | minor | Guardian is "anyone with the code"; orphaned family | A | Assumptions A10; `l_role` recorded; escape hatch stated. |
| D26 | data | minor | F-SPACE-002 is referenced in four files, not two; one cite wrong | A | Spec id note and T-0 list four files; wrong cite replaced by `routes/plans.ts:83-95`. Alternative id left as O-12. |
| D27 | data | minor | "Unverified" items are verifiable | A | Section 9 "Verified, not assumed"; cascade rule in 4.1. |
| U1 | ux | blocker | Consent sheet needs the destination name before create | A | As D4. |
| U2 | ux | blocker | Consent text is not one text; two required lines missing | A | `TRANSFER_CONSENT_LINES` keyed list (4.11) incl. `device_relink`, `homework_drops`; wireframes 3, 5, 6 reference ids; test that every sheet renders every applicable id; `l_shown_json` records them. |
| U3 | ux | blocker | Adult learners need a caregiver's yes | A* | As P10: `selfManaged`, device route for learner-started moves (still gated by G6), informational line to caregivers, behaviour 20. |
| U4 | ux | major | Dead-end learners (no PIN, legacy, class-only) | A* | Route table + `none` state with copy and PIN setup link; `pinCreatedAt` (legacy PIN counts as old enough); "Waiting for the family." only. **Stated limitation:** class-only learners cannot answer a teacher-started request in v1 (4.13); creation returns `family_needed`. |
| U5 | ux | major | Guardian has no persistent entry | A | 4.8: Move on class rows, "Move to a class" on family rows, permanent "Class moves" buttons. |
| U6 | ux | major | PIN spent before the dead end | A | 4.12: route decided from the inbox; four row variants in wireframe 4. |
| U7 | ux | major | Un-gated decline/withdraw; cooldown copy mismatch | A* | UI: decline/cancel inside the gated sheet and console only. Server keeps the learner device veto (P10) because it only reduces. Cooldown copy states the real window to the learner side; the teacher gets neutral `cannot_send`. |
| U8 | ux | major | Views reveal who declined | A | Views section: outward statuses `waiting/yes/scheduled/ended`, no actor or reason; decider's own history keeps it; test. |
| U9 | ux | major | Consent English-only | A | As P14; "Not available in your language yet." instead of a silent English fallback; 합니다체 per F-I18N-001 (`docs/specs/F-I18N-001-ui-locales.md:324`). |
| U10 | ux | major | Eight stacked items, 30-word list, not Pre-A1 | A | Layered sheet, 16-word sentence cap enforced by the copy test, button active after the end/disclosure. |
| U11 | ux | major | Premium handling vague | A | A1 first in section 9; concrete non-commercial line; behaviour 12; carry-over option listed as a question. |
| U12 | ux | minor | Price in prose | A | As D11. |
| U13 | ux | major | Headline overclaims while join-by-code bypasses consent | A | Title and T2 reworded ("an agreed path"); B1 is flip gate G3; privacy copy must not call the transfer "the consent path". |
| U14 | ux | major | No mockup step; unresolved questions while Status ready | A | T-0b hard dependency; header scopes the status; wireframe open questions listed. |
| U15 | ux | major | PRs too big; device route ships before counsel | P | PR table split (T-1a/b, T-3a/b, T-4a/b, T-5a/b/c, T-6a-d, T-7a-d); device consent behind its own var. **Not applied:** reusing `F-SPACE-003` for this feature (the id is the orchestrator's) — T-0 fixed instead. |
| U16 | ux | major | Wording by kind inconsistent; school admin has no view | A | Wording table (move / `memberNounSingular`), family title from the space name, `TransferSchoolCountView`, school badge. |
| U17 | ux | major | App copy wrong for initiator and audience | A | Copy variants by initiator and `deviceAudience` in 4.12 and wireframe 7. |
| U18 | ux | minor | Decline reasons apply to all slots; 30-day key | A | `reason` only on the destination slot; 30 days per learner (P13). |
| U19 | ux | minor | Accessibility gaps | A | 4.8 and wireframe: stable order, live region, no auto-dismiss, check-mark glyph, nudge token with contrast test, shipped single code field, focus rules. |
| U20 | ux | minor | State coverage gaps | A | States list in the wireframe and 4.8 (loading, 401, 403, locked/stale, success, `not_open`/`expired`, not persisted). |
| U21 | ux | minor | School admin fills both slots silently | P | Neutral "Agreed by the school admin" line and one-slot-per-action (T11). **Not built:** the proposed school setting to switch admin agreement off; asked as A6. |
| U22 | ux | minor | Token rule not stated | A | 4.8 and wireframe style rule; no-colour-literal test. |

## Cite and symbol re-verification (origin/main `8083d5d`)

About 110 `file:line` cites in the new spec were resolved with a script and the lines read (every one in the spec's Context, 4.x and 9 sections); every claimed existing symbol, table and route was checked by grep. Corrections made:

| Was | Now | Why |
|---|---|---|
| `spaces.ts:209-218` (plan targets resolve to nothing) | `routes/plans.ts:83-95` (filter `:89`) | the old range is the `/members` route |
| main `8602061` | `8083d5d` | main moved; none of the cited files changed in the diff |
| "F-SPACE-002 referenced in two files" | four files (`F-SPACE-001:84`, `10-app-map.md:320`, `join-space.md:85`, `F-AUTH-002:53`) | grep |
| `schemas/entitlement.ts:64-67` used next to a price | kept only as the "yearly" marker, no price | prices banned in this feature |
| "PIN set by whoever taps first (F-LEARN-001)" | `account-store.ts:22-25` (one PIN per device) | the first claim described a pre-F-LEARN-001 state |
| `relink.ts:46-50` (reviewer's `rosterAlias` cite) | `schemas/relink.ts:46-50` | the helper lives in content-schema |
| `entitlement.ts:70ff` (reviewer, `FAMILY_LIFETIME_LEARNERS`) | `schemas/entitlement.ts:70` | different file from `lib/entitlement.ts` |
| "no PIN-creation timestamp" (spec claim) | confirmed: `account-store.ts` keys `:14-26` hold none | new key `account:pinCreatedAt` specified |

Confirmed unchanged and correct (sample): `spaces.ts:30-33, 35-37, 60-67, 95-99, 101-104, 106-141, 133, 174-201, 222-236, 260-269, 271-281, 283-321, 291-292, 294-333, 336-346, 348-359, 361-389, 392-399`; `can.ts:35-68, 36, 37, 58-60, 62-68, 72-78`; `access.ts:14-41, 31-38, 43-57, 68-75`; `recovery.ts:27-29, 56-72, 80-111`; `relink.ts:14-19, 24-44, 105-124, 119`; `device-auth.ts:49-68`; `sync.ts:106-125`; `entitlement.ts:26-31, 34-36, 78-89, 91-100`; `join-code.ts:3-4`; `rate-limit.ts:1-4, 12-30, 33`; `store.ts:123-125`; `d1.ts:11-19, 100-110, 134-143, 204-208, 232-237, 265-269`; `memory.ts:48-55, 69-74, 120-122, 150-152`; `helpers/sqlite.ts:11-22, 19-47`; `d1-snapshot-cas.test.ts:12-26`; `0002_schema_v2.sql:44-50, 66-74, 92-104, 107-121`; `0003_device_scope.sql`; `wrangler.toml:47, 63-67`; `ci.yml:61-62`; `schemas/sync.ts:16-48, 75-85`; `schemas/space.ts:41-46, 87-91, 94-102, 105`; `schemas/relink.ts:9`; `schemas/telemetry.ts:9-60`; `routes/telemetry.ts:38-59`; `app.ts:55-59`; `settings/page.tsx:139-152, 148, 154-155`; `teach/space/page.tsx:116, 132-142, 136-138, 165`; `routing.ts:5-21, 79-81`; `routing.test.ts:39-41`; `membership-store.ts:76-90, 79-83`; `sync-api.ts:235-240`; `learner-type.ts:7-10, 27-31`; `gate-route.ts:11-17`; `PinEntryScreen.tsx:100-113`; `SpacesCard.tsx:28-37, 39-61`; `navigation/types.ts:5, 37`; `plan-derivation.ts:61-68`; `ProfileScreen.tsx:73`; `privacy/page.tsx:48`; `docs/launch/app-store-submission.md:76-80`.

Symbols/tables/routes verified present: `Db`, `D1Db` (`changes`), `MemoryDb`, `D1Like`, `dbFor`, `requireAccount`, `accountActor`, `spaceContext`, `learnerContexts`, `rosterName`, `rosterAlias`, `classCap`, `schoolIsFull`, `tierForLearner`, `classIsPro`, `isJoinCodeLive`, `authorizeDevice`, `learnerMembershipRows`, `inboxPlansFor`, `createRateLimiter`, `clientKey`, `lookupLimiter`, `relinkLimiter`, `isCaregiverSafe`, `levelLabel`, `createConsoleApi`, `ROUTES`, `memberNoun`, `GrownUpDestination`, `PinEntry`, `gateOpensDirectly`, `deviceAudience`, `useMembershipStore`, `SpacesCard`, `TELEMETRY_EVENT_NAMES`, `SyncInboxSchema`, `LearnerMembershipSchema`, `ProgressSummarySchema`; tables `learners`, `learner_devices` (`scope`), `snapshots`, `accounts`, `spaces`, `memberships`, `plans`, `relink_requests`, `entitlements`, `waitlist`; routes `/api/spaces/*`, `/api/sync/learners/:id/inbox`, `/api/recovery/*`, `/api/telemetry`. Not present (as the spec says): `transfer_*`, `learner_transfer_prefs`, `rate_hits`, `D1Like.batch`, `lib/seats.ts`, `account:pinCreatedAt`, `memberNounSingular`, any Cron Trigger (`wrangler.toml` has none).

## Still open (owner/counsel, not spec gaps)

1. A1 premium: accept that a class-covered learner takes the new class's plan, or carry-over (commercial feature).
2. A3 source consent: hand-off vs notify-only vs silence-releases.
3. A4/G6: counsel sign-off for device-attested consent (without it, class-only learners cannot be moved).
4. B1/G3: PIN gate on join/leave vs signed acceptance.
5. O-3/O-5/G4: family-code hole friction vs an F-SPACE-001 change; lookup roster exposure vs an F-TCH-001 picker redesign.
6. B2: guardian email for class-only learners.
7. O-8 numbers (48 h, 14 d, 72 h, 24 h, cooldowns) and A6 school admin.
8. G2: counsel review of the consent lines in en/ko/es and the retention length; G5/T-0b: owner's mockups; B4 (13+ line).
9. O-12: keep `F-SPACE-002` and renumber parent-email in four files, or take `F-SPACE-003` here.
