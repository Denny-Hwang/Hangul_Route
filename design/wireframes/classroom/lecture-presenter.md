# Classroom/Lecture presenter — a teacher's slide-style lesson on a tablet, TV or projector (wireframe v1)

> **Amended 2026-10-16 (owner report; `docs/specs/AMENDMENTS-LECTURE-V2.md` section 18).** The **helper picker** is removed everywhere below (screen I's picker panel, the start screen's picker row, the bar's [Picker] button, the `P` key, the console's Helper picker section; LV-D7: no deck sets a picker), so no learner name or initial reaches the projected screen. A phone sideways shows slides with a floating bar and an upright phone a rotate page (`classroom/lecture-phone.md`); the home's language chips are replaced by the Display (Aa) control and the flat Quick lesson by the grouped chooser (`classroom/lecture-presets.md`). The rest of this v1 wireframe stands.

Spec: `docs/specs/F-TCH-004-lecture-mode.md` (§3.1 surfaces, §3.4 slide kinds, §3.5 controls, §3.6 type, §3.10 names, §3.11 console page)
Supersedes for teachers: `design/wireframes/classroom/projection-mode.md` (which stays as the deferred "volunteer student" option)
Audience: a **teacher or grown-up** driving the screen (class teacher, weekend-school teacher, parent with a TV). The room watches; nobody is "the interacting learner". Any age in the room (CLAUDE.md §1). The projected surface never shows scores, progress, rankings or a learner's name outside the picker, and no name or initial is ever in a URL (names reach the presenter by `postMessage` from the console tab, memory only). UI strings: English by default, Korean and Spanish selectable.
Code (planned): `apps/mobile/src/screens/presenter/*` (`PresenterApp`, `StartScreen`, `HomeScreen`, `Stage`, `ControlBar`, `slides/*`, `overlays/*`), `logic/lecture/*`, `platform/presenter(.web).ts`; console `apps/web/src/app/teach/space/lecture/page.tsx`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( )` toggle or option, `~~ ko ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `{ x }` content-driven, `<n>` a reveal build number, `(*)` fills only. No colours, fonts or pixel sizes; stage proportions are relative. All copy is placeholder.

This file holds twelve screens or states in one place (house style is one file per screen; split when promoted to `design/wireframes/classroom/presenter-*.md` and `console/lecture-setup.md`):

- A. Presenter home: Recent lessons + Quick lesson
- B. Start screen: device checks
- C. The stage and the control bar
- D. Letter slide (reveal builds)
- E. Syllable slide
- F. Vocabulary flashcard
- G. Story scene slide
- H. Quiz slide: question, text variant, reveal
- I. Overlays: timer, helper picker, blank, pause
- J. Slide grid and help
- K. Console setup page
- L. States: invalid link, skipped items, no Korean voice, offline not ready, portrait, exit

## Scenario (Given-When-Then)

Given: a teacher has a tablet, laptop or PC on a projector or TV, with or without Wi-Fi, and a keyboard, a clicker, a mouse or just a finger
When: she opens a lesson she built in the console (or picks a Quick lesson) and taps Start
Then: big letters, pictures and stories appear one reveal at a time; she can play the sound, ask a quick question, start a timer or pick a helper; the room is never scored, ranked or named; nobody's learning progress changes

## Screen goal

"Teach one clear thing at a time, at the back-row size, with controls the teacher can hit from arm's length or from a clicker."

---

## A. Presenter home (`/present`, no deck)

```
+-----------------------------------------------------------------------+
| (Hoya)  Lecture                                       [ Help ]        |
|                                                                       |
|  Recent lessons                         Quick lesson                  |
|  +---------------------------------+    +---------------------------+ |
|  | Week 3 letters      yesterday   |    | [ ] Meet the Letters      | |
|  |   [[ Resume ]] [ Start over ]   |    | [ ] Meet g, n, d, l       | |
|  +---------------------------------+    | [ ] Consonants (set)      | |
|  | Hello Kimchi        Sun         |    | [ ] Vowels (set)          | |
|  |   [ Resume ] [ Start over ]  [x]|    | [ ] Food words  (topic)   | |
|  +---------------------------------+    | [ ] {a story}             | |
|  (empty: "Lessons you open appear     |  +---------------------------+ |
|   here. Names are never saved.")      |  3 chosen   [[ Build lesson ]]|
+-----------------------------------------------------------------------+
```

