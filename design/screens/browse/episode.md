# Episode outline (BR-7)

Wireframe: `design/wireframes/browse/episode.md` · Spec: F-BROWSE-001 §4.6, §4.2 · Mock: `mock/episode.html`, `mock/episode-states.html`, and the detail pane of `mock/home-journey.html` · Shots: `shots/episode-375.png`, `-1280.png`, `shots/episode-states-375.png`, `shots/home-journey-1280.png`

Data: `episodeOutline(episodeId, bundle, locale)`.

## Layout

| Part | Look |
|---|---|
| Back | the `arrow-left` 64 button ("Back to all lessons"), top left; no Lesson display on this page |
| Kicker | the stage pill ("Stage 1 · Hangul"; Open-stage `feedback.successLight`, a taste stage `brand.primaryLight`) and the theme title, Body small `text.secondary` |
| Title | the episode title, Heading `title`, the one header (an `h2` in the Journey detail pane, under the page's header) |
| Subtitle | `subtitleEn`, Body `text.secondary` |
| Minutes | "About N minutes" (the sum of quest minutes), Body small semibold |
| Hoya | the learner episode page's bubble: Hoya `idle` 56 and `hoyaIntroEn`, Body semibold |
| Lessons | "Lessons" (Heading `prompt`), then one paper `Card` per quest in `questIds` order |
| Cards | "Cards in this episode", then one row per reward card: the 64 CardArt thumbnail with the rarity border, and beside it the English title (Body semibold) and the Korean with romanization (`KoreanText`), as on the item page's "The card it awards". One column on compact, two from the regular class. Each row is one button, "{title}, {Korean} {romanization}. Opens the card.", to the card page in its preview state. Hidden when the episode awards none |

## Lesson row

```
 (1)  Meet a, eo, g, n
      About 5 minutes
      [ㅏ a] [ㅓ eo] [ㄱ g/k] [ㄴ n]       letters (KoreanText chips)
      (Read) (Listen)          [ Open ]   skills chips, then Open at the end of the line
```

- The 44 number disc is `surface.sunken`, not a progress mark.
- The letters row comes from `questTeaches`. A lesson that introduces no letter (taste lessons and some later Stage 1 lessons, such as Mountain, River, Sea) shows its first three words instead (Korean with romanization, then the gloss). Spec §4.6 names this for taste lessons only (README, Deviations).
- The skills chips are the `book`, `ear` and `pencil` glyph plus the word, with a `border.strong` outline. Speaking is never listed. The row is hidden when `questSkills` is empty (README, Notes for BR-7).
- [ Open ] is a compact ghost `Button` (64) that opens the item page. The row itself is not a second target.
- **Closed** (sampler, switch on): "Opens with the Family Plan or a Group License" in Body semibold `text.secondary` above the skills line. There is no glyph, and [ Open ] still opens the page.

## States

- **Coming later** (`status: 'preview'` or no quests): the kicker, title and one sunken line "Coming later". No subtitle (a content subtitle such as "Coming soon." would say the same thing twice), no minutes, no Hoya, no rows, no cards.
- **Story episode** (once a story is reviewed): "Stories", then one row per story with its 64 cover tint, title, "1 level · 8 scenes" and [ Open ].
- **Unknown id**: never renders; home shows the not-in-this-version line.
