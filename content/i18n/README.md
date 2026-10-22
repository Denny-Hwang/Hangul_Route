# content/i18n/

Locale overlays: the Spanish and Korean text of content, kept **beside** the English
content, never inside it (F-I18N-001 §3.6, §3.7). English (`*En` fields and the JSON
`title` / `blurb` / `en` fields) stays the source of truth; an overlay is partial, and
whatever it does not translate is shown in English.

Overlays translate **content** (card titles, glosses, story narration, ...). UI strings
(buttons, Hoya lines the app writes, errors) live in the typed dictionary
`packages/i18n/src/messages/<locale>/`, not here.

## Files

```
content/i18n/es/<domain>.json    Spanish
content/i18n/ko/<domain>.json    Korean
```

There is no `en/` folder: English is the source. `<domain>` is the file name and groups
entries by area (`stage1-cards`, `vocab-food`, `placement`, `stories`, ...).

```json
{
  "locale": "es",
  "domain": "stage1-cards",
  "entries": {
    "card:gangaji": { "title": "Perrito", "blurb": "Un perro pequeño y simpático." },
    "jamo:giyeok": { "soundHint": "como la g de gato", "exampleWord.gloss": "cachorro" }
  }
}
```

- `locale` equals the folder, `domain` equals the file name, nothing else at the top level.
- An entry key is the **entity id** of the base content (`<prefix>:<id>`, the object's `id`;
  stages and themes are `stage:<key>` / `theme:<key>`). One entity lives in one file per locale.
- A field key is the translatable field **without `En`** (`title` for `titleEn`), or a dotted
  path inside the entity. In a path, a list element is named by its `id`, else its `key`, else
  its romanization as a slug (`ne, joayo` becomes `ne-joayo`), else its position (`0`, `1`, ...).
  An `id` / `key` that is not already lower-case letters, digits and hyphens is slugged when it is
  plain ASCII (the Listen & Pick round `lp:sym:jamo:eo` is `lp-sym-jamo-eo`) and skipped when it
  carries Korean (a `lp:syl:` / `lp:word:` / `lp:pic:` round is named by its position).
- Values are non-blank strings.

## What may be translated (`OVERLAY_FIELDS`)

| id prefix | fields |
|---|---|
| `jamo:` | `gloss` (JSON jamo only, see below), `soundHint`, `exampleWord.gloss`, `nameHint` |
| `card:` | `title`, `blurb`, `fact` |
| `episode:` | `title`, `subtitle`, `hoyaIntro` |
| `quest:` | `title`, `blurb`, `teaser`, `steps.<stepId>.title` / `.body` / `.hoyaLine`, and Discover: `steps.<stepId>.discover.pages.<page>.caption`, `steps.<stepId>.discover.pages.<page>.items.<item>.example.gloss` / `.word.gloss` / `.note` |
| `minigame:` | `cardPairs.<pair>.gloss`, `storySteps.<stepId>.label`, `dialogue.<turn>.npc`, `dialogue.<turn>.options.<option>.gloss`, `listenPick.rounds.<roundId>.prompt` |
| `stage:` / `theme:` | `title`, `oneLiner`, `anchorSkill` |
| `story:` | `title`, `summary`, `hoyaIntro`, `hoyaOutro`, `scenes.<sceneId>.narration` / `.caption` / `.alt`, `tiers.<level>.scenes.<sceneId>.narration` / `.caption` / `.alt` (see below), `keywords.<id>.gloss`, `checks.<checkId>.prompt` / `.explain` / `.hint` / `.options.<optionId>`, `cultureNotes.<id>.title` / `.body`, `facts.<id>.claim`, `errata.<id>.summary` |
| `vocab:` | `gloss`, `senseNote` |
| `vocab-topic:` | `title`, `blurb`, `hoyaIntro` |
| `pitem:` | `gloss`, `options.<optionId>.gloss` |

