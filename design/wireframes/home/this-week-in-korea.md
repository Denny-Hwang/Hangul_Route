# Home / This week in Korea: one small calendar lesson a week (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §5.7 ("This week in Korea", row CM-48: one micro-lesson a week of about 2 minutes and 5 items, keyed to the calendar, bundled and date-gated on the device), §4.2 and §4.8 (its items enter review in the `week` memory shard), §7.7 (anti-shame checklist), §10 ("Offline": it works offline), §12.2 (`weeklyDrop` off hides the surface), §14 (time zones: the ISO week on the local day)
Base screens: `home/next-lesson-hero.md` (the hero and its one Start stay the primary action on Home), `home/todays-mission.md`, `reviews/daily-review.md` (the rounds, the [x] and the dots are reused as they are), `layout/wide.md` B (two columns)
Audience: **learner, any age** (P4 / P5 / P6). Grown-ups see it over a learner's shoulder; nothing here addresses them.
Built by row **CM-48** behind `weeklyDrop` (built-in pct 0: it merges dark). No mock beyond this wireframe: the card reuses Home's sunken card, the pages reuse the Daily Review's top row, rounds and Hoya, so no new visual pattern is drawn (MAR design review below).

Notation: `[[ X ]]` the one primary action of a page, `[ X ]` secondary, `( )` a pill or icon. All copy in boxes is placeholder; the final strings live in `packages/i18n` (`learner.weekDrop`), and the drop's own text (title, note, words) is content (`content/weekly/<monday>.json` and its es / ko overlays).

## Scenario (Given-When-Then)

