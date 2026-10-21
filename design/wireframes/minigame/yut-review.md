# Minigame/Yut Review: a review session on a yut board, play only (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F10 (Yut Review, a review skin; any stage; fallback the plain review screen; "Right answers throw the yut sticks on a board. The randomness is play only; it never decides a reward"), §4.5 (review sessions: never a percentage, an "n of m" score or a per-question timer), §5.6 (Play S2: traditional games, Yut Review), §7.5 (fairness: no random rewards), §7.7, §8 (lecture: a Yut board slide and the `yut-race` game; designed with CM-63), §12.2 (`game.yut-review`), row **CM-D2** (this file), built in row **CM-39** (after CM-14, the Daily Review screen) · a skin over the review screen of row CM-D1 / CM-14 (`design/wireframes/reviews/`; today's shape is `daily-test.md` and `hangul-check.md`), whose items are rounds of `shell.md`
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/yut-review.html`, `mock/states.html` board B; shots at 320 and 768)
Code (planned, CM-39): skin `apps/mobile/src/screens/reviews/YutBoardSkin.tsx` around the review screen's item area; pure rules `apps/mobile/src/logic/review/yut-board.ts` (board graph, seeded throw, piece walk, laps); board art as layout boxes and one registry prop for the sticks (`prop:yut-sticks`)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization (`KoreanText`), `(o)` a station of the board, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a review session (a Daily Review, a Keep going, a Cell Check, or the review step of a Play S2 quest) with the yut look chosen or set by the content
When: the learner answers each review item as on the plain review screen
Then: each item they finish throws the four yut sticks, the throw is named in Korean, and their piece walks that many stations around the board; the board is play only: stars, points and everything else the session gives come from the answers exactly as on the plain screen, and the end of the session is the same whatever the sticks did

## Screen goal

"Answer each item; watch the sticks move your piece."

## The game it draws on (sourced)

Facts already shipped and reviewed in `content/stories/seollal-new-year.json` (facts f7, f8; Korea Heritage Service portal, the Encyclopedia of Korean Culture, the National Institute of Korean Language's Standard Korean Language Dictionary), plus the board's shape from the Encyclopedia of Korean Culture article on 윷놀이 (Academy of Korean Studies, `https://encykorea.aks.ac.kr/Article/E0042794`, accessed 2026-10-21: "윷판은 29개의 동그라미로 되어 있다"; each side has four pieces):

- Four wooden yut sticks are thrown, and how they land moves a piece on the board (f7).
- The five throws: 도 `do` 1 station, 개 `gae` 2, 걸 `geol` 3, 윷 `yut` 4, 모 `mo` 5; 윷 and 모 give another throw (f8).
- The board, 윷판 `yutpan`, has 29 stations (the article above). The drawing places 20 on the edge (6 to a side, corners shared) and 9 on the two crossing lines (the centre shared), 29 in all; the article gives the total and describes routes through the centre (방), so the MAR culture pass checks the drawing against the board figure of the article.
- Pieces start from the entrance and leave by the exit, 참먹이 (the article: "말 네 개가 모두 입구(入口)인 도에서 출발하여 참먹이［出口］를 먼저 빠져나가는 편이 이긴다"); the skin uses one piece at a time and four in all, and has no winner, because there is no other side.

What the skin leaves out on purpose, so it stays a calm solo board and every claim stays inside the sources: no other team or player (no comparison between learners), no capturing, no backward move, no inner routes (the piece walks the outer ring of 20 stations), and no claim about which way up each stick counts (the sources checked for the story do not say, so the art never shows a "which side is up" rule). The MAR culture pass checks the board drawing and the five names against the sources above. CM-39 cites them in its content note.

## Round shape (what changes from the plain review screen)

- **The items are the review session's items**, unchanged: the same engine (CM-13), the same selection, formats, scoring, stars and "N got stronger" (§4.5). The skin adds a board band and a throw after each item.
- **Every item throws when it ends, whatever its result**: right first try, right after a retry, or ended by the review screen's own miss rule (a reveal and move on, row CM-D1). The throw is taken when the item ends and does not read how it ended, so the rule holds whatever CM-D1 decides, and the board never shows which items were missed. A first-try miss is scored exactly as on the plain screen; the board does not know about it.
- **The throw is seeded** by the session seed and the item index (deterministic for tests), with the weights in a named constant in `logic/review/yut-board.ts`. It moves the piece only.
- **Laps.** The piece starts at the start station, walks the 20 outer stations, and on reaching home a small piece token is placed in the "home" tray and a new piece starts. The tray holds up to 4 pieces (each side has four). **A fifth lap** (a long Stage Check, or Keep going): when a fifth piece reaches home, the tray clears and holds that piece alone, with no message and no sound beyond the usual "A piece went home!" (and the same for the ninth, and so on); nothing marks a full tray as finished, so it is never a goal or a count to beat. The tray empties at the end of the session.
- **The tray draws only the pieces that are home**, one filled piece each, with no empty slots, so it never reads as "n of 4". An empty tray shows its "Home" label alone.
- **Never a reward from the board** (§7.1, §7.5): the board gives no stars, points, stamps, cards, unlocks or extra items; laps and position are not saved, not synced and not sent; the result screen is the plain review result (no board, no lap count). A session with a lucky throw ends exactly like one without.
- **No timer, no count**: the item row uses fill-only dots (no "n of m"), and the board shows stations, not a score.

