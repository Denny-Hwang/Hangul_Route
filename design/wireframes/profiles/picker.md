# Profiles/Picker — cold-launch profile picker (wireframe v1)

Spec: `docs/specs/F-PROF-001-device-profiles.md` §3.1
Audience: **learner (P4/P5 child, 5–11)** primary · parent secondary

## Scenario (Given-When-Then)

Given: the app cold-launches on a shared tablet with ≥ 1 profile already created
When: the splash finishes
Then: the learner finds their own tiger tile in one glance and enters with one tap (no PIN)

## Screen goal

"Pick *your* tiger and enter — one tap for a learner, PIN gate only for parent."

## Box diagram

```
┌──────────────────────────────────┐
│        [app wordmark, small]     │  ← no back button (root screen)
│                                  │
│   "Who's learning?" (short       │
│    placeholder prompt)           │
│                                  │
│  ┌────────┐  ┌────────┐          │
│  │[avatar]│  │[avatar]│          │  ← learner tiles ≥96×96dp
│  │ name   │  │ name   │          │     max 8 visible, grid scrolls
│  └────────┘  └────────┘          │
│  ┌────────┐  ┌╌╌╌╌╌╌╌╌┐          │
│  │[avatar]│  │  [+]   │          │  ← [+] add learner → PIN first
│  │ name   │  │ add    │          │
│  └────────┘  └╌╌╌╌╌╌╌╌┘          │
│                                  │
│  ┌──────────────────────────┐    │
│  │ [lock glyph] Parent      │    │  ← visually secondary, bottom
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

- Learner tiles are the largest elements (primary CTA is "tap your tile").
- Parent entry is deliberately smaller and bottom-anchored (parent controls never compete with child targets).
- No stars / progress / streak shown on any tile — sibling comparison is banned (F-PROF-001 §3.3).

## Interaction points

- Learner tile tap → `home/home` for that profile, ≤ 300 ms, no PIN (pre-warmed on launch)
- Parent tile tap → `profiles/pin-entry` modal (over this screen)
- `[+]` add tap → `profiles/pin-entry` → on success → `profiles/create-learner`
- Long-press on any tile: no action in MVP (deletion lives in parent Settings only)
- VoiceOver per tile: "`<name>`'s tiger, stage `<N>`. Tap to enter."

## Navigation graph

Enter from: splash (cold launch) · `profiles/switch-button` (in-session switch) · `profiles/create-learner` (after creation)
Exit to:    `home/home` (learner) · `profiles/pin-entry` (parent / add) · `profiles/create-parent` (empty state only)

## States

- **success**: grid of 1–8+ tiles as above.
- **empty** (no profiles): this screen never renders — redirect to `profiles/create-parent` onboarding (F-PROF-001 §3.2).
- **error** (profile store unreadable): full-screen Hoya placeholder + "short reassurance line" + [[ TRY AGAIN ]] single CTA; never auto-wipes data.

## Data needs

- profiles list + avatar kind + stage number — local (AsyncStorage via `platform/storage`, `profile-store.hydrate()`)
- pre-warm: active-candidate progress snapshots loaded during splash so tile-tap → home is ≤ 300 ms
- writes: `profiles:active` on tile tap

## Open questions

- Tile ordering: creation order vs most-recently-active first? (beta A/B — default creation order to keep spatial memory stable for pre-readers)
- Does the parent row show the parent's name or just "Parent"? (privacy on shared classroom devices — beta)
