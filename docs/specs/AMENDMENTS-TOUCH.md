Status: ready (KT-0 docs PR: this amendment, the component spec `design/components/TapBoard/spec.md`, and pointer lines in F-001, F-003, F-004, F-010, F-QUEST-002, F-CURR-001, F-CURR-002, F-PLC-001, F-STORY-003, F-TCH-004, the ChoiceCard component spec and the specs README; implementation rows in section 12; KT-4a first)

# Amendment: one forgiving tap for children: a graze still counts, a bounce never counts twice, a selection is never undone by accident

> Basis: `origin/main` `1bfda3fc8` (2026-10-31). Every `file:line` is at that commit. Paths are under `apps/mobile/src/` unless they start with `DS` (`packages/design-system/src/`), `RNW` (`node_modules/react-native-web/dist/`, 0.19.13) or `RNGH` (`node_modules/react-native-gesture-handler/lib/module/`, 2.20.2).
>
> Amends: F-001 §3.4 (the 50 ms multi-touch rule), F-003 (Build a Letter: remove a placed tile), F-004 (Trace: activation and finalize), F-010 (Odd One Out, Culture Quiz), F-QUEST-002 (Listen & Pick, Pic-Word Match), F-CURR-001 (Sentence Builder, Type Hangul keyboard, Trace a Word), F-CURR-002 (Card Match, Match Shape, Syllable Build, Hidden Heritage, Cloze Pick, Daily Review), F-PLC-001 (one answer per item), F-STORY-003 (Story Sequence, Story Order, checks), F-TCH-004 (presenter tap slop) and `design/components/ChoiceCard/spec.md` (the pressed look).

**Owner request 2026-10-31 (Korean, translated):** "In the mini-games the touch sensitivity is ambiguous. A choice only registers if the child taps cleanly in one go; a slight graze selects it and then lets it go. Make selecting easy for children. Review all the touch sensitivity across the app and improve whatever can be improved."

**Standing rules that apply here:**
- Any age; the learner side is tuned for children (CLAUDE.md §4). Touch targets at least 64 dp (`touchTarget.min`), primary actions 80 (`touchTarget.child`).
- Tokens only for every style value. The timing constants of section 3 are logic constants (not styles) and are pinned by tests.
- No change to scoring except the phantom answers listed in KT-D10.
- Every new or changed English UI string lands with es and ko in the same PR. This amendment adds one UI string, a screen-reader name in KT-6 (section 9).
- Anti-shame: amber, never red; nothing here adds a failure state.

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | **A graze looks chosen, then nothing counts.** Every learner answer is an RN `Pressable` whose `onPress` comes from the browser's `click` (RNW `modules/usePressEvents/PressResponder.js:296-311`). The browser drops that click when the finger slides about 15 px, when it starts a pan (`pointercancel`), or when a second finger is down. The pressed look turns on after 50 ms (`PressResponder.js:74`) and turns off on the cancel: the owner's "selected, then let go". | One **forgiving tap** (KT-D1): the answer commits on the finger's **release**, decided by our own responder, not by the browser's click. A release within 24 px of the target, or after at most 32 px of travel, counts. A touch that starts on an answer never becomes a browser pan (`touch-action: pinch-zoom` on every target); on a screen that scrolls, the board scrolls the page itself once the finger has gone past 32 px, so a graze of up to 32 px in any direction counts on every board, scrolling or not (KT-D3). |
| 2 | **A bounce or a double tap counts twice.** Pic-Word un-selects a tile tapped again (`logic/pic-word-flow.ts:117-123`); Story Sequence, Story Order and Sentence Builder score the card or tile that reflows under the finger as a miss; Sentence Builder's Skip can slide under the second tap; the level check answers the next item blind (`screens/placement/ItemScreen.tsx:197-203`). The existing guard is 50 ms (F-001 §3.4); a child's bounce is 60 to 300 ms. | A **400 ms lock after every commit** (KT-D5), on one app-level clock where the commit moves things (so it survives a per-round remount and a screen change), per target where it does not. Pic-Word's tap-again-to-unselect goes (KT-D6). |
| 3 | **A selection disappears on its own.** Card Match's 600 ms wrong-flash timer is never cleared and un-selects the next pick (`screens/minigames/CardMatchGame.tsx:107-115`). | The timer is kept in a ref and only clears the selection it was set for (KT-D6). |
| 4 | **Targets under the floor and dead zones.** Card Match's English cards are 51 px tall at 320 px; Hidden Heritage spots 54 to 62 px; `hitSlop` does nothing on the web (RNW drops the prop), so the gaps between tiles are dead. | Card Match cards get `minHeight: touchTarget.min`; Hidden Heritage spots get a hit area of at least 64 px without overlapping, with one stated exception for a spot boxed in by neighbours (KT-D8); the board fills gaps to the **nearest** target (KT-D1 rule 2), which replaces `hitSlop` on the web. |
| 5 | **Two fingers lose both.** A resting palm or a second finger cancels the first finger's tap; on the keyboard a rollover loses both letters. | The latest finger to land on an answer owns the board; an earlier finger (a resting thumb or palm) never blocks it and never answers when it lifts; a finger that lands on nothing is ignored (KT-D4). The keyboard takes each finger on its own (KT-D7). |
| 6 | **Trace forgets to check.** A touch shorter than RNGH's 15 px pan activation (`RNGH web/constants.js:1`) cancels the idle check and never re-arms it; a palm joins the stroke. | The pan activates at 4 px, the stroke follows one moving finger (a resting palm is ignored and cancels nothing), and a touch that never became a stroke leaves no ink and re-arms the check (KT-D9). |
| 7 | **No proof.** Every game e2e uses `.click()` or `.tap()` with zero movement; the touch-target ratchet covers four non-game screens. | A touch e2e suite (grazes, bounces, two fingers) on every board at 320 px and tablet, and the target ratchet on every game at 320 px with the largest text (section 11). |

## 1. What was measured

One read-only audit on a scratch worktree of `origin/main` `1bfda3fc8` (no commits; probe specs outside the repo). Build: `build:web:fixtures` (`dist-e2e`), `STORY_FIXTURES=1`, Playwright Pixel 5 profile (`hasTouch`, `isMobile`), raw CDP `Input.dispatchTouchEvent` for grazes, bounces and two-finger touches.

### 1.1 How a selection commits today

- Every learner target is an RN `Pressable` with `onPress`. No game commits on `onPressIn` or `onPressOut`; the only `onPressIn` users are the presenter ControlBar's focus bookkeeping (`screens/presenter/ControlBar.tsx:200,560,923`).
- On the web (the PWA, the main platform), RN-web calls `onPress` only from the native `click` (RNW `PressResponder.js:296-311`), and the browser sends no click after it started a pan. RN-web's responder does not listen to `pointercancel`: it ends on `touchcancel`, and an ancestor's `scroll` ends it only through `onResponderTerminationRequest` (RNW `modules/useResponderEvents/ResponderSystem.js:321-332`, `:355-361`; `scroll` is listened to in the capture phase, `:520`). Chrome and Safari do not reliably send `touchcancel` when a pan starts, so a responder that refuses the request can outlive a scroll.
- Every game sits in a ScrollView: `Screen` defaults to `scrollable = true` (DS `components/Screen/Screen.tsx:19`, `:54-63`). Only the trace canvas has `touch-action: none` (`apps/mobile/scripts/pwa-postbuild.mjs:124`); the presenter Stage has `manipulation` (`screens/presenter/Stage.tsx:338`). Game targets are `touch-action: auto`; double-tap zoom is on.
- `hitSlop` is web-dead: RN-web's View does not forward it. It sits on ChoiceCard (DS `ChoiceCard/ChoiceCard.tsx:107`), Tile (DS `Tile/Tile.tsx:105`), Button (DS `Button/Button.tsx:131`), KoreanText (DS `KoreanText/KoreanText.tsx:136`), HoyaBubble (DS `HoyaBubble/HoyaBubble.tsx:92`), the Listen & Pick and Match Sound speakers (`screens/minigames/ListenPickGame.tsx:376`, `MatchSoundGame.tsx:177`), the Sentence Builder tray tile (`SentenceBuilderGame.tsx:521`), the Daily Review speaker (`screens/quest/quest-review-chunk.tsx:371`), the vocab speaker (`screens/vocab/VocabQuestionView.tsx:328`), Home (`screens/home/HomeScreen.tsx:975`), WhoSwitch, VoiceHelp and InstallGuide.
- No `pressRetentionOffset`, `delayPressIn` or `unstable_pressDelay` anywhere.
- A 50 ms de-dupe window exists only in Listen & Pick (`logic/listen-pick-flow.ts:31`), Cloze Pick (`logic/cloze-pick/flow.ts`), Realia Read (`logic/realia-read-flow.ts:34`), the vocab question (`logic/vocab/question-flow.ts:33,79`) and Sentence Builder (`logic/sentence-builder/reducer.ts:23,90`), from F-001 §3.4.

