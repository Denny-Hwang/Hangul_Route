# Results / Extra cards: more cards joined your Library (wireframe v2)

Spec: `docs/specs/F-STORY-006-card-award-model.md` §3.1 (award rules), §3.3 (where awards happen), §3.4 (stage completion), §3.7 (Results copy), §3.10; base screen `results/celebrate.md`; story quests add `results/celebrate-story.md` (F-STORY-003), whose reserved slot this banner fills
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Completion is celebrated, never measured: no "4 of 9", no percent.
Code: engine and live path built (`apps/mobile/src/logic/awards/*`, `logic/results-award.ts` returning `QuestResultOutcome`, store actions `unlockCards` / `reconcileAwards`, PR 6.2-6.4b); the banner is planned in PR 6.5a: `screens/results/ExtraCardsBanner.tsx` inside `ResultsScreen.tsx`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `[art]` a 96 card thumbnail with its rarity border.

Promoted by F-STORY-006 PR 6.0 from panel D of the one-file draft (`journey/grid-with-stories.md`); this file replaces the placeholder that only pointed there.

All copy in boxes is placeholder; final strings land in `packages/i18n` (`learner.results`, PR 6.5a).

## Scenario (Given-When-Then)

Given: the learner finishes the quest that completes an episode, a stage or a card set (or a story whose card they earn)
When: Results opens
Then: beside the usual stars and quest card, one banner says what they finished and shows every extra card that just joined their Library; on any other run nothing extra appears

## Screen goal

"Show me the extra cards I just earned, and why."

The banner has no button of its own: each thumbnail opens its card. The page's one primary stays the existing one (**Back home**, or **See your Stage 1 prize** on stage completion).

---

## D. Results: more cards joined your Library

```
┌──────────────────────────────────┐
│        Hoya (cheering)           │
│        "<headline>"              │
│        * * *   (stars)           │
│ [Hoya bubble: cheer line]        │
│                                  │
│ ┌──────────────────────────────┐ │   <- existing quest card banner (2+ stars), unchanged
│ │ New card for your library!   │ │
│ │ [art] Kimchi  김치  gimchi   │ │
│ │ [ See my card ]              │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │   <- NEW: only when an episode / stage / set just completed
│ │ "You finished <episode>!"    │ │      (live region, announced as one sentence)
│ │ "4 more cards joined your    │ │
│ │  Library!"                   │ │
│ │ [art][art][art][art]         │ │      <= 6 thumbs, wrap, each tappable -> CardDetail
│ └──────────────────────────────┘ │      (96 tiles, rarity border)
│                                  │
│ [[ Back home ]]  / on Stage 1 completion: [[ See your Stage 1 prize ]] (F-QUEST-002)
│ [ Episode page ]                 │
└──────────────────────────────────┘
```

- Appears only on the run that completes the episode (or stage, or set). A replay, or an episode that was already complete, shows nothing new.
- A 1-star finish still shows the banner (completion is not star-gated); the quest card banner shows only at 2+ stars (unchanged).
- More than six cards: six thumbnails and "and N more in your Library" (a count, not a fraction).
- Reduced motion: static. Sparkles stay on the quest card at 3 stars only (unchanged).
- On a story quest the banner sits in the slot `results/celebrate-story.md` reserves, under the story block.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Card thumbnail | tap | `CardDetail { cardId }` (opening it clears that card's New pill) |
| Primary (Stage 1 completion) | tap | `StageComplete` (F-QUEST-002); the banner still shows above it |
| Primary (otherwise) | tap | unchanged (Back home) |
| Episode page | tap | unchanged |

## Navigation graph

Enter from: `quest/player` (the run that completes an episode, stage or set)
Exit to: `library/card-detail` (thumbnail) · `StageComplete` (F-QUEST-002) · `home/todays-mission` · `episode/detail` · `library/gallery` (later, through the Library tab)

## States

- **success**: D as drawn.
- **empty**: nothing completed on this run: no banner (Results is `results/celebrate`).
- **error**: a card id without art shows its rarity frame and title only; an award that fails to write is retried by the next reconcile (cards are monotonic), and the banner shows only what was written.
- **replay**: no banner; nothing is awarded twice.
- **offline**: awards are local; sync merges later without losing a card.
- **200 % text / 320 wide**: thumbnails wrap to rows of two or three; the sentence wraps.
- **reduced motion**: no entrance animation.

## Data needs

- reads: `QuestResultOutcome` (`cardsAwarded` with each card's source: episode, stage, welcome, set, story, quest), card catalogue (art, title, rarity), the completed episode or stage title
- writes: cards through `unlockCards` (already done by the live path before the banner renders)
- telemetry: `card.unlocked` with `source`, `episode.complete` `{ episodeId, cardsAwarded }`, `stage.complete`, `card_set.complete` (all sent by the live path, PR 6.4b)

## Open questions

1. When an episode and a set complete on the same run, one banner with both reasons or two banners? Default: one banner, the episode sentence first, all cards together.