## Box diagram

Compact (320 x 568, layout C of the shell):

```
+--------------------------------+
| [x]  o o o * . . . . . .       |  <- review header: Stop, fill-only item dots
| +-----------+  ~~ 개 ~~ (gae)   |  <- board band: the board (left, 128) and the last throw
| | (o)(o)(o) |  (two stations)  |     (right): its Korean name, romanization, how far
| | (o) \ /(o)|  [sticks art]    |     the piece went, the sticks as they fell (art)
| | (o) (+) (o)|  (home: [p])    |  <- home tray: only the pieces that went round (no empty slots)
| | (o) / \(o)|                  |
| | (o)(o)(P) |                  |  <- P: the learner's piece
| +-----------+                  |
|                                |
|  (review item: the shell round |  <- the plain review screen's item area, unchanged:
|   of its format: Listen & Pick,|     prompt and options (layout A)
|   Cloze Pick, Read Pick ...)   |
|  [ option ] [ option ]         |
|  [ option ] [ option ]         |
+--------------------------------+
```

The board band is 128 + `spacing.md` padding tall on a phone from 600 tall (the board drawing at 128 x 128 is media; its stations are not tap targets). The item area keeps every target at `touchTarget.min` or more. **Below 600 tall** (a 320 x 568 phone, a landscape phone) the drawing shrinks to `touchTarget.hero` (96), the throw name, its romanization and how far it went sit on one line beside it, and the sticks art is left out (the name says the throw), so the review item keeps its room; this is the state in `shots/yut-review-320.png`.

Regular (768 x 1024): two panes (`layout.pane.gap`): the board on the left at up to 320 x 320 with the throw under it; the review item on the right in its reading width. Wide: the same with the board at up to 400.

Throw (after a finished item; then the next item opens):

```
| +-----------+  ~~ 걸 ~~ (geol)  |
| |  ...  (P)->(o)->(o)->(P)     |  <- the piece walks station by station
| |           |  (three stations)|     (motion.duration.fast per station; with reduced
| +-----------+  [sticks]        |      motion it is placed at once)
```

- 윷 or 모: "(throw again)" under the name, and a second throw follows by itself after `motion.duration.slow` (no tap needed, the item flow does not wait for the learner).
- Home: the piece reaches home, a token goes to the tray, a new piece starts; one line "(A piece went home!)"; no sound beyond the shell's success cue.

## Interaction points

- **The review item**: exactly as on the plain review screen (its own options, Hear it, Hoya lines, nudge on a miss).
- **Item finished**: the sticks fall (art changes, `motion.duration.base`; at once with reduced motion), the throw's name is shown and said once (`~~ 개 ~~`, `kind: 'word'`), the piece walks, then the next item opens after the shell's pause. The whole throw takes at most `motion.duration.celebration` plus the walk (1.5 s at 5 stations), and it never delays the next item's sound beyond the shell pause.
- **The board is not interactive**: no tap to throw, no choice of piece. (A throw the learner taps would turn the board into the activity and slow the review.)
- **[x] Stop**: the review screen's stop sheet; the board is not saved.
- **Look**: where the session offers a choice of look (the Daily Review intro, row CM-D1), "Yut board" is one switch, remembered per profile on this device (a device setting, not progress). A Play S2 quest's review step sets it by content.

## Fallback when `game.yut-review` is off

The **plain review screen**: the same session and items, no board band. A learner who chose the yut look sees the plain screen with no notice (the choice is kept for when the switch is back on).

## No device voice

