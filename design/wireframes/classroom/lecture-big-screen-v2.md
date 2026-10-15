# Classroom/Lecture-big-screen-v2 — the slides Stages 2-7 need on a projector or TV (wireframe v1)

Spec: `docs/specs/AMENDMENTS-LECTURE-V2.md` section 5 (builder rules, builds, write together) · extends `classroom/lecture-presenter.md` C-H (stage, control bar, slide kinds)
Audience: **a class or a family watching one big screen; a grown-up clicking**
Route: `app.hangulroute.com/present` (running lesson)
Mock: LV-0b (`design/screens/presenter/slide-*.md`, one per family)

## Scenario (Given-When-Then)

Given: a teacher presents a Stage 3, 4, 6 or 7 lesson
When: the deck reaches a Discover page, a question round, a Sentence Builder round or a writing round
Then: the room sees a slide made for the front of the room (big Korean with romanization and a meaning, one idea per click), never a skipped step and never the same word card twice

## Screen goal

"Show one idea at a time, big enough for the back row." (secondary: reveal the answer on the teacher's click)

## Box diagram

Every slide sits on the stage of `lecture-presenter.md` C (logical 1280 wide, docked control bar band below). Builds are numbered `b0, b1, …`; `next` shows the next build.

Panel 1 — **sentence** (Discover sentence): b0 Korean + romanization, b1 meaning, b2 picture

```
+--------------------------------------------------------------------------+
| Sentence                                                     (kind label) |
|                                                                          |
|        저는 김밥을 좋아해요.                       +------------------+    |
|        jeoneun gimbabeul joahaeyo                  |    (picture)     |    |  <- b2, only with a picture
|        ---------------------------------------     +------------------+    |
|        I like gimbap.                                                     |  <- b1
+--------------------------------------------------------------------------+
```

Panel 2 — **pattern**: b0 frame with slot boxes, b1 note, b2 example 1, b3 example 2

```
+--------------------------------------------------------------------------+
| Sentence pattern                                                         |
|        [ ____ ] 주세요.          ([ ____ ] juseyo)                         |  <- slot box, accessible name "gap"
|        "Ask for something: put the thing in the gap."           (note b1) |
|        1  물 주세요.     mul juseyo       Water, please.            (b2)   |
|        2  김밥 주세요.   gimbap juseyo    Gimbap, please.           (b3)   |
+--------------------------------------------------------------------------+
```

Panel 3 — **read along** (Discover exchange): b0 line A, b1 line B; the Sound control plays the current line and lights it

```
+--------------------------------------------------------------------------+
| Read along                                                [ (spk) Read ] |
|   (A) +--------------------------------------+                           |
|       | 안녕하세요?                            |  <- lit while it plays     |
|       | annyeonghaseyo?   Hello.             |                           |
|       +--------------------------------------+                           |
|                         +--------------------------------------+ (B)     |
|                         | 네, 안녕하세요.                        |  (b1)   |
|                         | ne, annyeonghaseyo.   Yes, hello.    |         |
|                         +--------------------------------------+         |
+--------------------------------------------------------------------------+
```

Panel 4 — **realia** + **realia question** (Discover realia; Realia Read rounds): the drawn sheet stays left; the question and options right; b1 rings the answer entry and marks the option

```
+--------------------------------------------------------------------------+
| +---------------------------+   Look closely and find the answer.        |
| |  MENU (drawn sheet)        |   How much is the ramyeon?                 |
| |  라면 ramyeon .... 5,000   |   라면 ramyeon (ramyeon)        <- key word |
| | (o) ring on the answer row |   (circle 1) 3,000   (triangle 2) 5,000    |
| |  김밥 gimbap .... 3,000    |   (square 3) 4,000                         |
| +---------------------------+   b1: option 2 gets the check + border;    |
|                                  the others set back (never red)         |
+--------------------------------------------------------------------------+
```

Panel 5 — **listen** quiz (listen-pick, also every Check round) and **reply** quiz (tap-respond)

```
+--------------------------------------------------------------------------+
| Which one did you hear?                              [ (spk) Play again ] |
|   (circle 1)  사과  sagwa      (triangle 2)  바나나  banana                 |
|   (square 3)  포도  podo       (star 4)      딸기  ttalgi                   |
| no Korean voice: the prompt shows "sagwa" only + teacher chip;            |
| its Hangul appears with the answer (b1)                                   |
|--------------------------------------------------------------------------|
| Which answer fits?                                                       |
|   "뭐 먹을래요?  mwo meogeullaeyo?  What will you eat?"                     |
|   (circle 1) 김밥 먹을래요. ...   (triangle 2) 네, 고마워요. ...              |
|   b1: glosses of the options appear; the fitting reply is marked          |
+--------------------------------------------------------------------------+
```

Panel 6 — **sentence build** (Sentence Builder `order-it`; also the Stage 7 Check): b0 bank of shuffled tiles, then one tile moves per click, then the whole sentence with romanization and meaning

```
+--------------------------------------------------------------------------+
| Build the sentence together            Which word comes next?            |
|  sentence line:  [ 저는 ] [ 사과를 ] [  ...  ]                               |  <- placed tiles, in order
|  bank:           ( 먹어요. )  ( 좋아요 )                                    |  <- next tile + a distractor
|  particle tile:  [ 사과 + (를 / 을) ]  "Which ending fits?"  -> 를 stays   |
|  last build:     저는 사과를 먹어요.  jeoneun sagwareul meogeoyo  I eat an apple.|
|                  distractor 좋아요 set back in the bank (not marked wrong)  |
+--------------------------------------------------------------------------+
```

Panel 7 — **write together** (type, trace, frame, own name): the line "Write on paper or on your own device. Nothing is typed here." is always on the slide

```
+--------------------------------------------------------------------------+
| Write together                                                           |
| "Write on paper or on your own device. Nothing is typed here."           |
|--------------------------------------------------------------------------|
| type:   "Type the word for this picture."  (picture)                     |
|         Type it on your own device, then look.                           |
|         b1:  사과  sagwa  apple                                           |
|--------------------------------------------------------------------------|
| trace:  ( 하늘 drawn as a large outline ghost )                            |
|         Trace it in the air, then on paper.                              |
|         b1:  haneul  sky                                                 |
|--------------------------------------------------------------------------|
| frame:  저는 [ ____ ]를 좋아해요.                                            |
|         bank: (사과 sagwa) (포도 podo) (바나나 banana)        (b1)          |
|         For example: 저는 사과를 좋아해요.                     (b2)          |
|--------------------------------------------------------------------------|
| own name: 제 이름은 [ ____ ]이에요/예요.  + the sound table       |
|         Write your own name in Hangul on paper.   (no name is ever shown) |
+--------------------------------------------------------------------------+
```

## Interaction points

- `next` (right arrow, PageDown, clicker, tap on the right two thirds) → the next build; `prev` → the previous build (going back is silent, F-TCH-004 §3.5 amendment 2).
- Sound control / `S` → plays the current line (read along) or the prompt (listen quiz); no voice → the text variant, never an error.
- `Shift+R` → romanization `always` / `tap` rebuilds the current slide's builds (section 5.2 of the amendment).
- Grid → each new slide shows as its kind label + title text (no tiny Korean), skippable as today.

## Navigation graph

Enter from: start screen (`classroom/lecture-presenter.md` B, `classroom/lecture-presets.md` E) · grid jump · previous slide
Exit to: next slide · grid · overlays (timer, picker, blank, pause, help, exit) · End slide

## States

- **success**: Panels 1-7.
- **no picture**: sentence and type slides drop the picture build; the layout centres the text.
- **no Korean voice / muted**: the teacher chip; listen prompts as romanization only until the answer; read along shows both lines and plays nothing.
- **reduced motion**: tile moves and line highlights are instant swaps.
- **portrait or too small**: the letterbox and the "Turn the screen" hint, as today.
- **missing romanization** (should not happen; content validation requires it): the slide is omitted and counted on the start screen.
- **loading / error**: slides are built locally before Start; an unknown id is a counted skip on the start screen, never an error slide.

## Data needs

- Bundled content only: `quests` Discover pages, `scopeFor` round data (`listenPick`, `dialogue`, `realiaRead`, `orderIt`, `typeHangul`, `traceWord`, `writeFrame`), `RealiaSheet`, `PictureArt`, the presenter font (glyph list extended, spec section 5.1).
- Nothing written; nothing typed.

## Open questions

- Trace ghost at 380 units: the presenter font as an outline (CSS stroke on web) or the block's placed ghost from F-CURR-001 G-4; decided in the LV-0b mock with a projector check.
