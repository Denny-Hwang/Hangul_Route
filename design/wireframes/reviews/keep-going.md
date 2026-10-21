# Reviews/Keep going — an optional 10 more after the Daily Review (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.5 (sessions table: "Keep going", 10 more items, up to 3 times a day, "never required; never shown as owed"), §4.3 (due pool and selection order), §4.8 step 3 (the day's draw before Keep going), §7.4 (Keep going earns 2 points), §7.7 (anti-shame checklist), §12.2 (`dailyReview` off hides it too)
Extends: `reviews/daily-review.md` (the round screen B, the stop sheet E and the result C are the same; this file draws only what differs)
Audience: **learner, any age** (P4 / P5 / P6). No grown-up control on this screen.
Mock: `design/screens/keep-going/` (shots at 320 and 768) · Built by row **CM-14**

## Scenario (Given-When-Then)

Given: a learner finished today's Daily Review and some items are still due
When: the result offers "Want a few more?" and they tap Keep going
Then: 10 more rounds from the due pool play in the same screen; the result shows stars and what got stronger and, while items remain and fewer than 3 Keep goings were played today, offers one more; nothing ever says how many are left or that more is expected

## Screen goal

"More practice if I feel like it, and a clear, happy place to stop."

## Box diagram

```
A. The offer (on the Daily Review result, and on a Keep going result)
|   [[        BACK HOME        ]]|  <- the ONE primary: stopping is the default
|   Want a few more?             |  <- one line, no count of what is left
|   [ Keep going ]               |  <- secondary (ghost, full width, touchTarget.min)

B. A round: reviews/daily-review.md B (same screen, same dots row of 10, same [x])

C. Keep going result
+--------------------------------+
|        [hoya - cheering]       |
|          Great work!           |  <- one word per star tier
|            * * *               |
|   [up] 4 got stronger          |
|   (ring) Daily goal done       |  <- goal line, with `goals` on
|   [[        BACK HOME        ]]|
|   Want a few more?             |  <- A again, only while due items remain
|   [ Keep going ]               |     and fewer than 3 Keep goings today
+--------------------------------+

D. The last offer is used, or the pool is empty
|        [hoya - cheering]       |
|          Wonderful!            |
|            * * *               |
|   [up] 5 got stronger          |
|   That is plenty for today.    |  <- one calm line instead of the offer
|   Hoya will bring the rest     |
|   back soon.                   |
|   [[        BACK HOME        ]]|

E. Done today (the collected Daily Review card on Home is tapped)
+--------------------------------+
| [<- back]                      |
|        [hoya - waving]         |
|   Daily Review done today      |
|   (ring) Daily goal done       |
|   Want a few more?             |  <- only while a Keep going is still on offer;
|   [[ KEEP GOING ]]             |     here it is the primary, because the learner
|   [ Back home ]                |     came back for more on their own
|   -- or, with nothing on offer:|
|   All refreshed today          |
|   [[ BACK HOME ]]              |
+--------------------------------+
```

- No count of remaining items, no "unfinished" badge and no second card on Home; the Daily Review card stays collected after the Daily Review whether or not Keep going is played.
- Keep going never appears on Home on its own and never as a notification.
- Each Keep going is its own session: its stars are for its own 10 rounds; a Keep going stopped early earns no points and changes nothing else.

## Interaction points

- A: [ Keep going ] -> B round 1; `review.start { kind: 'daily' }` (a Keep going is a `daily`-kind review, §11.3; its `reviews[]` entry carries `keepGoing: 1..3` for reports only).
- A / C / D: [[ BACK HOME ]] -> Home.
- B: as `reviews/daily-review.md` B, B2 and E.
- Last round -> C (offer left) or D (none left); `review.complete`; 2 points to today's `dayLog` (§7.4).
- E: [<- back] -> Home; [[ KEEP GOING ]] -> B; [ Back home ] -> Home.

## Navigation graph

Enter from: `reviews/daily-review` C · `reviews/keep-going` C · Home card 3 collected (-> E)
Exit to: `home/todays-mission` · `reviews/keep-going` B

## States

- **offer**: due items remain after the session and fewer than 3 Keep goings were played today (local day) -> A.
- **no offer**: the pool is empty, or 3 Keep goings were played -> D's calm line (after a Keep going) or the Daily Review's plain result (after the Daily Review, with no offer row at all).
- **ends early**: the pool runs out inside a Keep going -> C or D with the stars of what was answered.
- **stopped**: the stop sheet of `reviews/daily-review.md` E; nothing is lost; the next offer still shows on E.
- **offline**: as the Daily Review (local engine, precached items).
- **`dailyReview` off**: no Daily Review, so no Keep going; a deep link shows the Daily Review's D page.
- **reduced motion**: as the Daily Review.
- **320 and 768**: as the Daily Review; the offer row stays under the primary at every width.

## Accessibility

- The offer is one group: the line "Want a few more?" is the button's description, so the button reads "Keep going, want a few more?".
- D's line is read after the stars and the "got stronger" count; focus starts on the headline.
- Buttons are `touchTarget.min` (64) or more; nothing relies on colour.

## Anti-shame checklist (§7.7)

| Rule | Here |
|---|---|
| no red for a miss | as the Daily Review: amber nudge only |
| no visible decay | nothing drops or fades; D says the rest comes back soon |
| no lost streak copy | none |
| no percentage | none |
| no per-question timer | none |
| no random rewards | stars by F-RVW-001 §3.1 |
| no purchasable rewards | none |
| no comparison between learners | none |
| no bad ending | stopping is the primary button and every end is a cheer |
| no age wording | none |
| no speaking UI | none |
| no emoji | none |
| (§4.5) never shown as owed | no count left, no badge, no reminder; Back home is the primary on A, C and D. Only E, a page the learner opened on their own to do more, makes Keep going the primary, and it still says nothing about what is left |

## Data needs

- reads: the engine's due pool after the session (`hasMoreDue`), today's Keep going count (from `reviews[]` entries of the local day), `dayLog`
- writes: answers to the memory store; one `reviews[]` entry per finished Keep going; 2 points in `dayLog[today][installKey]`
- telemetry: `review.start` / `review.complete` (`kind: 'daily'`); nothing new

## Proposed copy (English; keys for CM-14, which adds es and ko)

| Key | English |
|---|---|
| `learner.keepGoing.offer` | Want a few more? |
| `learner.keepGoing.cta` | Keep going |
| `learner.keepGoing.enough.title` | That is plenty for today. |
| `learner.keepGoing.enough.body` | Hoya will bring the rest back soon. |
| `learner.keepGoing.doneToday.title` | Daily Review done today |

Results reuse `learner.dailyReview.result.*`; the round and stop sheet reuse `learner.dailyReview.leave.*`.

## Open questions

- None blocking CM-14. The simulation gate (§4.3, row CM-13) may tune the size of a Keep going; the screen only shows the dots row for whatever size the engine returns (10 at most).
