# content/stories/

Story mode tales: one JSON file per story, the source of truth for every heritage story in the app (F-STORY-001, decisions D4 and D14). The app never reads these files directly: `scripts/build-stories.mjs` turns the `ready` ones into `apps/mobile/src/content/stories.generated.ts`.

Specs: `docs/specs/F-STORY-001-story-schema-pipeline.md` (schema §3.2, facts and coverage §3.3, inline terms §3.4, traditional tales §3.5, verification §3.6, versions and corrections §3.7, validators §3.8, bundle §3.9). The reader and Sources screen are F-STORY-002, checks F-STORY-003, the shelf F-STORY-004. Romanization policy: `docs/specs/F-CNT-002-romanization-policy.md`.

## Files

```
content/stories/
  README.md                       this file
  <slug>.json                     one story; <slug> is the id without "story:" (story:sejong-new-letters -> sejong-new-letters.json)
  research/                       provenance, never bundled and never validated as a story
    <cluster>.final.json          the verified research file the importer reads
    <cluster>.signoff.md          final-pass sign-off, corrections, remaining uncertainty
    <cluster>.changes.md          every checker issue and how it was resolved
content/i18n/{es,ko}/stories.json translations (overlays), beside the story, never inside it
```

The directory is flat: `theme` is a field, not a folder. The file name must equal the slug (a test checks it). Test fixtures, valid and deliberately invalid, live in `packages/content-schema/src/__fixtures__/story/`, never here: `scripts/validate-content.mjs` walks all of `content/`.

## Story states

| `state` | Meaning | Bundled |
|---|---|---|
| `draft` | Imported or being authored. Authored-later fields may be empty (`title.romanization`, `title.en`, `keywords[].romanization` / `en`, `captionEn`, `art` / `artPending`, `explainEn`, `hoyaIntroEn` / `hoyaOutroEn` (both required once the story has a `shelf` block)). Every fact, source, coverage, Hangul-zone and length rule applies already: a draft may be incomplete, never wrong. | No |
| `ready` | `StoryReadySchema` passes in full. | Yes |

`ready` does not mean visible. The shelf (F-STORY-004) shows a story only when `review.language` is `native-reviewed`, `review.culture` is `culture-reviewed`, and `verification.passes` is at least `MIN_VERIFICATION_PASSES` (3).

## Authoring workflow

1. **Import (one time per research cluster).** `node scripts/import-heritage.mjs --src content/stories/research --dry-run` prints the report; `--write` writes `<slug>.json` drafts. The importer reads only `<cluster>.final.json` and never overwrites an authored story, with two explicit exceptions: `--force-draft` replaces a story that is still a draft at `contentVer` 1 (it discards any hand edits in that file), and `--allow-unfinal` also imports a non-final research file (`.revised.json` / `.draft.json`) with `verification.passes` 0. Its report is the author's to-do list: undefined terms, missing title romanizations, approximations, advisories to confirm.
2. **Author the draft.** Title romanization and gloss, term glosses, captions, check explanations, `approximations`, art (or `artPending: true`, only when the owner accepts a text-only tile), and the traditional-tale notes. Never retype a source: facts and sources come from the research file.
3. **Mark it `ready`** when `StoryReadySchema` passes. Regenerate the bundle (`node scripts/build-stories.mjs`) and commit both files.
4. **Review sign-offs** (separate PRs): a native Korean reader sets `review.language: "native-reviewed"`, a culture reviewer sets `review.culture: "culture-reviewed"`, each with `reviewedBy` (initials) and `reviewedAt`. A reviewed value without both is `review-unsigned`. The story has one `reviewedBy` / `reviewedAt` pair, so it records the most recent sign-off; each reviewer therefore also appends one line to `verification.notes` (initials, date, and which review: language or culture) and states the same in the PR description, so the earlier sign-off is never lost.
5. **Shelf and card blocks** (`shelf`, `card`) follow F-STORY-004 and F-STORY-006 once the story is reviewed and verified.

## Rules in brief

The full list with rule ids is F-STORY-001 §3.8; `lintStory` (`packages/content-schema/src/story-lint.ts`) enforces everything marked as a rule.

