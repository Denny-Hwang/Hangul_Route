# Screen 12 — Minigame · Story Order (v2)

**Discovery family ⑪.** Put the story's pictures in order, then watch it play back.

Revised by F-STORY-003 PR 3.0 (Story Order v2). The v1 brief (a list of text steps with a "Your order" pill row) is replaced: v2 adds numbered slots, picture cards, romanization under every Korean caption, a start order that is never correct, and a replay.

Spec: `docs/specs/F-STORY-003-story-checks-sequence-v2.md` §3.5 · wireframe: `design/wireframes/story/sequence.md` (F, G) · code (built, PR 3.5a): `apps/mobile/src/screens/minigames/StorySequenceGame.tsx`; scene art on the cards in PR 3.5b · card: `design/brief/components/choice-card.md`

## 1. Context

- **Who**: anyone learning Hangul, at any age.
- **Where**: the `apply` step of a story quest (after the story and its questions), and the three Stage 1 quests that have a legacy story-steps sequence: the mealtime order (Life: wash hands, set the table, eat with family, say thanks), the Seollal morning (Rites: wear hanbok, bow to elders, eat tteokguk, receive lucky money) and the yut game (Crafts: pick teams, throw the yut, move the piece, win). Those steps are text-only cards.
- **Why**: putting events in order shows the learner followed the story, with pictures doing most of the work. Each slot scores once, on the first tap; a wrong card only nudges.

## 2. Layout

**Ordering** (top to bottom, scrolling): fill-only bar + position pill "2 / 4" · title "Put the story in order" and a one-line hint · a row of numbered **slots** filled left to right (a placed card shows small in its slot) · the remaining **cards** (1 column at 320 wide, 2 from 360, 3-4 at tablet width): scene picture when present, the Korean (large) with romanization upright under it, the English caption · Hoya bubble slot (a hint after two misses) · ghost **Skip this one**.

**Replay** (when every slot is filled): title "The story, in order" · one card at a time, full width, picture, Korean (spoken), caption · Back, Pause/Play, Next · ghost **Skip replay** and primary **Done**.

Frames to draw: ordering with two cards placed; a wrong tap (amber card with "Try another"); the hint ring after two misses; a text-only card (no art yet); the replay.

## 3. Visual style

- Cards use `ChoiceCard` states: idle `surface.paper`; wrong `feedback.nudgeLight` / `feedback.nudge` (brief, about 0.6 s, with the words "Try another"); hint ring `border.focus`; a text-only card sits on `surface.sunken`.
- Slots (as built in PR 3.5a): rounded pills; an empty slot is `surface.sunken` with a `border.subtle` outline and its number; a filled slot is `feedback.successLight` with a `feedback.success` outline, its number, a check icon and the card's caption.
- Korean `text.primary` at title size, romanization `text.secondary` upright, caption `text.primary` body.
- No order numbers on cards; numbers only on slots. Never red.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.story.sequence`); English shown:

- Title: **"Put the story in order"**
- Hint: **"Tap each picture, starting with what happened first."** (text-only cards: **"Tap each step, starting with what happened first."**)
- Wrong: **"Try another"**; after two misses: **"This one comes next."**
- Ghost: **"Skip this one"**
- Slot label (screen reader): **"Place 2 of 4: <caption>"** / **"Place 3 of 4, empty"**
- Replay: **"The story, in order"**, **"Pause"**, **"Play"**, **"Back"**, **"Next"**, **"Skip replay"**, **"Done"**
- Empty: **"There is nothing to put in order yet."**, **"Continue"**

Captions and Korean come from the story or quest data (story scope: the tier's four `sequenceSceneIds`).

## 5. Claude Design prompt

```prompt
Design the Story Order minigame (v2) for Hangul Route, a Korean-learning app for learners
of every age. Output: one sheet of four portrait phone frames (390 x 844).

Tokens by name: canvas surface.canvas, cards surface.paper with the "card" shadow,
text-only cards surface.sunken, empty slots as rounded pills on surface.sunken with a
border.subtle outline, filled slots feedback.successLight with a feedback.success outline,
a check icon and the caption, wrong flash feedback.nudgeLight with feedback.nudge border, hint
ring border.focus, primary brand.primary. Cards at least 80 tall; slots at least 64.

Frame 1 (ordering, 2 of 4 placed): fill-only bar 2 of 4 and pill "2 / 4"; title "Put the
story in order"; hint "Tap each picture, starting with what happened first."; a row of 4
numbered slots, 1 and 2 filled (check icon and caption: "Hoya greets the Seollal morning",
"The children bow to their grandparents"); below, two remaining cards in two columns, each
with a flat 4:3 picture, Korean large (윷놀이 / 국가 무형 유산), romanization under it
(yunnori / gukga muhyeong yusan) and an English caption ("Throwing the four yut sticks",
"Two National Intangible Heritage listings"); this is the story Hoya's Seollal Morning; a ghost button "Skip this one".
Frame 2: the same with one card in the amber wrong state showing "Try another".
Frame 3: after two misses, the right card has a focus ring and Hoya (thinking) says "This
one comes next."
Frame 4 (replay): title "The story, in order"; one full-width card (picture, Korean,
romanization, caption); Back, Pause, Next controls; ghost "Skip replay" and a large
"Done".

Anti-patterns: order numbers printed on cards, red, an X, cards starting in the correct
order, Korean without romanization, drag handles, emoji.
```

## 6. Acceptance checklist

- [ ] Slots carry the numbers; cards never do
- [ ] Every Korean caption has romanization under it and an English caption
- [ ] Wrong = amber with "Try another"; never red
- [ ] A text-only card looks intentional (sunken surface), never a broken picture
- [ ] Replay has visible Pause and a Done button (no timer-only ending)

## 7. Output path

- `design/screens/minigames/story-sequence__v2__YYYY-MM-DD.png`
