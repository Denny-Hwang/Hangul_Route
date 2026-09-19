# Onboarding/First-Quest-Preview — Hoya intro + one door into the first quest (wireframe v1)

Spec: `docs/blueprints/10-app-map.md` §3.1 (`onboarding/first-quest-preview`), §4.1 · content: `apps/mobile/src/content/episodes.ts` (`episode:stage1-letters`)
Audience: **learner (P4/P5 child, 5–11)** — the parent has just handed the device over after creating the profile
Code (back-filled): `apps/mobile/src/screens/onboarding/FirstQuestPreviewScreen.tsx` — route `Onboarding/FirstQuestPreview { profileId }`

## Scenario (Given-When-Then)

Given: a learner profile was just created (`profiles/create-learner` finished) and no quest has ever been played
When: this screen renders
Then: Hoya says what is about to happen (letters + a card), and the child has exactly one thing to tap that starts the first quest

## Screen goal

"Turn a freshly created profile into a started quest with one tap."

## Box diagram

```
+----------------------------------+
|                                  |
|         [HOYA cheering]          |
|   "Your first card is waiting."  |  <- 1 title line, placeholder
|                                  |
|  ( Hoya bubble: what you'll meet |  <- 1-2 lines: N letters + a card
|    in the first quest )          |
|                                  |
|  +----------------------------+  |
|  | Episode 1 title            |  |  <- from content, not hardcoded
|  | N quests . ~M min . K cards|  |
|  | "You'll learn"             |  |
|  |  [ㄱ] [ㄴ] [ㄷ] [ㄹ] -> g n d l |  |  <- jamo = taught content, with romanization
|  +----------------------------+  |
|                                  |
|   [[ START MY JOURNEY ]]         |  <- the only CTA -> quest/player
+----------------------------------+
```

- No back control: going back to profile creation has no value for the child; the parent already finished. Hardware back is a no-op here (open question below).
- One CTA only. No "skip to home", no tabs visible yet.

## Interaction points

- [[ START MY JOURNEY ]] → `quest/player` with the first quest of the first shipped episode (`quest:stage1-letters-q1`, `episode:stage1-letters`); the navigation stack is reset to `Main` underneath so that `results/celebrate` returns to the tabs.
- Jamo chips: tap plays the jamo sound (nice-to-have; not in code)
- Hoya tap: no-op

## Navigation graph

Enter from: `profiles/create-learner` (first run only — `firstRun: true`)
Exit to:    `quest/player` (→ `minigame/shell` → `results/celebrate` → `home/todays-mission`)

## States

- **success**: as drawn, content-driven (episode title, quest count, minutes, card count, jamo list).
- **empty** (content bundle missing the first episode): fall back to the Hoya bubble + CTA that lands on `home/todays-mission`; never show an empty card.
- **error** (profile not persisted yet): CTA stays disabled with a 1-line "one moment" placeholder until `hydrated`; no retry UI needed because the store retries on its own.

## Data needs

- reads: `episodeById('episode:stage1-letters')`, its `questIds[0]`, `rewardCardIds.length`, `estimatedMinutes`; jamo list from the first quest's minigame scope (`logic/minigame-config`)
- writes: none (quest start is recorded by `quest/player` via `beginSession`)
- telemetry: candidate `onboarding.first_quest_cta` — count against `quest.complete` for the day-0 funnel

## Open questions

- **Discrepancy**: shipped CTA resets to `Main` (Home) instead of opening `quest/player` as app-map §4.1 draws. Decide: enter the quest directly (this wireframe) or land on Home with the first mission card pre-highlighted.
- The shipped summary card is hardcoded copy ("3 quests · about 12 minutes · 5 cards · ㄱ ㄴ ㄷ ㄹ"). Wire to content before the mid-fi pass so a content change cannot silently drift.
- Should hardware back re-open `profiles/create-learner` (add a sibling right away) or do nothing? Default: nothing; adding siblings lives in `profile/settings`.
