# Words: the flashcards, the quick check and the chunk summary (F-VOC-003 C-5)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` T2, T3, T5, T6, §3.5 (flashcards), §3.6 (what is written), §3.7 (telemetry), §3.8 (accessibility, layout), §3.10 behaviours 4-12; §9 (the C-4 notes, acceptance text for this row).
Wireframe: `design/wireframes/vocab/flashcards.md` D (front), E (back), F (quick check and summary), H (edge states).
Code: `apps/mobile/src/screens/vocab/{VocabCardsScreen,WordCardFaces}.tsx` (render and effects only); decisions in `apps/mobile/src/logic/vocab/{flashcards,cards-view}.ts` (100 % covered). The flip is `components/FlipCard.tsx` (C-2, design/components/FlipCard/spec.md); the quick check is F-VOC-004's `VocabQuestionView` in `check` mode (design/screens/vocab/question-view.md).
Components: `KoreanText` (`lg` on the card, `sm` on the summary row), `Progress` (`dots`), `Card`, `HoyaBubble`, `Heading`, `Body`, `Button`, `Pill` (design system), `PictureArt`, `PromptPanel` (status variant) and the F-AUDIO-004 prompt slot (app).
Screenshots: `pnpm --filter @hangul-route/mobile build:web:fixtures`, then `HR_SHOTS=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-cards`; PNGs in `apps/mobile/e2e/web/__shots__/vocab-cards-*.png` (git-ignored).

## Frames

```
D  Card front                              E  Card back                               H  No voice / reading practice
┌────────────────────────────────┐         ┌────────────────────────────────┐         ┌────────────────────────────────┐
│ [<-]        Reading practice   │  <- switch, │ [<-]        Reading practice   │         │ ~~ 사과 ~~                      │
│             [ Off ]            │  pill says  │             [ Off ]            │         │ [ SHOW SOUND ]                 │ <- tap: sagwa, this card only
│ o o . .                        │  its state  │ o o . .                        │         │                                │
│ ┌────────────────────────────┐ │         │ ┌────────────────────────────┐ │         │ No sound? You can read it here.│ <- one calm line, polite
│ │          [pic 160]         │ │         │ │ apple                      │ │ <- gloss, │ [ TURN SOUND ON ]  (muted only)│
│ │          ┌──────┐          │ │         │ │ (sense note, if any)       │ │    title  └────────────────────────────────┘
│ │          │ 사과 │          │ │         │ │ [pic 96]  ┌──────┐         │ │
│ │          └──────┘          │ │         │ │           │ 사과 │ sagwa   │ │
│ │           sagwa            │ │         │ │           └──────┘         │ │
│ │ Tap the card to see what   │ │         │ └────────────────────────────┘ │
│ │ it means                   │ │         │ (speaker 80)                   │
│ └────────────────────────────┘ │         │ [ SHOW ME AGAIN ] [[ GOT IT ]] │ <- side by side, each >= 80
│ (speaker 80)  Hear the word    │         └────────────────────────────────┘
└────────────────────────────────┘

F  Quick check (VocabQuestionView, check mode)        F  Summary                                  Leave sheet
┌────────────────────────────────┐                    ┌────────────────────────────────┐          ┌────────────────────────────────┐
│ [<-]                           │                    │ (Hoya cheering)                │          │ Keep going or stop for now?    │
│ Quick check     o .            │ <- 2 fill-only     │ "4 new words collected"        │          │ [[ KEEP GOING ]]               │
│ ~~ 사과 ~~ sagwa  (spk)         │    dots, no clock  │ [pic][pic][pic][pic]           │ <- the   │ [ STOP ]                       │
│ ┌───────────┐ ┌───────────┐    │                    │                                │   chunk  └────────────────────────────────┘
│ │   [pic]   │ │   [pic]   │    │                    │ [[ NEXT WORDS ]]               │   words
│ └───────────┘ └───────────┘    │                    │ [ SPEED ROUND ]  (when built)  │
│ ...                            │                    │ [ BACK TO TOPIC ]              │
└────────────────────────────────┘                    └────────────────────────────────┘
```

## Layout, top to bottom

