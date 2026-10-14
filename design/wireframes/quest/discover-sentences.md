# Quest/Discover sentences: sentence, pattern, exchange (with Read along) and realia pages (wireframe v1)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.1 rules 1, 4 and 7 (Discover unscored, teach once, romanization and gloss), §3.4 (the Stage 3 pattern page and its `noteEn` with `{ko:}` tokens), §3.5 (Stage 4 exchange pages; Read Along's audio-synced line highlight), §3.6 (Stage 6 realia page), §3.7 (Stage 7 frame and model pages), §3.10 (the four Discover item types), §3.14 (accessibility, audio, layout), PR **D-1** (this file); schema in **C-1**, built by the rows that first ship each item: S3-1 (sentence, pattern), S4-1 (exchange and Read along), G-2 / S6-1 (realia)
Extends: `design/wireframes/quest/discover.md` (the Discover step, its header, page dots, Hoya line, Continue, its states) · audio states: `minigame/audio-fallback.md` · the realia drawing itself: `minigame/realia-read.md` (D-2)
Audience: **any learner, any age** (CLAUDE.md §1); the same screens for everyone. Wireframe level: structure, flow, interaction points. No colours, fonts or final copy; text in (parentheses) is a placeholder, the drafts are in `design/screens/minigame-sentence-builder/v1/spec.md` ("Strings").
Mock: `design/screens/minigame-sentence-builder/v1/mock/discover-pages.html` (the four page types and the Read along states, at 320 px and tablet).
Code: `apps/mobile/src/screens/quest/DiscoverStep.tsx` (renders; one item component per type), `apps/mobile/src/logic/stage1/discover-flow.ts` (decides; gains the Read along effects) · `DiscoverItemSchema` in `packages/content-schema/src/schemas/quest.ts` (C-1 adds the four types)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `( x )` text placeholder, `{ x }` content-driven, `~~ x ~~` taught Korean drawn with `KoreanText` (Korean + romanization + gloss), `( ) (*)` page dots (fill-only), `[___]` a pattern slot, `>>` the reading-now mark.

## Scenario (Given-When-Then)

Given: a learner starts a quest of Stage 3, 4, 6 or 7 (any entry: Episode, Home, a plan, the grown-up preview)
When: the player reaches step 2, `discover`, and its pages hold sentences, a sentence pattern, a short exchange between two people or a drawn real-world text
Then: every new sentence, pattern, line or word is shown with its romanization and meaning and can be heard, an exchange can be read along while the app reads each line and lights it up, and Continue moves on at once (nothing is scored, nothing is gated on hearing)

## Screen goal

"Show me the new sentence (or pattern, or conversation, or sign) and let me hear it, then let me play."

## The page frame (unchanged from `discover.md`)

```
+----------------------------------+
| [x leave]  o (*) . . . .  (2 / 6)|  <- the player header, as every step
|  (Look and learn)  [step pill]   |
|  (Hoya, small) "{hoya line}"     |  <- the step's Hoya line, once (one Hoya per screen)
|   (Page 1 of 2)   (*) ( )        |  <- page dots, fill-only
|   {page caption}                 |  <- optional `captionEn`, one line
|  +----------------------------+  |
|  |  ITEM 1 (one of the types  |  |  <- 1 or 2 items per page, at most 3 pages
|  |  below, or jamo / word)    |  |     (U-1: at most 3 pages of at most 2 items)
|  +----------------------------+  |
|  +----------------------------+  |
|  |  ITEM 2 (optional)         |  |
|  +----------------------------+  |
|   [[ CONTINUE ]]                 |  <- always enabled, pinned at the bottom when the page scrolls
+----------------------------------+
```

Item weights: a `pattern`, an `exchange` and a `realia` item each fill a page on a phone, so a page holds **one** of them, or one of them followed by one `sentence` or `word` item when both fit (the authoring rule the C-2 test U-1 can check: a page has at most one `pattern`, `exchange` or `realia` item). Two `sentence` items share a page like two words do.

---

## S1. `sentence` item: one Korean sentence (Stage 3 example page, Stage 7 model page)

```
+------------------------------+
|        {picture?}            |  <- optional picture (word:, card:), decorative
|                              |
|  ~~ 밥을 먹어요. ~~            |  <- the sentence, prompt size, wraps at spaces only
|     (babeul meogeoyo)        |  <- romanization: one romanized word per Korean word
|     "(I eat rice.)"          |  <- gloss in the UI language
|   [ (speaker) Hear it ]      |  <- plays the sentence (kind 'sentence')
+------------------------------+
```