- Works with no sign-in and no Wi-Fi once the page has been opened online once.
- Recent never holds names; "Resume" returns to the slide that was open.
- Language chips (English / Espanol / Korean endonyms) change the presenter chrome for this session; taught Korean keeps its romanization and gloss in every language.
- Quick lesson picks come from the bundled content; up to 30; no names can be typed here.

## B. Start screen

```
+-----------------------------------------------------------------------+
|                                                                       |
|                       Week 3 letters                                  |
|                 14 slides . about 12 minutes                          |
|                                                                       |
|   (check) Ready for offline                                           |
|   (check) Korean voice: {voice name}      or   (i) No Korean voice -> |
|                                                    you say the sounds |
|   (check) Full screen available           (i) Keep the screen awake   |
|   (i) 2 items are not in this version of the app  [ See which ]       |
|                                                                       |
|   Helper picker:  numbers, 12  ( - )( + )      [ Change on the console ]|
|                                                                       |
|                       [[  Start  ]]                                   |
+-----------------------------------------------------------------------+
```

- The Start tap is the one gesture that unlocks sound, fullscreen, screen-awake and landscape; nothing starts without it.
- Each row is informational; none blocks Start. "Not ready for offline" says "Open this page once with Wi-Fi" in plain text.
- Picker row: with names or initials received from the console tab it reads "Helper picker: names, 12 received"; a pasted or resumed link has no names and reads "numbers" with the line "Names come from the console page that opened this lesson."
- Wait for the large-letter font (short, bounded) before enabling Start.

## C. Stage and control bar (every running slide)

```
+-----------------------------------------------------------------------+
|                                                              3 / 14   |  <- counter, small, top right
|                                                                       |
|                        S L I D E   S T A G E                          |
|                        (16:9-ish, letterboxed,                        |
|                         everything sized from the stage)              |
|                                                                       |
|                                                                       |
|  [<] [Reveal >] [Sound] [Timer] [Picker] [Blank] [Grid] [Full] [Exit] |  <- docked, labelled,
+-----------------------------------------------------------------------+     auto-hides after ~3 s
   section dots:  o o o O o o o o o o o o o o                              <- (*) fills only
```

- The bar shows again on any key, touch or mouse move; a focused button keeps it visible; "Keep controls visible" lives in Help.
- The only status that ever appears in the bar: offline / update chip ("Update ready, applies when you exit"), the voice chip, the mute chip. Nothing about students.
- Tapping the right two thirds of the stage = next; the left third = back; swipe = next / back.
- Buttons are the biggest targets in the app and always carry a text label.

## D. Letter slide

```
build 0:                         build 1:                          build 2 (sound):
+-------------------------+      +--------------------------+      +--------------------------+
|        ㄱ  g/k          |      |  ㄱ  g/k    [stroke guide]|     |  ㄱ  g/k    [stroke guide]|
|     (huge letter,       |      |  (huge)     (animated     |     |            "ga"  (speaker)|
|      romanization)      |      |             strokes, 1-2-3)|    |  teacher-says text if no  |
|                         |      |  "Simplified stroke guide" |    |  Korean voice             |
+-------------------------+      +--------------------------+      +--------------------------+
build 3: name + soft/hard sound hint      build 4: example word ~~ 가족  gajok  family ~~
```

- With "hide romanization until tap" the romanization is its own build after the letter alone.
- The stroke guide is a separate panel beside the letter, never drawn over it. [R] replays it; reduced motion = a still numbered diagram.
- The sound plays on the build (and on [S]); it is the letter's sound (`ga`), not the letter name; a second tap on the speaker replays.
- Interaction: [Reveal >] / Space / Right = next build; [<] undoes a build before it leaves the slide.

