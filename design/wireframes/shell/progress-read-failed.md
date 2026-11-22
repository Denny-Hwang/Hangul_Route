# Wireframe — progress read failed (AMENDMENTS-DURABLE-PROGRESS §3.4 – §3.8)

Status: draft, revision 4a (2026-11-22; aligned with the spec's revision 3a: AMENDMENTS-AUDIT-2026-11 AU-3 starts damaged progress fresh after keeping a copy, so the grown-up button and sheet are for the list variant only, and the sheet has no cloud action; damaged progress whose copy could not be kept shows the learner variant). Low fidelity: structure and copy only. Same layout as the existing Oops screen (`apps/mobile/src/screens/system/OopsScreen.tsx`), with up to two extra buttons.

## Variants

| Variant | When | Buttons |
|---|---|---|
| List | at launch, the profile list could not be read | Try again · (damaged only) A grown-up can help |
| Learner | one learner's progress could not be read, or was damaged and its copy could not be kept; shown when that learner is active at launch, or when they are chosen | Try again · Choose another learner (2 or more profiles) |

"Damaged" = the stored list bytes do not parse and a copy was kept (spec §3.6). For a read error there is no grown-up button: only trying again can help. Damaged progress whose copy **was** kept never reaches this screen: it is kept aside and started fresh (AU-3), and its cloud copy is folded back in at the next sync (spec §3.2). Damaged progress whose copy **could not** be kept (for example, the device is full) does reach it, in the learner variant: nothing was written, and Try again tries the copy again (spec §3.5). It has no grown-up button either.

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
│        A grown-up can help           │   ghost (list variant, damaged only)
└──────────────────────────────────────┘
```

## Grown-up recovery sheet (behind the PIN; damaged list only)

```
┌──────────────────────────────────────┐
│  This record is damaged.             │
│  We kept a copy of it on this device.│
│                                      │
│  [ Start fresh on this device      ] │
│  [ Not now                         ] │   default focus
└──────────────────────────────────────┘
```

## Rules

- The learner never sees a "Start over" or "New learner" button. Starting the list fresh is only in the grown-up sheet, only for damaged bytes, only after a copy is kept.
- No danger colour, no X, no warning icon (anti-shame rules). Hoya `thinking`.
- Try again shows a busy state and cannot be pressed twice while a try runs.
- Screen reader: the title is the screen's heading; the still-stuck line, when it appears, is announced once (polite). In the sheet, **Not now** has the initial focus (the ConfirmSheet rule: the safe choice first).
- Tablet / wide: same column, max width as the Oops screen.

## Not on this screen

- The quiet "could not save yet" lines (spec §3.7): single text lines under the Results headline, above the grown-up section on Profile, at the top of the Grown-up area dashboard, and on Restore in place of "restored" (`caregiver.restore.saveLater`, chosen after the restore's write has run).
