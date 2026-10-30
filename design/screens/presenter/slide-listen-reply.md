# Listen and reply questions (screen spec v2)

Spec: AMENDMENTS-LECTURE-V2 sections 5.1 (`listen-pick`, `tap-respond`), 5.2, 3.7 text variant · wireframe Panel 5 · row **LV-S2**
Mock: `mock/slide-quiz-listen.html` (Stage 3 life q1 Check c1, pictures), `slide-quiz-listen-text.html` (c2, no Korean voice), `slide-quiz-reply.html` (Stage 4 life q1 turn 1) · shots `slide-quiz-listen-*`, `-gray`, `-b0`, `slide-quiz-listen-text-*`, `slide-quiz-reply-*`, `-b0`

## Listen (`ask: 'listen'`)

- Question row: the stage speaker button (`quiz.playPrompt`), **Which one did you hear?** (`quiz.listen`), and at the reveal "Hoya's answer" (README D6).
- At the answer build the prompt's Korean, romanization and gloss appear as one line under the question, so the room sees what it heard.
- Picture options: the 2 x 2 grid with the shape markers, each picture 112 units (`--pic-opt`), named by its gloss. Text options: one row each (V8).
- **No Korean voice / sound off**: the bar's teacher chip ("No Korean voice here. You say it!"), and a "Say it:" box with the prompt's romanization only; its Hangul joins the box at the answer build (showing it first would give the answer away). The options' romanization joins at the answer build too (as with `romanization: 'tap'`), so the room cannot answer by matching the box's letters to a row's (LV-S2 review).

## Reply (`ask: 'reply'`)

- **Which answer fits?** (`quiz.reply`); under it the other speaker's line in a bordered box: speaker name (caption), Korean at `presenter.size.prompt`, romanization and gloss.
- Options: replies (Korean and romanization) one row each; each reply's gloss joins its row at the answer build.

Builds `[question, answer]` for both; the dimmed options and the mark are README D6's.

## As built (LV-S2)

Spec: AMENDMENTS-LECTURE-V2 section 5.2 "As built in LV-S2". Shots: `apps/mobile/e2e/web/presenter-questions.spec.ts` with `HR_SHOTS=1` (1280 x 720, 1920 x 1080, 568 x 320, 844 x 390, es and ko).

- **Listen**: as the mock. A letter or syllable round (`lp:sym:`, `lp:syl:`, Stage 1) keeps the 2 x 2 grid with the letters at display size and no meanings; its answer line reads the carrier syllable heard ("어 eo the letter eo"). A word or sentence round whose answer is not the line heard (the Stage 4 Checks: hear a question, pick its reply) asks **Which answer fits?** (`quiz.reply`); the line heard still joins at the answer build. An answer the line holds, spaces and punctuation aside ("이천 원" in "이천 원이에요."), was heard: that round asks **Which one did you hear?**.
- **Pictures** sit in the neutral `PictureArt` tile (F-VOC-002: card art and WordArt look alike, so a style never gives the answer away), `PIC_OPT` units, smaller with a shorter row.
- **Reply**: the box holds the other speaker's line without the speaker's name: the lesson scope keeps no speaker for a turn (the learner's Tap to Respond shows none), and a name needs an overlay field of its own to follow the slide language. A later content row can add it.
- **Fit**: the rows step to compact levels on a long text (Korean and Spanish meanings, a phone's 18 px floor): compact rows, then the line's Korean at body size, then romanizations and meanings at caption size; a new stage scale (fullscreen, the projector) fits again from level 0, and a step with no layout event measures the rows again (as the reading slides do).

## Pointed option (owner choice O2, decided 2026-10-29; `AMENDMENTS-PRESENTER-NAV.md` section 7.3; row PN-5)

The look and rules are `slide-quiz.md` "Pointed option" (dashed `text.primary` outline `spacing.sm` units outside the card, the pin at the marker on a paper disc, no fill, no `feedback` colour, no motion; any step clears it).

- **Picture grid** (`mock/nav-quiz-listen.html#b=0&point=2`; shot `slide-quiz-listen-pointed-1280x720.png`, projector look `-1280x720-projector`): the outline goes round the whole card, picture included; the pin sits on the marker's corner, clear of the picture tile.
- **Rows** (`mock/nav-quiz-reply.html#b=0&point=2`; shots `slide-quiz-reply-pointed-1280x720.png`, `-1920x1080`, `-844x390`, `-667x375`, `-640x360`, projector look `-1280x720-projector`): the outline runs the full row; the pin's disc sits on the marker's top right and reaches into the row gap above, never onto the Korean.
- **The outline sits in the middle of the row gap** (PN-0b review): on rows its offset is `(row gap - outline width) / 2` instead of `spacing.sm` units, so it keeps the same space to its own card and to the next row at every unit. The row gap is `spacing.md` units and the outline `max(STAGE_BORDER units, STAGE_BORDER_MIN)`, so with the grid's offset (8 units) the 2 px floor would reach the next row at a phone's unit (844 x 390, unit 0.58: 6.6 of 6.9 px; 640 x 360, unit 0.44: 5.5 of 5.25 px, over the neighbour's border). Measured space on each side of the dashed line: 4.5 px at 1280 x 720, 6.8 at 1920 x 1080, 2.5 at 844 x 390, 1.6 at 667 x 375 and 640 x 360; at every one it reads as its own line between two cards, and the pin marks which. The grid keeps `spacing.sm` units (its gaps are 32 x 48 units). PN-5 builds rows this way and keeps the row gap at `spacing.md` units (it must not shrink).
- The reply box above the options (the other speaker's line) is not a content target (section 7.1 lists the options only): a tap there is a tap on empty stage area (the Next ring on a docked window or the rail, the bar in the overlay layout) and points at nothing.

