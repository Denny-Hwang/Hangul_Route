# Console/Account — email, consent, backup, learners, delete, sign out (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §2 (`accounts`, `learners.recovery_hash`), §5 (restore table incl. file export), §5.1 (Rescue Code), §5.3 (deletion) · `docs/specs/F-AUTH-001-family-ownership-clerk.md` · `docs/blueprints/10-app-map.md` B6 / B8
Audience: **parent** (primary) · **teacher / school admin** (same screen, "Linked learners" shows only family-space children — never class students)

## Scenario (Given-When-Then)

Given: a signed-in adult wants to check what the app knows about them, keep a backup of their kids' progress, or exercise a deletion right
When: they open Account (web, or mobile after the PIN gate)
Then: everything personal is on one page in plain language, backup is one tap, and destructive actions are last and confirmed

## Screen goal

"Give the adult control over their account, consent record and their learners' backups."

## Box diagram

```
+------------------------------------------------------------+
| [< back]   Account                                         |
|                                                            |
|  Signed in as                                              |
|   parent@example.com          [ Change email (Clerk) ]     |
|                                                            |
|  Consent record                                            |
|   1 line: "you agreed to <policy version> on <date>"       |
|   [ View what this covers ]   [ Withdraw ]                 |   <- withdraw = delete-learner path
|                                                            |
|  Backup                                                    |
|   +------------------------------------------------------+ |
|   | Rescue Codes  (1 line: "brings cards back on any device") |
|   |   Suni   [ show code ]                               | |   <- per learner, revealed on tap
|   |   Minho  [ show code ]                               | |
|   +------------------------------------------------------+ |
|   [ Export progress file ]  (.hangulroute.json)            |   <- roadmap sec 5 row 4, no server
|                                                            |
|  Linked learners                                           |
|   +------------------------------------------------------+ |
|   | [avatar] Suni    Kim family - Sunday Class A         | |   <- spaces this learner is in
|   | [avatar] Minho   Kim family                          | |
|   +------------------------------------------------------+ |
|                                                            |
|  ---- Danger zone ----                                     |
|   [ Delete a learner's data ]   1 line: permanent          |
|   [ Delete my account ]         1 line: spaces you own too |
|                                                            |
|  [ Sign out ]                                              |
+------------------------------------------------------------+
```

- No `[[ ]]` primary CTA; a settings surface. Backup is the most useful block and sits above the fold.
- Mobile variant: identical sections; "show code" reuses the `sync/save-progress` code panel.

## Interaction points

- [ Change email (Clerk) ] → Clerk user profile (hosted); returns here
- [ View what this covers ] → policy sheet (web `/privacy` content, read-only) · [ Withdraw ] → explains that withdrawing means deleting the learner's cloud data → the delete-learner picker
- [ show code ] → reveal sheet: code large + [ copy ] + [ regenerate ] (`POST /recovery/rotate`, old code stops working — confirm)
- [ Export progress file ] → web: downloads `.hangulroute.json` for all linked learners · mobile: share sheet
- Learner row tap → `parent/learner-detail`
- [ Delete a learner's data ] → picker → typed-name confirm → `DELETE /learners/:id` (roadmap §5.3)
- [ Delete my account ] → confirm listing owned spaces and their members → Clerk user delete + `accounts` row; learners in owned spaces are *not* deleted unless the adult chooses that (second checkbox)
- [ Sign out ] → Clerk sign-out → `console/sign-in`
- [< back] → `console/home` (web) · `profile/settings` (mobile)

## Navigation graph

Enter from: `console/home` [ Account ] · `profile/settings` "Grown-ups" (mobile, via `profiles/pin-entry`) · `console/space-settings` (delete-learner cross-link) · `console/billing` (breadcrumb)
Exit to:    `console/sign-in` · `console/home` · `profile/settings` · `parent/learner-detail` · `console/billing` · `sync/save-progress` (mobile code panel)

## States

- **success**: as above.
- **empty** (no linked learners — teacher-only account, or parent who hasn't linked kids): Backup shows "no learners linked yet" + [ link from the app ] (1-line how-to, no navigation on web); Linked learners block collapses; danger zone shows only [ Delete my account ].
- **no Rescue Code yet** (learner never synced, or feature off): row shows "not created yet — syncs on first upload" instead of [ show code ].
- **error**: any fetch failure → block-level "can't load" + [ TRY AGAIN ]; sign out always works (local).

## Data needs

- reads: Clerk user (email) · consent record (policy version, timestamp — storage TBD, see Open questions) · learners in this account's family spaces + their memberships (space names) · `recovery_hash` presence per learner · local snapshots (for export)
- writes: `POST /recovery/rotate` · `DELETE /learners/:id` · account delete · consent withdraw (= delete path)
- telemetry: `console_account_viewed`, `console_rescue_code_shown{by: caregiver}`, `console_export_file`, `console_learner_deleted{by: caregiver}`, `console_account_deleted`

## Open questions

- Consent record has no column in roadmap §2 (`accounts` / `spaces.settings_json`); needs a home (account-level vs per learner) before S3.
- **Rescue Code default ON** (roadmap §11 Q2) — **deferred**; the "not created yet" row state covers OFF.
- Teacher accounts: should "Linked learners" show class students at all? This wireframe says no (they are the parents' / school's, not the teacher's) — confirm with the consent-mode decision.
- Export scope: all linked learners in one file vs one file per learner (`sync/restore` imports per learner)? Default one per learner, zipped on web.
