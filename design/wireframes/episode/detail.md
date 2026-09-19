# Episode/Detail — quest list + reward preview for one grid cell (wireframe v1)

Spec: `docs/blueprints/05-episode-learning-goals.md` · `docs/specs/F-CARD-002-heritage-card-back-face.md` §3.6 (no spoilers on locked cards) · `docs/blueprints/10-app-map.md` §3.1, §4.1
Audience: **learner (P4/P5 child, 5–11)**
Code (back-filled): `apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx` — route `EpisodeDetail { episodeId }`

## Scenario (Given-When-Then)

Given: a learner tapped an open cell on `journey/grid` (or the Story card on Home, or "Episode page" on Results)
When: the episode page renders
Then: Hoya says one line about the episode, the child sees the quests in order with their stars, and the next unstarted quest is the obvious thing to press

## Screen goal

"Start (or replay) one quest of this episode."

## Box diagram

```
+----------------------------------+
| [<- back]                        |
|  [stage pill] [theme pill] (soon)|  <- 2 pills; 3rd only for preview episodes
|  Episode title (display)         |
|  1-line subtitle                 |
|                                  |
| ( Hoya bubble: hoyaIntroEn )     |  <- 1 line from content
|                                  |
|  Quests                          |
|  +----------------------------+  |
|  | (1) quest title            |  |  <- number badge (success tint when starred)
|  |     1-line blurb           |  |
|  |     * * -                  |  |  <- star row 0-3
|  |     [[ START ]]            |  |  <- primary for unstarted -> quest/player
|  +----------------------------+  |
|  +----------------------------+  |
|  | (2) ...   [ PLAY AGAIN ]   |  |  <- secondary tone once starred
|  +----------------------------+  |
|                                  |
|  Cards in this episode           |
|  [ card ] [ card ]               |  <- 2-col; collected = title + ko + rarity,
|  [ card ] [ ? ]                  |     not yet = silhouette slot (no title)
+----------------------------------+

Preview variant (episode.status == 'preview'):
  header + Hoya line, then one sunken card: [HOYA reading]
  "Coming soon" + 1 muted line. No quest list, no card list.
```

- Only one [[ START ]] renders large: the first quest without stars. Others use the secondary look so the eye lands on one thing.
- Card preview never reveals a not-yet-earned card's name or Korean word (§3.6 spirit): silhouette + rarity only.

## Interaction points

- [[ START ]] / [ PLAY AGAIN ] → `quest/player` (questId, episodeId)
- Collected card tile tap → `library/card-detail` (cardId); not-yet tile: no-op
- [<- back] → previous screen (`journey/grid`, `home/todays-mission` or `results/celebrate` stack)
- Hoya bubble tap: replay the intro line via TTS (nice-to-have; not in code)

## Navigation graph

Enter from: `journey/grid` (cell) · `home/todays-mission` (Story card ③) · `results/celebrate` ("Episode page")
Exit to:    `quest/player` · `library/card-detail` · back

## States

- **success**: as drawn; stars per quest from progress.
- **empty** (no quest started): identical layout, all badges neutral, first quest carries the large CTA. Preview episodes use the preview variant, never an empty list.
- **error** (episodeId not in bundle): one-line "episode not found" + [<- back]; never a blank page. Progress unreadable → render quests with 0 stars and one muted "stars will show up in a moment" line.

## Data needs

- reads: `episodeById(id)` (title, subtitle, `hoyaIntroEn`, `questIds`, `rewardCardIds`, `status`) · `stageByKey` / `themeByKey` for pills · `ProgressSnapshot.quests[]` (stars per quest) · `ProgressSnapshot.cards[]` (collected set for the card grid)
- writes: none
- telemetry: candidate `episode.viewed` (episodeId) — one per open

## Open questions

- **Discrepancy**: shipped "Cards in this episode" lists every reward card by English title + Korean word before it is earned. Keep as motivation ("what's waiting") or hide like the Library's locked slot? Default hide; the Library already shows locked slots, and a child discovering the name on unlock is the reward.
- Every quest card carries its own button; on a 5-quest episode that is 5 CTAs. Alternative: one sticky [[ CONTINUE ]] at the bottom + tappable rows. Test with 5–7 year olds in beta.
- Stage-completion hand-off (`reviews/stage-review`) lives on `journey/grid`, not here — confirm that placement with F-RVW-001 §3.4 ("when the Episode results screen exits").
