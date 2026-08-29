# Profiles/PIN-Entry — parent PIN modal (wireframe v1)

Spec: `docs/specs/F-PROF-001-device-profiles.md` §3.1, §3.5
Audience: **parent** (child may see it — must be boring to a child, zero reward for poking)

## Scenario (Given-When-Then)

Given: a parent tile (or a parent-gated action like `[+]` add learner) was tapped
When: the modal opens
Then: the parent enters their 4-digit PIN and reaches the parent surface; a child tapping randomly hits a calm cooldown, never a shame message

## Screen goal

"Verify the parent's 4-digit PIN — nothing else lives here."

## Box diagram

```
┌──────────────────────────────────┐
│  (dim scrim over profiles/picker)│
│   ┌──────────────────────────┐   │
│   │ [✕ close]                │   │  ← top-left, consistent
│   │                          │   │
│   │  "Grown-ups only"        │   │  ← placeholder, 1 short line
│   │                          │   │
│   │       ● ● ○ ○            │   │  ← dots only, NEVER digits
│   │                          │   │
│   │    [1] [2] [3]           │   │
│   │    [4] [5] [6]           │   │  ← keypad ≥64dp targets
│   │    [7] [8] [9]           │   │
│   │    [⌫]  [0]              │   │
│   │                          │   │
│   │  (wrong-PIN line slot,   │   │  ← empty by default
│   │   1 line, calm tone)     │   │
│   └──────────────────────────┘   │
└──────────────────────────────────┘

Cooldown variant (after 5 wrong in 60 s):
   keypad disabled (visually muted) ·
   "let's wait a moment" placeholder + [30 s countdown]
```

- No [[ SUBMIT ]] button: 4th digit submits automatically (fewer targets, faster for adults, harder for a child to brute-tap).
- Wrong entry: dots shake + clear; copy is neutral ("try again" tone) — never "wrong!/failed" framing even for adults.

## Interaction points

- Keypad digit tap → fill next dot; 4th digit → verify against bcrypt hash
- Correct → dismiss modal → destination surface (`parent/dashboard` or `profiles/create-learner`, per invoking action)
- Wrong ×5 within 60 s → cooldown state, keypad disabled 30 s, countdown visible
- [✕ close] / scrim tap / hardware back → dismiss to `profiles/picker` (always escapable — a stuck child must be able to leave)

## Navigation graph

Enter from: `profiles/picker` (parent tile, `[+]`) · `home/home` avatar-corner → parent option · settings parent-gated rows
Exit to:    `parent/dashboard` · `profiles/create-learner` · back to invoking screen (cancel)

## States

- **success**: correct PIN → destination (modal itself has no success visual — speed is the reward).
- **empty**: default state, dots unfilled, no helper error text.
- **error**: wrong-PIN line (calm, 1 line) · cooldown variant above · storage/hash failure → "can't check right now" placeholder + [ TRY AGAIN ], never unlocks without verification.

## Data needs

- reads: `parent.<profileId>.pin_hash` (AsyncStorage via `platform/storage`) · attempt counter + timestamps (`logic/profiles/pin-hash` cooldown state, memory + persisted)
- writes: attempt log for cooldown enforcement; success opens 15-min parent session (`logic/profiles/session`)
- PIN digits never persisted or logged; verification in memory only

## Open questions

- Forgot PIN: MVP = reinstall (spec §3.5). Does the modal say so, or stay silent to avoid teaching kids the wipe trick? (default: tiny "Forgot?" → parent-tone info sheet; verify in beta)
- Cooldown persists across app restarts? (default yes — otherwise a child force-quits to bypass; confirm at F-PROF-001 implementation)
