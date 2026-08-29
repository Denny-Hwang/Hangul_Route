# Parent/Voice-Recorder — N5 message recorder (wireframe v1)

Spec: `docs/specs/F-PAR-001-parent-dashboard.md` §3.4
Audience: **parent** (output is heard by the learner via Hoya on their next home visit)

## Scenario (Given-When-Then)

Given: a parent is on the dashboard looking at one learner's card
When: they tap "Record a message"
Then: they record ≤ 10 s of audio, review it, and confirm — the child hears it from Hoya before tomorrow's mission (queue depth 1: a new recording replaces an unheard old one)

## Screen goal

"Record one ≤ 10 s voice message for one child, confirm, done."

## Box diagram

```
Idle                                   Recording                Review
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ [← back]                 │   │ [← back = cancel]        │   │ [← back = discard]       │
│                          │   │                          │   │                          │
│  For: [avatar] Name      │   │  For: [avatar] Name      │   │  For: [avatar] Name      │
│                          │   │                          │   │                          │
│  "Say something Name     │   │   ◉ REC   0:04 / 0:10    │   │   [▶ play back]  0:07    │
│   will hear tomorrow"    │   │   ▁▃▅▃▂▅▇▅▃ (level)      │   │                          │
│  (placeholder, 1 line)   │   │                          │   │  [[ SEND TO NAME ]]      │
│                          │   │  [[ ■ STOP ]]            │   │  [ ↺ record again ]      │
│  [[ ● START RECORDING ]] │   │  (auto-stop at 0:10)     │   │                          │
│                          │   │                          │   │  (replace note slot, 1   │
│  (replace note slot: "a  │   │                          │   │   line, only if unheard  │
│   new message replaces   │   │                          │   │   message exists)        │
│   the last one", 1 line, │   │                          │   │                          │
│   only when one pending) │   │                          │   └──────────────────────────┘
└──────────────────────────┘   └──────────────────────────┘
```

- One linear 3-step state machine on a single screen; primary CTA always the biggest element per step.
- Hard cap 10 s: countdown visible, auto-stop → review (no error, running out is normal).

## Interaction points

- [[ ● START RECORDING ]] → mic permission check → recording state
- [[ ■ STOP ]] → review state · auto-stop at 0:10 → review state
- [▶ play back] → plays the take (toggles to pause)
- [[ SEND TO NAME ]] → save (replaces any unheard message, §3.4) → back to `parent/dashboard` with brief "sent" confirmation on that card
- [ ↺ record again ] → discard take → idle
- [← back]: idle → dashboard · recording → cancel-confirm (1-line) · review → discard-confirm (1-line)

## Navigation graph

Enter from: `parent/dashboard` (per-learner card) · `parent/learner-detail`
Exit to:    `parent/dashboard` (send or cancel)

## States

- **success**: 3-step flow above.
- **empty** (mic permission denied): idle CTA replaced by "microphone is off" placeholder + [ OPEN SETTINGS ]; never a dead record button.
- **error** (save fails): stay on review, take kept in memory, "short retry line" + [ TRY AGAIN ].

## Data needs

- reads: target learner profile (preselected from invoking card) · pending-message existence (for replace note)
- writes: `ParentMessage` (audio m4a ≤ 10 s ≤ 80 KB via expo-av, local, keyed by target `profileId`; queue depth 1 — replace semantics via `logic/parent-dashboard/message-queue`)
- playback on learner side is out of scope here (learner `home/home` wireframe owns it)

## Open questions

- Optional text label with the message ("from Mom / Dad")? MVP: voice only — Hoya intro line covers attribution; verify comprehension with 5-year-olds in beta
- Should the parent see "heard ✓" state on the dashboard card? (leans toward yes, but it's surveillance-adjacent — decide with beta parents)
