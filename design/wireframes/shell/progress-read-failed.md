# Wireframe — progress read failed (AMENDMENTS-DURABLE-PROGRESS §3.4 – §3.8)

Status: draft, revision 3 (2026-11-21; copy aligned with the spec's revision 2 after the multi-agent review). Low fidelity: structure and copy only. Same layout as the existing Oops screen (`apps/mobile/src/screens/system/OopsScreen.tsx`), with up to two extra buttons.

## Variants

| Variant | When | Buttons |
|---|---|---|
| List | at launch, the profile list could not be read | Try again · (damaged only) A grown-up can help |
| Learner | one learner's progress could not be read; shown when that learner is active at launch, or when they are chosen | Try again · Choose another learner (2 or more profiles) · (damaged only) A grown-up can help |

"Damaged" = the stored bytes do not parse and a copy was kept and read back (spec §3.6). For a read error there is no grown-up button: only trying again can help.

## Layout (phone, portrait)

```
┌──────────────────────────────────────┐
│              [Hoya: thinking]        │   140 dp
│                                      │
│    We could not open your progress.  │   Heading, title, centered
│   Nothing was erased. Let's try      │   Body, secondary, centered
│   again.                             │
│   ┌──────────────────────────────┐   │
│   │ Hmm, the box is stuck.       │   │   HoyaBubble, tone thinking
│   │                              │   │
│   └──────────────────────────────┘   │
│   Still stuck? Close the app and     │   Body, secondary; only after
│   open it again.                     │   3 tries in this session
├──────────────────────────────────────┤
│  [          Try again           ]    │   hero, primary, busy state
│  [     Choose another learner   ]    │   secondary (learner variant)
│        A grown-up can help           │   ghost (damaged only)
└──────────────────────────────────────┘
```

## Grown-up recovery sheet (behind the PIN; damaged only)

```
┌──────────────────────────────────────┐
│  This record is damaged.             │
│  We kept a copy of it on this device.│
│                                      │
│  [ Get it back from the cloud save ] │   only when a server copy exists
│  [ Start fresh on this device      ] │
│  [ Not now                         ] │   default focus
└──────────────────────────────────────┘
```

## Rules

- The learner never sees a "Start over" or "New learner" button. Starting fresh is only in the grown-up sheet, only for damaged bytes, only after a copy is kept.
- No danger colour, no X, no warning icon (anti-shame rules). Hoya `thinking`.
- Try again shows a busy state and cannot be pressed twice while a try runs.
- Screen reader: the title is the screen's heading; the still-stuck line, when it appears, is announced once (polite). In the sheet, **Not now** has the initial focus (the ConfirmSheet rule: the safe choice first).
- Tablet / wide: same column, max width as the Oops screen.

## Not on this screen

- The quiet "could not save yet" lines (spec §3.7): single text lines under the Results headline, above the grown-up section on Profile, and at the top of the Grown-up area dashboard.
