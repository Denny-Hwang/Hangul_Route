# Sync/Join-Space — enter a class or family code (wireframe v1)

Spec: `docs/specs/F-SPACE-001-spaces-memberships-join-code.md` §3.5 (shipped 2026-09-21; code `apps/mobile/src/screens/sync/JoinSpaceScreen.tsx`) · F-TCH-001 §3.1 (origin) · `docs/roadmap/multi-persona-sync-platform.md` §2, §6 step 2
Code (F-TCH-001 §10.1, 2026-09-21): step 2 gains "I was already in this class" when the lookup returns roster names (initials when the class anonymizes) → pick → waiting card ("Waiting for your teacher to say yes", ~10 minutes, Never mind) → approved: merge notice → Back to today; denied / expired: one calm line. The temporary profile made on the new device stays (app map §7 #25).
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

- Six boxes, not a text field: matches how the code is read aloud one character at a time. Confusable characters (I, O, 1, 0) are not in the alphabet, so the keyboard can reject them on entry. **Shipped as one wide field with box-like letter spacing** (single focus target; web + native); the keystroke filter drops non-alphabet characters.
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

- ~~**Deferred decision — school consent mode**~~ → decided (c) per space; **S3 collects nothing at step 2** (`consentMode` stored only; email capture is F-SPACE-002, app map §7 #22).
- ~~**Deferred decision — teacher free cap**~~ → 20 (owner, 2026-09-20); shipped as `cap_class` → "This class is full. Ask your teacher."
- ~~Entry-point conflict~~ → resolved: `profile/settings` "Classes & family" card → **Join a class**, no PIN (app map §7 #21). `profiles/picker` link not added.
- Family join (co-parent invite via a family `join_code`): the same screen with "family" copy, or an adult-only flow inside `console/account`? A child should probably never type a family code.
- ~~Should a learner be able to leave a class from the child surface?~~ → shipped: **Leave** on the settings card behind a confirm dialog (cards and stars stay; rejoin with the code). Teachers can also remove a student (`DELETE /spaces/:id/members`).
