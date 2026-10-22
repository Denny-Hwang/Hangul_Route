# Minigame/My Story: a short text from chained word-bank frames, shown as My page and not kept (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 row F8 (`my-story`, new kind; S7 and packs; fallback Write Frame on the first frame; "3-5 chained write-frames make a short text. Slots are word-bank only, with no free text, as in Write Frame. The finished text is shown at the end as 'My page' and is not kept after the quest (F-CURR-001 OD-6). Never sent in telemetry"), OD-13 (decided 2026-10-21: **not kept**), §11.1 (My Story text is never sent), §7.7, §12.2 (`game.my-story`), row **CM-D2** (this file), built in row **CM-38** · built from `design/wireframes/minigame/write-frame.md` (pick -> write -> sentence, the allomorph rule, My page) and `type-hangul.md` / `trace-word.md` (the write part) · extends `shell.md` · supersedes, for this app, the free response and voice input of `docs/blueprints/06-mini-game-catalog.md` game 12 (word bank only, no voice)
Audience: **any learner, any age** (CLAUDE.md §1). Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder.
Mock: `design/screens/minigame-variety/` (`mock/my-story.html`, `mock/states.html` board Y; shots at 320 and 768)
Code (planned, CM-38): renderer `apps/mobile/src/screens/minigames/MyStoryGame.tsx` composing the shipped Write Frame round (`logic/write-frame/`); pure rules `apps/mobile/src/logic/my-story/` (chain reducer, page view, `myStoryToWriteFrame`); round schema `MyStorySchema` in `packages/content-schema`
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `~~ x ~~` taught Korean with romanization and gloss, `[___]` a slot, `<state>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 7 quest step or a pack level 5 step with a `my-story` scope (a topic and a picture prompt: "My weekend", "My favourite place")
When: the learner fills 3 to 5 sentence frames in a row, each by picking a word from a bank of taught words and writing it, and watches the sentences gather into one short text
Then: any pick is right, each frame's particle fits the pick, the writing is checked against the word they picked, and the finished text is shown once as "My page": it is not saved, not sent and not shown to anyone else, and it is gone when the quest moves on

## Screen goal

"Pick and write a word for each line, and read your own short text."

## Round shape

- **A chain of 3 to 5 frames** around one topic, each a Write Frame round (pick a word for the slot, then type or trace it as the frame says; `write-frame.md` phase 1 and 2). The frames are written so that any pick makes a sentence that reads well after the ones before it.
- **Word bank only, no free text** (P-1 extended, CM-38): every slot is filled from its bank of 3 to 5 taught words; there is no keyboard field outside the picked word, no "other", no name entry.
- **A neutral option in every bank** (refinement `my-story-neutral-option`, CM-38): one option per slot that tells nothing about the learner's life, so nobody has to share a family, a feeling or a place to finish: the cast name 호야 for a person slot, 괜찮아요 ("okay") for a feeling slot, an everyday public place (공원 "park") for a place slot. It is marked `neutral: true` in content, drawn like the others (not first, not labelled), and the MAR checks it.
- **No slot asks for private facts**: no home address, school name, real name, age, health, religion or family situation. The frame lint lists banned slot topics; the MAR checks every frame.
- **The text grows on screen**: above the current frame, the sentences already written are listed as "My story so far" (Korean, romanization, meaning).
- **Scoring**: the pick is never right or wrong (Write Frame rule). The write part scores like Type Hangul (first Done) or Trace a Word (first pass); a near miss shows the picked word under the typed one with Hoya's amber nudge and [ Fix it ].
- **Skip**: yes (Write Frame rule), which ends the step and still shows My page with the sentences written so far (or no page when none was written).

Example chain (fixture words; the allomorph helper picks 과 / 와; romanization from the repo converter):

| Frame | Korean frame | Bank (neutral option in bold) |
|---|---|---|
| 1 | 저는 주말에 [___]에 가요. (jeoneun jumare ___e gayo) · On the weekend I go to ___. | 도서관 (doseogwan) · 시장 (sijang) · **공원 (gongwon)** |
| 2 | [___]과/와 같이 가요. (___gwa/wa gachi gayo) · I go with ___. | 친구 (chingu) · 가족 (gajok) · **호야 (hoya)** |
| 3 | 기분이 [___]. (gibuni ___) · I feel ___. | 좋아요 (joayo) · 아주 좋아요 (aju joayo) · **괜찮아요 (gwaenchanayo)** |

## Box diagram

Frame 2 of 3, pick phase, compact (320 x 568; the page scrolls, Skip at the end):

```
+--------------------------------+
| [==========-----]     (2 / 3)  |  <- shell top row: frames in the chain
|  (Write your story)            |  <- heading
| +----------------------------+ |
| | (My story so far)          | |  <- the sentences already written, one per line,
| |  ~~ 저는 주말에 공원에 가요. ~~| |     Korean + romanization (meaning under each
| |  (jeoneun jumare gongwone  | |     at bodySm)
| |   gayo)                    | |
| +----------------------------+ |
| +----------------------------+ |
| | [_____]과/와 같이 가요.      | |  <- the current frame card (Write Frame phase 1)
| | (___gwa/wa gachi gayo)     | |
| | (I go with ___.)           | |
| +----------------------------+ |
|  (Pick a word. Any word works.)|
|  [ ~~ 친구 ~~ ] [ ~~ 가족 ~~ ]   |  <- word bank: Write Frame cards, 2 columns at 320
|  [ ~~ 호야 ~~ ]                 |
|  [ Skip ]                      |
+--------------------------------+
```

The write phase is Write Frame's phase 2 unchanged (the frame shrinks to one line, the keyboard or the canvas takes the rest; "My story so far" folds to one line, "(2 lines so far)", which opens on a tap).

My page (after the last frame; replaces Write Frame's single-frame page):

```
+--------------------------------+
|  (My page)                     |  <- title
|  (This page is just for now.   |  <- the not-kept line, always shown, above the text
|   It is not saved.)            |
| +----------------------------+ |
| |  ~~ 저는 주말에 공원에 가요. ~~| |  <- each sentence: Korean, romanization, meaning,
| |  (jeoneun jumare gongwone  | |     and a Hear it button of its own
| |   gayo)                    | |
| |  (On the weekend I go to   | |
| |   the park.)  [ (sp) Hear ]| |
| |  ~~ 호야와 같이 가요. ~~      | |
| |  (hoyawa gachi gayo)       | |
| |  (I go with Hoya.) [ Hear ]| |
| |  ~~ 기분이 괜찮아요. ~~       | |
| |  (gibuni gwaenchanayo)     | |
| |  (I feel okay.)    [ Hear ]| |
| +----------------------------+ |
|  (Hoya cheering) (You wrote a  |  <- myStory.done after the last frame; after Skip with
|   whole story!)                |     some lines written: myStory.donePartial "(Here is your
|                                |     story so far.)" (the same page, the same not-kept line)
|  [[ Done ]]                    |  <- ends the step; the page is cleared
+--------------------------------+
```

- **Not kept** (OD-13): no save, share, download, copy, print or screenshot prompt; no "keep this" button. Done clears the text from the renderer's state; leaving the quest clears it too. A reopened step starts with an empty chain.
- No Korean voice reads the page aloud unless the learner taps a Hear button (nothing autoplays on My page).

Regular (768 x 1024): "My story so far" sits beside the current frame card (two panes from window class 700), the bank in 3 columns; My page in the reading column.

## Interaction points

- **Word card** (pick phase): fills the slot, the particle after it changes to the one that fits (Write Frame allomorph rule), then the write phase opens (Write Frame).
- **[ Change word ]** (write phase): back to the pick, nothing scored.
- **Done** (type) / trace pass: the Write Frame result; a pass adds the sentence to "My story so far" (it slides up into the list, `motion.duration.base`; at once with reduced motion), its sentence is said once, and the next frame opens after the shell's pause.
- **"My story so far"**: read-only; each line has no button during the chain (Hear buttons are on My page), so a stray tap cannot leave the current frame.
- **Hear** (My page): says that sentence.
- **Done** (My page): `markStepComplete()` + `onFinish()`, clears the text.
- **[ Skip ]**: ends the chain; My page shows the sentences written so far (if any) with the same not-kept line and Hoya's `myStory.donePartial` line ("Here is your story so far."), never "You wrote a whole story!", then Done. `myStory.done` shows only when every frame of the chain was written.

## Fallback round when `game.my-story` is off

**Write Frame on the first frame**, derived by `myStoryToWriteFrame(scope)`: frame 1 as a Write Frame round with its bank (neutral option included), then Write Frame's own My page of one sentence (shipped, not kept, `writeFrame.myPage.notKept`). The rest of the chain is not played. Same scoring of the write part.

## No device voice

- The chain needs no sound: every frame, word and sentence is printed with romanization and meaning.
- Each finished sentence is said once as an extra, and Hear on My page says a sentence. When it cannot be said, the **status panel** (`audio-fallback.md` W9, the Korean is printed) appears under that sentence: "No Korean voice on this device." [ How to add a voice ], "Sound is off." [ Turn sound on ], "The sound did not play." [ Try again ]. Source `my-story`. Neutral, a polite live region. Nothing asks the learner to read the story aloud.

## Navigation graph

Enter from: `quest/player` (S7 Apply and Check per §7.1 and the S7 Volume 2 rows; pack level 5) via `minigame/shell`
Exit to: `quest/player` (Done on My page)

## States

- **pick**, **write (type or trace)**, **near / far miss** (Write Frame and Type Hangul panels), **sentence added**, **My page**, **skipped with sentences**, **skipped with none** (no page; the step completes at once).
- **empty / bad data**: a chain that fails `my-story-neutral-option` or has fewer than 3 frames never builds; the shell's empty state otherwise.
- **leaving mid-chain** (the quest's leave sheet, the app backgrounded and killed): nothing is restored; the text was never written to a store.
- **large text (200 %)**: the frame and bank grow; "My story so far" folds to its one-line form earlier; My page scrolls.
- **reduced motion**: no slide into the list; nothing animates on My page.

## Data and privacy

- reads: the `my-story` scope: `{ id, topicKey, pictureRef?, frames: WriteFrameRound[3..5] }` where every frame's bank has exactly one `neutral: true` option (CM-38).
- writes: `answerRound(frameIdx, correct)` for the write part (Write Frame rule); memory items: **only the frame's `pat` item** at the produce rung, credited the same whichever bank word was picked. **No `lex` credit for a picked word**, in any slot: a per-word credit would record which word was picked (가족 or 호야 for "I go with ___", 좋아요 or 괜찮아요 for "I feel ___"), and memory states sync to the server (`memory_shards`) and feed the learning summaries a caregiver or teacher can see, which would undo the neutral option. This matches the shipped Write Frame, which records no pick either.
- **The text stays in the renderer's React state only.** It is never written to a store, a persisted slice, a breadcrumb, a log line, telemetry, a sync snapshot, a backup or a report, and never put in route params, the web URL (path, query or hash) or navigation state (test P-1, extended to My Story by CM-38; the grep test covers `MyStoryGame.tsx` and `logic/my-story/`, and a unit test checks that `MyStoryGame` never calls `navigate`, `push`, `replace` or `setParams` with sentence or pick data: its only exit is the shell's `onFinish()`). **The picked words are not recorded by the app anywhere either**, memory included: the only thing that leaves the renderer is the frame's `pat` credit, which is identical for every pick. CM-38's P-1 extension adds a test: two runs of the same chain with different picks (and the same write results) produce identical memory writes, `answerRound` calls and telemetry.
- **The device voice (accepted residual, for CM-38's privacy review to confirm).** The auto-said sentence and the Hear buttons of My page pass the sentence to the device's speech engine, like every other spoken line in the app. On the web the voice ranking (`apps/mobile/src/logic/audio/voice-rank.ts`) prefers a `localService` voice but does not exclude a network one, so a browser whose only Korean voice is a network voice (Chrome's Google Korean voice, for one) may send the sentence to the browser maker's speech service. What it would send is only bank words chosen from fixed, reviewed content (no free text, no name, every bank with a neutral option), with no profile or account identifier from the app, through the same path that already speaks every taught word on the web. The design accepts this; CM-38's privacy review decides it explicitly. The stricter alternative, if that review wants it: for `my-story` sources, speak only with a `localService` voice and otherwise show the shipped no-voice status (the round stays answerable by reading).
- telemetry: `minigame.finished { kind: 'my-story' | 'write-frame', questId, stepIndex }` only; `audio.fallback_shown { source: 'my-story', reason }`.

## Accessibility

- Write Frame's rules hold for each frame (slot names, bank cards, the result panel).
- "My story so far" is a list named "My story so far, 2 lines"; each line reads its Korean, romanization and meaning.
- My page: the title is a heading; the not-kept line is read right after it; each sentence is a group with its Hear button ("Hear jeoneun jumare gongwone gayo").
- Done takes focus last in the reading order; nothing steals focus.

## Tokens and targets

- Word cards `touchTarget.child` (80) tall (Write Frame), Hear buttons `touchTarget.min` (48 dp floor met), Done `touchTarget.child`. "My story so far" card `surface.sunken`, `radii.lg`; the current frame card `surface.paper`, `shadows.card`; My page sheet `surface.paper`, `border.subtle`, `shadows.card` (Write Frame's page sheet). Type sizes as Write Frame.

## Draft strings (CM-38 adds them with their es and ko values)

Reused: `learner.minigame.writeFrame.*` (pick line, Change word, sentence done, `myPage.title`, `myPage.notKept`), `typeHangul.*`, `traceWord.*`, `skip`, `progress.pill`, `audio.*`. Topics, frames and banks are content (overlays in es and ko, MAR language and culture pass, the neutral-option check).

| Key (proposed) | en draft |
|---|---|
| `myStory.heading` | Write your story |
| `myStory.soFar` | My story so far |
| `myStory.soFarFolded(n)` | {n} lines so far (plural rules: 1 line / {n} lines) |
| `myStory.done` | You wrote a whole story! (every frame written) |
| `myStory.donePartial` | Here is your story so far. (after Skip, one line or more written) |
| `myStory.doneCta` | Done |
| `a11y.minigame.myStory.soFar(n)` | My story so far, {n} lines |
| `a11y.minigame.myStory.hearSentence(romanization)` | Hear {romanization} |

## Open questions

1. **A kept keepsake** (OD-13's alternative: a device-only kept page) needs a privacy review row and its own spec; it is out of this design. The not-kept line stays until then.
2. **Picture prompt.** A topic picture (scene art) above frame 1 helps learners imagine the story; it is optional per scope and costs scene-art budget. CM-38 ships without it unless a pack row supplies the art.
