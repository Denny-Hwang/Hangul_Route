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
   |-- no sound or sound switched off, Short or listen-first --> Sound needed (Try again | Start learning | Check without sound -> C2)  wireframe L2
   v
 Item (Standard / Deep frame, or the Short layout: 2 x 2, two columns in landscape)  wireframes E, E2
   |-- exit, 45 s idle, three "not sure", app in the background --> Pause sheet     wireframe F
   |-- prompts stopped playing (no-sound skips) --> Sound sheet (Try again)          wireframe F3
   |-- Deep after 18 answers --> Rest card                                           wireframe F2
   v
 Result (headline, stage title and band label, 7 x 5 map with the pin, route cards; Start pinned)  wireframe G
```

## Decisions taken while building

- Tokens only; no emoji; every control at least `touchTarget.min`, choice cards at least `touchTarget.child`.
- The Short item shows no written line: Hoya sits beside the speaker, the instruction and the cheers are spoken (wireframe E2). Short pictures shrink to `spacing.xxxl` in landscape so two rows and "I am not sure" fit 568 x 320; the cards keep `touchTarget.child`.
- Mode tiles stack in one column below 480 pt of content or above font scale 1.3; side by side otherwise.
- Focus lands on Hoya's line on each question (native: `AccessibilityInfo.setAccessibilityFocus`; web: DOM focus); its label is "Question, N choices" plus the written instruction.
- Standard and Deep: every third answer Hoya's bubble says the cheer and the written instruction moves to a line under it, so it never disappears. "I am not sure" is the height of a choice card (`touchTarget.child`) in every mode.
- Sound switched off (`muted`) at the warm-up counts as no sound for the draw; mid-run, a prompt that cannot play shows its words or reply as text ("No sound? Read it here.", with the romanization unless the prompt leaks). A heard letter or syllable first asks for a tap ("Tap to hear it."); a tap that fails too skips it with `noSound`, kept out of scoring and out of the three "not sure". The sound sheet (F3: "Turn on sound to play", Try again) opens after the first such skip in Short or a listen-first run and after two in a row otherwise, so a run never skips itself to the end (post-merge #258).
- The hand-off and the warm-up have the same quiet exit icon as the Short item; it leaves with nothing recorded. The warm-up speaks Hoya's line on open.
- Short's cards unlock on the prompt's end, or its estimated length plus 3 s counted from when the Korean prompt starts (after any cheer and instruction), and never later than 8 s after the item opens. The first tap after a resume says the instruction before the prompt.
- Learner lines on the item ("Tap to hear it.", "No sound? Read it here.", "Got it") use the 18 pt body size.
- The pause sheet is a modal that hides while the PIN gate is on top ("For grown-ups: finish now") and shows again on return. It scrolls inside the window, drops Hoya below 400 pt of height (phone in landscape), keeps the bottom safe-area inset and stays at reading width on wide windows.
- "Try it with the sound guide hidden" starts the retake at once (warm-up, or the hand-off for Pictures first) and keeps the last check's language.
- The web cannot tell whether a screen reader is on (react-native-web always answers yes), so the web reads it as off; every control is still labelled. C2 has an **I use a screen reader** switch (on when the device reports one) that drives auto-play, *Take my time* and the visual rung; a screen reader turned on or off during the check is followed for auto-play and the speaker labels.
- The weekly-plan strip and the report's plan card arrived with P-7b (below); "For grown-ups" opens the placement report (P-8).

## Entry points and the Journey look as built (F-PLC-001 P-7)

Wireframes `design/wireframes/placement/invite.md` (fork), `home-entry.md` (Home card, Profile row) and `placement.md` section I (Journey). Code: `screens/onboarding/PlacementInviteScreen.tsx`, `screens/home/HomeScreen.tsx`, `screens/profile/ProfileScreen.tsx`, `screens/journey/JourneyScreen.tsx`; logic in `logic/placement/entry.ts`, `home-card.ts` and `cell-look.ts` (100 % covered). Everything here is hidden while `flags.placementEnabled` is off or the bank fails to parse; the Journey marks read the stored results only, so a learner without one sees no change.

```
CreateProfile --(flag on)--> PlacementInvite (A) --"I am new to Korean"--> FirstQuestPreview (declinedAt, placement.skipped)
                                   |
                                   +--"I already know some Korean"--> Placement { source: 'onboarding' } (the fork stays underneath)
