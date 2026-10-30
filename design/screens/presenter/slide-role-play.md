# Role Play slide (screen spec)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` section 8 (new slide kind "Role Play (a read-together chat; the class picks the reply)"), section 7.7 (no bad ending in a Role Play branch, no speaking UI) · learner game: `design/wireframes/minigame/role-play.md` ("the lecture Role Play slide (§8, CM-35 and CM-63)") · row **CM-35** (the slide); row CM-63 adds the `game` block and presets, not this slide
Reuses: `slide-listen-reply.md` (the reply question: "Which answer fits?", one row per reply with its shape-and-number marker, meanings at the answer build, README D6 reveal), `slide-read-along.md` (bubbles at the left and the right, a speaker name above the line), `slide-realia.md` "Realia question" (two columns on the stage, each fitting itself)

## What it is

A Role Play step of a quest becomes one slide per turn of the scene's **main path** (each turn's first natural reply, as the learner fallback plays it). The room reads the chat together; the teacher (or a learner pointing) picks the reply by its marker ("triangle, 2"). Nothing is collected, tallied or spoken into; there is no microphone, no record control and no "say it" prompt (LV-D9, section 7.7). The stage never branches: a class that likes the second natural reply sees it marked as natural too, and the chat goes on along the main path.

## Layout (1280 x 720 stage, units)

Two columns, `STAGE_GAP` apart, both centred vertically:

- **Chat** (`ROLE_PLAY_CHAT_SHARE`, 44 % of the content width):
  - Head row: the kind label **Role play** (`slide.rolePlay.label`, caption, semibold, `text.secondary`) and the scene's place in the slide language ("At the library", content, caption, `text.primary`).
  - From the second turn, the **exchange before** this turn: the partner's line (left) and the reply the class gave (right), Korean at `presenter.size.body`, romanization and meaning as one caption run.
  - The **partner's line now** (left): the role above it (caption, semibold, `text.secondary`), the Korean at `presenter.size.prompt`, its romanization and meaning (caption).
  - Bubbles are at most `ROLE_PLAY_BUBBLE_SHARE` (88 %) of the column. Partner: `surface.sunken`, `border.strong` stage border. Class: `brand.secondaryLight`, `brand.secondary` border, no name (the learner's own bubbles have none).
  - On the **last turn**, at the answer build: the scene's closing line (content, caption, semibold) in a `feedback.successLight` box with a `feedback.success` border, so every chat ends well on the stage.
- **Replies** (the rest):
  - The question **Which answer fits?** (`quiz.reply`, prompt size, bold) across the column. The column is narrower than a question slide's row, so there is no "Hoya's answer" line beside it: the check marks (named "Hoya's answer", README D6) mark the answer, and Hoya himself is in the reasons' box.
  - One row per reply (`OptionRows`, the reply question's rows): marker, Korean at prompt size, romanization; the meaning joins at the answer build.
  - Under the rows, at the answer build: **Hoya's reasons**: one amber box (`feedback.nudge` border on `feedback.nudgeLight`, `text.primary`) with Hoya `thinking` (`touchTarget.min` units) and, for each less natural reply, its marker (body size) and its reason (content; `{ko:}` tokens as Korean chips with their romanization).

## Small stage (a phone sideways)

Where the text floor draws text bigger than its units (`ROLE_PLAY_STACK_SCALE`, 1.2: 568 x 320 draws caption text 1.5 times its units, 844 x 390 none), the slide draws one column, as the reply question does: the question, the partner's line in one wrapping row (role, Korean, romanization, meaning) in its bubble, the reply rows, Hoya's reasons and, on the last turn, the closing line. The earlier exchange is left out there (the slide before shows it).

## Builds

`[question, answer]` in both romanization modes.

- **question**: everything but the meanings of the replies, the marks, the reasons and the closing line, which keep their space (unread) so nothing moves at the reveal. With `romanization: 'tap'` the romanization of the partner's line and of the replies waits for the answer build (D2), as on a reply question; the earlier exchange keeps its romanization (the room already read it).
- **answer**: every natural reply gets the success border, ground and check mark; the less natural rows drop to `presenter.dimOpacity` (README D6: no red, no cross) and Hoya's box gives each one's reason; the last turn adds the closing line.

## Sound

The bar's Sound (and `S`) plays the partner's line now, at the sentence rate, at every build (`slideSound`). The replies are the room's to read; no slide plays them.

## Fit

Each column fits itself (`useFitLevel`, the measured fallback of V8); a new stage scale fits again from level 0.

- Replies: level 1 compact rows, level 2 the question at body size, level 3 the rows' romanization and meaning and Hoya's reasons at caption size.
- Chat: level 1 the earlier exchange's Korean at caption size, level 2 the partner's line at body size.

## Accessibility

- The chat is a list named **Chat** (`a11y.minigame.rolePlay.log`, the learner game's). The partner's bubble is named "librarian: 무슨 책을 찾아요?, museun chaegeul chajayo, What book are you looking for?" (as a read-along line; the romanization only once it shows); the class's is named "The class said: 안녕하세요!, annyeonghaseyo, Hello!" (`a11y.presenter.rolePlayClass`), never a name.
- The live region on arrival: "Slide 3 of 12, Role play, Which answer fits?, librarian, …" (`grid.kind.rolePlay`, `quiz.reply`, the partner's line); never a reply, which would be the answer.
- The slide grid titles a turn by its scene ("At the library"), never by a reply.
- Colour is never the only cue: the marks are check glyphs, and each reason carries its reply's shape-and-number marker.

## As built (CM-35)

Checked on a local build with the fixture library scene in a Stage 4 quest (not committed: no shipped quest has a Role Play step yet), at 1280 x 720, 1920 x 1080, 844 x 390 and 568 x 320 (touch), in en, es and ko: every part of every turn inside the stage at both builds; the reply column settles at fit level 3 at 1280 x 720 with three replies and a reason, the chat at level 2.

## Old presenters

The deck does not change: a deck names quests, and the presenter builds the slides from its own bundled content, so a Role Play turn reaches only a presenter that draws it. A deck holding a quest with a Role Play step stays `v: 1`, and no new `LECTURE_DECODE_FAILURES` code is needed (section 8: bump `v` only if the deck shape changes). Row CM-63's new `game` block and presets bring their own decode failure code.

## Strings

New: `learner.presenter.grid.kind.rolePlay` and `learner.presenter.slide.rolePlay.label` (en "Role play", es "Juego de roles", ko "역할극"), `a11y.presenter.rolePlayClass` (en "The class said: {line}", es "La clase dijo: {line}", ko "우리 반의 대답: {line}"). Reused: `quiz.reply`, `a11y.presenter.answerMark`, `a11y.presenter.option`, `a11y.hoya`, `a11y.minigame.rolePlay.log`. The scene's place, the partner's role, the lines, the reasons and the closing line are content (lesson JSON with es and ko overlays).
