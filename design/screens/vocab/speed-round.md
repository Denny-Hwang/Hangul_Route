# Speed Round: the start sheet, the question screen and the stop sheet (F-VOC-004 S-5)

Spec: `docs/specs/F-VOC-004-speed-round.md` S1-S8, §3.1 (entry, availability), §3.5 (start sheet), §3.6 (question screen, reveal, stop sheet), §3.8 (accessibility, timing, no flashing), §3.10 (telemetry).
Wireframe: `design/wireframes/vocab/speed-round.md` frames A (start sheet), B to F (question and reveals, drawn by `VocabQuestionView`), I (stop sheet, empty states). Frame G (the Challenge clock and the pause overlay) is S-6.
Code: `apps/mobile/src/screens/vocab/VocabSpeedRoundScreen.tsx` and `useSpeedClock.ts` (render, effects and the tick only); decisions in `apps/mobile/src/logic/vocab/{speed-round,speed-session,session-clock,question-builder,select-words,nudges}.ts` (100 % covered); the background signal is `apps/mobile/src/platform/app-state(.web).ts`; answers go through `store/vocab-run-store.ts` to `progress-store.recordVocab`.
Components: `SparkMeter`, `Progress` (`dots`), `Heading`, `Body`, `Button`, `HoyaBubble` (design system); `VocabQuestionView`, `PictureArt`, `BackButton` (app).
Screenshots: `pnpm --filter @hangul-route/mobile build:web:fixtures`, then `HR_SHOTS=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-speed` writes `apps/mobile/e2e/web/__shots__/vocab-speed-*.png` (git-ignored). Words stays behind `flags.vocabTopicsEnabled` (C-7), so the fixture bundle opens the topic page with `window.__hrVocabE2E.openTopic(key)`, collects words with `collect(ids)` and taps **Speed round**.

S-5 ships **Relaxed only**: no clock anywhere, no Challenge control on the sheet, no Pause button. S-6 adds the opt-in Challenge switch, the clock scale, the clock row and the pause overlay to these same screens.

## Frames

```
A  Start sheet (Relaxed)              A' Too few words                  A'' Nothing to play
┌────────────────────────────────┐    ┌────────────────────────────┐    ┌────────────────────────────┐
│ [<-]                           │    │ [<-]                       │    │ [<-]                       │
│ ┌──────┐                       │    │ Food                       │    │ Food                       │
│ │[pic] │  Food                 │    │ Speed round                │    │ Speed round                │
│ └──────┘  Speed round          │    │ Learn a few more words     │    │ Nothing to play yet        │
│                                │    │ first                      │    │ [[ BACK ]]                 │
│ Relaxed                        │    │ [[ LEARN ]]  (or BACK TO   │    └────────────────────────────┘
│ 10 words. No clock.            │    │   TOPIC before C-5)        │
│                                │    └────────────────────────────┘
│ No sound on this device.       │  <- only when sound questions are dropped
│ Pictures and words only.       │
│                                │
│ [[ START ]]                    │  <- 80 dp, full width
└────────────────────────────────┘

B-F  Question (Relaxed)                         I  Stop for now?
┌────────────────────────────────┐              ┌────────────────────────────────┐
│ [<-]  * * * . . . . . . .      │ <- sparks    │      (dimmed question)         │
│       o o o . . . . . . .      │ <- dots      │ ┌────────────────────────────┐ │
│                                │              │ │ Stop for now?              │ │
│   VocabQuestionView            │              │ │ The words you answered     │ │
│   (prompt, options, reveal,    │              │ │ stay saved.                │ │
│    Hoya's line)                │              │ │ [[ KEEP PLAYING ]]         │ │
│                                │              │ │ [ STOP ]                   │ │
└────────────────────────────────┘              │ └────────────────────────────┘ │
                                                └────────────────────────────────┘
```

## Start sheet, top to bottom

