# Minigame/Answer feedback: a result you can see without colour and hear once (wireframe v2)

- Spec: `docs/specs/F-A11Y-001-answer-feedback-and-announcements.md` §3 (row AF-0, revision 2).
- Builds on `design/wireframes/minigame/families.md` (the four families), `shell.md` (the common frame; §7 a miss, §12 screen readers) and `audio-fallback.md` (sound states). Option card: `design/components/ChoiceCard/spec.md`.
- Audience: **any learner, any age** (CLAUDE.md §1). Everyone gets the same screens. The screen-reader parts serve learners who use VoiceOver, TalkBack or a browser screen reader.
- Wireframe level: structure, states and the order of events. No colours, fonts or art. The spec names the marks and the look families (success, nudge); the mock (row AF-0b, `design/components/AnswerFeedback/`) draws them.
- Code today: `apps/mobile/src/screens/minigames/CultureQuizGame.tsx`, `TapRespondGame.tsx`, `CardMatchGame.tsx`, `MatchSoundGame.tsx`, `OddOneOutGame.tsx`, `BuildLetterGame.tsx`, and the other games in spec §3.6.

Notation:

| Symbol | Meaning |
|---|---|
| `(v)` | the right mark (`check`) |
| `(<)` | the try-another mark (`replay`) |
| `(-)` | the tried-here mark (`dash`; Sentence Builder only, OD-AF8) |
| `[[ X ]]` | the one primary action |
| `[ X ]` | an option or a secondary control |
| `~~ x ~~` | taught Korean with its romanization (`KoreanText`) |
| `( x )` | a text placeholder |
| `<…>` | a state |
| `{{ said: "…" }}` | what the hidden announcer says; it is not drawn |

Each mark sits out of the flow, on a corner or at the end of a row, and never covers text. AF-0b sets its minimum size (spec §3.1).

## Scenario (Given-When-Then)

Given: a learner is in any minigame round where they pick an option
When: they pick the right option, or one that is not right
Then:

- the option shows a mark as well as its colour, so the result reads in greyscale
- a screen reader says the result once
- the next round never cuts that line off
- a miss stays on screen until the learner acts

## Screen goal

"Show and say what just happened, once, then get out of the way."

## Box diagram

### A. One option, its states (every surface follows this)

```
 not answered         right                miss, try again       look here (2nd miss)   tried here (Sentence
                                                                                          Builder only)
+---------------+    +-----------(v)+     +-----------(<)+      #################      +-----------(-)+
| ( option )    |    | ( option )   |     | ( option )   |      # ( option )    #      | ( word tile )|
+---------------+    +--------------+     +--------------+      #################      +--------------+
 tappable             success look         nudge look            thick focus ring       nudge look
 name: (option)       locked (inactive)    locked (inactive),    (as each game          still TAPPABLE
                      name: "Right         still focusable       draws it today)        (fits another place)
                       answer: (option)"   name: "Not this       name: "Look here:      name: "(word), tried"
                                            one: (option)"        (option)"
                      never "dimmed"       never "dimmed"
```

There is never a red look or an X for a learner's miss. Every mark is the primary text colour, except `(v)`.

### B. Culture Quiz (OD-AF1 (B): the options are option cards; (A) keeps the pills, with the same marks)

```
<idle>                              <after a miss>                      <right>
+----------------------------+      +----------------------------+      +----------------------------+
| [====------]  (2 / 4)      |      | [====------]  (2 / 4)      |      | [====------]  (2 / 4)      |
| :(What does this mean?)  : |      | :(What does this mean?)  : |      | :(What does this mean?)  : |  <- focus node (spec §3.4):
| :       ~~ 사과 ~~        : |      | :       ~~ 사과 ~~        : |      | :       ~~ 사과 ~~        : |     heading + word, not the
| :       (sagwa)          : |      | :       (sagwa)          : |      | :       (sagwa)          : |     button; named "Question
|      [ (speaker) Hear it ] |      |      [ (speaker) Hear it ] |      |      [ (speaker) Hear it ] |     2 of 4. What does this
|                            |      |                            |      |                            |     mean? sagwa"
| [ (pear)               ]   |      | [ (pear)             (<)]  |      | [ (pear)             (<)]  |
| [ (apple)              ]   |      | [ (apple)              ]   |      | [ (apple)            (v)]  |
| [ (rice)               ]   |      | [ (rice)               ]   |      | [ (rice)               ]   |
|                            |      | (Hoya thinking: short      |      | [[ Next ]]  <- reader on,  |
|                            |      |  "try another" line)       |      |    OD-AF9 (b) only         |
+----------------------------+      +----------------------------+      +----------------------------+
                                     {{ said: "Not this one:            {{ said: "Right answer:
                                        pear. Try another." }}             sagwa, apple." }}
```