### 1.2 Graze matrix on a Match Sound tile (Tile, 96 x 98; the screen fits, 727 / 727)

| Gesture | Click? |
|---|---|
| Tap of 10 ms and 60 ms | yes |
| Move of 4, 8, 12 px (vertical; horizontal at 12) | yes |
| Move of 16, 20, 30 px vertical; 20, 30 px horizontal | **no**: `pointercancel`; the tile is drawn pressed (scale 1.04) during the move, then reverts |
| Hold of 300 to 900 ms, no move | yes (headless Chromium; a real long-press callout not checked) |
| Two fingers, the second 40 ms later on another tile | **no click for either** |

The effective tolerance is about 15 px. A child's touch slides more than that very often.

### 1.3 Confirmed failures (each gets a regression test, section 11)

- **F1 Pic-Word: a graze looks selected, then nothing.** A 20 px vertical graze turns the card border focus blue (`colors.border.focus`, the ChoiceCard press look, DS `ChoiceCard.tsx:111`), then `pointercancel`; nothing is recorded. The same look is on every ChoiceCard (Listen & Pick, Read Pick, Cloze Realia, Realia Read, Story Sequence, Story Order, Story Check, Daily Review, placement). Focus blue is also the `hint` state's border, so a press **looks like a state**.
- **F2 Pic-Word: a bounce un-selects.** `logic/pic-word-flow.ts:117-123` toggles the selected tile off on a second tap. Two taps 60, 120, 200 or 300 ms apart end unselected every time.
- **F3 Card Match: a stale timer un-selects the next pick.** `CardMatchGame.tsx:107-115` sets a 600 ms timeout that is never stored. Tap geune, the wrong "sand", then morae within 250 ms: morae turns selected, then white with no input. Also: a meaning tapped first is ignored with no feedback (`:100`); English cards are 138 x 51 at 320 px (no `minHeight`, `:186-206`); no `accessibilityRole` (`:139`, `:186`); no press look; the completion timeout (`:92`) is not cleared on unmount.
- **F4 Story Sequence: a bounce on the right card scores a miss on the next one.** The placed card leaves and the next reflows under the finger (`StorySequenceGame.tsx:495-512`; `logic/story/sequence-player.ts:74-93`). Two taps 150 ms apart on "Wear hanbok": the second lands on "Receive lucky money", which turns "Try another" and Hoya's miss line shows. Story Order has the same reflow (`story-order/StoryOrderGame.tsx:464`, code-read).
- **F5 Sentence Builder: a bounce scores a miss or skips the step.** 200 ms gap: the second tap lands on the tile that slid into place, logged `{ key: 0, correct: false }`, the round's first answer. 100 ms gap: the tray drops to one row, Skip moves under the finger and the step is skipped. After any miss, taps are dropped for 520 ms while the tile slides back 32 px under the finger (`reducer.ts:89`; `SentenceBuilderGame.tsx:85-98,176`).
- **F6 Placement: a bounce answers two items.** `choose()` has no lock after an answer (`ItemScreen.tsx:197-203`); Standard and Deep enable the next choices at once (`logic/placement/flow.ts:465-479`). Two taps 150 ms apart fire two `placement.item_answered`.
- **F7 Type Hangul keyboard.** At 320 px the split layout is 29 keys of 64 x 64, edge to edge (DS `HangulKeyboard/layout.ts:134-150`). A rollover loses both letters; an 18 px slide on a key types nothing; a bounce on Shift (a toggle, DS `HangulKeyboard.tsx:38-40`) turns it on and off.
- **F8 Hidden Heritage spots under the floor at 320 px:** 58 x 66, 59 x 66, 62 x 65, 59 x 65, 59 x 56, 60 x 56 (spot minimum 75 canvas units, `packages/content-schema/src/schemas/minigame.ts:680`, times 288 / 400). No press look, only a focus ring (`HiddenHeritageGame.tsx:109-140`); in the narrow latch the scene is a horizontal ScrollView (`:313`), so a sideways graze scrolls.

### 1.4 Code-read risks (not reproduced in a browser)

- **R1 Trace** (`TraceStrokeGame.tsx:259-275`, `TraceWordGame.tsx:313-327`): `Gesture.Pan()` with RNGH's 15 px activation. `onBegin` starts a stroke and cancels the idle check (`strokeStarted`); only `onEnd` re-arms it (`logic/trace-evaluator.ts:72-76`), and `onEnd` runs only for an activated pan. A dot or short touch leaves a one-point stroke and no auto-check until the next full stroke or Done. No `.maxPointers(1)`: a palm joins and RNGH averages the pointers.
- **R2 Build a Letter**: placed tiles render as non-pressable Views (`BuildLetterGame.tsx:216-226`) and slots are plain Views (`:186-201`); the remove branch at `:98-101` is dead. A mistaken tile forces a full wrong attempt (scored, 900 ms reset at `:124`), and taps during that reset are accepted, then wiped.
- **R3 Locked wrong tiles stay pressable** in Match Sound (`MatchSoundGame.tsx:207-221`, Tile `state="wrong"` keeps `onPress`) and Odd One Out (`OddOneOutGame.tsx:115-131`): every bounce is another `answerRound(false)`, nudge haptic and replay. (Culture Quiz and Tap Respond pass `disabled` and are fine.)
- **R4 No press look** in Match Shape (`MatchShapeBoard.tsx:225-248`, `:315-330`), Card Match and Hidden Heritage.
- **R5 iOS Safari** keeps double-tap zoom on game screens; it may delay or swallow quick taps.
- **R6 Native iOS** (Xcode build): `hitSlop` works, but a ScrollView still steals after about 10 pt.
- **R7 Presenter Stage** (`logic/lecture/stage-gesture.ts:18`): `TAP_SLOP` is 12 px and a swipe needs 60; a touch between does nothing. Teacher-operated, lower priority.
- **R8 Buttons double-fire.** DS `Button` has no guard; a bounce on Continue or Next can run it twice. Code-read; covered by KT-2.

### 1.5 Per-surface inventory (before)

| Surface | Component | Commit | Toggle | Min size at 320 px | Feedback |
|---|---|---|---|---|---|
| Listen & Pick, Read Pick | ChoiceCard | click | no | 80 | focus border; 50 ms window |
| Match Sound, Odd One Out | Tile | click | no, but locked wrong stays tappable (R3) | 96 | scale 1.04 |
| Match Shape | Pressable | click | no | 64+ | none |
| Pic-Word Match | ChoiceCard in TileFrame | click | **yes (F2)** | 124 x 124 picture; the board scrolls at largest text (1063 / 568) | focus border |
| Card Match | bare Pressable | click | stale timer (F3) | EN 138 x 51 | none |
| Sentence Builder | Pressable | click | no | 80 | scale 1.04; 50 ms + 520 ms drop |
| Cloze Pick | Pressable, `minHeight` 64 (`ClozePickGame.tsx:328-359`) | click | no | 64 | ChoiceCard look; 50 ms |
| Story Sequence, Story Order | ChoiceCard | click | no | 148 | focus border; reflow bounce (F4) |
| Story Check, Daily Review | ChoiceCard | click | no | 80 | focus border; locked after `right` |
| Culture Quiz, Tap Respond | Button | click | no | 64+ | Button look; wrong disabled |
| Role Play | Pressable, `minHeight` 80 (`RolePlayGame.tsx:590-619`) | click | no | 80 | `sending` lock |
| Hidden Heritage | absolute Pressable spots | click | no | 54-62 | focus ring only |
| Syllable Build | Pressable zones and tiles (`SyllableBuildBoard.tsx:219-239`) | click | a filled zone clears on purpose (`logic/syllable-build/flow.ts:104-109`) | 64 | varies |
| Build a Letter | Tile | click | no undo (R2) | 96 | scale 1.04 |
| Type Hangul | DS HangulKeyboard | click | Shift toggle | 64 | fill |
| Trace, Trace a Word | RNGH Pan | pan end | n/a | canvas | ink |
| Placement | ChoiceCard + "not sure" Pressable | click | no lock (F6) | 80 | focus border |
| Presenter | View responder, own slop | release | n/a | stage | own |

---

## 2. Decisions

