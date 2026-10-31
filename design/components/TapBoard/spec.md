# TapBoard, TapTarget (component spec v1)

Spec: `docs/specs/AMENDMENTS-TOUCH.md` (KT-D1 to KT-D11, sections 3 to 5; rows KT-1 and KT-2) · no wireframe of its own: it adds no screen and no layout, only how existing answer cards, tiles and keys take a touch and how they look while pressed
Code (KT-1): `packages/design-system/src/tap-model.ts` (pure model), `packages/design-system/src/components/TapBoard/` (`TapBoard.tsx`, `TapTarget.tsx`, `use-tap-lock.ts`, `use-press-guard.ts`, `types.ts`, `index.ts`)

## What it is

The one way a learner's answer takes a touch. A `TapBoard` wraps an answer area (the four tiles of Match Sound, the cards of Story Sequence, the keyboard) and owns every touch that lands on or near one of its `TapTarget`s. It commits an answer when the finger lifts, forgives a finger that slid a little, fills the gaps between tiles, ignores a second finger and a bounce, and never lets a touch that did not count look chosen.

No copy and no i18n dependency. The caller passes the accessible names.

## Props

`TapBoard`

| Prop | Type | Notes |
|---|---|---|
| `lock` | `'board' \| 'target'` | Required. `board`: after a commit every target is locked for `TAP_LOCK_MS` (a commit moves, removes, reveals or advances something). `target`: only the committed target (pairing games) |
| `scroll` | `'auto' \| 'x' \| 'none'`, default `auto` | Web `touch-action`: `auto` reads the `Screen` fit (`pinch-zoom` when it fits, else `pan-y pinch-zoom`); `x` for a board in its own horizontal ScrollView (`pan-x pinch-zoom`); `none` for a board outside any ScrollView (`pinch-zoom`) |
| `multiTouch` | `'first' \| 'each'`, default `first` | `each` only for the keyboard: every finger is its own tap and the target follows the finger |
| `disabled` | `boolean?` | No target commits; touches are still claimed so nothing under them fires |
| `testID` | `string?` | |

`TapTarget`

| Prop | Type | Notes |
|---|---|---|
| `onCommit` | `() => void` | Called once per tap, after the board's rules (`AMENDMENTS-TOUCH.md` §3.2) |
| `disabled` | `boolean?` | Claimed, never pressed, never committed (a locked wrong tile) |
| `accessibilityLabel` | `string` | Required |
| `accessibilityState` | `{ selected?: boolean; disabled?: boolean }?` | `disabled` is merged from the prop |
| `testID` | `string?` | |
| `children` | `(look: { pressed: boolean }) => ReactNode` | The caller paints its own states and the press look when `pressed` |

`useTapLock(): { locked: boolean; lock(ms: number): void }` reads the nearest board's lock (for a control outside the board that must wait, such as Sentence Builder's Skip) or extends it (a slide-back or reset animation).

`usePressGuard(): (fn) => () => void` wraps an `onPress` so a second call within `TAP_LOCK_MS` is dropped (Button and the non-game learner Pressables).

## States

| State | Look | Commits |
|---|---|---|
| idle | the caller's | on release inside |
| pressed (finger down and inside) | the press look | on release |
| finger outside reach and travel | the caller's (press look off) | no |
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

`TAP_LOCK_MS` (400) and `CLICK_ECHO_MS` (700) are input timings, not styles, and are pinned in `tap-model.test.ts`.

The press look is never `border.focus` (the focus ring and ChoiceCard's `hint`), `brand.primary` (Pic-Word's selection ring), `brand.primaryLight` (Card Match's selected fill), `surface.sunken` (the `disabled` fill) or a feedback colour: a touch that does not count must never look like a choice.

## Accessibility

- Each `TapTarget` is one `Pressable` with `accessibilityRole="button"`, focusable, with the caller's label and state. Keyboard Enter and Space, a screen reader's activate and switch access reach it as a click and commit through the same rules and lock.
- Every target is at least `touchTarget.min` (64) on each axis at 320 px with the largest text; where a drawn shape is smaller (Hidden Heritage spots) the board hit-tests a separate rectangle of at least 64.
- Pinch zoom stays available on every board where the browser supports `touch-action: pinch-zoom`.
- No sound and no haptic of its own; the game keeps its own feedback.

## Tests

`src/__tests__/tap-model.test.ts` (rules T1-T16 of the amendment), `src/components/TapBoard/__tests__/TapBoard.test.tsx` (responder capture, owning finger, termination, `touch-action`, lock context), and the Playwright touch suites of the rows that adopt it.

## Where it appears

ChoiceCard and Tile inside a board (KT-2); every learner answer area listed in `AMENDMENTS-TOUCH.md` §6 (KT-3 to KT-7). Not used by the presenter Stage, which keeps its own responder, or by Trace, which keeps its pan.
