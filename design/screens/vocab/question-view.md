# Vocabulary question view: one prompt, its options, the reveal (F-VOC-004 S-4b)

Spec: `docs/specs/F-VOC-004-speed-round.md` §3.2 (formats), §3.6 (question screen, reveal), §3.8 (accessibility), §3.9 (`VocabQuestionView`); `docs/specs/F-VOC-003-topic-picker-flashcards.md` §3.5 (the quick check uses this view in `check` mode).
Wireframe: `design/wireframes/vocab/speed-round.md` frames B (word to picture), C (picture to word), D (sound to picture), E (right reveal), F (gentle miss reveal); `design/wireframes/vocab/flashcards.md` frame F (quick check).
Code: `apps/mobile/src/screens/vocab/VocabQuestionView.tsx` (render and effects only); decisions in `apps/mobile/src/logic/vocab/question-flow.ts` (S-3) and the view-models in `apps/mobile/src/logic/vocab/question-view.ts` (100 % covered).
Components: `ChoiceCard`, `KoreanText`, `HoyaBubble`, `Icon` (design system), `PictureArt` (app).
Screenshots: `pnpm --filter @hangul-route/mobile build:web:fixtures`, then `HR_SHOTS=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-question` writes `apps/mobile/e2e/web/__shots__/vocab-question-*.png` (git-ignored). Until a host screen ships, the fixture bundle opens the view on catalogue words through `window.__hrVocabE2E` (`apps/mobile/src/navigation/vocab-question-e2e.tsx`).