## E. Syllable slide

```
build 0: parts              build 1: join                 build 2: romanization + sound
+------------------+        +-------------------+         +--------------------------+
|  ㄱ   +   ㅏ     |        |        가         |         |   가   ga   (speaker)    |
+------------------+        +-------------------+         +--------------------------+
```

- Parts slide together into the syllable (crossfade under reduced motion). Hyphenated syllable splits (`gim-chi`) appear only here and on word slides, as a teaching aid.

## F. Vocabulary flashcard

```
build 0                       build 1                         build 2
+--------------------+        +-----------------------+       +-----------------------+
|   ~~ 김치 gimchi ~~ |        |   ~~ 김치 gimchi ~~    |       |   ~~ 김치 gimchi ~~    |
|                    |        |   kimchi (gloss)      |       |   kimchi   {picture}  |
+--------------------+        +-----------------------+       +-----------------------+
```

- The gloss is in the lesson's language; the picture is a hand-drawn token-coloured illustration or the heritage card art when one exists; no picture = text only.
- With "hide romanization until tap": ko -> romanization -> gloss -> picture.

## G. Story scene slide

```
build 0: art                     build 1: narration                  build 2: Korean line
+------------------------+       +------------------------+          +-------------------------+
|  {scene illustration}  |       |  {scene illustration}  |          |  {art, smaller}         |
|                        |       |  "Narration, large"    |          |  ~~ 한 줄  ... ~~        |
+------------------------+       +------------------------+          +-------------------------+
```

- Text comes only from the story's own fields (sourced). A traditional-tale label and the "retold" note appear on the title slide, as in the reader.
- Checks follow as quiz slides (H) when the teacher kept them on.

## H. Quiz slide

```
question build                                  answer build
+--------------------------------------------+  +--------------------------------------------+
|  (speaker)  "Which letter says ga?"        |  |  (speaker)  "Which letter says ga?"        |
|                                            |  |                                            |
|  (O 1)  ㄱ  g/k      (^ 2)  ㄴ  n          |  |  (O 1)  ㄱ  g/k  [check] <- highlighted     |
|  ([] 3) ㄷ  d/t      (* 4)  ㄹ  r/l        |  |  others softened (no red, no X)             |
+--------------------------------------------+  |  Hoya: "Hoya's answer"                      |
                                                +--------------------------------------------+
text variant (no Korean voice / sound off): prompt shows the spoken syllable in Hangul
  + romanization ("ga") and the line "Teacher says: ..."
```

- Every option has a shape and a number (circle 1, triangle 2, square 3, star 4), so anyone in the room can point or hold up fingers; colour is never the only cue.
- The teacher reveals; nothing is collected, tallied or timed; no "right / wrong" words are shown.
- Distractors come from the same lesson; a deck without enough distinct items skips the quiz and says so on the Start screen.

## I. Overlays

```
Timer (corner)                   Timer (full)                      Helper picker
+--------------------------+     +----------------------------+    +-----------------------------+
| slide continues          |     |      (ring fills)          |    |  Who's helping next?        |
|              ( ring 2:15)|     |         2:15               |    |                             |
|              [-][ ][+30s]|     |  [30s][1m][3m][5m] [+30s]  |    |        {  Mina  }           |
+--------------------------+     |  [Pause] [Reset] [Close]   |    |  [[ Draw ]] [Undo] [Skip]   |
                                 +----------------------------+    |  (names)(initials)(numbers) |
                                                                    +-----------------------------+
Blank                            Pause
+--------------------------+     +--------------------------+     empty bag:
|        (Hoya)            |     |   (Hoya)  ~~ 잠깐 jamkkan ~~|  "Everyone has had a turn"
|     "Eyes on me"        |     |   wait a moment           |  [[ Start again ]]
+--------------------------+     +--------------------------+
```

