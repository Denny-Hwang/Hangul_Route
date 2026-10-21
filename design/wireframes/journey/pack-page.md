# Journey/Pack page — one Topic Pack: Hoya's intro, five levels, the pack ring, the topic album and the badge (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §6.1 (pack details, "Where it opens"), §6.2 (schema), §6.3 (entitlement, OD-3), §6.4 (the pack template), §4.4 (mastery), §4.5 (Pack Check), §7.2 (pack cards and badge), §12.2 (`topicPacks`, `pack.<key>` off), §14 · extends `episode/detail.md` and `episode/detail-access-preview.md` (the preview of a lesson that is not open yet, F-ENT-003 §3.7, §3.11)
Audience: **any learner, any age**. The only grown-up control is the ask button of the preview state, which opens the gate first (F-ENT-003 §3.7).
Code (row CM-50b): a new `screens/journey/PackScreen.tsx` with a pure `logic/packs/pack-view.ts` (levels, ring, album, access); the catalogue's `CatalogPack` (row CM-50a); `useQuestAccess` (F-ENT-003) for each level
Mock: `design/screens/journey-topic-pages/` (`mock/pack-page.html`; 320, 768, and the detail pane of the two-pane 1280 window)
Notation: `[[ X ]]` the one primary action, `[ X ]` a button, `( x )` a text placeholder, `{ x }` content-driven, `~~ x ~~` taught Korean with romanization (`KoreanText`).

## Scenario (Given-When-Then)

