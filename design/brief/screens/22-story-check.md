# Screen 22 — Story check, word recap and story Results

**A few easy questions after a story. A miss is a nudge; the answer always comes with its reason.**

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.2, §3.4, §3.6, §3.7 · wireframes: `design/wireframes/story/check.md` (A-D), `story/word-recap.md` (E), `results/celebrate-story.md` (H) · option card: `design/brief/components/choice-card.md`, `design/components/ChoiceCard/spec.md` · code: `StoryCheckGame.tsx` (planned, PR 3.4a), `StoryWordRecap.tsx` (PR 3.4b), `StoryResultsExtras.tsx` (PR 3.7); pure logic built in `apps/mobile/src/logic/story/`

## 1. Context

- **Who**: anyone learning Hangul, at any age, right after reading a story.
- **Where**: the `practice` step of a story quest (questions, then the word recap), and the Results page at the end of the quest.
- **Why**: the questions check understanding without testing anxiety. Each question scores once, on the first tap; a wrong tap turns amber and says "Try another"; the explanation from a sourced fact always shows. Results then offers the next story.

## 2. Layout

**Check item** (top to bottom, scrolling): fill-only bar + position pill "1 / 3" · prompt row (speaker + prompt text, the Korean target inline as Korean + romanization, its gloss hidden until the item resolves) · 2-4 `ChoiceCard`s stacked (or 2 columns of picture options at the Listen level) · Hoya bubble slot (empty until a tap) · **Next** (`size="hero"`, appears only once resolved).

**Word recap**: heading "Words from this story" · a grid of word chips (2 columns from 360 wide): Korean at title size, romanization, gloss, speaker · **Done**.

**Story Results extras** (under the existing stars and card reveal): a story card (title in Korean, romanization, English; an optional "Learn about <note>" ghost link) · **Next story** or **Back home** (primary) · ghosts **Read it again**, **Episode page**.

Frames to draw: item answering; after a first wrong tap; resolved with explanation; picture options; recap; Results extras (2-3 stars) and the 0-1 star variant.

## 3. Visual style

- Option cards follow `components/choice-card.md`: idle `surface.paper` / `border.subtle`; wrong `feedback.nudgeLight` / `feedback.nudge` with the words "Try another"; correct `feedback.successLight` / `feedback.success` with a check mark and "Correct"; hint ring `border.focus` thick.
- Hoya bubble: `thinking` after a miss, `cheering` with the explanation. Never two Hoyas.
- Bar and pill fill only; no number-as-score, ratio or percent anywhere (Results included).
- Recap chips `surface.paper` with the `card` shadow; Korean `text.primary`, romanization `text.secondary`.
- Next and the Results primary `brand.primary`. Never `feedback.danger`, never an X.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.story.check`, `.recap`, `.results`); English shown:

- Check: **"Question 1 of 3"** (screen reader), pill **"1 / 3"**, **"Try another"**, **"Correct"**, **"Next"**, **"Not quite. Have another look."** (default hint), **"This one is worth a look."**, **"Show how to say it"**, **"Hear the question"**, **"Hear the answers"**, **"Hear the Korean word"**
- Empty: **"There are no questions for this story yet."**, **"Continue"**
- Recap: **"Words from this story"**, **"Done"**
- Results: **"Next story"**, **"Back home"**, **"Read it again"**, **"Episode page"**, **"Learn about <note title>"**, 0-1 star line **"Every read helps. Want to read it again?"**

Question content comes from the story; mock with `content/stories/seollal-new-year.json` check `c1`: "What is the New Year bow to elders called?" (Seolbim · Deokdam · Sebae · Tteokguk; explanation "Sebae is the New Year bow to elders. It is the first greeting of the year."). Recap words: 설날 seollal, 설빔 seolbim, 세배 sebae, 떡국 tteokguk.

## 5. Reference

Text references only: a friendly quiz card in a picture book; the existing Culture Quiz minigame and `results/celebrate` for the frame; `design/wireframes/minigame/shell.md` for progress and the Hoya slot.

## 6. Claude Design prompt

```prompt
Design the Story Check screens for Hangul Route, a Korean-learning app for learners of
every age. Output: one sheet of six portrait phone frames (390 x 844).

Use Hangul Route tokens by name: canvas surface.canvas, cards surface.paper, wrong state
feedback.nudgeLight fill with feedback.nudge border, correct state feedback.successLight fill
with feedback.success border, hint ring border.focus, primary button brand.primary with
text.onPrimary label. Option cards are full-width, left-aligned text, at least 80 tall,
rounded. Never red, never an X, no numbers as a score.

Frame 1 (answering): a fill-only bar with 1 of 3 filled and a pill "1 / 3"; a speaker
button and the prompt "What is the New Year bow to elders called?"; four option cards:
Seolbim, Deokdam, Sebae, Tteokguk. No Hoya yet. No timer.
Frame 2 (first wrong tap on "Deokdam"): that card amber with the words "Try another" and
locked; Hoya (thinking pose) in a bubble: "Not quite. Have another look."
Frame 3 (resolved): "Sebae" in the correct state with a check mark and "Correct"; other
cards disabled; Hoya cheering: "Sebae is the New Year bow to elders. It is the first
greeting of the year."; a large "Next" button.
Frame 4 (picture options): prompt "Which picture shows tteokguk?"; a 2 x 2 grid of picture
cards, each a simple flat illustration with a text label under it.
Frame 5 (word recap): heading "Words from this story"; four chips in two columns, each
Korean large (설날, 설빔, 세배, 떡국), romanization (seollal, seolbim, sebae, tteokguk), a
short English gloss and a speaker icon; a large "Done".
Frame 6 (Results extras): under three stars and a heritage card reveal, a story card with
호야의 설날 아침 / Hoyaui Seollal achim / Hoya's Seollal Morning; a large "Next story";
ghost buttons "Read it again" and "Episode page".

Anti-patterns: red, X marks, percentages, "3/4 correct", timers, the answer printed in
the prompt before the item resolves, Korean without romanization, emoji.
```

## 7. Acceptance checklist

- [ ] A miss is amber with words ("Try another"), never red or an X
- [ ] The gloss of the target appears only after the item resolves
- [ ] Next appears only after resolving; no auto-advance
- [ ] No score numbers, ratios or percents on any frame (Results included)
- [ ] Every Korean word has romanization and a gloss
- [ ] One primary button per frame; options at least 80 tall

## 8. Output path

- `design/screens/story/check__v1__YYYY-MM-DD.png`
- `design/screens/results/celebrate-story__v1__YYYY-MM-DD.png`
