# Parent/Gate — math-question grown-up check (wireframe v1)

Spec: none (code-only surface; app-map §3.1 marks it "코드만") · store policy: Apple / Google children's category parental gate before commerce or destructive actions · related `docs/specs/F-PROF-001-device-profiles.md` §3.1, §3.5 (PIN gate)
Audience: **parent** — a child will see it; it must be boring and give nothing for poking
Code (back-filled): `apps/mobile/src/screens/parent/ParentGateScreen.tsx` — route `ParentGate { next: 'ParentDashboard' }`, `presentation: 'modal'`

## Scenario (Given-When-Then)

Given: someone tapped "Grown-up zone" on `profile/settings`
When: the modal opens
Then: an adult solves a two-digit multiplication and lands on the parent dashboard; a child tapping numbers gets a calm "not quite" and can always close

## Screen goal

"Confirm an adult is holding the device — nothing else lives here."

## Box diagram

```
+----------------------------------+
| [x close]                        |  <- top-left, consistent with card-detail
|                                  |
|  "Grown-up zone" (placeholder)   |
|  1 line: solve to continue       |
|                                  |
|  +----------------------------+  |
|  |       8 x 13 = ?           |  |  <- a in 7-11, b in 11-17, new each open
|  |                            |  |
|  |   [1] [2] [3] [4] [5]      |  |  <- digit keypad, child-size targets
|  |   [6] [7] [8] [9] [0]      |  |     (max 4 digits entered)
|  |   entered: 10_             |  |  <- digits echo as text (answer is not a secret)
|  +----------------------------+  |
|                                  |
|   [[ CHECK ]]                    |  <- disabled until >= 1 digit
|   [ Cancel ]                     |
|   (calm wrong-answer line slot)  |  <- appears after a miss; 1 line, no count
+----------------------------------+
```

- No backspace key in code (a wrong digit means Check → miss → entry clears). Wireframe keeps the keypad as-is; see open questions.
- No cooldown, no attempt counter shown, no lock-out.

## Interaction points

- Digit tap → append (≤ 4 digits)
- [[ CHECK ]] → correct: `navigation.replace(next)` → `parent/dashboard` (only `next` value today) · wrong: entry clears, calm line appears, same question stays
- [ Cancel ] / [x close] / modal swipe → back to `profile/settings`

## Navigation graph

Enter from: `profile/settings` ("Grown-up zone")
Exit to:    `parent/dashboard` · `profile/settings` (cancel)

## States

- **success**: correct product → replaced by the destination (no success visual; speed is the reward).
- **empty**: default — question shown, nothing entered, Check disabled.
- **error**: wrong answer → calm one-liner, entry cleared, unlimited retries · (there is no storage or network here, so no load error state).

## Data needs

- reads: none (question generated in memory on mount)
- writes: none; the answer is never persisted; no parent session opened (unlike `profiles/pin-entry`)
- telemetry: none (candidate `parent_gate.passed` — but see consolidation below)

## Open questions

- **Duplication**: the app has two adult gates — this math modal (`profile/settings` → dashboard) and `profiles/pin-entry` (F-PROF-001, `profiles/picker` parent tile → dashboard). They lead to the *same* `parent/dashboard`, with different strength: PIN has a hashed secret + 5-try cooldown + 15-min session; the math gate has none and a 9-year-old with a calculator passes it. **Recommendation: consolidate on PIN** — route "Grown-up zone" to `profiles/pin-entry` with `next` as a param, delete this screen, and keep the store-policy requirement satisfied (a parent-set PIN is an accepted parental gate). Keep math only as a fallback for a device with *no* parent profile, which the first-run flow (§3.2) makes impossible today.
- Until consolidation: add the PIN modal's cooldown (5 misses / 60 s → 30 s) here so the weaker gate is not the easier target.
- Digit echo as text vs. dots: text is right here (not a secret), but if the two modals merge, dots win.
