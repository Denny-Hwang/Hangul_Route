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
- Every new or changed English UI string lands with es and ko in the same PR. This amendment adds **no** UI string (section 9).
- Anti-shame: amber, never red; nothing here adds a failure state.

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | **A graze looks chosen, then nothing counts.** Every learner answer is an RN `Pressable` whose `onPress` comes from the browser's `click` (RNW `modules/usePressEvents/PressResponder.js:296-311`). The browser drops that click when the finger slides about 15 px, when it starts a pan (`pointercancel`), or when a second finger is down. The pressed look turns on after 50 ms (`PressResponder.js:74`) and turns off on the cancel: the owner's "selected, then let go". | One **forgiving tap** (KT-D1): the answer commits on the finger's **release**, decided by our own responder, not by the browser's click. A release within 24 px of the target, or after at most 32 px of travel, counts. Answer boards that fit the screen stop the browser from panning (`touch-action: pinch-zoom`), so a graze is never cancelled. |
| 2 | **A bounce or a double tap counts twice.** Pic-Word un-selects a tile tapped again (`logic/pic-word-flow.ts:117-123`); Story Sequence, Story Order and Sentence Builder score the card or tile that reflows under the finger as a miss; Sentence Builder's Skip can slide under the second tap; the level check answers the next item blind (`screens/placement/ItemScreen.tsx:197-203`). The existing guard is 50 ms (F-001 §3.4); a child's bounce is 60 to 300 ms. | A **400 ms lock after every commit** (KT-D5), per board where the commit moves things, per target where it does not. Pic-Word's tap-again-to-unselect goes (KT-D6). |
| 3 | **A selection disappears on its own.** Card Match's 600 ms wrong-flash timer is never cleared and un-selects the next pick (`screens/minigames/CardMatchGame.tsx:107-115`). | The timer is kept in a ref and only clears the selection it was set for (KT-D6). |
| 4 | **Targets under the floor and dead zones.** Card Match's English cards are 51 px tall at 320 px; Hidden Heritage spots 54 to 62 px; `hitSlop` does nothing on the web (RNW drops the prop), so the gaps between tiles are dead. | Card Match cards get `minHeight: touchTarget.min`; Hidden Heritage spots get a hit area of at least 64 px without overlapping (KT-D8); the board fills gaps to the **nearest** target (KT-D1 rule 2), which replaces `hitSlop` on the web. |
| 5 | **Two fingers lose both.** A resting palm or a second finger cancels the first finger's tap; on the keyboard a rollover loses both letters. | The first finger owns the board; later fingers are ignored and cancel nothing (KT-D4). The keyboard takes each finger on its own (KT-D7). |
| 6 | **Trace forgets to check.** A touch shorter than RNGH's 15 px pan activation (`RNGH web/constants.js:1`) cancels the idle check and never re-arms it; a palm joins the stroke. | The pan activates at 4 px, takes one pointer, and a touch that never became a stroke leaves no ink and re-arms the check (KT-D9). |
| 7 | **No proof.** Every game e2e uses `.click()` or `.tap()` with zero movement; the touch-target ratchet covers four non-game screens. | A touch e2e suite (grazes, bounces, two fingers) on every board at 320 px and tablet, and the target ratchet on every game at 320 px with the largest text (section 11). |

## 1. What was measured

One read-only audit on a scratch worktree of `origin/main` `1bfda3fc8` (no commits; probe specs outside the repo). Build: `build:web:fixtures` (`dist-e2e`), `STORY_FIXTURES=1`, Playwright Pixel 5 profile (`hasTouch`, `isMobile`), raw CDP `Input.dispatchTouchEvent` for grazes, bounces and two-finger touches.

### 1.1 How a selection commits today