The table lives in `packages/content-schema/src/schemas/locale-overlay.ts` and, for the Node
scripts, in `scripts/overlay-fields.mjs` (a test keeps them equal). **Never** translatable:
`ko`, `char`, `romanization`, `target`, `answer_ko`, `lang_ko`, `audioRef`, ids, `order`,
`sound`, `pictureRef`, `visual`. Taught Korean and its romanization come only from the base
content, in every locale. A jamo `soundHint` / `nameHint` may exist in an overlay even when the
English base has none yet (a Spanish sound-alike is written fresh for Spanish readers).

**Two-tier stories.** A story with a `listen` and a `read` tier reuses the scene ids (`s1`, `s2`, ...)
in both tiers with different English and different `{kw:}` tokens, so a scene is translated per tier:

- `scenes.<sceneId>.narration` / `.caption` / `.alt` (untiered) translates the **listen** tier only
  (a one-tier story's only tier; a story without a listen tier, its first tier). Every existing
  story overlay uses this form, and it stays valid.
- `tiers.<level>.scenes.<sceneId>.narration` / `.caption` / `.alt` translates that tier's scene, the
  tier named by its `level` (`tiers.read.scenes.s1.narration`). The read tier's scenes are reached
  **only** this way; until they have one, the read tier shows its English.
- On the listen tier both forms may be present: the tier-qualified one wins. Write one or the other
  for a scene, not both (the validator warns `overlay-shadowed` when an entry has both).
- An untiered `scenes.<sceneId>.*` for a scene only the read tier has is `overlay-unknown-id`; the
  message names the `tiers.read.*` key to write instead.
- Checks (`checks.<checkId>...`) need no tier: a check or checkpoint id is unique across a story's
  tiers (`c1`, `r1`), which the story schema enforces.

```json
"story:sun-and-moon": {
  "scenes.s1.narration": "...the listen tier's s1, with its {kw:} tokens...",
  "tiers.read.scenes.s1.narration": "...the read tier's s1, with the read tier's {kw:} tokens..."
}
```

**Jamo glosses.** `jamo:*.gloss` translates the JSON jamo's `en` (`content/episodes/stage-1/jamo.json`,
"G — sounds like the start of 'go'"), a JSON-base field: `scripts/validate-content.mjs` checks it against
that JSON and counts it for `HANGUL_ROUTE_STRICT_LOCALES`, and the mobile overlay test leaves it alone.
The TypeScript jamo the app ships (`apps/mobile/src/content/jamo.ts`) has no English gloss: its
`nameEn` is the romanized letter name (`giyeok`) and is **never** a gloss source, so no screen shows
`gloss` today. The same goes for the Stage 1 cards that exist only in `content/episodes/stage-1/cards.json`
(`card:gangaji`, `card:nabi`, ...): the validator checks them, the mobile test skips them. Three ids are in
both the JSON and the TypeScript cards with different English (`card:mugunghwa`, `card:sagwa`,
`card:yutnori`); their overlay translates the TypeScript text the app ships. Describe a letter's sound in
`soundHint` (and its name in `nameHint`); translate its example word with `exampleWord.gloss`, which
Discover uses when the page shows that jamo's own example word. A Discover page's other example
and word glosses are translated on the quest (`steps.<stepId>.discover.pages...`).

`exampleWord.gloss` follows the **TypeScript** jamo the app ships (`exampleWordKo`: 가족 for
`jamo:giyeok`), not the JSON jamo, whose example words are an older, different set (강아지 for the
same id). The same overlay key would land on the JSON `exampleWord.en` too, so a consumer that
localizes the JSON jamo (none does today; F-CNT-002 generation would be the first) must reconcile the
two sets of example words first (open item, F-I18N-001 §10).

**Positional entries are pinned.** A Listen & Pick round or a Discover item that carries Korean is
named by its position (`listenPick.rounds.1.prompt`), so a reorder would move the translation to
another word. `apps/mobile/src/content/__tests__/fixtures/overlay-ko-pins.json` records the Korean
each positional entry (and each jamo `exampleWord.gloss`) was written for, and the mobile overlay
test fails when the base Korean at that position changes. Add a pin with every new positional entry,
after checking the translation against that Korean. A Discover page `caption` or item `note` has no Korean of
its own; it is pinned to the Korean its page or item shows (`"엄마 / 가족"`).

