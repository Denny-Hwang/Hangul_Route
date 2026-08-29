# Profiles/Create-Learner — add a learner (wireframe v1)

Spec: `docs/specs/F-PROF-001-device-profiles.md` §3.2
Audience: **parent driving, child co-picking the avatar** (designed for over-the-shoulder co-use)

## Scenario (Given-When-Then)

Given: a parent profile exists and the parent session window is open (fresh onboarding, or picker `[+]` after PIN)
When: the parent adds a child
Then: they enter the child's name and the child picks one of 8 tiger avatars, and the child's profile is ready to use immediately

## Screen goal

"One learner in: name + avatar pick, then straight to that child's home."

## Box diagram

```
┌──────────────────────────────────┐
│ [← back]                         │
│                                  │
│  "Add a learner" (placeholder)   │
│                                  │
│  Child's name                    │
│  [ text field, 1–12 chars ]      │
│                                  │
│  "Pick a tiger!" (placeholder,   │
│   child-directed line)           │
│                                  │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐    │  ← 8 preset Hoya-variant
│   │ av │ │ av │ │ av │ │ av │    │    avatars, 2×4 grid,
│   └────┘ └────┘ └────┘ └────┘    │    tiles ≥96×96dp,
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐    │    selected = ring highlight
│   │ av │ │ av │ │ av │ │ av │    │
│   └────┘ └────┘ └────┘ └────┘    │
│                                  │
│  [[ START LEARNING ]]            │  ← primary CTA
│  [ Add another child → repeat ]  │  ← secondary, same screen reset
└──────────────────────────────────┘
```

- Avatar grid is the child's moment — biggest visual block; no camera / photo upload (COPPA, F-PROF-001 §4).
- Avatars are illustrations named after the Pillars (글이·살이·례이·솔이·솜이 …), never labeled with the child's name.

## Interaction points

- Name field: 1–12 chars, no emoji, no Korean/Chinese; validation inline
- Avatar tile tap → selects (single-select, ring highlight, small bounce)
- [[ START LEARNING ]] → create profile → set active → `home/home` for the new learner
- [ Add another child ] → save current → reset form (stays within 15-min parent session, no re-PIN)
- [← back] → `profiles/picker` (or previous onboarding step on first run)

## Navigation graph

Enter from: `profiles/create-parent` (first run, forced) · `profiles/picker` `[+]` → `profiles/pin-entry` success · parent settings "Add another child"
Exit to:    `home/home` (new learner active) · self (add another) · `profiles/picker` (back)

## States

- **success**: form above; on save, brief "welcome moment" placeholder (Hoya greets) before home.
- **empty** (no avatar picked yet): CTA disabled; grid gently pulses first tile as hint — no error copy.
- **error** (storage write fails): keep entries in memory, "short retry line" + [[ TRY AGAIN ]].

## Data needs

- reads: avatar catalog (static, `logic/profiles/avatar-catalog`) · parent session validity (`logic/profiles/session`)
- writes: learner `Profile` (role: learner, ageGroup default per onboarding answer) · `profiles:active`

## Open questions

- ageGroup (5–7 / 8–11) asked here or inferred later from minigame pacing? (currently in onboarding flow — confirm merge or keep separate step)
- Avatar duplicated across siblings allowed? (default: allowed — restricting invites comparison/conflict; verify in beta)
