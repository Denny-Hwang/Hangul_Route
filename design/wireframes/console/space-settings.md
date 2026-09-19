# Console/Space-settings — join code, consent, members, archive, delete (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §2 (`spaces.join_code`, `settings_json`), §5.3 (deletion), §6, §8 (`/spaces/:id/code`, `DELETE /learners/:id`) · `docs/specs/F-TCH-001-teacher-classroom.md` §3.1 · `docs/blueprints/02-core-feature-spec.md` §6.5
Audience: **teacher / school admin** (class · school spaces) · **parent** (family space: members, delete learner; no consent-mode block)

## Scenario (Given-When-Then)

Given: a space owner (or admin) needs to do a housekeeping task — hand out a fresh code, add a co-teacher / co-parent, hide names, close a class for the semester, or honour a deletion request
When: they open the space's settings
Then: each task is one clearly separated block; destructive actions sit last and always confirm

## Screen goal

"Manage the space's membership and lifecycle without touching any learner progress data."

## Box diagram

```
+------------------------------------------------------------+
| [< back]   Sunday Class A - settings                       |
|                                                            |
|  Join code                                                 |
|   K7M2X9   expires in 18 days                              |   <- 30-day expiry (F-TCH-001 sec 3.1)
|   [ copy ]  [ regenerate ]  (1 line: "old code stops working") |
|                                                            |
|  Consent mode                        (class / school only) |
|   ( ) parent email at join   ( ) school attests            |   <- PLACEHOLDER toggle,
|   "decision pending - locked" (1 line)                     |      disabled until roadmap sec 11 Q1
|                                                            |
|  Privacy                                                   |
|   [ toggle ] Anonymize roster (nicknames / initials)       |   <- settings_json.anonymize_roster
|   1 line: applies to roster, admin views, projection       |
|                                                            |
|  Members                                                   |
|   +------------------------------------------------------+ |
|   | Ms. Park (you)      owner - teacher                  | |
|   | Mr. Lee             teacher            [ remove ]    | |
|   +------------------------------------------------------+ |
|   [ Invite a co-teacher ]  -> shows join code with role    |   (family: "Invite a co-parent")
|                                                            |
|  Learners                                                  |
|   +------------------------------------------------------+ |
|   | Minho     joined Sep 3     [ remove from class ]     | |
|   | Suji      joined Sep 3     [ remove from class ]     | |
|   +------------------------------------------------------+ |
|                                                            |
|  ---- Danger zone ----                                     |
|   [ Archive this class ]   1 line: keeps data, stops joins |
|   [ Delete a learner's data ]  1 line: permanent (GDPR-K / COPPA) |
+------------------------------------------------------------+
```

- No `[[ ]]` primary CTA — this is a settings surface; all actions are secondary and the destructive ones are visually last.
- Family variant: hides Consent mode; "Learners" lists the family's children; "Members" lists caregivers.

## Interaction points

- [ regenerate ] → confirm → `POST /spaces/:id/code`; code + expiry update inline (also reflected on `console/roster`)
- Consent mode radio → **disabled placeholder**; tap shows a 1-line "not yet available" tooltip. Nothing is written.
- Anonymize toggle → `settings_json.anonymize_roster` write; immediate effect on `console/roster` / `console/school-admin`
- [ Invite a co-teacher / co-parent ] → sheet with the space join code + "they sign in and enter this code" (account join, `role: teacher | caregiver`)
- [ remove ] (member) → confirm → membership row deleted (owner cannot remove self)
- [ remove from class ] (learner) → confirm → `memberships` row deleted only; snapshot and other spaces untouched
- [ Archive this class ] → confirm → `archived_at` set; joins refused; roster stays readable
- [ Delete a learner's data ] → picker (which learner) → typed-name confirm → `DELETE /learners/:id` (snapshot + memberships cascade, roadmap §5.3). Available to caregivers in a family space; for a class, only when consent mode resolves to "school attests" (until then the button shows "ask the parent" as a disabled hint).
- [< back] → `console/roster` (class) · `console/school-admin` (school) · `parent/dashboard` (family)

## Navigation graph

Enter from: `console/roster` [ Settings ] · `console/school-admin` (school settings, class row "settings") · `parent/dashboard` [⚙] (family variant)
Exit to:    `console/roster` · `console/school-admin` · `parent/dashboard` · `console/home` (after archive) · `console/account` (delete-learner cross-link "also see backup")

## States

- **success**: blocks as above.
- **empty** (new space, no members / learners yet): Members shows only the owner; Learners block collapses to a 1-line "no one has joined yet — share the code"; danger zone shows Archive only.
- **error**: any write failure → inline on that block ("didn't save" + [ TRY AGAIN ]); the rest of the page stays interactive. Regenerate failure keeps the old code valid and says so.
- **archived**: read-only banner at top; Join code block hidden; [ Archive ] becomes [ Unarchive ].

## Data needs

- reads: `spaces` (name, kind, join_code, join_code_expires_at, settings_json, archived) · `memberships` for the space (accounts with role; learners with joined_at) · learner display names only
- writes: `POST /spaces/:id/code` · `settings_json` patch · membership delete · archive flag · `DELETE /learners/:id`
- telemetry: `console_space_settings_viewed{kind}`, `console_anonymize_toggled`, `console_space_archived`, `console_learner_deleted{by: caregiver|teacher}`

## Open questions

- **School consent mode** (roadmap §11 Q1) — **deferred**. The toggle is a locked placeholder; both outcomes fit this layout.
- Unarchive: roadmap §9 says archive keeps memberships; is unarchive needed in S5 or later? Default: include the button, implement as flag flip.
- Should "remove from class" also revoke the learner's premium tier immediately (roadmap §3.2 says next sync, 7-day offline grace)? The settings copy should not promise "instantly".
- "Members" for a school space also lists teachers of child classes? Default: no — that lives on `console/school-admin`.