- **KT-D1. One forgiving tap model** for every learner answer target (section 3): commit on release, generous reach and travel, nearest-target gap fill, press look at once, a cancel changes nothing.
- **KT-D2. One shared primitive** in the design system: `TapBoard` (owns the touches of an answer area), `TapTarget` (one answer inside it), `TapControl` (a non-answer control inside a board), `TapScroller` (a scroll container a board may drive), and `TapLockProvider` with `useTapLock` (the app-level lock, readable from anywhere), with the pure model in DS `tap-model.ts` (section 4; component spec `design/components/TapBoard/spec.md`).
- **KT-D3. Scrolling never steals a tap.** Every `TapTarget` sets `touch-action: pinch-zoom` on the web, so a touch that starts on an answer never becomes a browser pan, whether or not the screen fits. When the board's scroller (the `Screen`'s ScrollView, or Hidden Heritage's horizontal scene) can scroll, the board scrolls it itself: once a touch that started on a target has travelled more than `TAP_TRAVEL` along the scroller's axis, it turns into a scroll (no commit) and the content follows the finger, with a fling on release. So a graze of up to 32 px counts on every board, and a longer drag still scrolls. A board on a `Screen` that fits also sets `pinch-zoom` on itself, so a touch claimed in a gap is never cancelled either. `Screen` sets `touch-action: manipulation` on its content (no double-tap zoom, no click delay; R5). On native, a `Screen` turns `scrollEnabled` off only while it fits, holds a board and has no focused text field (R6). Section 5.
- **KT-D4. The latest finger on an answer owns the board.** A finger that lands on a target the board claims (rule 2) while another finger is down takes the board: the earlier touch becomes **resting** (press look off; it never commits, and its lift does nothing). A finger that lands where the board claims nothing is ignored and cancels nothing. So a thumb resting on the bottom row while the child taps with the other hand never blocks the tap and never answers by itself when it lifts. The trade-off: a palm that lands on a target **after** the finger, while the finger is still down, takes the board; a tap is short, so this is rare. The keyboard is the one exception (KT-D7).
- **KT-D5. Lock after commit: 400 ms** (`TAP_LOCK_MS`). Scope `board` where a commit moves, removes, reveals or advances anything (the second tap would land on something else); scope `target` where it does not (pairing games, where tapping two different tiles quickly is a real move). A `board` lock lives on **one app-level clock** (`TapLockProvider`, mounted once above the navigator), not in the board: every board and every guarded press reads it, so the lock survives a keyed per-round or per-item remount (Placement, Daily Review, Match Shape, Syllable Build, Story Order) and a screen change after Continue. A `target` lock stays in the board; a `target`-scope commit that ends a round (and so moves or remounts the board: Pic-Word, Card Match, Syllable Build, Build a Letter) also calls `lock(TAP_LOCK_MS)` on the app clock. The 50 ms windows of F-001 §3.4 become this lock.
- **KT-D6. A selection only changes by a deliberate act.** A cancel never changes state. A repeat tap on the selected tile keeps it selected (Pic-Word drops its toggle). A game that lets the child take something back (Syllable Build zone, Build a Letter slot, keyboard Shift) does so only on a tap on that separate target (never by a second tap on what the child just chose), outside that target's lock, and gap fill never reaches such a target (rule 2). Timers clear only the state they were set for.
- **KT-D7. The keyboard takes each finger on its own** and types the key under the finger at release (the standard on-screen keyboard rule, so the press look follows the finger); letter keys, Delete and Space ignore a repeat on the same key within `KEY_BOUNCE_MS` (120 ms, `motion.duration.fast`), so quick repeated deletes still work; only Shift (a toggle) has the 400 ms target lock. The keyboard neither sets nor reads the app-level lock.
- **KT-D8. Every answer target reaches 64 x 64** at 320 px with the largest text: Card Match cards get `minHeight`; Hidden Heritage spots get a separate hit rectangle (`spotHitRects`, section 6.6) with no schema or content change. The one exception: a Hidden Heritage spot boxed in on both sides of one axis (by neighbours or the scene edge) takes all the room between those bounds on that axis, which can be under 64 (section 6.6 gives the minimum); the ratchet asserts exactly that, never a blanket 64.
- **KT-D9. Drag thresholds.** Trace activates at 4 px (`spacing.xs`), the stroke follows the first finger that moves (a resting palm is ignored and never cancels the stroke), and a touch that never activates leaves no ink and re-arms the idle check. There is no drag-and-drop game; every other game is tap-only.
- **KT-D10. Scoring.** What counts as right or wrong for a committed answer does not change, and no game changes its rules (Card Match keeps "Korean card first", as its instruction says). The score effects are: (a) removals of phantom answers: the reflow misses (F4, F5), the skip under a bounce (F5), the blind placement and Daily Review answers across an advance (F6), extra misses on a locked wrong tile (R3), and the forced wrong attempt in Build a Letter (R2; a child can now take a tile back from its slot before the word is complete); (b) one intended addition, which is the forgiving tap itself: a touch up to `GAP_REACH` outside a target (gap fill), or a graze that today gets no click, now commits that target, and on a pick-one board that is a scored answer, right or wrong.
- **KT-D11. The press look is never a state look.** It is a "pushed in" look, a thick `border.shape` outline and a slight shrink (section 4.3), different from selected, hint, focus and correct, so a touch that does not count can never look chosen.

## 3. The tap model (DS `tap-model.ts`, pure, 100 % unit-tested)

### 3.1 Constants (pinned by `tap-model.test.ts`; the spacing ones equal their tokens)

| Name | Value | Meaning |
|---|---|---|
| `TAP_TRAVEL` | 32 (`spacing.xxl`) | A release still counts after the finger travelled this far from where it went down, wherever it is; past this along the scroller's axis the touch becomes a scroll |
| `RELEASE_REACH` | 24 (`spacing.xl`) | A release still counts this far outside the target the finger went down on |
| `GAP_REACH` | 16 (`spacing.lg`) | A touch that lands in a gap goes to the nearest target within this distance |
| `TAP_LOCK_MS` | 400 | After a commit, taps in the lock's scope are swallowed (a child's bounce is 60 to 300 ms) |
| `CLICK_ECHO_MS` | 700 | The browser's `click` after a pointer release the board already handled is ignored |
| `KEY_BOUNCE_MS` | 120 (`motion.duration.fast`) | Keyboard: a repeat on the same key (letter, Delete, Space) within this is a bounce |
| `FLING_DECAY` | 0.95 per 16 ms | A board-driven scroll keeps the release velocity (measured over the last 100 ms of the touch) and multiplies it by this every frame until it is under 0.05 px/ms or a new touch lands |

No press delay: the press look shows on the first touch frame. No long-press action exists on any learner answer target, so a hold of any length still commits on release.

### 3.2 Rules

