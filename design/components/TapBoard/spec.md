# TapBoard, TapTarget (component spec v2)

Spec: `docs/specs/AMENDMENTS-TOUCH.md` (KT-D1 to KT-D11, sections 3 to 5; rows KT-1 and KT-2) · no wireframe of its own: it adds no screen and no layout, only how existing answer cards, tiles and keys take a touch and how they look while pressed
Code (KT-1): `packages/design-system/src/tap-model.ts` (pure model), `packages/design-system/src/components/TapBoard/` (`TapBoard.tsx`, `TapTarget.tsx`, `TapControl.tsx`, `TapScroller.tsx`, `TapLockProvider.tsx`, `use-tap-lock.ts`, `use-press-guard.ts`, `types.ts`, `index.ts`)

## What it is

The one way a learner's answer takes a touch. A `TapBoard` wraps an answer area (the four tiles of Match Sound, the cards of Story Sequence, the keyboard) and owns every touch that lands on or near one of its `TapTarget`s. It commits an answer when the finger lifts, forgives a finger that slid a little in any direction (also on a screen that scrolls: the board scrolls the page itself once the finger has gone past 32 px), fills the gaps between tiles, lets the latest finger on an answer win over a resting thumb, ignores a bounce, and never lets a touch that did not count look chosen.

No copy and no i18n dependency. The caller passes the accessible names.

## Props

`TapBoard`

| Prop | Type | Notes |
|---|---|---|
| `lock` | `'board' \| 'target'` | Required. `board`: after a commit the app-level lock (`TapLockProvider`) is on for `TAP_LOCK_MS` and every board and guarded press waits, including a board that mounts in that time (a commit moves, removes, reveals or advances something). `target`: only the committed target (pairing games) |
| `scroll` | `'auto' \| 'none'`, default `auto` | `auto`: the board drives the nearest `TapScroller` when it can scroll (a touch on a target turns into a scroll after `TAP_TRAVEL` along its axis). `none`: never scrolls (the keyboard) |
| `multiTouch` | `'latest' \| 'each'`, default `latest` | `latest`: a later finger that lands on a target takes the board and the earlier touch rests (never commits); a finger on nothing is ignored. `each` only for the keyboard: every finger is its own tap and the target follows the finger |
| `disabled` | `boolean?` | No target commits; touches are still claimed so nothing under them fires |
| `testID` | `string?` | |

Web `touch-action`: every `TapTarget` is `pinch-zoom`; the board itself is `pinch-zoom` when its `Screen` fits, else `pan-y pinch-zoom` (`pan-x pinch-zoom` under a horizontal `TapScroller`).

`TapTarget`

| Prop | Type | Notes |
|---|---|---|
| `onCommit` | `() => void` | Called once per tap, after the board's rules (`AMENDMENTS-TOUCH.md` §3.2) |
| `disabled` | `boolean?` | Claimed, never pressed, never committed (a locked wrong tile) |
| `gapFill` | `boolean?`, default true | false for a take-back target (a filled slot or zone): only a touch inside its own rectangle reaches it |
| `accessibilityLabel` | `string` | Required |
| `accessibilityState` | `{ selected?: boolean; disabled?: boolean }?` | `disabled` is merged from the prop |
| `testID` | `string?` | |
| `children` | `(look: { pressed: boolean }) => ReactNode` | The caller paints its own states and the press look when `pressed` |

`TapControl` wraps a non-target control inside a board (a speaker, a hint): the board never claims a touch on it, even within the gap reach of a target.

`TapScroller` wraps the content of a ScrollView a board may drive: `axis` (`'x' | 'y'`), `canScroll`, `scrollBy`, and a scroll listener. `Screen` provides one (axis `y`); a game's own horizontal ScrollView (Hidden Heritage's narrow scene) wraps its content in one (axis `x`).

`TapLockProvider` is mounted once in the app root, above the navigator. `useTapLock(): { locked: boolean; lock(ms: number): void }` reads the app-level lock from any component, inside a board or not (Sentence Builder's Skip, Placement's item screen), or extends it (a slide-back or reset animation).

`usePressGuard(options?: { setsLock?: boolean }): (fn) => () => void` wraps an `onPress` so a second call of the same control within `TAP_LOCK_MS` is dropped and a call while the app lock is on is dropped; by default a press that runs also sets the app lock (Button, Home cards, the tab bar); a control that moves nothing (a speaker) passes `setsLock: false`.

## States

| State | Look | Commits |
|---|---|---|
| idle | the caller's | on release inside |
| pressed (finger down and inside) | the press look | on release |
| finger outside reach and travel, or over another target | the caller's (press look off) | no |
| scrolling (travel past 32 px along the scroller's axis) | the caller's (press look off) | no |
| resting (a later finger took the board) | the caller's (press look off) | no |
| locked | the caller's, no press look | no |
| disabled | the caller's disabled or locked-wrong look | no |

## Tokens (no literals)

| Part | Token |
|---|---|
| Press look outline | `colors.border.shape` at `borderWidth.thick` |
| Press look shrink | scale 0.97, none under reduced motion |
| Gap reach | `spacing.lg` (16) |
| Release reach | `spacing.xl` (24) |
| Travel | `spacing.xxl` (32) |
| Key bounce | `motion.duration.fast` (120) |

`TAP_LOCK_MS` (400), `CLICK_ECHO_MS` (700) and `FLING_DECAY` (0.95 per 16 ms) are input timings, not styles, and are pinned in `tap-model.test.ts`.

The press look is never `border.focus` (the focus ring and ChoiceCard's `hint`), `brand.primary` (Pic-Word's selection ring), `brand.primaryLight` (Card Match's selected fill), `surface.sunken` (the `disabled` fill) or a feedback colour: a touch that does not count must never look like a choice.

## Accessibility

- Each `TapTarget` is one `Pressable` with `accessibilityRole="button"`, focusable, with the caller's label and state. Keyboard Enter and Space, a screen reader's activate and switch access reach it as a click and commit through the same rules and lock.
- Every target is at least `touchTarget.min` (64) on each axis at 320 px with the largest text; where a drawn shape is smaller (Hidden Heritage spots) the board hit-tests a separate rectangle of at least 64, except on an axis where a spot is boxed in by neighbours or the scene edge (`AMENDMENTS-TOUCH.md` §6.6 states that minimum).
- Pinch zoom stays available on every board where the browser supports `touch-action: pinch-zoom`.
- No sound and no haptic of its own; the game keeps its own feedback.

## Tests

`src/__tests__/tap-model.test.ts` (rules T1-T20 of the amendment), `src/components/TapBoard/__tests__/TapBoard.test.tsx` (responder capture, latest finger, termination, scroller drive and cancel, native rect cache, `TapControl`, `touch-action`), `src/components/TapBoard/__tests__/TapLockProvider.test.tsx` (a lock that outlives a remount), and the Playwright touch suites of the rows that adopt it.

## Where it appears

ChoiceCard and Tile inside a board (KT-2); every learner answer area listed in `AMENDMENTS-TOUCH.md` §6 (KT-3 to KT-7). Not used by the presenter Stage, which keeps its own responder, or by Trace, which keeps its pan.