- Every learner target is an RN `Pressable` with `onPress`. No game commits on `onPressIn` or `onPressOut`; the only `onPressIn` users are the presenter ControlBar's focus bookkeeping (`screens/presenter/ControlBar.tsx:200,560,923`).
- On the web (the PWA, the main platform), RN-web calls `onPress` only from the native `click` (RNW `PressResponder.js:296-311`). A browser pan sends `pointercancel`, which terminates the responder (RNW `modules/useResponderEvents/ResponderSystem.js:321-332`).
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
- **KT-D2. One shared primitive** in the design system: `TapBoard` (owns the touches of an answer area), `TapTarget` (one answer inside it) and `useTapLock` (read the lock from outside the board), with the pure model in DS `tap-model.ts` (section 4; component spec `design/components/TapBoard/spec.md`).
- **KT-D3. Scrolling never steals a tap on a board that fits.** `Screen` publishes whether its content fits; a board that fits sets `touch-action: pinch-zoom` (no browser pan, pinch zoom kept), a board that scrolls sets `pan-y pinch-zoom` (horizontal grazes never cancel). `Screen` sets `touch-action: manipulation` on its content (no double-tap zoom, no click delay; R5). On native, a fitting `Screen` turns `scrollEnabled` off (R6). Section 5.
- **KT-D4. The first finger owns the board.** Later fingers on the same board are ignored and cancel nothing; when the first finger lifts, the board decides its tap and ignores the others until they lift. The keyboard is the one exception (KT-D7).
- **KT-D5. Lock after commit: 400 ms** (`TAP_LOCK_MS`). Scope `board` where a commit moves, removes, reveals or advances anything (the second tap would land on something else); scope `target` where it does not (pairing games, where tapping two different tiles quickly is a real move). The 50 ms windows of F-001 §3.4 become this lock.
- **KT-D6. A selection only changes by a deliberate act.** A cancel never changes state. A repeat tap on the selected tile keeps it selected (Pic-Word drops its toggle). A game that lets the child take something back (Syllable Build zone, Build a Letter slot, keyboard Shift) does so only on a tap outside that target's lock. Timers clear only the state they were set for.
- **KT-D7. The keyboard takes each finger on its own** and types the key under the finger at release (the standard on-screen keyboard rule, so the press look follows the finger); letter keys ignore a repeat on the same key within `KEY_BOUNCE_MS` (120 ms, `motion.duration.fast`); Shift has the target lock.
- **KT-D8. Every answer target reaches 64 x 64** at 320 px with the largest text: Card Match cards get `minHeight`; Hidden Heritage spots get a separate hit rectangle (`spotHitRect`, section 6.6) with no schema or content change.
- **KT-D9. Drag thresholds.** Trace activates at 4 px (`spacing.xs`), takes one pointer, and a touch that never activates leaves no ink and re-arms the idle check. There is no drag-and-drop game; every other game is tap-only.
- **KT-D10. Scoring.** Nothing about what counts as right or wrong changes. The only score effects are removals of phantom answers: the reflow misses (F4, F5), the skip under a bounce (F5), the blind placement answer (F6), extra misses on a locked wrong tile (R3), the forced wrong attempt in Build a Letter (R2), and Card Match accepting the meaning side first (F3; the round key is still the Korean card of the attempted pair).
- **KT-D11. The press look is never a state look.** It is a "pushed in" look, a thick `border.shape` outline and a slight shrink (section 4.3), different from selected, hint, focus and correct, so a touch that does not count can never look chosen.

## 3. The tap model (DS `tap-model.ts`, pure, 100 % unit-tested)

### 3.1 Constants (pinned by `tap-model.test.ts`; the spacing ones equal their tokens)

| Name | Value | Meaning |
|---|---|---|
| `TAP_TRAVEL` | 32 (`spacing.xxl`) | A release still counts after the finger travelled this far from where it went down, wherever it is |
| `RELEASE_REACH` | 24 (`spacing.xl`) | A release still counts this far outside the target the finger went down on |
| `GAP_REACH` | 16 (`spacing.lg`) | A touch that lands in a gap goes to the nearest target within this distance |
| `TAP_LOCK_MS` | 400 | After a commit, taps in the lock's scope are swallowed (a child's bounce is 60 to 300 ms) |
| `CLICK_ECHO_MS` | 700 | The browser's `click` after a pointer release the board already handled is ignored |
| `KEY_BOUNCE_MS` | 120 (`motion.duration.fast`) | Keyboard: a repeat on the same letter key within this is a bounce |

No press delay: the press look shows on the first touch frame. No long-press action exists on any learner answer target, so a hold of any length still commits on release.

### 3.2 Rules

