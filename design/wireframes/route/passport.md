# Route/Passport — weekly quests and the stamps a learner collects, all shown in advance (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.5 (weekly quests and the Passport), §7.3 (the "Stage N complete" page in the Passport, `stage.card_opened`), §7.2 (albums, pack badge), §7.7 (anti-shame checklist), §4.8 (`stamps` field, merge earliest), §11.3 (`stamp.earned`, `weekly_quest.complete`), §12.2 (`weeklyQuests`) · row CM-60 builds it
Audience: **any learner, any age**; the same page for everyone. Learner screens only: a grown-up sees the same stamps in reports (F-REPORT-001), never on another learner's device.
Code (row CM-60): `apps/mobile/src/screens/passport/PassportScreen.tsx`; pure `logic/passport/weekly-quests.ts` (the deterministic pick) and `logic/passport/stamps.ts` (the stamp table, what earns each one, `stamps` latches)
Mock: `design/screens/journey-topic-pages/` (`mock/passport.html`; 320 and 768)
Notation: `[[ X ]]` the one primary action, `[ X ]` a button, `( x )` a text placeholder, `{ x }` content-driven, `(o)` a stamp collected, `( )` a stamp to collect.

## Scenario (Given-When-Then)

Given: a learner opens the Passport from Today's weekly quests card, the Library or a "Stage N complete" page
When: the Passport renders
Then: they see this week's three quests with the stamp each one gives, every milestone stamp with what earns it, and the stamps they have collected; nothing is random, nothing can be bought, and nothing is ever taken away

## Screen goal

"See which stamps I have and how to get the next one." (secondary: open a "Stage N complete" page)

## Box diagram — A. 320 x 568

```
+----------------------------------+
| [<- back]  Passport         (Aa) |
| (Stamps you collect as you learn.)|
|                                  |
| This week                        |  <- h2
| +------------------------------+ |
| | ( ) (Finish 2 stories)       | |  <- the stamp it gives, drawn in advance (outline)
| |     (o)( )                   | |  <- pips for a count quest; no fraction, no percent
| +------------------------------+ |
| | (o) (Refresh 20 items)       | |  <- collected: the stamp drawn in full, "Collected"
| |     (Collected)              | |
| +------------------------------+ |
| | ( ) (Visit Nature twice)     | |
| |     ( )( )                   | |
| +------------------------------+ |
| (New quests come next week.)     |  <- muted; never "expires", never a countdown
| [ See your weekly stamps ]       |  <- the earlier weeks' stamps, newest first
|                                  |
| Milestones                       |  <- h2
| (All)(Letters)(Food)(Holidays)(Nature)(Play)(Topics) <- filter chips, scroll sideways
| +-----------+ +-----------+      |
| |   (o)     | |   ( )     |      |  <- stamp tile: art, name, state line
| | First     | | Nature    |      |
| | Nature    | | album     |      |
| | lesson    | | (Collect  |      |
| | Collected | |  every    |      |
| |           | |  Nature   |      |
| |           | |  card)    |      |
| +-----------+ +-----------+      |
| ...                              |
|                                  |
| Stages                           |  <- h2: one row per finished stage
| [ (stage card) Stage 1 complete >]|  <- opens that "Stage N complete" page (stage.card_opened)
| [ (stage card) Stage 2 complete >]|
+----------------------------------+
```

## Box diagram — B. 768 x 1024 (one reading column)

```
+--------------------------------------------------------------+
| [<-] Passport                                           (Aa) |
| This week:  [ quest 1 ] [ quest 2 ] [ quest 3 ]              |  <- three cards in a row
| Milestones: chips, then a grid of four stamp tiles a row     |
| Stages: rows                                                 |
+--------------------------------------------------------------+
```

## The stamps

| Stamp | What earns it | Shown before it is earned as |
|---|---|---|
| Weekly quest stamp | each weekly quest done (3 a local week) | the quest's card in "This week" |
| First lesson in a theme | the first cell done in Letters, Food, Holidays, Nature or Play | "Finish one {theme} lesson" |
| Album | every card of a category album collected (§7.2) | "Collect every {theme} card" |
| Mastered column | every cell of a theme column at Mastered (§4.4) | "Master every {theme} lesson" |
| Pack badge | the pack's badge earned (Pack Check, §4.5) | "Finish the {pack} Pack Check" |
| Stage complete | the stage latch (§7.3) | not shown in advance as a stamp; the "Stages" list grows |

- **Deterministic and shown in advance.** Every milestone stamp is on the page from the first visit, with its earn line. A weekly quest's stamp is drawn on its card from Monday (local week).
- **Cosmetic only.** A stamp is its own art; an album stamp also adds a card-back variant for that album's cards (§7.5). Nothing else: no stars, no points, no content.
- **No chests, no random rewards, nothing to buy.** The page has no shop, no "open", no mystery item.
- **Never lost.** A collected stamp stays (`stamps` merges by earliest, §4.8). A weekly quest that is not done when the week ends simply leaves "This week"; it is never listed as missed.

## Weekly quests