Given: a learner taps a pack's column header on a Journey topic page, or the Today mission's Explore slot, or a grown-up's planner opens the pack
When: the pack page renders
Then: they see what the topic is (Hoya's intro), its five levels in order with where they are, what they can earn (two cards and a badge), and one obvious next level to open; a free learner with gating on sees the same page and a preview, never a lock

## Screen goal

"Open the next level of this topic." (secondary: see what the topic holds and what it gives)

## Box diagram — A. open (gating off, which is today until Stripe Live; or a subscriber), 320 x 568

```
+----------------------------------+
| [<- back]                   (Aa) |  <- Back returns to the topic page that holds the pack
|                                  |
| (badge 64)  Numbers & Time       |  <- the pack badge's outline with the homeTheme glyph; title (pack titleEn)
|             [ Topic ]            |  <- one pill: this is a topic, not a stage
| ( Hoya bubble: hoyaIntroEn )     |  <- Hoya idle beside the intro, as the episode page
|                                  |
| (pack ring)  (2 levels done)     |  <- five segments, one per level; fills when a level is Done; never drops
|                                  |
| Levels                           |
| +------------------------------+ |
| | (ring) Level 1 . Stage 2     | |  <- the level's mastery ring (CM-20, §4.4), level number, stage tag
| |        (Count to ten)   Done | |  <- the level's episode title; state word
| +------------------------------+ |
| | (ring) Level 2 . Stage 3     | |
| |        (What time is it?) [Next]| <- Next tag: the first level not Done (the pack's own next, not routeNext)
| +------------------------------+ |
| | (ring) Level 3 . Stage 4     | |
| |        (How much is it?)     | |
| +------------------------------+ |
| | ... Level 4 . Stage 6, Level 5 . Stage 7                       |
| +------------------------------+ |
| | Pack Check                   | |  <- optional, never required (§4.5)
| | (Ready after level 5)        | |  <- before L5 is Done: a caption, no button
| +------------------------------+ |
|                                  |
| Topic album                      |
| [card 1] [card 2] [badge]        |  <- two pack cards and the badge, shown in advance (§7.2)
|  (Finish level 3 to earn it)     |     each waiting tile names what earns it; never greyed out, no lock
|                                  |
| [[ Open level 2 ]]               |  <- the one primary action: the Next level's episode page
+----------------------------------+
```

- **Level rows** are buttons (at least `touchTarget.min` tall): a tap opens that level's episode page (`episode/detail`), whatever its state. Every level is open (§6.3 with the switch off), so the learner may start any level; Next only suggests the first one not Done.
- **State word** per row: `Done` (level 1 or higher, §4.4), `Next` (the first level not Done), nothing otherwise. Mastery words ("Practiced", "Mastered", "Ready to refresh") are the ring's own (rows CM-D1 and CM-20) and its label carries them.
- **The pack ring**: five segments in the pack's `homeTheme` token (`colors.theme[homeTheme]`) on a `border.subtle` track; a segment fills when its level reaches Done. It reads only `cellBest` latches, so it never drops (§4.4). Its label: "Numbers & Time: 2 levels done". No percentage, no "2 of 5".
- **[[ Open level n ]]**: opens the Next level's episode page. When every level is Done and the Pack Check is not taken, it becomes **[[ Start the Pack Check ]]**; when the badge is earned, there is no primary button (the rows stay buttons).
- **Pack Check** (§4.5): 10 items from the pack's items, through the review engine; after level 5 is Done its row shows **[ Start the Pack Check ]** (or, as above, the primary). Stars, then the badge. Retake freely; the best result latches.
- **Topic album**: card 1 (earned with level 3, §6.4), card 2 (level 5), the badge (the Pack Check). An earned card shows its face and opens `library/card-detail`; the badge shows its full art and its date. A waiting tile shows the outline and its earn line, as the Library's earn hints do (`library/earn-hints.md`). Cards are never random and never bought (§7.2).

## Box diagram — B. preview (a free learner, gating switch on; §6.3, OD-3)

```
+----------------------------------+
| [<- back]                        |
| (badge)  Numbers & Time          |
|          [ Topic ]               |
| ( Hoya bubble: hoyaIntroEn )     |
| (pack ring)                      |  <- empty, no count line (nothing done)
| Levels                           |
| | (( )) Level 1 . Stage 2      | |  <- the Not open yet dotted ring in place of the mastery ring
| |       (Count to ten)         | |
| |       Not open yet           | |  <- caption, read as text (F-ENT-003 §3.11), never "locked"
| | ... the five level titles, each "Not open yet" (a level finished before keeps Play again) |
| Topic album                      |
| [card 1] [card 2] [badge]        |  <- shown with their earn lines, never greyed out
| +------------------------------+ |
| |   (Hoya reading)             | |
| |   (This topic is not open    | |
| |    yet. You can still see    | |
| |    what it teaches.)         | |
| |   [ See a preview ]          | |  <- outlined (secondary), opens one Discover page of level 1, read-only
| |   [ {ask} ]                  | |  <- askFor: "Ask a grown-up" / "Ask your teacher or a grown-up" / "See how to open it"
| |   Back to open lessons       | |  <- ghost link, as the episode preview
| +------------------------------+ |
+----------------------------------+
```

- The preview has **no primary button**: nothing on it pushes toward buying (F-ENT-003 §3.7). Never on this page: a price, a product name, "Premium", "buy", "trial", "locked", a lock glyph, a countdown, a number of days.
- **[ See a preview ]** opens the first Discover page of level 1 in the quest player's read-only preview (one page, then Back). It is the "one Discover preview page" of §6.3; nothing is scored or recorded.
- A level row still opens its episode page, which is in its own preview state (`episode/detail-access-preview.md` B).
- Whether the first quest of each pack is free stays open decision OD-3, decided as "levels follow their stage"; this state draws that decision.
- **Today** the gating switch is off until Stripe Live, so every learner sees state A. No pack changes any price.

## Box diagram — C. wide window, the detail pane (1280 x 800)

```
+---------------------------------------+-------------------------------------------+
| Journey, page 2 (master, 400 dp)      | [<-]                                      |
| [Count]<sel> header selected          | (badge) Numbers & Time   [ Topic ]        |
|                                       | ( Hoya bubble )                           |
|                                       | (pack ring) (2 levels done)               |
|                                       | Levels: five rows                         |
|                                       | Pack Check                                |
|                                       | Topic album: [card] [card] [badge]        |
|                                       | [[ Open level 2 ]]                        |
+---------------------------------------+-------------------------------------------+
```

- On two panes a level row tap shows the level's episode page in the detail pane, with Back to the pack page. The master pane stays on its topic page with the header selected.
- At 768 (one pane) the page is one reading column (`layout.maxWidth.reading`), the album three tiles in one row.

## Interaction points

- [<- back] → the Journey topic page that holds the pack (from any entry: Journey, Explore slot, planner hand-off) · on two panes the detail pane's own Back clears the selection.
- Level row → `episode/detail` (level `episodeId`).
- [[ Open level n ]] → `episode/detail` of the Next level · [[ Start the Pack Check ]] / [ Start the Pack Check ] → the review player (`reviews/stage-review.md` shape, kind `pack-check`, 10 items).
- Album card (earned) → `library/card-detail` · waiting tile: no action (its earn line is on the tile).
- Preview: [ See a preview ] → the quest player's read-only Discover page · [ {ask} ] → `access.help_asked { from: 'pack', audience }`, then the gate or the Plan screen (F-ENT-003 §3.7) · Back to open lessons → the `routeNext` episode page.
- Opening the page sends `pack.opened { packId }` once per open (§11.3). Finishing a level sends `pack.level_complete { packId, stage }` (from the quest flow, not this page).

## Navigation graph

Enter from: `journey/topic-pages` (pack header) · `home/todays-mission` (Explore slot) · the planner's pack hand-off (F-PLAN-002) · `library/card-detail` (a pack card's "from" line)
Exit to: `episode/detail` · the review player (Pack Check) · `library/card-detail` · `profiles/pin-entry` → `billing/plan-status-free-lessons` (preview ask) · `journey/topic-pages`