- The sentence ends with its sentence mark (§3.4). Romanization follows `romanizationMode` exactly as an example word does on today's pages: `tap` hides it behind "(Show how to say it)"; the gloss never hides.
- The picture is decorative (the sentence names it), as on the word page.

## S2. `pattern` item: a frame, its note and two examples (Stage 3 pattern page, Stage 7 frame page)

```
+------------------------------+
|  (Sentence pattern)  [pill]  |  <- small label so the frame is not read as a sentence
|                              |
|  ~~ [___]이에요 / [___]예요 ~~   |  <- the frame: the slot is a dashed box the size of a
|     (___ ieyo / ___ yeyo)    |     short word; the frame's romanization; its meaning
|     "(It is ___.)"           |     with the slot shown the same way
|   [ (speaker) Hear it ]      |  <- plays the two examples one after the other
|  - - - - - - - - - - - - -   |
|  {note}: "(Use {ko:이에요}      |  <- `noteEn`, one line or two; each {ko:} token is a
|   after a final consonant,   |     KoreanText chip with its romanization (no Hangul
|   {ko:예요} after a vowel.)"  |     in the English string itself)
|  - - - - - - - - - - - - -   |
|  (Examples)                  |
|  +--------------------------+|
|  | ~~ [책]이에요. ~~   [spk] ||  <- the slot word drawn in the slot's box (solid now),
|  |   (chaegieyo)            ||     so the learner sees what filled the slot; the ending
|  |   "(It is a book.)"      ||     after it is the frame's (underlined, not colour alone)
|  +--------------------------+|
|  +--------------------------+|
|  | ~~ [학교]예요. ~~  [spk]  ||  <- the second example shows the other form when the
|  |   (hakgyoyeyo)           ||     frame has two (이에요 / 예요, 을 / 를, 이 / 가)
|  |   "(It is a school.)"    ||
|  +--------------------------+|
+------------------------------+
```

- **One slot marker** per frame (§3.10). Stage 7 frames with a particle slot write it explicitly (`___을/를`, `___이에요/예요`, `___에`); the frame shows both forms joined by a slash and the examples show which one a word takes.
- The slot box is empty and dashed in the frame, solid and filled in the examples: shape and line style tell them apart, never colour alone. Its accessible name is "(a word goes here)".
- The example sentence's romanization is of the whole word (`chaegieyo`), as it is said; the slot box sits on the Korean only.
- Hear it on the frame plays example 1 then example 2 (a frame with a blank has no sound of its own); each example's own speaker plays that example.

## S3. `exchange` item: two lines between two named speakers, with Read along (Stage 4)

### S3a. At rest

```
+------------------------------+
|  [ (play) Read along ]       |  <- reads every line of this item in order and lights
|                              |     each line while it plays; secondary, not the page CTA
|  +--------------------------+|
|  | (o) {Hoya}               ||  <- speaker row: a small portrait (Hoya's face, or a
|  |  ~~ 이게 뭐예요? ~~   [spk] ||     neutral portrait for a cast member) + the name
|  |     (ige mwoyeyo)        ||     as content (Korean name with romanization, or the
|  |     "(What is this?)"    ||     role in the UI language: "(teacher)")
|  +--------------------------+|
|  +--------------------------+|
|  |               {teacher}(o)||  <- speaker B on the other side (start / end), so two
|  | ~~ 책이에요. ~~       [spk] ||     voices read as two people; the text stays
|  |    (chaegieyo)           ||     start-aligned inside the line for easy reading
|  |    "(It is a book.)"     ||
|  +--------------------------+|
+------------------------------+
```

- Lines are not chat bubbles: they are reading cards with the speaker named above, because the learner follows the text, not a phone conversation. Speaker A's portrait sits at the start, speaker B's at the end; at 320 px both lines keep the full width.
- Each line has its own speaker button (plays that line only). A line's question mark and full stop are part of the taught Korean.

### S3b. Read along playing (the audio-synced line highlight)

```
+------------------------------+
|  [ Stop ]                     |  <- the same button, now Stop (label only: the Icon set has no stop glyph and `pause` would promise a resume); focus stays on it
|                              |
|  +==========================+|  <- line 1 now playing: thick start border, tinted
|  |>> (Reading now) {Hoya}   ||     fill, the ">>" glyph and the words "(Reading now)"
|  |  ~~ 이게 뭐예요? ~~         ||     (shape + glyph + word: never colour alone)
|  |     (ige mwoyeyo)        ||
|  |     "(What is this?)"    ||
|  +==========================+|
|  +--------------------------+|  <- line 2 waits, at full contrast (never dimmed: the
|  |               {teacher}(o)||     learner may read ahead)
|  | ~~ 책이에요. ~~             ||
|  +--------------------------+|
+------------------------------+

then: line 1 returns to rest, a short pause (motion.duration.slow), line 2 lights, plays, returns to rest;
after the last line: the button reads "(Read along)" again and focus returns to it.
```

