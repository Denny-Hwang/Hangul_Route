# Words: Match on the topic's collected words (F-VOC-003 C-6)

Spec: `docs/specs/F-VOC-003-topic-picker-flashcards.md` T7, §3.4 (the Match activity), §3.9 (the vocab host); §9 item 3 (Match is drawn only from 3 collected words).
Wireframe: `design/wireframes/vocab/topic-detail.md` (the Match activity) and the game's own `design/wireframes/minigame/pic-word-match.md` (F-QUEST-002 §3.11).
Code: `apps/mobile/src/screens/vocab/VocabMatchScreen.tsx` (binding only); the board is `apps/mobile/src/logic/vocab/match-board.ts` (100 % covered); the game is F-QUEST-002's `PicWordMatchGame`; the writes are `store/vocab-run-store.ts` (`vocabHost`, C-3).
Screenshots: `pnpm --filter @hangul-route/mobile build:web:fixtures`, then `HR_SHOTS=1 STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test vocab-match`; PNGs in `apps/mobile/e2e/web/__shots__/vocab-match-*.png` (git-ignored).

## Frame

```
┌────────────────────────────────┐
│ [<-]                           │  <- Back, top-left, as on every Words screen
│ [=======-----]          [Skip] │  <- the game's own header (F-QUEST-002), without its count
│ Match each picture             │
│ ┌───────────┐  ┌───────────┐   │
│ │   [pic]   │  │ ~~ 우유 ~~ │   │  <- pictures left, words right, tap-tap in either order
│ └───────────┘  └───────────┘   │
│ ... 3 to 5 pairs ...           │
└────────────────────────────────┘
```

The board is the F-QUEST-002 Pic-Word Match board, drawn and played exactly as in a quest (its pairing, amber miss, ring after two misses, number badges, Skip, the spoken word on a match). This screen adds only the Back button above it and chooses the pairs.

## The board

- **Words**: the topic's **collected** words (an `introduced` word, F-VOC-005) whose pictures draw (T8), in a seeded order, at most 5 and at least 3 (`PicWordRoundSchema`). Two words that share their Korean, a sense (`sameSense`), an overlapping pair (`VOCAB_EXCLUDED_PAIRS`) or a picture never sit on one board, since either could be "the" match.
- **A pair**: the word's picture (`PictureArt`), its Korean with its romanization (per the learner's reading-practice setting, the game's rule) and its meaning in the UI language (`localizedGloss`), which the picture's name and the matched word's name carry.
- **Dealt once**, when the screen opens, from what was collected then.

## Flow

| Step | What happens |
|---|---|
| Open from the topic page's Match | the board; the run begins (`vocab-run-store.begin(profile, topic, 'match')`) |
| A pair matched or missed | the game reports the first answer per pair to the vocab host (`answer`, buffered) |
| The board is done | the host writes every first answer (`answer`, `source: 'match'`) and one `session` (`kind: 'match'`), once, then the topic page, whose meter and count follow |
| Back (or the system back) mid-board | the topic page; nothing is written (a board left early is not a practice) |
| Fewer than 3 playable collected words, an unknown, hidden or locked topic | the topic page in its place (it says "Topic not found", opens the grown-up gate, or offers Learn) |

## Accessibility, layout

As the game (design/wireframes/minigame/pic-word-match.md): every tile is a button named with its meaning or its word and its state, the selection and the next step are a polite live line, targets >= `touchTarget.min`, no timer, amber with a mark for a miss (never red), the board scrolls at 320 x 568 and at 200 % text. Back is the 64 dp "Go back" button top-left.

## Decisions taken while building

- **Back sits above the game's header** through a small `leading` slot added to `PicWordMatchGame` (it renders the node first inside its own `Screen`). A quest host passes nothing, so the quest screen is unchanged. Without it a web learner in a standalone PWA would have no way out of a board but finishing it.
- **The game's header keeps its fill-only bar and Skip, not its count**: `PicWordMatchGame` takes `showCount={false}` here, so the "2 / 4" pill of the quest header is not drawn (no fraction on the Words screens, §3.8, D3); a quest host passes nothing and keeps it.
- **Match is drawn only when a board can be dealt** (`matchPlayable`): 3 collected words that cannot share one board (an excluded pair, one picture, one sense) draw no Match, so the button never goes nowhere. The board search finds a board whenever 3 such words exist, whatever the seed. If the screen still opens with no board, it goes back to the topic page it came from (or puts the topic page in its place).
- **A finished board is kept** even when the learner leaves inside the game's 700 ms pause before it reports the end; a language change mid-board relabels the meanings without restarting the run.
- **No summary screen**: the topic page is the summary (its meter and count fill as the words are practised); Match has no stars (the Speed round owns them).