1. **Back** top-left (`BackButton`, 64 dp): back to the topic page (or the Library's Words section with no history).
2. **Header**: the topic's cover picture (`PictureArt`, decorative, `touchTarget.hero` 96 dp) beside the topic title (`Heading level="display"`, the UI language) and **Speed round** (`Heading level="title"`).
3. **Mode**: "Relaxed" (`Body weight="semibold"`) and its one line, "10 words. No clock.": the number is the round's real question count. The level asks for 10 (8 for Pictures first), and the builder asks each collected word in each allowed format at most once, so a few collected words give fewer (4 words without sound at Some reading: 8). Nothing mentions an age or a level name.
4. **No sound line** (`Body tone="secondary"`), only when the round will have no sound questions: no Korean voice and no bundled clip (`canPlayKorean`), or sound switched off. Calm, no icon of failure.
5. **Start**: `Button tone="primary" size="lg"` (80 dp, `touchTarget.child`), full width. The sheet builds the round while it shows (`buildRound`: the words from `selectSpeedWords`, due words first, asked through `buildQuestions` with `seed = Date.now()` taken when the sheet opens), so its line can name the real count; Start emits `vocab.round.start` and shows question 1 of exactly those questions.

`canPlay` is fixed when Start is tapped (S7): a voice that appears later does not add sound questions to a running round, and one that fails mid-round shows the word as text (the question view does that).

## Question screen

- **Header** (one line at 320 wide, `design/components/SparkMeter/spec.md` "Width at 320 wide"): Back (64) then the `SparkMeter` (204), and under the meter the round's question dots (`Progress variant="dots"`, `max` = the questions, `value` = the questions answered; hidden from assistive technology). Both only fill. The meter is wrapped in a polite live region, so its name ("3 sparks") is read once when a spark lights, at most once a question; a miss changes nothing, so nothing is read.
- **Body**: `VocabQuestionView mode="speed"` keyed by the question, with Hoya's line chosen by `hoyaLine` (logic): "Ready when you are." on the first question, the right or gentle-miss line during a reveal, "Take your time." from 12 s on one question (Relaxed hints), and the soft ring on the right option from 20 s. Hints are off while a screen reader is on (`hintsEnabled = false`).
- **No clock element at all** in Relaxed (no bar, no digits, no Pause).
- The reveal beats are the question view's (600 ms right, 1000 ms miss); its `onAdvance` is the session's `reveal-done`.
- `useSpeedClock` sends the session `tick` every 250 ms from a monotonic clock (`performance.now()`), only while a question is on screen and the stop sheet is closed; a delta is capped at 2 s (`tickDelta`), so a frozen tab never jumps a hint or a clock.
- Each first tap writes one `answer` event at once (`source: 'speed'`, the format, `ms`, `hinted`), so a closed app loses nothing.

## Stop sheet

Back and the system back (`beforeRemove`) open "Stop for now?" over the dimmed question (a bottom sheet, the Hangul Check's pattern): **Keep playing** (primary) and **Stop** (ghost). A tap on the dimmed area keeps playing. Stop leaves without a results screen and writes no session; the answers already given stay written. While the sheet is open the session does not tick (Relaxed: the hint timer waits).

## End of the round

After the last reveal the screen summarises the round (`summarize`), writes the `session` event (stars, caught, mode, how it ended) and replaces itself with the results (`VocabResults`, `design/screens/vocab/results.md`), emitting `vocab.round.complete`. A round with no answer (impossible in Relaxed, which ends only after the questions) writes nothing and shows no results.

## States

| State | What shows |
|---|---|
| fewer collected words than the level's options (3 Pictures first, 4 otherwise) | A': "Learn a few more words first" and **Learn** (the flashcards, once C-5 registers them; before that **Back to topic**): never a dead end |
| the builder makes no question (pictures that do not resolve in a partial bundle) | A'': "Nothing to play yet" and **Back** |
| progress not hydrated or unreadable | the sheet as for nothing collected (A'); nothing is written |
| a topic the picker does not show | "Topic not found" and **Back** (the topic page's state) |
| no Korean voice, or sound off | the no-sound line; the round has word-to-picture and picture-to-word questions only |
| the voice fails mid-round | the sound question shows its word as text and scores normally (question view) |

## Accessibility

- Back, Start, Keep playing and Stop are buttons (64 / 80 dp); option sizes are the question view's (96 pictures, 80 words).
- Focus moves to the prompt on every new question (question view); the outcome is said in words.
- The spark meter is one image element named "3 sparks" ("Full of sparks" once full), read politely once when it changes; the question dots are hidden.
- No live clock, no ticking, no countdown sound (Relaxed has no clock).
- 320 x 568 and 200 % text: the screen scrolls (`Screen scrollable`); options keep their minimum size.
- Reduced motion: the spark appears instantly (`SparkMeter`).

## Decisions taken while building

- **Practice before C-5**: the Learn button of A' opens the flashcards only when their screen is in the build (`VOCAB_SCREENS.learn`); before C-5 it is **Back to topic**, so the sheet never offers a button that goes nowhere.
- **The background signal is wired in S-5** (`subscribeAppActive` sends `pause('background')`); Relaxed ignores a pause in the reducer (no clock), so leaving the app simply continues, and S-6's Challenge gets the pause with no new wiring.
- **`vocab.round.complete` is sent as the results open**, from the round screen (it holds `pauses` and `activeMs`), once per round; a reload of the results never sends it twice.

---

## Challenge mode (F-VOC-004 S-6)

Spec: S1, S2, S8, S9, §3.1 (setters), §3.5 (switch and scale), §3.6 (clock, pause, time up), §3.8 (timing adjustable, no flashing, screen readers). Wireframe: frames A (the Challenge part) and G. Code: `VocabSpeedRoundScreen.tsx` (sheet, clock row, pause overlay, time-up beat), `screens/vocab/ChallengeCard.tsx` (Profile) with `ChallengeControls.tsx` (chips, switch row, clock, paused panel), decisions in `logic/vocab/challenge.ts` (100 % covered), setters `setChallengeMode` / `setClockScale` in `store/locale-store.ts`.

```
A1 Not opted in (Relaxed)          A2 Opted in, Challenge chosen       G  Question with the clock          G' Paused                       G'' Time up
┌──────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ [<-]                         │   │ [<-]                         │   │ [<-]        0:42   [ PAUSE ] │   │ [<-]   0:42              │   │                          │
│ [pic] Food / Speed round     │   │ [pic] Food / Speed round     │   │ * * * . . . . . . .          │   │ * * * . . . .            │   │                          │
│                              │   │ ( Relaxed )( Challenge* )    │   │ [##########---------]        │   │ [######-------]          │   │  That's the time!        │
│ Relaxed                      │   │ One clock: 60 seconds for    │   │ (A few seconds left)         │   │                          │   │  Nice work.              │
│ 10 words. No clock.          │   │ the whole round.             │   │                              │   │  Paused                  │   │                          │
│                              │   │ Clock                        │   │  VocabQuestionView           │   │  [[ RESUME ]]            │   │                          │
│ [ Try Challenge      (o  ) ] │   │ (Normal*)(A bit longer)      │   │  (no hints, no idle line)    │   │  [ STOP ]                │   │                          │
│ Adds a 60-second clock. You  │   │ (Twice as long)              │   │                              │   │  (question hidden)       │   │                          │
│ can turn it off any time.    │   │ The clock stops while you    │   │                              │   │                          │   │                          │
│                              │   │ read the answer.             │   │                              │   │                          │   │                          │
│ [[ START ]]                  │   │ [[ START ]]                  │   └──────────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
└──────────────────────────────┘   └──────────────────────────────┘
```

### Start sheet

- **Not opted in** (`challengeMode` absent or false): the Relaxed block as before, then a quiet switch row **Try Challenge** (`accessibilityRole="switch"`, unchecked, 64 dp, `Body weight="semibold"`, an off `Pill`) and its line "Adds a 60-second clock. You can turn it off any time." (`Body tone="secondary"`). Turning it on is the explicit opt-in: `setChallengeMode(profileId, true, 'start_sheet')`, then the sheet shows the opted-in layout with **Challenge selected for this round**.
- **Opted in**: a two-option segmented row **Relaxed | Challenge** (`OptionCard`-style chips, `accessibilityRole="radio"` in a `radiogroup` named "Round type", 64 dp). Relaxed is selected unless the route asked for Challenge (`initialMode`). Under it the chosen mode's line: Relaxed "10 words. No clock."; Challenge "One clock: 60 seconds for the whole round." (the scale's seconds).
- **Challenge only**: the **Clock** title and three chips, Normal / A bit longer / Twice as long (a radiogroup named "Clock length"; the stored `clockScale` is selected; a tap calls `setClockScale(profileId, scale, 'start_sheet')`), then "The clock stops while you read the answer."
- **Screen reader on** when Challenge is turned on from the sheet: the scale is set to **Twice as long** (`scaleOnOptIn`) and the line "Twice as long is chosen for you. You can change it." shows under the chips.
- The Challenge round asks up to 40 questions (`roundPlan(level, 'challenge')`) and stops at the clock; `vocab.round.start` carries `mode: 'challenge'` and the scale.
- Leaving Challenge: the Profile switch (below). Choosing Relaxed on the sheet plays one Relaxed round and leaves the setting on.

### Question screen (Challenge, frame G)

- **Header, two lines** (320 wide does not fit Back + meter + Pause on one line): line 1 Back (64), the digits "0:42" (`Heading level="title"`, `fontVariant: tabular-nums` through the token type, one element named "Time left: 42 seconds", **not** a live region) and **Pause** (`Button tone="secondary" size="md"`, 64 dp, right); line 2 the `SparkMeter` with `reserveRows` (the question never moves when a row is added), then the clock bar: a track `colors.surface.sunken`, fill `colors.brand.secondary`, height `spacing.sm`, `radii.pill`, width in 1/60 steps. **No question dots** (the round has no fixed length).
- In the last 10 seconds the static words "A few seconds left" (`Caption tone="muted"`) show under the bar. Nothing blinks, pulses, shakes or changes colour; no sound.
- **No hints** and no idle line in Challenge (`hintsEnabled: false`).
- The clock runs only while a question is on screen: never during the reveal (600 / 1000 ms), the stop sheet or a pause.

### Pause (frame G')

- **Pause** button or the app going to the background (`subscribeAppActive`, already wired in S-5) dispatches `pause`; a pause during a reveal waits for the reveal to end (the reducer queues it).
- The question is **replaced** (not dimmed) by a centred block: "Paused" (`Heading level="title"`), **Resume** (`Button tone="primary" size="lg"`, 80 dp) and **Stop** (`Button tone="ghost"`), so a pause cannot be used to study the answer. Header digits and meter stay; Pause is hidden while paused.
- **Resume** sends `resume` with the paused wall time (`pausedFor`); the remaining time is what it was. A paused round never runs out. **Stop** opens the same "Stop for now?" sheet.

### Time up (frame G'')

- When the clock reaches zero the question on screen is dropped (never a miss). The round screen shows the calm line "That's the time! Nice work." (`Heading level="title"`, centred, a polite live region) for 1 s (`TIME_UP_MS`), then the results, whose line reads "Time's up. Here is what you caught." and, above the learner's own earlier Challenge best for this topic, "New best!".

## Profile: the Challenge card

```
┌──────────────────────────────────────────┐
│ Challenge                       [ Off ]  │  <- one switch row, 64 dp
│ Adds a clock to Speed rounds. You can    │
│ turn it off any time.                    │
│ Clock  (Normal*)(A bit longer)(Twice..)  │  <- only while on
└──────────────────────────────────────────┘
```

- A `Card padding="md"` after the Sound card, shown only when Words is offered (`wordsOffered()`: `flags.vocabTopicsEnabled` or the e2e fixture bundle) and a learner is active, so nobody meets a setting for a game they cannot open.
- The row is one `Pressable` with `accessibilityRole="switch"`, `accessibilityState.checked`, the title (`Body weight="semibold"`), the line (`Caption tone="muted"`) and an `On` / `Off` `Pill` (success / neutral), like the Sound card. It calls `setChallengeMode(profileId, !on, 'profile')`; not behind the grown-up gate (reversible, the learner's own setting, §3.8).
- While on, the scale chips (the same three as the sheet, radiogroup "Clock length") call `setClockScale(profileId, scale, 'profile')`.