### C. Tap & Respond, after a miss (each option is a reply: Korean, romanization, gloss)

```
+----------------------------------+
| :(Someone says)                : |  <- focus node: "Question 2 of 3. Someone says annyeonghaseyo, hello"
| :  ~~ 안녕하세요 ~~               : |
| :  (Hello)                     : |
|                   [ Hear it ]    |
|                                  |
| [ ~~ 네 ~~ (yes)            (<)] |  <- the miss: nudge look, locked, "Not this one: …"
| [ ~~ 안녕하세요 ~~ (hello)      ] |
| [ ~~ 고마워요 ~~ (thanks)       ] |
|                                  |
| (Hoya thinking: "doesn't fit")   |
+----------------------------------+
 {{ said: "Not this one: ne, yes. Try another." }}   <- romanization and gloss, no taught-Korean Hangul
 right: {{ said: "Right answer: annyeonghaseyo, hello." }}. With a reader on, the reply is heard after this line.
```

### D. Card Match

```
<a pick, then a meaning that does not match>          <the pair matched>
+----------------------+----------------------+       +----------------------+----------------------+
| [ ~~ 김치 ~~ picked ] | [ (rice)        (<)] |       | [ ~~ 김치 ~~     (v)] | [ (kimchi)      (v)] |  <- full strength, no
| [ ~~ 밥 ~~          ] | [ (kimchi)         ] |       | [ ~~ 밥 ~~          ] | [ (rice)           ] |     fade; inactive, not
+----------------------+----------------------+       +----------------------+----------------------+     "dimmed"
 (Hoya thinking: "Not a match. Try another meaning.")   (Hoya idle: "Now tap its meaning …" when a new word is picked)
 the picked card: a cue besides its colour (AF-0b)
 {{ said: "Not a match: gimchi and rice. Try another." }}   {{ said: "Right answer: gimchi, kimchi." }}

 The (<) stays, with no timer, until one of these:
   - the learner taps another meaning: a new try, with the same Korean card still picked
   - the learner picks another Korean card: the marks clear, and Hoya goes back to the idle prompt
   - that word is matched
 A tap on the marked meaning does nothing and is not another miss.
```

### E. Match Sound and Odd One Out (letter tiles)

```
<right>                                   <miss>
+---------+ +---------+ +---------+       +---------+ +---------+ +---------+
|  ㄱ  (v)| |  ㄴ     | |  ㄷ     |       |  ㄱ     | |  ㄴ     | |  ㄷ  (<)|
|  g/k    | |  n      | |  d/t    |       |  g/k    | |  n      | |  d/t    |
+---------+ +---------+ +---------+       +---------+ +---------+ +---------+
 named "Right answer: g or k"              locked, named "Not this one: d or t"; Hoya and [ Hear it ] as today
 {{ said: "Right answer: g or k." }}       {{ said: "Not this one: d or t. Listen again." }}             (Match Sound)
                                           {{ said: "Not this one: d or t. (look-again line)" }}         (Odd One Out)
                                           Reader on: no automatic replay; the learner taps Hear it.
```

The tile keeps its size. The mark sits on the top corner, out of the flow, as the miss mark has since AU-17a.

### F. Build a Letter

```
<right block>                       <miss, OD-AF7 (i): the wrong build stays>
+----------------------------+      +----------------------------+
|  +--------------(v)+       |      |  +-----------------+       |
|  |      가         |       |      |  |      가         |       |
|  |      ga         |       |      |  |      ga         |       |
|  +-----------------+       |      |  +-----------------+       |
|   target: right look + (v) |      |  [ ㄴ ][ ㅏ ]  slots: the    |
|  [ ㄱ ][ ㅏ ]  slots        |      |      wrong build, miss look|
|  [ㄱ] [ㅏ] [ㄴ] [ㅗ]  tray   |      |  [ㄱ] [ㅏ] [ㄴ] [ㅗ]  tray    |
|   g/k  a   n   o          |      |   g/k  a   n   o          |  <- romanization under each tray tile
|                            |      |  (Hoya thinking: not quite +|
|                            |      |   the shape hint)          |
|                            |      |  [block-shape picture]     |
|                            |      |  [ Undo ]                  |
+----------------------------+      +----------------------------+
 {{ said: "Right answer: ga." }}     {{ said: "(not quite + shape hint line)" }}
                                     The build and the hint stay until a slot tap (take back), Undo, or a tray tap
                                     (which empties the slots and starts again with that tile).
                                     Under (ii): the slots empty after 900 ms and only the hint stays.
```

### G. Story Sequence and Story Order (OD-AF7)

