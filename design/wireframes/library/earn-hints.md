# Library / Earn hints: every locked card says how to get it (wireframe v2)

Spec: `docs/specs/F-STORY-006-card-award-model.md` §3.1 (award rules), §3.7 (Library, Episode page, CardDetail copy), §3.10; base screens `library/gallery.md`, `library/card-detail.md`; Library sections from F-STORY-004 (`library/stories.md`)
Audience: anyone learning Hangul, any age (CLAUDE.md §1). A lock tells you what to do next, never how far behind you are.
Code: hint copy built (`learner.library.earnHint`, `learner.library.how`, PR 6.1 / 6.2); rules in `apps/mobile/src/logic/awards/*` (`unlockedBy` per card, PR 6.2); the surfaces are planned in PR 6.5b inside `screens/library/LibraryScreen.tsx` and `CardDetailView.tsx` (the wide-window detail pane already shows "How to earn it", F-LAYOUT-001 PR 5b).
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `[New]` the new-since-last-view pill, `lock` a locked tile.

Promoted by F-STORY-006 PR 6.0 from panel F of the one-file draft (`journey/grid-with-stories.md`).

All copy in boxes is placeholder or the shipped string; final strings live in `packages/i18n` (`learner.library`, `learner.cardDetail`).

## Scenario (Given-When-Then)

Given: the learner opens the Library's Cards section with some cards earned and some not
When: they look at a locked card (in the grid, or opened)
Then: the lock says, in one or two lines, exactly how that card is earned (finish an episode, a story, a stage, collect a set, or a welcome gift), and the cards they earned since their last visit wear a "New" pill until opened

## Screen goal

"See my cards, and know exactly how to get the ones I do not have."

The Cards section has no single primary button; tiles are one button each.

---

## F. Library: header, New pill, locked tile, honest explainer

```
┌──────────────────────────────────┐
│ "Heritage Library"               │
│ "12 cards collected"             │   <- plain count; no N/M pill (decision 3)
│ chips: All Letters Food Holiday Nature Play
│ ┌──────────┐ ┌──────────┐        │
│ │ [art]    │ │ lock     │        │
│ │ 김치     │ │ "Finish  │        │   <- locked tile: the earn hint, <= 2 lines
│ │ gimchi   │ │  the     │        │      accessibility label: "Locked card. Finish the
│ │ Kimchi   │ │  episode:│        │      episode: Around the Korean Table"
│ │ [New]    │ │  Around… │        │      [New] = new since the last view (cleared when opened)
│ └──────────┘ └──────────┘        │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ How to collect more          │ │
│ │ Finish a quest to earn its   │ │
│ │ card.                        │ │
│ │ Finish every quest in an     │ │
│ │ episode to earn more cards.  │ │
│ │ Finish all of Stage 1 for    │ │
│ │ the legendary cards.         │ │   <- + "Finish a story to earn its card." when a story is playable
│ │ Hoya's tiger card is a       │ │
│ │ welcome gift.                │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘

F2  Locked card opened (CardDetail, or the detail pane on a wide window)
│ [silhouette, rarity border]
│ How to earn it
│ Finish the episode: Around the Korean Table
│ (flip disabled)
```

Earn hints by rule (shipped strings): episode "Finish the episode: <title>" · story "Finish the story: <title>" · stage "Finish every quest in Stage <n>" · welcome "A welcome gift from Hoya" · set "Collect every card from the <collection> stories".

- Only obtainable-or-owned cards are listed; a held or unreviewed story's card never appears as a lock.
- The explainer is honest: each line describes a rule that exists in this build (until PR 6.5b ships it stays "Finish quests to unlock cards.").
- A long hint truncates after two lines on the tile; the full hint is in the label and on the card page.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Owned tile | tap | `CardDetail { cardId }` (wide: the detail pane); clears its New pill |
| Locked tile | tap | `CardDetail { cardId }` showing F2 (no paywall, no flip) |
| Theme chip | tap | local filter (as today) |

## Navigation graph

Enter from: `tabs/library` · `results/extra-cards` (via the Library tab) · `home/cards-catch-up` (See my cards) · `episode/detail` / `episode/detail-story` card rows
Exit to: `library/card-detail` · other Library sections (`library/stories`, `library/culture`)

## States

- **success**: F as drawn.
- **empty**: a brand-new learner: only the welcome card is owned; every other listed card shows its hint; the explainer is the guide.
- **error**: a card whose rule cannot be resolved shows "This card comes in a later quest." (the shipped fallback) instead of a wrong hint.
- **New pills after a catch-up**: every reconciled card shows New until opened or until See my cards marks them seen.
- **offline**: local snapshot; sync merges the seen state (seen anywhere wins).
- **wide window**: grid in the master pane, F2 in the detail pane (`layout/wide.md` D).
- **200 % text / 320 wide**: tiles go to one column; hints wrap to two lines.

## Data needs

- reads: the card catalogue (with `unlockedBy`), owned cards (`ProgressSnapshot.cards[]` with `newSinceLastView`), the award world (episodes, quests, stages, sets, story cards with their bundle state), episode and story titles for the hints
- writes: `markCardsSeen` when an owned card is opened
- telemetry: none new (opening a card is not tracked)

## Open questions

1. **Tiger rarity**: keep `legendary` as authored (default) or demote the welcome card to `rare` so "legendary" stays a milestone? The explainer already calls it a gift.
2. **N/M pill removal** (F-STORY-006 decision 3): restore it as a fill-only meter if preferred.
