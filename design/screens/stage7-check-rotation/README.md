# Stage 7 Check rotation (F-CURR-002 §7.1, row CM-3A S7)

The Stage 7 Volume 1 Checks rotate over Cloze Pick, Sentence Builder and Write Frame (the default S7 Check), five
each, so no game is the Check of more than 40 in 100 of the stage's quests. No new screen: each Check uses a shipped
game or a switched game's fallback. Built shots from the release bundle (`journey-upper-cell.spec.ts`, `HR_SHOTS=1`).
`game.cloze-pick` ships at built-in pct 0, so the release build plays a Cloze Pick Check as its fallback, Listen & Pick
in its text prompt mode: the sentence with its gap, its meaning and the same tiles.

| Shot | What it shows |
|---|---|
| `shots/write-your-name-q1-cloze-check-320.png` | Write Your Name q1, the Check at 320 px: 이건 ___이에요. with the tiles 이름, 한글, 책. |
| `shots/write-your-name-q1-cloze-check-wide.png` | The same Check on a wide window. |
| `shots/favorite-animal-q1-cloze-check-320.png` | My Favorite Animal q1, the particle Check at 320 px: 고양이___ 좋아요. with the tiles 이, 가, 를. |
| `shots/favorite-animal-q1-cloze-check-wide.png` | The same Check on a wide window. |

A Write Frame Check plays in the Check host: two fill-only dots and "Quick check" in the header, and no Skip in any
phase (the Check is the quest's only evidence). Shots from the fixture bundle (`write-frame.spec.ts`, `HR_SHOTS=1`,
`STORY_FIXTURES=1`), on the two-slot fixture frame:

| Shot | What it shows |
|---|---|
| `shots/write-frame-check-320.png` | A two-slot Write Frame Check at 320 x 568: the first slot written (추석), the second slot's bank, no Skip. |
| `shots/write-frame-check-320-largest.png` | The same Check at the largest text size, before the first pick: the frame wraps, nothing scrolls sideways. |
