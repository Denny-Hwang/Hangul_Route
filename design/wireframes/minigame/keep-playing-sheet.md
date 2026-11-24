# Minigame/Keep-playing sheet — a back on a game with an answer asks first (wireframe v2)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` §3.1 (row LR-1; work order WO-06), revision 2 · amends the leave note of `minigame/shell.md` ("No back / close control inside a game": the route's header Close stays, and now asks once the game has an answer) · the sheet is the shipped `ConfirmSheet` (`design/components/ConfirmSheet/spec.md`)
Audience: **learner, any age** (P4 / P5 / P6); in the guest's first quest too. Not the All lessons preview (a grown-up browsing), not a story-read step (owner decision 2026-11-23, OD-LR4).
Route: `Minigame` (learner stack and guest stack)
Mock: none needed (the shipped ConfirmSheet with new words, spec §5)

## Scenario (Given-When-Then)

Given: a learner in a game who has answered at least one round (right or not)
When: they tap the header's Close, press the Android back, or the browser goes back
Then: the game stays where it is and a sheet asks "Keep playing?"; Keep playing comes first. With no answer yet, the same backs leave at once, as today.

## Screen goal

"Do not lose the game by accident." (secondary: leave on purpose)

## Box diagram

Panel A — the game with one answer, the sheet open (phone, bottom sheet)

```
+--------------------------------+
| [x]                            |  <- route header Close (asks now)
|  [=====------]       [2 / 5]   |  <- the game as it was: round 2,
|  Prompt heading                |     dimmed under the sheet; its sound stopped
|  ( PROMPT AREA )               |
|  [ tile ] [ tile ] [ tile ]    |
|................................|  <- backdrop: a tap = Keep playing
|+------------------------------+|
|| Keep playing?        (title) ||  <- learner.minigame.leave.title
|| If you leave, the game       ||  <- learner.minigame.leave.message
||  starts again next time.     ||
||                              ||
|| [[      KEEP PLAYING      ]] ||  <- cancel: first (safe choice)
|| [          LEAVE           ] ||  <- confirm: plain tone, never danger
|+------------------------------+|
+--------------------------------+
```

Panel B — wide (regular width): the same sheet as a centred dialog over the game (ConfirmSheet's own rule); same order.

Panel C — no answer yet: no sheet. Close, Android back, browser back and the iOS edge swipe all leave to the quest's launcher at once (as today).

Panel D — end card (the last round answered, the game not closed yet): a back shows Panel A. Keep playing returns to the end card, whose button completes the step; Leave does not complete it.

## Interaction points

- [[ KEEP PLAYING ]], the backdrop, Escape on the web, **any back while the sheet is open** (the Android back, a browser back) → the sheet closes; never a second sheet. The game is unchanged (same round, same answers, same hint); its sound does not restart (the speaker plays it).
- [ LEAVE ] → `quest/player` on the same step's launcher (not advanced). Rounds already answered stay scored on the first try; the game opens at round 1 next time. No `minigame.finished`.
- iOS edge swipe with an answer → turned off (a native swipe cannot be asked about); Close is the way out.
- VoiceOver escape gesture (two-finger Z) → checked on a device (spec §3.9).
- The game's own end (last round, Skip, a game's Back to quest on an empty game) → leaves with no sheet. A game timer that fires under the sheet and ends the game → the step completes and the screen leaves.
- Story Check's recap: a back ends the step (its own rule); no sheet, whatever mounted first.

## Navigation graph

Enter from: `minigame/shell` (any game, after its first answer)
Exit to: `minigame/shell` (Keep playing) · `quest/player` launcher (Leave)

## States

- **success**: Panel A → Keep playing or Leave.
- **empty** (no answer yet): Panel C, no sheet. Work before the first answer (a drawing not yet scored, cards arranged, tiles moved, a frame being written, text not yet submitted) is lost on a back, as today (spec §4).
- **end card**: Panel D.
- **error**: none of its own; a game that cannot load shows its existing Back to quest page, which leaves with no sheet.
- **story-read step**: no sheet (its bookmark keeps the scene).
- **200 % text at 320 x 568**: the sheet scrolls inside itself; both buttons stay at least `touchTarget.min` high (ConfirmSheet's rule).
- **screen reader**: on the web the Keep playing button takes focus; on iOS and Android focus moves into the sheet (a modal) and reads title, message, Keep playing, Leave; nothing behind it can be reached; Leave is never first.

## Data needs

- `quest-run-store.answersGiven` (new, never saved or sent), read when the step's game mounts and compared after.
- Strings: `learner.minigame.leave.title`, `.message` (new); `learner.quest.leave.keep.cta`, `.confirm.cta` (reused).
- Nothing is written by the sheet.

## Open questions

- None blocking (OD-LR2, OD-LR3, OD-LR4 decided by the owner 2026-11-23).
- Until WO-37 row NB-4, the quest's own Leave this quest? is the system Alert on native, so the two questions look different there; native focus on the cancel is a design-system follow-up.
