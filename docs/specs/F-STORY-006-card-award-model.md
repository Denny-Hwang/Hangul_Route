Status: ready

# F-STORY-006 — Card award model: episode, stage, welcome and set awards, a safe catch-up for existing learners, and the heritage story cards

> **Start order (review 2, 2026-10-10)**: PR 6.1 (emoji and honest Library copy), 6.2 (pure award engine) and 6.3 (merge rules) have no dependency on other specs. 6.4a (store wiring) needs 6.2; 6.4b (live path) needs 6.4a; 6.5a-6.5c (surfaces) need 6.4b. The story cards (6.7-6.9) need F-STORY-001's `Story` bundle (the `card` block is already in its strict schema, PR 1.1b) and F-STORY-002's `StoryScene`; F-QUEST-002's PR Q-9 is blocked until 6.2 and 6.4b exist (interface in §3.4).

**Scope**: `packages/content-schema` (card fields, `unlockedBy` grammar, telemetry names) · `apps/mobile` (`logic/awards/`, `logic/results-award.ts`, `logic/reward.ts`, `logic/sync/merge.ts`, `store/progress-store.ts`, `store/bootstrap.ts`, `content/heritage-cards.ts`, `content/story-cards.ts`, `screens/results/`, `screens/library/`, `screens/home/`, `screens/episode/`, `screens/onboarding/`) · `packages/design-system` (art unchanged; `CardArt` lives in the app) · `packages/content-schema/src/story-lint.ts` (card rules)
**Owner**: solo dev
**Rollout**: Story mode phase 2 and the reward-loop fix of the audit (PR-17, `hangul-route-audit-2026-10-09.md:485`); the engine ships before F-QUEST-002's Stage 1 re-plan (§3.6)
**Wireframes**: `design/wireframes/results/extra-cards.md` · `library/earn-hints.md` · `home/cards-catch-up.md` · `library/card-back-citation.md` — drafted with F-STORY-005's surfaces in `wireframes/story-catalogue.md`, promoted by PR 6.0

Parent / siblings: CLAUDE.md §1 (reward system) · F-CARD-001/002 (card art, back face) · F-MOTION-003 (card unlock celebration) · F-SYNC-001 §3.3 (merge) · F-STORY-003 §3.7 (Results, replay and card) · F-STORY-004 (Library sections, `isFreeContent`) · F-STORY-005 (episodes, placement) · F-QUEST-002 §3.8 (Stage 1 completion, 15 quests) · F-CARD-S5-001 (Stage 5 scene cards, draft) · F-CNT-002 (romanization) · audit UX-03, UX-13, PR-17 · design input `story-mode.md` §2.7

---

## 1. Context

Heritage cards are the product's primary reward (CLAUDE.md §1). Today most of them can never be earned, and the Library says something false about them. This spec defines one award model that every card obeys, the code to honour it, how existing learners get what they already earned **without double awards**, and the new cards that come with the heritage stories.