## States

- **A. open**: as drawn; a learner with nothing done sees an empty ring, no count line, and Level 1 as Next.
- **A'. every level Done**: the primary is Start the Pack Check; after the badge, no primary.
- **B. preview**: as drawn.
- **Hidden pack** (`topicPacks` or `pack.<key>` off, or the pack not `ready`): the page is not reachable from the Journey or Explore; a stale link (the planner, a restored deep link) shows "This topic is not here right now." and [ Back to Journey ]. Progress, cards and the badge stay (§12.2) and show again when it is back on.
- **Loading**: the pack and its levels are in the bundled catalogue; level bodies load as precached chunks (§10) when a level opens, not here.
- **Error** (progress unreadable): the page draws from content with no Done, no ring fill and Level 1 as Next, plus the Journey's muted "progress will show up in a moment" line.
- **Offline**: everything on this page is bundled.
- **Large text (200 %)**: rows grow, the stage tag wraps under the level number, the album wraps to two rows.

## Accessibility

- Reading order: Back, title, Hoya intro, the pack ring, the level rows in order, Pack Check, album tiles, the primary button; in the preview, the preview card's line, See a preview, the ask button, Back to open lessons. **Tab stops** are only the controls: Back, the level rows, Start the Pack Check (when shown), earned album cards, the primary button, See a preview, the ask button and Back to open lessons. Text, the Hoya intro, the ring and waiting tiles are read in flow and never focusable.
- Each level row is one button named "Level 2, Stage 3: What time is it? Next." (the state and the ring's mastery word in the name, as the cell label carries its marks).
- The pack ring is an image named "Numbers & Time: 2 levels done". With no level done there is no count line and the empty ring is decorative (hidden from assistive technology), so nothing reads as "0".
- Waiting album tiles are text, not disabled buttons.
- Targets at least `touchTarget.min`; body text 18 or larger; the Hoya bubble as `HoyaBubble`.

## Data needs

- reads: `CatalogPack` (`titleEn` and `hoyaIntroEn` in the UI locale, `homeTheme`, `levels[]`, `status`) · each level episode's title in the UI locale · `cellBest` per pack level (§4.4, the ring and Done) · `cellCheckAt` for the Pack Check result, the earned cards and the badge (§7.2) · `useQuestAccess` for each level (§6.3) · remote config `topicPacks`, `pack.<key>`
- writes: none on this page
- telemetry: `pack.opened { packId }` (no profile name, no item ids)

## Proposed copy (row CM-50b lands the strings with es and ko)

| Intended key | English |
|---|---|
| `learner.pack.kindPill` | Topic |
| `learner.pack.levelsTitle` | Levels |
| `learner.pack.level(n, stage)` | Level {n} · Stage {stage} |
| `learner.pack.state.done` | Done |
| `learner.pack.ringDone(count)` | {count} levels done (plural: 1 level done) |
| `learner.pack.open.cta(n)` | Open level {n} |
| `learner.pack.check.title` | Pack Check |
| `learner.pack.check.after` | Ready after level 5 |
| `learner.pack.check.cta` | Start the Pack Check |
| `learner.pack.album.title` | Topic album |
| `learner.pack.album.earnLevel(n)` | Finish level {n} to earn it |
| `learner.pack.album.earnBadge` | Finish the Pack Check to earn it |
| `learner.pack.preview.body` | This topic is not open yet. You can still see what it teaches. |
| `learner.pack.preview.cta` | See a preview |
| `learner.pack.hidden` | This topic is not here right now. |
| `learner.pack.hiddenBack` | Back to Journey |
| `a11y.pack.levelRow(n, stage, title, marks)` | Level {n}, Stage {stage}: {title}.{marks} |
| `a11y.pack.ring(title, count)` | {title}: {count} levels done (plural: "{title}: 1 level done"; `plural()` per locale) |

- Reused, no new key: `learner.access.notOpen` ("Not open yet"), the `askFor` labels and "Back to open lessons" (F-ENT-003), `learner.routeNext.tag.next` ("Next").
- About 18 new strings with the topic-page strings of `journey/topic-pages.md`, as the CM-50b row counts.

## Open questions

- **A Korean title.** The spec names each pack in Korean too (숫자와 시간). `TopicPackSchema` has `titleEn` only; a `titleKo` shown as taught Korean (`KoreanText`) under the title would be a content field (row CM-50a). Default: not in the first wave.
- **The badge's art.** The badge is drawn here as the pack's `homeTheme` glyph inside a ring of its token; the card art specs (F-CARD-S2..S7) may give each badge its own picture later.
