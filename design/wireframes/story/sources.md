# Story / Sources: every claim with its citations (wireframe v2)

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.1 (route `StorySources`, `PinEntry` `'ExternalLink'`), §3.8 (Sources screen), §3.11 (offline, empty), §3.12 (telemetry), §3.14 rows 1-4; data (`facts[]`, `sources[]`, `verification`, `errata`, `origin`) in `F-STORY-001-story-schema-pipeline.md`
Audience: grown-ups, reviewers and curious learners of any age (CLAUDE.md §1). Nothing on the screen is a learner result; leaving the app needs the grown-up gate whenever F-LEARN-001 `gateRequired` asks for one (J1).
Code (built): `apps/mobile/src/screens/story/StorySourcesScreen.tsx` (state, gate, telemetry, scrolling), `SourcesParts.tsx` (paint); pure rules `apps/mobile/src/logic/story/sources-view.ts`, `source-link.ts`, `safe-url.ts`; browser hand-off `apps/mobile/src/platform/external-link(.web).ts`. Screen spec: `design/components/StorySourcesScreen/spec.md`. Brief: `design/brief/screens/26-story-sources.md`.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko / rom / en ~~` a title drawn with `KoreanText`, `[v]` a disclosure (collapsed).

Promoted by F-STORY-002 PR 2.0 from the reader draft; panels I and J keep their letters from `story/reader.md`.

All copy in boxes is placeholder; final strings live in `packages/i18n` (`learner.story.sources`). Claims in Korean, source titles, publishers and quotes are citations and stay in their source language.

## Scenario (Given-When-Then)

Given: a grown-up (or a curious learner) is reading a story or looking at its episode page and wants to know where a statement comes from
When: they open Sources from the reader's top bar, the end page, the episode page, Culture notes, or a scene link
Then: they see every claim the story makes, grouped by the scene that uses it, with each source's title, publisher, access date, the supporting quote, the link as plain text, how the story was checked, and any corrections, newest first

## Screen goal

"Show exactly where every fact in this story comes from."

There is no primary button: the screen is read and scrolled. Secondary actions per source: **Copy link**, **Open link** (a grown-up action).

---

## I. Sources screen

```
┌──────────────────────────────────┐
│ [<]  Sources                     │
│  ~~ 호야, 사관을 만나다 ~~        │  <- story title: Korean / romanization / English
│  Hoya Meets the Royal Historians │
│  [Traditional tale]  (tales only)│
│  One version of a story told in many versions.
│                                  │
│  Sources: 국사편찬위원회 ...; 국가유산청 ...   <- the one-line headline (never the only proof)
│  Checked in 3 independent passes · last checked 2026-10-10 · story version 2
│  These checks covered a group of related stories, not this story alone.   <- only when the check's scope is a cluster
│  [v] How it was checked          <- expands the reviewers' notes
│  A note for grown-ups: ...       <- only when the story has one
│  10 facts · 27 sources           <- counts are fine here (not a learner result)
│                                  │
│  Corrections                     <- only when there are any
│   2026-11-02  We corrected ...  (fact f4)
│  ───────────────────────────     │
│  Scene 2 · A historian writes beside the king   <- the scene's caption
│  ┌──────────────────────────────┐│
│  │ What we know                 ││  <- or "What the tale says"
│  │ Historians attended wherever ││  <- the claim, in plain words
│  │ the king met his officials...││
│  │ [v] Korean                   ││  <- the same claim in Korean
│  │ Sources (2)                  ││
│  │ • 실록은 누가 기록했을까       ││  <- title
│  │   국가기록원 · accessed 2026-10-09
│  │   "사관은 경연, ... 항상 참석하여..."   <- the supporting quote or locator
│  │   https://theme.archives.go.kr/...      <- link as plain, selectable text
│  │   [ Copy link ] [ Open link ]            <- Open = grown-up action (J)
│  │ • (second source)            ││
│  └──────────────────────────────┘│
│  About "almost 600 years": 1443 to 2026 is 583 years, so the story rounds it.
│  Scene 5 · See fact f3           <- a repeated fact links back, never repeats
│  ───────────────────────────     │
│  Used in questions and notes     <- facts only checks or culture notes cite
│  ...                             │
└──────────────────────────────────┘
```

- "What we know" = documented facts. "What the tale says" = what a traditional tale tells, not history.
- A fact that was corrected shows an "Updated" tag with the erratum's date.
- A time-relative approximation adds "This depends on today's date."
- Deep link with a fact id scrolls to that card and marks it with an outline plus the word "Highlighted" (never colour alone); a scene index scrolls to that scene's section.
- Every source block is one focusable group: "Source 2 of 3: <title>, <publisher>". Korean nodes carry `lang="ko"`.

## J. Open link: grown-up gate and failure

```
J1  [ Open link ]  ->  (a PIN gate applies: PIN set or shared device)  ->  profiles/pin-entry  ->  browser
                   ->  (self-only device, no PIN)                      ->  browser directly

