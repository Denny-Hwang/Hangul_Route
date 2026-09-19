# Library/Card-Detail — one card, two faces, share (wireframe v1, modal)

Spec: `docs/specs/F-CARD-002-heritage-card-back-face.md` §3.1–3.6 · `docs/specs/F-CARD-003-card-share-export.md` §3.1–3.7 · F-MOTION-002 (flip animation, supersedes CARD-002 §3.1 "instant swap")
Audience: **learner (P4/P5 child, 5–11)** front face · **parent / older child** back face + share
Code (back-filled): `apps/mobile/src/screens/library/CardDetailScreen.tsx` — route `CardDetail { cardId }`, `presentation: 'modal'`

## Scenario (Given-When-Then)

Given: a learner tapped a card slot in the Library (collected or locked)
When: the modal opens
Then: the front face fills the screen as the prize; a tap flips it to the "why it matters" side; a grown-up can hear the word or share the card image; the close control is where it always is

## Screen goal

"Enjoy one card — flip, hear, and (optionally) share it."

## Box diagram

```
+----------------------------------+
| [x close]                        |  <- top-left, consistent with parent/gate
|                                  |
|  +----------------------------+  |
|  | [rarity]     (tap to flip) |  |  <- rarity border = the card frame (sec.3.2)
|  |                            |  |
|  |         [ART 1:1]          |  |  FRONT: art, English title, ko word,
|  |        Tiger               |  |         romanization (sec.3.2)
|  |        호랑이  horangi       |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  | blurb (1-2 lines)          |  |  <- front face only (sec.3.4); hidden on back
|  | (i) fun fact (1 line)      |  |
|  +----------------------------+  |
|                                  |
|   [ HEAR IT ]                    |  <- TTS ko, both faces
|   [ Share ]                      |  <- ghost; unlocked + OS share available (CARD-003 sec.3.1)
|   (share error line slot)        |  <- 1 calm line, retry by tapping Share again
+----------------------------------+

BACK face (same frame, content swaps at the 90-degree midpoint):
  ko word LARGE + romanization / English title + blurb / (i) fun fact  (sec.3.3)

LOCKED variant: lock glyph in the art zone, title only, no flip hint,
  no blurb card, no Hear it, no Share (sec.3.6, CARD-003 sec.3.6)
```

- Flip: rotateY, two legs of ~base duration; taps mid-flip ignored; reduced motion → instant swap (F-MOTION-002).
- Face resets to front on every open (§3.1) — no persisted face.

## Interaction points

- Card hero tap → toggle front/back (unlocked only)
- [ HEAR IT ] → `speak(subtitleKo, ko-KR)`; no navigation
- [ Share ] → capture the hero card (current face, rarity border included, chrome excluded — §3.2) → OS share sheet (system). Cancel at the sheet: no message. Capture failure: 1-line retry copy (§3.4)
- [x close] / swipe-down (modal) → back to `library/gallery` (or `episode/detail` when opened from there)

## Navigation graph

Enter from: `library/gallery` · `episode/detail` (collected card tile) · `results/celebrate` banner (future)
Exit to:    back to the invoking screen · OS share sheet (system surface, returns here)

## States

- **success**: unlocked card, front face, all controls.
- **empty** (locked card): locked variant above — a deliberate "not yet" with nothing to press but close.
- **error**: `cardId` not in bundle → 1 line "card not found" + [x close] · art missing for the id → Korean word fills the art zone (code fallback) · capture failed → calm retry line; share button stays enabled · TTS unavailable → hide [ HEAR IT ] rather than show a dead button.

## Data needs

- reads: `cardById(id)` (titleEn, subtitleKo, romanization, blurbEn, factEn, rarity, theme), `supportedCardIds` · `ProgressSnapshot.cards[]` (unlocked?) · `isShareAvailable()` on mount (`platform/sharing`)
- writes: none
- telemetry: **none for share by design** (CARD-003 §3.7); no view event either

## Open questions

- **Discrepancy**: CARD-003 §3.4 asks for a Hoya bubble (thinking) on capture failure; code shows a muted caption. Keep the caption (quieter, adult-facing) and amend the spec?
- **Discrepancy**: CARD-003 §8 says gate Share while flipping; not implemented. Low risk (capture takes the current face), confirm and drop from spec or add the guard.
- Should the parent surface reuse this modal or a stripped variant without celebration tone? `parent/learner-detail.md` currently assumes a stripped variant.
- "(tap to flip)" hint: text today; icon-only for pre-readers, or Hoya says it once on first open?
