# Preview player (BR-8)

Wireframe: `design/wireframes/browse/preview-player.md` A to C · Spec: F-BROWSE-001 §4.7, §4.10, BD2, BD3 · Mock: `mock/preview-player.html`, `mock/preview-states.html` · Shots: `shots/preview-player-375.png`, `-375-first.png`, `-1280.png`, `-320.png`, `-320-text200.png`, `shots/preview-states-375.png`, `-1280.png`

The lesson is the learner's own screen, unchanged. The mock draws the quest player on step 2 of 6 of Meet a, eo, g, n, the Discover page with ㄱ and ㄴ (header, step pill, page dots, letter cards, Hear it, the example words, Continue). It is there only to place the strip (`preview-frame.md`); the player is not redesigned here. Games and the story reader are drawn as their boxes.

| Part | Rule |
|---|---|
| Strip | `preview-frame.md`, with [ Leave preview ] |
| Lesson | the learner screens in their own host modes (`'quest'`, `'check'`); the "Quick check" dots, amber nudges and Hoya `thinking` as the learner sees them; no red X |
| Speaking steps | follow `voiceEchoEnabled` (off at launch) |
| The lesson's own close (`close`, 64) | its own learner confirm, then the item page |

## Leave confirm (C)

A bottom sheet over the `surface.overlay` scrim (a centred dialog from the regular class):
- "Leave this preview?" (Heading `prompt`, the `alertdialog` name).
- Two buttons on one row, wrapping at 200 % text: [ Keep going ] (ghost) and [ Leave ] (primary). Leave goes to the item page with no end screen.

There is no warning tone: nothing is lost.

## Other states

- **Story** (B): the learner replay reader (scene art, Read to me, glosses, Sources copy-only, page turns) under the strip; no bookmark, no rounds.
- **Error**: the learner `OopsScreen` under the strip, with [[ Back to the lesson page ]].
- **Pass idles out mid-lesson**: the lesson goes on to its end; the next navigation shows Access.