J1w (web) back from the gate:
│  Grown-up check done. Tap Open link to open it.   <- the browser only opens a tab on a tap
│  [ Open link ]

J2  Could not open (offline, blocked pop-up, or refused)
│  Open this link in a browser:
│  https://...                     <- stays selectable
│  [ Copy link ]
```

- On a shared or PIN-protected device a learner cannot reach the open web from a story: Open link goes through the grown-up gate. On a self-only device without a PIN, Open link goes straight to the browser (F-LEARN-001 `gateRequired`, `openLinkStep` in `logic/story/source-link.ts`). **Copy link** never needs a gate (it is a string).
- Only `https:` links from the story's own source list are ever opened; anything else is refused and shows J2.
- Native checks the connection first and opens the waiting link by itself on return from the gate.

---

## Interaction points

| Where | Tap / key | Result |
|---|---|---|
| Back | tap, back gesture | the screen Sources was opened from |
| How it was checked / Korean | tap | expand or collapse (state is local) |
| Copy link | tap | link copied, with a short "Link copied" line; where copying is not available, a line says the link is above |
| Open link | tap | J1: grown-up gate when it applies, then the browser; J2 on failure |
| "See fact f3" row | tap | scrolls to that fact card and highlights it |
| Correction row | tap | scrolls to the fact it concerns |

## Navigation graph

Enter from: `story/reader` top bar (`from: 'reader'`) and end page (`'end'`) · `episode/detail-story` grown-up row (`'episode'`) · `story/culture-notes` (`'notes'`) · a scene link (`'scene'`, with `sceneIndex` or `factId`)
Exit to: back to the caller · `profiles/pin-entry` (`next: 'ExternalLink'`) · the device browser (outside the app)

## States

- **success**: I as drawn.
- **empty**: a story without facts cannot be `ready` (F-STORY-001 requires at least one); defensively one line, "No sources are listed for this story.", and Back.
- **error**: an unknown story id shows the same line and Back; an unresolvable fact or source is skipped, the rest render.
- **offline**: everything on the screen works (text only); **Open link** shows "Opening a link needs a connection." and the J2 block.
- **gate cancelled**: back on Sources with nothing opened and no message.
- **200 % text, 320 wide**: long URLs wrap anywhere; buttons stack.
- **reduced motion**: scrolling to a highlighted fact jumps instead of animating.

## Data needs

- reads: the bundled story (`storyById`): `facts[]` (claim, Korean claim, scope, rev, scenes, approximations), `sources[]`, `verification`, `errata` (`show: true` only), `origin`, `review.advisory`, `referenceDisplay`, `contentVer`; F-LEARN-001 `gateRequired` for the gate
- writes: nothing (no storage)
- telemetry: `story.sources.opened` `{ storyId, from, factId? }`, `story.sources.link_opened` `{ storyId, factId }` after a successful hand-off

## Open questions

1. Should Sources show the Korean claim expanded by default for Korean-UI users? Default stays collapsed.
2. A "Report a mistake" entry (a mailto or support route) is deliberately left out of v1; the owner decides whether to add it with the correction process.