```
+--------------------------------------+
| ( slot 1: placed line  (v) )         |  <- Story Sequence: (v) on the filled slot; Story Order: the line itself
| ( slot 2: empty, next )              |
| ( slot 3: empty )                    |
|                                      |
| [ (card A)                     (<)]  |  <- a card that did not fit: stays marked until the next placement
| [ (card B)                       ]   |     (today it flashes for 600 ms); "Not this one: …"
| [ (card C)                       ]   |
| (Hoya thinking: "Try another")       |
+--------------------------------------+
 placed: {{ said: "Place 1 of 3: (romanization), (gloss)." }}   <- Story Order: the position stays; no Hangul
 miss:   {{ said: "Not this one: (card). Try another." }}
 Story Order's replay lines are not results; they stay as they are (WO-40).
```

### H. Hidden Heritage (scene rings)

```
+--------------------------------------+
|        ( scene picture )             |
|   ((v) found)     ((<) miss)         |  <- found ring + (v); miss ring + (<). Today they differ by colour only
|          ( #dashed look here# )      |  <- look-here ring stays dashed
|                                      |
| [found slot: (word)] [ _ ] [ _ ]     |
| (Hoya thinking: "Look again")        |
+--------------------------------------+
 found: {{ said: "Right answer: (romanization), (gloss)." }}   miss: {{ said: "Not this one: (spot). Look again." }}
 The miss ring stays (no 600 ms timer) until the next tap on the scene.
```

### I. Syllable Build and Match Shape (zones and tiles)

```
+-----------------------------+
|  [ zone 1 (v) ][ zone 2 (<)]|  <- the drawn dot becomes (<) (OD-AF8); named "…, listen again" as today
|  [ tile ][ tile ][ tile ]   |
|  (Hoya: miss line / diff)   |
+-----------------------------+
 built: {{ said: "Right answer: (block romanization)." }}
 miss:  {{ said: "Not this one: (tile). Listen again." }} or "… (diff note)" (Match Shape)
 a second miss that turns the look-here on: {{ said: "Not this one: (tile). (look-here line)" }}
```

### J. Role Play reply

```
+--------------------------------------+
| (chat log …)                         |
| [ ~~ reply A ~~               (<)]   |  <- a locked, less natural reply: (<) (was a dash); the turn stays
| [ ~~ reply B ~~                  ]   |
| (Hoya thinking: why line)            |
+--------------------------------------+
 {{ said: "Not this one: (romanization). (why line, its Korean read as romanization)" }}
 right: {{ said: "Right answer: (romanization), (gloss)." }}
```

### K. Order of events after a tap (spec §3.4, OD-AF9)

```
tap ─┬─> mark + state in the name + announcer text (web, Android) / one queued call (iOS)
     │
     ├─ miss ──> nothing moves by itself; the miss stays (spec §3.5)
     │           reader on: no automatic replay
     │
     └─ right ─┬─ reader off (and the web without the OD-AF3 (d) flag):
               │     wait max(the game's wait, the OD-AF2 floor), and for any sound still playing
               │     ──> next round; focus does not move
               │     (a browser screen reader the app cannot detect may be cut off: not guaranteed)
               │
               └─ reader on (iOS, Android, the web with the flag):
                     OD-AF9 (b), recommended:
                       [[ Next ]] appears and takes focus ──> the line is said after the focus move
                       ──> the answer's own sound (a reply, a clip) after the line
                       ──> the learner taps Next ──> next round, focus on its prompt node
                     OD-AF9 (a):
                       line ──> the answer's sound ──> the game's wait ──> next round, focus on its prompt node
```

### L. Display sheet: the screen-reader switch (OD-AF3 (d) only)

```
+------------------------------------+
| (Display)                    [x]   |
|  (Language)         [ English v ]  |
|  (Text size)        [ Aa ... ]     |
|  (I use a screen reader)   [ off ] |  <- the level check's existing label and help;
|   (help line)                      |     the same device flag the level check sets
+------------------------------------+
```

## Interaction points

- **Tap an option that is not answered yet.**
  - Right: the mark, the right look, the name "Right answer: …", one announcement, then the advance in K.
  - Miss: the mark, the nudge look, the option locked (inactive, still focusable), the name "Not this one: …", one announcement.
  - A second miss that turns the look-here on: the hint look on the answer, and the announcement ends with the game's look-here line.
- **Tap a locked miss.** Nothing happens: it is not a second miss, and it plays no sound (AMENDMENTS-TOUCH R3).
- **Next** (reader on, OD-AF9 (b)): moves to the next round; focus goes to the new round's prompt node.
- **Card Match, while a miss mark shows.**
  - Tap another meaning: a new try.
  - Tap another Korean card: the pick moves and the marks clear.
