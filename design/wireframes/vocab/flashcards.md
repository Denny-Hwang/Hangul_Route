# Flashcards: flip card, got it / show me again, quick check, chunk summary, Home card (wireframe v1)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` (§3.5 flashcards, §3.6 what is written); Home card in F-VOC-005 §3.7
Audience: anyone learning Korean words, any age. A card can never be "wrong"; the learner decides what they know.
Code (planned): `screens/vocab/VocabCardsScreen.tsx`, `components/FlipCard.tsx`, `logic/vocab/flashcards.ts`, `screens/vocab/VocabQuestionView.tsx` (shared with the Speed Round), `screens/home/HomeScreen.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText` (Hangul chip, romanization line, gloss), `[pic]` a WordArt / card-art picture, `(speaker)` a >= 80 dp sound button.

This file holds the flashcard flow in one place (split when promoted to `design/wireframes/vocab/flashcards.md`):

- D. Card front
- E. Card back
- F. Quick check and chunk summary
- G. Home card for words that are ready again
- H. Edge states (no voice, reading practice, leaving)

## Scenario (Given-When-Then)

Given: a learner opens Learn on a topic
When: they go through a short run of cards (4 or 6), flipping each to see its meaning and saying whether they know it
Then: the words they met are collected, two quick picture questions follow, and a summary tells them how many new words they collected

## Screen goal

"Meet a few words at a time with a picture, the sound, the romanization and the meaning; never be graded."

---

## D. Card front

```
┌──────────────────────────────────┐
│ [<- back]   (Reading practice o) │  <- switch: hide romanization until tap (off = visible)
│ o o . .                          │  <- fill-only dots of this run (4 or 6)
│                                  │
│ ┌──────────────────────────────┐ │
│ │           [pic]              │ │  <- big picture
│ │                              │ │
│ │        ~~ 사과 ~~            │ │  <- Korean, display size
│ │          sagwa               │ │  <- romanization (hidden behind "Show sound" in reading practice)
│ │                              │ │
│ │   (speaker)  "Hear it"       │ │  <- plays on appear; replay unlimited
│ │ "Tap the card to see what    │ │
│ │  it means"                   │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- Tap the card, or a Flip button for keyboard and screen-reader users, -> flip to E (instant swap under reduced motion).
- The word plays once when the card appears (not the first card of a session until a tap has happened).
- The card is one button for assistive tech: "Korean: sagwa. Show meaning."

## E. Card back

```
┌──────────────────────────────────┐
│ [<- back]                        │
│ o o . .                          │
│ ┌──────────────────────────────┐ │
│ │ "apple"        (gloss in UI  │ │  <- gloss in the UI language
│ │               language)      │ │
│ │ [pic]  ~~ 사과 ~~ sagwa      │ │  <- Korean again so the sound can be revealed
│ │ "short note" (if any)        │ │  <- sense note, e.g. who says it
│ │ (speaker)                    │ │
│ └──────────────────────────────┘ │
│ [ SHOW ME AGAIN ]  [[ GOT IT ]]  │  <- both >= 80 tall, side by side
└──────────────────────────────────┘
```

- **Got it** and **Show me again** both go to the next card's front. Show me again also puts this card at the end of the run, once.
- Neither button is a test: nothing is scored and nothing says "wrong".
- Flipping to the back is what collects the word; leaving now keeps it.

## F. Quick check and chunk summary

```
Quick check (2 questions, untimed)              Summary
┌──────────────────────────────┐               ┌──────────────────────────────┐
│ "Quick check"   o .          │               │ (Hoya cheering)              │
│ ~~ 사과 ~~ sagwa  (speaker)  │               │ "4 new words collected"      │
│ ┌────┐ ┌────┐                │               │ [pic][pic][pic][pic]         │
│ │[pic]│ │[pic]│  pick the     │               │                              │
│ └────┘ └────┘  picture       │               │ [[ NEXT WORDS ]]             │
│ ┌────┐ ┌────┐                │               │ [ SPEED ROUND ]              │
│ │[pic]│ │[pic]│                │               │ [ BACK TO TOPIC ]            │
│ └────┘ └────┘                │               └──────────────────────────────┘
└──────────────────────────────┘
```

- The check is word-to-picture, untimed; a wrong tap is amber with a dash mark and the learner may tap again; the right tap speaks the word and shows its meaning.
- The summary shows a **count** of newly collected words, never a fraction or percent. No stars here (stars belong to the Speed round).
- Primary button reads "Review these" when every word of the run was already collected.
- If the topic has too few words with pictures to build 2 questions, the check is skipped.

## G. Home card (Today's mission, slot 3)

```
┌──────────────────────────────┐
│ [icon]  Words are ready      │
│  "5 words would like another │
│   look"                      │
│  [[ SAY HELLO AGAIN ]]       │  -> vocab/speed-start (Relaxed) for the topic with most due words
└──────────────────────────────┘
```

- Shown only when 3 or more words are due and the Daily Test is not available yet; in slot 3 it comes before a new story and before a replay (F-VOC-005 §3.7). Never mentions days away, "overdue" or "missed".

## H. Edge states

```
No Korean voice                          Reading practice on                    Leave mid-run
┌──────────────────────────────┐         ┌──────────────────────────────┐       ┌────────────────────────────┐
│ card front as D, plus one    │         │ ~~ 사과 ~~                   │       │ "Keep going or stop for    │
│ calm line: "No sound? You    │         │ [ SHOW SOUND ]  <- tap to    │       │  now?"                     │
│ can read it here."           │         │  reveal sagwa for this card  │       │ [[ KEEP GOING ]] [ STOP ]  │
│ (muted: [ TURN SOUND ON ])   │         └──────────────────────────────┘       │ words already flipped stay │
└──────────────────────────────┘                                                │ collected                  │
                                                                                └────────────────────────────┘
```

- 200 % text: the card scrolls; the two answer buttons stay reachable at the bottom.
- Audio failure is never an error dialog.

---

## Interaction points

| Where | Action | Result |
|---|---|---|
| Card front | tap card / Flip | flip to back; word collected |
| Card front | speaker | plays the word |
| Card back | Got it | next card; self-mark "known" (weak signal) |
| Card back | Show me again | next card; card returns once at the end |
| Run end | automatic | quick check, then summary |
| Summary | Next words / Speed round / Back to topic | `vocab/cards` next run / `vocab/speed-start` / `vocab/topic` |
| Header switch | toggle | `romanizationMode` always <-> tap (the profile setting) |

## Navigation graph

Enter from: `vocab/topic` (Learn, or a collected tile), `vocab/speed-results` ("Practise these").
Exit to: `vocab/topic`, `vocab/speed-start`, back.

## Data needs

- The run's items (`chunksFor`), `localizedGloss`, `romanizationShown(mode, revealed)`, audio capability and mute state.
- Writes (F-VOC-005): `introduced`, `self`, quick-check `answer`, `session`.

## Open questions

1. Whether "Show me again" should be offered on the front as well (a learner who knows they will not remember).
2. Whether the quick check should be skippable by a learner who wants to go straight on.
3. The chunk size of 6 for the Reads-easily level should be confirmed on a real 320 x 568 screen with the two buttons and a 160 dp picture.