- Timer: the ring only fills; numbers can be hidden; at zero a calm pulse and a soft two-note chime (muted when the device is muted); no alarm, no speech.
- Picker (a teacher tool): draws without replacement until everyone has had a turn; Undo and Skip give no reason; the label is a first name, initials or a number, per the lesson; it never shows anything else about a learner: no count, list, score or ranking.
- Blank and Pause leave the slide untouched underneath; the first key press only clears them.

## J. Grid and help

```
Grid (G)                                           Help (H or ?)
+-----------------------------------------------+  +--------------------------------------+
| [1 title][2 g][3 g sound][4 n] ... (thumbs)   |  | Next: Right / Space / PageDown       |
| tap = jump        (hide) toggles a slide      |  | Previous: Left / PageUp              |
| for this lesson only                          |  | B or . blank   T timer   P picker    |
+-----------------------------------------------+  | S sound   R strokes   F full screen  |
                                                   | Shift+R romanization   Esc close     |
                                                   | (Keep controls visible)              |
                                                   +--------------------------------------+
```

- The grid is visible to the room: thumbnails use kind labels and titles, never names or notes.

## K. Console setup page (`hangulroute.com/teach/space/lecture?id=…`)

```
+----------------------------------------------------------------------------------+
| Console . Sunday Class A . Lecture                                                |
|                                                                                  |
| Source   (o) This week's plan: "Week 3" (5 items)                                |
|          ( ) Pick from the catalogue          ( ) Revisit together: ㄱ ㄴ ㄷ       |
|                                                                                  |
| Outline                                              about 24 min                |
|  1. Meet g, n, d, l (quest)            4 min   [^][v][x]                         |
|  2. Quick quiz: 5 questions            2 min   [^][v][x]                         |
|  3. Activity: Say it together          3 min   [^][v][x]                         |
|  [+ Quiz] [+ Activity] [+ Class code]                                            |
|                                                                                  |
| Options  Romanization: (o) always  ( ) hide until tapped                         |
|          (x) Stroke guide  (simplified; not a calligraphy reference)             |
|          (x) Play sounds                                                         |
|                                                                                  |
| Helper picker  (o) names  ( ) initials  ( ) numbers  ( ) none                    |
|   (default: names; initials when the class hides names)                          |
|   [ Names are sent straight to the presenter tab. They are not in the link, not  |
|     sent to any server, and not saved on the classroom device. A copied link has |
|     no names. ]                                                                  |
| Title   [ Week 3 letters__________ ]  (no student names in the title)            |
|                                                                                  |
| Check the classroom device                                                       |
|   . Open the presenter once with Wi-Fi so it works offline                       |
|   . Check there is a Korean voice (the presenter tells you)                      |
|   . This changes nobody's progress                                               |
|                                                                                  |
|  [[ Open presenter ]]   [ Copy link ]                                            |
+----------------------------------------------------------------------------------+
```

- Anonymised space: the default is initials; only initials and numbers are offered; the page never tries to turn initials back into names.
- Entry points: roster action row "Lecture"; plan readout "Present this plan"; the "Revisit together" chip. Not shown to roles that cannot plan.
- Deck title defaults to the plan title; teacher-typed text is only that title (no emoji, no banned words, and the page refuses a title that contains a roster name or alias because the title is in the link).
- [[ Open presenter ]] opens a new tab and the console tab answers the presenter's `ready` message with the names; if the browser blocks the pop-up the page says so and offers [ Copy link ] (no names).

## L. States

```
invalid link           skipped items                no Korean voice                 offline not ready
+------------------+   +----------------------+    +------------------------+      +--------------------+
| This link does   |   | 2 items are not in   |    | chip in bar:           |      | (i) Open this page |
| not work         |   | this version of the  |    | "No Korean voice here. |      | once with Wi-Fi to |
| [[ Quick lesson ]]|  | app: {list}  [ OK ]  |    |  You say it!"          |      | use it offline     |
+------------------+   +----------------------+    | sound builds show      |      +--------------------+
                                                   | teacher-says text      |
portrait               exit
+--------------+       +--------------------------------+
| smaller stage|       |  Leave the lesson?             |
| "Turn the    |       |  [[ Keep going ]]  [ Exit ]    |
|  screen for a|       +--------------------------------+
|  bigger view"|
+--------------+
```

