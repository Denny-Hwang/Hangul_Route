# FlipCard (component spec v1)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` §3.5 (PR C-2) · motion: F-MOTION-002 · share gating: `docs/specs/F-CARD-003-card-share-export.md` §8 · wireframes: `design/wireframes/library/card-detail.md` (the heritage card) and `design/wireframes/vocab/flashcards.md` D/E (the word card)
Code: `apps/mobile/src/components/FlipCard.tsx` (motion), `apps/mobile/src/logic/flip.ts` (pure: `nextFace`, `mayFlip`, tested)

## What it is

A card that turns over to show its other side. It draws nothing of its own: the caller passes the two faces, already styled with tokens (the heritage card's rarity frame, the word card's `paper` tone and topic tint). The heritage card detail uses it today. The vocabulary flashcards will use it next.

## Behaviour

| Step | What happens |
|---|---|
| Tap (or press with a keyboard or screen reader) | rotate on the Y axis to edge-on (90 degrees) over one `motion.duration.base` leg, easing `bezier(0.2, 0, 0, 1)` |
| Edge-on | `onFlip()`: the caller swaps `face` while no face is visible |
| Second leg | rotate back to flat over another `motion.duration.base` leg, showing the new face |
| Tap while turning | ignored (`mayFlip`) |
| `disabled` | the press does nothing (a locked heritage card) |
| Reduced motion | `onFlip()` at once, with no rotation |

`onFlippingChange(true / false)` brackets the turn, so a caller can hold an action that must not run mid-flip. CardDetail disables Share while the card is turning.

## Props

| Prop | Type | Note |
|---|---|---|
| `face` | `'front' \| 'back'` | controlled by the caller |
| `onFlip` | `() => void` | called once per flip, at the edge-on midpoint |
| `front`, `back` | `ReactNode` | the two faces |
| `disabled` | `boolean?` | default `false` |
| `onFlippingChange` | `(flipping: boolean) => void?` | |
| `accessibilityLabelFront`, `accessibilityLabelBack` | `string` | the button's name on each face (from the dictionary, e.g. "Flip to the back" / "Flip to the front"; a locked card passes its locked label) |

## Accessibility

- The card is one button (`accessibilityRole="button"`). Its name says what a press does on the face that is showing.
- The touch target is the whole card.
- Reduced motion replaces the rotation with an instant swap.

## Tokens

`motion.duration.base` only. The faces bring their own colours, radii and spacing from `@hangul-route/design-system`, with no literals.
