# Placement (the level check): screen flow as built (F-PLC-001 P-6)

Wireframe: `design/wireframes/placement/placement.md` (frames B to L2). Code: `apps/mobile/src/screens/placement/`.
Logic (pure, 100 % covered): `apps/mobile/src/logic/placement/` (`flow.ts`, `item-view.ts`, `options-view.ts`, `session.ts`, `result-view.ts`, `copy.ts`).
Screenshots: `HR_SHOTS=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test placement-screens` writes them to `apps/mobile/e2e/web/__shots__/placement-*.png` (git-ignored).

## Frame order

```
[Placement { source }]  (root route; the nested PlacementStack holds one screen at a time)
   |
   +-- saved run within 24 h ----------> Resume (Continue | Start again)            wireframe L
   |                                        Continue -> Item (first prompt plays on a tap)
   |
   +-- more than one UI language ------> Language (endonym radios, spoken on tap)    wireframe B
   |                                        |
   v                                        v
 Options C1 (Pictures first, Short pre-selected: card, Change, Start)                wireframe C1
 Options C2 (three mode radios, sound guide with nothing pre-selected, Take my time,
             Why Korean?; NEXT pinned at the bottom, disabled until the guide is answered)  wireframe C2
   |
   +-- Short, or Pictures first ------> Hand-off (the whole Hoya is the button)      wireframe C3
   |                                        |
   v                                        v
 Warm-up (speaker first; the pictures wait for the sound check)                     wireframe D
   |-- no sound, Short or listen-first --> Sound needed (Try again | Start learning | Check without sound -> C2)  wireframe L2
   v
 Item (Standard / Deep frame, or the Short layout: 2 x 2, two columns in landscape)  wireframes E, E2
   |-- exit, 45 s idle, three "not sure", app in the background --> Pause sheet     wireframe F
   |-- Deep after 18 answers --> Rest card                                           wireframe F2
   v
 Result (headline, stage title and band label, 7 x 5 map with the pin, route cards; Start pinned)  wireframe G
```

## Decisions taken while building

- Tokens only; no emoji; every control at least `touchTarget.min`, choice cards at least `touchTarget.child`.
- The Short item shows no written line: Hoya sits beside the speaker, the instruction and the cheers are spoken (wireframe E2). Short pictures shrink to `spacing.xxxl` in landscape so two rows and "I am not sure" fit 568 x 320; the cards keep `touchTarget.child`.
- Mode tiles stack in one column below 480 pt of content or above font scale 1.3; side by side otherwise.
- Focus lands on Hoya's line on each question; its label is "Question, N choices" plus the written instruction.
- The pause sheet is a modal that hides while the PIN gate is on top ("For grown-ups: finish now") and shows again on return.
- The web cannot tell whether a screen reader is on (react-native-web always answers yes), so the web reads it as off; every control is still labelled.
- The weekly-plan strip (P-7b), the placement report (P-8) and the entry points (P-7) are not part of these frames; "For grown-ups" opens the grown-up zone until P-8.
