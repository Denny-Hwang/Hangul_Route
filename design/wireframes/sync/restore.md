# Sync/Restore — bring progress back (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §5 (four restore cases) · §5.2 (merge) — proposal
Audience: **parent** (or an older P-A learner who kept their own Rescue Code); reached before any profile exists or from settings

## Scenario (Given-When-Then)

Given: a family reinstalled the app or moved to a new device and already has progress somewhere (a Rescue Code on paper, an adult account, or an exported file)
When: they tap "I already have progress" on welcome, or "Restore" in settings
Then: they pick whichever of the three paths they have, and the learner's cards come back — merged with anything already on this device, never overwritten

## Screen goal

"Choose one way in, and get the old cards back."

## Box diagram

```
+----------------------------------+
| [<- back]  Bring back progress   |
|                                  |
|        [hoya - thinking]         |
|   "Got a code, a grown-up        |
|    account, or a file?"          |  <- one line placeholder
|                                  |
|   +--------------------------+   |
|   | [[ I HAVE A RESCUE CODE ]]|  |  <- primary: most common for
|   +--------------------------+   |     P-A and class students
|   +--------------------------+   |
|   | [ Sign in as a grown-up ] |  |  -> console/sign-in
|   +--------------------------+   |
|   +--------------------------+   |
|   | [ Open a saved file ]     |  |  -> file picker
|   +--------------------------+   |
|                                  |
|   [ start fresh instead ]        |  -> profiles/picker or
+----------------------------------+     onboarding/welcome

Rescue Code path (inline expand under the primary button):
+----------------------------------+
|   [ WORD ]-[ WORD ]-[ 1 2 3 4 ]  |  <- three fields, auto-advance
|   [[ FIND MY CARDS ]]            |
|   (one-line hint / error)        |
+----------------------------------+
```

- Three paths, one screen, one tap each. No path is hidden behind a second screen because a parent on a new phone is usually in a hurry.
- Code entry has three fields to match how the code is written on paper (word, word, number); the keyboard switches to numeric for the last field.
- No path asks for the child's name or age: identity comes from the code / account / file, so no new PII is collected here.

## Interaction points

- [[ I HAVE A RESCUE CODE ]] → expands the inline fields; [[ FIND MY CARDS ]] → `POST /recovery/claim` → pull snapshot → `sync/merge-notice` if local progress exists, else `profiles/picker` with the restored learner selected
- [ Sign in as a grown-up ] → `console/sign-in` → on success, the learners in the family space are listed → pick one → pull snapshot → same merge/picker branch
- [ Open a saved file ] → OS file picker (`.hangulroute.json`) → validate → same merge/picker branch; works fully offline
- [ start fresh instead ] → `onboarding/welcome` (if no profiles) or `profiles/picker`
- [<- back] → wherever we came from (`onboarding/welcome` or `profile/settings`)

## Navigation graph

Enter from: `onboarding/welcome` ("I already have progress") · `profile/settings` (grown-ups area, via `profiles/pin-entry`)
Exit to:    `profiles/picker` · `sync/merge-notice` · `console/sign-in` · `onboarding/welcome`

## States

- **success**: any path resolves to a learner + snapshot → picker (or merge notice first).
- **empty** (device offline): code and sign-in paths show one inline line ("needs internet") and are disabled; the file path stays fully available and is moved to the top for this state.
- **error** (code not found / wrong): inline under the fields, "check the code and try again", fields keep their values; after repeated failures (server rate limit) the hint changes to "wait a few minutes" — no lockout copy aimed at the child. File invalid / older schema: "this file can't be read" + [ choose another ]. Sign-in with no learners in any space: "no saved progress on this account" + back to the three paths.
- **loading**: the tapped button shows an inline spinner; the other paths stay visible but inert.

## Data needs

- reads: local profile count (decides the "start fresh" destination) · online status · Clerk session (if any) · file contents (schema-validated `ProgressSnapshot` export)
- writes: `POST /recovery/claim` (code) · `GET /sync/learners/:id/snapshot` (code or account path) · local profile + snapshot creation via the merge rules in `logic/sync/merge`
- telemetry: `restore.opened` (source), `restore.path_chosen` (code | account | file), `restore.succeeded | failed` (reason)

## Open questions

- ~~Class students fourth path~~ **Resolved 2026-09-19**: restore keeps three paths; the class re-link path ("I was already in this class" → roster name → `console/relink-approval`) lives in `sync/join-space` (10-app-map §7 #14).
- When an account has several learners, is the picker a fourth panel here, or a re-use of `profiles/picker` with a "restore" header?
- File path on iOS Safari (PWA) uses the Files app; confirm the export format (`.hangulroute.json`) is recognised so it appears at all.
- Rate-limit UX (5/hour/IP per roadmap §5.1): show remaining attempts or not? Leaning no — it reads as a threat to a child.
