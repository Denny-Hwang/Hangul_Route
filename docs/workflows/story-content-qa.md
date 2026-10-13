# Workflow: Story Content QA

How a heritage story goes from research to the shelf, and what "verified" means. Source of truth: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.9 (process) and §3.10 (licensing), on top of `docs/specs/F-STORY-001-story-schema-pipeline.md` (schema §3.2, facts §3.3, verification §3.6, corrections §3.7, validators §3.8).

F-STORY-001 enforces the structure: every non-framing scene cites facts, sources are https and authoritative, numbers echo their facts or are marked as approximations, versions and errata. This page is the **review process** every story goes through before it may hold a `shelf` block, and the lint rules that back it.

## 1. The passes

Every story passes through all eight steps in order. A step is never skipped, and a later step never stands in for an earlier one.

| Pass | Who | Output (per research cluster) | What it checks |
|---|---|---|---|
| 0 Author | research agent | `<cluster>.draft.json` | 6 episodes per cluster; every narration sentence mapped to a fact id; each fact has at least one authoritative source (at least two for dates and numbers); no folk etymology; folk tales labelled as traditional tales; violence and modern tragedy left out |
| 1 Check A and Check B | two independent checkers who do not see each other's output | `<cluster>.checkA.json`, `<cluster>.checkB.json`: `{ issues[{episode, where, problem, correction, evidence, severity}], verified_count, unverifiable[] }` | every claim against its sources; anything that cannot be verified is listed, not guessed |
| 2 Reviser | author side | `<cluster>.revised.json` and `<cluster>.changes.md` | every checker issue is marked FIXED, SOFTENED, REMOVED, REJECTED (with a reason) or EXTENDED |
| 3 Final check | a third independent verifier | `<cluster>.final.json` with `verification { passes: 3, checked_at, notes }`, and `<cluster>.signoff.md` | every cited URL re-opened (archive copies when a site refuses connections), quotes machine-matched, a source chosen independently per episode; corrections, remaining uncertainty and a per-episode YES |
| 4 Import | tool | `scripts/import-heritage.mjs` writes `content/stories/<slug>.json` with `state: "draft"` and the cluster `verification` copied with `scope: "cluster"` | nothing is retyped; gaps become lint findings |
| 5 Native language review | a multi-agent review as the final review (owner decision 2026-10-12, the process of the vocabulary review #185; F-STORY-005 §3.9, F-STORY-001 §3.6) | `review.language: "native-reviewed"`, `review.reviewedBy: "MAR"`, `review.reviewedAt` | Korean strings read for spelling (맞춤법) and naturalness; Revised Romanization is machine-checked (F-CNT-002) |
| 6 Culture review | a multi-agent review for heritage accuracy and sensitivity as the final review (owner decision 2026-10-12, same process) | `review.culture: "culture-reviewed"`, `reviewedBy: "MAR"` and date; `review.advisory` confirmed | folk-tale framing, tone, omissions, advisories for grown-ups |
| 7 Publish | CI and owner | `state: "ready"`, a `shelf` block, green lint | the gate below |

The research working files live in `content/stories/research/` (only `<cluster>.final.json`, `.signoff.md` and `.changes.md` are kept). The importer reads only `.final.json` files; `MIN_VERIFICATION_PASSES` is 3 (F-STORY-001 §3.6).

Passes 5 and 6 are separate multi-agent reviews with separate findings, and each signs separately. Both sign as `MAR`, and the story has one `reviewedBy` / `reviewedAt` pair, so each pass also appends one line to `verification.notes` (`MAR`, the date, and which review: language or culture) and lists its findings and their outcomes in the PR description, so the two sign-offs stay distinguishable and the earlier one is never lost. `native-reviewed` and `culture-reviewed` are schema tokens meaning that pass is complete; no learner, grown-up, store or site copy may say a story was reviewed by a native speaker or a human expert (F-STORY-001 §3.6).

## 2. Sources

Allowed source families (the research brief): 국가유산청 / 국가유산포털, 국사편찬위원회 (Sillok DB, 승정원일기 DB, 우리역사넷), 한국고전번역원, UNESCO registers, 한국민족문화대백과사전, 국립중앙박물관, 국립한글박물관, 국립국어원, 국립민속박물관 / 한국민속대백과사전, 규장각, 청주고인쇄박물관. A host outside `SOURCE_HOST_ALLOWLIST` (`packages/content-schema/src/story-sources.ts`) is a warning; adding a host is a one-line, reviewed PR.

`quoteOrLocator` holds a short excerpt or a locator ("Section: Creation of Hangul") as audit evidence. It stays in the repository and is never shown to learners. UNESCO register text is never reproduced beyond a short quoted locator.

## 3. Lint rules this process adds

`lintStory` (`packages/content-schema/src/story-lint.ts`) runs over every `content/stories/*.json` in CI (`story-content.test.ts`). Errors fail the run. On top of the F-STORY-001 §3.8 rules, F-STORY-005 adds three:

| Rule | Level | What fails | How to fix it |
|---|---|---|---|
| `narration-copies-source` | error | 8 or more consecutive words of any learner-facing English field also appear in any `quoteOrLocator` of the story. The fields are every prose field the learner reads: `title.en`, `summaryEn`, `hoyaIntroEn` / `hoyaOutroEn`, each scene's `narrationEn` and `captionEn`, each check's `promptEn`, `explainEn`, `hintEn` and options, culture notes, and each fact's `claimEn`. Case and punctuation are ignored; a `{kw:}` token ends a run. Official names and fixed date forms that cannot be restated (`COPY_EXEMPT` in `story-lint.ts`: the UNESCO Representative List and Masterpieces names, "Memory of the World", the official country names, "Lunar New Year", and lunar dates such as "the fifteenth day of the eighth lunar month") are skipped: their words never count toward the 8, but the words on either side join up, so a long copy that contains a name still fails. | Restate the fact in plain words of your own; changing a word or two to get under 8 is not a restatement. Facts are restated, not pasted (copyright, and plain language for every reader). Restating a claim in a `ready` story bumps that fact's `rev` and the story's `contentVer`. |
| `narration-national-treasure-number` | error | any learner-facing English field except `claimEn` contains a designation number: "National Treasure No. 70", "National Treasure (No. 70)", "National Treasures Nos. 32 and 151", "National Treasure 70" (any case), and "Treasure No. 1", "Historic Site No. 3", "Natural Monument No. 103" (capitalized, so a folk tale's "treasure number 2" passes). The finding quotes the match. | Say "National Treasure" (or the designation) without the number. Korea dropped numbers from official names in 2021. A number in a source title or a claim stays in the reference zone (`facts[]`, `referenceDisplay`). |
| `story-shelf-needs-reviewers` | error | a story has a `shelf` block but `review.language` is not `native-reviewed` or `review.culture` is not `culture-reviewed`. | Remove the `shelf` block until both reviews are signed (passes 5 and 6). `review-unsigned` separately requires `reviewedBy` and `reviewedAt` on any reviewed value. |

A `shelf` block therefore needs all of: `verification.passes >= 3` (`story-unverified`), both review sign-offs (`story-shelf-needs-reviewers`), the sign-off initials and date (`review-unsigned`), and `shelf.minutes` equal to `minutes` (`shelf-minutes-mismatch`).

## 4. Images and licensing

1. **We draw our own art.** Every illustration, scene, prop and card is hand-authored SVG in `packages/design-system` using tokens: no raster images, no photographs, no drawings traced from photographs (a tracing can be a derivative of the photographer's work). Objects are drawn from their described shape and from primary descriptions, not copied from one picture. `ArtLayer.ref` only accepts `hoya`, `prop` or `card`, so the story schema has no field for an external image. Heritage props also carry a `sourceRef` and an `accuracyNote` in the prop registry.
2. **External images only with proof.** No story may use an external image today. If a later spec adds an image field, it must also add a `credits[]` entry per image: `{ assetId, institution, sourceUrl, license, licenseProof, accessed, attribution }`, where `license` is one of:
   - `kogl-1`: Korea Open Government License Type 1 (공공누리 제1유형: attribution only; commercial use and modification allowed);
   - `public-domain`: with the reasoning (the author's death year or the age of the work, and that the photograph or scan itself is also free);
   - `cc0`.

   `licenseProof` is the page or file that shows that license on that exact item. KOGL Types 2 to 4 (non-commercial or no-derivatives), "free to view" and "no copyright notice" are **not** acceptable. The owner confirms with counsel before the first external image.
3. **Text.** Narration is original writing; facts are restated and sourced (`narration-copies-source`).
4. **Attribution on screen.** The Sources screen lists `referenceDisplay` and each fact's sources; cards show their citation. UNESCO and agency logos and emblems are never used; inscription names are used factually.
5. **Third-party names.** National Treasure names, place names and people's names are used factually. Nothing implies endorsement: no "approved by" in the store listing or on a Sources line.

Every PR answers the pull request template line **"Image rights: SVG drawn in-house, or `credits[]` attached"**.

## 5. Before you open a story PR

```bash
corepack pnpm --filter @hangul-route/content-schema test story-content   # schema and lint over every story
corepack pnpm --filter @hangul-route/content-schema test story-lint      # the lint rules and their fixtures
node scripts/validate-content.mjs                                        # language policy (F-CNT-001)
node scripts/build-stories.mjs --check                                   # the bundle matches the JSON
```

In the PR description: which passes the change went through, which sources you re-read, and the image rights line.

## 6. Corrections after publishing

The errata policy is F-STORY-001 §3.7: severity S1 to S3, one content PR, `contentVer` and `fact.rev` bumps, an append-only `errata[]`, and S1 ships out of band by setting `state: "draft"`. For the catalogue this means:

1. A held story's shelf episode leaves the bundle at the next build: its map marker count drops, and an empty cell story list is unreachable.
2. **Nothing a learner earned is removed.** Cards, stars and found notes stay, and the story's card stays owned and visible.
3. A corrected fact regenerates the card's back text from the same `facts[]`, so card and story never disagree.
