# Profile/Reading-practice — the romanization choice, and Hoya's one line when it first steps back (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ROMANIZATION-FADE.md` §3.9 (the line), §3.10 (the choice), §3.8 (the reveal on a Discover word) · owner decision 2026-11-22 (OD-R1, `docs/roadmap/review-2026-11/README.md` §4) · amends the "Reading practice" row of `profile/profile-split.md` Panel A and `profile/language-picker.md` (its Reading practice rows)
Audience: **learner** (any age; a grown-up beside a child may set it). Not behind the grown-up gate: it changes display only (F-I18N-001 L7).
Code today: `apps/mobile/src/components/ReadingPracticeCard.tsx` (one switch, `:29-43`) · `apps/mobile/src/screens/quest/QuestPlayerView.tsx` (`NarrativeStepBody`, `:495-550`) · `apps/mobile/src/screens/quest/DiscoverStep.tsx` (the word card, `:504-510`)

## Scenario (Given-When-Then)

Given: a learner who has met all the Stage 1 letters (quests 1 to 10 done, or placed out of them) and never changed the reading setting
When: they open their next quest, then its Look and learn page
Then: Hoya says once that they can read Hangul now, the words they can read show no romanization until a tap, and in Profile the Reading practice card shows **As I learn** chosen, with **Always** and **Only when I tap** one tap away

## Screen goal