- **Sync rule** (pure, `discover-flow`): a line lights **when its `playPrompt` starts** and returns to rest **when it resolves** (the `afterReply` promise Tap to Respond uses), so the highlight follows the real audio, recording or TTS, without word timings. No per-word highlight in v1 (no timing data; see Open questions).
- If a page has two exchange items, Read along on the first item reads that item only; there is one Read along button per item.
- Read along never turns the page and never starts by itself (the story reader's Read to me rule): the learner taps it. Continue stays enabled; tapping Continue, Stop, leave or a line's own speaker stops Read along at once (a line's speaker then plays just that line, lit).
- The page scrolls the lit line into view when it is off screen (instantly under reduced motion).
- **Sound off / no Korean voice** (`playPrompt` returns `muted` or `unavailable`): Read along shows the status line of `audio-fallback.md` once (the `PromptPanel` "status" variant) and lights nothing; every line is already on the page in Korean, romanization and gloss, so the page works without sound (§3.14). No timed highlight without sound: a highlight that moves on its own would be a clock.
- Screen reader: Read along is a button whose label changes to Stop; each lit line is announced as "(Line 1 of 2, {speaker})" in a polite live region before it plays, so a VoiceOver / TalkBack user hears which line the voice reads.

### S3c. Casual and polite (Playdate Talk)

```
|  {page caption}: "(Friends of the same age often talk like this.)"   <- the page's `captionEn`
|  +--------------------------+|
|  | (o) {Mina}               ||
|  |  ~~ 같이 할까? ~~           ||  <- casual line, recognised only (OD-8)
|  +--------------------------+|
```

- The casual / polite explanation is the page caption (content, sourced, §3.5), one sentence with no age range for the learner. Lines carry no register badge in v1 (see Open questions 2).

## S4. `realia` item: a drawn real-world text and its key words (Stage 6)

```
+------------------------------+
|  +--------------------------+|
|  |                          ||  <- the realia drawing (a menu board, a ticket, a
|  |     {realia scene}       ||     sign, a price card), drawn by D-2 / G-2 in the
|  |                          ||     scene-art style; full column width, at most about
|  +--------------------------+|     half the window height; its texts are real text
|                              |     in the accessibility tree (a menu = a list)
|  (Words on it)               |
|  ~~ 김밥 ~~  (gimbap)    [spk]   |  <- up to 6 key words, one row each: Korean,
|     "(gimbap)"               |     romanization, gloss, a small speaker
|  ~~ 떡볶이 ~~ (tteokbokki) [spk] |
|     "(spicy rice cakes)"     |
|  ...                         |
+------------------------------+
```

- Up to **6** key words (§3.10); a number set taught together (일 이 삼 사 오) is one key-word row with the run shown as one line.
- Tapping a key word's speaker plays the word. The drawing is not tappable in Discover (finding things in it is the game's job, `minigame/realia-read.md`).
- The drawing's alt text names what it is ("(A snack-bar menu board)"); its words are read from the real-text list, not from the picture.

---

## Tablet (regular and wide, 600 dp and up; `pictureTextArrangement` side by side)

```
pattern page:                                      exchange page:
+-----------------------------------------------+  +-----------------------------------------------+
| (Page 1 of 2) (*) ( )                         |  |         [ (play) Read along ]                 |
| +-------------------+ +---------------------+ |  |  +-----------------------------------------+  |
| | (Sentence pattern)| | (Examples)          | |  |  | (o) {Hoya}  ~~ 이게 뭐예요? ~~      [spk] |  |
| | ~~ [___]이에요 ~~  | | ~~ [책]이에요. ~~    | |  |  +-----------------------------------------+  |
| | {note}            | | ~~ [학교]예요. ~~    | |  |  +-----------------------------------------+  |
| +-------------------+ +---------------------+ |  |  |          ~~ 책이에요. ~~ {teacher} (o)  |  |
|                       [[ CONTINUE ]]          |  |  +-----------------------------------------+  |
+-----------------------------------------------+  |              [[ CONTINUE ]]                   |
                                                   +-----------------------------------------------+
realia page: the drawing on the left, the key words on the right (two columns of rows when 5-6 words).
sentence page: two sentence items side by side, as two word cards today.
```

- **Exchange stays one column** at every width, centred in the reading column (`layout.maxWidth.reading`): a conversation reads top to bottom, and side-by-side lines would read as two separate texts.
- Pattern: frame + note on the left, examples on the right. Realia: drawing left, words right. Sentence: as today's two-up item columns.

## Interaction points

| Where | Gesture | Result |
|---|---|---|
| Hear it (sentence, pattern frame, example, key word, a line's speaker) | tap | `playPrompt` of that text (`kind: 'sentence'` for sentences and lines, `'word'` for key words); the "heard" mark of `discover.md` on the item; unlimited |
| Read along | tap | plays the item's lines in order with the line highlight (S3b); becomes Stop |
| Stop | tap | stops the audio, clears the highlight, the button is Read along again |
| Show how to say it (tap mode) | tap | shows the romanization of that sentence, example or line (as on the word page) |
| `{ko:}` chip in a note | tap | plays the chip's Korean (it is taught content); it already shows its romanization |
| CONTINUE | tap | next page; on the last page `quest.discover_completed { questId, pages, heard }` (existing; a Read along counts as hearing each line it played) |
| [x leave] | tap | the quest's leave sheet; stops any audio |

## Navigation graph

Enter from: `quest/player` step 1 (`intro`)
Exit to: `quest/player` step 3 (`practice`) · leave sheet -> `episode/detail` · grown-up preview: the same pages inside `browse/preview-player.md` (nothing saved)

## States

- **success**: as drawn (1-3 pages, 1-2 items each).
- **empty**: an item that does not resolve (unknown picture or realia ref, an exchange with fewer than two lines): the item is left out; a page with no item shows the `discover.md` empty line and CONTINUE; never a dead end (U-1 / the content test keeps it out of shipped data).
- **error**: a picture or realia drawing that fails to load shows the words alone (realia: its real-text list stays, so the page still teaches) · audio fails: the status line, nothing blocks.
- **no sound**: as S3b; every text is on the page.
- **tap mode** (`romanizationMode === 'tap'`): romanization of sentences, examples and lines hides behind "(Show how to say it)"; the pattern frame's own romanization and every gloss stay.
- **reduced motion**: the highlight changes instantly (no fade), no scroll animation, no pulse.
- **large text (200 %) / 320 px**: items stack, sentences wrap at spaces (`word-break: keep-all` on web), a speaker row may wrap the name under the portrait; the page scrolls and CONTINUE stays reachable.
- **offline**: bundled; no network.
- **anti-shame**: nothing is scored, timed or locked; no "you did not listen" message.

## Data needs

- reads: `questById(id).steps[]` -> `discover.pages[].items[]` with the four new types (C-1, `DiscoverItemSchema`):
  - `sentence`: `{ type, sentence: KoText, picture? }`;
  - `pattern`: `{ type, frame: { ko, romanization, en } with one slot marker, noteEn (with {ko:} tokens), examples: [KoText, KoText] }`, each example with the slot word's span (`slot: { start, end }` on the Korean) so the example can draw its slot box;
  - `exchange`: `{ type, lines: [{ speaker, line: KoText }, { speaker, line: KoText }] }`, `speaker` a cast reference that resolves to a portrait and a name (Korean with romanization, or a role gloss);
  - `realia`: `{ type, realiaRef, altEn, keyWords: KoText[] (1-6) }`.
  `romanizationMode`; the lesson overlay (`es`, `ko`) for every gloss, note, caption and alt text; `layoutClass`.
- writes: nothing (unscored).
- telemetry: `quest.discover_completed { questId, pages, heard }` (existing; no new event, §3.11).

## Decisions taken in this design pass

1. **Line highlight, not word highlight.** The spec asks for the line to light up; a line-level highlight needs no timing data and stays exact with any voice (recording or TTS).
2. **Highlight = start border + tinted fill + ">>" glyph + "(Reading now)".** Four cues; colour is never the only one, and the text is never dimmed.
3. **Read along is per item, tap to start, never automatic,** and it never turns a page: the learner keeps the pace (the story reader's Read to me rule).
4. **No highlight without sound.** A highlight moving on a timer would be a clock on a reading page.
5. **One heavy item per page** (pattern, exchange or realia), so a phone page never needs two long scrolls.

## Open questions

1. **Word-by-word highlight** for Read along (karaoke style) would need per-word timings for every line and voice. Default: not in v1; revisit when recorded lesson audio exists.
2. **Register badge on lines** ("(Friends' talk)" on casual lines in Playdate Talk). Default: no badge; the page caption explains it once (OD-8). If the language review asks for it, it is a `register` field on the line plus one string.
3. **Speaker portraits.** The cast beyond Hoya has no portraits yet. Default: Hoya's face for Hoya, a neutral person glyph in a disc for everyone else (no new art); S4-1 decides the cast names with the culture review.
4. **Read along across two items on one page.** Default: one button per item. Alternative: one page-level button that reads every exchange on the page.
