# Placement: Test language (`placement/language`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.2)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet).
Code (planned): `screens/placement/LanguageScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section B (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: the learner chose the level check and more than one UI language ships
When: they pick the language the instructions are spoken and written in
Then: the Korean being tested stays the same and the app language does not change

## Screen goal

"Pick the language of the check's instructions, defaulting to the app language."

## Box diagram

```
┌──────────────────────────────────┐
│ [<]  "Pick the language for the   │
│       check" (hear)               │
│ ┌──────────┐ ┌──────────┐ ┌─────┐ │
│ │ English  │ │ 한국어    │ │Espa-│ │  <- endonyms; default = the app language,
│ │   (o)    │ │   ( )    │ │ ñol │ │     already selected
│ └──────────┘ └──────────┘ └─────┘ │
│  tapping a tile speaks one short  │
│  instruction in that language     │
│  [ no Korean voice here ]         │  <- shown instead of the 한국어 tile's
│                                   │     radio when no Korean voice exists
│  [ no voice for this language     │  <- under an en / es tile whose instruction
│    here ]                         │     voice is missing: still selectable,
│                                   │     but Short is unavailable (W-5)
│ [[ CONTINUE ]]                    │
│  note: this does not change the   │
│  app language                     │
└──────────────────────────────────┘
```

- Choosing a language changes the instructions, Hoya's lines and the picture labels read by screen readers; the Korean being tested is the same in every language.
- Back goes to A.

## Interaction points

- Tap a language tile: selects it and speaks one short instruction in that language.
- A tile without an instruction voice stays selectable and shows the "no voice" line; Short then becomes unavailable (W-5).
- CONTINUE: goes to options.
- Back: returns to the fork (or to where the check was opened from).

## Navigation graph

Enter from: `placement/invite`, `placement/home-entry` (Home card or Profile row), `parent/placement-report` (retake)
Exit to: `placement/options`, back to the entry screen

## States

- **success**: as drawn, the app language pre-selected.
- **no Korean voice**: the 한국어 tile shows "no Korean voice here" instead of its radio.
- **resume**: a saved run under a day old shows "Continue" / "Start again" here (`placement.md` L).
- **error / offline**: identical; nothing here needs the network.

## Data needs

- reads: shipped UI locales, the profile and device locale, instruction-voice availability per locale (`hasVoiceFor`), a saved `placement-run:<profileId>`
- writes: the chosen test locale into the run (never the app locale)

## Open questions

- Should `testLocale: 'ko'` be listen-first? (default: no, until beta data; spec assumption 19)
- Is a Korean-speaking parent of a young learner expected to pick the Korean test language for the child? (default: yes; instructions are spoken, so the child can still follow)
