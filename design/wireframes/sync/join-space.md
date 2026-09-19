# Sync/Join-Space — enter a class or family code (wireframe v1)

Spec: `docs/specs/F-TCH-001-teacher-classroom.md` §3.1 (join code, 3-class cap) · `docs/roadmap/multi-persona-sync-platform.md` §2 (spaces) · §6 step 2 — proposal
Audience: **learner** (class student, P-C, typing a code from the board), with a **parent** variant for family codes; a teacher may be helping in the room

## Scenario (Given-When-Then)

Given: a teacher wrote a 6-character code on the board (or a parent received a family invite code)
When: the learner opens "Join a class" from settings and types it
Then: the code validates, they confirm which name the teacher will see, and their profile becomes a member of that space — nothing about their progress moves or resets

## Screen goal

"Type the code from the board and join."

## Box diagram

```
+----------------------------------+
| [<- back]  Join a class          |
|                                  |
|        [hoya - idle]             |
|   "Type the code your teacher    |
|    gave you." (placeholder)      |
|                                  |
|   [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ] |  <- 6 boxes, auto-advance,
|                                  |     uppercase, base32 only
|   [[ JOIN ]]                     |
|   (one-line hint / error)        |
+----------------------------------+

step 2 - confirm name (after the code validates)
+----------------------------------+
|   "<Class name>" found!          |
|   Your teacher will see you as:  |
|   [ current display name  ][edit]|  <- prefilled from profile
|                                  |
|   [ consent branch placeholder ] |  <- see Open questions: may be
|                                  |     nothing, or a parent email
|   [[ THAT'S ME ]]                |     field, depending on mode
+----------------------------------+

done sheet
+----------------------------------+
|   [hoya - cheering]              |
|   "You're in <Class name>."      |
|   [[ BACK TO TODAY ]]            |  -> home/todays-mission
+----------------------------------+
```

- Six boxes, not a text field: matches how the code is read aloud one character at a time. Confusable characters (I, O, 1, 0) are not in the alphabet, so the keyboard can reject them on entry.
- Name confirmation is a single prefilled line, not a form. The only thing collected is what the roster shows.
- The consent-mode block is a reserved slot whose contents depend on a deferred decision (see Open questions); the layout works whether it is empty or holds one email field.

## Interaction points

- Box entry → auto-advance; pasting a 6-char string fills all boxes
- [[ JOIN ]] → `POST /spaces/:id/join` → step 2 on success
- [ edit ] → inline name field (≤ 12 chars, Latin) — edits the roster display name only
- [[ THAT'S ME ]] → membership created → done sheet
- [[ BACK TO TODAY ]] → `home/todays-mission` (inbox sync runs; new plans may appear on card ②)
- [<- back] → `profile/settings`

## Navigation graph

Enter from: `profile/settings` ("Join a class" / "Join a family") · `sync/restore` (class-student re-link path, if adopted)
Exit to:    `home/todays-mission` · `profile/settings` · (teacher side, not learner-visible) `console/relink-approval` when this device re-links an existing roster name

## States

- **success**: code → name confirm → done sheet; the membership is visible on `profile/settings` afterwards.
- **empty** (offline): boxes stay editable, [[ JOIN ]] disabled with one line ("needs internet"); the typed code is kept so the learner can retry when back online.
- **error** (code unknown / expired): inline line under the boxes, boxes keep their values, focus returns to the first box. **3-class cap** (F-TCH-001 §3.1): after validation, a sheet — "you're already in 3 classes" — with [ leave one ] → `profile/settings` memberships list, or [ not now ] → `home/todays-mission`; the join is not attempted. **Teacher free cap reached**: one line, "ask your teacher" — no upgrade pitch on the child's screen.
- **already a member**: skip straight to the done sheet ("you're already in <Class name>").

## Data needs

- reads: active profile (display name, id) · online status · existing membership count for this learner (local cache from the last inbox pull)
- writes: `POST /spaces/:id/join` (learner member, role `student`) · updated memberships in the local sync state · optional parent email (consent branch, if that mode is chosen)
- telemetry: `space.join.attempted` (kind: class | family), `space.join.succeeded`, `space.join.failed` (reason: unknown | expired | cap_learner | cap_teacher)

## Open questions

- **Deferred decision — school consent mode** (roadmap §11 Q1): whether a teacher's school-level attestation suffices, or a parent email is always collected at step 2. This wireframe reserves the slot and does not decide. Legal review item.
- **Deferred decision — teacher free cap** (roadmap §11 Q4: 20 vs 30 students). Only the error copy depends on it.
- Entry-point conflict: F-TCH-001 §3.1 says the learner joins "from their mobile Profile Picker settings", roadmap §6 says "Profile Picker > Join a class", the app map routes it from `profile/settings`. This wireframe follows the map; `profiles/picker` may need a secondary link.
- Family join (co-parent invite via a family `join_code`): the same screen with "family" copy, or an adult-only flow inside `console/account`? A child should probably never type a family code.
- Should a learner be able to leave a class from the child surface, or only via a parent/teacher? (the cap error state above assumes a learner-visible memberships list)
