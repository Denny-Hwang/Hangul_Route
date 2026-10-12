# Home / Cards catch-up: the one-time good-news card (wireframe v2)

Spec: `docs/specs/F-STORY-006-card-award-model.md` §3.5 (catch-up for existing learners), §3.7 (Home surface), §3.10; base screen `home/todays-mission.md`
Audience: anyone learning Hangul, any age (CLAUDE.md §1). Existing learners who earned cards before the award model existed get them once, as good news; no timer, no counter.
Code: reconcile and the session-only `catchUp` state built (`apps/mobile/src/logic/awards/catch-up.ts`, store `reconcileAwards` / `markCardsSeen`, PR 6.4a; telemetry in 6.4b); the card is built in PR 6.5c (HomeScreen `CatchUpCard`, `logic/awards/catch-up.ts` `catchUpCard`; count frozen by the session-only `catchUpFound`, review follow-up).
Notation: `[[ X ]]` the one primary action, `(n)` a mission slot.

Promoted by F-STORY-006 PR 6.0 from panel E of the one-file draft (`journey/grid-with-stories.md`).

All copy in boxes is placeholder; final strings land in `packages/i18n` (`learner.home`, PR 6.5c).

## Scenario (Given-When-Then)

Given: a learner who played before this version opens the app, and the reconcile on start adds cards they had already earned (more than the welcome card)
When: Today opens in that session
Then: one card under the greeting says Hoya found the cards they already earned, with one button to see them; it never interrupts the three mission cards and does not come back

## Screen goal

"Tell me, once, that I have new cards I already earned."

One primary action on this card: **See my cards**. The mission cards keep their own buttons and order.

---

## E. Home: the one-time catch-up card

```
┌──────────────────────────────────┐
│ "Hi <name>"          streak line │
│ ┌──────────────────────────────┐ │   <- once per app session, only if the reconcile added
│ │ [Hoya cheering]              │ │      earned cards other than the welcome card
│ │ "Hoya found 22 cards you     │ │
│ │  already earned!"            │ │
│ │ [[ See my cards ]]           │ │      -> Library; marks those cards seen
│ └──────────────────────────────┘ │
│ ── Today's three cards (unchanged, never interrupted by the catch-up card) ──
│ (1) ...  (2) ...  (3) ...         │
└──────────────────────────────────┘
```

- No dismiss timer, no remaining counter. If the app closes first, the Library "New" pills remain, so nothing is lost.
- The count is the number of cards found ("22 cards"), never a fraction of the collection.
- This card's Hoya replaces the greeting's Hoya while it shows; it adds no Hoya of its own. On regular and wide windows the side column's tip bubble keeps its Hoya, as Home always has.
- The number is fixed while the card shows: cards opened in the Library leave the list but never count it down.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| See my cards | tap | `Main { screen: 'Library' }` (Cards section) and `markCardsSeen(those cards)`; the card goes away for good |
| Mission cards | tap | unchanged |

## Navigation graph

Enter from: `tabs/home` (Today) in the first session after an update whose reconcile added cards · cold launch after the profile pick
Exit to: `library/gallery` (See my cards) · the existing Today exits

## States

- **success**: E as drawn.
- **empty**: the reconcile added nothing, or only the welcome card: no catch-up card (Today is unchanged).
- **error**: the reconcile cannot read progress: no card; the next start tries again (the reconcile is idempotent).
- **after the session**: the card does not return; the New pills in the Library carry the news.
- **offline**: the reconcile is local; nothing waits on the network.
- **wide window**: the card spans the mission column under the greeting (`layout/wide.md` B).
- **reduced motion**: Hoya's cheer is static.

## Data needs

- reads: the session-only `catchUp[profileId]` in the progress store (the card ids a reconcile added this app session and not yet seen; empty when the reconcile added only the welcome card), set by `reconcileAwards` at start, and `catchUpFound[profileId]` (every card listed since the list was last empty), whose length is the count
- writes: `markCardsSeen(cardIds)` on See my cards
- telemetry: `card.catchup_granted` `{ count, episode, stage, welcome, quest, set }` once per reconcile that adds more than the welcome card (sent by the reconcile, PR 6.4b)

## Open questions

1. Placement under the greeting vs below the three mission cards: default under the greeting, because it is a one-time good-news message.
