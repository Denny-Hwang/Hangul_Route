# Profiles/Switch-Button — avatar-corner switch on home (wireframe v1)

Spec: `docs/specs/F-PROF-001-device-profiles.md` §3.4
Audience: **learner (5–11)** — a 5-year-old hands the tablet to a sibling without adult help

## Scenario (Given-When-Then)

Given: learner A is active on `home/home` and sibling B wants a turn
When: A (or B) taps the avatar corner and confirms "switch"
Then: A's in-progress state is safely persisted and the profile picker re-renders — B taps their own tile

## Screen goal

"Hand the device over: one small corner affordance → picker, with A's progress auto-saved."

## Box diagram

```
home/home (context — corner only)          Tap → tiny sheet (not full screen)
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ ┌──────┐            [⚙]      │          │  (dim scrim over home)       │
│ │[my   │                     │          │   ┌──────────────────────┐   │
│ │ tiger│ ← avatar corner,    │          │   │  [avatar] name       │   │
│ └──────┘   ≥44×44dp,         │          │   │                      │   │
│            top-left, always  │          │   │  [[ SWITCH TIGER ]]  │   │  → profiles/picker
│    (rest of home unchanged)  │          │   │  [ Grown-ups → PIN ] │   │  → profiles/pin-entry
│                              │          │   │  [ ✕ stay ]          │   │
└──────────────────────────────┘          └───┴──────────────────────┴───┘
```

- The corner button is the learner's own avatar (self-identity anchor), not a generic "switch" icon.
- Sheet shows ONLY the current learner's avatar/name — no other profiles previewed here (no sibling stars/collection leak, §3.3); the picker is where others appear.
- NOT present inside Quest/minigame screens (§3.4 — prevents mid-game switch losing state); quest screens keep only [← back].

## Interaction points

- Avatar corner tap → sheet (above)
- [[ SWITCH TIGER ]] → persist current screen state → `profiles/picker`
- [ Grown-ups ] → `profiles/pin-entry` → `parent/dashboard`
- [ ✕ stay ] / scrim tap → dismiss, nothing changes
- If a Quest was backgrounded-but-unfinished: switch still allowed from home; quest run is auto-paused (resumable when A returns)

## Navigation graph

Enter from: `home/home` only (MVP)
Exit to:    `profiles/picker` · `profiles/pin-entry` · dismiss (self)

## States

- **success**: sheet + switch as above.
- **empty** (single profile on device): corner still renders (identity anchor); sheet shows [ Grown-ups ] + [ ✕ stay ] only — "switch" hidden, no dead-end CTA.
- **error** (persist-on-switch fails): stay on home, "short retry line" toast; never switch without a completed save.

## Data needs

- reads: active `Profile` (avatar, name)
- writes: pause/persist quest-run + progress snapshot for the leaving profile (`quest-run-store` pause, `progress-store` flush) → then clear `profiles:active`

## Open questions

- Also surface the switch on the Library tab? (MVP: home only — measure "stranded sibling" friction in beta)
- Should [[ SWITCH TIGER ]] require a confirm when a download/audio is mid-flight? (default: no — saves are atomic; revisit if beta shows loss)
