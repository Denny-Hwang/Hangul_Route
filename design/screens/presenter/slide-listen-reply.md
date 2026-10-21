# Listen and reply questions (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (`listen-pick`, `tap-respond`), 5.2, 3.7 text variant · wireframe Panel 5 · row **LV-S2**
Mock: `mock/slide-quiz-listen.html` (Stage 3 life q1 Check c1, pictures), `slide-quiz-listen-text.html` (c2, no Korean voice), `slide-quiz-reply.html` (Stage 4 life q1 turn 1) · shots `slide-quiz-listen-*`, `-gray`, `-b0`, `slide-quiz-listen-text-*`, `slide-quiz-reply-*`, `-b0`

## Listen (`ask: 'listen'`)

- Question row: the stage speaker button (`quiz.playPrompt`), **Which one did you hear?** (`quiz.listen`), and at the reveal "Hoya's answer" (README D6).
- At the answer build the prompt's Korean, romanization and gloss appear as one line under the question, so the room sees what it heard.
- Picture options: the 2 x 2 grid with the shape markers, each picture 112 units (`--pic-opt`), named by its gloss. Text options: one row each (V8).
- **No Korean voice / sound off**: the bar's teacher chip ("No Korean voice here. You say it!"), and a "Say it:" box with the prompt's romanization only; its Hangul joins the box at the answer build (showing it first would give the answer away).

## Reply (`ask: 'reply'`)

- **Which answer fits?** (`quiz.reply`); under it the other speaker's line in a bordered box: speaker name (caption), Korean at `presenter.size.prompt`, romanization and gloss.
- Options: replies (Korean and romanization) one row each; each reply's gloss joins its row at the answer build.

Builds `[question, answer]` for both; the dimmed options and the mark are README D6's.

## As built (LV-S2)

Spec: AMENDMENTS-LECTURE-V2 section 5.2 "As built in LV-S2". Shots: `apps/mobile/e2e/web/presenter-questions.spec.ts` with `HR_SHOTS=1` (1280 x 720, 1920 x 1080, 568 x 320, 844 x 390, es and ko).

- **Listen**: as the mock. A letter or syllable round (`lp:sym:`, `lp:syl:`, Stage 1) keeps the 2 x 2 grid with the letters at display size and no meanings; its answer line reads the carrier syllable heard ("어 eo the letter eo"). A word or sentence round whose answer is not the line heard (the Stage 4 Checks: hear a question, pick its reply) asks **Which answer fits?** (`quiz.reply`); the line heard still joins at the answer build.
- **Pictures** sit in the neutral `PictureArt` tile (F-VOC-002: card art and WordArt look alike, so a style never gives the answer away), `PIC_OPT` units, smaller with a shorter row.
- **Reply**: the box holds the other speaker's line without the speaker's name: the lesson scope keeps no speaker for a turn (the learner's Tap to Respond shows none), and a name needs an overlay field of its own to follow the slide language. A later content row can add it.
- **Fit**: the rows step to compact levels on a long text (Korean and Spanish meanings, a phone's 18 px floor): compact rows, then the line's Korean at body size, then romanizations and meanings at caption size.
