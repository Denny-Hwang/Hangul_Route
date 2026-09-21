# Console/Relink-approval — approve a student's new device (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §5 (restore table, row "new device — class student"), §5.1 (Rescue Code), §5.2 (merge on restore) · `docs/specs/F-TCH-001-teacher-classroom.md` §3.1
Code (F-TCH-001 §10.1, 2026-09-21 — server + learner side): `packages/backend/src/routes/relink.ts` (create · list · approve · deny · one-time pickup poll, 10-minute window) and `apps/mobile/src/screens/sync/JoinSpaceScreen.tsx` ("I was already in this class" → pick a name → waiting card polling every 4 s → restored). Teacher page `apps/web/src/app/teach/space/[id]/relink/page.tsx`: cards newest first with Approve / Deny, coarse countdown, refresh every 10 s, empty state, and "Another way" = learner picker → **Issue a new rescue code** shown once ("Show rescue code" is impossible by design, app map §7 #24). Not yet: undo after deny, push/email.
Audience: **teacher** (class space); **parent** only via `sync/restore` sign-in — this screen is teacher-side

## Scenario (Given-When-Then)

Given: a student got a new tablet, entered the class join code, and picked their own name from the roster in `sync/join-space`
When: the teacher opens the pending request within the 10-minute window
Then: they see *which* learner name is being claimed and *when*, and approve or deny with one tap — or read the learner their Rescue Code instead

## Screen goal

"Decide one re-link request safely inside the 10-minute window."

## Box diagram

```
+------------------------------------------------------------+
| [< back to roster]   Re-link requests - Sunday Class A     |
|                                                            |
|  +------------------------------------------------------+  |
|  | Someone is asking to be  "Minho"                     |  |   <- learner display name, large
|  | asked 2 min ago - tablet - expires in 8 min          |  |   <- countdown, coarse (minutes)
|  |                                                      |  |
|  | 1 line: "approve only if Minho is with you or you    |  |
|  |          expect this" (placeholder)                  |  |
|  |                                                      |  |
|  |   [[ APPROVE ]]              [ Deny ]                |  |
|  +------------------------------------------------------+  |
|                                                            |
|  +------------------------------------------------------+  |
|  | "Suji"   asked 9 min ago - expires in 1 min          |  |   <- second request, same shape
|  |   [[ APPROVE ]]              [ Deny ]                |  |
|  +------------------------------------------------------+  |
|                                                            |
|  Another way                                               |
|   1 line: "or read the student their Rescue Code"          |
|   [ Show rescue code for ... ]  (learner picker)           |   <- roadmap sec 5.1, allowed for teacher
+------------------------------------------------------------+
```

- One request = one card; the newest first. Each card has exactly one primary CTA.
- Denying is quiet: the student device shows "ask your teacher" (placeholder), never an accusation.
- No progress numbers on this screen — identity and timing only.

## Interaction points

- [[ APPROVE ]] → server binds the new `device_id` to the learner; the student device pulls the snapshot and merges (roadmap §5.2, "we found your old cards"); card collapses to "approved" for 5 s then disappears
- [ Deny ] → request closed; card removed; optional 1-line undo for 5 s
- [ Show rescue code for ... ] → learner picker sheet → code displayed large + [ copy ] (the code is not progress data — roadmap §5.1)
- Expired card → replaced by "this request expired — ask the student to try again" + [ dismiss ]
- [< back to roster] → `console/roster`

## Navigation graph

Enter from: `console/roster` ([ N re-link request ] chip) · `console/home` (class row "1 re-link request waiting") · email / push link (F-NOTIF-001, later)
Exit to:    `console/roster` · `console/home`

## States

- **success**: one or more pending cards, countdown running.
- **empty** (no pending requests): single reassurance card "nothing waiting" + the "Another way" block still visible (teachers land here from a stale link).
- **expired**: card in expired state (above); counts as empty once closed.
- **error**: approve / deny fails → card stays, inline "didn't go through" + [ TRY AGAIN ]; if the window elapses meanwhile, it becomes the expired state (no silent success).

## Data needs

- reads: pending re-link requests for this space — learner id, display name, requested_at, expires_at (= requested_at + 10 min), device platform hint · learners' Rescue Code availability (whether `recovery_hash` exists; the code itself is delivered on demand)
- writes: approve → bind device (new `snapshots.device_id` owner + allow `GET /sync/learners/:id/snapshot` from that device) · deny → close request
- telemetry: `console_relink_viewed{pending}`, `console_relink_approved`, `console_relink_denied`, `console_relink_expired`, `console_rescue_code_shown{by: teacher}`

## Open questions

- Roadmap §8 lists no route for creating / listing / approving re-link requests (only `/recovery/claim` for codes). Needs an API row (e.g. `POST /spaces/:id/relink`, `POST /spaces/:id/relink/:reqId/approve`) before S5.
- **Rescue Code default ON** (roadmap §11 Q2) is **deferred**: if OFF, "Another way" only appears for learners whose code exists.
- Does showing a Rescue Code to a teacher need a second confirmation (it grants restore anywhere)? Default: one confirm sheet; pilot feedback decides.
- Push / email for a pending request is F-NOTIF-001 scope; until then the teacher must be on the console — is a 10-minute window realistic in a classroom? Consider "extend 10 more minutes" from the student side (not in this wireframe).