- **Every claim cites a fact (D14).** A scene without `factIds` is an error unless it is a `framing` scene (at most 2 per tier and 25 % of its scenes, with no digit, no number word and no documented term).
- **Every fact is sourced.** At least one source on an authoritative host (`.go.kr`, `unesco.org`, `encykorea.aks.ac.kr`, `itkc.or.kr`, `snu.ac.kr`); two or more sources when `claimEn` contains a digit; `https` only; `accessed` is a real past date. A host outside `SOURCE_HOST_ALLOWLIST` (`packages/content-schema/src/story-sources.ts`) is a warning; adding a host is a one-line, reviewed PR.
- **Numbers echo their facts.** Every numeral in `narrationEn` appears in a cited fact's `claimEn`, or is covered by an `approximations` entry that says how it was derived. "Almost 600 years ago" needs an approximation with `timeRelative: true`, which the yearly review re-checks.
- **No statement beyond the facts (C6).** Software cannot prove it. A reviewer compares every changed sentence with the facts it cites, and the PR template's claims-audit box records that they did.
- **Korean in English text is a token.** Narration, culture notes and check prompts name a Korean term as `{kw:<keywordId>}`, never as Hangul; the reader renders it with romanization and a gloss. A translation must keep exactly the same tokens.
- **Reference zone.** Hangul is allowed in `facts`, `referenceDisplay`, `authorNotes`, `learningGoalsEn`, `verification` and `errata` of files in this directory only. Fields a learner reads stay strict.
- **Traditional tales say so.** A tale kind has `origin.type: "traditional"` (or `"adapted"`), its first scene names it as a tale, it carries `origin.noteEn` and `retellingNoteEn`, and its in-the-tale facts have `scope: "in-the-tale"` and no four-digit year.
- **Romanization** is Revised Romanization of the pronunciation (F-CNT-002 §3.1): no hyphens, no apostrophes, lower case except for names (`sagwa`, never `sa-gwa`; `Jang Yeongsil`, never `Jang Yeong-sil`). The romanization suites check every value; a draft's empty romanization is a warning, a `ready` story's is an error.
- **Words.** "Hangul", not "Hangeul", in English prose (proper-name romanizations such as `hangeullal` stay). No age words; a content note for grown-ups goes in `review.advisory` with `advisoryNoteEn`, never an age. No banned learner words (`packages/i18n/src/banned-words.json`).
- **Checks** cite a fact, vary the answer position, and have an `explainEn` written from the cited fact.

## QA process

The full process is `docs/workflows/story-content-qa.md` (F-STORY-005 §3.9 and §3.10). In short:

- **Eight passes, in order, none skipped**: 0 author, 1 two independent checkers, 2 reviser, 3 a third independent verifier (`verification.passes: 3`), 4 import, 5 native language review, 6 culture review, 7 publish.
- **Three lint rules back it** (errors): `narration-copies-source` (8 or more consecutive words of any learner-facing English field also in a `quoteOrLocator`: restate, never paste), `narration-national-treasure-number` (no designation number such as "National Treasure No. 70" outside claims and source titles), and `story-shelf-needs-reviewers`.
- **The shelf gate.** A `shelf` block needs `verification.passes` of at least 3, both review sign-offs (`native-reviewed` and `culture-reviewed`) with `reviewedBy` and `reviewedAt`, and `shelf.minutes` equal to `minutes`.
- **Images.** Art is SVG drawn in-house; every PR answers the template's "Image rights" line.

## Versions

- `contentVer` (integer, starts at 1): bump it for **any** change to a `ready` story's learner-visible or source content (narration, keywords, checks, facts, sources, art, culture notes, titles). Changes only to `errata`, `verification`, `review` or `shelf` need no bump. Draft edits need no bump; a story keeps its current `contentVer` when it turns `ready` and is bumped from then on.
- `fact.rev` (integer, starts at 1): bump it when that fact's `claimEn`, `claimKo` or any of its `sources` changes.
- Versions never go down. A fact is never deleted without an erratum of `kind: "removal"` naming it. A new story file starts at `contentVer: 1`.

`scripts/check-story-versions.mjs` enforces these rules in CI (`content-validation.yml`) against `origin/main`, and keeps errata append-only. A hold (`ready` to `draft`, nothing else) needs no bump; when the held story turns `ready` again it is compared with its last `ready` version, so edits made while it was held still need their bumps and errata. A `ready` story file is never deleted or renamed (the check reports `story-removed`): hold it instead. Run it before you push: `git fetch origin && node scripts/check-story-versions.mjs`.

The Sources screen shows "Story version N" and the date the facts were last checked, so every version is visible to a grown-up.

## Correcting a fact

When a fact in a shipped story turns out to be wrong, fix it in the open: a dated correction the learner can see, never a silent edit.

1. **Report.** Anyone (owner, reviewer, a grown-up through support) names the story, the scene and the reason. Triage within one working day and set the severity:
   - **S1**: a wrong or misleading statement of fact, or a safety or sensitivity problem.
   - **S2**: imprecise but not wrong (rounding, ambiguous wording).
   - **S3**: typo or style.
