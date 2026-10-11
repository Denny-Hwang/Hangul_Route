# Placement: Entry points: Home card and Profile row (`placement/home-entry`)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.10)
Audience: the learner, any age (CLAUDE.md section 1). Works for a child alone (big targets, spoken prompts) and for an adult (short, quiet).
Code (planned): `screens/home/HomeScreen.tsx` (card), `screens/profile/ProfileScreen.tsx` (row)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.
Promoted from `placement/placement.md` section H (F-PLC-001 P-0). The flow overview, the shared states and the screens of other flows stay in [`placement.md`](placement.md).

## Scenario (Given-When-Then)

Given: a learner who skipped the fork, or wants to check again, is on Home or Profile
When: they see a quiet invitation to take the level check
Then: they can take it, continue a saved run, or dismiss the card

## Screen goal

"Offer the level check later, quietly, without pushing it."

## Box diagram

```
Home (below the mission cards, above the progress bar)       Profile (a row under the stats)
┌───────────────────────────────┐                             ┌───────────────────────────┐
│ "Already know some Korean?"   │                             │ Find my starting spot     │
│ [ Take the level check ]      │                             │ again                [ > ] │
│                  [ Not now ]  │                             └───────────────────────────┘
└───────────────────────────────┘
```

- The Home card shows only when no result exists, fewer than 3 quests are done and it was not dismissed. "Not now" hides it until the learner opens Profile. While a run can be resumed it reads "Continue the level check".
- Profile row is not behind the PIN (a learner may do it alone).
- Only one quiet card shows between the mission cards and the progress bar: this one while eligible, then the route card of `curriculum-planner.md` H.
- Both -> B (or C with one language), `source` home / profile.

## Interaction points

- Take the level check (or Continue the level check): goes to the test language screen, `source` home.
- Not now: hides the Home card until the learner opens Profile.
- Profile row "Find my starting spot again": goes to the test language screen, `source` profile; not behind the PIN.

## Navigation graph

Enter from: `home/todays-mission`, `profile/settings`
Exit to: `placement/language` (or `placement/options` with one language)

## States

- **shown**: no result exists, fewer than 3 quests done, not dismissed.
- **resumable run**: the card reads "Continue the level check".
- **hidden**: a result exists, 3 or more quests done, dismissed, or the bank cannot load.
- **one quiet card**: this card while eligible, then the route card of `console/curriculum-planner.md` H.

## Data needs

- reads: placement results, quests done, the dismissed flag, a saved run, bank availability
- writes: the dismissed flag (through the safe storage hook)

## Open questions

- None open for this screen.
