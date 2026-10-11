# Story / Term gloss: inline word card and word-by-word lines (wireframe v2)

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.5 (Korean on screen: romanization, tap-for-gloss, inline terms), §3.10 (accessibility); `KoreanText` rules in `docs/specs/F-I18N-001-ui-locales.md` §3.5
Audience: anyone learning Hangul, any age (CLAUDE.md §1). The card is how a learner finds out what a Korean word in the story means without leaving the page.
Code (built): `apps/mobile/src/screens/story/ReaderParts.tsx` (gloss card, Korean block, word chips), state `openTerm` / `revealed` in `apps/mobile/src/logic/story/reader-state.ts`, view model `scene-view.ts`; Korean drawn by `packages/design-system` `KoreanText` (`design/components/KoreanText/spec.md`). Host screen: `story/reader.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko / rom / gloss ~~` taught Korean drawn with `KoreanText`, `{chip}` an inline Korean term chip, `[spk]` speaker button.

Promoted by F-STORY-002 PR 2.0 from the reader draft; panels C and D keep their letters from `story/reader.md`.

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.story.reader`).

## Scenario (Given-When-Then)

Given: the learner is reading a scene whose narration has a Korean term chip (`{kw:sagwan}`) or whose Korean line has word-by-word data
When: they tap the chip or a word
Then: they hear the word and see its Korean, romanization and meaning together, right under the text they were reading, and can close it and carry on

## Screen goal

"Tap a Korean word in the story to hear it and see what it means, without losing my place."

The card has no primary button: it is a reference card. Its only actions are the speaker and Close.

---

## C. Term gloss card (inline)

Opened by tapping an inline chip in the narration (or a word chip in D).

```
│ ┌──────────────────────────────┐
│ │ These officials were the     │
│ │ {사관 sagwan}, the royal ...  │  <- the tapped chip is marked (outline + selected state)
│ └──────────────────────────────┘
│ ┌──────────────────────────────┐
│ │ ~~ 사관                       │  <- gloss card appears right under the narration
│ │    sagwan                     │     (pushes content down; scrolls into view)
│ │    royal historian ~~   [spk] │  <- Korean at title size, romanization, gloss
│ │                    [ Close ]  │
│ └──────────────────────────────┘
│ ┌──────────────────────────────┐
│ │ Korean block (unchanged)     │
```

- Tapping the chip plays the word and opens the card. Tapping it again, Close, Escape (web), changing scene, or opening a checkpoint closes it. One card at a time (opening a culture note closes it too).
- Not a floating popover: nothing to position, works at 200 % text and with screen readers (announced politely: "royal historian").
- Opening the card sends nothing to the network and records nothing.
- In hide-romanization mode the tap also reveals the chip's romanization for the rest of the scene; the gloss is never hidden.

## D. Korean line with word-by-word glosses (only when the data has them)

```
│ ┌──────────────────────────────┐
│ │ ~~ [새] [동아줄을] [내려] [주세요] │  <- each word is a chip (tap = gloss card for that word)
│ │    sae dongajureul naeryeo juseyo │
│ │    Please send down a new rope. ~~ [spk] │  <- whole-line gloss always shown
│ └──────────────────────────────┘
```

- No `words[]` in the data (none authored at launch): the line is one tap target that plays the whole line; there is no invented word-by-word breakdown.
- Each word chip has a 64-point hit area even when its glyphs are smaller.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Inline chip in the narration | tap | play the term (`spokenKo ?? ko`, clip first when bundled) and open card C |
| Same chip again | tap | close the card |
| Word chip in a Korean line (D) | tap | play that word and open card C for it |
| Card speaker | tap | play the word again |
| Close | tap | close; focus returns to the chip |
| Escape (web) | key | close |
| Next / Back / checkpoint | any | the card closes with the scene |

## Navigation graph

Enter from: `story/reader` (A, B, E) only; the card is part of that screen, not a route.
Exit to: `story/reader` (the same scene, scroll position kept).

## States

- **success**: C as drawn.
- **empty**: a chip whose keyword has no gloss cannot ship (the validator requires `KoText.en`); a line without `words[]` shows no word chips (D note).
- **error**: an unknown keyword token renders its bare Korean as plain taught text (F-STORY-001 §3.4), no chip, no card.
- **muted / no Korean voice**: the card still opens with the text; the shared sound panel says "Sound is off" or offers "Say it yourself".
- **offline**: nothing changes (bundled data, device speech).
- **200 % text, 320 wide**: the card wraps; the Korean, romanization and gloss stack; the speaker stays reachable.
- **reduced motion**: the card appears without animation.

## Data needs

- reads: the scene view model (`narrationParts` with `{ kw }` parts, `korean.words?`), the profile's `romanizationMode`, `revealed` ids for this scene
- writes: nothing (reader state only, cleared on scene change)
- audio: F-AUDIO-004 `playPrompt` with `kind: 'word'`

## Open questions

1. Should a word chip in D also show its own gloss under each word (interlinear) for the Read level? Default: no, the whole-line gloss stays the single meaning line; revisit when Stage 5 books ship with `words[]`.
