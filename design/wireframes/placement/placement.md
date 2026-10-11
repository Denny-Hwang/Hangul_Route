# Placement: the level check, from the "I already know some Korean" fork to the result, the parent report and the roster line (wireframe v2: three check lengths; flow overview)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1 flow, 3.2 test language and sound guide, 3.5 engine, 3.6 result, 3.7 route seed, 3.9 grown-up and teacher surfaces, 3.10 entry points)
Audience: anyone learning Hangul, any age (CLAUDE.md section 1). The learner screens work for a child alone (big targets, spoken prompts) and for an adult (short, quiet). Grown-up and teacher screens are separate and behind the PIN gate or in the console.
Code (planned): `screens/onboarding/PlacementInviteScreen.tsx`, `screens/placement/{LanguageScreen,OptionsScreen,HandoffScreen,WarmupScreen,SoundNeededScreen,ItemScreen,PauseSheet,ResultScreen}.tsx`, `screens/parent/PlacementReportScreen.tsx`, `screens/home/HomeScreen.tsx` (card), `screens/profile/ProfileScreen.tsx` (row), `screens/journey/JourneyScreen.tsx` (placed-out look), `apps/web/src/app/teach/space/page.tsx` (roster line)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.

This file is the flow overview. The placement screens were promoted to one file per screen in this directory (F-PLC-001 P-0, AM-15); section letters are kept so references such as "`placement.md` H" still resolve:

| Section | File | Screen |
|---|---|---|
| A | [`invite.md`](invite.md) | Fork: "I am new" or "I already know some Korean" |
| B | [`language.md`](language.md) | Test language |
| C | [`options.md`](options.md) | Options: length, sound guide, take my time |
| C3 | [`handoff.md`](handoff.md) | Hand-off: "Tap Hoya to start" |
| D | [`warmup.md`](warmup.md) | Warm-up question |
| E | [`item.md`](item.md) | Items: the question frame and the five formats |
| E2 | [`item-short.md`](item-short.md) | Short items: 2 x 2 picture and sound cards |
| F | [`pause.md`](pause.md) | Pause sheet and the Deep rest card |
| G | [`result.md`](result.md) | Result: where the route starts |
| H | [`home-entry.md`](home-entry.md) | Entry points: Home card and Profile row |
| J | [`report.md`](report.md) | Parent report and "Choose a different start" |
| L2 | [`sound-needed.md`](sound-needed.md) | Sound needed |
| I | this file | Journey: placed-out look and the start pin (amends `journey/grid`) |
| K | this file | Console roster line and "suggest a different start" (amends `console/roster`) |
| L | this file, L2 in [`sound-needed.md`](sound-needed.md) | Empty, error, offline and no-sound states for the whole flow |

When a screen file and this overview differ, the screen file wins for its screen.

## Scenario (Given-When-Then)

Given: someone has just made a profile (or opens the check later from Home, Profile or the parent report) and may already know some Korean
When: they choose "I already know some Korean", pick the language of the check, and answer a short run of friendly questions
Then: Hoya shows where their route starts, the Journey cursor skips what they know without marking it done, a grown-up can read a plain report, and nobody sees a score

## Screen goal

"Find a good starting spot in a few minutes (Short), usually under ten (Standard) or carefully (Deep), in the learner's own language, without a single number or a wrong-answer sound, and without taking anything away from the route they already have." (F-PLC-001 AM-15 to AM-42, W-1)

---

## I. Journey: placed-out look and the start pin (`journey/grid`)

```
 Stage 1  Hangul      [L:✓○] [F:✓○] [R:•] [N:  ] [C:  ]
                        ^ light outline + small check-in-circle = "you can skip ahead here"
                        • = pin on the start cell
 completed cells keep their own (filled) look; placed-out cells are different and still tappable
```

- Tapping a placed-out cell opens the episode as any other; its quests play and award normally.
- The explainer card gains one sentence about the pin and the outline.

## K. Console roster line (`console/roster`) and the advisory hand-off

```
 Student card:  Sam   last active: today
                Starting spot: Stage 1 · Letters and sounds · Oct 9      [ Suggest a different start ]
                (Changed by a grown-up)         <- only when overridden
```

- [ Suggest a different start ] opens the plan builder on a new draft with one quest, a short note, "only this student" selected. It is an ordinary plan; it never edits the student's check or progress.
- No class average, no level distribution, no sorting by level.

## L. Empty, error, offline, no-sound

- Bank cannot load: the Home card, the Profile row and the fork disappear; nothing else changes.
- No sound: in Standard or Deep (not listen-first) D says so; audio-only questions are left out; the report names it. In Short or for a listen-first learner, L2 opens.
- L2. Sound needed: [`sound-needed.md`](sound-needed.md).
- Links ("Check without sound", "Change", "For grown-ups") have a hit area of at least `touchTarget.min`.
- A rung with fewer than three questions available: it is skipped and reported as not tested.
- Offline: identical; the result syncs later.
- A saved run older than a day: dropped silently; a newer one: B shows "Continue" / "Start again".
- Storage full or unavailable: the run continues in memory; the result is retried on the next write.

---

## Interaction points

- Tap a choice: records the answer, shows "Got it" (Short: the footstep trail only, no "Got it"), moves on after a short beat; double taps within 50 ms count once.
- "Show how it sounds": reveals romanization for this question; the answer is then assisted (only when the run hides the guide until tap).
- "I am not sure": records it, moves on; three in a row open the pause sheet (not in Short).
- Exit: opens the pause sheet; "start learning" ends the run with the answers so far.
- START on the result: resets the stack to Main plus the quest player on the start quest.

## Navigation graph

Enter from: `onboarding/create-profile` (fork), `home/todays-mission` (card), `profile/settings` (row), `parent/placement-report` (retake), deep link `Placement { source }`
Exit to: `onboarding/first-quest-preview` (new learner, or Start learning on L2), `quest/player` (start), `journey/grid` (map), `library/gallery` (stories), `parent/placement-report` (via PIN)

## States

- **success**: as drawn.
- **empty**: nothing to place (beyond content) -> G2; no result yet -> report shows "No check taken yet" with the take-it button.
- **error / offline / no sound**: L.
- **small phone / landscape / 200 % text**: choices stack in one column, the exit and "not sure" stay reachable (Screen scrolls). Exception: the Short item screen (E2) keeps its 2 x 2 grid and does not scroll in portrait; in landscape it uses its two-column layout (see E2).
- **reduced motion**: Hoya and footsteps change state without animation.

## Data needs

- reads: the placement bank (generated), profile (`ageGroup` -> level order -> default length and listen-first), the instruction voice of the test language, device and profile locale, audio capability, progress snapshot (`placements`, quests done), tier, the route catalogue
- writes: `placement-run:<profileId>` after each answer, `placement-ui:<profileId>`, the finished result in the snapshot (`placements`), telemetry (ids and counts only)

## Open questions

- Should `testLocale: 'ko'` be listen-first? (default: no, until beta data; spec assumption 19)
- Recalibrate the length durations from `placement.item_answered.ms` after beta (spec assumption 4).
- Is a Korean-speaking parent of a young learner expected to pick the Korean test language for the child? (default: yes; instructions are spoken, so the child can still follow)
- Where in the design system do footsteps live (a new fill-only `TrailDots`), and does it share the Home route card's dots? (default: one component)
