# F-CARD-003 — Card Share / Export

**Status**: `ready`
**Scope**: `apps/mobile` · CardDetailScreen · MVP polish
**Owner**: solo dev
**Rollout**: MVP polish — parent / family sharing affordance

---

## 1. Context

Parents have asked: "How do I show my kid's earned Heritage card to grandma?" Today, no way — cards live only inside the app.

F-CARD-003 adds a **Share** button to CardDetailScreen that captures the currently visible card (front or back face) as a PNG and triggers the OS native share sheet. Recipient gets a clean card image; the app stays uninvolved in the conversation.

Why important:
- **Family bridge** — a Korean-heritage grandparent who doesn't know the app can still admire what their grandchild earned.
- **Parent engagement** — gives the parent a reason to open the parent gate and share something positive.
- **Cultural pride** — a card with 호랑이 + the explanation feels share-worthy.

## 2. User story

> As **a parent** sitting next to my child after they earn the Tiger card, I want to tap **Share** and send the card to my family group chat, so that my kid's grandmother (who lives in Korea) sees their progress without needing to install the app.

Companion stories:

- As **a child**, I'm not the primary user of this button — it lives behind a small "Share" button that's easy to ignore.
- As **a parent worried about over-sharing apps**, I want **no telemetry** fired by the Share action — it's a fully local capture + share, no analytics ping.

## 3. Acceptance criteria

### 3.1 Share button visibility

- The **Share** button appears on CardDetailScreen **only when the card is unlocked**.
- Button styling: tone `ghost`, size `md`, label "Share", icon "card" (or a share glyph if added later).
- Position: below the "Hear it" button, with a Spacer between.

### 3.2 Capture behavior

- **Given** the user is viewing an unlocked card on either face (front or back),
  **when** they tap **Share**,
  **then** the current visual state of the hero card (the rarity-bordered Card with all its content) is captured to a PNG file at 2x DPR (so it looks crisp on social media).

- The capture **must include** the rarity border + theme tint + the active face content (so a shared "back face" looks like an info card, not the art).

- The capture **must exclude**:
  - The status bar
  - The close × button
  - The "tap to flip" pill
  - The "Hear it" button
  - The blurb+fact card below (when on front face — already in the hero card snapshot or captured as part of the back face)

### 3.3 Share sheet

- After capture, immediately invoke the OS Share sheet (`expo-sharing`).
- Pre-fill nothing — let the OS show the destination picker.
- File mime type: `image/png`.
- Filename: `hangul-route-{cardId-slug}.png` (e.g., `hangul-route-tiger.png`).

### 3.4 Failure paths

- **Capture fails** (rare — e.g., view-shot ref not attached): show a quiet HoyaBubble with `tone="thinking"` and message "Couldn't make the picture this time. Try again?" The button remains tappable for retry.
- **Sharing fails / canceled** by user at the OS sheet: no error. The screen returns to normal state.
- **Sharing unavailable** (rare — e.g., test environment): button is hidden via `Sharing.isAvailableAsync()` check on mount.

### 3.5 Accessibility

- Share button has `accessibilityRole="button"` and label "Share this card".
- Capture runs synchronously to the tap — no race conditions with screen-reader focus.

### 3.6 Locked cards

- Share is hidden when locked — there's nothing meaningful to share.

### 3.7 No telemetry

- The Share action does NOT fire a telemetry event in v1. Privacy-by-default.

## 4. Out of scope

- **Custom share text / link** — only the image is shared. Adding a "Hangul Route — learning Korean with Hoya 🐯" message could be valuable but feels promotional; deferred.
- **Multi-card share** (multiple cards as one image) — Phase 2.
- **Deep link from the shared image** — the image is standalone. No tracking, no redirect.
- **Custom watermark** — the rarity border + card content is the brand; no overlay.
- **Social media direct integration** (Instagram, TikTok, etc.) — OS share sheet routes there anyway.
- **Telemetry tracking** of share events — privacy-first; can be added behind explicit opt-in if data is needed.

## 5. UI sketch

```
[Card hero — front or back face]

[Hear it]   ← existing
[Share ↗]  ← NEW (ghost button, "card" icon prefix)
```

## 6. Tests

- Manual:
  - Open unlocked card on front face → tap Share → verify PNG looks right, share sheet opens
  - Same, but on back face → verify back content is captured
  - Open locked card → verify no Share button
  - In test environment (sharing unavailable) → verify button is hidden

- Unit/integration: none new (UI feature).
- Typecheck: 8 packages clean.

## 7. Rollout

- Ships immediately. Default-on.
- No feature flag.

## 8. Dependencies

### Upstream (must ship — all done)

- F-CARD-002 Card front/back faces (✅ PR #20).
- F-MOTION-002 Card flip animation (✅ PR #21) — doesn't block, but Share captures the current face state regardless of mid-flip; we'll gate the button while flipping.

### New packages

- `expo-sharing` — OS share sheet integration.
- `react-native-view-shot` — capture View hierarchy to PNG.

Both are well-maintained Expo-compatible packages.

### Downstream

- F-CARD-004 Multi-card collection share (Phase 2).
- F-TEL-001 telemetry opt-in (if we want to count share events).
