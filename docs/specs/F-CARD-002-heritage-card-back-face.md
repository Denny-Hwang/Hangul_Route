# F-CARD-002 — Heritage Card Back Face

**Status**: `ready`
**Scope**: `apps/mobile` · CardDetailScreen · MVP polish
**Owner**: solo dev
**Rollout**: MVP — depth for the reward surface

---

## 1. Context

Heritage Cards are the primary reward (CLAUDE.md §1). F-CARD-001 ships the **front face** (illustration + Korean + romanization + English title). This spec adds the **back face** — an info-focused side that gives more visual weight to the Korean word and pairs it with the cultural blurb + fun fact.

Why two faces:
- The front rewards the child visually (art is the prize).
- The back rewards the parent / older child (cultural context, the "why this matters").
- Splitting reduces visual clutter on a single screen.
- Real cards (in real life) have two faces — it's the natural metaphor.

Per design brief `design/brief/illustrations/heritage-card-art.md` §5, the back-face layout is already specified:
- Top 40%: Korean word large + romanization
- Middle 30%: English title + 1-line blurb
- Bottom 30%: 💡 + 1-line fun fact in italic

## 2. User story

> As **P5** (English-speaking K-culture child, 8–11 yo) who just earned a Heritage card, I want to **flip the card** to read what it means and learn a cool fact, so that the card becomes a tiny piece of cultural knowledge — not just a sticker.

Companion stories:

- As **P4** (5–7 yo heritage child), I want the back face to be **optional** — I shouldn't have to read text to enjoy collecting. The front face by itself should still feel like a complete reward.
- As **a parent** showing my child a card, I want the back face to give me a 1-line conversation starter ("Did you know tigers appear in Korean folk tales?") that I can read aloud and expand on.

## 3. Acceptance criteria

### 3.1 Flip interaction

- **Given** CardDetailScreen is open on the front face (default),
  **when** the child taps anywhere on the rarity-bordered card hero zone,
  **then** the face state toggles to `back`,
  **and** the same hero zone now renders the back-face content (no animation in v1 — instant swap),
  **and** a small `↻` flip indicator hint appears top-right corner of the card.

- **Given** the card is on the `back` face,
  **when** the child taps the card again,
  **then** the face returns to `front`.

- **Given** the user closes the CardDetailScreen and reopens any card,
  **then** the default face is `front` (state is not persisted across mounts).

### 3.2 Front face layout (unchanged from F-CARD-001)

```
[Pill rarity]                              [↻ small icon]
        ┌─────────────────┐
        │   Card art      │
        │   200 × 200     │
        └─────────────────┘
        Tiger                    ← English title (display 36sp)
        호랑이                    ← Korean (title 28sp brand)
        horangi                   ← romanization (caption italic)
```

### 3.3 Back face layout (new)

```
[Pill rarity]                              [↻ small icon]
        호랑이                    ← Korean LARGE (hero 48sp brand bold)
        horangi                   ← romanization (body italic muted)

        Tiger                     ← English title (title 28sp)

        The proud Korean tiger    ← Blurb (body 18sp)
        — Hoya is one!

        💡 Tigers appear in many   ← Fun fact (body sm italic muted)
        Korean folk tales.
```

### 3.4 Below-the-fold content (both faces)

The secondary "blurb + fact" Card that currently appears below the hero card on the front face is **hidden** when face === 'back' (since the back face already contains that content). This avoids duplication.

The "Hear it" TTS button stays visible on both faces.

### 3.5 Accessibility

- The hero card's `Pressable` exposes `accessibilityRole="button"` + `accessibilityLabel` indicating "Tap to flip card".
- The flip indicator (small `↻` icon) is decorative; the accessibilityLabel on the Pressable is the screen-reader cue.
- Reduced-motion: no animation in v1, so no reduced-motion fallback needed.
- Locked cards do not allow flipping (back face requires unlocked state to show content).

### 3.6 Locked-card behavior

- When a card is locked (not yet earned), the front face shows the lock icon (as today).
- Flipping a locked card is a no-op — the Pressable's `onPress` does nothing when locked.
- No back-face content is revealed for locked cards (prevents spoilers).

## 4. Out of scope

- **Animated flip transition** (rotateY with reanimated). Defer to F-MOTION-002 if there's demand.
- **Pinch-to-zoom** on the card art — separate F.
- **Share card** (export PNG) — separate F.
- **Card backs for Stages 2–7** — Stage 1 cards inherit the contract automatically; Stage 2+ cards land when their content is authored.
- **Sound effect on flip** — silent in v1 (no SFX system yet).
- **Persisted face state per card** — face resets to `front` on every mount; intentional simplicity.

## 5. UI sketch

`design/brief/illustrations/heritage-card-art.md` §5 is the back-face design source. Both faces sit inside the same rarity-bordered Card container — the container persists, only its inner content swaps.

## 6. Tests

This is primarily a UI feature; the existing 18 mobile-logic tests are unaffected.

Unit (logic):

- None new. The face state is local to the screen.

Integration (manual / Detox future):

- Open CardDetailScreen for an unlocked card. Verify front face renders.
- Tap card. Verify back face renders.
- Tap again. Verify front face renders.
- Open a locked card. Tap. Verify nothing changes (still locked icon).

Build:

- `pnpm --filter @hangul-route/mobile typecheck` clean
- `pnpm --filter @hangul-route/web build` unaffected

## 7. Rollout

- **MVP polish** — ships as soon as F-CARD-001 has consumer code (already done — Library + CardDetailScreen wire-up landed in PR #17).
- No feature flag; default-on for all unlocked cards.
- No data migration needed.

## 8. Dependencies

### Upstream (must ship first — all done)

- F-CARD-001 Heritage Card Art (✅ PRs #17, #18) — provides the front-face art.
- `heritage-cards.ts` content seed with `blurbEn` and `factEn` fields (✅ PR #13).
- Tokens v1 (✅ PR #15) — hero / title / body / bodySm sizes.

### Downstream

- F-MOTION-002 Card flip animation (optional; defer).
- F-CARD-003 Card share/export.

### External

- `react-native` Pressable for the tap handler.
- No new packages required.
