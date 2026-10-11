# StorySourcesScreen (screen spec v1)

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.1 (route, `PinEntry` `'ExternalLink'`), §3.8 (Sources), §3.11 (offline, empty), §3.12 (telemetry), §3.14 rows 1-4, PR 2.7 in §6 · wireframe: `design/wireframes/story/reader.md` screens I (Sources) and J (open-link gate and failure) · Korean content: `design/components/KoreanText/spec.md`
Code: `apps/mobile/src/screens/story/StorySourcesScreen.tsx` (state, gate, telemetry, scrolling), `SourcesParts.tsx` (paint); every rule is pure and tested in `apps/mobile/src/logic/story/` (`sources-view`, `source-link`); the browser hand-off is `apps/mobile/src/platform/external-link(.web).ts`

## What it is

Where "references are marked exactly" becomes visible: every statement of a story with the citations behind it (title, publisher, date accessed, the supporting quote or locator, the link), any corrections, how the story was checked, and the gentle note for grown-ups. Everything is generated from the story JSON (`facts[].sources[]`, which the importer took from the research `*.final.json` citations); nothing is written per story. Anyone may read it; opening a link is a grown-up action.

## Route

`StorySources { storyId, factId?, sceneIndex?, from? }`

| Param | Effect |
|---|---|
| `factId` | Scrolls to that fact's card and highlights it (outline + "Highlighted" pill, never colour alone) |
| `sceneIndex` | Scrolls to that scene's section (or the next scene that has facts) |
| `from` | `story.sources.opened` only: `reader` (top bar), `end` (end page), later `episode` / `notes` / `scene` (F-STORY-004) |

From the reader: the top bar passes the scene being read; the end page opens at the top.

## Anatomy (portrait, `reading` column)

```
 [<]  Sources                                   <- back 64 | screen heading (level 1)
 -------------------------------------------- scrolls
 [호야, 사관을 만나다] Hoya Meets ...            <- KoreanText: Korean, romanization, English
 [Traditional tale]                             <- tales only, with the origin and retelling notes
 Sources: 국사편찬위원회 ...                     <- referenceDisplay, verbatim (a headline only)
 Checked in 3 independent passes · last checked 2026-10-10 · story version 1
 These checks covered a group of related stories, not this story alone.   <- scope: cluster only
 [ How it was checked ]                         <- disclosure: verification notes
 A gentle note for grown-ups                    <- only with an advisory
 Corrections                                    <- only with a visible erratum, newest first
   2026-11-02  We corrected ...  (fact f4: claim)
 3 facts · 5 sources                            <- counts (not a learner result)
 Scene 1 · A king's wish                        <- section heading (level 2) + caption
 +------------------------------------------+
 | [What we know] [Updated 2026-11-02]      |   <- scope pill, Updated pill when rev > 1
 | King Sejong led the creation of ...      |   <- claimEn (overlay-translatable)
 | [ Korean ]                               |   <- disclosure: claimKo, lang="ko"
 | Sources (2)                              |   <- heading (level 3)
 |  Hangul, the Korean alphabet             |   <- source group, labelled "Source 1 of 2: title, publisher"
 |  Cultural Heritage Administration · accessed 2026-10-09
 |  Section: Creation of Hangul             |   <- quote or locator (lang="ko" when Korean)
 |  https://www.heritage.go.kr/...          |   <- selectable plain text
 |  [ Copy link ]  [ Open link ]            |   <- 64 each; Open only for an https link
 |  Link copied                             |   <- the outcome line, polite live region
 +------------------------------------------+
 About "almost 600 years": ...                  <- approximations under the card
 Scene 2 · ...
  > See fact f1                                 <- a later citation: one row, jumps to the card
 Used in questions and notes                    <- facts no scene cites
```

## Open link (grown-up action, wireframe J)

| Device | Tap Open link |
|---|---|
| Grown-up session open, or a self-only device with no PIN (`gateOpensDirectly`) | Opens at once |
| Anything else | `PinEntry { next: 'ExternalLink', url }`; after the gate the PIN screen goes back and Sources opens the link; Cancel drops it |

- Only an `https:` URL that is one of the story's own sources is ever handed over (re-checked, never trusted).
- Native: `Linking.openURL` in a try/catch. Web: a new tab with `noopener,noreferrer`, so the page cannot reach back to the app.
- Failure: "Open this link in a browser: <url>"; offline adds "Opening a link needs a connection." first. The link stays selectable and Copy link stays.
- `story.sources.link_opened { storyId, factId }` fires only after a successful hand-off.
- Copy link needs no gate. Without a clipboard: "Copying is not available here. The link is above."

## Layout by window (F-LAYOUT-001)

One scrolling column in `reading` (720 cap) at every width; the header (back + heading) stays above the scroll. Buttons wrap to their own line when the row is narrow (320 wide). Long URLs and titles wrap anywhere instead of widening the page.

## Accessibility

- Heading levels: screen 1, sections 2, "Sources (n)" 3; lists as lists of groups.
- Each source block is one group labelled "Source 2 of 3: <title>, <publisher>"; its buttons stay reachable inside it.
- Korean nodes (`claimKo`, Korean quotes, the Korean of the title) are marked `lang="ko"`.
- The highlight is an outline (`borderWidth.base`, `colors.border.focus`) plus the "Highlighted" pill.
- Outcome lines are polite live regions.

## Tokens

`colors.surface.*`, `colors.text.*`, `colors.border.focus`, `colors.border.subtle`, `spacing.*`, `radii.*`, `borderWidth.*`, `typography.*`, `touchTarget.min`. No colour or spacing literals, no emoji.

## Copy

`learner.story.sources` in `packages/i18n` (moved unchanged from PR 2.5's `STORY_READER_COPY`). Citations (titles, publishers, quotes, the Korean claim) stay in their source language by design.
