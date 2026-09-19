# Sync/Save-Progress — the Rescue Code card (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §5.1 (Rescue Code) · §4 (sync) — proposal, not yet an F-spec
Audience: **parent** (reached through learner `profile/settings`, behind `profiles/pin-entry`); the child may be looking over their shoulder, so nothing here should read as alarming

## Scenario (Given-When-Then)

Given: a learner's progress has synced at least once and a parent wants to be sure it survives a lost phone or a deleted app
When: they open "Save my progress" from the grown-ups area of settings
Then: they see one human-readable Rescue Code, are told to write it down, can optionally have it emailed, and can see when the last save happened

## Screen goal

"Give the parent one code that brings the cards back, and get them to write it down."

## Box diagram

```
+----------------------------------+
| [<- back]  Save my progress      |
|                                  |
|        [hoya - small]            |
|   "Write this down. It brings    |  <- guidance addressed to the
|    <name>'s cards back on any    |     parent, not the child
|    device." (placeholder)        |
|                                  |
|   +--------------------------+   |
|   |   WORD-WORD-1234         |   |  <- the code, largest text
|   |   (two words + 4 digits) |   |     on screen; a block,
|   +--------------------------+   |     not a text field
|   [ copy ]   [ share / print ]   |
|                                  |
|   [ ] Also email it to me        |  <- optional; email field
|       [ email field ]  [ send ]  |     only appears when ticked
|                                  |
|   Last saved: <relative time>    |  <- one line, no warning tone
|   [ save now ]                   |
|                                  |
|   [ get a new code ]             |  <- parent-gated destructive
|   (the old code stops working)   |     action, smallest, at bottom
+----------------------------------+
```

- The code is displayed, not typed: a child-readable pair of English words plus four digits (§5.1 format).
- Rotation is deliberately last and small: the old code stops working, and a parent who already wrote one down must understand that.
- "Last saved" is informational. An old timestamp never gets alarm treatment or a "you haven't saved in X days" nudge.

## Interaction points

- [ copy ] → clipboard; toast "copied"
- [ share / print ] → platform share sheet with the code as text (paper is the intended medium)
- [ ] Also email it → reveals the email field; [ send ] → server sends the email; toast "sent"; the email is stored on `console/account` if a family account exists
- [ save now ] → forces a snapshot `PUT /sync/learners/:id`; updates "Last saved"
- [ get a new code ] → `profiles/pin-entry` (re-confirm) → confirm sheet ("the old code will stop working") → `POST /recovery/rotate` → the new code replaces the block
- [<- back] → `profile/settings`

## Navigation graph

Enter from: `profile/settings` ("Save my progress", via `profiles/pin-entry`) · `console/account` (Backup section, web/mobile)
Exit to:    `profile/settings` · `profiles/pin-entry` (rotate re-confirm) · share sheet

## States

- **success**: code block, optional email row, last-saved line.
- **empty** (no code yet — first upload has not happened, or Rescue Code is off): code block replaced by a Hoya line ("save once to get a code") + [[ SAVE NOW ]]; rotate hidden. Offline: "connect to the internet to save" — plain, no alarm.
- **error** (rotate or email request fails): keep the current code visible, one inline line under the failed control, [ try again ]. Never blank the code block on error.
- **loading** (rotating): only the code text shows a placeholder shimmer; the rest of the screen stays.

## Data needs

- reads: active learner id · `lastSyncedAt` + `rev` from the local sync state · whether a Rescue Code exists (local flag; the server stores only `sha256(code)`, so the plaintext must be cached locally at generation time) · family email if a `console/account` is linked · online status
- writes: `POST /recovery/rotate` (new code) · `PUT /sync/learners/:id` (save now) · email send request
- telemetry: `rescue_code.viewed`, `rescue_code.copied | shared | emailed`, `rescue_code.rotated`, `sync.manual_save`

## Open questions

- **Deferred decision**: Rescue Code default ON (auto-generated at first upload) vs parent opt-in (roadmap §11 Q2). The empty state above covers both; the guidance copy differs.
- Roadmap §8 lists `/recovery/rotate` as callable by the learner device; this wireframe gates it behind the parent PIN. Confirm the server also requires something beyond device possession.
- Should the plaintext code be re-showable forever, or hidden after first view (like a recovery key)? Re-showable is friendlier for families; hidden is safer on a device shared with a classroom.
- Teacher path: roadmap §5.1 lets a teacher "Show rescue code" from `console/roster`. Same card, read-only, on the web — a separate wireframe or a variant of this one?
