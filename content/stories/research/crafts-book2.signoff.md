# crafts-book2 (F-CURR-002 row CM-46, Play): third pass sign-off, 2026-11-04

Stories: `hahoe-mask-dance`, `hanji-korean-paper` (book 2 of the Stage 5 Play cell, `episode:stage5-crafts-v2`).

The third pass re-read both stories after the reviser (findings in `crafts-book2.changes.md`) and ran the checks below. It is an AI review pass of the authoring session; the independent MAR reviewer of the PR's fix stage re-reads the stories and the es and ko overlays. No copy claims native-speaker or expert review.

## What was checked

- Every narration sentence, caption, line, check and explanation against the facts it cites; no sentence states more than its facts (C6). Numbers and number words echo a cited fact (`narration-number-word-unmatched` clean).
- Every fact against its sources' quoted words, opened on 2026-11-04; two sources where the claim holds a number; institutions named as of the access date (Korea Heritage Service).
- §5.1 fact conventions: UNESCO status only for Talchum, mask dance drama in the Republic of Korea, "inscribed 2022"; no UNESCO status for hanji; papermaking's origin in China stated neutrally; no shared East Asian heritage framed as Korean in origin.
- Language: Korean lines and keywords in polite style, romanization equal to the F-CNT-002 converter, glosses that add nothing to the Korean.
- Learning design: story-coverage 100% for all four tiers; three checks a tier with varied answer positions; read-tier captions that settle the Story Order round by text.
- es and ko overlays: every translatable field, the same `{kw:}` tokens as the English, no Hangul outside tokens in es, descriptive ko keyword glosses (`overlay-circular-gloss` clean), Hoya in 해요체.

## Results

- `story-content` (schema and lint): no error. Warnings: `culture-note-missing`, as on every shipped story.
- `validate-content.mjs`: 0 violations; es 0 missing, ko 0 missing.
- `story-topic-unique`: no shared topic tag or source URL with any story.

## Remaining uncertainty

- The UNESCO element page could not be opened (bot check); its year and file number come from search excerpts and agree with the Korea Heritage Service press release of 2022-11-30.
- The Korea Heritage Service portal renders its descriptions with JavaScript; the quoted descriptions were read through the open API of the same heritage numbers.
- The wood of the Hahoe masks differs between sources (willow, alder), so the stories say only "wood".