The view is the middle of a question screen. It has no header, no clock, no spark meter and no Back: the screen that hosts it (the Speed Round S-5, the flashcards' quick check C-5) draws those and decides what comes next. The view renders one question and tells the host when it was answered and when its reveal beat is over.

## Frames

```
B  word to picture (4 options)          C  picture to word (4 options)          D  sound to picture
┌────────────────────────────────┐      ┌────────────────────────────────┐      ┌────────────────────────────────┐
│ [topic chip, homonyms only]    │      │          ┌────────┐            │      │        ( (( speaker )) )       │  <- 96, unlimited replays
│        ~~ 사과 ~~  (spk)        │      │          │ [pic]  │ 160        │      │  [No sound? Read it here.]     │  <- only after the voice failed
│          sagwa                 │      │          └────────┘            │      │  [~~ 사과 ~~ sagwa]             │     (Korean + romanization, no meaning)
│ ┌───────────┐ ┌───────────┐    │      │ ┌────────────┐ ┌────────────┐  │      │ ┌───────────┐ ┌───────────┐    │
│ │   [pic]   │ │   [pic]   │    │      │ │ ~~ 배 ~~    │ │ ~~ 사과 ~~  │  │      │ │   [pic]   │ │   [pic]   │    │
│ └───────────┘ └───────────┘    │      │ │ bae        │ │ sagwa      │  │      │ └───────────┘ └───────────┘    │
│ ┌───────────┐ ┌───────────┐    │      │ └────────────┘ └────────────┘  │      │ ┌───────────┐ ┌───────────┐    │
│ │   [pic]   │ │   [pic]   │    │      │  ... 2 x 2, one column < 340   │      │ │   [pic]   │ │   [pic]   │    │
│ └───────────┘ └───────────┘    │      └────────────────────────────────┘      │ └───────────┘ └───────────┘    │
└────────────────────────────────┘                                              └────────────────────────────────┘

E  right reveal (speed 600 ms, check 700 ms)       F  gentle miss reveal (speed, 1000 ms)
┌────────────────────────────────┐                 ┌────────────────────────────────┐
│        ~~ 사과 ~~  sagwa        │                 │        ~~ 사과 ~~  sagwa        │
│        apple                   │ <- meaning      │        apple                   │
│ ┌───────────┐ ┌───────────┐    │                 │ ┌───────────┐ ┌───────────┐    │
│ │ [pic]   v │ │ [pic]     │    │ <- check, green │ │ [pic]   v │ │ [pic]   ~ │    │ <- right: check; tapped: amber + mark
│ └───────────┘ └───────────┘    │    the rest     │ └───────────┘ └───────────┘    │    never red, never an X
│ (Hoya cheering) "Got it!"      │    dimmed       │ (Hoya thinking) "That one is   │
└────────────────────────────────┘                 │  apple. Next time!"            │
                                                   └────────────────────────────────┘

Check mode, after a miss: the tapped option stays amber and locked, the others stay open; after two misses the
right option gets the thick focus ring. The right tap shows E, then the next question after 700 ms.
```

## Layout rules

- Prompt zone, top to bottom: the topic chip (only for a homonym prompt in a mixed pool), then by format:
  - **word to picture**: `KoreanText` size `lg` with the romanization per the learner's setting, and a 64 dp speaker beside it when a voice exists (the word also plays by itself when the question opens).
  - **picture to word**: the picture at `2 x touchTarget.child` (160 dp, scaled with the window), named by its meaning for a screen reader.
  - **sound to picture**: a round speaker at `touchTarget.hero` (96 dp, scaled), `brand.secondary` tones, as in Listen & Pick. Its words show only after the voice failed, with the line "No sound? Read it here." and no meaning.
- Under the prompt, once the question is over: the answer as `KoreanText` with its romanization (shown even when the learner hides romanization) and its meaning in the UI language.
- Options (`ChoiceCard`; pictures through `PictureArt` at `touchTarget.hero`, never with a written label, which would give the answer away):
  - four pictures: 2 x 2 when two cards fit side by side, else one column;
  - three pictures (Pictures first): three across when three fit, else one column;
  - four words: 2 x 2 from 340 dp of column width, one column under it (each card >= `touchTarget.child`).
- Gaps `spacing.md`; the view never sets its own scroll: the host's `Screen scrollable` scrolls at 320 x 568 and at 200 % text, and the cards keep their minimum size.
- Feedback under the options: Hoya's line (the host chooses it: `nudgeFor` in the Speed Round), in a polite live region.

## States and colours

| Option | Look (ChoiceCard state) |
|---|---|
| waiting | `idle`: paper, subtle border |
| the right answer once the question is over | `correct`: `feedback.successLight`, `feedback.success` border, a check mark |
| the tapped wrong option | `wrong`: `feedback.nudgeLight`, `feedback.nudge` border, a non-colour mark (never `feedback.danger`, never an X) |
| the hint ring (Relaxed at 20 s; check mode after two misses) | `hint`: a thick `border.focus` ring |
| the rest once the question is over | `disabled`: `surface.sunken` |

## Accessibility

- Each option is a button. A picture's name is its meaning ("apple"; allowed for picture options, F-QUEST-002 §3.14); a word's name is "사과, sagwa" (no romanization when the learner hides it, until the option is answered). The name adds the state: "Right answer: apple", "Not this one: pear", "Look here: apple".
- One polite live line says the outcome in words: "Right. apple." or "Not this one. The answer is apple."; in check mode a miss says "Not this one. Try another."
- After each new question focus moves to the prompt (the speaker for a sound question).
- No motion in the view: the card states change at once, so reduced motion needs nothing. No sound but the spoken word.
- The speaker button: "Play the word again", at least `touchTarget.min`.

## Decisions taken while building

- The non-colour miss mark is `ChoiceCard`'s shared mark (the design system has no dash icon); the miss also says "Not this one" in words and keeps its amber tone.
- The host gets every accepted tap through `host.answer(question.key, correct, { itemId })` (the first per key is the scored one); `onAnswer(optionId)` fires on the first tap only, for the Speed Round's session reducer; `onAdvance()` fires when the reveal beat is over.
- Pausing and the clock are the host's: in Challenge the host hides the view behind the pause overlay.
- Props: `{ question, mode, host, canPlay, romanizationShown, onAnswer?, onAdvance, ring?, hoya? }`. `ring` is the session's hint ring (speed, Relaxed at 20 s); `hoya` is the host's `{ tone, message }` line. A new `question.key` starts a fresh flow, so the host may keep one view mounted for a whole round.
- The outcome line is announced by the native screen reader (`announceForAccessibility`) and, on the web, read from a visually hidden polite live line, so it is said once on each platform.