1. **Down.** The board hit-tests the point against its targets' rectangles. On the web it reads `getBoundingClientRect` at touch start. On native it reads a **cache**: each target measures itself (`measureInWindow`) on its `onLayout`, and the board re-measures every target after its scroller's scroll or momentum ends and after a `Screen` fit change (an async measure cannot answer the synchronous capture call on the old architecture, which the Expo 52 app runs).
2. **Gap fill.** A point inside no target goes to the target whose rectangle is nearest, if that distance is at most `GAP_REACH` and no other target is within 1 px of the same distance (a tie is nobody's). A point near no target is not claimed: it falls through to whatever is under it. **Controls first:** a point on any other control inside the board (a speaker, a hint button) is never claimed, even within `GAP_REACH` of a target. The board knows its controls two ways: a non-target control inside a board registers through `TapControl` (a DS wrapper that registers its rectangle and is never claimed; KT-1 wraps every in-board speaker and hint it finds), and on the web the board also skips any touch whose DOM target is inside an element with `role="button"`, a link or a form field that is not a registered `TapTarget`, so an unwrapped control still works. **No gap fill to a take-back target:** a target with `gapFill={false}` (a filled Syllable Build zone, a filled Build a Letter slot: a tap on it clears something) is hit only by a touch inside its own rectangle.
3. **Press look.** A claimed touch on an enabled, unlocked target shows that target's press look at once. A locked or disabled target is claimed (so the touch cannot reach anything else) but shows nothing and commits nothing.
4. **Move.** The touch stays "inside" while the point is within `RELEASE_REACH` of the down target's rectangle **or** within `TAP_TRAVEL` of the down point, **unless** the point is inside the own rectangle (not the gap band) of a different enabled target: a finger that has slid onto a neighbour is outside, so the card it left never commits. The press look shows exactly while it is inside. On a non-keyboard board the target never changes during a touch.
5. **Scroll.** On a board whose scroller can scroll (section 5), once the travel along the scroller's axis passes `TAP_TRAVEL`, the touch becomes a scroll for good: press look off, no commit on release, and the board scrolls the scroller by the finger's movement beyond that point, then flings on release (`FLING_DECAY`). A new touch on the board stops a fling and is a normal touch.
6. **Release** of the owning finger inside: **commit** the down target once, then start the lock (KT-D5). Released outside, or a scroll: nothing, and the press look is already off.
7. **Cancel** (responder terminated, a pinch starting, the app hidden): press look off, nothing else. A cancel never changes selection, score or focus. The board refuses a termination request only when another responder asks to take over and on `contextmenu` (a long hold must not end the tap); it accepts one for `scroll` and `selectionchange`. It also cancels the press itself when its scroller's offset changes during the press by anything but its own scrolling (rule 5), so a scroll of any kind never ends in a commit.
8. **Other fingers** (KT-D4): a later finger that lands on a target the board claims takes the board and the earlier touch becomes resting (never commits, its lift does nothing); a later finger that lands on nothing claimable is ignored. Only the keyboard (`each`) differs.
9. **Click echo.** `TapTarget` keeps an `onPress` for clicks that come with no touch: keyboard Enter or Space, a screen reader's activate, switch access, a mouse where the responder did not see the press. Such a click commits through the same path and lock. A click within `CLICK_ECHO_MS` after a release the board handled (committed or not) is dropped, so a mouse or a touch never commits twice.
10. **Lock.** `board` scope: the app-level clock (`TapLockProvider`) is set to `now + TAP_LOCK_MS`, and every board and every guarded press (section 4.4) is locked until then, including a board that mounts during that time. `target` scope: only the committed target, held in the board. A game may extend the app lock (Sentence Builder's slide back, Build a Letter's 900 ms reset) through `lock(ms)`. Without a provider (an isolated test or story) a board keeps its own clock.

### 3.3 Given / When / Then (each row is a unit test of the pure model and, where it says e2e, a Playwright case)

| # | Given | When | Then |
|---|---|---|---|
| T1 | a fitting board, target A 96 x 96 | finger down on A, moves 24 px down, lifts | A commits once (e2e) |
| T2 | same | moves 40 px down, ends 20 px below A | A commits (inside `RELEASE_REACH`) (e2e) |
| T3 | same | moves 80 px away and lifts | nothing commits; the press look turned off as the finger left (e2e) |
| T4 | A and B 12 px apart | finger down in the gap 4 px from A | A is pressed and commits |
| T5 | A and B 12 px apart | finger down exactly midway | nothing claimed |
| T6 | `board` scope | taps on A at 0 and 150 ms | one commit (e2e: F4, F5, F6) |
| T7 | `target` scope | tap A, then tap B 150 ms later | both commit (Pic-Word pairing) |
| T8 | `target` scope | taps on A at 0 and 150 ms | one commit (F2) |
| T9 | any board | finger 1 down on A, finger 2 down on B 40 ms later, finger 1 lifts, finger 2 lifts | B commits once, A never (e2e) |
| T9b | any board | finger 1 rests on A for 3 s; finger 2 taps B; finger 1 lifts later | B commits at finger 2's lift; finger 1's lift commits nothing (e2e) |
| T9c | any board | finger 1 down on A; finger 2 lands on an empty margin and lifts; finger 1 lifts | A commits; finger 2 changed nothing |
| T10 | any board | down on A, hold 900 ms, lift | A commits (e2e) |
| T11 | any board | down on A, responder terminated | no commit, no state change, no press look |
| T12 | any board | touch release commits A, then the browser's click on A 30 ms later | one commit |
| T13 | any board | keyboard focus on A, Enter | A commits once; the lock starts |
| T14 | a board on a scrolling `Screen` | 20 px horizontal graze on A | A commits (e2e) |
| T15 | a board on a scrolling `Screen` | 16, 24 and 32 px vertical grazes on A | A commits each time; the page does not move (e2e) |
| T15b | a board on a scrolling `Screen` | 72 px vertical drag starting on A | the page scrolls 40 px with the finger; A does not commit and nothing changes (e2e) |
| T15c | any board | down on A; the scroller's offset changes by a scroll the board did not drive; lift on A | no commit; press look off |
| T16 | a disabled target (locked wrong tile) | tap | nothing; no haptic, no replay, no `answerRound` (R3) |
| T17 | A and B 8 px apart | down near A's edge, slide 25 px into B, lift over B | nothing commits; A's press look turned off when the finger entered B (e2e) |
| T18 | A, and a `gapFill={false}` target Z 8 px away | finger down in the gap 3 px from Z | Z is not claimed (A if within `GAP_REACH`, else nothing) |
| T19 | a `board` commit; the board is keyed and remounts at 320 ms | tap on the new board at 350 ms; another at 450 ms | the first is swallowed with no press look; the second commits (Daily Review, Placement) |
| T20 | a speaker registered through `TapControl` 6 px from A | finger down on the speaker | the board claims nothing; the speaker plays |

## 4. Components

### 4.1 `TapBoard` (DS `components/TapBoard/`)

Props: `lock: 'board' | 'target'` (required, section 6 names each surface's), `scroll?: 'auto' | 'none'` (default `auto`: the board drives the nearest `TapScroller`, section 5; `none` for a board that never scrolls, such as the keyboard), `multiTouch?: 'latest' | 'each'` (default `latest`, rule 8; `each` only for the keyboard), `disabled?`, `testID?`, `children`.

- Owns the responder by **capture** (`onStartShouldSetResponderCapture` returns true only for a touch rule 2 claims), so the `Pressable` inside each target never gets the touch on any platform; it keeps role, focus and keyboard activation.
- Termination per rule 7: `onResponderTerminationRequest` returns false only for a responder transfer and for `contextmenu`; it returns true for `scroll` and `selectionchange` (RN-web passes the DOM event type). The board also subscribes to its scroller and cancels a live press on any offset change it did not drive.
- Commits on `onResponderEnd` for the owning finger, not on `onResponderRelease` (which waits for every finger), as `screens/presenter/Stage.tsx:202-214` already reads touches.
- Rectangles per rule 1 (web: live; native: the cache, re-measured on target layout, scroller scroll or momentum end, and fit change).
- Web style on the board itself: `pinch-zoom` when its `Screen` fits (a gap touch is never panned), else `pan-y pinch-zoom` (`pan-x pinch-zoom` under a horizontal `TapScroller`). Every `TapTarget` is `pinch-zoom` in every case. If `CSS.supports('touch-action', 'pinch-zoom')` is false (older iOS), the `pinch-zoom` keyword is dropped: a target and a fitting board use `none`, a scrolling board `pan-y` (or `pan-x`) (assumption U1).
- Lock per rule 10: `board` commits set and read the app-level `TapLockProvider`; `target` locks stay in the board.

`TapLockProvider` (mounted once in the app root, above the navigator) holds the one `board` lock clock. `useTapLock(): { locked: boolean; lock(ms: number): void }` reads or extends it from **any** component, inside a board or not (Sentence Builder's Skip, a slide-back animation, Placement's `ItemScreen`). `locked` re-renders when the lock ends.

`TapControl` wraps a non-target control inside a board (a speaker, a hint) so rule 2 never claims a touch on it (it registers its rectangle; web also checks the DOM role).

`TapScroller` wraps the content of a ScrollView a board may drive: `{ axis: 'x' | 'y'; canScroll; scrollBy(delta); onScroll(listener) }`. `Screen` provides one for its ScrollView (axis `y`); a game whose board sits in its own horizontal ScrollView (Hidden Heritage's narrow latch) wraps that one (axis `x`).

### 4.2 `TapTarget`

Props: `onCommit: () => void`, `disabled?`, `gapFill?: boolean` (default true; false for a take-back target, rule 2), `accessibilityLabel` (required), `accessibilityState?`, `testID?`, `children: (look: { pressed: boolean }) => ReactNode`.

- Renders a `Pressable` with `accessibilityRole="button"` whose `onPress` is the click path of rule 9, sets `touch-action: pinch-zoom` on the web, and registers its node with the board.
- Outside a `TapBoard` it behaves as a plain `Pressable` with the KT-2 Button guard (section 4.4), so a design-system component can use it everywhere.

### 4.3 The press look (KT-D11; replaces ChoiceCard's focus-blue press border and Tile's scale 1.04)

- Border `colors.border.shape` at `borderWidth.thick` (at least 3:1 on canvas, paper, sunken and `brand.primaryLight`, so it shows on every fill), fill unchanged, scale 0.97 (under reduced motion no scale: the border alone). Instant, no transition.
- Never `colors.border.focus` (focus ring and `hint`), never `colors.brand.primary` (Pic-Word's selection ring), never `colors.brand.primaryLight` (Card Match's selected fill), never `colors.surface.sunken` (the `disabled` fill), never a feedback colour.
- Shown at once on down, only while the touch is inside (rule 4). On a locked or disabled target, never.

### 4.4 DS adoptions (KT-2)

- **ChoiceCard** and **Tile** paint the press look of 4.3 and render through `TapTarget` (in a board they join it; outside one they keep today's behaviour plus the guard). Their web-dead `hitSlop` is removed; on native the board's gap fill replaces it inside boards, and outside boards they are already at least 64.
- **Button**: the press look shows without RN-web's 50 ms delay (`delayPressIn={0}`), and `usePressGuard` ignores a second `onPress` of the same button within `TAP_LOCK_MS` (R8) and any press while the app-level lock is on, and sets that lock when it runs. So a bounce on an answer cannot press a Continue that appears under the finger, and a bounce on Continue or Next cannot answer on the next screen. Its `hitSlop` stays (native only, harmless); the web size is already at least 64.
- `design/components/ChoiceCard/spec.md` "Pressed" text and the Tile notes are updated in KT-2.

## 5. Scrolling, zoom and native (KT-D3)

- `Screen` measures fit (`onLayout` of the ScrollView and `onContentSizeChange`; fits when content height is at most the viewport height + 1) and publishes `{ fits }` and its `TapScroller` (axis `y`, `canScroll = !fits`). It re-measures on text size changes and rotation.
- **Board-driven scroll (web and native).** A touch that starts on a target never pans natively (`pinch-zoom` on the target on the web; on native see the last bullet). When the board's scroller can scroll, rule 5 turns that touch into a scroll after `TAP_TRAVEL` along the scroller's axis and the board moves the content with the finger and flings it on release. A touch that starts outside every target (beyond gap reach, on a speaker, in the page margin) keeps the platform's own scroll. A fit change during a touch (Card Match's HoyaBubble appearing after a pick) does not affect a touch on a target.
- A touch claimed through gap fill on a scrolling `Screen` sits on the board, which is `pan-y`: a vertical drag there is a browser pan and rule 7 cancels the press (no commit). Horizontal grazes there never pan.
- `Screen` sets `touch-action: manipulation` on its scroll content on the web. The `pwa-postbuild.mjs` comment "Pinch-zoom stays enabled" stays true: `manipulation` and `pinch-zoom` both keep pinch zoom.
- **Native, opt-in.** A mounted `TapBoard` registers with its `Screen`. A `Screen` sets `scrollEnabled={false}` only while it fits, at least one board is registered and no `TextInput` inside it is focused (no app screen has keyboard avoidance, so a form must stay scrollable). A `Screen` without a board (every grown-up and onboarding form) never changes. On a native `Screen` that scrolls, the native ScrollView can still take a vertical drag of about 10 pt that starts on a target before the board sees it; that is assumption U3, checked on the Xcode build in KT-12.
- The fit audit (section 11.2) stays a report: no game needs to fit for grazes to count, but a game that fits keeps every touch, gap touches included, safe.

## 6. Surface by surface (after)

| Surface | Board, lock | Changes | Fixes | Row |
|---|---|---|---|---|
| Listen & Pick | answers, `board` | ChoiceCards join the board; `touchWindowMs` becomes `TAP_LOCK_MS` | F1 | KT-3 |
| Read Pick, Cloze Pick, Cloze Realia, Realia Read | answers, `board` | same; Cloze Pick's own Pressable becomes a `TapTarget` | F1 | KT-3 |
| Match Sound, Odd One Out | tiles, `board` | a locked wrong tile is `disabled` (same wrong look, `accessibilityState.disabled`) | R3, F1 | KT-3 |
| Culture Quiz, Tap Respond | answers, `board` | Buttons inside a board use `TapTarget` | F1 | KT-3 |
| Story Check, Daily Review | answers, `board` | as Listen & Pick; the app-level lock covers Daily Review's keyed `PickRoundView` remount after a right answer (`quest-review-chunk.tsx:193`, advance after `motion.duration.slow` = 320 ms, `:335`), so a bounce never gives the next item a blind first-try answer | F1, F6 class | KT-3 |
| Vocab question, Speed Round | answers, `board` | `question-flow.ts` window becomes `TAP_LOCK_MS` | F1 | KT-3 |
| Pic-Word Match | two boards, `target` | no toggle (6.1); TileFrame's 4 px padding moves inside the target | F1, F2 | KT-4a, KT-4b |
| Card Match | two boards, `target` | 6.2 (Korean card first, as today) | F3, R4 | KT-4a, KT-4b |
| Story Sequence, Story Order | cards, `board` | the lock covers the reflow and Story Order's keyed round remount (`StoryOrderStep.tsx:107`) | F4 | KT-5 |
| Sentence Builder | tray, `board`; Skip outside it reads the app lock | 6.3 | F5 | KT-5 |
| Placement | choices + Not sure, `board` | 6.4 | F6 | KT-5 |
| Match Shape | board, `board` | press look; the lock covers the keyed round remount (`MatchShapeGame.tsx:65`) | R4 | KT-6 |
| Syllable Build | tiles and zones, `target` | a filled zone is `gapFill={false}` and clears only outside its lock; the keyed round remount (`SyllableBuildGame.tsx:77`) starts locked because the round-ending commit calls `lock(TAP_LOCK_MS)` (KT-D5) | F1 | KT-6 |
| Build a Letter | tray and slots, `target` | 6.5 | R2 | KT-6 |
| Hidden Heritage | scene, `board`; its horizontal scene is a `TapScroller` (axis `x`) in the narrow latch | 6.6 | F8, R4 | KT-6 |
| Role Play, Voice Echo, Write Frame word pick, My Story | answers, `board` | Pressables become `TapTarget`s; Role Play keeps its `sending` lock | F1 | KT-6 |
| Type Hangul keyboard | DS HangulKeyboard, `each` | 6.7 | F7 | KT-7 |
| Trace, Trace a Word (and Write Frame's trace) | RNGH Pan | 6.8 | R1 | KT-8 |
| Learner non-game Pressables | none | 6.9 | R8 | KT-9 |
| Presenter Stage | own responder | 6.10 | R7 | KT-10 |

### 6.1 Pic-Word Match (`logic/pic-word-flow.ts`)

- `selectStep`: a tap on the selected tile returns the state unchanged (the `cleared` branch at `:117-123` goes). A tap on another tile on the same side moves the selection, as today. A pair attempt resolves as today.
- The flow test's toggle case is rewritten to "a second tap keeps the selection"; the e2e repeats F2 (taps 60, 120, 200, 300 ms apart end selected).

### 6.2 Card Match (`CardMatchGame.tsx`)

- The wrong-flash timer lives in a ref, is cleared on any new selection and on unmount, and when it fires it clears `wrongFlash` and clears the selection **only if it is still the one that missed**. The completion timeout (`:92`) is cleared on unmount.
- The game's order stays as it is: a Korean card first, then its meaning (the en, es and ko instruction says so, `cardMatch.instruction`). Today a Korean tap only selects and plays its word, so a child can explore the sounds safely; letting the meaning side go first would turn those taps into scored attempts. A meaning tapped first stays a no-op, as today; changing that is a game rule change with an instruction change, outside this amendment.
- Both columns: `TapTarget` (button role, the existing labels), `minHeight: touchTarget.min`, the press look, `target` lock.

### 6.3 Sentence Builder (`logic/sentence-builder/reducer.ts`, `SentenceBuilderGame.tsx`)

- `TOUCH_WINDOW_MS` becomes `TAP_LOCK_MS`; the tray is a `board` board, so the tile that slides under a bounce is not tapped (F5 at 200 ms).
- **Skip** is not inside the tray (`SentenceBuilderGame.tsx:318` tray, `:350-354` Skip), so it reads the lock from the app-level `TapLockProvider` through `useTapLock()` (KT-D5), not from the board, and ignores a press while it is locked, with no visual change (F5 at 100 ms). The `TapBoard` wraps the tray only. KT-5's render test asserts a Skip press 100 ms after a tray commit is ignored.
- While a missed tile slides back (`RETURN_MS`, 520 ms), the tray calls `lock(RETURN_MS)` on the app lock: no press look shows on a tile that cannot be tapped, and Skip waits too.

### 6.4 Placement (`logic/placement/flow.ts`, `ItemScreen.tsx`)

- The flow ignores an `answer` or `notSure` event for an item that already has an answer (a pure guard keyed by item id, unit-tested). This guard alone does not stop a physical bounce: in Standard and Deep the next item is current at once, and its handlers belong to an item that has no answer yet.
- **The lock outlives the item.** `ItemScreen` keys `ItemView` by question id and response count (`ItemScreen.tsx:76`), so the choices remount after every answer. The `board` lock lives on the app-level clock (KT-D5), not in the board, so the new item's board mounts locked for the rest of the window and shows no press look. `ItemView`'s `choose()` and `notSure()` also return early while `useTapLock().locked` is true (a click-path press, rule 9, goes through the same lock).
- The choices and Not sure are one `board` board; `choose()` also returns early once the current item is answered.
- Tests: the flow guard (unit); a render test of `ItemScreen` in Standard mode where two taps 150 ms apart land on the first item's choice and then on the next item's choice at the same place give one `answer` and one `placement.item_answered`, and a tap 450 ms later on the next item counts; the F6 e2e does the same with real touches across the transition.

### 6.5 Build a Letter (`BuildLetterGame.tsx`)

- A used tray tile stays disabled, as today (Tile `state="disabled"` renders a plain View): tapping it again does nothing, so a child who taps twice "to be sure" never loses the tile (the same rule as Pic-Word, KT-D6).
- A **filled slot** becomes a `TapTarget` with `gapFill={false}` and the accessible name `buildLetter.takeBack(name)` (the one new string, section 9; `name` is the tile's existing accessible label): a tap inside the slot removes that tile, the tiles after it shift left and their tray tiles are enabled again (the dead branch at `:98-101` moves to the slot). The slot is a separate place the child aims for, away from the tray, so a bounce on the tray never reaches it. `target` lock on the slot.
- During the 900 ms wrong reset the board is locked (`lock(900)`); taps then are swallowed instead of being accepted and wiped.

### 6.6 Hidden Heritage (`logic/hidden-heritage-flow.ts`, `HiddenHeritageGame.tsx`)

- New pure `spotHitRects(spots, sceneWidth)` returns, per spot, a hit rectangle and, per axis, whether it is **boxed**. Per spot and per axis, the drawn rectangle (`spotRect`) grows toward `touchTarget.min`. The room on each side ends at the scene edge or at the midline of the gap to the nearest spot on that side whose drawn rectangle overlaps this spot's span on the other axis. Growth is shared evenly between the two sides; when one side runs out of room, the rest goes to the other side. So a spot at the scene edge grows inward, never clamped short, and a spot with a neighbour on one side grows away from it. A final pass cuts any two hit rectangles that still overlap (diagonal neighbours) at the midline of the axis on which their drawn rectangles are farther apart, and gives what that cut took to the free side of the same axis where there is room. A hit rectangle is never smaller than its drawn rectangle, never overlaps another, and stays inside the scene.
- **Boxed: the one exception to 64.** A spot whose room is bounded on both sides of one axis (a neighbour's midline or the scene edge on each side) takes all the room between those bounds on that axis. The content rules (`HIDDEN_HERITAGE_SPOT`: 75 units, 11 apart) keep that at least the drawn size plus half the minimum gap: about 51.5 px at the 256 px narrow scene (48 + 3.5) and 58 at 288 (54 + 4); between two neighbours it is drawn + one gap (55 and 62). Such a spot is reported `boxed` on that axis.
- Unit tests: every hit rectangle reaches 64 on every axis where it is not boxed; a boxed axis equals exactly the room between its bounds; no two hit rectangles overlap; a spot at the scene edge grows inward to 64 when its other side is free; and for the shipped scenes at 288 and 256 px, the test lists every boxed spot. KT-6's PR body names any shipped spot that is boxed under 64, and a content row (outside this amendment) moves it; the e2e ratchet asserts 64 for every spot `spotHitRects` does not report boxed, and the computed room for those it does.
- No schema change: `HIDDEN_HERITAGE_SPOT.min` stays 75, so no content is re-authored by this amendment.
- Spots get the press look of 4.3 drawn as a ring on the spot's hit shape (`colors.border.shape`, `borderWidth.thick`, no fill, so the scene stays visible); the found ring is unchanged.
- In the narrow latch the horizontal scene ScrollView wraps its content in a `TapScroller` (axis `x`): a graze of up to 32 px on a spot counts in any direction; a sideways drag past 32 px scrolls the scene (board-driven), which is needed there; a vertical drag on a spot moves nothing.

### 6.7 Type Hangul keyboard (DS `HangulKeyboard`)

- One `TapBoard multiTouch="each" scroll="none"`; every touch is tracked by its identifier.
- A letter commits on that finger's release, for the key under the finger at release (it may have slid to a neighbour; the press look follows the finger); a release off the keyboard types nothing.
- A rollover types both letters in release order. A repeat on the same key (a letter, Delete or Space) within `KEY_BOUNCE_MS` (120 ms) is dropped, so three quick deletes 150 to 250 ms apart erase three jamo. Shift toggles only outside its 400 ms target lock. The keyboard neither sets nor reads the app-level lock.
- Hit cells stay edge to edge (the `padding: spacing.xxs` is inside each key's Pressable), so there is no dead line between keys.

### 6.8 Trace (`TraceStrokeGame.tsx`, `TraceWordGame.tsx`)

- `Gesture.Pan().minDistance(spacing.xs)`, with no `maxPointers` limit (RNGH fails or cancels the gesture when a limit is exceeded, so a resting palm would block tracing and a second touch would cut a stroke).
- **One finger draws.** The stroke follows one pointer, chosen by the Pan's touch callbacks (`onTouchesDown`, `onTouchesMove`, `onTouchesUp`, by pointer id): the first pointer that travels at least `spacing.xs` owns the stroke; pointers that stay still (a resting palm, a holding thumb) are ignored, and once a pointer owns the stroke every other pointer is ignored until it lifts. Stroke points come from the owning pointer's own position, never the Pan's averaged position. If the Pan's averaged activation gets in the way, KT-8 may use `Gesture.Manual()` with the same rules.
- `onFinalize(success)`: if the pan never activated, drop the one-point stroke `onBegin` started and call `strokeEnded()` when at least one stroke remains, so the idle check re-arms; if it activated, `onEnd` already ended it. Unit-tested on the evaluator, render-tested on the screen.

### 6.9 Learner non-game Pressables (KT-9)

- Home cards, Journey cells, Library tiles, the tab bar, the KoreanText and game speakers, HoyaBubble, WhoSwitch, vocab TopicTile and WordWall, and the help sheets: `usePressGuard()` (the Button guard of 4.4 as a hook) and `delayPressIn={0}`. A control that moves nothing (a speaker replays a sound) uses `usePressGuard({ setsLock: false })`: it still drops its own repeat and waits for the app lock, but tapping it never locks the answers.
- Where a visible target is under 64 and relies on `hitSlop`, the slop becomes real padding inside the Pressable (visual size kept), so the web hit area reaches 64.
- A scan test fails if a file under `screens/minigames/`, `screens/quest/`, `screens/placement/` or `screens/vocab/` puts an answer `onPress` on a raw `Pressable` outside a `TapBoard` (an allow-list names speakers and controls).

### 6.10 Presenter Stage (KT-10)

- **Touch only.** A new `TAP_SLOP_TOUCH = spacing.xl` (24) applies to touch gestures (`pointer === 'touch'`, a pen counts as touch); `TAP_SLOP` stays `spacing.md` (12) for the mouse, so a 12 to 23 px mouse drag on a target-free slide still does not step Next. The swipe distance (60), the edge guard, two-finger behaviour (a teacher's two-finger touch is deliberate), the rail and the quiz options' own responder stay.
- Stated side effects, all intended (a touch that moved 12 to 23 px now counts as the tap it was): such a touch on empty stage area toggles the bar in the overlay layout or rings Next (it never steps; a touch tap never steps); with More open it closes More; on an option, when pointing is on, it points at that option. `stageStepSource` is unaffected for touch (a touch step is always a swipe). KT-10 adds stage-gesture tests at 12, 20 and 23 px for touch (tap) and mouse (not a tap) and keeps `TAP_SLOP` = `spacing.md`.

## 7. Accessibility

- Every answer stays a focusable `button` with its existing accessible name; selection and disabled states stay in `accessibilityState`. Keyboard Enter and Space and screen-reader activation commit through rule 9. A filled Build a Letter slot becomes a new focusable button (section 6.5) with its own name (section 9).
- 64 x 64 floor for every answer target at 320 px with the largest text (KT-D8), checked by the extended ratchet (section 11); the one stated exception is a boxed Hidden Heritage spot axis (section 6.6), asserted at its computed room.
- Reduced motion: the press look has no scale. No new motion.
- `touch-action` keeps pinch zoom everywhere except a fitting board on a browser without `pinch-zoom` support (U1); the app's text-size setting is unaffected.

## 8. Telemetry and privacy

No new event and no new field. `placement.item_answered` fires once per item (F6). Nothing is stored.

## 9. Strings

One, in KT-6: the accessible name of a filled Build a Letter slot, `learner.minigame.buildLetter.takeBack(name)` (screen readers only; the slot shows the jamo). Proposed values, reviewed by the MAR in that PR: en `Take back ${name}`, es `Quitar ${name}`, ko `${name} 빼기`. Card Match keeps its order, so `cardMatch.instruction` ("Tap a Korean word, then its English meaning.") stays true in all three languages. Any other row that finds it needs a string adds en, es and ko in the same PR.

## 10. Unverified assumptions (checked in KT-12)

- **U1** iOS Safari honours `touch-action: pinch-zoom` (the board feature-detects and falls back to `none` on a fitting board).
- **U2** VoiceOver (iOS Safari) and TalkBack (Chrome) activation reaches `TapTarget` as a click with no board release before it, so it commits once.
- **U3** On native iOS and Android, the capture responder keeps the `Pressable` children from claiming the touch, and `scrollEnabled={false}` on a fitting `Screen` with a board stops a short drag from becoming a scroll. On a native `Screen` that scrolls, how often the native ScrollView takes a 10 to 32 pt vertical graze on a target before the board can scroll it (section 5) is measured on the Xcode build; if it is common, a follow-up turns `scrollEnabled` off while a target touch is live.
- **U5** A board-driven scroll with `FLING_DECAY` feels close enough to the browser's own scroll on a real phone (Android Chrome, iOS Safari) that a child does not notice the difference; KT-12 checks it and may tune `FLING_DECAY` (a logic constant).
- **U4** A real Android Chrome long press on a board (no `onLongPress` anywhere) shows no context menu or text selection (the shell already sets `user-select: none`).

## 11. Tests

### 11.1 Unit (vitest; TZ=UTC)

| File | Covers |
|---|---|
| DS `__tests__/tap-model.test.ts` | constants equal their tokens; T1-T20 on the pure reducer (down, gap fill, ties, controls and `gapFill={false}`, inside by reach and by travel, a slide onto a neighbour, the scroll turn and fling, release, cancel, latest finger and resting touches, `each` mode, echo window, `board` and `target` locks, `lock(ms)`, a lock that outlives a remount) |
| DS `components/TapBoard/__tests__/TapBoard.test.tsx` | capture responder claims only claimed touches; commit on the owning finger's `onResponderEnd`; termination refused for a transfer and `contextmenu`, accepted for `scroll` and `selectionchange`; a scroller offset change cancels; board-driven scroll calls `scrollBy`; the native rect cache refreshes after layout, scroll end and a fit change (a stale cache is re-measured); `TapControl`; `touch-action` on the board and on every target |
| DS `components/TapBoard/__tests__/TapLockProvider.test.tsx` | a `board` commit locks a board mounted 320 ms later until 400 ms; `useTapLock` outside any board; `lock(ms)` extends; a board with no provider keeps its own clock |
| DS `components/Screen/__tests__/screen-fit.test.tsx` | `fits` from layout and content size; `manipulation` on the content; the `TapScroller`; native `scrollEnabled` turns off only with a fitting Screen that holds a board and no focused `TextInput`; a Screen with no board never changes |
| DS `ChoiceCard`, `Tile`, `Button` tests | press look of 4.3 (never focus blue); Button guard: own repeat dropped, app lock respected and set |
| DS `HangulKeyboard` test | rollover types both in release order; slide to a neighbour types the neighbour; a letter, Delete and Space each drop a repeat within 120 ms and accept one at 150 ms (three deletes 150 ms apart erase three); Shift lock 400 ms |
| `logic/__tests__/pic-word-flow.test.ts` | a second tap keeps the selection (F2) |
| `screens/minigames/__tests__/CardMatchGame.test.tsx` | fake timers: the stale flash does not clear a new pick (F3); a meaning tapped first is still a no-op and scores nothing; unmount clears both timers; 64 floor |
| `logic/sentence-builder/__tests__/reducer.test.ts` and the Sentence Builder render test | the window is `TAP_LOCK_MS`; return lock; a Skip press 100 ms after a tray commit is ignored (F5) |
| `logic/placement/__tests__/flow.test.ts` | a second answer for an answered item is ignored (F6) |
| `screens/placement/__tests__/ItemScreen.test.tsx` | the app lock survives the keyed `ItemView` remount: two taps 150 ms apart across the transition give one answer; a tap after `TAP_LOCK_MS` counts (F6) |
| `screens/quest/__tests__/quest-review-chunk.test.tsx` | Daily Review: a right answer, then a tap at 350 ms on the next round's card in the same place records no first-try answer; a tap at 450 ms does |
| `screens/minigames/__tests__/BuildLetterGame.test.tsx` | a used tray tile stays disabled (a repeat tap does nothing); a tap on a filled slot takes that tile back and shifts the rest; a touch 3 px outside a filled slot does not reach it; taps during the 900 ms reset are swallowed |
| `logic/__tests__/hidden-heritage-flow.test.ts` | `spotHitRects` (6.6): 64 where not boxed, boxed room exact, no overlap, edge spots grow inward, shipped scenes' boxed list |
| `logic/__tests__/trace-evaluator.test.ts` and the Trace screen tests | non-activated touch re-arms; no ink; a resting palm first, then a finger: the finger draws; a second touch mid-stroke neither cancels nor moves the stroke |
| `logic/lecture/__tests__/stage-gesture.test.ts` | `TAP_SLOP_TOUCH` = `spacing.xl`, `TAP_SLOP` = `spacing.md`; 12, 20 and 23 px: a tap for touch, not a tap for the mouse |
| scan test (KT-9) | no raw answer `Pressable` outside a board in the learner game folders |

### 11.2 Playwright touch (`e2e/web/touch.ts` helper from KT-3, CDP `Input.dispatchTouchEvent`)

- Profiles: 320 x 640 with `hasTouch` and `isMobile` and the largest text size; 820 x 1180 tablet. `STORY_FIXTURES=1`. Touch behaviour does not depend on the UI language; the suites run in en, and the 320 px target ratchet runs in en, es and ko (the longest labels).
- **Graze matrix** on each board (KT-11 runs all; each row adds its own boards): moves of 0, 8, 16, 24 and 32 px on both axes commit, on a fitting board **and** on a scrolling one (at 320 px with the largest text, Pic-Word scrolls); a move that ends 40 px outside the target commits nothing and leaves no press look; a slide from one card into its neighbour commits nothing; on a scrolling board a 72 px vertical drag from a target scrolls the page and changes nothing.
- **Bounce**: two taps 60 and 150 ms apart, measured from the first release to the second touch-down, give one commit. The 300 ms case is a unit test with fake timers only (in CI the dispatch can slip by more than the 100 ms margin).
- **Two fingers**: the later finger on a target commits and the earlier does not; a thumb resting on a bottom tile while another finger taps an answer: the answer commits, and the thumb's later lift commits nothing.
- **Hold** 900 ms commits.
- **Regressions**: F1 (Pic-Word: a 20 px vertical graze selects, on the scrolling 320 px largest-text profile), F2 (bounce stays selected), F3 (Card Match next pick stays selected after 700 ms), F4 (Story Sequence bounce: no miss line), F5 (Sentence Builder bounce at 100 and 200 ms: no miss, no skip), F6 (placement: two real taps 150 ms apart across the item transition give one `placement.item_answered`), Daily Review (a bounce across the 320 ms advance gives no answer on the next item), F7 (keyboard rollover types two letters; 18 px slide types the key), F8 (Hidden Heritage hit areas at least 64 at 320 px where not boxed), R3 (bounce on a locked wrong tile: one miss).
- **Target ratchet**: `e2e/web/target-size.spec.ts` and `target-audit.ts` extend to every game screen at 320 px with the largest text; the check uses each board's hit rectangles where they differ from the drawn box (Hidden Heritage, with the boxed rule of 6.6).
- **Fit audit** (report only): which game screens fit at 320 x 640 at default and largest text. Grazes no longer depend on fit; a screen that fits additionally keeps gap touches safe from a vertical pan.
- WebKit (`E2E_WEBKIT=1`, iPhone 13): the graze, bounce and two-finger cases once, for U1.

## 12. Rows (implementation PRs; each adds the tests of section 11 for what it touches)

| Row | Content | Size | Depends on |
|---|---|---|---|
| **KT-0** (this PR) | `docs(specs,design)`: this amendment; `design/components/TapBoard/spec.md`; pointer lines in F-001, F-003, F-004, F-010, F-QUEST-002, F-CURR-001, F-CURR-002, F-PLC-001, F-STORY-003, F-TCH-004, `design/components/ChoiceCard/spec.md`; README index | S | — |
| **KT-4a** (bounce and timer half of the complaint, first) | `fix(mobile)`: Pic-Word without the toggle (6.1); Card Match timer in a ref, `minHeight`, button role, completion timeout cleared, Korean card first as today (6.2, without the board) | S | KT-0 |
| **KT-1** | `feat(design-system)`: `tap-model.ts`, `TapBoard`, `TapTarget`, `TapControl`, `TapScroller`, `TapLockProvider` and `useTapLock`, `usePressGuard`; `Screen` fit, scroller, `manipulation` and opt-in native `scrollEnabled` (sections 3 to 5); the provider mounted in the app root; component index exports | M | KT-0 |
| **KT-2** | `feat(design-system)`: ChoiceCard, Tile, Button adoption and the press look (4.3, 4.4); web-dead `hitSlop` removed from ChoiceCard and Tile; ChoiceCard component spec "Pressed" text | M | KT-1 |
| **KT-3** | `fix(mobile)`: the pick-one boards (Listen & Pick, Read Pick, Cloze Pick, Cloze Realia, Realia Read, Match Sound, Odd One Out, Culture Quiz, Tap Respond, Story Check, Daily Review, vocab question, Speed Round); the 50 ms windows become `TAP_LOCK_MS`; locked wrong tiles disabled (R3); in-board speakers wrapped in `TapControl`; `e2e/web/touch.ts` and the F1, R3 and Daily Review regressions | M | KT-2 |
| **KT-4b** | `fix(mobile)`: Pic-Word and Card Match on `target` boards; TileFrame padding inside the target; the F2 and F3 e2e | S | KT-2, KT-4a, KT-3 (helper) |
| **KT-5** | `fix(mobile)`: Story Sequence, Story Order, Sentence Builder (Skip and the return lock), Placement (flow guard and board); the F4, F5, F6 e2e | M | KT-2, KT-3 (helper) |
| **KT-6** | `fix(mobile)`: Match Shape, Syllable Build, Build a Letter (6.5, with the `takeBack` string in en, es and ko), Hidden Heritage (6.6), Role Play, Voice Echo, Write Frame word pick, My Story; the F8 e2e | M | KT-2, KT-3 (helper) |
| **KT-7** | `feat(design-system)`: HangulKeyboard multi-touch (6.7); the F7 e2e | S | KT-1, KT-3 (helper) |
| **KT-8** | `fix(mobile)`: Trace and Trace a Word (6.8) | S | KT-0 |
| **KT-9** | `fix(mobile,design-system)`: learner non-game Pressables (6.9) and the scan test | M | KT-2 |
| **KT-10** | `fix(mobile)`: presenter `TAP_SLOP_TOUCH` (6.10) | S | KT-0 |
| **KT-11** | `test(mobile)`: the full graze, bounce and two-finger matrix over every board at 320 and tablet; the target ratchet on every game (en, es, ko); the fit audit; the WebKit pass | M | KT-3, KT-4b, KT-5, KT-6, KT-7, KT-8 |
| **KT-12** (owner-assisted device check, does not block merges) | `docs(tests)`: a short report of U1-U5 on a real Android phone in Chrome, an iPhone in Safari and as the installed PWA, and the Xcode iOS build: Pic-Word graze (fitting and scrolling), a board-driven scroll and fling, Story Sequence bounce, keyboard rollover, Trace dot and palm, a VoiceOver pick | S | KT-11 |

**Order.** KT-4a first: it fixes the **bounce and timer half** of the owner's "selected, then let go" (Pic-Word's tap-again toggle, F2; Card Match's stale timer, F3) and needs no new component. It does **not** fix the graze half (F1: a graze that shows the press look and then counts for nothing); that lands with KT-1, KT-2 and KT-3 (pick-one boards) and KT-4b (Pic-Word and Card Match), and progress reports to the owner say so. KT-1 then KT-2. KT-3 next (it brings the touch helper); KT-4b, KT-5, KT-6 and KT-7 in parallel after it; KT-8 and KT-10 at any time; KT-9 after KT-2; KT-11 last; KT-12 when the owner has a device at hand. **Total:** 14 rows (KT-0 included; KT-12 owner-assisted), no migration, no Worker change, one new screen-reader string (KT-6).

## 13. Edits to the amended specs (pointer lines in this PR; behaviour in the rows named)

- F-001 §3.4: the 50 ms rule is replaced by the latest-finger rule (KT-D4) and the 400 ms lock (KT-D5).
- F-003: a placed tile can be taken back by tapping its filled slot; the used tray tile stays disabled (6.5).
- F-004: Trace activation, one moving finger draws, finalize (6.8).
- F-010: Odd One Out's locked wrong tile is disabled; Culture Quiz is on a board (KT-3).
- F-QUEST-002: Listen & Pick on a board; Pic-Word Match without the toggle (6.1).
- F-CURR-001: Sentence Builder (6.3), the Type Hangul keyboard (6.7), Trace a Word (6.8).
- F-CURR-002: Card Match (6.2), Match Shape, Syllable Build, Hidden Heritage hit areas (6.6), Cloze Pick, Daily Review.
- F-PLC-001: one answer per item (6.4).
- F-STORY-003: Story Sequence, Story Order and the checks on boards; the ChoiceCard press look (4.3).
- F-TCH-004: presenter touch tap slop 24, mouse slop 12 (6.10).
- `design/components/ChoiceCard/spec.md`: the pressed look (4.3), applied in KT-2.

## 14. Review log

- 2026-10-31, author pass against `1bfda3fc8`: confirmed in code every `file:line` the audit gave for F2, F3, F6, R1, R2 and R3, the web-dead `hitSlop` list (RN-web 0.19.13 forwards no `hitSlop`; `PressResponder.js` commits from `onClick` only), the 15 px RNGH web slop, the `Screen` default and the postbuild `touch-action`. Added to the audit: Odd One Out shares R3 (Culture Quiz and Tap Respond already disable a locked wrong answer); Trace's `onBegin` leaves a one-point stroke when the pan never activates; Build a Letter accepts and then wipes taps during the 900 ms reset; DS Button has no double-fire guard (R8); ChoiceCard's press colour equals the `hint` border, which is why a press reads as a state.
- 2026-10-31, review on PR #930: in Standard and Deep the keyed `ItemView` (`ItemScreen.tsx:76`) remounts after every answer, so a board lock inside it would reset exactly when a bounce arrives, and the answered-item guard does not stop a tap on the next item. Section 6.4 now puts the lock above the item and seeds the new item's board from it; sections 11.1 and 11.2 test two real taps across the transition.
- 2026-10-31, second review round on PR #930 (child usability; correctness and native parity). Accepted: (1) a vertical graze on a scrolling board was still lost (Pic-Word scrolls at 320 px with the largest text): every target is now `pinch-zoom` and the board scrolls its scroller itself after `TAP_TRAVEL` (KT-D3, rule 5, section 5), and the graze matrix and T15 cover 16 to 32 px vertical grazes on scrolling boards; (2) the lock was lost on keyed per-round remounts other than Placement (Daily Review advances after 320 ms): the `board` lock now lives on one app-level clock (`TapLockProvider`, KT-D5, rule 10), which also covers Skip outside the tray and a screen change after Continue; (3) Build a Letter's tap-again-to-remove on the tray tile brought back the F2 pattern: the used tray tile stays disabled and only the filled slot takes a tile back, and take-back targets are out of gap fill (`gapFill={false}`); (4) Hidden Heritage could stay under 64 under the clamp and midline rules: growth is now asymmetric (edge spots grow inward) and the one exception, a boxed axis, is stated with its minimum and asserted as such; (5) a resting thumb owned the board: the latest finger on a target now takes it and the earlier touch never commits (KT-D4, T9, T9b); (6) a slide onto a neighbour committed the first card: rule 4 now treats a point inside another enabled target as outside (T17); (7) Delete and Space now use `KEY_BOUNCE_MS`, not the 400 ms lock; (8) the order note now says KT-4a fixes only the bounce and timer half; (9) the termination rule could let a scroll-drag commit on the web (RN-web does not listen to `pointercancel`, and an ancestor scroll ends a responder only through the termination request): the board now accepts `scroll` and `selectionchange` and cancels on any scroller offset change it did not drive, and section 1.1's citation is corrected; (10) Card Match "either side first" was a rule change that turns safe Korean-card audio taps into scored attempts and contradicts the en, es and ko instruction: dropped; (11) native `scrollEnabled={false}` on every fitting Screen would have locked forms under the iOS keyboard: it is now opt-in (a registered board, no focused `TextInput`); (12) a synchronous capture call cannot wait for `measureInWindow` on the old architecture: native reads a cache refreshed on layout, scroll end and fit change; (13) `maxPointers(1)` fails the Pan when a palm rests: the stroke now follows the first moving pointer and ignores the rest; (14) the 300 ms e2e bounce had a thin margin: e2e uses 60 and 150 ms measured release-to-down, 300 ms stays in unit tests; (15) the presenter slop change now applies to touch only and its side effects are listed; (16) KT-D10 now states that gap fill and grazes add scored answers as the intended effect of the forgiving tap, and rule 2 says how controls are detected. Rejected: none.