- Three a local week (ISO week in the learner's local day, F-CURR-002 §4.8 `localDay`), picked deterministically from a 20-entry table by the ISO week and a hash of the profile id (§7.5). The same learner gets the same three on every device; no storage until one is done.
- Each quest is plain and reachable this week: "Finish 2 stories", "Refresh 20 items", "Try a game you have not played", "Visit Nature twice", "Read a culture note".
- A count quest shows pips (one per step, filled as done), never "1 of 2" or a percentage. A quest done shows its stamp in full and "Collected".
- Nothing nags: no notification, no reminder, no "only 2 days left".

## Interaction points

- [<- back] → where the learner came from.
- Weekly quest card → no action (the card says what to do; the learner does it in the app). A quest that names a place ("Visit Nature twice") has a [ Go to Journey ] link only when that place is one tap away; otherwise none.
- [ See your weekly stamps ] → a list of earlier weeks' stamps (newest first), each with its week ("Week of 12 October"), from `stamps`.
- Filter chip → filters the milestone grid.
- Stamp tile → a sheet with the stamp large, its name, its earn line, and (collected) the day it was collected; an album stamp shows the card back it adds.
- Stage row → that "Stage N complete" page; sends `stage.card_opened { stage }` (§7.3, G5).

## Navigation graph

Enter from: `home/todays-mission` (the weekly quests card, row CM-60) · the Library header's Passport link · `results/stage-complete` (each stage's "Stage N complete" page, row CM-22)
Exit to: the "Stage N complete" page · Journey (from a quest's link) · back

## States

- **success**: A, B.
- **empty** (nothing collected yet): every stamp in its outline with its earn line; "This week" as always; the Stages list hidden until Stage 1 is complete; one line under the title, "Your first stamp is one lesson away." (no zero count).
- **weekly quests off** (`weeklyQuests` off, §12.2): the "This week" section and its link are hidden; milestone stamps and stages stay.
- **pack stamps**: listed under "Topics" only for packs that are shown (`topicPacks`, `pack.<key>`); a collected pack badge stamp stays visible even if its pack is later hidden.
- **error** (progress unreadable): stamps drawn from the table with no collected look, and the Journey's muted "progress will show up in a moment" line.
- **offline**: everything is local; the weekly pick needs no network.
- **reduced motion**: a newly collected stamp appears without the stamp-press animation.
- **large text**: tiles become one a row; the chips wrap or scroll sideways inside their own row.

## Accessibility

- Each weekly card is one group: "Finish 2 stories. 1 done. Gives the stories stamp." (the pips as words with a plural form per locale, `plural()`; no fraction); a collected one: "Refresh 20 items. Collected."
- Each stamp tile is a button: "Nature album. Collect every Nature card." or "First Nature lesson. Collected."
- Collected and not-collected stamps differ by more than colour: the collected stamp is drawn in full with its glyph, the other is an outline, and the state line says it in words.
- Targets at least `touchTarget.min`; body text 18 or larger.

## Data needs

- reads: `stamps` (`Record<stampId, ISO>`, §4.8) · the stamp table (`logic/passport/stamps.ts`) · the weekly pick inputs: the local ISO week and the profile id (hashed on the device) · the progress each quest counts (sessions with `localDay`, stories, review answers) · `cellBest` and album state for milestones · `PRIZE_STAGES` and the stage latches for the Stages list
- writes: `stamps[stampId]` when a stamp is earned (in the quest or review flow that earns it, not on this page)
- telemetry: `stamp.earned { stampId }` and `weekly_quest.complete { questKind }` (row CM-60) from where they are earned; `stage.card_opened { stage }` from a stage row. No profile name, no week number tied to a person, no item ids.

## Proposed copy (row CM-60 lands the strings with es and ko; about 30 with the quest table)

| Intended key | English |
|---|---|
| `learner.passport.title` | Passport |
| `learner.passport.intro` | Stamps you collect as you learn. |
| `learner.passport.empty` | Your first stamp is one lesson away. |
| `learner.passport.week.title` | This week |
| `learner.passport.week.next` | New quests come next week. |
| `learner.passport.week.history` | See your weekly stamps |
| `learner.passport.week.of(date)` | Week of {date} |
| `learner.passport.collected` | Collected |
| `learner.passport.milestones` | Milestones |
| `learner.passport.stages` | Stages |
| `learner.passport.stageRow(n)` | Stage {n} complete |
| `learner.passport.filter.topics` | Topics |
| `learner.passport.stamp.firstLesson(theme)` | First {theme} lesson |
| `learner.passport.stamp.album(theme)` | {theme} album |
| `learner.passport.stamp.mastered(theme)` | {theme} mastered |
| `learner.passport.stamp.packBadge(pack)` | {pack} badge |
| `learner.passport.earn.firstLesson(theme)` | Finish one {theme} lesson |
| `learner.passport.earn.album(theme)` | Collect every {theme} card |
| `learner.passport.earn.mastered(theme)` | Master every {theme} lesson |
| `learner.passport.earn.packBadge(pack)` | Finish the {pack} Pack Check |
| `learner.passport.cardBack` | Adds a new card back |
| `learner.passport.quest.<kind>` | the 20 weekly quest lines ("Finish 2 stories", "Refresh 20 items", ...) |

- Theme and pack names inside these lines come from the theme titles and `CatalogPack.titleEn` in the UI locale; the Korean values write around particles (F-I18N-001 §3.10: never attach 은/는, 이/가, 을/를 to a variable).
- Never: "missed", "expired", "lost", "streak broken", "hurry", a countdown, a price, "open", "mystery", "chest".

## Open questions

- **Where a card back is chosen.** An album stamp adds a card-back variant; choosing it belongs on `library/card-detail` (row CM-60 or CM-23 decides). Default: the newest unlocked back is used, and card detail offers the choice.
- **The weekly quest table.** The 20 entries are row CM-60's; each must be doable in a week by a learner on the free plan, so none names Stage 2+ content only.
