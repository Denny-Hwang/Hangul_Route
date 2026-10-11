# FlipCard (component spec v1)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` §3.5 (PR C-2) · motion: F-MOTION-002 · share gating: `docs/specs/F-CARD-003-card-share-export.md` §8 · wireframes: `design/wireframes/library/card-detail.md` (the heritage card) and `design/wireframes/vocab/flashcards.md` D/E (the word card)
Code: `apps/mobile/src/components/FlipCard.tsx` (motion), `apps/mobile/src/logic/flip.ts` (pure and unit-tested: `nextFace`, `mayFlip`, `flipAction`, `swapAtEdge`, `cubicBezierPoints`)

## What it is

A card that turns over to show its other side. It draws nothing of its own: the caller passes the two faces, already styled with tokens (the heritage card's rarity frame, the word card's `paper` tone and topic tint). The heritage card detail uses it today. The vocabulary flashcards will use it next.

## Behaviour

| Step | What happens |
|---|---|
| Tap (or press with a keyboard or screen reader) | `flipAction` decides: `ignore`, `instant` or `animate`. Animate rotates on the Y axis to edge-on (90 degrees) over one `motion.duration.base` leg, easing `motion.easing.standard` |
| Edge-on | `onFlip()`: the caller swaps `face` while no face is visible. Skipped (`swapAtEdge`) when the first leg was cancelled or the caller already changed `face` since the tap, so a caller that moved on to another card never has it flipped to its back |
| Second leg | rotate back to flat over another `motion.duration.base` leg, showing the new face |
| Tap while turning | ignored (`mayFlip`) |
| `disabled` | the press does nothing (a locked heritage card) |
| Reduced motion | `onFlip()` at once, with no rotation |

`onFlippingChange(true / false)` brackets the turn, so a caller can hold an action that must not run mid-flip. CardDetail disables Share while the card is turning. The closing `false` is sent when the second leg ends or is cancelled, so taps are never left locked.

**Caller contract.** Give FlipCard a `key` per card (the Library pane keys CardDetailView by card id; the flashcards key it by word id), so a new card starts flat on its front. A caller whose own controls change the card (flashcards: "Got it" / "Show me again") may keep them enabled during a turn: the midpoint guard above leaves the next card on its front. A card that stops being flippable while on its back should set `face` to `'front'` (CardDetail does when the active profile changes).

## Props

| Prop | Type | Note |
|---|---|---|
| `face` | `'front' \| 'back'` | controlled by the caller |
| `onFlip` | `() => void` | called once per flip, at the edge-on midpoint |
| `front`, `back` | `ReactNode` | the two faces |
| `disabled` | `boolean?` | default `false` |
| `onFlippingChange` | `(flipping: boolean) => void?` | |
| `accessibilityLabelFront`, `accessibilityLabelBack` | `string` | the button's name on each face (from the dictionary: `a11y.flipToBack` / `a11y.flipToFront`; a locked card passes `a11y.lockedCard` on both faces) |

## Accessibility

- The card is one button (`accessibilityRole="button"`). Its name says what a press does on the face that is showing.
- The touch target is the whole card.
- Reduced motion replaces the rotation with an instant swap.
- The button's name replaces its children for a screen reader. The heritage card prints its title outside the flip as well, so nothing is lost there. A caller whose face content is the point of the card (the vocabulary flashcards, F-VOC-003 C-5) must put that content in the label (for example the word on the front, the word and its meaning on the back, from the dictionary) and announce the new face after `onFlip`; C-5 adds that, with its strings, as an acceptance item.

## Tokens

`motion.duration.base` (each leg) and `motion.easing.standard` (read with `cubicBezierPoints`; `Easing.ease` only if the token ever stops being a cubic-bezier). The faces bring their own colours, radii and spacing from `@hangul-route/design-system`, with no literals.

## Verification

Web: Playwright (`e2e/web/tablet-layout.spec.ts`): the card flips in the Library pane, a second tap mid-turn is ignored, and under reduced motion the swap is instant. iOS and Android: a manual pass by the owner before F-VOC-003 C-5 merges or the next native release, recorded in that PR: front to back to front, a double tap mid-turn is ignored, reduced motion swaps at once, and Share produces the same PNG as before the extraction.