Home (H): mission cards, then at most one quiet card: "Already know some Korean?" [ Take the level check ] / [ Continue the level check ]   Not now
Profile (H): a row under the stats, "Find my starting spot again  >"  -> Placement { source: 'profile' } (no PIN)
Journey (I): a dashed light outline and a small check-in-circle in the stage colour on placed-out cells; a pin in the corner of the start cell
```

- The fork has no back (the profile exists). Its two choices are the same size and weight, each with an icon (play; ear) and one line; neither is pre-selected. The question is spoken on open (not with a screen reader on) and on the small speaker beside it. One line below says it takes a few minutes and can be stopped.
- Home: the card shows when no result is stored, fewer than three quests are complete and **Not now** was not tapped; it reads **Continue the level check** while a saved run can be resumed. **Not now** fires `placement.skipped { source: 'home' }`; the Profile row stays available. In two columns the card sits under the mission cards in the left column.
- Journey: the pin marks where the route started (the effective route computed without completions, the same anchor as My route's "You started here"), so it does not move as quests are finished; a grown-up override or a higher retake moves it. The completed tint wins over the placed-out look. The explainer card gains one sentence about the pin and the outline once a result is stored. Each marked cell says so to a screen reader.

## The weekly plan after the check as built (F-PLC-001 P-7b)

Wireframes `journey/my-route-overview.md` J1, J3, K2, K3 (promoted into `placement/result.md` and `placement/report.md`). Code: `screens/placement/PlanParts.tsx` (pace chips, strip, update card), `screens/placement/ResultScreen.tsx`, `screens/parent/SuggestedPlanCard.tsx`; logic in `logic/placement/plan-offer.ts` and `store/plan-offer-store.ts`. Everything here is hidden while `flags.routeEnabled` is off. Screenshots: `E2E_ROUTE=1 STORY_FIXTURES=1 HR_SHOTS=1 ... playwright test placement-plan` on a fixture bundle exported with `EXPO_PUBLIC_ROUTE_ENABLED=true` (`placement-plan-strip*.png`, `placement-report-plan-*.png`).

```
Result (self, no plan)       headline, level, (not-tested line + Try it with the sound guide hidden), map, route cards
                             [ Hoya made a weekly plan for you | 12 weeks, 3 days a week, about 15 minutes a day |
                               (Gentle) (Steady, selected) (Brisk) | [[ Use this plan ]] | [ Change ] ]
                             [ Just start ]   See the whole map / See Learning Route   For grown-ups
Result (self, plan, later start)   [ Hoya found a later place to start. | Your weekly plan can move ahead ... |
                                     [[ Update my plan ]] | [ Keep my plan ] ]
Result (child)               [[ Start ]] pinned; link For grown-ups: set up a weekly plan
Report (any profile)         first card: Suggested weekly plan for <name> | Based on: <stage> · <band>, n days a week, m minutes |
                             Pace chips | Length 4 weeks / 12 weeks / 6 months (Suggested) | Good to know (plain warnings) |
                             [[ Use this plan ]] [ Change ] [ Not now ];  after a later check: [[ Update the plan ]] [ Not now ]
Report (override)            after Choose a different start: <name>'s plan can follow the start you chose. | [[ Update the plan ]] [ Not now ]
```

- **Use this plan** makes the plan with one tap and no PIN on a self profile (OD-14), then opens the start quest; the pace chip changes the length, days and minutes shown, and the plan is exactly what is shown.
- With the strip or the update card the one primary sits inside the card and nothing is pinned at the bottom; **Just start** and **Change** are ghost buttons. **Keep my plan** folds the card into "Your plan stays right where it is." and a pinned **Start**.
- **Change** opens the proposal screen on top; once a plan exists there, or after its **Not now**, the strip gives way to **Start** on return. The door already counted `route.proposed`, so the proposal screen does not count it again (`proposedSent`).
- The update is read from the plan, not from the previous result: a first check after a plan made from Home, or a retake that matches the last one while the plan is still behind, offers **Update my plan**. A level that rises alone moves nothing in the plan and offers nothing.
- A grown-up override that puts quests back (or picks another start) offers the update on the report only ("<name>'s plan can follow the start you chose."); the learner's card speaks of a later start only (AM-2, AM-7).
- **Keep my plan** and the report's **Not now** on an update answer that change (`route-ui.keptFor`): both surfaces stay quiet until the next result or override.
- Dismissals are per surface: **Just start** and the proposal screen's **Not now** hide the Home prompt and the result strip (AM-6); the report card's **Not now** hides only the report card (`route-ui.reportDismissedAt`), so the grown-up still finds the proposal first on the report (AM-1). Both for 14 days or until the next result.
- The report card's warnings never name a price, a plan or a product; a stage the account does not include reads "not included with this account yet".