An amendment wireframe over three existing screens (Profile, a quest's Hello step, Look and learn); each panel keeps its screen's one goal. Panel A: "Choose how much romanization I see." Panel B: "Know why the romanization stepped back, once." Panel C: "Read the word, and get the romanization with one tap if I need it."

## Box diagram

Panel A — Profile, the Reading practice card (replaces the one-switch row of `profile-split.md` Panel A), phone portrait

```
+--------------------------------+
| [< Back] Profile        ( Aa ) |
| (Mina)  (Jun)  [+ Add]         |
| Mina: quests 11 · cards 9 · ★2 |
|--------------------------------|
| Display    English · Standard >|
| Sound                       On |
|--------------------------------|
| Reading practice               |  <- card heading (existing string)
| Show romanization              |  <- the group's visible label and its accessible name
|  (•) As I learn                |  <- radio; one row = one touch target (>= touchTarget.min)
|      Shows less as you read    |  <- hint under this option only, secondary text
|      more.                     |
|  ( ) Always                    |  <- radio
|  ( ) Only when I tap           |  <- radio
|--------------------------------|
| Challenge                  Off |
| Find my starting spot again  > |
| ...                            |  <- rest of Panel A unchanged
+--------------------------------+
```

Panel B — the quest's first step (Hello), the one time the line is due

```
+--------------------------------+
| [x]  o . . . . .        [1 / 6]|
|  Mountain, River, Sea          |  <- quest title (English title, as today)
|  [ Hello ]                     |  <- step pill
|  +--------------------------+  |
|  |       [HOYA waving]      |  |
|  | ( the quest's own line ) |  |  <- unchanged
|  | ( You can read Hangul    |  |  <- the reading line: a second Hoya bubble,
|  |   now! Need help with a  |  |     once per profile, under the first
|  |   word? Tap Show how to  |  |
|  |   say it. )              |  |
|  +--------------------------+  |
|                                |
|   [[ CONTINUE ]]               |  <- unchanged; the line never blocks it
+--------------------------------+
```

Panel C — Look and learn, a word page, a word the learner can read (q11 `산`)

```
+--------------------------------+
| [x]  o o . . . .        [2 / 6]|
|  Words you can read now        |  <- page title (existing: an all-word page with no caption)
|  +--------------------------+  |
|  |          [ 산 ]          |  |  <- Hangul on the target chip
|  |   (               )      |  |  <- the romanization's room is kept, drawn empty
|  |        mountain          |  |  <- gloss: never hidden
|  |     [picture: mountain]  |  |
|  |       [ Hear it ]        |  |  <- the two buttons sit side by side when they fit,
|  |  [ Show how to say it ]  |  |     stacked otherwise (narrow width, large text);
|  +--------------------------+  |     after a tap "san" fills its room, the button goes
|  |                          |  |     and screen-reader focus moves to the word
|  |          [ 강 ]          |  |
|  |   (               )      |  |
|  |          river           |  |
|  |       [ Hear it ]        |  |
|  |  [ Show how to say it ]  |  |
|  +--------------------------+  |
|   [ Previous ] [[ CONTINUE ]]  |
+--------------------------------+
```

Panel D — in the reading phase, a word that holds a letter the learner has not met (a theme word): the romanization shows as today, no reveal button

```
|  +--------------------------+  |
|  |         [ 까치 ]         |  |  <- ㄲ is not a Stage 1 letter: not decodable, so shown
|  |          kkachi          |  |     (the same for a final ㅅ, as in 젓가락)
|  |          magpie          |  |
|  |       [ Hear it ]        |  |  <- no reveal button: nothing is hidden
|  +--------------------------+  |
```

## Interaction points

- Panel A: a radio → stored at once, no confirm sheet (reversible, display only) → `setRomanizationChoice(profileId, choice)`; `romanization.mode_changed { mode }` when the choice changed. The card shows the **stored choice** (`romanizationChoiceOf`), never the resolved mode and never an All lessons override.
- Panel B: no action of its own. The line shows on the Hello step of the first quest run that starts while the line is due (spec §3.9); it is marked shown when that step mounts. Continue works as always.
- Panel C: **Show how to say it** → the word's romanization fills its kept room; the button goes; the word's accessible name gains the romanization. Nothing is scored, counted or remembered beyond the page visit (the existing `revealed` list of the Discover state). **Hear it** is unchanged.
- The Words cards screen keeps its in-game **Reading practice** switch (On / Off): On stores **Only when I tap**, Off stores **Always**; it shows On while the resolved mode of that screen is `tap` (spec §3.10). Back to **As I learn** is in Profile only.

## Navigation graph

Enter Panel A from: Home (Profile button) · Results "Profile" links. Exit: unchanged (Panel A of `profile-split.md`).
Enter Panel B from: any quest start (Home next-lesson hero, Journey cell, Episode detail, a plan item). Exit: the next step (Continue) · Close → the leave sheet (unchanged).
Enter Panel C from: Panel B → Continue. Exit: the next page or step (Continue) · Previous.

## States

- **success**: Panels A to C.
- **As I learn, still learning letters** (quests 1 to 10 not all met): Panel A as drawn; no line in Panel B; every word in Panel C shows its romanization as today (no reveal button on a `word` card).
- **Always chosen**: no line ever; Panel C shows every romanization.
- **Only when I tap chosen**: no line; Panel C folds every word card and example (as Panel C), whatever was met; a letter card's own sound (`g/k`) still shows (F-QUEST-002 §3.2).
- **A screen reader in use** (VoiceOver or TalkBack on, or the device's "I use a screen reader" on the web): As I learn shows romanization everywhere, as Always does; no line (spec §3.13, OD-RF-3).
- **No learner profile** (All lessons, the presenter): no card; their own display setting (Always / Only when I tap) wins (F-BROWSE-001 §4.9).
- **Korean or Spanish UI**: the same layout; the card's words and Hoya's line come from the selected UI locale; the romanization is the same Revised Romanization in every locale (F-I18N-001 §3.5).
- **loading**: progress not read yet → resolved as "still learning letters" (shown), no line until it is read.
- **error**: a stored choice this version does not know reads as absent (the default); the card shows the default chosen; nothing else is lost.
- **empty**: not applicable (the card always has its three options).

## Data needs

- Per profile, local only (`hr:settings:<id>`): `romanizationChoice` (new, optional), the legacy `romanizationMode` (kept, mirrored on write), `romanizationNoticeAt` (new, optional, when the line was shown).
- The learner's progress snapshot (read only): finished quests, the level check's placed-out quests, test-outs (spec §3.3).
- The device's screen-reader signal (native) or `device:settings.screenReader` (web).
- Strings: `learner.profile.reading.*`, `learner.quest.readingNotice` (spec §3.11).

## Open questions

- Whether **As I learn** should also show a one-line status ("Now: words you can read hide their romanization") once the fade has started. Not in v1: the hint line and Hoya's line say it; the mock pass (row RF-0b) may propose it. **Settled by RF-0b (Q6): not added.**
- Panel A grows the Profile page by about three rows; the mock pass checks 320 x 568 at 200 % text. **Settled by RF-0b (Q7): +160 px; at 320 x 568 and 200 % the card is 20 px taller than the window, Profile scrolls.**
- **[RF-0b] Amended 2026-11-26** (`design/screens/profile/reading-practice.md` Q4, Q5): in Panel B the line's bubble has no Hoya figure of its own, and on that one run the card does not draw the waving Hoya at its top, so Continue stays where it is today.