2. **Verify** against at least two authoritative sources (two different pages, not the same page twice). Decide whether to **correct** the statement, **soften** it (state only what the sources agree on, as the research files already do where sources disagree), or **remove** it.
3. **Fix it in one content PR:**
   - list every place that cites each changed fact id and update or remove each one: `scenes[].factIds` (and the narration of those scenes), `scenes[].approximations[].factIds`, `checks[].factIds` (prompt, options, correct answer and `explainEn`), `cultureNotes[].factIds`, `card.factId`, and `summaryEn`, `hoyaIntroEn` / `hoyaOutroEn` where they repeat the claim. A check that still grades the old value as correct is the same error as the narration;
   - edit the narration and the fact or facts;
   - update or delete the story's translated entries (the `story:<slug>` entries in `content/i18n/es/` and `content/i18n/ko/`) for every field changed above, in the same PR. The overlay build has no staleness check, so an outdated translation keeps showing the old claim; until a translation is redone, delete the entry so the English text shows instead;
   - bump each changed fact's `rev` and the story's `contentVer`;
   - append an erratum to `errata`:

     ```json
     {
       "id": "e1",
       "date": "2026-11-02",
       "kind": "correction",
       "factIds": ["f3"],
       "summaryEn": "We corrected the year the printing began.",
       "fixedInVer": 3,
       "show": true
     }
     ```

     `kind` is `correction`, `clarification` or `removal`. `date` is the day the fix merges. `fixedInVer` equals the new `contentVer`. `summaryEn` uses plain words and blames no one. `detailEn` (optional, maintainers only) may hold the longer story. Set `show: false` only for a cosmetic clarification;
   - update `verification.checkedAt` and `verification.notes` if you re-read the sources;
   - regenerate the bundle (`node scripts/build-stories.mjs`);
   - in the PR description, quote the old sentence and the new one for the narration and for every citing check, culture note and translation you changed, list the sources you checked, and tick the claims-audit box.

   For S1, if the fix cannot be made right away, set `state: "draft"` in the same PR. A draft is not bundled, so the next build removes the story and the shelf hides it cleanly. A hold changes only `state`: keep the file, its id, and its `shelf` and `card` blocks. The bundle keeps the card of a held story (no fact, no citation) for learners who already own it (F-STORY-006 §3.8), and it can do that only while the file still has both blocks under the same id.
4. **Release.** S1 ships out of band: on the web app a deploy reaches learners through the existing update banner (the service worker applies it on tap); native builds pick it up in the next store release, because there is no over-the-air content channel. S2 and S3 ride the next normal release.
5. **What learners see.** Their progress does not change: quests, stars, cards and bookmarks are keyed by ids, and a changed scene count is absorbed when the story resumes. The Sources screen lists every erratum with `show: true` under "Corrections" with its date and `summaryEn`, and puts an "Updated" tag next to the corrected fact. There is no notification, no pop-up and no "you were taught something wrong" screen, and nobody is asked to redo a story.
6. **Audit trail.** `git log content/stories/<slug>.json` plus the erratum list. Errata are append-only: an existing erratum is never removed and its `id`, `date`, `kind` and `factIds` never change.

## Source links

Source pages move. A monthly link check (`.github/workflows/source-links.yml` running `scripts/check-source-links.mjs`, also started by hand from the Actions tab) opens an issue labelled `source-links` listing broken links (a later run updates that issue while it is open); it never fails a PR, because several authoritative hosts block automated requests (those hosts are listed, with a reason, in `scripts/source-link-ignore.json`). A dead link does not make a fact wrong: re-verify, replace the source (bump the fact's `rev`), or leave it. Re-open a story's sources whenever you touch its facts.

## Checks to run before a PR

```bash
corepack pnpm --filter @hangul-route/content-schema test story-content      # schema + lint over every story
corepack pnpm --filter @hangul-route/content-schema test romanization       # romanization suites
node scripts/validate-content.mjs                                           # language policy (F-CNT-001)
node scripts/build-stories.mjs                                              # regenerate the bundle
node scripts/build-stories.mjs --check                                      # bundle matches the JSON (CI)
node scripts/build-stories.mjs --report                                     # sizes and budget (CI)
node scripts/build-overlays.mjs --check                                     # translations still match (CI)
```

Lint warnings print and do not fail; errors fail the suite. Set `HANGUL_ROUTE_TODAY=YYYY-MM-DD` to run the date rules (`source-stale`, `source-accessed-invalid`) as of a fixed day.

A PR that changes any `narrationEn` or `facts` ticks the PR template's claims-audit line: every sentence I changed maps to a fact I re-read.