- **Build a Letter (i).** A slot tap, Undo or a tray tap ends the miss state.
- **Swipe (screen reader).** An answered option reads its state first. Hoya's result line is still on screen and reachable, but it is not said a second time by itself. On iOS the hidden announcer cannot be reached; on Android and the web it can, and it is emptied each round.
- **Skip** (where the game has it): as today. It records nothing.
- **Hear it / speaker:** as today. With a reader on, nothing plays by itself after a result except the answer's own sound, after the line.
- **Display sheet switch** (OD-AF3 (d)): turns the reader-on path on for the web on this device.

## Navigation graph

- Enter from: `minigame/shell` (the step's game).
- Inside: round n → round n + 1. With a reader on, focus goes to the new prompt node.
- Exit to: `minigame/shell` → `quest/player` (step complete, as today). Skip goes the same way.
- Display sheet: `shell/display-sheet.md` (the existing sheet; one row added under OD-AF3 (d)).

## States

- **Loading:** as the shell shows it today. The announcer is mounted but empty.
- **Right** (A to J): marks and names as above. The advance follows K.
- **Miss** (A to J): stays until the learner acts (spec §3.5).
- **Look here** (A, H, I): the second-miss hint, as each game draws it today, now with "Look here: …" in the name and the look-here line in the announcement.
- **Empty** (no rounds): the game's existing "no rounds" line, as today. The announcer stays empty.
- **Sound unavailable:** the prompt panel's text fallback, as today (`audio-fallback.md`). Announcements do not use the app's audio, so they are said all the same. The advance waits only for sound that really plays.
- **Reader on / off:** K. The app follows the reader state if it changes mid-game.
- **Reduced motion:** no motion changes here. The OD-AF2 floor still applies, so a mark is never shown for 0 ms (as in Read Pick today).
- **Large text (200 %) and narrow (320) screens:** marks stay out of the flow and never cover text. An option card grows in height and never truncates. Next, when shown, is reachable: the column scrolls, as Trace's controls do (TI-3b).
- **Landscape / wide** (`GameColumns`): prompt left, answers right, as today. Marks move with their option, and Next sits under the answers.

## Data needs

- Per round (all exist today): each option's text, romanization and gloss; the answer id; the game's own wait constant.
- The reader state: `isScreenReaderEnabled()` and `subscribeScreenReader` (`apps/mobile/src/platform/screen-reader.ts`) on native, and the OD-AF3 (d) device flag on the web.
- The sound that may still be playing: the game's sound pacing (`afterSound` / `pacing.after`, QS-4).
- Strings: the `a11y.answer.*` keys and `learner.minigame.cardMatch.tryAnother` (spec §3.7), plus the existing `a11y.minigame.option.correct`, `.wrong` and `.hint`, and the existing "Next".
- Stored: only the OD-AF3 (d) device flag, if the owner chooses it. Nothing about the score, stars or telemetry changes.

## Accessibility

- **Announcer:** one hidden polite announcer per game screen, mounted for the whole screen. It is never assertive and never focusable, and on iOS it is hidden.
- **iOS:** one queued announcement per result.
- **Live regions:** only result bubbles and result wrappers stop being live. Status regions (the pick prompt, the sound panel, the selection caption, the replay line) stay live.
- **Names:** an option's name starts with its state. A locked option is never "dimmed" and never "selected" on a miss.
- **Focus:** with a reader on, focus goes to Next (OD-AF9 (b)) or to the new prompt node. That node is never a button and never the raw Hangul heading. With the reader off, focus does not move.
- **Marks:** decorative to assistive tech; the name carries the state.
- **Contrast:** each mark is 3:1 or more on its fill. In greyscale, right, miss, look-here and not-answered differ by the mark.

## Open questions (for the owner; spec §10 holds the options, recommendations and gates)

1. **OD-AF1:** option cards (B, drawn above) or pills with marks (A) for Culture Quiz and Tap & Respond.
2. **OD-AF2:** a 1 s floor before the next round after a right answer, for every learner.
3. **OD-AF3:** the web reader path. The recommendation is (d): reuse the level check's "I use a screen reader" as a device switch (L).
4. **OD-AF6, OD-AF7:** the miss stays until the learner acts. Drawn above for Card Match, Build a Letter (sub-option (i)), Story Sequence and Story Order, and Hidden Heritage.
5. **OD-AF8:** the dot and Role Play's dash become `(<)`. Sentence Builder's tried tile keeps `(-)`.
6. **OD-AF9:** with a reader on, Next after a right answer (B, the recommendation) or a timed advance.
7. For the design pass (AF-0b), not the owner:
   - the corner and minimum size of each new mark (Card Match cards, the Build a Letter target box, the Hidden Heritage rings), checked at 320 px with 200 % text
   - the picked-card cue in Card Match
   - where Next sits in each game
   - whether `(<)` can be mistaken for a replay button
