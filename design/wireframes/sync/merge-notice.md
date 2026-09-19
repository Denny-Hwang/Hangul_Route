# Sync/Merge-Notice — "we found your old cards" sheet (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §5.2 (restore merge) · §4 (merge rules) — proposal
Audience: **learner** (with a parent usually present, since restore is parent-driven); copy must be readable by a 5-year-old

## Scenario (Given-When-Then)

Given: a restore (code, account, or file) found a saved snapshot, and this device already has some local progress for the same learner
When: the snapshot arrives
Then: a short bottom sheet says the old cards were found and are being added, with one button — nothing is ever replaced or lost

## Screen goal

"Reassure that both sets of progress are kept, then continue."

## Box diagram

```
(underlying screen dimmed: profiles/picker or sync/restore)
+----------------------------------+
|                                  |
|                                  |
|                                  |
|  +----------------------------+  |
|  |  ----  (grab handle)       |  |  <- bottom sheet
|  |                            |  |
|  |     [hoya - cheering]      |  |
|  |                            |  |
|  |  "We found your old cards! |  |  <- one line, placeholder
|  |   Adding them to your      |  |
|  |   collection."             |  |
|  |                            |  |
|  |  [card][card][card] +N     |  |  <- preview strip of cards
|  |                            |  |     being added (optional)
|  |  [[ GREAT ]]               |  |  <- single CTA
|  +----------------------------+  |
+----------------------------------+
```

- One sentence, one button. There is no "keep this device" / "keep the cloud" choice because the merge is a union (§4): stars max, cards union, sessions union, streak recomputed. The child cannot make a wrong choice here.
- The preview strip shows only cards *gained* by the merge; if the union adds nothing new, the sheet still appears but the strip is omitted (copy becomes "everything's already here").
- No numbers other than the card count; no "you had X on the other device" comparison.

## Interaction points

- [[ GREAT ]] → sheet dismisses → `profiles/picker` with the merged learner selected (or `home/todays-mission` if the learner is already active)
- Swipe down / tap outside → same as the CTA; the merge already happened, dismissing never cancels it
- Card thumbnail tap → no-op (keeps the sheet to one action)

## Navigation graph

Enter from: `sync/restore` (any path, when local progress exists) · background sync conflict resolve on `home/todays-mission` (a second device wrote first — same sheet, same copy)
Exit to:    `profiles/picker` · `home/todays-mission`

## States

- **success**: sheet with cheering Hoya, one line, optional preview strip, CTA.
- **empty** (merge adds nothing — the device already had everything): sheet with "everything's already here", no strip, same CTA. The no-local-progress case skips the sheet entirely: `sync/restore` goes straight to `profiles/picker`.
- **error** (merge fails schema validation, e.g. an older `schemaVersion` the client cannot upgrade): the sheet is not shown; `sync/restore` shows its file/code error instead and local progress is left untouched. The merge is atomic — a failed merge writes nothing.
- **reduced motion**: sheet slides in without the Hoya pose transition; the preview strip appears static.

## Data needs

- reads: local `ProgressSnapshot` for the learner · incoming server/file snapshot · the diff computed by `logic/sync/merge` (cards gained, quests upgraded)
- writes: merged snapshot to the local store · `PUT /sync/learners/:id` with the merged result (when online) so the server also holds the union
- telemetry: `sync.merge.shown` (cardsGained, questsGained, source: restore | conflict), `sync.merge.dismissed`

## Open questions

- Show the preview strip at all, or keep the sheet to text only? A strip makes the reassurance concrete but adds asset loading to a moment that should be instant. (beta)
- When the conflict path triggers mid-session (two devices), should the sheet wait until the learner is back on home rather than appearing over a quest? Recommend: defer to the next home render, same rule as the PWA update banner.
- Roadmap §5.2 copy is the placeholder here; re-author to Pre-A1 vocabulary in the design pass ("old cards" may confuse a 5-year-old who never had "old" cards).
