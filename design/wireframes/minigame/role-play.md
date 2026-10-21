# Minigame/Role Play: a short chat, read and tap your reply (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F6 (`role-play`, new kind, read and tap; S4, S6 and packs; fallback Tap to Respond on the same turns; "A branching chat of 4-6 turns: the learner picks a reply bubble and the partner answers. A less natural reply gets Hoya's amber nudge and a retry. Every branch ends well; there is no bad ending. Text and listening only"), §4.2 (`exc` items), §4.3 (`exc` rungs: "read the line, pick the reply (text only)"), §5.2 (Letters S4: at the library desk), §7.7 ("no bad ending in a story or a Role Play branch", "no speaking UI"), §8 (lecture slide kind: a read-together chat, the class picks the reply), §12.2 (`game.role-play`), row **CM-D2** (this file), built in row **CM-35** · extends `shell.md` (layout B) and `families.md` (Family 3, interaction) · supersedes, for this app, the voice reply of `docs/blueprints/06-mini-game-catalog.md` game 9 (there is no microphone and no spoken answer) · audio states: `audio-fallback.md` W9 (Tap & Respond) and W11
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/role-play.html`, `mock/states.html` board R; shots at 320 and 768)
Code (planned, CM-35): renderer `apps/mobile/src/screens/minigames/RolePlayGame.tsx`; pure rules `apps/mobile/src/logic/role-play/` (branch reducer, path length, scoring, `rolePlayToTapRespond`); round schema `RolePlaySceneSchema` in `packages/content-schema` with the refinements below
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization (`KoreanText`), `<partner>` / `<me>` chat bubbles, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 4 or 6 quest step or a pack level step with a `role-play` scene (at the library desk, ordering at a snack stall, asking the way)
When: the partner's line appears and is said, and the learner reads two or three reply bubbles and taps the one that fits
Then: a natural reply is sent and the partner answers, sometimes along a different branch; a less natural reply is not sent: Hoya explains in one amber line why another reply fits better and the learner tries again; every branch ends with a friendly closing line and an end card, never a bad ending

## Screen goal

"Read what they say, and tap a reply that fits."

## Round shape

- **A scene** is one step: a title ("At the library desk" `~~ 도서관 ~~`), a partner named by role, never by a personal name (`~~ 사서 ~~ (saseo) · (librarian)`; the cast names Hoya and the shipped companions are the only names), and 4 to 6 learner turns.
- **A turn**: the partner's line (Korean, romanization, meaning in the UI language, [ Hear it ]), then 2 or 3 reply bubbles (Korean and romanization). Reply meanings are hidden: the produce-like `exc` rung reads the reply in Korean (§4.3). [ Show meanings ] reveals the meanings for this turn and records the turn as hinted (no penalty line).
- **Replies are `natural` or `lessNatural`.** A natural reply moves to its next node; two natural replies may lead to different branches. A less natural reply has an authored `why` line (content, with es and ko overlays) and is never sent. A `why` line that quotes Korean draws it as taught Korean with its romanization (`~~ 안녕히 계세요 ~~ (annyeonghi gyeseyo)`), never as bare Hangul inside the sentence.
- **Every turn has at least one less natural reply** (refinement `role-play-turn-options`, CM-35). It gives the turn something to nudge and gives the fallback a wrong option on every turn, including a turn with two natural replies.
- **Every branch ends well** (refinement `role-play-good-endings`, CM-35): every leaf node is an `end` with a friendly closing line; there is no node a learner can reach that ends badly, no failure node, no "the partner leaves". **Every branch has the same number of learner turns** (refinement `role-play-even-branches`), so the progress bar is honest whichever way the chat goes.
- **Scoring** per learner turn: the turn's first tap scores (a natural reply is right, a less natural one is a miss); the retry is a retry. Stars follow the shell.
- **No Skip** (an interaction game, as Tap & Respond); the quest player's leave control is the way out.
- **No speaking UI**: no microphone glyph, no "say it", no record button; the learner's turn is a tap. The partner's line is heard; the learner's chosen reply is said by the device voice as the reply is sent (Tap & Respond's `afterReply`), so the learner hears the reply they read, and is never asked to say it.

Example scene (fixture words, CM-35 and the S4 Letters rows author the real ones; romanization from the repo converter):

| Turn | Partner | Natural replies -> next | Less natural reply and Hoya's `why` |
|---|---|---|---|
| 1 | 안녕하세요! (annyeonghaseyo) · Hello! | 안녕하세요! (annyeonghaseyo) -> 2 | 잘 먹겠습니다! (jal meokgetseumnida): "That one is for the start of a meal. Try a greeting." |
| 2 | 무슨 책을 찾아요? (museun chaegeul chajayo) · What book are you looking for? | 동화책을 찾아요. (donghwachaegeul chajayo) -> 3a · 한글 책을 찾아요. (hangeul chaegeul chajayo) -> 3b | 괜찮아요. (gwaenchanayo): "They asked which book. Tell them the book you want." |
| 3a / 3b | 여기 있어요. (yeogi isseoyo) · Here it is. (each branch names its own shelf in its meaning) | 감사합니다! (gamsahamnida) -> 4 | 미안합니다. (mianhamnida): "Here a thank-you fits better." |
| 4 | 또 오세요! (tto oseyo) · Come again! | 안녕히 계세요! (annyeonghi gyeseyo) -> end | 안녕히 가세요! (annyeonghi gaseyo): "You are the one leaving, so 안녕히 계세요 (annyeonghi gyeseyo) fits: it is said to the one who stays." |
| end | (Hoya cheering) "You found your book!" | | |

## Box diagram

Compact (320 x 568, layout B: the chat log scrolls, the reply area is pinned to the bottom):

```
+--------------------------------+
| [=====-----]          (2 / 4)  |  <- shell top row: learner turns of the path
|  ~~ 도서관 ~~ (doseogwan)       |  <- scene title (taught Korean) and its meaning
|  (At the library)              |
|+------------------------------+|
|| <partner> ~~ 사서 ~~ (saseo)  ||  <- chat log (scrolls; newest at the bottom)
||  ~~ 안녕하세요! ~~             ||     partner bubbles: left, with the role caption
||  (annyeonghaseyo) (Hello!)    ||
||                   <me>        ||     my bubbles: right, Korean + romanization
||       ~~ 안녕하세요! ~~        ||
||  <partner>                    ||
||  ~~ 무슨 책을 찾아요? ~~        ||
||  (museun chaegeul chajayo)    ||
||  (What book are you looking   ||
||   for?)   [ (speaker) Hear it ]||
|+------------------------------+|
|  (Tap a reply)  [Show meanings]|  <- pinned reply area: instruction + help
|  +--------------------------+  |
|  | ~~ 동화책을 찾아요. ~~      |  |  <- reply bubbles, full width, at least
|  | (donghwachaegeul chajayo)|  |     touchTarget.child tall each
|  +--------------------------+  |
|  +--------------------------+  |
|  | ~~ 한글 책을 찾아요. ~~     |  |
|  | (hangeul chaegeul chajayo)| |
|  +--------------------------+  |
+--------------------------------+
```

Less natural reply (the turn stays; nothing is sent):

```
|+------------------------------+|
|| ...partner line, unchanged... ||
|+------------------------------+|
|  +--------------------------+  |
|  | (Hoya thinking)          |  |  <- Hoya's amber bubble takes the top of the reply area
|  | (You are the one leaving,|  |     the why line (content); the tapped reply stays in view
|  |  so 안녕히 계세요 fits.)  |  |     with the nudge look and the mark glyph, locked
|  +--------------------------+  |
|  [ ~~ 안녕히 가세요! ~~  (mark)]  |  <- locked, nudge look
|  [ ~~ 안녕히 계세요! ~~        ]  |  <- still open: the retry
```

End card (the last partner line, then):

```
+--------------------------------+
|  (chat log, scrolled to the end)|
| +----------------------------+ |
| |  (Hoya cheering)           | |
| |  (You found your book!)    | |  <- the scene's closing line (content); never a score
| |  [[ Continue ]]            | |  <- ends the step
| +----------------------------+ |
+--------------------------------+
```

Regular (768 x 1024): the chat log and the reply area in the reading column; the reply area pinned under the log at the column's width; bubbles up to 80 % of the column. From window class 700 in landscape, the log and the reply area may sit side by side (the reader's two-column rule), with the reply area on the right.

## Interaction points

- **Turn opens**: the partner's bubble appears (a short rise of `motion.duration.base`; none with reduced motion) and its line is said once (Tap & Respond rule: not when sound is switched off; then [ Hear it ] asks). The reply bubbles appear with it.
- **A natural reply**: it moves into the log as my bubble, it is said in full (at least 900 ms, at most 6 s, as `afterReply`), then the next partner line opens. `answerRound(turnKey, firstAnswer)`.
- **A less natural reply**: the bubble takes the nudge look with the mark glyph and is locked; Hoya (`thinking`, amber) shows the reply's `why` line at the top of the reply area; nothing is sent and the partner does not react; the learner taps another reply. Second miss in one turn: the natural reply (the first natural one, when there are two) gets the look-here ring.
- **[ Hear it ]** on any partner bubble in the log: replays that line; unlimited. While a reply is being said, Hear it does nothing (the reply is not cut off).
- **[ Show meanings ]**: the meanings of this turn's replies appear under their romanization; the button becomes "Meanings shown" for this turn.
- **Continue** on the end card: `markStepComplete()` + `onFinish()`.

## Fallback round when `game.role-play` is off

**Tap to Respond on the same turns**, derived by `rolePlayToTapRespond(scene)`: the scene's main path (at each turn the first natural reply, and its next node) as a list of Tap & Respond turns; each turn's natural reply is the right answer and its less natural replies are the other options (a turn with two natural replies keeps the first; the second is left out, so every option left has one right answer; `role-play-turn-options` guarantees each turn has at least one other option, so no fallback turn is a single button). The Tap & Respond screen shows the partner line as "Someone says" with its meaning and the replies with their meanings (its shipped look); its miss line is "Hmm, that doesn't fit. Try another!". Branches other than the main path are not played. Same scoring per turn.

## No device voice

- The partner line is printed with its romanization and meaning, so the chat is fully readable. The status panel follows the Tap & Respond rule of `audio-fallback.md` W9: it appears under the newest partner bubble after the turn's first attempt to play (or after a tap on Hear it when sound is off): "No Korean voice on this device." [ How to add a voice ], "Sound is off." [ Turn sound on ], "The sound did not play." [ Try again ]. When there is no voice, "No Korean voice" is shown once for the scene, not on every turn. Source `role-play`.
- A sent reply that cannot be said still waits the minimum 900 ms before the next turn, so the chat keeps a readable pace.
- Neutral, a polite live region; the chat scores as usual.

## Navigation graph

Enter from: `quest/player` (S4 Practice and Apply per the §7.1 Stage 4 table, S6, pack level 3) via `minigame/shell`; the lecture Role Play slide (§8, CM-35 and CM-63)
Exit to: `quest/player` (Continue on the end card) · the quest player's leave sheet

## States

- **partner speaking** (reply bubbles shown, the line playing), **awaiting a reply**, **nudge** (less natural, locked bubble, Hoya), **second miss ring**, **reply sending** (the reply said), **end card**.
- **empty / bad data**: a scene that fails `role-play-good-endings` or `role-play-even-branches` never builds; a scope that resolves to no scene shows the shell's empty state with [ Back to quest ].
- **long chat at 320 or 200 % text**: the log scrolls; the newest partner bubble is scrolled into view above the reply area when a turn opens; the reply area grows up to half the window and then scrolls itself, so the newest line and at least one reply are always visible.
- **reduced motion**: no bubble rise; the log jumps to the newest line.
- **no Korean voice / sound off**: as above.

## Accessibility

- The log is a list; each bubble is an item named "Librarian says: 무슨 책을 찾아요, museun chaegeul chajayo. What book are you looking for?" or "You said: 안녕하세요, annyeonghaseyo" (`a11y.minigame.rolePlay.partner` / `.me`). A new partner bubble is announced (polite live region on the log's last item).
- Reply bubbles are buttons named by the Korean and romanization (and the meaning once shown). After a less natural tap, its name adds "not this one" (`a11y.minigame.option.wrong`) and focus moves to the first open reply.
- The end card takes focus when it opens.
- No colour-only state: my bubbles sit on the right with "You said" in their name; the nudge has a mark glyph.

## Tokens and targets

- Reply bubbles: min height `touchTarget.child` (80), full width at 320 (48 dp floor met), `radii.xl`, `borderWidth.base`, `surface.paper`, `border.subtle`. Partner bubbles (not tappable except Hear it, a `touchTarget.min` button): `surface.sunken`, `radii.xl`. My bubbles: `brand.secondaryLight`, `brand.secondaryDark` text accents. Hoya bubble: `feedback.nudgeLight` with `feedback.nudge` border and the `thinking` pose; end card: `feedback.successLight` with the `cheering` pose.
- Korean `bodyLg` bold; romanization and meaning `bodySm` `text.secondary`. No literal values.

## Data needs

- reads: the `role-play` scene: `{ id, titleKo: KoText, partnerRoleKo: KoText, nodes: { [nodeId]: { line: KoText, replies: [{ text: KoText, kind: 'natural' | 'lessNatural', next?: nodeId, whyKey? }][2..3] } | { end: true, closingKey } }, start: nodeId }` (CM-35); refinements: every path from `start` ends at an `end` node, every path has the same learner-turn count (4 to 6), each turn has at least one natural and at least one less natural reply, every less natural reply has a `why`, no cycles.
- logic: branch reducer, path length, scoring and `rolePlayToTapRespond` (pure, 100 %); the "every branch ends well" property test walks every path.
- writes: `answerRound(turnKey, correct)` per learner turn (first tap); memory items: each turn's `exc` item (line and natural reply) at the read rung, and the `lex` items inside it (credit inside sentences).
- telemetry: `minigame.finished { kind: 'role-play' | 'tap-respond', ... }`; `audio.fallback_shown { source: 'role-play', reason }`. The branch taken is not sent.

## Draft strings (CM-35 adds them with their es and ko values)

Reused: `learner.minigame.tapRespond.*` (the fallback), `progress.pill`, `audio.*`, `a11y.minigame.option.*`, `a11y.minigame.hear`. The partner lines, replies, `why` lines and closing lines are content (lesson JSON with es and ko overlays, MAR culture and language pass).

| Key (proposed) | en draft |
|---|---|
| `rolePlay.tapReply` | Tap a reply |
| `rolePlay.showMeanings` | Show meanings |
| `rolePlay.meaningsShown` | Meanings shown |
| `rolePlay.lookHere` | This one fits here. |
| `rolePlay.continue` | Continue |
| `a11y.minigame.rolePlay.partner(role, line, romanization, meaning)` | {role} says: {line}, {romanization}. {meaning} |
| `a11y.minigame.rolePlay.me(line, romanization)` | You said: {line}, {romanization} |
| `a11y.minigame.rolePlay.log` | Chat |

## Open questions

1. **Learner role name.** The learner is "you" (no name on their bubbles). A profile name is never shown in a chat (screenshots and the projector, §8).
2. **Three natural replies.** Allowed by the schema, but the branch count grows fast; CM-35 caps a scene at 4 leaf nodes so the MAR can read every path.