1. **Header row**: Back top-left (`BackButton`, 64 dp square, "Go back"); on the right the **Reading practice** switch (role `switch`, `touchTarget.min` tall): the label "Reading practice" (`learner.vocab.cards.readingPractice`) and a `Pill` with its state ("On" / "Off", the Profile switch's words, `learner.profile.reading.on` / `.off`), so the state is never colour only. It is the profile's `romanizationMode` (`locale-store.setRomanizationMode`): off = `always`, on = `tap`; the Profile screen shows the same value (T5).
2. **Dots**: `Progress variant="dots"` of the chunk, `value` = the distinct cards shown so far (`dotsFilled`; a card shown again adds none), `max` = the chunk's words; hidden from assistive technology; never "n / N".
3. **The card**: `FlipCard` keyed by word id (a new word starts flat on its front), inside a `Card tone="paper"` with a `borderWidth.thick` border in the topic tint (an accent only, never text, as on the topic tile).
   - **Front** (D): `PictureArt` (`decorative`; 2 x `touchTarget.child` = 160 dp scaled with `useMediaSize`, at most the card's inner width), the Korean as `KoreanText size="lg"` with its romanization per `romanizationShown(mode, revealed)`, and the hint "Tap the card to see what it means" (`Body tone="secondary"`).
   - **Back** (E): the gloss in the UI language (`localizedGloss`, `Heading level="title"`), the `senseNote` when there is one (localised through the `vocab:<id>` overlay, `Body tone="secondary"`), then a row with the picture (96 dp) and the Korean again (`KoreanText size="md"`, so the sound can be revealed here too).
4. **Under the card**: the **speaker** (`Pressable`, 80 dp, `brand.secondary` fill, `Icon speaker`, name "Hear the word") with the words "Hear the word" beside it; under it, when there is no sound, the one calm line "No sound? You can read it here." and, only when there is something to do, the F-AUDIO-004 `PromptPanel` status card with its one action (Turn sound on, Try again, Tap to hear) (T6). In reading practice a ghost **Show sound** button (64 dp) sits between the card and the speaker until the learner taps it.
5. **On the back only**: **Show me again** (`Button tone="secondary" size="lg"`) and **Got it** (`tone="primary" size="lg"`) side by side, each half the column. At 320 dp and at 200 % text they stack (Got it first) instead of truncating, decided from the measured column (`markButtonsStacked`).

## Behaviour

| Step | What happens |
|---|---|
| Open | The chunk: `chunk` when given, else `ids` (only those words, in that order: the Speed Round's "Practice these"), else the suggested chunk (`suggestedChunk`). `startId` (a collected wall tile) puts that word first, on its back face. `vocab.cards.start` once per chunk. |
| A new front | The word plays once (`playPrompt`, source `vocab-card`) when sound may play: the page is unlocked (F-AUDIO-004 §3.6; the tap that opened the screen does it), sound is on, a voice or clip exists and no screen reader is on (it would talk over the reader as focus lands on the card). Never twice for the same showing. |
| Tap the card (or press it) | `FlipCard` turns it (two 200 ms legs, instant under reduced motion). The first back of a word writes `introduced` (collected, T2). |
| Speaker | Plays on every tap, no limit (`hear` is counted for telemetry). |
| Got it / Show me again | Accepted on the back only (T3). Writes `self` (`known: true / false`) and `introduced` if it was not yet; Show me again puts the card at the end of the chunk once. Both open the next card's front. |
| Last card | The quick check: two word-to-picture questions (`quickCheckItems`: the Show-me-again words first) through `VocabQuestionView` `check` mode, the options from the same topic. The first answer per question writes `answer` (`format: 'word-to-image'`, `source: 'cards'`). A right answer says the word and its meaning, then the next after 700 ms. When the topic cannot build 2 picture questions, the check is skipped. |
| Summary | Writes `session` (`kind: 'cards'`) and sends `vocab.cards.complete` once. Hoya `cheering`, "N new words collected" (the words first collected in this chunk, a count), the chunk's pictures in a row, then the buttons. |
| Back / system back mid-chunk | The leave sheet. Keep going closes it; Stop goes back. Words already turned stay collected (their `introduced` was written when they turned). From the summary, Back leaves at once. System back means the Android back button and the iOS edge swipe (`beforeRemove`). On the web the browser's Back button is not part of the in-app stack (the app has no linking config), so it leaves the page as on every other screen; nothing is lost, because each turned word was written when it turned. |

**Summary buttons**: primary **Next words** (the first chunk with a word still to meet) or **Review these** (`summaryPrimary`: this chunk again when it was already collected before it opened, behaviour 12, or when every word is collected; after an `ids` run, the same words again, never chunk 0); **Speed round** only when the Speed Round screen is in the build (`VOCAB_SCREENS.speed`) and the learner has as many collected words as the level's options (3 or 4, the topic page's rule); **Back to topic** (secondary).

## Accessibility

- **The card is one button** whose name carries the word and what a press does (design/components/FlipCard/spec.md): the front is "Korean: 사과, sagwa. Show meaning." and the back "Korean: 사과, sagwa, apple. Show word." (`a11y.vocab.cards.front` / `.back`). In reading practice the romanization stays out of the name until it is revealed, as on screen.
- **After a flip the new face is said**: "apple" side first ("Meaning: apple. Korean: 사과, sagwa.", `a11y.vocab.cards.turnedBack`) or "Back to the word. Korean: 사과, sagwa." (`turnedFront`). Native calls `announceForAccessibility`; the web writes it into a visually hidden polite live line that stays mounted. Nothing is said on the first showing of a card (focus moves to it instead).
- **When a card changes, focus moves to the card** (`focusForScreenReader`).
- The picture is `decorative` on the card (the meaning is in the name). The dots are hidden; nothing reads "n of m".
- The speaker is "Hear the word"; when sound is off it says so ("Play sound, sound is off", the prompt slot's label).
- Every control is at least `touchTarget.min` (64); the card, the speaker and the two mark buttons at least `touchTarget.child` (80).
- Reduced motion: the flip is an instant swap; the summary's Hoya pose shows at once.
- 200 % text and 320 x 568: the page scrolls (`Screen scrollable`); the card grows; the mark buttons stack; nothing is clipped.

## States

| State | What shows |
|---|---|
| topic not found, hidden or locked | the topic page in its place (`replace('VocabTopic')`), which says "Topic not found" or opens the grown-up gate (gating on only, D5) |
| progress not hydrated | the suggested chunk is chunk 0; the cards work; writes wait for hydration (`recordVocab`) |
| no Korean voice, sound off, a failed play | the Korean and its romanization are already on the card; one calm line "No sound? You can read it here." and, for sound off, "Turn sound on" (F-AUDIO-004 prompt state); `audio.fallback_shown` once per source and reason |
| reading practice | romanization hidden behind "Show sound" on each card; the reveal lasts for that card; the gloss is never hidden |
| fewer than 4 words with pictures | no quick check; the summary follows the last card |

## Decisions taken while building

- **The speaker sits under the card, not on it.** The card is one button (the flip), and a button inside a button is not reachable on the web or by a screen reader. The wireframe's "(speaker) Hear it" line moves under the card at the same size.
- **The Reading practice switch shows its state in words** (the `Pill` "On" / "Off" the Profile screen uses), so colour is never the only cue and both places read the same.
- **The mark buttons stack at narrow widths.** "Show me again" is about 190 dp at `lg` in English and longer in Spanish ("Muéstramela otra vez"), so two side by side need about 400 dp; below the measured fit they stack with Got it first, each full width and 80 dp tall (the wireframe's open question 3).
- **`ids` is honoured** (F-VOC-004 S-5's "Practice these"): the run is just those words, in that order, as one chunk; Next words then goes to the topic's first chunk with a word to meet.
- **Telemetry**: `vocab.cards.start` `{ topicKey, chunk, chunks, words, level }` and `vocab.cards.complete` `{ topicKey, chunk, words, gotIt, again, heard, newlyCollected, checkFirstTry, checkQuestions }`; `level` is the level order, never an age; `chunk` is -1 for an `ids` run (it is not one of the topic's chunks).

## Device flip pass (the C-2 carry-over)

Row C-5 asks for the iOS and Android flip pass from C-2 to be recorded here. Status at C-5:

- **iOS: run by the author, passed.** iOS 26.5 Simulator (iPhone 17) through Xcode, a local Release build with `EXPO_PUBLIC_VOCAB_TOPICS_ENABLED=1`, an XCUITest from onboarding through Library > Words > Food > Learn: front, tap, back, Got it, next front.
- **Android: not run** (no Android device or emulator on the build machine).
- **Owner-blocked, a precondition of Words in native builds.** C-7 (owner decision 2026-10-13) turned Words on in the web app only: `flags.vocabTopicsEnabled` defaults to `false` in iOS and Android bundles until this pass is recorded here (with the date and the devices), and no native release ships Words before then. When it is, a follow-up drops the native default in `apps/mobile/src/config/flags.ts`. The owner (or a device run) checks:
  1. Android: the card turns front, back and front again, and each face's name is read by TalkBack.
  2. Android and iOS: a quick double tap turns the card once per tap, never skips a face.
  3. Android and iOS with Reduce motion / Remove animations on: the card swaps at once.
  4. CardDetail Share: the shared PNG matches the card on screen on iOS and Android (C-2's FlipCard change).
  5. VoiceOver and TalkBack: after a flip the new face is announced; with the marks stacked, Got it is reached before Show me again.