1. **Down.** The board hit-tests the point against its targets' rectangles (read at touch start: `getBoundingClientRect` on the web, `measureInWindow` on native).
2. **Gap fill.** A point inside no target goes to the target whose rectangle is nearest, if that distance is at most `GAP_REACH` and no other target is within 1 px of the same distance (a tie is nobody's). A point near no target is not claimed: it falls through to whatever is under it. A point on any other control inside the board (a speaker, a hint button) is never claimed, even within `GAP_REACH` of a target: the board hit-tests real controls before it fills gaps.
3. **Press look.** A claimed touch on an enabled, unlocked target shows that target's press look at once. A locked or disabled target is claimed (so the touch cannot reach anything else) but shows nothing and commits nothing.
4. **Move.** The touch stays "inside" while the point is within `RELEASE_REACH` of the down target's rectangle **or** within `TAP_TRAVEL` of the down point. The press look shows exactly while it is inside. On a non-keyboard board the target never changes during a touch.
5. **Release** of the owning finger inside: **commit** the down target once, then start the lock (KT-D5). Released outside: nothing, and the press look is already off.
6. **Cancel** (responder terminated, `pointercancel`, a pinch starting, the app hidden): press look off, nothing else. A cancel never changes selection, score or focus.
7. **Other fingers** (KT-D4): ignored on every board but the keyboard.
8. **Click echo.** `TapTarget` keeps an `onPress` for clicks that come with no touch: keyboard Enter or Space, a screen reader's activate, switch access, a mouse where the responder did not see the press. Such a click commits through the same path and lock. A click within `CLICK_ECHO_MS` after a release the board handled (committed or not) is dropped, so a mouse or a touch never commits twice.
9. **Lock.** `board` scope: every target of the board is locked until `now + TAP_LOCK_MS`. `target` scope: only the committed target. A game may extend the board lock (Sentence Builder's slide back, Build a Letter's 900 ms reset) through `lock(ms)`.

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
| T9 | any board | finger 1 down on A, finger 2 down on B 40 ms later, finger 1 lifts, finger 2 lifts | A commits, B does not (e2e) |
| T10 | any board | down on A, hold 900 ms, lift | A commits (e2e) |
| T11 | any board | down on A, responder terminated | no commit, no state change, no press look |
| T12 | any board | touch release commits A, then the browser's click on A 30 ms later | one commit |
| T13 | any board | keyboard focus on A, Enter | A commits once; the lock starts |
| T14 | a scrolling board (`pan-y`) | 20 px horizontal graze on A | A commits (e2e) |
| T15 | a scrolling board | 40 px vertical drag starting on A | the page scrolls; A does not commit and nothing changes (e2e) |
| T16 | a disabled target (locked wrong tile) | tap | nothing; no haptic, no replay, no `answerRound` (R3) |

## 4. Components

### 4.1 `TapBoard` (DS `components/TapBoard/`)

Props: `lock: 'board' | 'target'` (required, section 6 names each surface's), `scroll?: 'auto' | 'x' | 'none'` (default `auto`: from the `Screen` fit; `x` for a board inside its own horizontal ScrollView; `none` for a board outside any ScrollView, such as the keyboard), `multiTouch?: 'first' | 'each'` (default `first`; `each` only for the keyboard), `disabled?`, `testID?`, `children`.

- Owns the responder by **capture** (`onStartShouldSetResponderCapture` returns true only for a touch rule 2 claims), so the `Pressable` inside each target never gets the touch on any platform; it keeps role, focus and keyboard activation.
- Refuses termination requests while a press is live (`onResponderTerminationRequest` returns false); a browser pan or a native scroll can still terminate it, which rule 6 handles.
- Commits on `onResponderEnd` for the owning finger, not on `onResponderRelease` (which waits for every finger), as `screens/presenter/Stage.tsx:202-214` already reads touches.
- Web style: `touch-action` per KT-D3 (`scroll="auto"`: `pinch-zoom` when the `Screen` fits, else `pan-y pinch-zoom`; `x`: `pan-x pinch-zoom`; `none`: `pinch-zoom`). If `CSS.supports('touch-action', 'pinch-zoom')` is false (older iOS), a fitting board uses `none` (assumption U1).
- Exposes `useTapLock(): { locked: boolean; lock(ms: number): void }` through context for controls outside the board that must respect it (Sentence Builder's Skip).

### 4.2 `TapTarget`

Props: `onCommit: () => void`, `disabled?`, `accessibilityLabel` (required), `accessibilityState?`, `testID?`, `children: (look: { pressed: boolean }) => ReactNode`.

- Renders a `Pressable` with `accessibilityRole="button"` whose `onPress` is the click path of rule 8, and registers its node with the board.
- Outside a `TapBoard` it behaves as a plain `Pressable` with the KT-2 Button guard (section 4.4), so a design-system component can use it everywhere.

### 4.3 The press look (KT-D11; replaces ChoiceCard's focus-blue press border and Tile's scale 1.04)

- Border `colors.border.shape` at `borderWidth.thick` (at least 3:1 on canvas, paper, sunken and `brand.primaryLight`, so it shows on every fill), fill unchanged, scale 0.97 (under reduced motion no scale: the border alone). Instant, no transition.
- Never `colors.border.focus` (focus ring and `hint`), never `colors.brand.primary` (Pic-Word's selection ring), never `colors.brand.primaryLight` (Card Match's selected fill), never `colors.surface.sunken` (the `disabled` fill), never a feedback colour.
- Shown at once on down, only while the touch is inside (rule 4). On a locked or disabled target, never.

### 4.4 DS adoptions (KT-2)

- **ChoiceCard** and **Tile** paint the press look of 4.3 and render through `TapTarget` (in a board they join it; outside one they keep today's behaviour plus the guard). Their web-dead `hitSlop` is removed; on native the board's gap fill replaces it inside boards, and outside boards they are already at least 64.
- **Button**: the press look shows without RN-web's 50 ms delay (`delayPressIn={0}`), and a per-button guard ignores a second `onPress` within `TAP_LOCK_MS` (R8). Its `hitSlop` stays (native only, harmless); the web size is already at least 64.
- `design/components/ChoiceCard/spec.md` "Pressed" text and the Tile notes are updated in KT-2.

## 5. Scrolling, zoom and native (KT-D3)

- `Screen` measures fit (`onLayout` of the ScrollView and `onContentSizeChange`; fits when content height is at most the viewport height + 1) and publishes `{ fits }` through `ScreenFitContext`. It re-measures on text size changes and rotation.
- `Screen` sets `touch-action: manipulation` on its scroll content on the web. The `pwa-postbuild.mjs` comment "Pinch-zoom stays enabled" stays true: `manipulation` and `pinch-zoom` both keep pinch zoom.
- On native, a `Screen` that fits sets `scrollEnabled={false}`, so a ScrollView cannot take a short drag from a board (R6). It turns back on when content grows.
- A board that scrolls keeps `pan-y`: a vertical drag longer than the browser's own slop (about 15 px) is a scroll and is not a tap (T15). This is the one graze that still does not count, and it is the right answer when the board does not fit. Every game that can fit at 320 x 640 should (section 11, the fit audit).

## 6. Surface by surface (after)

| Surface | Board, lock | Changes | Fixes | Row |
|---|---|---|---|---|
| Listen & Pick | answers, `board` | ChoiceCards join the board; `touchWindowMs` becomes `TAP_LOCK_MS` | F1 | KT-3 |
| Read Pick, Cloze Pick, Cloze Realia, Realia Read | answers, `board` | same; Cloze Pick's own Pressable becomes a `TapTarget` | F1 | KT-3 |
| Match Sound, Odd One Out | tiles, `board` | a locked wrong tile is `disabled` (same wrong look, `accessibilityState.disabled`) | R3, F1 | KT-3 |
| Culture Quiz, Tap Respond | answers, `board` | Buttons inside a board use `TapTarget` | F1 | KT-3 |
| Story Check, Daily Review | answers, `board` | as Listen & Pick | F1 | KT-3 |
| Vocab question, Speed Round | answers, `board` | `question-flow.ts` window becomes `TAP_LOCK_MS` | F1 | KT-3 |
| Pic-Word Match | two boards, `target` | no toggle (6.1); TileFrame's 4 px padding moves inside the target | F1, F2 | KT-4a, KT-4b |
| Card Match | two boards, `target` | 6.2 | F3, R4 | KT-4a, KT-4b |
| Story Sequence, Story Order | cards, `board` | the lock covers the reflow | F4 | KT-5 |
| Sentence Builder | tray, `board` | 6.3 | F5 | KT-5 |
| Placement | choices + Not sure, `board` | 6.4 | F6 | KT-5 |
| Match Shape | board, `board` | press look | R4 | KT-6 |
| Syllable Build | tiles and zones, `target` | clearing a filled zone only outside that zone's lock | F1 | KT-6 |
| Build a Letter | tray and slots, `target` | 6.5 | R2 | KT-6 |
| Hidden Heritage | scene, `board`; `scroll="x"` in the narrow latch | 6.6 | F8, R4 | KT-6 |
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
- Either side may be picked first. State becomes `selected: { side: 'ko' | 'en'; idx }`; a second tap on the same side moves the selection; a tap on the other side attempts the pair. `answerRound` keeps the key and payload of the Korean card of the attempted pair, so first-try scoring reads the same rounds.
- Both columns: `TapTarget` (button role, the existing labels), `minHeight: touchTarget.min`, the press look, `target` lock.

### 6.3 Sentence Builder (`logic/sentence-builder/reducer.ts`, `SentenceBuilderGame.tsx`)

- `TOUCH_WINDOW_MS` becomes `TAP_LOCK_MS`; the tray is a `board` board, so the tile that slides under a bounce is not tapped (F5 at 200 ms).
- **Skip** reads `useTapLock()` and ignores a press while the board is locked, with no visual change (F5 at 100 ms).
- While a missed tile slides back (`RETURN_MS`, 520 ms), the tray calls `lock(RETURN_MS)`: no press look shows on a tile that cannot be tapped.

### 6.4 Placement (`logic/placement/flow.ts`, `ItemScreen.tsx`)

- The flow ignores an `answer` or `notSure` event for an item that already has an answer (a pure guard keyed by item id, unit-tested), so a bounce can never answer the next item, whatever the screen does.
- The choices and Not sure are one `board` board; `choose()` returns early once the current item is answered.

### 6.5 Build a Letter (`BuildLetterGame.tsx`)

- A placed tile stays a `TapTarget` (in its placed look); a tap on it or on its filled slot removes it and the tiles after it shift left (the dead branch at `:98-101` becomes live). `target` lock: a bounce on the tile just placed does not remove it.
- During the 900 ms wrong reset the board is locked (`lock(900)`); taps then are swallowed instead of being accepted and wiped.

### 6.6 Hidden Heritage (`logic/hidden-heritage-flow.ts`, `HiddenHeritageGame.tsx`)

- New pure `spotHitRects(spots, sceneWidth)`: each spot's drawn rectangle (`spotRect`, `:238-241`) grows evenly to at least `touchTarget.min` on each axis, is clamped inside the scene, and where two grown rectangles overlap both are cut back at the midline between the original rectangles (never smaller than the original). The board hit-tests these rectangles; the drawn ring is unchanged. Unit tests: the six measured spots at 288 px each reach 64 or are bounded only by a neighbour's midline; no two hit rectangles overlap; a spot at the scene edge stays inside.
- No schema change: `HIDDEN_HERITAGE_SPOT.min` stays 75, so no content is re-authored.
- Spots get the press look of 4.3 drawn as a ring on the spot's hit shape (`colors.border.shape`, `borderWidth.thick`, no fill, so the scene stays visible); the found ring is unchanged.
- In the narrow latch the board is `scroll="x"` (`pan-x pinch-zoom`): a vertical graze never cancels; a sideways drag still scrolls the scene, which is needed there.

### 6.7 Type Hangul keyboard (DS `HangulKeyboard`)

- One `TapBoard multiTouch="each" scroll="none"`; every touch is tracked by its identifier.
- A letter commits on that finger's release, for the key under the finger at release (it may have slid to a neighbour; the press look follows the finger); a release off the keyboard types nothing.
- A rollover types both letters in release order. A repeat on the same letter key within `KEY_BOUNCE_MS` is dropped. Shift toggles only outside its 400 ms target lock. Delete and Space have the target lock.
- Hit cells stay edge to edge (the `padding: spacing.xxs` is inside each key's Pressable), so there is no dead line between keys.

### 6.8 Trace (`TraceStrokeGame.tsx`, `TraceWordGame.tsx`)

- `Gesture.Pan().minDistance(spacing.xs).maxPointers(1)`.
- `onFinalize(success)`: if the pan never activated, drop the one-point stroke `onBegin` started and call `strokeEnded()` when at least one stroke remains, so the idle check re-arms; if it activated, `onEnd` already ended it. Unit-tested on the evaluator, render-tested on the screen.

### 6.9 Learner non-game Pressables (KT-9)

- Home cards, Journey cells, Library tiles, the tab bar, the KoreanText and game speakers, HoyaBubble, WhoSwitch, vocab TopicTile and WordWall, and the help sheets: `usePressGuard()` (the Button guard of 4.4 as a hook) and `delayPressIn={0}`.
- Where a visible target is under 64 and relies on `hitSlop`, the slop becomes real padding inside the Pressable (visual size kept), so the web hit area reaches 64.
- A scan test fails if a file under `screens/minigames/`, `screens/quest/`, `screens/placement/` or `screens/vocab/` puts an answer `onPress` on a raw `Pressable` outside a `TapBoard` (an allow-list names speakers and controls).

### 6.10 Presenter Stage (KT-10)

- `TAP_SLOP` becomes `spacing.xl` (24; the test holding it to `spacing.md` changes). The swipe distance (60) and the edge guard stay. Two-finger behaviour stays (a teacher's two-finger touch is deliberate). The quiz options keep their own responder.

## 7. Accessibility

- Every answer stays a focusable `button` with its existing accessible name; selection and disabled states stay in `accessibilityState`. Keyboard Enter and Space and screen-reader activation commit through rule 8.
- 64 x 64 floor for every answer target at 320 px with the largest text (KT-D8), checked by the extended ratchet (section 11).
- Reduced motion: the press look has no scale. No new motion.
- `touch-action` keeps pinch zoom everywhere except a fitting board on a browser without `pinch-zoom` support (U1); the app's text-size setting is unaffected.

## 8. Telemetry and privacy

No new event and no new field. `placement.item_answered` fires once per item (F6). Nothing is stored.

## 9. Strings

None. Card Match accepting either side first needs no instruction change (its heading already asks to match the pairs). If a row finds it needs a string after all, it adds en, es and ko in the same PR and the MAR reviews es and ko.

## 10. Unverified assumptions (checked in KT-12)

- **U1** iOS Safari honours `touch-action: pinch-zoom` (the board feature-detects and falls back to `none` on a fitting board).
- **U2** VoiceOver (iOS Safari) and TalkBack (Chrome) activation reaches `TapTarget` as a click with no board release before it, so it commits once.
- **U3** On native iOS and Android, the capture responder keeps the `Pressable` children from claiming the touch, and `scrollEnabled={false}` on a fitting `Screen` stops a short drag from becoming a scroll.
- **U4** A real Android Chrome long press on a board (no `onLongPress` anywhere) shows no context menu or text selection (the shell already sets `user-select: none`).

## 11. Tests

### 11.1 Unit (vitest; TZ=UTC)

| File | Covers |
|---|---|
| DS `__tests__/tap-model.test.ts` | constants equal their tokens; T1-T16 on the pure reducer (down, gap fill and ties, inside by reach and by travel, release, cancel, other fingers, `each` mode, echo window, `board` and `target` locks, `lock(ms)`) |
| DS `components/TapBoard/__tests__/TapBoard.test.tsx` | capture responder claims only claimed touches; commit on the owning finger's `onResponderEnd`; termination; `touch-action` per `scroll` and fit; `useTapLock` |
| DS `components/Screen/__tests__/screen-fit.test.tsx` | `fits` from layout and content size; `manipulation` on the content; native `scrollEnabled` |
| DS `ChoiceCard`, `Tile`, `Button` tests | press look of 4.3 (never focus blue); Button guard |
| DS `HangulKeyboard` test | rollover types both in release order; slide to a neighbour types the neighbour; key bounce; Shift lock |
| `logic/__tests__/pic-word-flow.test.ts` | a second tap keeps the selection (F2) |
| `screens/minigames/__tests__/CardMatchGame.test.tsx` | fake timers: the stale flash does not clear a new pick (F3); either side first; unmount clears both timers; 64 floor |
| `logic/sentence-builder/__tests__/reducer.test.ts` | the window is `TAP_LOCK_MS`; return lock |
| `logic/placement/__tests__/flow.test.ts` | a second answer for an answered item is ignored (F6) |
| `logic/__tests__/hidden-heritage-flow.test.ts` | `spotHitRects` (6.6) |
| `logic/__tests__/trace-evaluator.test.ts` and the Trace screen tests | non-activated touch re-arms; no ink; `maxPointers(1)` |
| `logic/lecture/__tests__/stage-gesture.test.ts` | `TAP_SLOP` = `spacing.xl` |
| scan test (KT-9) | no raw answer `Pressable` outside a board in the learner game folders |

### 11.2 Playwright touch (`e2e/web/touch.ts` helper from KT-3, CDP `Input.dispatchTouchEvent`)

- Profiles: 320 x 640 with `hasTouch` and `isMobile` and the largest text size; 820 x 1180 tablet. `STORY_FIXTURES=1`. Touch behaviour does not depend on the UI language; the suites run in en, and the 320 px target ratchet runs in en, es and ko (the longest labels).
- **Graze matrix** on each board (KT-11 runs all; each row adds its own boards): moves of 0, 8, 16, 24 and 32 px on both axes commit on a fitting board; a move that ends 40 px outside the target commits nothing and leaves no press look; on a scrolling board horizontal 20 px commits and vertical 40 px scrolls without any state change.
- **Bounce**: two taps 60, 150 and 300 ms apart give one commit.
- **Two fingers**: the first commits, the second does nothing.
- **Hold** 900 ms commits.
- **Regressions**: F1 (Pic-Word graze selects), F2 (bounce stays selected), F3 (Card Match next pick stays selected after 700 ms), F4 (Story Sequence bounce: no miss line), F5 (Sentence Builder bounce at 100 and 200 ms: no miss, no skip), F6 (placement: one `placement.item_answered`), F7 (keyboard rollover types two letters; 18 px slide types the key), F8 (Hidden Heritage hit areas at least 64 at 320 px), R3 (bounce on a locked wrong tile: one miss).
- **Target ratchet**: `e2e/web/target-size.spec.ts` and `target-audit.ts` extend to every game screen at 320 px with the largest text; the check uses each board's hit rectangles where they differ from the drawn box (Hidden Heritage).
- **Fit audit** (report only, no failure): which game screens fit at 320 x 640 at default and largest text, for follow-up layout work.
- WebKit (`E2E_WEBKIT=1`, iPhone 13): the graze, bounce and two-finger cases once, for U1.

## 12. Rows (implementation PRs; each adds the tests of section 11 for what it touches)

| Row | Content | Size | Depends on |
|---|---|---|---|
| **KT-0** (this PR) | `docs(specs,design)`: this amendment; `design/components/TapBoard/spec.md`; pointer lines in F-001, F-003, F-004, F-010, F-QUEST-002, F-CURR-001, F-CURR-002, F-PLC-001, F-STORY-003, F-TCH-004, `design/components/ChoiceCard/spec.md`; README index | S | — |
| **KT-4a** (owner's exact complaint, first) | `fix(mobile)`: Pic-Word without the toggle (6.1); Card Match timer in a ref, either side first, `minHeight`, button role, completion timeout cleared (6.2, without the board) | S | KT-0 |
| **KT-1** | `feat(design-system)`: `tap-model.ts`, `TapBoard`, `TapTarget`, `useTapLock`, `usePressGuard`; `Screen` fit context, `manipulation`, native `scrollEnabled` (sections 3 to 5); component index exports | M | KT-0 |
| **KT-2** | `feat(design-system)`: ChoiceCard, Tile, Button adoption and the press look (4.3, 4.4); web-dead `hitSlop` removed from ChoiceCard and Tile; ChoiceCard component spec "Pressed" text | M | KT-1 |
| **KT-3** | `fix(mobile)`: the pick-one boards (Listen & Pick, Read Pick, Cloze Pick, Cloze Realia, Realia Read, Match Sound, Odd One Out, Culture Quiz, Tap Respond, Story Check, Daily Review, vocab question, Speed Round); the 50 ms windows become `TAP_LOCK_MS`; locked wrong tiles disabled (R3); `e2e/web/touch.ts` and the F1 and R3 regressions | M | KT-2 |
| **KT-4b** | `fix(mobile)`: Pic-Word and Card Match on `target` boards; TileFrame padding inside the target; the F2 and F3 e2e | S | KT-2, KT-4a, KT-3 (helper) |
| **KT-5** | `fix(mobile)`: Story Sequence, Story Order, Sentence Builder (Skip and the return lock), Placement (flow guard and board); the F4, F5, F6 e2e | M | KT-2, KT-3 (helper) |
| **KT-6** | `fix(mobile)`: Match Shape, Syllable Build, Build a Letter (6.5), Hidden Heritage (6.6), Role Play, Voice Echo, Write Frame word pick, My Story; the F8 e2e | M | KT-2, KT-3 (helper) |
| **KT-7** | `feat(design-system)`: HangulKeyboard multi-touch (6.7); the F7 e2e | S | KT-1, KT-3 (helper) |
| **KT-8** | `fix(mobile)`: Trace and Trace a Word (6.8) | S | KT-0 |
| **KT-9** | `fix(mobile,design-system)`: learner non-game Pressables (6.9) and the scan test | M | KT-2 |
| **KT-10** | `fix(mobile)`: presenter `TAP_SLOP` (6.10) | S | KT-0 |
| **KT-11** | `test(mobile)`: the full graze, bounce and two-finger matrix over every board at 320 and tablet; the target ratchet on every game (en, es, ko); the fit audit; the WebKit pass | M | KT-3, KT-4b, KT-5, KT-6, KT-7, KT-8 |
| **KT-12** (owner-assisted device check, does not block merges) | `docs(tests)`: a short report of U1-U4 on a real Android phone in Chrome, an iPhone in Safari and as the installed PWA, and the Xcode iOS build: Pic-Word graze, Story Sequence bounce, keyboard rollover, Trace dot, a VoiceOver pick | S | KT-11 |

**Order.** KT-4a first: it fixes the owner's "selected, then let go" in Pic-Word and Card Match on its own and needs no new component. KT-1 then KT-2. KT-3 next (it brings the touch helper); KT-4b, KT-5, KT-6 and KT-7 in parallel after it; KT-8 and KT-10 at any time; KT-9 after KT-2; KT-11 last; KT-12 when the owner has a device at hand. **Total:** 14 rows (KT-0 included; KT-12 owner-assisted), no migration, no Worker change, no new string.

## 13. Edits to the amended specs (pointer lines in this PR; behaviour in the rows named)

- F-001 §3.4: the 50 ms rule is replaced by the first-finger rule (KT-D4) and the 400 ms lock (KT-D5).
- F-003: a placed tile can be taken back by tapping it or its slot (6.5).
- F-004: Trace activation, one pointer, finalize (6.8).
- F-010: Odd One Out's locked wrong tile is disabled; Culture Quiz is on a board (KT-3).
- F-QUEST-002: Listen & Pick on a board; Pic-Word Match without the toggle (6.1).
- F-CURR-001: Sentence Builder (6.3), the Type Hangul keyboard (6.7), Trace a Word (6.8).
- F-CURR-002: Card Match (6.2), Match Shape, Syllable Build, Hidden Heritage hit areas (6.6), Cloze Pick, Daily Review.
- F-PLC-001: one answer per item (6.4).
- F-STORY-003: Story Sequence, Story Order and the checks on boards; the ChoiceCard press look (4.3).
- F-TCH-004: presenter `TAP_SLOP` 24 (6.10).
- `design/components/ChoiceCard/spec.md`: the pressed look (4.3), applied in KT-2.

## 14. Review log

- 2026-10-31, author pass against `1bfda3fc8`: confirmed in code every `file:line` the audit gave for F2, F3, F6, R1, R2 and R3, the web-dead `hitSlop` list (RN-web 0.19.13 forwards no `hitSlop`; `PressResponder.js` commits from `onClick` only), the 15 px RNGH web slop, the `Screen` default and the postbuild `touch-action`. Added to the audit: Odd One Out shares R3 (Culture Quiz and Tap Respond already disable a locked wrong answer); Trace's `onBegin` leaves a one-point stroke when the pan never activates; Build a Letter accepts and then wipes taps during the 900 ms reset; DS Button has no double-fire guard (R8); ChoiceCard's press colour equals the `hint` border, which is why a press reads as a state.