**Not yet translatable.** The Journey and Library theme labels shorten the theme title to its first
word (an English-only rule); a theme overlay must not ship before a short-label field replaces
that rule (open item for F-I18N-001 PR 15/16).

## Writing rules

- **Spanish**: neutral international Spanish, informal "tú", no Hangul at all (taught Korean is
  shown from the base content next to your text).
- **Korean**: 해요체. A Korean `gloss` is a **description**, not an echo: for 강아지 write
  "작고 귀여운 개", never "강아지" (that fails as `overlay-circular-gloss`; a gloss that only wraps
  the word in quotes or punctuation is a warning).
- **Story narration** keeps exactly the same `{kw:<id>}` tokens as the English of the tier it
  lands on (any order); each token renders as the Korean word on its chip.
- No word from `packages/i18n/src/banned-words.json` for the locale (anti-shame, F-HW-001 §3.3).
- Short and plain, like the English (CEFR Pre-A1); no emoji.

## After an edit

```bash
node scripts/build-overlays.mjs           # regenerate packages/content-schema/src/i18n-overlays.generated.ts (never hand-merge it)
node scripts/build-overlays.mjs --check   # determinism check (CI); the module is gitignored, never committed (F-CURR-002 row CM-6)
node scripts/validate-content.mjs         # the overlay rules below
pnpm --filter @hangul-route/mobile test -t overlays   # ids of TypeScript-resident content
```

Vocabulary overlays also feed `scripts/build-vocab.mjs` (run it too, `content/vocab/README.md`).

The app reads the generated overlays through the `@hangul-route/content-schema/overlays` subpath, not
the package barrel, so the site and the Worker do not bundle the Spanish and Korean text (F-I18N-001
§10 open item 2). `src/__tests__/overlays-bundle.test.ts` in that package holds a size budget (1 MiB of
JSON per locale): past it, split the module per locale and load the viewer's locale on demand.

## What the validator checks (`scripts/overlay-rules.mjs`)

| Rule | Level |
|---|---|
| `overlay-bad-shape`: wrong place, locale or domain, extra keys, an entry that is not an object of non-blank strings, an entity in two files | error |
| `overlay-unknown-id`: an id that is in no `content/**/*.json` entity, or a path naming a scene, check, option, keyword, ... the entity does not have | error |
| `overlay-forbidden-field`: a field outside the table above | error |
| `korean-in-ui-field`: Hangul in a Spanish overlay, or outside a translatable field of a Korean one | error |
| `overlay-circular-gloss`: a Korean gloss equal to the Korean it glosses | error (warning when it only wraps it) |
| `overlay-token-mismatch`: story narration tokens differ from the English of the tier the field lands on | error |
| `banned-on-learner-surface`: a banned word of the locale | error |
| `overlay-missing`: a translatable English field the locale lacks, counted per story tier (a listen-tier scene is covered by either form, a read-tier scene by its `tiers.read.*` field) | warning; error for locales in `HANGUL_ROUTE_STRICT_LOCALES` (set in `.github/workflows/content-validation.yml` when a locale ships; `scripts/i18n-status.mjs` fails a shipped locale that is not listed) |

Ids of content that is still TypeScript in `apps/mobile/src/content` (`jamo:`, `card:`,
`episode:`, `quest:`, `minigame:`, `stage:`, `theme:` that are not in the JSON) are checked by
`apps/mobile/src/content/__tests__/overlays.test.ts` instead: the entity must ship, each field
must land on an English source the screens read, a Korean value must not echo the Korean it
explains, and the glosses of one minigame must stay distinct in each locale. Test fixtures (`content/fixtures/`), research
data and `_*.json` registries are not translatable entities.

Spanish and Korean stay hidden in the app (`LOCALE_STATUS` in `packages/i18n`) until their native
review; an overlay is not visible to learners before that.
