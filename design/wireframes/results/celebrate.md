# Results/Celebrate — stars, card unlock, one next action (wireframe v1)

Spec: `docs/specs/F-MOTION-003-card-unlock-celebration.md` §3.1–3.5 (drop-in, sparkles, star gating, reduced motion) · `docs/specs/F-RVW-001-review-tests.md` §3.1 (stars-only, never a number), §3.3 (feedback question), §3.4 (certificate variant) · `docs/blueprints/10-app-map.md` §3.1, §4.1–4.2
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/results/ResultsScreen.tsx` — route `Results { questId, episodeId, stars, correct, total }`

## Scenario (Given-When-Then)

Given: the quest player finished the last step and reset the stack to `Main → Results`
When: the screen mounts
Then: the child sees Hoya, their stars and (on 2+ stars) the card that just joined their library, and has exactly one big thing to press next; the score is written once, before anything is tapped

## Screen goal

"Celebrate, record, and offer one next action."

## Box diagram

```
+----------------------------------+
|                                  |  <- no back / close: the stack was reset
|         [HOYA cheering]          |  <- thinking pose on 0-1 stars
|      "Wonderful!" (placeholder)  |  <- 1 word by tier
|          * * *                   |  <- star row (F-MOTION-004 pop)
|                                  |
| ( Hoya bubble: 1 line by tier )  |  <- never a %, ratio or fraction (F-RVW-001 sec.3.1)
|                                  |
|  +----------------------------+  |
|  |  CARD UNLOCK BANNER        |  |  <- stars >= 2 only; drops in after 0.4 s
|  |  "card added" + 1 muted ln |  |     (sec.3.1); sparkles only on 3 stars (sec.3.5)
|  +----------------------------+  |
|                                  |
|  ( feedback-review slot )        |  <- FUTURE (F-RVW-001 sec.3.3): 1 question
|                                  |
|   [[ BACK TO JOURNEY ]]          |  <- the ONE primary -> Main tabs
|   [ Episode page ]               |  <- ghost -> episode/detail
+----------------------------------+

Certificate variant (used by reviews/stage-review, FUTURE):
+----------------------------------+
|         [HOYA stage form]        |
|      "Stage 1 done!" (ph)        |
|          * * *                   |
|  +----------------------------+  |
|  | CERTIFICATE: learner name  |  |  <- name + Hoya stage form + date (sec.3.4)
|  |  stage title . date        |  |
|  +----------------------------+  |
|  [card][card][card][card] ->     |  <- collection wall, horizontal, this stage
|   [[ SEE MY CARDS ]]             |  -> library/gallery
+----------------------------------+
```

- The unlock banner is a *banner*, not the card art; the art is discovered in the Library (keeps this screen short and the Library visit rewarding).
- Reduced motion: banner and stars render statically (§3.4).

## Interaction points

- [[ BACK TO JOURNEY ]] → `Main` tabs (stack reset; lands on `home/todays-mission`)
- [ Episode page ] → `episode/detail` (episodeId) — the place to pick the next quest
- Banner tap → `library/card-detail` (cardId) (nice-to-have; banner is static today)
- **Future**: when `wrong >= 1`, the feedback-review slot asks one recall question before the CTA becomes active (F-RVW-001 §3.3); when the episode was the last of its stage, the CTA becomes "Now or later?" → `reviews/stage-review` (§3.4)

## Navigation graph

Enter from: `quest/player` (reset) · `reviews/stage-review` (certificate variant, future) · `reviews/daily-test` (future)
Exit to:    `Main` tabs (`home/todays-mission`) · `episode/detail` · `library/gallery` (certificate variant) · `reviews/feedback-review` (future)

## States

- **success**: as drawn; 3 tiers of copy; banner on 2+ stars.
- **empty** (0 stars, or quest without `rewardCardId`): no banner, Hoya thinking, same single CTA — never a blank middle; F-RVW-001 §3.1 asks for a 1-star floor on review surfaces (quests currently allow 0).
- **error** (progress write fails): celebration still renders (write is fire-and-forget); retry silently on next mount; telemetry never blocks the screen.

## Data needs

- reads: `questById` (`rewardCardId`), `episodeById`, route params `stars/correct/total`
- writes (on mount, once): `recordQuestComplete(profileId, {questId, episodeId, stars, accuracy, attempts})` · `unlockCard(profileId, rewardCardId)`
- telemetry: `quest.complete` `{stars, correct, total}` · `card.unlocked` · `card.first_earned` (first card ever)

## Open questions

- **Discrepancy**: `unlockCard` runs for any star count while the banner only shows on ≥ 2 stars (F-MOTION-003 §3.5 says "no card unlock on 1-star"). Either gate the write or show the banner always — a silently unlocked card is confusing in the Library.
- **Discrepancy**: the primary is labelled "Back to journey" but lands on the Home tab. Rename ("Done") or navigate to `journey/grid`.
- Should the *next quest* be the primary instead of Home (app-map §4.1 draws results → episode/detail)? Beta: measure "next quest within 60 s" for each option.
- Where does the future stage-review invitation live — here, or on `episode/detail` after the last quest? F-RVW-001 §3.4 says "when the results screen exits".
