# Minigame/Answer feedback: a result you can see without colour and hear once (wireframe v1)

Spec: `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` §3 (row AF-0) · builds on `design/wireframes/minigame/families.md` (the four families), `shell.md` (the common frame) and `audio-fallback.md` (sound states) · option card: `design/components/ChoiceCard/spec.md`
Audience: **any learner, any age** (CLAUDE.md §1). Everyone uses the same screens. The screen-reader parts are for learners who use VoiceOver, TalkBack or a web reader.
Wireframe level: structure, states, order of events. No colours, fonts or art. The spec names the marks and the look families (success, nudge); the mock (row AF-0b, `design/components/AnswerFeedback/`) draws them.
Code today: `apps/mobile/src/screens/minigames/CultureQuizGame.tsx`, `TapRespondGame.tsx`, `CardMatchGame.tsx`, `MatchSoundGame.tsx`, `OddOneOutGame.tsx`, `BuildLetterGame.tsx`, and the games of spec §3.6.

Notation:
- `(v)`: the right mark (the spec's `check`).
- `(<)`: the try-another mark (`replay`).
- `(-)`: the moved-on mark (`dash`).
- `[[ X ]]`: the one primary action. `[ X ]`: an option or a secondary control.
- `~~ x ~~`: taught Korean with its romanization (`KoreanText`). `( x )`: a text placeholder.
- `<…>`: a state.
- `{{ said: "…" }}`: what the hidden announcer says. It is not drawn.

Each mark sits out of the flow, on a corner or at the row's end, and never covers the text.

## Scenario (Given-When-Then)

Given: a learner is in any minigame round with options to pick
When: they pick the right option, or one that is not right
Then:
- the option shows a mark as well as its colour, so the result reads in greyscale;
- a screen reader says the result once;
- the next round does not start while that line is being said;
- a miss stays on screen until the learner acts.

## Screen goal

"Show and say what just happened, once, then get out of the way."

## Box diagram

### A. One option, four states (every surface follows this)

```
 not answered         right                miss, try again       miss, moved on
+---------------+    +-----------(v)+     +-----------(<)+      +-----------(-)+
| ( option )    |    | ( option )   |     | ( option )   |      | ( option )   |
+---------------+    +--------------+     +--------------+      +--------------+
 tappable             success look         nudge look            nudge look
 name: (option)       not tappable         locked, still         locked
                      name: "Right         focusable             name: "Not this
                       answer: (option)"   name: "Not this        one: (option)"
                                            one: (option)"
                                           never drawn as
                                           disabled / dimmed
```

Never a red look, never an X, for a learner's miss.

### B. Culture Quiz (OD-AF1 (B): the options are option cards; (A) keeps the pills with the same marks)

```
<idle>                              <after a miss>                      <right>
+----------------------------+      +----------------------------+      +----------------------------+
| [====------]  (2 / 4)      |      | [====------]  (2 / 4)      |      | [====------]  (2 / 4)      |
| (What does this mean?)     |      | (What does this mean?)     |      | (What does this mean?)     |
|        ~~ 사과 ~~           |      |        ~~ 사과 ~~           |      |        ~~ 사과 ~~           |
|        (sagwa)             |      |        (sagwa)             |      |        (sagwa)             |
|      [ (speaker) Hear it ] |      |      [ (speaker) Hear it ] |      |      [ (speaker) Hear it ] |
|                            |      |                            |      |                            |
| [ (pear)               ]   |      | [ (pear)             (<)]  |      | [ (pear)             (<)]  |
| [ (apple)              ]   |      | [ (apple)              ]   |      | [ (apple)            (v)]  |
| [ (rice)               ]   |      | [ (rice)               ]   |      | [ (rice)               ]   |
|                            |      | (Hoya thinking: short      |      |                            |
|                            |      |  "try another" line)       |      |                            |
+----------------------------+      +----------------------------+      +----------------------------+
                                     {{ said: "Not this one:            {{ said: "Right answer:
                                        pear. Try another." }}             apple." }}
                                                                         then, after the wait (G):
                                                                         next round, focus on its word
```

### C. Tap & Respond, after a miss (each option is a reply: Korean, romanization, gloss)

```
+----------------------------------+
| (Someone says)                   |
|   ~~ 안녕하세요 ~~                 |
|   (Hello)       [ Hear it ]      |
|                                  |
| [ ~~ 네 ~~ (yes)            (<)] |  <- the miss: nudge look, locked, named "Not this one: …"
| [ ~~ 안녕하세요 ~~ (hello)      ] |
| [ ~~ 고마워요 ~~ (thanks)       ] |
|                                  |
| (Hoya thinking: "doesn't fit")   |
+----------------------------------+
 {{ said: "Not this one: ne, yes. Try another." }}   <- romanization and gloss, no Hangul (spec §3.2)
 right: {{ said: "Right answer: annyeonghaseyo, hello." }}, and with a screen reader on, then the reply is heard
```

### D. Card Match

```
<a pick, then a meaning that does not match>          <the pair matched>
+----------------------+----------------------+       +----------------------+----------------------+
| [ ~~ 김치 ~~ picked ] | [ (rice)        (<)] |       | [ ~~ 김치 ~~     (v)] | [ (kimchi)      (v)] |  <- full strength,
| [ ~~ 밥 ~~          ] | [ (kimchi)         ] |       | [ ~~ 밥 ~~          ] | [ (rice)           ] |     no fade
+----------------------+----------------------+       +----------------------+----------------------+
 the Korean card stays picked;                          both cards: right look + (v), not tappable,
 the meaning tried: nudge look + (<), not tappable,     named "Matched: …"
 named "Not this one: rice"
 {{ said: "Not a match: gimchi and rice. Try another." }}   {{ said: "Matched: gimchi, kimchi." }}

 The (<) stays (no timer) until:
   - the learner taps another meaning: a new try, the same Korean card still picked; or
   - the learner picks another Korean card: the marks clear; or
   - that word is matched.
 A tap on the marked meaning does nothing and is not another miss.
```

### E. Match Sound and Odd One Out (letter tiles)

```
<right>                                   <miss>
+---------+ +---------+ +---------+       +---------+ +---------+ +---------+
|  ㄱ  (v)| |  ㄴ     | |  ㄷ     |       |  ㄱ     | |  ㄴ     | |  ㄷ  (<)|
|  g/k    | |  n      | |  d/t    |       |  g/k    | |  n      | |  d/t    |
+---------+ +---------+ +---------+       +---------+ +---------+ +---------+
 named "Right answer: g or k"              named "Not this one: d or t"; Hoya + [ Hear it ] as today
 {{ said: "Right answer: g or k." }}       {{ said: "Not this one: d or t. Listen again." }}   (Match Sound)
                                           {{ said: "Not this one: d or t. (look-again line)" }} (Odd One Out)
                                           screen reader on: Match Sound's replay plays after this line
```

The tile keeps its size. The mark sits on the top corner, out of the flow, as the miss mark does since AU-17a.

### F. Build a Letter

```
<right block>                       <miss: the slots empty after the reset, the hint stays (OD-AF7)>
+----------------------------+      +----------------------------+
|  +--------------(v)+       |      |  +-----------------+       |
|  |      가         |       |      |  |      가         |       |
|  |      ga         |       |      |  |      ga         |       |
|  +-----------------+       |      |  +-----------------+       |
|   target: right look + (v) |      |  [ _ ][ _ ]  slots empty   |
|  [ ㄱ ][ ㅏ ]  slots        |      |  [ㄱ][ㅏ][ㄴ][ㅗ]  tray      |
|                            |      |  (Hoya thinking: not quite +|
|                            |      |   the shape hint)          |
|                            |      |  [block-shape picture]     |
+----------------------------+      +----------------------------+
 {{ said: "Right answer: ga." }}     {{ said: "(not quite + shape hint line)" }}
                                     the hint stays until the next tile is placed
```

### G. Order of events after a tap (spec §3.4)

```
tap ─┬─> mark + state in the name + announcer text (web, Android) / one queued call (iOS)
     │
     ├─ miss ──> nothing moves by itself; the miss stays (spec §3.5)
     │           screen reader on: a replay the game plays by itself waits for the line
     │
     └─ right ─┬─ screen reader off, and the web:
               │     wait max(the game's wait, the floor of OD-AF2), and for the sound still playing
               │     ──> next round, focus on its prompt
               │
               └─ screen reader on (iOS, Android):
                     line said (iOS: until VoiceOver says it is done, at most 3 s;
                                Android: a fixed wait, tuned on a device)
                     ──> then the answer's own sound, if it has one (a reply, a word)
                     ──> then the game's wait (as above) ──> next round, focus on its prompt
```

## Interaction points

- **Tap a not-answered option.**
  - Right: the mark, the right look, the name "Right answer: …", one announcement, then the advance of G.
  - Miss: the mark, the nudge look, the option locked (still focusable), the name "Not this one: …", one announcement.
- **Tap a locked miss.** Nothing happens. It is not a second miss, and it plays no sound (AMENDMENTS-TOUCH R3).
- **Card Match.**
  - Tap another meaning: a new try, the same Korean card still picked.
  - Tap another Korean card: the pick moves and the marks clear.
- **Swipe (screen reader).** An answered option reads its state first. Hoya's line is still on screen and reachable, but it is not said by itself a second time.
- **Skip** (where the game has it): as today. It records nothing.
- **Hear it / speaker:** as today. With a screen reader on, a sound the game plays by itself after a result waits for the announcement. A sound the learner taps starts at once.

## Navigation graph

Enter from: `minigame/shell` (the step's game)
Inside: round n → round n + 1. Focus goes to the new prompt.
Exit to: `minigame/shell` → `quest/player` (step complete, as today); Skip → the same.

## States

- **Right** (A, B, D, E, F): marks and names as above. The advance follows G.
- **Miss** (A, B, C, D, E, F): stays until the learner acts (spec §3.5).
- **Empty** (no rounds): the game's existing "no rounds" line, as today. The announcer stays empty.
- **Error: sound unavailable:** the prompt panel's text fallback, as today (`audio-fallback.md`). Announcements do not use the app's audio, so they are said all the same. The advance waits only for what really plays.
- **Screen reader on / off:** G. The reader state is followed if it changes mid-game.
- **Reduced motion:** no motion changes here. The wait floor applies all the same, so a mark is never shown for 0 ms (Read Pick today).
- **Large text (200 %) and narrow (320) screens:** marks are out of the flow and never cover text. An option card grows in height, never truncates. Card Match's two columns wrap their words as today.
- **Landscape / wide** (`GameColumns`): prompt left, answers right, as today. Marks go with the option.

## Data needs

- Per round (exists today): each option's text, romanization and gloss; the answer id; the game's own wait constant.
- The screen-reader state: `isScreenReaderEnabled()` and `subscribeScreenReader` (`apps/mobile/src/platform/screen-reader.ts`).
- The sound that may still be playing: the game's sound pacing (`afterSound` / `pacing.after`, QS-4).
- Strings: the `a11y.answer.*` keys and `a11y.minigame.option.paired` (spec §3.7), plus the existing `a11y.minigame.option.correct` and `.wrong`.
- Nothing is stored. No score, star or telemetry changes.

## Accessibility

- One hidden polite announcer per game screen, mounted for the whole screen. It is never assertive and never focusable.
- iOS gets one queued announcement per result. The visible Hoya line is not a second live region.
- Names start with the state. A locked miss is not "dimmed".
- After a round moves on, focus goes to the new prompt.
- The marks are decorative to assistive tech: the name carries the state.
- Contrast: each mark is 3:1 or more on its fill (spec §3.1). In greyscale, right, miss and not-answered differ by the mark.

## Open questions (for the owner; the spec's §10 holds the options and recommendations)

1. **OD-AF1:** option cards (B, drawn above) or pills with marks (A) for Culture Quiz and Tap & Respond.
2. **OD-AF2:** a 1 s floor before the next round after a right answer, for every learner.
3. **OD-AF3:** nothing extra for web screen-reader users beyond OD-AF2's floor and the polite announcer (the recommendation), or a setting.
4. **OD-AF6, OD-AF7:** the miss stays until the learner acts. It is drawn above for Card Match and Build a Letter; Pic-Word Match, Story Sequence, Story Order and Hidden Heritage follow the same rule.
5. **OD-AF8:** Syllable Build's and Match Shape's drawn dot becomes the try-another mark. Sentence Builder's and Role Play's moved-on mark stays.
6. For the design pass (AF-0b), not the owner: the corner and size of the new marks on Card Match cards, the Build a Letter target box and the Hidden Heritage rings. Check each at 320 px with 200 % text.