What exists (verified on `main` at `c939348`, after PRs #91-#102, read at review 2):

- **42 cards**: 30 Stage 1 (`content/heritage-cards.ts:28-68`), 8 Stage 2 (`:70-82`), 4 Stage 4 (`:84-90`); `heritageCardsAll` (`:92`), `cardById` (`:94-96`). Rarity: 15 common, 13 uncommon, 10 rare, 4 legendary. Their `unlockedBy` values (counted by script on 2026-10-10): `episode:stage1-life` 6, `episode:stage1-letters` 5, `-rites` 5, `-nature` 5, `-crafts` 5, `episode:stage2-life` 4, `-nature` 4, `episode:stage4-rites` 4 (= 38), `stage1-complete` 3 (`hangul-day` `:35`, `lantern` `:51`, `gayageum` `:67`), `first-launch` 1 (`tiger` `:54`). `HeritageCardSchema.unlockedBy` is a bare `z.string()` (`packages/content-schema/src/schemas/heritage-card.ts:35`), so a typo is accepted.
- **Only one thing awards a card.** The single `unlockCard` call is in `logic/results-award.ts:66-71`, fed by the quest's own `rewardCardId` at **2+ stars** (`logic/reward.ts:6-10, 26-35`). Eleven quests carry a `rewardCardId` (`content/quests.ts:22, 37, 52, 68, 82, 98, 114, 130, 148, 162, 180`), so **11 of 42 cards are earnable and 31 never are** — all five episodes' extra cards, the Stage 2/4 cards that are not quest rewards, the three `stage1-complete` cards and the `first-launch` tiger. Nothing reads `episode.rewardCardIds` except display (`screens/episode/EpisodeDetailScreen.tsx:152-188`, which also shows the unearned ones as "Waiting for you", `:185`) and the first-quest preview count (`logic/onboarding/first-quest.ts:32`).
- **The Library says something false.** "Legendary cards appear when you complete a whole stage." (`screens/library/LibraryScreen.tsx:79-80`): the tiger is a `first-launch` card, nothing completes a stage, and the grid-wide counter shows "N of 42 collected" plus a `N/42` pill (`:45, 47`). A locked card is only a lock and the word "Locked" (`:120, 131-135`), with no way to learn how to earn it (audit UX-13). `CardDetailScreen` prints an emoji in three places (`:205, 351, 365`: the light bulb before the fact), against "no emoji in rendered output" (D7).
- **The first-card rule** counts every owned card: `isFirstCard = isNew && ownedCardIds.length === 0` (`logic/reward.ts:34`), so a welcome card would silently turn the `card.first_earned` funnel off.
- **Cards are already monotonic in the merge**: `mergeSnapshots` unions `cards` by `cardId` (`logic/sync/merge.ts:89`) with the earliest `unlockedAt`; but `mergeCard` keeps the **local** `newSinceLastView` (`:60-62`), so `merge(a, b)` and `merge(b, a)` differ, against the file's own claim that merge order never changes the result (`:12-16, 28`); and nothing ever sets `newSinceLastView` back to `false` (the only writer is `unlockCard`, `store/progress-store.ts:212`).
- **Sync transports the snapshot as an opaque blob** validated against `ProgressSnapshotSchema` (`packages/content-schema/src/schemas/progress.ts:75-86`, used as the PUT body by `SnapshotPutSchema`, `schemas/sync.ts:41-46`; the route is `packages/backend/src/routes/sync.ts:43-77`); zod strips keys it does not know, so a new snapshot field would be silently dropped by an old Worker. The caregiver summary only counts `snapshot.cards.length` (`logic/sync/summarize.ts:78`). The snapshot's `episodes[]` is never written (blank snapshot `episodes: []`, `progress-store.ts:81`; no other writer), so episode completion is **derived from `quests[]`** (`logic/journey.ts:29-38`).
- **Story content brings more cards**: the 24 heritage stories (F-STORY-005) each want a card with a **sourced** back face, and F-STORY-001 imports their facts and citations field for field (`facts[].claimEn` and `sources[]`).

Terms. **Award rule**: a function from (a card, the learner's progress) to "owned or not". **Derived awards**: the set of cards the rules say a snapshot should hold. **Reconcile**: add the missing derived awards to a snapshot. **Quest card**: the card named by `quest.rewardCardId`. **Episode cards**: cards whose `unlockedBy` is `episode:<id>`. **Stage cards**: `stage<N>-complete`. **Welcome card**: `first-launch`. **Set card**: `set:<id>`. **Catch-up**: reconcile adds cards the learner had already earned but never received.

## 2. User story

> As a learner I want every card I can see in the Library to be one I can actually earn — and when I finish an episode, a stage, or a whole collection of stories, I want the cards to arrive, with a clear "you got it" and without being told I am behind.

Companion stories:

- As a **learner who already played** I want the cards I should have received to show up once, kindly, and never twice.
- As a **grown-up** I want to know how to help a child earn a locked card, and I want the fact on the back of a story card to be one a teacher can check.
- As a **maintainer** I want CI to fail if a card can never be earned.

## 3. Acceptance criteria

### 3.1 Award rules (the model)

One table is the model. Every card has exactly one **primary rule**, written in its `unlockedBy`.

| `unlockedBy` | Rule | Fires when | Star-gated | `unlockedAt` (deterministic) |
|---|---|---|---|---|
| `episode:<id>` | **episode** | every quest of that episode has a `completedAt` (`isEpisodeComplete`, `logic/journey.ts:29-38`) | no — any star count | latest `completedAt` among the episode's quests |
| `stage<N>-complete` (`N` = 1..7) | **stage** | every grid episode of stage `N` is complete **and** the stage is fully shipped (`stageAvailability === 'open'`); only `stage1-complete` has cards at launch | no | latest episode-complete time of that stage |
| `first-launch` | **welcome** | the profile exists | n/a | `profile.createdAt` |
| `set:<id>` | **set** | every member card of the set is owned | no | latest member `unlockedAt` |

Plus one **secondary path**, not written in `unlockedBy`: the **quest card** — `quest.rewardCardId` is awarded on finishing that quest at **2+ stars** (unchanged: `logic/reward.ts`, F-MOTION-003 §3.5). A quest card is always also an episode card of its episode (T-AWARD-2), so a 1-star finish still brings it when the episode completes.

Rules of the model:

1. **Monotonic.** Awards are only ever added. Nothing a learner earned is removed by code — not by a replay with fewer stars, a sync, a restore, a content change that adds a quest to a finished episode, or a story being held for correction (D3).
2. **Star-independent beyond the quest card.** Episode, stage, welcome and set awards depend on completion, never on stars: a hard first-try round must not keep a prize from someone who finished everything (agrees with F-QUEST-002 §3.8). Completion itself needs a scored run (`total > 0`, `results-award.ts:39-48`).
3. **Deterministic.** Two devices with the same progress derive the same cards with the same `unlockedAt`; merging them yields one entry per card. This is what makes the catch-up (§3.5) free of double awards.
4. **Idempotent.** Replaying a quest, re-running a reconcile or syncing again changes nothing (`unlockCard` already returns when owned, `progress-store.ts:208`).
5. **Obtainable or hidden.** The Library lists a card only if the learner owns it or its rule can still fire (§3.7). A card that no rule can ever award is a CI failure, not a locked tile.
6. **Unknown rule = never awarded and a CI failure.** `unlockedBy` is tightened to the grammar above (§3.2).

### 3.2 Data

**`HeritageCardSchema`** (`heritage-card.ts:24-38`), additive and one tightening:

```ts
unlockedBy: z.string().regex(/^(episode:[a-z0-9-]+|stage[1-7]-complete|first-launch|set:[a-z0-9-]+)$/),   // all 42 existing values comply
storyId: z.string().regex(/^story:[a-z0-9-]+$/).optional(),
setId: z.string().regex(/^set:[a-z0-9-]+$/).optional(),
factId: z.string().optional(),                                         // resolves into the story's facts[]
citation: z.object({ title: z.string().min(1), publisher: z.string().min(1), more: z.number().int().nonnegative().default(0) }).optional(),
```

`factEn` (existing, optional) is the card's back-face fact. For story cards it is **generated** (§3.8), never typed. A refinement: `factId` and `citation` appear together, only on cards with `storyId`.

**Award world and engine** — `apps/mobile/src/logic/awards/` (new, pure, 100 % covered; nothing imports React or a store):

```ts
export type AwardSource = 'quest' | 'episode' | 'stage' | 'welcome' | 'set';
export type UnlockRule =
  | { kind: 'episode'; episodeId: string } | { kind: 'stage'; stage: StageKey }
  | { kind: 'welcome' } | { kind: 'set'; setId: string } | { kind: 'unknown'; raw: string };
export interface CardSet { id: string; cardId: string; memberCardIds: readonly string[] }      // from content/story-sets.ts
export interface AwardWorld { cards: readonly HeritageCard[]; episodes: readonly Episode[]; quests: readonly Quest[]; sets: readonly CardSet[] }
export interface DerivedAward { cardId: string; source: AwardSource; via: string; unlockedAt: string }   // via = episodeId | stageKey | questId | setId | 'welcome'

export function parseUnlockedBy(value: string): UnlockRule;
export function completedEpisodes(world: AwardWorld, snapshot: ProgressSnapshot): Map<string, string>;   // episodeId -> completion time
export function isStageComplete(stage: StageKey, world: AwardWorld, completed: ReadonlyMap<string, string>): { complete: boolean; at?: string };
export function derivedAwards(world: AwardWorld, snapshot: ProgressSnapshot, profile: { createdAt: string }): DerivedAward[];  // full recompute, includes quest cards
export function missingAwards(world: AwardWorld, snapshot: ProgressSnapshot, profile: { createdAt: string }): DerivedAward[];  // derived minus owned
export function applyAwards(snapshot: ProgressSnapshot, awards: readonly DerivedAward[], now: string): ProgressSnapshot;       // adds entries, newSinceLastView true, never removes
export function obtainableCards(world: AwardWorld, ownedIds: ReadonlySet<string>): HeritageCard[];
export function earnHint(card: HeritageCard, world: AwardWorld): EarnHint;       // §3.7
```

Details: grid **and** shelf episodes count for `completedEpisodes` (F-STORY-004 shelf episodes have one quest); a `preview`/`draft` episode (`questIds` empty or not shipped) never completes (`journey.ts:33` returns false for no quests). Stage completion generalises F-QUEST-002's `isStageComplete`: for stage 1 it is exactly "all five grid episodes complete". Sets are resolved after the other rules (a set's members may themselves be derived), in one pass: members owned = existing ∪ derived non-set cards.

`parseUnlockedBy` and `derivedAwards` are the only places that know the grammar. `decideCardAward` (`logic/reward.ts:26-35`) stays the quest-card decision; it gains one optional input so the welcome card does not break the funnel (§3.4).

**Sets** — `apps/mobile/src/content/story-sets.ts` (hand-written, four entries, one per research cluster): `{ id: 'set:records-joseon', cardId: 'card:set-records-joseon', memberStoryIds: [6 story ids] }`; `CardSet.memberCardIds` is resolved from the members' story cards. A set is registered only when all its member stories are in the bundle with a `card` block; until then it does not exist (so its card is neither listed nor awardable).

### 3.3 Where awards happen (store and Results)

1. **Live path — `applyQuestResult`** (`logic/results-award.ts:37-82`) keeps its guards and order, and gains the completion awards:
   1. read `before = deps.snapshot(profileId)`;
   2. `recordQuestComplete` (unchanged), then the quest card through `decideCardAward` (unchanged);
   3. `after = deps.snapshot(profileId)`; `missing = missingAwards(world, after, profile)`;
   4. `deps.unlockCards(profileId, missing.map(cardId))` — **one** storage write (new store action `unlockCards`, `progress-store.ts`, next to `unlockCard` `:206-217`);
   5. telemetry: `card.unlocked` per new card `{ cardId, questId, episodeId?, source }` (the existing payload gains `source`), `episode.complete` `{ episodeId, cardsAwarded }` for each episode in `completedEpisodes(after) \ completedEpisodes(before)`, `stage.complete` `{ stageKey, cardsAwarded }` for a stage that just completed (name added by F-QUEST-002 Q-1), `card_set.complete` `{ setId, cardsAwarded: 1 }`.
   Return type changes from `CardAward | null` to
   ```ts
   export interface QuestResultOutcome {
     award: CardAward | null;                 // the quest card, as today
     extras: ExtraAward[];                    // { cardId, source: 'episode'|'stage'|'set'|'welcome' }  never contains `award.cardId`
     episodeCompleted: string | null;         // episode id, for the Results line
     stageCompleted: StageKey | null;         // F-QUEST-002 ceremony trigger
   }
   ```
   `ResultsScreen.tsx:66-86` stores the outcome; its `recordedRef` single-write guard (`:57-64`) is untouched, so the awards are as once-per-visit as the score.
2. **Reconcile path — `progress-store.reconcileAwards(profileId)`** (new action): `missing = missingAwards(...)`; `applyAwards`; save through the existing `persist` (`:127-135`, which already defers writes until the saved snapshot is read); returns the added cards. Called, silently (no banner, no per-card telemetry), from:
   - the end of `hydrate` (`:151-174`), after the merge with the saved copy;
   - `replaceSnapshot` (`:275-278`) — every sync (`store/sync-store.ts:176, 179, 251`), restore (`screens/sync/RestoreScreen.tsx:77`) and plan derivation (`store/plan-store.ts:71`) goes through it;
   - `ensure(profileId)` when it creates a **new** blank snapshot (`:176-182`) — this is where the welcome card arrives for a new profile (`CreateProfileScreen` creates the profile at `:73`, Home calls `ensure` at `HomeScreen.tsx:97-99`), with `unlockedAt = profile.createdAt`.
   It is **not** called inside `recordQuestComplete` (the live path owns announcement).
3. **`newSinceLastView`** — new action `markCardsSeen(profileId, cardIds)`: sets the flag to `false`; called when `CardDetail` opens for an owned card and by "See my cards" on the catch-up card. (The flag finally has a writer; today it is write-once `true`.)

### 3.4 Stage completion, F-QUEST-002 and the first-card rule

- F-QUEST-002 §3.8 asks for "given episodes just completed and stage just completed, return cards to award". That interface is `missingAwards` + `completedEpisodes` here; its `logic/stage1/completion.ts` becomes a thin re-export of `isStageComplete`/`completionTransition(before, after)` (whichever PR lands first creates `logic/awards/transitions.ts`; the other imports it). The ceremony route and Results primary button are F-QUEST-002's; this spec supplies `stageCompleted` and the three legendary cards.
- **Welcome card and funnel.** `decideCardAward` gains `welcomeCardIds?: readonly string[]` (the ids of owned cards whose `unlockedBy === 'first-launch'`): `isFirstCard = isNew && ownedCardIds.filter(not welcome).length === 0`. `card.first_earned` therefore still fires for the first card a learner **earns**.
- **Replays** announce nothing: `missingAwards` is empty after the first time, and `decideCardAward` already returns `isNew: false` (`reward.ts:33`).
- **A completion by sync** (the last quest finished on another device) is not announced as a Results moment; it arrives through reconcile and the catch-up card (§3.5) and the `StageComplete` ceremony stays reachable from the Journey header (F-QUEST-002 §3.8).

### 3.5 Catch-up for existing learners (retroactive unlock without double awards)

- **Who is affected.** Every profile whose saved progress already satisfies a rule: e.g. a learner who finished all eight shipped Stage 1 quests today satisfies all five Stage 1 episodes (letters 3 of 3, life 2 of 2, rites 1 of 1, nature 1 of 1, crafts 1 of 1) and the stage — **22 cards at once** (18 episode cards beyond the eight quest cards they hold, the three legendary stage cards, the tiger), assuming each quest earned 2+ stars so the quest cards are already owned. Everyone gets the tiger.
- **How.** The first launch of the app version that contains PR 6.4a: `hydrateLearnerData()` (`store/bootstrap.ts:10-15`) hydrates each profile, and `hydrate` ends with `reconcileAwards`. No marker, version or migration is stored — the rules are a pure function of the snapshot, so running them every launch is cheap and self-healing (a card missing for any reason is repaired).
- **No double award, by construction.** (a) entries are keyed by `cardId` (`applyAwards` skips owned ids); (b) `unlockedAt` is deterministic (§3.1), so two devices that both reconcile produce the same entry and the merge keeps one; (c) reconcile runs after the merge with the saved copy and after every sync merge, never before; (d) it emits **no** per-card `card.unlocked` event, so analytics cannot count a retro card as a fresh unlock.
- **How it feels.** Retro cards are `newSinceLastView: true`; the Library marks them with a "New" pill. Once per app session, if reconcile added **non-welcome** cards, Home shows one **catch-up card** under the greeting (never between the three mission cards): Hoya `cheering`, "Hoya found N cards you already earned!", primary **See my cards** (→ Library, calls `markCardsSeen` for the added ids). It has no dismiss timer and no counter of what is left. It is session-only state (`progress-store` `catchUp: Record<string, string[]>`, not persisted); if the app is killed first, the "New" pills remain.
- **Telemetry.** One `card.catchup_granted` `{ count, episode, stage, welcome, quest, set }` per reconcile that adds anything other than the welcome card alone.
- **Stage 1 re-plan interplay.** Ship this engine **before** F-QUEST-002 (15 quests): with today's content a learner who finished the old Stage 1 receives the episode and stage cards now; after Q-4..Q-8 add quests, `isEpisodeComplete` flips to false for episodes that gained quests, but cards are never taken back (rule 1), and the learner earns nothing twice when they finish the new quests. The `StageComplete` ceremony may be shown again at that later completion with cards already owned: `extras` is empty and no "new card" banner appears.
- **Caregiver summary.** `cardsUnlocked` (`summarize.ts:78`) jumps once for caught-up learners; nothing else changes. No `ProgressSummary` or snapshot field is added.

### 3.6 Merge and sync rules ("cards must be monotonic")

Contract of `mergeSnapshots` (`logic/sync/merge.ts:80-98`) for the card collection, each with a property test:

| # | Rule | Change |
|---|---|---|
| M1 | **Superset**: `cards(merge(a,b)) ⊇ cards(a) ∪ cards(b)` by `cardId` | already true (`:89`) |
| M2 | **Earliest time**: `unlockedAt = min` | already true (`:61`) |
| M3 | **Seen anywhere = seen**: `newSinceLastView = l.newSinceLastView && s.newSinceLastView` | change `mergeCard` (`:60-62`) — replaces "local wins" |
| M4 | **Commutative, associative, idempotent**: `merge(a,b)=merge(b,a)`, `merge(a,merge(b,c))=merge(merge(a,b),c)`, `merge(a,a)=a` for `cards` (output sorted by `cardId`, `:37`) | property test over random snapshots |
| M5 | **Reconcile after merge, never before; reconcile is a monotone function** of the snapshot (more completed quests ⇒ superset of cards); therefore `reconcile(merge(a,b)) ⊇ merge(reconcile(a), reconcile(b))` | tested |
| M6 | **Restore and backup** (`logic/sync/restore.ts:29` merges the file into the existing snapshot): an older backup can never reduce `cards`; `replaceSnapshot` receives the merged result | existing, add a test |

No server change: cards already ride in `snapshot.cards`; the Worker validates the unchanged schema. Because zod strips unknown keys, **this spec adds nothing to the snapshot**; any later "awarded sources" or "seen" metadata would need a Worker-first schema deploy. Observed, out of scope: `mergeQuest` sums `attempts` (`merge.ts:44`), so `merge(x, x)` doubles it; nothing in the award model reads `attempts`.

### 3.7 Library, Episode page, Home: copy and surfaces

**Visible cards.** `obtainableCards(world, owned)` filters `heritageCardsAll`: owned cards, plus unowned cards whose rule can still fire (its episode is `shipped`/`ready`; its stage is fully shipped; a set whose members are all visible). The Library header counts these — a held or unreviewed story never inflates a total.

**Earn hints.** `earnHint(card, world)` returns `{ kind, text }` used by Library tiles, `CardDetail` (locked) and the episode page; text is short, never a progress judgement:

| Rule | Text |
|---|---|
| episode (lesson) | "Finish the episode: `<episode title>`" |
| episode (story shelf) | "Finish the story: `<story title>`" |
| stage | "Finish every quest in Stage 1" |
| welcome | "A welcome gift from Hoya" |
| set | "Collect every card from the `<collection title>` stories" |

**Copy corrections** (final strings live in `LIBRARY_COPY`, moved to `messages/en/learner.ts` with F-I18N-001; each is a whole sentence, no suffix concatenation):

| Where | Today | New |
|---|---|---|
| `LibraryScreen.tsx:45` caption | "`{n} of {M} collected`" | "`{n}` cards collected" (singular for 1) |
| `LibraryScreen.tsx:47` pill | `{n}/{M}` | removed (a fraction whose denominator grows with every release; D3 spirit). Revert option recorded in §8 |
| `LibraryScreen.tsx:79-80` explainer | "Finish quests to unlock cards. Legendary cards appear when you complete a whole stage." | three short lines: "Finish a quest to earn its card." / "Finish every quest in an episode to earn more cards." / "Finish all of Stage 1 for the legendary cards." (+ "Finish a story to earn its card." once a story is playable) |
| `LibraryScreen.tsx:120` tile label | "Locked card" | "Locked card. `<earn hint>`" |
| `LibraryScreen.tsx:131-135` tile body | lock + "Locked" | lock + the earn hint (≤ 2 lines, `Caption`) |
| `CardDetailScreen.tsx:150` flip label | "Locked card" | "Locked card. `<earn hint>`" |
| `CardDetailScreen.tsx:205, 351, 365` | emoji + fact | `Icon name="sparkle"` (size 16, `colors.text.muted`) + the fact |
| `EpisodeDetailScreen.tsx:165` | "A card still waiting to be earned" | "A card you can earn by finishing this episode" |
| `EpisodeDetailScreen.tsx:185` | "Waiting for you" | the earn hint ("Finish every quest to earn it") |
| tiger | `legendary`, `first-launch` | unchanged rarity (§8 decision 5); the Library explainer line for it: "Hoya's tiger card is a welcome gift." |

The Library also marks cards with `newSinceLastView` using a "New" `Pill` (tone `info`). Locked tiles keep the existing look (`colors.surface.sunken`, lock) — only the words change.

**Results.** After the existing card banner (`ResultsScreen.tsx:117-129`), `extras` render as `ExtraCardsBanner` (`screens/results/ExtraCardsBanner.tsx`, new): a `Card tone="brand"`, headline "N more cards joined your Library!" (1: "1 more card joined your Library!"), a row of up to six `CardArtThumb`s (96 dp tiles of `HeritageCardArt`, wrapping), each tappable to `CardDetail`, and, when an episode just completed, the line "You finished `<episode title>`!". It uses the same entrance as `CardUnlockBanner` (translateY spring, 400 ms delay) and is static with reduced motion; it sits inside the existing live region so assistive tech announces "N more cards joined your Library: Rice, Chopsticks". A stage completion hands over to F-QUEST-002's "See your Stage 1 prize" button. iOS gets `announceForAccessibility` like `ResultsScreen.tsx:91-96`.

### 3.8 The heritage story cards

**What is created.** One card per shelf story: **24 cards** (F-STORY-005 §3.3), plus **4 legendary set cards** — total 70 cards (25 common, 21 uncommon, 16 rare, 8 legendary). Counts are fixed by the 24-row table; adding a story adds one card.

**Identity and data.**

| Item | Rule |
|---|---|
| id | `card:story-<slug>` (`slug` = story id without the `story-` prefix; matches `^card:[a-z0-9-]+$`) |
| unlocked by | `episode:shelf-<slug>` (the story's shelf episode). F-STORY-001's generator already sets the episode's `rewardCardIds` and the quest's `rewardCardId` from `story.rewardCardIds.listen` (`F-STORY-001 §3.9`), so a 2+ star finish shows the normal banner and a 1-star finish gets the card at episode completion |
| `theme` / `stage` | the story's `theme` / `stage<recommendedStage>` |
| rarity | **derived**: recommended stage 1 → common, 2 → uncommon, 3-6 → rare (10 / 8 / 6); set cards legendary; not a field of the `card` block (lint `card-rarity-mismatch` is unnecessary by construction) |
| `subtitleKo` + `romanization` | **one `keywords[]` entry of the story** (its `ko` and `romanization`; F-STORY-001 builds them from the research `vocab[]` and the scenes' Korean (§3.10 there), already romanization-checked) chosen by `card.keywordId`; no new Korean is typed |
| `titleEn` | a short name (≤ 28 characters), `card.titleEn` |
| `blurbEn` | the story's `summaryEn` (verified wording) |
| `factId` → `factEn` | a fact id of the story whose `claimEn` is ≤ 180 characters and has >= 2 sources; `factEn` is the **verbatim** `claimEn` |
| `citation` | `{ title, publisher, more }` of the fact's first source; `more` = number of its other sources |
| `storyId` | the story's id (`StoryIdSchema`, `story:<slug>`) |

The per-card choices live **on the story**, in one optional block that **F-STORY-001 §3.2.1 already carries in its strict `StoryObjectSchema`** (`card: StoryCardSchema.optional()`, PR 1.1b; the research set has no such field and a separate registry file under `content/stories/` is impossible because every `*.json` there is parsed as a story, F-STORY-001 §3.1). This spec defines its meaning and rules; it does not amend the schema:

```ts
card: z.object({
  titleEn: z.string().trim().min(1).max(28),
  keywordId: z.string(),                       // resolves into story.keywords[]
  factId: FactIdSchema,                        // resolves into story.facts[]
}).strict().optional()
// rarity is NOT stored: it is derived from story.recommendedStage (1 -> common, 2 -> uncommon, 3-6 -> rare), so a card and its story cannot disagree
```

`content/story-cards.ts` (new, pure) builds the `HeritageCard[]` from `storiesAll`, and `heritageCardsAll` appends the result (`heritage-cards.ts:92`). Lint rules in `story-lint.ts` (error): `card-keyword-unknown`, `card-fact-unknown`, `card-fact-too-long` (> 180), `card-fact-single-source`, `card-reward-mismatch` (`rewardCardIds.listen` must be `card:story-<slug>` when `card` exists), and across the bundle `card-korean-duplicate` (two cards sharing a `subtitleKo`, including the 42 existing ones).

Proposal for the 24 `card` blocks (headword = `keywords[]` entry whose id is the lower-case romanization with spaces as hyphens, F-STORY-001 §3.10; names are labels, finalised in the content PR; `factId` = the first fact in file order that satisfies the rule, computed on 2026-10-10 from the research files and re-checked at review 2 by script: every headword is a `vocab` or scene Korean entry of its story with exactly this romanization, every `factId` is the first fact with `claimEn` <= 180 characters and >= 2 sources, the derived rarity equals the column, and no headword duplicates one of the 42 existing cards; the same script re-runs at import):

| story | card id | `card.titleEn` | headword `ko` · romanization | `card.factId` | rarity (derived) |
|---|---|---|---|---|---|
| sillok-royal-historians | card:story-sillok-royal-historians | Royal Historian | 사관 · sagwan | f1 | common |
| sillok-mountain-archives | card:story-sillok-mountain-archives | History Archive | 사고 · sago | f1 | uncommon |
| seungjeongwon-ilgi-every-day | card:story-seungjeongwon-ilgi-every-day | Royal Secretariat | 승정원 · Seungjeongwon | f1 | rare |
| ilseongnok-daily-reflection | card:story-ilseongnok-daily-reflection | Daily Reflections | 일성록 · Ilseongnok | f1 | rare |
| uigwe-royal-birthday | card:story-uigwe-royal-birthday | Royal Picture Record | 의궤 · uigwe | f1 | rare |
| joseon-records-today | card:story-joseon-records-today | Hwaseong Fortress | 화성 · Hwaseong | f2 | rare |
| sejong-new-letters | card:story-sejong-new-letters | King Sejong | 세종대왕 · Sejong Daewang | f1 | common |
| shapes-of-hangeul | card:story-shapes-of-hangeul | Consonants | 자음 · jaeum | f1 | common |
| hangeul-day | card:story-hangeul-day | National Treasure | 국보 · gukbo | f1 | common |
| jikji-metal-type | card:story-jikji-metal-type | Metal Type | 금속활자 · geumsokhwalja | f1 | uncommon |
| tripitaka-koreana | card:story-tripitaka-koreana | Tripitaka Koreana | 대장경 · Daejanggyeong | f1 | common |
| janggyeong-panjeon | card:story-janggyeong-panjeon | Wind | 바람 · baram | f2 | uncommon |
| cheugugi-rain-gauge | card:story-cheugugi-rain-gauge | Rain Gauge | 측우기 · cheugugi | f2 | common |
| angbuilgu-sundial | card:story-angbuilgu-sundial | Sundial | 앙부일구 · angbuilgu | f1 | uncommon |
| jagyeongnu-water-clock | card:story-jagyeongnu-water-clock | Water Clock | 자격루 · Jagyeongnu | f1 | uncommon |
| donguibogam | card:story-donguibogam | Medicine Book | 동의보감 · Donguibogam | f3 | rare |
| nanjung-ilgi | card:story-nanjung-ilgi | War Diary | 난중일기 · Nanjung ilgi | f2 | rare |
| kim-hongdo-genre-paintings | card:story-kim-hongdo-genre-paintings | Genre Painting | 풍속화 · pungsokhwa | f1 | common |
| seollal-new-year | card:story-seollal-new-year | Words of Blessing | 덕담 · deokdam | f2 | common |
| dano-ssireum | card:story-dano-ssireum | Dano | 단오 · dano | f2 | uncommon |
| chuseok-ganggangsullae | card:story-chuseok-ganggangsullae | Circle Dance | 강강술래 · ganggangsullae | f1 | common |
| gimjang-arirang | card:story-gimjang-arirang | Making Winter Kimchi | 김장 · gimjang | f8 | uncommon |
| sun-and-moon | card:story-sun-and-moon | Strong Rope | 동아줄 · dongajul | f5 | common |
| pansori-tales | card:story-pansori-tales | Pansori | 판소리 · pansori | f1 | uncommon |

(`factId` values are the first fact with `claimEn` <= 180 characters and >= 2 sources in `records-joseon.final.json`, `hangul-printing.final.json`, `science-art-life.final.json` and `seasons-tales.final.json` as of 2026-10-10 (re-run by the import step). Three stories — cheugugi, kim-hongdo, sun-and-moon — have no fact under 141 characters, so their cards use a 141-162 character claim; the 180-character cap keeps all 24 valid.) The headwords avoid every existing card's Korean (책, 설날, 추석, 한글날 …), so the Library never shows two cards with the same word.

**Set cards (legendary).** Four, one per research cluster (the set definitions are a small hand-written TS table, `content/story-sets.ts`: `{ id, cardId, memberStoryIds, headword: KoText, titleEn, rarity: 'legendary' }`, covered by T-AWARD-5 and an integrity test, because no JSON story file can hold a cross-story object), awarded when all six member story cards are owned: `card:set-records-joseon` (headword 기록 · girok, "Record"), `card:set-hangul-printing` (활자 · hwalja, "Printing Type"), `card:set-science-art-life` (보물 · bomul, "Treasure"), `card:set-seasons-tales` (아리랑 · arirang, "Arirang"); `unlockedBy: 'set:<cluster>'`. Their blurb is "Six stories, one collection." and they make **no factual claim** (no `factEn`, no `citation`), so D14 is satisfied by construction. Names are proposals for the content PR. Art is the **collection plate**: the six member cards' art as a 3 x 2 grid on a framed plate — no new drawing.

**Art (D7).** Story-card art reuses the story's cover scene: `CardArt` (new, `apps/mobile/src/components/CardArt.tsx`) renders `HeritageCardArt` when `supportedCardIds` contains the id (`HeritageCardArt.tsx:23-58`) and otherwise F-STORY-002's `StoryScene` (props `art`, `theme`, `variant`, `width`, `fallback`, `decorative`, `accessibilityLabel`; 4:3, `F-STORY-002 §3.9.9`) drawn for the card's story `coverSceneId` at a width of `size * 4/3` inside a square `overflow: 'hidden'` view, so the centre is cropped to a square on the card's theme tint; its `fallback` is the Korean word, so a scene whose art is pending still shows a card face. A set card renders the collection plate (six member arts, a 3 x 2 grid on a framed plate). The three existing call sites that test `supportedCardIds` — `ResultsScreen.tsx:283`, `LibraryScreen.tsx:142`, `CardDetailScreen.tsx:279-291` — switch to `CardArt`, so adding a card never needs another 40-line drawing. Heritage artefacts in a cover scene carry the `sourceRef` and `accuracyNote` that F-STORY-002 §3.9.10 requires, so a card never shows a shape nobody checked. No raster, no emoji, tokens only. **Fallback** when no art resolves: the Korean word on the theme tint, which these three screens already do (`ResultsScreen.tsx:302-306`, `CardDetailScreen.tsx:290-295`), so the cards can ship before their covers. (`WordArt` of F-VOC-002 is a different glyph set for vocabulary and is not used here.)

**Back face (the sourced fact with its citation).** `BackFaceBody` (`CardDetailScreen.tsx:~326-370`) keeps its three bands. For a card with `citation`: the Korean word and romanization on top; the English title and `blurbEn` in the middle; at the bottom the sparkle icon and `factEn`, then one `Caption` line "Source: `<publisher>`, `<title>`" (max two lines, `text.muted`) and, when `more > 0`, "and N more sources". It never prints a URL and never links out (learner surface; the grown-up Sources row of the story page, F-STORY-004 §3.5, lists all sources). A card without `citation` (the 42 existing ones, set cards) is unchanged. The citation is generated from the same `facts[].sources[]` that CI validates, so a corrected source (F-STORY-005 §3.9 errata) corrects the card in the same PR. Share image (F-CARD-003) captures the front only (unchanged).

**Reviewed only.** A story card is built only from stories in the bundle (`state: 'ready'`) that hold a `shelf` block, i.e. that pass F-STORY-001's verification gate and F-STORY-005 §3.4 rule 4; an unreviewed or held story's card is neither listed nor awardable (a hold sets `state: 'draft'`, F-STORY-001 §3.7); if it is already owned it stays owned and visible (rule 1).

### 3.9 Telemetry

Added to `TELEMETRY_EVENT_NAMES` (the array in `packages/content-schema/src/schemas/telemetry.ts`) and the exact-list test (Worker first; both names are in `TELEMETRY-NAMES-2.md`): `card.catchup_granted` `{ count, episode, stage, welcome, quest, set }` (a discrete action, past tense), `card_set.complete` `{ setId, cardsAwarded }` (the lifecycle form `<unit>.complete` of the shared convention, `card_set` being its own unit). Existing names, extended payloads (the Worker accepts any payload shape): `card.unlocked` `{ cardId, questId?, episodeId?, source }`; `episode.complete` (already whitelisted, `packages/content-schema/src/schemas/telemetry.ts:13`, finally emitted) `{ episodeId, cardsAwarded }`; `stage.complete` is F-QUEST-002's. Retro awards emit none of the per-card events.

### 3.10 Accessibility, locale, offline, privacy

- All new strings are whole-sentence functions in `LIBRARY_COPY` / `results-copy.ts`, scanned with `scanLearnerCopy` (`logic/homework/banned-text.ts:30-37`); no "missed", "incomplete", "failed", no fractions or percentages (D3), no "behind".
- The extras banner and catch-up card: touch targets >= 64 dp (`touchTarget.min`), roles and labels, live-region announcement, reduced motion static, 200 % text, 320 dp width.
- Card Korean through `KoreanText` (F-I18N-001 §3.5) with romanization visible by default (D2); the citation is English metadata (publisher and title as printed; they may contain Korean names, rendered as given in a `lang="ko"` span).
- Everything is derived from the local snapshot and the bundle: offline works. No new personal data; `profile.createdAt` already exists.

### 3.11 Behaviours (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| 1 | a profile whose snapshot has all 8 shipped Stage 1 quests complete at 2+ stars and its 8 quest cards | the new app version starts (`hydrate` -> `reconcileAwards`) | 22 cards are added (18 episode cards, 3 legendary stage cards, the tiger) with deterministic `unlockedAt`, `newSinceLastView: true`; Home shows one catch-up card for the session; `card.catchup_granted` fires once with `count: 22`; no `card.unlocked` fires |
| 2 | the same profile | the app starts again | nothing is added, no catch-up card, no event |
| 3 | a learner finishing the last quest of "Meet the Letters" with 1 star | Results mounts | the episode cards arrive as `extras` ("N more cards joined your Library!"), the quest card is not among them (1 star), `episode.complete` fires `{ episodeId, cardsAwarded }` |
| 4 | two devices that both reconcile the same progress | they sync | the merged snapshot has one entry per card with the same `unlockedAt`; `merge(a,b)` equals `merge(b,a)` |
| 5 | a replay with fewer stars | it finishes | no card, star or note is removed, and no new card is announced |
| 6 | a new profile is created | `ensure` creates its blank snapshot | the tiger is owned with `unlockedAt = profile.createdAt`, and the first card the learner earns still fires `card.first_earned` |
| 7 | a card whose rule can never fire (its episode is a preview) | `card-award-integrity.test.ts` runs | T-AWARD-1 fails; the Library never lists it |
| 8 | a locked card | its Library tile or `CardDetail` renders | the earn hint reads "Finish the episode: <title>" (or the rule's text) and nothing counts what is missing |
| 9 | an owned story card | its back face opens | it shows the verbatim fact, "Source: <publisher>, <title>" and, when `more > 0`, "and N more sources", with no URL and no link |
| 10 | an owned story card whose story is later held (`state: 'draft'`) | the app starts | the card stays owned and visible; the story's unowned sibling cards are not listed |

## 4. Out of scope

- Stage 5 scene cards (F-CARD-S5-001) and any card for a book quest; Stage 3 / 6 / 7 cards.
- Selling or gating cards; trading, sharing a collection, a "collection complete" certificate; showing a card count to caregivers beyond the existing summary.
- The stage ceremony screen and Hangul Check (F-QUEST-002); the reader and checks (F-STORY-002/003); changing star thresholds or the 2-star quest-card rule.
- Server-side award authority (the device derives; there is no server record of why a card exists); any new snapshot field; making `mergeQuest.attempts` idempotent.
- Re-romanizing the existing 42 cards (e.g. `hangeul-nal`, `jong-i-jeop-gi` break D13); F-CNT-002 owns it. This spec's CI rule only forbids duplicate Korean words.

## 5. Tests

TDD (CLAUDE.md §5). Mobile vitest runs `src/{logic,store,content,config,platform}/**/*.test.ts`; screens by Playwright.

| File | Level | Coverage focus | Target |
|---|---|---|---|
| `content-schema/src/__tests__/heritage-card.test.ts` | unit | `unlockedBy` grammar accepts all four forms and rejects typos (`episod:`, `stage8-complete`); the 42 shipped cards parse; `citation`/`factId` only with `storyId` | 100 % |
| `content-schema/src/__tests__/telemetry.test.ts` | unit | new names present, no duplicates | 100 % |
| `mobile/logic/awards/__tests__/award-rules.test.ts` | unit | `parseUnlockedBy` all kinds + unknown | 100 % |
| `mobile/logic/awards/__tests__/derived-awards.test.ts` | unit | quest card at 2 stars not 1; episode card at completion with 1-star runs; partial episode gives nothing; stage 1 needs all five episodes and fully shipped; stage 2 never completes while it has placeholders; welcome uses `createdAt`; set needs every member (also derived ones) and is hidden when a member is not visible; deterministic `unlockedAt`; shelf one-quest episode; `preview` episode never completes; replay/idempotent; owned cards untouched | 100 % |
| `…/apply-awards.test.ts`, `obtainable.test.ts`, `earn-hint.test.ts` | unit | adds only, sets `newSinceLastView`, never removes; obtainable filter (held story still shown when owned); every rule's hint text; no banned word | 100 % |
| `mobile/logic/__tests__/results-award.test.ts` (extend) | unit | the existing guards (total 0, replay) unchanged; extras after the last quest of an episode; stage cards on the last quest; extras never repeat the quest card; 1-star finish gets the card as an extra; telemetry names/payloads; `episodeCompleted`/`stageCompleted`; welcome card does not break `isFirstCard` | 100 % of the file |
| `mobile/logic/__tests__/reward.test.ts` (extend) | unit | `welcomeCardIds` handling | 100 % |
| `mobile/logic/sync/__tests__/merge.test.ts` (extend) | unit/property | M1-M4 (commutative, associative, idempotent, superset, min time, seen-anywhere) over random card sets; M5; M6 with `restore.ts` | 100 % of the changed lines |
| `mobile/store/__tests__/progress-store.test.ts` (extend) | unit | `unlockCards` one write; `reconcileAwards` after `hydrate` merge, after `replaceSnapshot`, on new `ensure`; write-before-hydrate path keeps awards; `markCardsSeen`; catch-up list session-only and excludes welcome-only | lane >= 90 % |
| `mobile/store/__tests__/bootstrap.test.ts` (extend) | unit | profiles hydrated then reconciled; welcome card present for a profile with no progress | — |
| `mobile/content/__tests__/card-award-integrity.test.ts` | integration | **T-AWARD-1** every card in `heritageCardsAll` has an obtainable rule (the regression for "31 of 42 can never be earned") · **T-AWARD-2** every `episode.rewardCardIds` entry exists, has `unlockedBy === episode.id`, and every card with `unlockedBy: 'episode:<id>'` is in that episode's list; every `quest.rewardCardId` is in its episode's list · **T-AWARD-3** no card is unlocked by an episode that cannot complete (no quests / preview) · **T-AWARD-4** stage1-complete cards exist only while stage 1 can complete · **T-AWARD-5** no two cards share `subtitleKo` · **T-AWARD-6** every story card's `factEn` equals its fact's `claimEn`, `citation` equals the first source, `factEn` <= 180 characters, >= 2 sources, `titleEn` <= 28 characters, headword is a `keywords[]` entry of the story · **T-AWARD-7** counts: 70 cards when all 24 stories are bundled (25/21/16/8), 4 sets | n/a |
| `content-schema/src/__tests__/story-lint.test.ts` (extend F-STORY-001's) + `story.test.ts` (the `card` slot already parses there) | unit | the lint rules of §3.8 with failing fixtures (unknown keyword/fact, > 180 characters, single source, reward mismatch, duplicate Korean word) | 100 % |
| `mobile/screens` via Playwright `e2e/web/card-awards.spec.ts` | e2e (nightly + on demand) | seeded profile with 8 completed quests: first launch shows the catch-up card, Library lists the caught-up cards with "New", a second launch shows no catch-up and no duplicates; last quest of Meet the Letters → Results shows the extras banner (2 cards); replay shows none; Library locked tile shows its earn hint; no emoji text node on CardDetail; story card back face shows the fact, source and "and N more"; copy has no fractions | — |

Coverage lanes: `apps/mobile/src/logic` >= 90 % (this feature at 100 %), `packages/content-schema` 100 %, `packages/design-system` >= 85 %. Manual QA: VoiceOver/TalkBack on the extras banner and a locked tile; 200 % text; airplane mode; an old profile restored from a backup file.

## 6. Rollout

The engine can ship before any story exists: it already repairs the 31 unearnable cards. Order matters for existing learners: **6.1-6.5c first, F-QUEST-002's Stage 1 re-plan after** (§3.5). Story cards ship dark with their stories (the bundle gate). PRs (branches `feat/card-awards-*`; the Worker name list PR first):

| # | PR | Depends on |
|---|---|---|
| 6.0 | `design(wireframe)`: promote `wireframes/story-catalogue.md` to `results/extra-cards`, `library/earn-hints`, `home/cards-catch-up`, `library/card-back-citation`; update `design/wireframes/README.md`, `docs/blueprints/10-app-map.md` | — |
| 6.1 | `fix(mobile)`: remove the emoji in `CardDetailScreen` (`Icon sparkle`); correct the explainer sentence to what is true today ("Finish quests to unlock cards.") — a safe interim, no engine needed | — |
| 6.2 | `feat(content-schema)`: `unlockedBy` grammar, optional card fields, telemetry names (`card.catchup_granted`, `card_set.complete`) — **Worker first** · `feat(mobile)`: `logic/awards/*` pure engine + `card-award-integrity.test.ts` (T-AWARD-1..5) | — |
| 6.3 | `fix(mobile)`: `mergeCard` seen-anywhere + property tests M1-M6 | — |
| 6.4a | `feat(mobile)`: store wiring — `unlockCards`, `reconcileAwards`, `markCardsSeen`, `catchUp` state, hooks in `hydrate` / `replaceSnapshot` / `ensure`, `bootstrap` order; tests | 6.2, 6.3 |
| 6.4b | `feat(mobile)`: live path — `applyQuestResult` returns `QuestResultOutcome`, `decideCardAward(welcomeCardIds)`, telemetry (`card.unlocked` source, `episode.complete`, `stage.complete`, `card_set.complete`, `card.catchup_granted`), `ResultsScreen` adapts to the new outcome (no new UI yet) | 6.4a |
| 6.5a | `feat(mobile)`: Results — `ExtraCardsBanner`, `LIBRARY_COPY` strings for it, Episode page copy | 6.4b, design 6.0 |
| 6.5b | `feat(mobile)`: Library — header count, explainer, earn hints on locked tiles, "New" pill, obtainable filter; `CardDetail` hint and emoji already gone (6.1) | 6.4b, design 6.0 |
| 6.5c | `feat(mobile)`: Home catch-up card (session-only) | 6.4a, design 6.0 |
| 6.6 | `feat(mobile)`: `CardArt` wrapper replacing the three `supportedCardIds` checks | 6.5a, 6.5b |
| 6.7 | `feat(content-schema)` + `feat(mobile)`: the `card` lint rules (the block itself is in F-STORY-001 PR 1.1b), `content/story-cards.ts`, `story-sets.ts`, back-face citation, T-AWARD-6/7 | F-STORY-001 PR 1.1b and 1.4 (bundle), F-STORY-005 5.3, 6.6 |
| 6.8 | `content(cards)`: `card` blocks and `rewardCardIds.listen` on the first reviewed stories (one PR per cluster); cover crops via `StoryScene` | 6.7, F-STORY-002 PR 2.3a (`StoryScene`), reviewed stories |
| 6.9 | `test(e2e)`: `card-awards.spec.ts` | 6.5a-6.8 |

Rollback: the engine is additive and idempotent; reverting the app version leaves the extra cards in snapshots (harmless: old builds show them, the merge keeps them).

## 7. Dependencies

Upstream:

- **PR #94** (merged): `applyQuestResult`, `decideCardAward`, `recordedRef`, first-try scoring — this spec extends them. **PR #95** (merged): scrollable `Screen`, `TAB_SCREEN_EDGES` for the new Home/Library content.
- **F-STORY-001/002**: `Story` (`keywords[]`, `facts[]`, `sources[]`, `summaryEn`, `rewardCardIds`, and the `card` block already in its strict schema), the generator that turns `rewardCardIds.listen` into the shelf episode/quest rewards, the bundle, `StoryScene`. **F-STORY-004**: shelf episodes (one quest, `rewardCardIds`), Library sections (the Cards section is where §3.7 lands), `isFreeContent`. **F-STORY-005**: placement, `recommendedStage`, the review gate, the 24-row table.
- **F-QUEST-002**: `isStageComplete` (shared, §3.4), the `StageComplete` ceremony and its `stage.complete` name; Q-9 consumes this engine.
- Existing: `logic/journey.ts`, `store/progress-store.ts`, `logic/sync/merge.ts`, `store/bootstrap.ts`, `logic/homework/banned-text.ts`, design-system `Card`, `Pill`, `Icon`, `HeritageCardArt`, `KoreanText`.

Downstream: F-CARD-S5-001 (book quest cards use this model with `episode:stage5-*`), F-VOC (word-pack cards can use the same grammar), F-PAR-001 (caregiver summary), F-MOTION-003.

Assumptions I could not verify (each with a fallback): the F-STORY-002 `StoryScene` props (read in F-STORY-002 §3.9.9) rendering a cropped cover at card size on a device; that an old Worker keeps accepting the unchanged snapshot (it does: no schema change) and that analytics tolerates the new `source` payload key; that the owner accepts removing the `N/M` pill (§8 decision 3, reversible); the 24 card titles, 4 set names and rarity mapping are editorial proposals; whether the native-review budget covers short English card titles; that `ensure()` is the right place to grant the welcome card (alternative: an explicit call after `createProfile` in `CreateProfileScreen.tsx:73` — same behaviour).

## 8. Decisions

Binding owner decisions and how this spec applies them:

| Id | Applied here |
|---|---|
| D1 | No age framing in any card or hint |
| D2 | Card Korean shows romanization (default visible); glosses in the UI language; copy via message functions |
| D3 | Cards, stars and found notes are never removed; no fractions on Results; hints are neutral; no red; the catch-up card has no counter of what is missing |
| D4 | Story cards are generated from the JSON stories (their `card` block); facts and citations come from `facts[]`; lint covers shipped content |
| D5 | Cards are not sold or gated; nothing here consults `isFreeContent` |
| D7 | Card art is token-only SVG (existing arts, story cover crops, collection plate); no emoji, no raster, no external asset |
| D8 | Spec id F-STORY-006 |
| D9 | Finishing an episode awards its cards; `episode:*`, `stage1-complete`, `first-launch` are honoured |
| D13 | Card romanizations are the research files' checked values |
| D14 | A story card's fact is a verbatim sourced `claimEn`; set cards make no factual claim; unreviewed stories' cards are not bundled |

Decisions made in this spec:

1. **Awards are derived, not stored as events.** The same function runs live, at launch, after sync and after restore, so there is no "migration", no marker and no way to double award; cost: the set of award reasons is not recorded on the server.
2. **Completion awards are not star-gated**; only the quest's own card is (the existing 2-star rule, F-MOTION-003).
3. **The `N/M` pill is removed and the caption becomes a plain count** because the denominator grows from 42 to 70 and beyond; reversible by restoring `LibraryScreen.tsx:47` if the owner prefers a fill-only meter.
4. **Welcome card by reconcile in `ensure`**, with `unlockedAt = profile.createdAt`, and excluded from the first-card funnel.
5. **The tiger stays `legendary`** (as authored, `heritage-cards.ts:54`; Hoya is a tiger); the Library says plainly that it is a welcome gift. Owner may demote it to `rare` later; nothing else depends on it.
6. **Catch-up is announced once per session, not per card**, and emits one aggregate event; no per-card telemetry for retro awards.
7. **One card per story, four collection cards for the clusters**; set cards carry no facts, so the claim-checking burden stays on 24 cards.
8. **Card fact = verbatim claim from the verified story file**, capped at 180 characters; shortening a claim is a content change that re-enters the check passes (F-STORY-005 §3.9 hash rule).
9. **Card art is the story cover crop**, so 28 new cards need no new drawings; the existing 30 arts stay as they are.
10. **The Library lists obtainable-or-owned cards only**, and every locked tile says how to earn it.
