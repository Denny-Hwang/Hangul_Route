# Speed Round: start sheet, three question types, reveal, Challenge clock, results (wireframe v1)

Spec: `docs/specs/F-VOC-004-speed-round.md` (§3.2 formats, §3.5 start sheet, §3.6 screens, §3.8 accessibility)
Audience: anyone learning Korean words, any age. A round cannot be failed; a miss shows the answer and moves on; the spark meter only fills; the clock exists only if the learner opts in.
Code (planned): `screens/vocab/VocabSpeedRoundScreen.tsx`, `VocabQuestionView.tsx`, `VocabResultsScreen.tsx`, `useSpeedClock.ts`, design-system `SparkMeter`, `logic/vocab/{speed-session,session-clock,question-builder,stars,nudges}.ts`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `[pic]` a WordArt / card-art picture, `* * * . .` the spark meter (fill-only), `(speaker)` a sound button.

This file holds the whole round in one place (split when promoted to `design/wireframes/vocab/speed-round.md` and `results.md`):

- A. Start sheet
- B. Question: word to picture
- C. Question: picture to word
- D. Question: sound to picture
- E. Reveal after a right answer
- F. Reveal after a miss (gentle)
- G. Challenge: clock and pause
- H. Results
- I. Stop sheet, empty and edge states

## Scenario (Given-When-Then)

Given: a learner has collected at least 4 words in a topic
When: they start a Speed round
Then: they answer a short run of picture / word / sound questions, a spark lights for each word they catch, and they finish with stars (1 to 3) and a count of words caught, without a single number about what they missed

## Screen goal

"Practise the words you have met, quickly and kindly; the only clock is one you chose."

---

## A. Start sheet (`vocab/speed-start`)

```
┌──────────────────────────────────┐
│ [<- back]                        │
│ Food        [pic cover]          │
│ "Speed round"                    │
│                                  │
│ (Relaxed)  (Challenge)           │  <- segmented control ONLY if the profile opted in
│   "10 words. No clock."          │     otherwise: a quiet switch  [ Try Challenge o ]
│                                  │     "Adds a 60-second clock. Turn it off any time."
│ -- Challenge only --             │
│ Clock: (Normal)(A bit longer)(Twice as long)
│ "The clock stops while you read  │
│  the answer."                    │
│                                  │
│ "No sound on this device -       │  <- only when audio questions will be dropped
│  pictures and words only."       │
│                                  │
│ [[ START ]]                      │
└──────────────────────────────────┘
```

- Relaxed is selected by default. Challenge is never preselected for a profile that has not opted in; the "Try Challenge" switch is an explicit opt-in that changes the profile setting.
- Fewer collected words than options: the sheet shows "Learn a few more words first" and a primary button to Learn (never a dead end).
- No age words, no level names.

## B. Question: word to picture (`vocab/speed-question`)

```
┌──────────────────────────────────┐
│ [<- back]        * * * . . . .   │  <- spark meter (and, in Relaxed, question dots)
│                                  │
│        ~~ 사과 ~~                │  <- prompt: Korean + romanization
│          sagwa    (speaker)      │     the word plays automatically when a voice exists
│                                  │
│ ┌──────────┐  ┌──────────┐       │
│ │  [pic]   │  │  [pic]   │       │  <- pictures >= 96, 2 x 2 (3 options for the
│ └──────────┘  └──────────┘       │     Pictures-first level)
│ ┌──────────┐  ┌──────────┐       │
│ │  [pic]   │  │  [pic]   │       │
│ └──────────┘  └──────────┘       │
└──────────────────────────────────┘
```

## C. Question: picture to word

```
┌──────────────────────────────────┐
│ [<- back]        * * * . . . .   │
│            [ big pic ]           │
│ ┌──────────────────────────────┐ │
│ │  ~~ 사과 ~~  sagwa           │ │  <- word options, >= 80 tall, 1 column under 340 dp
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │  ~~ 바나나 ~~ banana         │ │
│ └──────────────────────────────┘ │
│  ... 4 options ...               │
└──────────────────────────────────┘
```

- Not offered to the Pictures-first level (it needs reading).

## D. Question: sound to picture

```
┌──────────────────────────────────┐
│ [<- back]        * * * . . . .   │
│       ( ((  speaker  )) )        │  <- large sound button, unlimited replays
│ ┌──────────┐  ┌──────────┐       │
│ │  [pic]   │  │  [pic]   │       │
│ └──────────┘  └──────────┘       │
│ ┌──────────┐  ┌──────────┐       │
│ │  [pic]   │  │  [pic]   │       │
│ └──────────┘  └──────────┘       │
└──────────────────────────────────┘
```

- If the voice fails mid-round the prompt becomes the word as text (Korean + romanization, no meaning) with "No sound? Read it here." and the question scores normally.
- Never built when there is no usable voice or sound is muted.

## E. Reveal after a right answer (about 600 ms)

```
│ [<- back]        * * * * . . .   │  <- one more spark lights (fill-only, single soft fade)
│        ~~ 사과 ~~ sagwa          │
│        "apple"                   │  <- meaning appears; the word is spoken
│ ┌──────────┐  ┌──────────┐       │
│ │ [pic] OK │  │  [pic]   │       │  <- right option: success tone + a check mark
│ └──────────┘  └──────────┘       │
│ (Hoya cheering) "Got it!"        │
```