- Nothing on the board needs sound. The throw name is printed with its romanization; saying it is an extra.
- The review items keep their own audio fallbacks (their formats' rules and `audio-fallback.md`).
- When the throw name cannot be said, nothing extra is shown for it (the name and romanization are already on screen and the item's own status panel covers the session's sound state); the review screen shows the session's one sound notice under the item, as its format does. Source for the throw itself: `yut-review` (counted only when a play was attempted).

## Navigation graph

Enter from: the Daily Review, Keep going and Cell Check screens (row CM-14 / CM-21) with the yut look on; the review step of a Play S2 quest (content, §5.6)
Exit to: the review result (plain, stars only) · the stop sheet -> back to where the session started

## States

- **item open** (board idle), **throwing**, **walking**, **throw again** (윷, 모), **piece home**, **session end** (board gone; the plain result).
- **ends early** ("All refreshed today", §4.5): the plain screen's line; the board shows nothing more.
- **large text (200 %)**: the throw text grows and wraps under the board; the board drawing keeps its size (media) and the band scrolls with the page on a phone.
- **reduced motion**: the sticks change at once, the piece is placed at its station with no walk, no second-throw delay animation (the second throw's result is shown with the first: "~~ 윷 ~~ yut, then ~~ 도 ~~ do").
- **error** (the board art fails to load): the skin hides and the plain screen shows; the session continues.

## Accessibility

- The board is one image with a live description after each throw: "Throw: gae. Your piece moved 2 stations." (`a11y.minigame.yutReview.throw`); "A piece went home." (the description never counts the tray against a total) It never says a station number out of a total: an "n of m" reads like a score, which a review screen never shows (§4.5, the `review-copy` lint). The stations are not focusable (they do nothing). The description is a polite live region and never interrupts the next item's prompt (it is queued after the item's own announcements).
- The look switch reads "Yut board, on".
- The review item keeps its own accessibility.
- No colour-only state: the learner's piece is a distinct shape (a filled disc with a ring) and named in the description.

## Tokens and targets

- Board drawing: stations `surface.paper` with `border.shape` outline (`borderWidth.base`), all 29 stations the same size (the skin makes no claim about how boards mark their points), the start station marked by the piece's ring, lines `border.strong`, no text in the art; the learner's piece `brand.primary` disc with a `surface.paper` ring; home tray `surface.sunken`, `radii.pill`. Sticks prop: four rounded bars in `hoya.furDark` / `surface.sunken` with `border.shape` outline, at most 8 shapes and 5 colours.
- Throw name `typography.size.title` bold, romanization `bodySm`; no tap targets on the board (the 48 dp rule applies to the item area and the Stop control, `touchTarget.min`).

## Data needs

- reads: the review session (CM-13 engine) and the session seed; the look setting (`device:` storage through the platform wrapper).
- logic: `yutBoard(seed)` -> stations, `throwFor(seed, itemIndex)` -> 'do' | 'gae' | 'geol' | 'yut' | 'mo', `walk(position, steps)` -> path and laps, `homeTray(laps)` -> pieces drawn (0 for no lap, else `((laps - 1) mod 4) + 1`, so 1 to 4 and a fifth lap draws 1; pure, 100 %; property test: for any seed and any mix of item results, first try, retry and an item that ends on a reveal, the review's stars, points, `dayLog` and memory writes are identical with the skin on and off, and there is exactly one throw per item).
- writes: nothing of its own. The board state lives in the screen's state and is dropped at the end.
- telemetry: none new (the review session's `review.start` / `review.complete` are unchanged; the look is not sent).

## Draft strings (CM-39 adds them with their es and ko values)

The five throw names and 윷판 are taught Korean drawn with `KoreanText` (romanization from the converter: `do`, `gae`, `geol`, `yut`, `mo`, `yutpan`), with their glosses as content overlays, never inside a UI string.

| Key (proposed) | en draft |
|---|---|
| `yutReview.look` | Yut board |
| `yutReview.stations(n)` | {n} stations (plural rules: 1 station / {n} stations) |
| `yutReview.throwAgain` | Throw again |
| `yutReview.pieceHome` | A piece went home! |
| `yutReview.homeTray` | Home |
| `a11y.minigame.yutReview.throw(romanization, n)` | Throw: {romanization}. Your piece moved {n} stations. (plural rules: 1 station / {n} stations) |
| `a11y.minigame.yutReview.throwAgain` | Throw again. |
| `a11y.minigame.yutReview.home` | A piece went home. |
| `a11y.minigame.yutReview.board` | Yut board |

## Open questions

1. **Station count in the description** (decided in the CM-D2 review): the description says how far the piece moved, never "station n of 20", so nothing on a review screen reads as "n of m".
2. **The inner stations.** The 29 stations include the inner lines of the board; the skin draws them but walks the outer ring only. Using the inner routes needs its own sourced rule and a MAR culture check, so it is left for a later row.
