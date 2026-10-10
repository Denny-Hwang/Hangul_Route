# REVIEW-1 — independent review of six Hangul Route specs (2026-10-10)

Reviewed against `main` at `332e199` (PRs #91-#97 merged; working tree at `/Users/ggoboogi/workspace/Hangul_Route`, read-only). All edits were made in place in `specs-out/`; this file is the log. Companion file: `TELEMETRY-NAMES.md`.

## 1. Result

| Spec | Status | Why |
|---|---|---|
| F-I18N-001 UI locales | **ready** | PR 0-4 have no external dependency; Spanish/Korean review is gated later (PR 15/16) and the locales ship hidden until then |
| F-LEARN-001 all-ages onboarding | **ready** | PR 1-6 implementable; counsel review gates the store release and the web legal text, not the code |
| F-CNT-002 romanization policy | **ready** | self-contained; owner confirmation of `예리` has a stated fallback |
| F-QUEST-002 Discover / Check / full Stage 1 | **ready** (Q-9 blocked) | Q-1..Q-8 and Q-10 can start; Q-9 waits for F-STORY-006's award engine (interface in §3.8); content PRs need native-speaker review before reaching learners |
| F-STORY-003 story checks / Story Order v2 | **draft** | its schema and reader dependencies, F-STORY-001 and F-STORY-002, are not specs in `docs/specs/` yet and every name this spec uses from them is an assumption (`Tier.checks`, `sequenceSceneIds`, `StoryReader` params, `story-read` ref grammar). Startable now: PR 3.3 `ChoiceCard`, 3.5a, 3.6, 3.8 |
| F-STORY-004 story shelf / Home card / Culture notes | **draft** | same dependency on F-STORY-001/002 (`Story`, `review`, `facts[]`, `cultureNotes[]`, `Episode.placement`, reader route). Startable now: PR 4.2 `content-access.ts`, 4.1 grid-only selectors |

Both `draft` specs carry the blocker as a block directly under the title; flip to `ready` once F-STORY-001/002 are ready and the names are confirmed.

## 2. Counts

- **136 logged changes** (table in §6): 58 code-truth fixes, 46 cross-spec consistency fixes, 12 feasibility / PR-size fixes, 11 quality fixes, 7 charter fixes, plus two wireframe files written and the status lines. (A few cite-only adjustments were applied without a row of their own.)
- **Citations checked**: about 470 `file:line` citations parsed mechanically from the six specs (each resolved to a file in the current tree and the cited line printed and read): I18N 108, LEARN 125, CNT-002 56, QUEST-002 92, STORY-003 41, STORY-004 44. Well over the 30 required; about 60 were stale or wrong and were fixed (the clusters: everything PR #95 moved in `HomeScreen`, `JourneyScreen`, `PinEntryScreen`, `tabs.tsx`, `Button.tsx`; everything PR #94 moved in `ResultsScreen`, `StorySequenceGame`, `quest-run-store`; STORY-003/004 had been written at `c89a903`, before #94-#97).
- **Stale claims removed** (examples): "rescue code is two words" (now four words + six digits, PR #96), "Home profile entry is an unlabelled circle" (labelled "Profile" with accessible name "Profile and settings", PR #95), "wrong taps count as failures / one failed round per wrong tap" (first-try scoring, PR #94), "tab bar is a fixed 84" (`tabBarMetrics`, PR #95), "learner names must be English letters" (widened, PR #97), "PR #94 and #95 are in review", "71 of 72 research checks have the answer first" (29 of 72 in the revised/final heritage files), "the leave-a-class action may be PIN-gated" (it is not), "a profile-update route may exist" (it does not).
- **Open owner questions**: 9 (§8), all product / commercial / legal.

## 3. One owner, one name — decisions applied across the specs

| Thing | Single owner (spec / PR) | Name / shape everywhere | What was inconsistent |
|---|---|---|---|
| `ProfileSettingsSchema` / `DeviceSettingsSchema`, keys `device:settings` and `settings:${profileId}` | F-I18N-001 PR 1 (`schemas/locale.ts`) | fields `uiLocale?`, `romanizationMode` (`'always'`\|`'tap'`, default `'always'`) | I18N said F-LEARN-001 "may add optional fields"; LEARN keeps `learnerType` on `ProfileSchema`. Now: LEARN adds none; later specs (readToMe, placement language) extend additively |
| `learnerType` | F-LEARN-001 (`ProfileSchema.learnerType?`, device-local, never in `LearnerRegister`) | `'child'`\|`'self'`; level read through `levelOrder(id)` | F-STORY-003 tested the raw id `'5-7'`; `levelOrder()` added |
| Learner-name validation | **shipped in PR #97** (`profile-model.ts:41-49`) | `'unsupported-character'` | I18N §3.9 and LEARN §3.2.1 still treated it as work to do |
| Romanization visibility | F-I18N-001 (`romanizationShown(mode, revealed)` in `packages/i18n`; setting in `ProfileSettings`; always-visible Profile switch) | `romanizationMode` | STORY-003 had its own definition (now an interim copy that becomes a re-export); QUEST read a setting nobody could set while only English ships (switch is now always shown) |
| `soundHint` | base English: F-QUEST-002 (`JamoSchema.soundHint`, Appendix A); es/ko overlays: F-I18N-001 | `soundHint` | I18N described it as overlay-only |
| `KoreanText` component | F-I18N-001 PR 4 (depends only on PR 0; takes `romanizationShown` and a caller-supplied `accessibilityLabel`) | props in I18N §3.5 | three other specs consumed it with no owner or fallback; `ChoiceCard` now draws Korean through it |
| `KoText` zod shape | one file `schemas/ko-text.ts`, full set `{ ko, romanization, en, spokenKo?, audioRef?, syllables? }`; created by the first PR that needs it (F-STORY-001, F-VOC-001 or F-QUEST-002 Q-1) | `KoTextSchema` | STORY-003 planned `story-text.ts` with a smaller shape; CNT-002's `hoyaLineKo` is a pick of it |
| `hoyaLineKo` | F-CNT-002 (field PR 2a, data PR 2b) | `{ ko, romanization, en }` | QUEST cited a wrong section and said the value was "to be decided" |
| `storySteps[].romanization` + the 12 values | F-CNT-002 (PR 2a field, 2b values) | `romanization?` | STORY-003 and CNT-002 both claimed it ("whichever lands first") |
| `ChoiceCard` | F-STORY-003 PR 3.3 (generic; no F-STORY-001 dependency) | props in STORY-003 §3.4 | QUEST said "Q-3 adds it if absent" |
| `MinigameHost` | F-QUEST-002 Q-3a (reuse F-VOC-001's file if it landed first) | `{ mode, answer, complete }` | STORY-003 games keep direct `answerRound` calls (stated) |
| `isFreeContent(kind, id)` | F-STORY-004 PR 4.2 | one registry; flags `contentGatingEnabled` (off) | consistent; D5 holds: no new gating, no "Premium" where nothing is enforced, QUEST adds none |
| Round keys | `logic/round-keys.ts` (PR #94): `sequenceRoundKey`, new `checkRoundKey` | slot number / `check:<id>` | STORY-003 invented `seq:<n>` |
| Grid/shelf split `gridEpisodes` | F-STORY-004 PR 4.1 | `isGridEpisode`, `gridEpisodes`, `shelfEpisodes` | QUEST's `nextQuestAfter` and STORY-004's selectors both rewrote the Journey cursor |
| Hoya fur variants | F-LEARN-001 PR 3 | eight flat tokens `colors.hoya.fur{Blue,Green,Purple,Pink}[Dark]` + `hoyaVariantColors()` | LEARN planned a nested `hoyaVariant` object that PR #95's `tokens-parity.test.ts` would not see |
| Avatar name `례이` -> `예리` | F-CNT-002 C9 = F-LEARN-001 L12 | `Yeri` | consistent; labels now keyed by `AvatarKind` for translation |
| `packages/i18n`, `content/i18n/`, `content/stories/`, `content/vocab/`, `scripts/` in CLAUDE.md §2 | F-I18N-001 PR 0 (single charter edit) | — | I18N listed two of the four and credited D8; QUEST said "none is added" |
| Telemetry names | `TELEMETRY-NAMES.md` | convention: `<unit>.start/complete`, `<thing>.finished`, past-tense actions, namespaced | 7 names renamed (26 new names, 0 collisions) |
| PIN rules | F-LEARN-001 (`gateRequired`, `pinPadLayout` reuse) | STORY-004's locked tile uses the same gate helper; I18N's language picker stays ungated | STORY-004 always sent the tile to `PinEntry`; LEARN invented a 3-column pad already solved by PR #95 |

## 4. Global PR order (cross-spec)

Spec-local PR ids are kept (I18N `0-17`, LEARN `1-8`, CNT `1-4`, QUEST `Q-1..Q-11`, STORY-003 `3.0-3.8`, STORY-004 `4.0-4.8`); every cross-spec dependency in the specs is now written with the spec name.

1. **Charter**: I18N PR 0 (CLAUDE.md §2 dirs, PR template, content-skill wording).
2. **Schemas and tokens (parallel, one shared `telemetry.ts` / `index.ts` — merge serially)**: I18N PR 1; LEARN PR 1 (+ type-unification commit); CNT PR 1; QUEST Q-1 (`ko-text.ts`, discover/check, listen-pick/pic-word, telemetry); STORY-004 PR 4.2 (`content-access.ts`); STORY-003 PR 3.6 (monotonic stars); I18N PR 4 (`KoreanText`).
3. **Foundations**: I18N PR 2, 3; LEARN PR 2, 3 (tokens + `ProfileAvatar`), 4a (`PinPad`); CNT PR 2a; QUEST Q-2; STORY-003 PR 3.0 + 3.3 (`ChoiceCard`).
4. **Screens that touch the same files**: LEARN PR 4b (new CreateProfile) before I18N PR 5; CNT PR 2b (content) before STORY-003 PR 3.5a is shown to learners; QUEST Q-3a/3b, Q-4, Q-5a/5b; LEARN PR 5-7.
5. **Needs F-STORY-001/002 (not yet ready)**: STORY-003 PR 3.1, 3.2, 3.4a/b, 3.5b, 3.7; STORY-004 PR 4.1, 4.3a/b, 4.4-4.8.
6. **Content**: QUEST Q-6a..Q-8 (needs native review), CNT PR 3 (enforcement turns on after the data is clean), PR 4.
7. **Needs F-STORY-006**: QUEST Q-9. **Needs backend deploy first**: QUEST Q-10a then Q-10b.
8. **Extraction and translation**: I18N PR 6a..11c, 12-14, then 15 (Spanish), 16 (Korean), 17 (docs).

## 5. Files several specs edit (expect mechanical rebases)

`packages/content-schema/src/schemas/telemetry.ts` + its test and `src/index.ts` (all six) · `apps/mobile/src/logic/minigame-config.ts` (CNT 2a/2b, QUEST Q-3a/Q-6a..Q-8, STORY-003 3.2) · `logic/homework/mission-builder.ts` (QUEST Q-2, STORY-004 4.1/4.4, I18N 6b) · `screens/onboarding/CreateProfileScreen.tsx`, `screens/profile/ProfileScreen.tsx`, `screens/parent/PinEntryScreen.tsx` (LEARN 4a/4b/6, I18N 5) · `screens/home/HomeScreen.tsx` (I18N 6a, LEARN 5, STORY-004 4.4) · `screens/results/ResultsScreen.tsx` (QUEST Q-5b/Q-9, STORY-003 3.7, STORY-004 4.4, I18N 6b) · `screens/quest/QuestPlayerScreen.tsx` (QUEST Q-5a, STORY-004 4.4, I18N 7a) · `screens/minigames/MinigameScreen.tsx` (QUEST Q-3b, STORY-003 3.4a) · `store/quest-run-store.ts` (STORY-004 `beginQuest` start index) · `store/bootstrap.ts` (I18N PR 3 locale hydrate, STORY-004 4.3a story-store hydrate) · `content/quests.ts`, `content/episodes.ts` (QUEST Q-6a..Q-8, STORY-004 shelf episodes, CNT 2b) · `screens/episode/EpisodeDetailScreen.tsx` (QUEST Q-5b, STORY-004 4.6) · `packages/design-system/src/tokens.ts` + `design/tokens/colors.v1.md` (LEARN 3) · `apps/web/src/app/**` page paths (I18N 11b moves pages; `audience-copy.test.ts`, `landing-layout.test.tsx`, `landing-layout.spec.ts` move with them).

## 6. Change log (issue, file, fix)

Kinds: code truth = a citation or claim checked against the tree and corrected; cross-spec = two specs disagreed; feasibility / PR size = not implementable or not reviewable as written; quality = testable acceptance, status, missing pieces; charter = CLAUDE.md rule.

### F-I18N-001-ui-locales.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 1 | code truth | Stale line cites after PR #95 (HomeScreen streak :172, tabs :36-38) | Updated to HomeScreen.tsx:188 and tabs.tsx:38-40 |
| 2 | code truth | COPY cite stale (copy.ts 59 keys, :2-61, allCopyStrings :62-64) | Updated to copy.ts:2-62, about 60 keys, allCopyStrings :64-66 |
| 3 | cross-spec | Learner-name validation (F-I18N-001 §3.9) already shipped in PR #97 but spec still listed it as a bug / to-do | Section 1 bullet rewritten as shipped, citing PR #97; only the inline English hint remains for the dictionary move |
| 4 | cross-spec | §3.9 described the name rule as work to do | Marked DONE (PR #97); remaining work limited to moving the two hint strings into the dictionary |
| 5 | feasibility / PR size | Banned-word matcher relied on \p{L} and look-behind regex, unverified on Hermes (RN 0.76) and unlike PR #97's approach | Matcher specified as lower-case + split on explicit ranges + whole-token compare; no \p, no look-behind; Node tests unchanged |
| 6 | cross-spec | "ProfileSchema is the wire shape in sync.ts:83" was wrong (it is the BackupFile profile); settings ownership between F-I18N-001 and F-LEARN-001 left as "may add fields" | Cite corrected; ownership made explicit: I18N owns ProfileSettings/DeviceSettings, LEARN adds none (learnerType stays on ProfileSchema), later specs extend additively |
| 7 | code truth | Fixed tab-bar height of 84 is stale after PR #95 | Rewritten to tabBarMetrics (64 pt row) |
| 8 | code truth | Button.tsx minHeight cite moved after PR #95 | Button.tsx:80 |
| 9 | code truth | Landing width list cite wrong; PR #95 added a mobile layout spec that should be reused | Cites fixed, mobile helper named |
| 10 | cross-spec | Telemetry names locale.change / romanization.mode_change broke the past-tense convention used for discrete actions | Renamed locale.changed, romanization.mode_changed; convention stated; list consolidated in TELEMETRY-NAMES.md |
| 11 | code truth | Telemetry test (exact sorted list) not mentioned; shared-file contention across specs | Named the exact-list test and the mechanical-rebase note |
| 12 | code truth | Spec invented reason codes (locked/building/not-reached) that do not match gating.ts (unknown-quest, episode-not-shipped, stage-locked) | Rule 3 and acceptance example use the real GateRejection codes |
| 13 | code truth | Cite range for the gating test off by a few lines | gating.test.ts:63-71 |
| 14 | feasibility / PR size | Route-group verification was listed as unverified and the expected output path (out/es/index.html) was wrong; moving pages would silently break path-based tests | Recorded the prototype result (out/es.html, lang attribute), fixed the path, listed the three tests that must move with the pages |
| 15 | cross-spec | KoreanText had no way to receive a localised label although design-system must not depend on packages/i18n | Added accessibilityLabel prop (caller-supplied) |
| 16 | cross-spec | KoreanText used by three other specs with no declared owner / consumer list | Owner and consumers stated |
| 17 | cross-spec | soundHint described as an overlay-only field while F-QUEST-002 adds an English base field of the same name | One field: base English owned by F-QUEST-002, es/ko overlay replaces it |
| 18 | cross-spec | Jamo overlay table did not list the base soundHint source | Source column extended |
| 19 | feasibility / PR size | PR 6, 7, 8, 10b and 11b were sized L and bundled 6-12 screens or the route-group move plus metadata and banner (not reviewable as one PR) | Split into 6a/6b, 7a/7b, 8a/8b, 10b/10c, 11b/11c with explicit dependencies; PR 4 (KoreanText) now depends only on PR 0; cross-spec order paragraph added |
| 20 | cross-spec | Cross-spec PR order not stated (KoreanText consumers, CreateProfile edited by two specs, storySteps romanization edited by two specs) | Cross-spec order paragraph under the PR table |
| 21 | cross-spec | Out-of-scope line said F-LEARN-001 adds optional fields to ProfileSettings (contradicts LEARN decision L2) | Corrected: strings only; learnerType on Profile |
| 22 | charter | CLAUDE.md §2 edit listed only packages/i18n and content/i18n; content/stories and content/vocab (D4) and the undocumented scripts/ dir were missing, and approval wording was ambiguous (D8 is only the spec-id list) | §9 now lists all four dirs + scripts/, names D2/D4 as the approvals and makes PR 0 the single owner of the CLAUDE.md §2 edit |
| 23 | charter | Spec attributed the packages/i18n approval to D8, which only assigns spec ids | Approval attributed to D2/D4; D8 limited to the id |
| 24 | quality | D2 opt-in romanization switch had no guaranteed place in the UI (the Language card is hidden while only English ships), so QUEST-002/STORY-003 would read a setting nobody can set | Switch specified as always visible in the Profile card, default off, per profile |
| 25 | charter | Third hand-rolled storage guard on web | Reuse/extract the session.ts guard; documented as the packages/hooks stand-in |
| 26 | cross-spec | Test row for name rule listed as new work | Marked shipped (PR #97) |
| 27 | code truth | HoyaBubble cite pointed at the role line, not the hard-coded label | HoyaBubble.tsx:86 |
| 28 | code truth | speechLang es-US not accepted by the current SpeakOptions type | Noted widening owner |
| 29 | code truth | tabs.tsx tab-label cite off by two after PR #95 | `:40-42` |
| 30 | cross-spec | I18N said pillar names are rendered with KoreanText while F-LEARN-001 L12 says they stay out of the UI; avatar labels had no dictionary home | Reconciled; labels keyed by AvatarKind in the dictionary |
| 31 | feasibility / PR size | Hook outside the mobile test lanes with no stated coverage route | Coverage route stated |

### F-LEARN-001-all-ages-onboarding.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 32 | code truth | PinEntryScreen cites stale after PR #95 (:48) | `:61` |
| 33 | code truth | Claim that Home ignores the avatar is stale (PR #95 ring by avatarTheme) | Bullet rewritten with the post-#95 behaviour and lines |
| 34 | code truth | F-LEARN-001 described PR #95 as open / "unlabelled circle" and its Profile label as pending | Rewrote as merged: label, aria name, Screen scroll, pin-pad-layout all exist; only the ring colour is changed here |
| 35 | cross-spec | §3.2.1 treated the accented-name rule as pending in F-I18N-001 ("leaves validateDisplayName untouched if PR 2 lands first") although PR #97 shipped it | Rewritten as already shipped; F-LEARN-001 only keeps using the single rule and its tests |
| 36 | code truth | PinPad spec invented a 3-column / 64 dp layout and cited PinEntryScreen label lines that moved; PR #95 had already shipped a responsive PIN pad (pin-pad-layout.ts) | PinPad now extracts the existing grid and reuses pinPadLayout/pinPadBudget; layout.spec.ts named as regression guard; label lines updated |
| 37 | code truth | Stale PinEntryScreen cite | `:126` |
| 38 | code truth | Forgot-PIN screen did not account for the four-word Rescue Code of PR #96 (and the wireframe/placeholder shape) | Field spec names both shapes and the four-word placeholder |
| 39 | code truth | Stale Journey cite | `:72` |
| 40 | code truth | Stale Home cite | `:222` |
| 41 | code truth | avatarTheme from PR #95 would remain as dead code; borders hard-coded | Delete in PR 5; ring width via borderWidth token |
| 42 | code truth | Home row described PR #95 as pending | Row states the merged behaviour and what changes |
| 43 | code truth | Stale design-preview cite | `:372` |
| 44 | code truth | §3.7 conditioned on PR #95 not being merged yet | Rewritten as merged; PR 5 swaps glyph/ring only |
| 45 | code truth | Open assumption "does a profile-update route exist?" can be settled from the tree | Verified none exists; screen copy and follow-up stated |
| 46 | quality | Privacy text called the onboarding events "anonymous" although they carry profileId | Reworded to pseudonymous (legal accuracy) |
| 47 | code truth | join-code copy left a verification TODO | Verified against SpacesCard |
| 48 | code truth | Six existing Playwright specs onboard through the old form (name + one checkbox) and would break with the new first-run flow; not mentioned | PR 4 and tests table now require a shared onboarding helper and updating the six specs |
| 49 | feasibility / PR size | PR 4 bundled PinPad extraction, a full form rewrite, telemetry and e2e (not reviewable as one PR); PR 5 and 3 referenced obsolete tokens/PR #95 state | Split into 4a (pure refactor) and 4b; PR 3 now adds hoya.* tokens; PR 5 deletes avatarTheme |
| 50 | cross-spec | Coordination paragraph still said F-I18N-001 owns the (unshipped) name rule | Updated |
| 51 | cross-spec | LEARN named a "default story tier" as a consumer; F-STORY-003 actually consumes the level only for the Read-to-me default | Consumer list corrected |
| 52 | cross-spec | Other specs (F-STORY-003) branch on the raw id 5-7 for "Pictures first"; no helper existed | Added levelOrder() so consumers never test the age-like id |
| 53 | quality | Test row said "eight names" but one of the eight in the table (onboarding.started) already exists | Corrected to seven new names |
| 54 | charter | No Given/When/Then block (charter spec format) | Added §3.14 with nine GWT behaviours |
| 55 | charter | Age-5-11 framing survives in two code comments the spec set did not list | Reword added to PR 3 / a one-line commit |
| 56 | feasibility / PR size | hoya-variant.test.tsx cannot render an RN component in design-system's node-only vitest setup | Replaced by the pure-helper test + design-preview coverage |

### F-CNT-002-romanization-policy.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 57 | code truth | Stale cite after PR #94 | `:140` |
| 58 | code truth | QuestPlayerScreen cite pointed into a JSX tail | `:147-151` |
| 59 | quality | a11yRomanization() was mentioned in §3.3 with no file, signature or test | Added a11y.ts to the module list |
| 60 | cross-spec | a11yRomanization consumer path unclear next to KoreanText (design-system takes a caller-supplied label) | Linked to KoreanText accessibilityLabel |
| 61 | cross-spec | Two specs (F-CNT-002, F-STORY-003) both claimed to add storySteps[].romanization and the same 12 values ("whichever lands first") | CNT-002 is the single owner; STORY-003 changed to consume |
| 62 | cross-spec | Rendering gap (TapRespond drops romanization) was left "owned by F-QUEST-002/F-AUDIO-004" but neither spec contains it, so nobody owned a charter violation | CNT-002 PR 2a fixes TapRespond; VoiceEcho stays with F-AUDIO-004 (flag off) |
| 63 | cross-spec | Test would break when F-QUEST-002 retires nine of the twelve story steps | Test described as a rule over whatever storySteps exist |
| 64 | feasibility / PR size | PR 2 bundled schema changes, rendering changes, ~65 data lines, 24 example words and docs (hard to review); refinements would fail before data was clean | Split into 2a (additive schema/rendering) and 2b (content fixes then refinements) |
| 65 | code truth | Wrong section reference (§3.6 is the computed display) | §3.5 |
| 66 | cross-spec | hoyaLineKo defined as a fourth ad-hoc {ko, romanization, en} shape next to KoText definitions in F-STORY-003 and F-QUEST-002 | One shared KoTextSchema file; hoyaLineKo is a pick of it |
| 67 | cross-spec | New Hangul-bearing files from F-QUEST-002 would trip the coverage check with no one told to register them | Registration duty stated; QUEST-002 gets the matching line |
| 68 | charter | No Given/When/Then block (charter spec format) | Added §3.10 with nine GWT behaviours |

### F-QUEST-002-discover-check-stage1-complete.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 69 | code truth | Verified-at commit predates PR #95-#97 | Updated to 332e199 and re-read |
| 70 | code truth | JourneyScreen "Premium" pill cite moved to :100 after PR #95 | Updated 3 cites |
| 71 | cross-spec | Telemetry names discover.completed / check.completed / teaser.tapped / stage.completed / review.started / review.completed were un-namespaced (check.completed vs story.check.finished), and stage.completed broke the existing episode.complete / quest.complete convention | Renamed quest.discover_completed, quest.check_completed, quest.teaser_tapped, stage.complete, review.start, review.complete; consolidated in TELEMETRY-NAMES.md |
| 72 | cross-spec | romanizationMode source and the interim behaviour before F-I18N-001 lands were not stated | Source and interim constant stated |
| 73 | cross-spec | Wrong section reference (§3.6) and "value is F-CNT-002's to decide" although F-CNT-002 §3.7 already fixes it | Cross-reference corrected |
| 74 | quality | "Four shipped quests change symbols" did not match the table (three re-scoped, five rebuilt) | Counts aligned with §3.6 table |
| 75 | cross-spec | ChoiceCard could be created by two specs ("Q-3 adds it if absent") | F-STORY-003 PR 3.3 is the only creator; Q-3b depends on it |
| 76 | cross-spec | KoreanText consumer had no stated dependency or fallback | Dependency on I18N PR 4 stated |
| 77 | cross-spec | New Hangul-bearing files would fail F-CNT-002 coverage check unannounced | Registration duty added |
| 78 | feasibility / PR size | Q-3, Q-5, Q-6, Q-7 bundled a game, shared host, interim audio, a screen and content (not reviewable); Q-10 (Hangul Check) was needlessly blocked on F-STORY-006 via Q-9; backend/mobile mixed in one PR despite the server-schema-first rule | Split into Q-3a/b, Q-5a/b, Q-6a/b, Q-7a/b, Q-10a (backend, deploy first)/Q-10b; Q-10b depends on Q-8 only; ChoiceCard dependency explicit |
| 79 | code truth | Wrong section number for KoreanText in F-I18N-001 | §3.5 |
| 80 | cross-spec | Row claimed Stage 1 "becomes JSON-first if F-CNT-002 lands first" and that F-CNT-002 offers a "JSON export"; F-CNT-002 validates TS in place and generates nothing | Deviation from D4 stated honestly; claim removed |
| 81 | quality | Existing stage1.anchorAccuracy (average quest accuracy) next to the new stage1Anchor was not distinguished | Disambiguation added |
| 82 | code truth | playPrompt "unavailable" detection assumed onError is observable, but speak() routes onError to onDone | Spec now adds SpeakOptions.onError and states the current wiring |
| 83 | cross-spec | Quest 9 still uses a story-sequence scope but nothing tied it to the romanized storySteps / Story Order v2 owners | Cross-reference added |
| 84 | cross-spec | Both F-QUEST-002 (nextQuestAfter) and F-STORY-004 (grid-only selectors) rewrite the Journey cursor in mission-builder.ts with no stated owner of the grid filter | gridEpisodes owned by F-STORY-004 PR 4.1; QUEST-002 reuses it |
| 85 | quality | Readiness caveats (Q-9 blocked on F-STORY-006) were buried in §7 | Start-order note under the title |
| 86 | feasibility / PR size | Seven "component" test files (DiscoverStep.test.tsx, ListenPickGame.test.tsx, ...) cannot run: apps/mobile/vitest.config.ts includes only src/{logic,store,content,config,platform}/**/*.test.ts in a node environment, there is no RN renderer | Replaced by pure reducers/view-models under logic/ with unit tests (discover-flow, listen-pick-flow, pic-word-flow, quest-flow, review-flow) + two Playwright specs |

### F-STORY-003-story-checks-sequence-v2.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 87 | quality | Header claimed a drafted wireframe file that did not exist | Wireframe file written during review; header points at it |
| 88 | code truth | Written against c89a903, before PR #94/#95 merged | Re-verified at 332e199 |
| 89 | code truth | Claimed StorySequenceGame still fails one round per wrong tap (:59) and that quest-run-store has recordRound; PR #94 already fixed this | Bullet rewritten with the post-#94 behaviour and lines |
| 90 | code truth | Stated PR #94 and #95 were "in review and not on main"; both merged. Results description stale (text-only card banner) | Rewrote bullet with merged state and current Results lines |
| 91 | cross-spec | Two different KoText files/shapes (story-text.ts {ko,romanization,en,audioRef?} here vs ko-text.ts with spokenKo/syllables in F-QUEST-002) | One file ko-text.ts with the superset shape |
| 92 | cross-spec | storySteps romanization claimed as "new" here and in F-CNT-002 | Marked as owned by F-CNT-002 |
| 93 | cross-spec | The twelve legacy storySteps romanizations were specified (and a PR commit planned) in both F-STORY-003 and F-CNT-002 | F-CNT-002 is the single owner (field PR 2a, values PR 2b); F-STORY-003 only renders; PR 3.2 commit 2 dropped |
| 94 | code truth | Spec invented round keys check:/seq: ignoring the sequenceRoundKey helper PR #94 had already shipped | Reuse sequenceRoundKey; add checkRoundKey only |
| 95 | cross-spec | romanizationShown defined here while F-I18N-001 says its own package owns the single implementation | Declared interim copy that turns into a re-export |
| 96 | charter | ChoiceCard border "2" was a literal (tokens-only rule; borderWidth tokens exist), Korean options not tied to KoreanText, and reuse by other specs not declared | borderWidth.base, KoreanText, single-definition note |
| 97 | cross-spec | Read-to-me default keyed on the raw age-like id 5-7 | Keyed on levelOrder() (F-LEARN-001) |
| 98 | cross-spec | Spec said es-ES while F-I18N-001 fixes es-US with es-* fallback | Aligned with LOCALE_META |
| 99 | cross-spec | Overlap with F-CNT-002 correctness checks not delineated | Delineated |
| 100 | feasibility / PR size | PR 3.4 bundled check game, recap, MinigameScreen case, telemetry and e2e; ChoiceCard PR lacked KoreanText dependency; 3.5a was claimed independent but needs the romanization field | Split 3.4 into 3.4a/3.4b; 3.3 depends on F-I18N-001 PR 4; 3.5a depends on F-CNT-002 PR 2a; PR #94 dependency removed (merged) |
| 101 | cross-spec | Dependency list stale (PR #94 conditional, t() instead of useMessages, no CNT-002) | Rewritten |
| 102 | code truth | Stale Results cite (logic moved to results-award.ts in PR #94) | results-award.ts:39-48 |
| 103 | code truth | Results description conditional on PR #94 / stale lines | Updated to merged code |
| 104 | code truth | Counts were taken from draft files; revised/final files now exist and change the answer-position finding | Counts re-run on final/revised data |
| 105 | code truth | "71 of 72 answers at index 0" is stale (29 of 72 in revised/final data); the consequence text over-claimed | Updated number and softened consequence; shuffle kept as defence |
| 106 | code truth | Stale counts | 134 of 208 |
| 107 | code truth | Stale count | 174 |
| 108 | cross-spec | RoundSchema policy differed between STORY-003 (leave alone) and QUEST-002 (extend) without saying why | Rationale stated |
| 109 | feasibility / PR size | PR 3.0 (and through it ChoiceCard, which F-QUEST-002 needs) was blocked on F-STORY-001 without need | ChoiceCard path unblocked |
| 110 | quality | Marked ready although its schema/reader dependencies are not ready specs | Status set to draft with the exact blocker and the PRs that can start now |

### F-STORY-004-story-shelf-home-library.md

| # | Kind | Issue | Fix |
|---|---|---|---|
| 111 | quality | Header claimed a drafted wireframe file that did not exist | Wireframe file written during review; header updated |
| 112 | code truth | Written against c89a903; PR #94/#95 moved Home, Journey, Results, QuestPlayer lines | Re-verified at 332e199 |
| 113 | code truth | Stale JourneyScreen cite | `:62` |
| 114 | code truth | Stale HomeScreen cite | `:103` |
| 115 | code truth | Stale cites; beginQuest signature location | `:41-47`, `:53` |
| 116 | code truth | Stale cite | `:100` |
| 117 | cross-spec | Locked-tile path ignores F-LEARN-001 L7 (no PIN on a self-only device) | Gate helper honoured |
| 118 | code truth | Stale fallbackCard cite | `:169-172` |
| 119 | code truth | Stale cite after PR #95 | `:135-146` |
| 120 | code truth | Results cite conditional on PR #94 | Updated |
| 121 | code truth | PR #94/#95 described as pending rebase targets | Rewritten as merged |
| 122 | code truth | Flags cite imprecise and the existing flags test not mentioned | Interface/defaults/test named |
| 123 | code truth | Referenced a flag (vocabTopicsEnabled) that does not exist | Slot returns false until F-VOC-003 registers it |
| 124 | cross-spec | Korean titles on tiles not tied to the shared KoreanText component | KoreanText used |
| 125 | cross-spec | 4.5 missing KoreanText dependency | Added |
| 126 | cross-spec | Cross-spec dependencies (gate helper, content-access ownership) not stated | Added |
| 127 | feasibility / PR size | PR 4.3 bundled schema, store, bootstrap and six pure modules | Split into 4.3a and 4.3b |
| 128 | code truth | Research-set counts were from drafts (seven stage-1 tales); revised/final data has ten | Re-counted; sampler ids verified |
| 129 | code truth | first-quest.ts cite off by two lines | first-quest.ts:21-23 |
| 130 | quality | Marked ready although the story model/reader it consumes are not ready specs | Status set to draft with blocker and startable PRs |

### wireframes/

| # | Kind | Issue | Fix |
|---|---|---|---|
| 131 | code truth | wireframes/all-ages-onboarding.md: Wireframe treated PR #95 as pending | Updated to merged |
| 132 | code truth | wireframes/all-ages-onboarding.md: Wireframe fixed 3 columns / 64 dp, contradicting the existing responsive layout | Aligned with pinPadLayout |
| 133 | cross-spec | wireframes (i18n-locale-picker, quest-discover-check): Wireframes still carried the old telemetry names | Renamed to the consolidated names |
| 134 | cross-spec | wireframes/i18n-locale-picker.md: Wireframe sample showed the syllable-hyphenated romanization gang-a-ji, which F-CNT-002 (D13) forbids as a stored/displayed value | gangaji |
| 135 | quality | wireframes/story-checks-sequence.md, wireframes/story-shelf-home-library.md: F-STORY-003 and F-STORY-004 cited drafted wireframe files that did not exist (CLAUDE.md §5: no component without a wireframe) | Both wireframes written (8 screens/states each) in the repo wireframe style |
| 136 | quality | all six specs: first line: Status lines | I18N, LEARN, CNT, QUEST `ready`; STORY-003, STORY-004 `draft` with the blocker as the first block under the title |

## 7. Citation ledger (sample of what was read, with the result)

Verified as written: `profile-model.ts:41-49` (name rule, PR #97) · `ProfileScreen.tsx:58-74, 88, 90, 113, 116, 128, 196, 229-233` · `CreateProfileScreen.tsx:30-36, 45, 48, 57, 84, 86, 117, 127, 185-257, 249` · `pin-hash.ts:10-14, 57-64` · `account-store.ts:12-19, 69-73, 80-84` · `sync-store.ts:32, 225-232` · `schemas/sync.ts:55, 56, 79-85, 109` (`normalizeRescueCode`, now both code shapes) · `telemetry.ts:9-33, 129` · `copy.ts:20` · `rollup.ts:54-58, 78` · `validate-content.mjs:25, 42, 49, 84-127` · `minigame-config.ts:12-18, 24, 28-37, 80, 99, 119-127, 338` · `round-builder.ts:45, 71` · `quests.ts:63-64, 77-79, 92` · `heritage-cards.ts:28-68` (30 Stage 1 cards: 26 `episode:*`, 3 `stage1-complete`, 1 `first-launch`) · `HeritageCardArt.tsx:21-56` (all 30 card ids present) · `results-award.ts:37-82`, `reward.ts:6-35`, `first-try.ts:24-34`, `quest-run-store.ts:55-68`, `merge.ts:34-41`, `progress-store.ts:184-209` · `entitlement.ts:16, 31-33` · `journey.ts:18-38` · `mission-builder.ts:86-121, 138-147` · `gating.ts:10, 35, 40, 47, 54` · `routes/sync.ts:17, 43, 87, 103` (no profile-update route) · `SpacesCard.tsx:51` (Leave is ungated) · `wrangler.toml` (`html_handling = "auto-trailing-slash"`).

Corrected (old -> current): `HomeScreen.tsx:172 -> 188` (streak), `:206 -> 222` (Homework line), `:98 -> 103` (quest total), `:133-139 -> 138-143`, `:37-42 -> 42-47` (`ICON_FOR`), `:145,166` (no longer ignores the avatar; ring by `avatarTheme`, `:171`) · `JourneyScreen.tsx:54 -> 63`, `:59-61 -> 68-71`, `:63 -> 72`, `:95 -> 100` · `PinEntryScreen.tsx:48 -> 61`, `:96 -> 126`, `:128-135 -> 158-165`, `:185,207 -> 255,275` · `tabs.tsx:22/36-38 -> 15/22/40-42` (fixed 84 is gone) · `Button.tsx:73 -> 80` · `HoyaBubble.tsx:85 -> 86` · `StorySequenceGame.tsx:32-152/34/59/139 -> 33-153/35/60/140` · `ResultsScreen.tsx:118-139/49-58 -> 117-155`, `results-award.ts:39-48` · `QuestPlayerScreen.tsx:145 -> 147-151/157` · `navigation/types.ts:36-40 -> 45-49` · `first-quest.ts:19-23 -> 21-23` · `copy.ts:2-61/62-64 -> 2-62/64-66` · `landing-layout.spec.ts:16-17 -> 14` · `gating.test.ts:66-68 -> 63-71` · `design-preview/components/page.tsx:367 -> 372` · `episodes` EpisodeDetail `:97 -> 100`, `:132-143 -> 135-146` · `flags.ts:24-65 -> 24-51, 53-58, 60-65, 67`.

Wrong claims (not just line drift): gating reason codes (`locked`/`building`/`not-reached` vs real `unknown-quest`/`episode-not-shipped`/`stage-locked`); `SpeakOptions.onError` (does not exist: `speak()` wires `onError` to `onDone`, so `playPrompt`'s `unavailable` needs a new option); `flags.vocabTopicsEnabled` (does not exist); `out/es/index.html` (Next writes `out/es.html` here); fixed tab-bar height; component tests that the mobile and design-system vitest setups cannot run (below).

## 8. Open questions that need the OWNER (product / commercial / legal only)

1. **Legal: self-attestation and mixed-audience consent** (F-LEARN-001 §3.3, §3.12, §9.7). Is "I'm 13 or older and I agree to the Privacy Policy" an acceptable attestation for the self path, and does counsel accept the child path ("a parent, guardian or teacher sets it up")? Gates the web legal text PR and the store submission (Education category, App Review 2.3.8 / 5.1.4).
2. **Legal: telemetry on child profiles.** Onboarding events now carry `learnerType` and `level` next to the device-generated `profileId` (pseudonymous, no name or email). Confirm that is acceptable for COPPA / the App Store data-use answers, or say to drop `learnerType` from the payload (F-LEARN-001 §3.8, TELEMETRY-NAMES.md rows 3-5).
3. **Product: optional PIN on a self-only device** (F-LEARN-001 L7). A self-only device without a PIN opens "Add a profile", backup and the paywall ungated; a child who gets that device could add a profile or open the purchase page. Accept, or require a PIN for everyone?
4. **Product: avatar name respelling** `례이` -> `예리` (`Yeri`) (F-CNT-002 C9, F-LEARN-001 L12). Fallback if declined: keep `례이`, romanize `Ryei`. The name is not shown in the UI today.
5. **Product: Stage 1 grows from 8 to 15 quests, about 65 minutes** (F-QUEST-002 §3.6; the blueprint estimated about 52). Existing learners see episodes they had completed become incomplete (life, rites, nature, crafts gain quests). Confirm the length and that "incomplete episode" for existing testers is acceptable.
6. **Product: Stage 1 prize is not star-gated** (F-QUEST-002 L8) and the Hangul Check verdict (`>= 27/30 symbols and >= 4/5 words first try`, caregiver-only) is the only place a threshold appears. Confirm both, or change the thresholds.
7. **Commercial / content: the free story sampler.** The six sampler stories (F-STORY-004 §3.9) contain only one folk tale among stage-1 stories (`story-sun-and-moon`); the "two Story Time tales" idea needs a tale outside the research set (호랑이와 곶감). Confirm the six, or commission the extra tale before gating is ever switched on (gating stays off until Stripe Live and PNNL approval).
8. **Product: Spanish and Korean reviewers** (F-I18N-001 PR 15/16). Who is the native Spanish reviewer, and is the owner the Korean reviewer? Also: should the Korean UI offer an opt-in English gloss for heritage learners (F-I18N-001 §10, default no).
9. **Legal: legal pages in `/es` and `/ko`** (F-I18N-001 L10). They show the English text under a localized "English is authoritative" notice until counsel reviews translations. Confirm that is acceptable for launch.

Recorded, no action needed unless the owner objects: the new package and directories (`packages/i18n`, `content/i18n/`, `content/stories/`, `content/vocab/`) are treated as approved under D2/D4 and listed in CLAUDE.md §2 by F-I18N-001 PR 0; F-QUEST-002 keeps Stage 1 content in TypeScript for now (a stated deviation from D4's JSON-first, F-QUEST-002 §8) because the validator reads the shipped TS directly.

### Owner answers recorded 2026-10-10 (applied in the specs)
| # | Decision |
|---|---|
| 2 | `learnerType` is not sent in telemetry; only `level`. |
| 3 | PIN stays optional on a self-only device (as specified). |
| 4 | Avatar `례이` is respelled `예리` (Yeri). |
| 5 | Stage 1 grows from 8 to 15 quests (blueprint 04/05). |
| 6 | Stage 1 prize is not star-gated; Hangul Check caregiver threshold as specified. |
| 8 | Korean reviewer: the owner. Spanish reviewer: an external native speaker is still needed (owner task before F-I18N-001 PR 15). |
| 1, 9 | Still need counsel before store submission and before the legal text ships: the "I'm 13 or older" self-attestation and English-only `/es` `/ko` legal pages under an "English is authoritative" notice. Code can proceed. |
| 7 | Free story sampler accepted as specified; an extra folk tale (호랑이와 곶감) is optional later content. |

## 9. Follow-ups that are not owner decisions

- **F-STORY-001 / F-VOC-001** (not in this review) must use `schemas/ko-text.ts` with the full field set, the telemetry convention, `gridEpisodes`/`placement` names from F-STORY-004 §3.10, and register their Hangul-bearing files with F-CNT-002's coverage list.
- **F-AUDIO-004**: widen `SpeakOptions.language` to the `LOCALE_META` speech tags and add `onError` (`platform/audio.ts:19-24, 36-38`); `playPrompt` signature is fixed in F-QUEST-002 §3.12.
- **Engineering notes folded into the specs**: PR #95's `tokens-parity.test.ts` governs new colour tokens; six Playwright specs onboard through the old form and must move with F-LEARN-001 PR 4b; `audience-copy.test.ts`, `landing-layout.test.tsx` and `landing-layout.spec.ts` name page paths that I18N PR 11b moves; the mobile and design-system vitest setups cannot render components, so screen behaviour is specified as pure reducers plus Playwright (QUEST-002 §5, LEARN-001 §5, I18N hook note).
- **Outside the six specs, observed**: `Home` shows "Stage 1 progress" with a total of every stage's quests (`HomeScreen.tsx:103,209`; 11 today, 18 after F-QUEST-002) — a pre-existing label/total mismatch, not fixed here (CLAUDE.md §10 forbids drive-by changes); `kidsNoAccount` / "Kids never need this page" in `copy.ts` and `routing.ts:42` (audit UF-10, already carved out in F-LEARN-001 §3.9).

## 10. What could not be verified

- Hermes behaviour of `Intl` formatters (fallback tables exist) and of `expo-localization` on a device (native rebuild); Next route groups were verified only in a throwaway prototype (Next 14.2.35), to be re-checked in the real app after the move.
- react-native-web forwarding `lang` / `accessibilityLanguage`, VoiceOver/TalkBack behaviour of the new radio / tab roles, and the two-colour-blindness check of the new cub tints (design step).
- Whether `heritage-cards.ts` prose and the 60 reading / theme words are right Korean: romanizations were machine-checked against the prototype Revised Romanization converter (`.work-vocab/rr.mjs`; every word of F-QUEST-002 §3.6 matched), but sound hints, word choice and pedagogy need native review (stated in the specs).
- Anything in F-STORY-001/002/005/006, F-VOC, F-AUDIO-004, F-PLC-001, F-PLAN-002, F-TCH-004: those specs were not part of this review.


---

# Appendix — consolidated telemetry names

# Telemetry event names — consolidated list for the six reviewed specs (2026-10-10)

Source of truth in code: `TELEMETRY_EVENT_NAMES` in `packages/content-schema/src/schemas/telemetry.ts:9-33` (23 names on `main` at `332e199`). The learner app's `track()` type and the Worker whitelist (`packages/backend/src/routes/telemetry.ts` -> `isTelemetryEventName`) both read it; an unknown name is rejected with 422 and silently dropped by the client (`apps/mobile/src/platform/telemetry.ts:40-58`).

Rules that apply to every row:

1. **Worker first, app second**: the PR that adds a name to the shared list ships (and deploys) before the app release that sends it.
2. Every PR that adds a name also updates the exact-list assertion in `packages/content-schema/src/__tests__/telemetry.test.ts:5-34`; `packages/backend/src/__tests__/telemetry.test.ts` iterates the shared list, so the API case is automatic. Several specs append to the same array: rebase conflicts are mechanical.
3. Payloads carry ids, codes and counts only: no names, no free text, no email. `profileId` rides in the existing envelope field.
4. **Naming convention (new, applied in this review)**: a unit's lifecycle is `<unit>.start` / `<unit>.complete` (existing: `quest.start`, `episode.complete`); a step that ends inside a game is `<thing>.finished` (existing: `minigame.finished`); a discrete user action is past tense (`space.join.attempted`, `locale.changed`). Names are namespaced by the owning feature (`quest.`, `story.`, `pin.` ...), never bare (`check.completed` was ambiguous next to `story.check.finished`).

## New names: 26 (49 after all six specs land)

| # | Name | Owning spec | Payload | Added by (PR) |
|---|---|---|---|---|
| 1 | `locale.changed` | F-I18N-001 §3.12 | `{ from, to, scope: 'device' \| 'profile', source: 'welcome' \| 'settings' \| 'handoff' }` | PR 1 |
| 2 | `romanization.mode_changed` | F-I18N-001 §3.12 | `{ mode: 'always' \| 'tap' }` | PR 1 |
| 3 | `onboarding.who_selected` | F-LEARN-001 §3.8 | `{ learnerType, firstRun }` | PR 1 |
| 4 | `onboarding.level_selected` | F-LEARN-001 §3.8 | `{ level, learnerType }` | PR 1 |
| 5 | `onboarding.consent_given` | F-LEARN-001 §3.8 | `{ basis: 'guardian' \| 'self_13plus', hasEmail, pinSet }` | PR 1 |
| 6 | `profile.updated` | F-LEARN-001 §3.8 / §3.11 | `{ field: 'level' \| 'avatar' \| 'name' \| 'learner_type' }` | PR 1 |
| 7 | `pin.created` | F-LEARN-001 §3.8 | `{ where: 'first_run' \| 'gate' \| 'reset' \| 'optional' }` | PR 1 |
| 8 | `pin.reset_requested` | F-LEARN-001 §3.8 | `{ method: 'rescue_code' \| 'wait' }` | PR 1 |
| 9 | `pin.reset_completed` | F-LEARN-001 §3.8 | `{ method }` | PR 1 |
| 10 | `quest.discover_completed` | F-QUEST-002 §3.13 | `{ questId, pages, heard }` | Q-1 (name), Q-5a (emit) |
| 11 | `quest.check_completed` | F-QUEST-002 §3.13 | `{ questId, firstTryCorrect, retries }` | Q-1, Q-5a |
| 12 | `quest.teaser_tapped` | F-QUEST-002 §3.13 | `{ fromQuestId, toQuestId }` | Q-1, Q-5b |
| 13 | `stage.complete` | F-QUEST-002 §3.13 | `{ stageKey, cardsAwarded }` | Q-1, Q-9 |
| 14 | `review.start` | F-QUEST-002 §3.13 | `{ kind: 'stage-certificate', stageKey, hideRomanization }` | Q-1, Q-10b |
| 15 | `review.complete` | F-QUEST-002 §3.13 | `{ kind, stageKey, symbolsCorrect, wordsCorrect, retries, stars }` (internal; never on a learner screen) | Q-1, Q-10b |
| 16 | `story.check.answered` | F-STORY-003 §3.9 | `{ storyId, level, checkId, kind, firstTry, taps }` | 3.1 (name), 3.4a (emit) |
| 17 | `story.check.finished` | F-STORY-003 §3.9 | `{ storyId, level, items, firstTryCorrect, retries }` | 3.1, 3.4a |
| 18 | `story.sequence.finished` | F-STORY-003 §3.9 | `{ storyId \| null, sequenceId, slots, firstTryCorrect, retries, replayed, skipped }` | 3.1, 3.5a |
| 19 | `story.recap.word_played` | F-STORY-003 §3.9 | `{ storyId, wordId }` | 3.1, 3.4b |
| 20 | `story.results.action` | F-STORY-003 §3.9 | `{ questId, storyId, action: 'next-story' \| 'read-again' \| 'episode' \| 'home' \| 'culture-note' }` | 3.1, 3.7 |
| 21 | `story.shelf.viewed` | F-STORY-004 §3.11 | `{ section: 'story-time' \| 'culture', stories, started, finished }` | 4.3a (name), 4.5 (emit) |
| 22 | `story.opened` | F-STORY-004 §3.11 | `{ storyId, source: 'home' \| 'library' \| 'episode' \| 'results', mode: 'start' \| 'continue' \| 'restart' \| 'play-again' \| 'read-again' }` | 4.3a, 4.4 |
| 23 | `home.story_card.shown` | F-STORY-004 §3.11 | `{ storyId, reason: 'continue' \| 'next' \| 'again' }` | 4.3a, 4.4 |
| 24 | `story.bookmark.resumed` | F-STORY-004 §3.11 | `{ storyId, sceneIndex }` | 4.3a, 4.4 |
| 25 | `culture.note.viewed` | F-STORY-004 §3.11 | `{ noteId, storyId }` | 4.3a, 4.7 |
| 26 | `story.locked.tapped` | F-STORY-004 §3.11 | `{ storyId }` (only when gating is switched on) | 4.3a, 4.5 |

Changed payload of an existing name: `onboarding.started` (F-LEARN-001 §3.8): `{ ageGroup, firstRun, hasParentEmail }` becomes `{ level, learnerType, firstRun, hasEmail }`. The Worker accepts any payload shape, so no list change; analytics queries keyed on `ageGroup` must be updated.

## Renames made by this review (old -> new)

| Old (as drafted) | New | Why |
|---|---|---|
| `locale.change` | `locale.changed` | discrete action = past tense |
| `romanization.mode_change` | `romanization.mode_changed` | same |
| `discover.completed` | `quest.discover_completed` | bare name; namespace by feature |
| `check.completed` | `quest.check_completed` | confusable with `story.check.finished` |
| `teaser.tapped` | `quest.teaser_tapped` | bare name |
| `stage.completed` | `stage.complete` | lifecycle convention (`episode.complete`, `quest.complete`) |
| `review.started` / `review.completed` | `review.start` / `review.complete` | lifecycle convention |

## Checks run

- No duplicate within the 26, and none collides with the 23 existing names (`profile.switch`, `onboarding.started`, `parent.gate.opened`, `minigame.finished`, `space.*`, `paywall.*` stay as they are).
- `stage_anchor_accuracy` (F-RVW-001 §3.4, underscore style, not in the whitelist) is superseded by `review.complete` + `ProgressSummary.stage1Anchor` (F-QUEST-002 Q-11 amends F-RVW-001).
- Not covered here (specs outside this review): F-STORY-001/002/005/006, F-VOC-001..005, F-AUDIO-004, F-PLC-001, F-PLAN-002, F-TCH-004. When those are written they must add their names to this table and follow the convention; any `story.*` name there must not reuse `story.opened`, `story.check.*`, `story.sequence.finished`, `story.recap.word_played`, `story.results.action`, `story.shelf.viewed`, `story.bookmark.resumed`, `story.locked.tapped`.
- The web console has no telemetry client (F-I18N-001 §3.12), so no console event is defined.