- Last slide + Next does nothing but show how to exit (no accidental exit).
- A page reload mid-lesson restores the lesson at the same slide; the console tab, if still open, sends the names again; otherwise the helper picker falls back to numbers ("Names are not kept on this device").
- An update waiting in the background never applies until Exit.

## Interaction points

- Next / Reveal: Space, Enter, Right, Down, PageDown, tap right two thirds, swipe left, [Reveal >]. Previous (labelled Back until LV-M1, 2026-10-16): Left, Up, PageUp, Backspace, tap left third, swipe right, [< Previous].
- Blank: B or `.` (clickers) or [Blank]. Timer T, Picker P, Grid G, Fullscreen F, Help H or ?, Sound S, Strokes R, Romanization Shift+R, Close Esc (Esc with nothing open = Exit confirm).
- Start: one tap unlocks everything that needs a gesture (sound, fullscreen, wake lock, landscape).
- Console [[ Open presenter ]] -> new tab at `app.hangulroute.com/present#d=…` (ids and options only); the fragment is read and removed from the address bar before anything is drawn; names follow by message, never by URL.
- [ Copy link ] -> same URL on the clipboard (no names).

## Navigation graph

Enter from: console `teach/space` (Lecture button, Revisit chip), console `teach/space/plan` (Present this plan), `/present` typed or bookmarked, presenter home (Resume / Quick lesson)
Exit to: presenter home (Exit), console tab (closed by the teacher), nothing in the learner app (no link in or out of the learner flow; a child cannot reach it by tapping)

## States

- **success**: deck valid, voice or text fallback in place, offline ready.
- **loading**: start screen waits briefly for the font; a plain "Loading lesson" while expanding a large deck.
- **empty**: Recent empty; Quick lesson with nothing chosen (Build disabled with a reason line); deck with zero usable slides -> invalid-link screen.
- **error**: invalid or oversize link; a content id missing in this version (skipped, counted); storage unavailable (Recent off, lesson still runs).
- **offline**: identical to online except the console is unreachable; chip "Offline, everything still works" lives in the bar only.
- **no sound**: voice chip + teacher-says text; muted chip with [ Turn sound on ].
- **reduced motion**: builds swap instantly; no shuffle, no turning ring pulse beyond a still change; stroke guide still diagram.
- **portrait**: letterboxed, non-blocking hint.

## Data needs

- reads: the deck (fragment or Recent), bundled content (jamo, strokes, quests, episodes, cards, stories, vocabulary), voice capability and mute (`audio-store`), device locale, service-worker control state
- reads (memory only): the roster message from the console tab (labels)
- writes: `lecture:recent` (decks, which cannot hold names, and the last slide), `device:audio` (mute), telemetry queue; **nothing else** (no progress, no profile, no sync, no name anywhere)
- console reads: roster (names or aliases, counts, `anonymizeRoster`), latest published plan, `classRollup().revisit`, catalogue mirror; writes: nothing to the server (the deck lives in the link)
- telemetry: `lecture.start`, `lecture.complete`, `lecture.tool_used`, `lecture.deck_rejected` (no names, no ids of people)

## Open questions

- Names in the link: **resolved** (owner answer 2026-10-10). No name or initial is in any URL; the console tab hands them to the presenter tab by message. Open: should initials (not names) be allowed in a shareable link? Default no.
- Is a calm chime acceptable for the timer, or should it be visual only? (A school might forbid sound.) The spec follows the device mute. The timer itself is an allowed teacher tool (owner answer 2026-10-10); it never shows a score.
- Stage proportions for 4:3 projectors: the stage grows taller instead of letterboxing; confirm the slides still breathe at 4:3.
- Teacher notes: wait for the dual-screen phase, or allow a "notes" line in the console outline that prints (F-TCH-003)?
- Do teachers want a "Show of hands" count for quizzes? It would be an aggregate, not per child, but it invites a right / wrong tally on screen; left out.