Given: a learner with `weeklyDrop` on opens Home in a week that has a drop (any day, Monday to Sunday, on their own device's calendar)
When: they tap the "This week in Korea" card
Then: they meet the week's calendar moment (a solar term or a holiday) in two or three plain sentences with its source, hear and read its 5 words, practise them in 5 quick rounds, and are told the next one comes next week; a week they skipped is never mentioned anywhere

## Screen goal

"Learn this week's little piece of the Korean calendar in about 2 minutes."

The card is secondary on Home (the Next lesson hero stays the one primary). On the drop's own pages each page has one primary action.

---

## A. Home: the card

```
A1. This week's drop, not opened yet (one column, after Today's cards and the note card)
+----------------------------------+
| ... Today with Hoya (1)(2)(3) ... |
|                                  |
| +------------------------------+ |  <- ONE button (-> B), sunken card, min height touchTarget.min
| | (sparkle) This week in Korea | |  <- heading, caption weight
| | 입동 Ipdong                    | |  <- the drop's first word: taught Korean + romanization
| | Winter Begins · About 2 min ▸| |  <- the title in the UI language and its minutes
| +------------------------------+ |
|                                  |
| (progress / homework / tip ...)  |
+----------------------------------+

A2. Done this week (the same card, same place, still a button: it opens B again)
| | (sparkle) This week in Korea | |
| | 입동 Ipdong                    | |
| | (check) Done for this week   ▸| |  <- replaces the minutes; calm, no count, no score

A3. Regular and wide windows (layout/wide.md B): the card heads the side column, under the note card.
```

- One card a week, keyed by the Monday of the ISO week on the device's local day (Monday to Sunday in every locale, as `steadyWeeks`): two devices on different UI locales, or a language switch, show the same drop. At local midnight from Sunday to Monday the card shows the new week's drop (Home's day clock, `useToday('local')`).
- There is no list of past weeks, no "missed", no "new since", no badge count and no streak of weeks. A week with no drop has no card (A0). Opening last week's drop is not offered; its words are already in review.
- The card shows only while `weeklyDrop` is on for the learner. Off: no card, no route, and the memory states its words earned stay (§12.2).

## B. Meet: the moment and its words

```
B. 320 x 568, the drop's page (pushed screen, [x] top left as the Daily Review's)
+----------------------------------+
| [x]                              |  <- close: back to Home (no confirm: nothing is lost)
| This week in Korea               |  <- heading (caption)
| Winter Begins                    |  <- the drop's title (title level), the page's heading
| +------------------------------+ |
| | 입동 ipdong falls on 7       | |  <- the note: UI text with {ko:} tokens drawn as taught
| | November. Winter is said to  | |     Korean + romanization on a sunken chip (the culture
| | begin on this day. ...       | |     tip's look)
| | Source: Korea Astronomy and  | |  <- the first source in the card back's citation format,
| | Space Science Institute, ... | |     "and N more sources"; never a URL
| +------------------------------+ |
|                                  |
| (spk) 입동  ipdong               |  <- 5 word rows: speaker button (48 dp, -> device voice),
|       Start of Winter, ...       |     the Korean, its romanization, its meaning (UI language)
| (spk) 겨울  gyeoul               |
|       winter                     |
| ... (3 more rows; the page scrolls) |
|                                  |
| [[ Practice the words ]]         |  <- the one primary (-> C)
+----------------------------------+
```

- Every word row is one group for a screen reader ("ipdong, Start of Winter, a solar term"); its speaker is its own button named with the shipped "Hear {romanization}" label. With no device voice the speakers are left out and the rows still read (F-AUDIO-004).
- 320 px at 200 % text: the rows wrap; the primary stays full width; nothing is cut.

## C. Practice: 5 quick rounds

```
C. The Daily Review's round view, as is (reviews/daily-review.md B and B2)
+----------------------------------+
| [x] (o)(o)(.)(.)(.)              |  <- [x] and fill-only dots (5): no "n of m", no %
|  ... one round: hear it, pick it / read it, pick its meaning ...       |
+----------------------------------+
```

- The rounds are the review engine's for the drop's 5 words (`buildCheck` over the drop's items, at the recognize or read rung: quick picks), with the shipped round views, amber nudge and Hoya's thinking pose on a miss; a miss never ends the practice, there is no timer, and no score is shown.
- Each round's first answer is recorded in the memory store (the spacing rule of §4.3), so the words enter review in the `week` shard (§4.8). With `memoryRecord` off nothing is recorded and the practice still plays.
- [x] over a round goes back to Home at once; the answers given are kept (as a stopped Daily Review keeps them). Nothing else is written.
- Fewer than 3 rounds can be built (the review items cannot load, say offline before the precache): C is skipped and B's primary goes straight to D.

## D. Done

```
D.
+----------------------------------+
|            (Hoya cheering)       |
|      Done for this week          |  <- display headline (DailyReview's DisplayHeadline)
|   A new one comes next week.     |  <- one calm line; never "don't miss", never a count
|                                  |
| [[ Back home ]]                  |  <- the one primary (-> Home, card A2)
+----------------------------------+
```

- D latches the week as done on this device (A2 next time). It gives no stars, cards or points: the drop is a small extra, not a quest, so it never adds a chore or a debt (§7.7).

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| A card | tap / Enter | `WeekDrop` route (B) |
| B speaker | tap | the device voice says the word (the shipped audio path); no record |
| B Practice the words | tap | C (or D when no rounds can be built) |
| B, C [x] | tap / Escape | back to Home; C's answers so far stay recorded |
| C round | answer | the shipped round behaviour; the next round, then D after the last |
| D Back home | tap | Home (card A2) |

## Navigation graph

Enter from: `tabs/home` (card A only; no deep link, no URL carries a week or a profile)
Exit to: `tabs/home` (D, [x])

## States

- **success**: A1 → B → C → D → A2.
- **empty**: no drop for this week (before the first one, or past the last bundled one until the next quarterly batch ships): no card (A0); Home is as before.
- **error**: the drop's chunk cannot load (offline before the precache, a newer build): no card on Home; if it fails after the card showed, B shows the shipped waiting frame and then the crash screen's Try again (the lesson chunk path). The review items cannot load: C is skipped (B → D).
- **offline**: the drops are bundled and precached, the week is the device's own calendar: A to D work with the network off.
- **flag off** (`weeklyDrop`): no card, no route; memory states stay; the review engine skips items whose only source is a drop.
- **reduced motion**: Hoya is static; rounds as the Daily Review's.
- **wide window**: A3; B to D are reading-width pages.

## Data needs

- reads: the start bundle's list of weeks with a drop (`WEEK_DROP_WEEKS`, generated) and the local day; the drop itself from its precached chunk (`week-drops`); the review items and the learner's memory rows (memory chunk) to plan C; the "done" weeks of this profile on this device (`week-drop:<profileId>`, through `platform/storage`, removed with the profile).
- writes: each C round's first answer (`recordAnswers`, the `week` shard); the done week (device only, never synced: a second device just shows A1 again, which is a harmless second look).
- telemetry: none new. No TELEMETRY-NAMES-2 section R name is added for this surface; the rounds' memory recording sends nothing per item (§11.1).

## Proposed copy (en; es and ko in the same PR)

| Key | English |
|---|---|
| `learner.weekDrop.heading` | This week in Korea |
| `learner.weekDrop.practice.cta` | Practice the words |
| `learner.weekDrop.done` | Done for this week |
| `learner.weekDrop.next` | A new one comes next week. |

Reused, unchanged: the Next lesson minutes ("About 2 minutes"), `a11y.minigame.hear`, the card back's citation lines, the Daily Review's close label and round views, Back home.

## MAR design review (2026-10-30)

Three lenses, then a reviser pass; recorded here before any UI code (CLAUDE.md §5: wireframe before component).

1. **Anti-shame and audience (§7.7, CLAUDE.md §1).** Pass: no past-week list, no "missed" or "late", no streak of weeks, no count of drops done, no score or %, no timer, no red. Done says "Done for this week" and "A new one comes next week": forward-looking, calm. No age words, no speaking UI (listen only). Decided in review: a catch-up offer for an unopened past week is not added in any form, and a week with no drop is silent (no card, no placeholder).
2. **Hierarchy and touch (F-LAYOUT-001, 320 px).** Pass: the card is secondary (sunken, below Today's cards in one column, under the note card in two), so the hero's Start stays the one primary on Home; the card is one 48 dp+ button; speakers are 48 dp; B's primary is full width; rows wrap at 200 % text. Decided in review: the minutes sit on the title line, so A fits three lines at 320 px.
3. **Learning design (§4.3, §5.7).** Pass: 5 words met with sound, romanization and meaning before 5 quick retrieval rounds, about 2 minutes; rounds are the review engine's, so the words enter spaced review in the `week` shard; past drops' words come back through Daily Review, not as overdue lessons. Decided in review: a done drop can be opened again (A2) for a second look; a re-practice the same day moves no box (the spacing rule) and the drop gives no points, so nothing can be farmed.

Reviser: the three decisions above are applied in this file. No copy here claims a native-speaker or expert review; the language and culture review of the drops themselves is the content MAR of §9.2, recorded in each drop file.

## Open questions

1. A drop from last week stays reachable only through review. If beta learners ask to read last week's note again, a "Past weeks" list behind the card is a later row (it must keep the no-count, no-missed rule).
2. The done mark is device-only. If families on two devices find the repeated A1 confusing, the week can move into the synced snapshot (an additive field, Worker first) in a later row.