## F. Reveal after a miss (about 1000 ms, gentle)

```
│ [<- back]        * * * . . . .   │  <- meter unchanged
│        ~~ 사과 ~~ sagwa          │
│        "apple"                   │
│ ┌──────────┐  ┌──────────┐       │
│ │ [pic] OK │  │ [pic]  - │       │  <- right option: check; the tapped option: amber + a dash
│ └──────────┘  └──────────┘       │     (never red, never an X)
│ (Hoya thinking) "That one is     │
│  apple. Next time!"              │
```

- No retry, no sound effect of failure, no count of misses, no lost spark. The round moves on by itself.

## G. Challenge: clock and pause (only when opted in)

```
Question screen with the clock                   Paused
┌──────────────────────────────────┐            ┌──────────────────────────────────┐
│ [<- back]  * * * . .   [ Pause ] │            │            "Paused"              │
│ [########-----------]  "0:42"    │            │   (question hidden)              │
│  ... question as B / C / D ...   │            │   [[ RESUME ]]    [ STOP ]       │
└──────────────────────────────────┘            └──────────────────────────────────┘
```

- One clock for the whole round. The bar moves in one-second steps, does not pulse, blink or change colour as time runs low; the last seconds only add the words "A few seconds left".
- The clock starts when the first question appears and stops during every reveal and while paused. A paused round never runs out. Backgrounding the app pauses it.
- When time is up: a calm "That's the time! Nice work." for a second, then results. The question on screen is simply dropped (not a miss).
- Relaxed has no clock and no Pause button at all.
- No hints in Challenge; in Relaxed (and not with a screen reader on) a gentle line after 12 seconds and a ring on the right option after 20.

## H. Results (`vocab/speed-results`)

```
┌──────────────────────────────────┐
│ (Hoya cheering)                  │
│       * * *   (stars 1 to 3)     │  <- never empty stars; a 1-star round shows 1 star
│   "12 words caught"              │  <- a plain count of distinct words
│   "New best!"                    │  <- only in Challenge, only vs your own earlier best
│                                  │
│ "Words to see again"             │  <- only when there are some; neutral heading
│ [pic ~~ko~~ gloss] [pic ...]     │
│ [ PRACTISE THESE ]               │  -> vocab/cards with those words
│                                  │
│ [[ PLAY AGAIN ]]                 │
│ [ BACK TO TOPIC ]                │
└──────────────────────────────────┘
```

- No percentage, no "n out of m", no time per word, no comparison with anyone else, no "wrong", "missed" or "failed".
- A round ended by the clock reads "Time's up - here is what you caught."
- Caregiver numbers (rate, strong words, words to revisit) are not on this screen; they are in the summary (F-VOC-005).

## I. Stop sheet, empty and edge states

```
Stop for now?                        Too few words                       Nothing to play
┌─────────────────────────────┐      ┌─────────────────────────────┐     ┌──────────────────────────┐
│ "Stop for now?"             │      │ "Learn a few more words     │     │ "Nothing to play yet"    │
│ [[ KEEP PLAYING ]] [ STOP ] │      │  first"                     │     │ [[ BACK ]]               │
│ answers already given stay  │      │ [[ LEARN ]]                 │     └──────────────────────────┘
│ saved; no results screen    │      └─────────────────────────────┘
└─────────────────────────────┘
```

- Screen-reader mode: no live clock ticks; "Time left" is read only when focused; focus moves to the prompt after each question; Challenge defaults to the twice-as-long clock when turned on with a screen reader active.
- 200 % text and 320 x 568: the question scrolls, options keep their minimum size, Pause stays reachable.
- Reduced motion: sparks and feedback change instantly.
- Offline: identical.

---

## Interaction points

| Where | Action | Result |
|---|---|---|
| Start sheet | Start | question 1; the Challenge clock starts when it appears |
| Start sheet | Try Challenge switch | turns the profile setting on (explicit opt-in) |
| Option | first tap | reveal (right 600 ms / gentle miss 1000 ms), next question |
| Option | second tap during a reveal | ignored |
| Speaker | tap | replays the word (unlimited) |
| Pause / Resume (Challenge) | tap | pauses / resumes; the clock never runs while paused |
| Back | tap | stop sheet |
| Results | Practise these / Play again / Back to topic | `vocab/cards` / new round / `vocab/topic` |

## Navigation graph

Enter from: `vocab/topic` (Speed round), `vocab/cards` summary (Speed round), `home/vocab-card` (Say hello again).
Exit to: `vocab/speed-results`, `vocab/topic`, `vocab/cards`.

## Data needs

- Topic items, collected state and boxes (F-VOC-005) to pick words and formats; the learner level (`levelOrder`) for options and formats; audio capability and mute state; profile settings `challengeMode`, `clockScale`, `romanizationMode`.
- Writes: an `answer` event per question (live) and a `session` event at the end.

## Open questions

1. Whether the Challenge length should be 60 seconds for everyone or scale with the number of collected words.
2. Whether a soft positive chime on a right answer should wait for F-AUDIO-004's sound tokens or ship silent.
3. Whether the results of a quit round should offer to keep the stars of the answers given (the spec says no results screen on stop).
