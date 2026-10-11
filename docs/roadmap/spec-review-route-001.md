# Review: F-ROUTE-001 (My route), AMENDMENTS-PLC-PLAN-HANDOFF, wireframe my-route-overview

Date: 2026-10-10. Basis re-verified: `origin/main` `27c771c` (the drafts were written at `33fe533`; since then #168 P-3, #169, #170 layout PR 4, #171 i18n PR 7a, #173, #174 layout PR 2a, #175 F-PLAN-002 P2-2 merged; #172 i18n PR 8a and #176 F-SPACE-002 docs are open).

**Landed** in the F-ROUTE-001 R-0 docs PR (2026-10-11) as: `docs/specs/F-ROUTE-001-my-route-overview.md`, `docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md` (applied to F-PLC-001 and F-PLAN-002 in the same PR), `design/wireframes/journey/my-route-overview.md`, `docs/roadmap/speaking-later.md`, and this log. The `specs-out/` paths below are the review's working copies.

Files changed (in place):

- `specs-out/F-ROUTE-001-my-route-overview.md` — rewritten around the review; `Status: ready`
- `specs-out/AMENDMENTS-PLC-PLAN-HANDOFF.md` — rewritten; items renamed AM-n / FP-Bn; `Status: ready`
- `specs-out/wireframes/my-route-overview.md` — v2
- `specs-out/ROADMAP-speaking-later.md` — new, for `docs/roadmap/speaking-later.md`

**Owner decision applied (2026-10-10):** tracked skills are read, listen, write. Every speaking element was removed from the spec, the amendments and the wireframe (Speak row, "coming" badge, Speak chips, `mic` glyph, "not measured" speaking text, Voice Echo gap row). `SKILL_OF_KIND['voice-echo']` maps to no tracked skill. A "Later: speaking" section (F-ROUTE-001 section 10) and the standalone roadmap file record the plan only.

**Outcome.** 63 findings (2 blockers, 39 majors, 22 minors). Both blockers fixed; every major fixed (two in a different form, explained); minors applied except where noted. No blocker remains, so F-ROUTE-001 is `Status: ready`. Owner decisions gate only the PRs named in the OD table (F-ROUTE-001 section 9).

## 1. Findings and what changed

Outcome key: **fixed** (as proposed), **adapted** (fixed with a different mechanism, reason given), **superseded** (made moot by the owner decision), **rejected** (reason in the F-ROUTE-001 review log).

| # | Lens | Sev | Finding (short) | Outcome | Change |
|---|---|---|---|---|---|
| 1 | ux | blocker | "speaking is practiced" is false; two surfaces contradict | superseded / fixed | no speaking text anywhere; one skills note `caregiver.skillsNote` (reading, listening, writing, skip caveat); copy test bans speaking words (spec 3.12, 3.13; AM-5; wireframe C7, H, K2) |
| 2 | ux | major | Write credited to tiles; Read credited to every quest | fixed | Write = `trace-stroke` only; tiles = grown-up "Spelling with tiles"; Read = decoding kinds; culture kinds = none; OD-5 (spec 3.7, Appendix C; wireframe A) |
| 3 | ux | major | skill ladder not fillable; permanent empty slots | adapted | thresholds `[1,2,4,6,8]`; earned marks plus one faint next slot only when reachable; invariant test "no visible slot unreachable" replaces "4 of 5" (spec 3.7) |
| 4 | ux | major | no stage state for "placed out" | fixed | `StageState 'known'` ("You knew this", ring-with-disc badge), never latches or awards; test row (spec 3.3, 3.18; wireframe C3) |
| 5 | ux | major | Complete regresses; appended rings shrink the visible fill | fixed | additive `stageDoneAt` latch (OD-6); `new` pip state as a separate group after a gap; "pips are a collection, not a bar"; render test (spec 3.3, 3.4, 3.15; wireframe C5) |
| 6 | ux | major | plan ribbon is a schedule meter; SR fractions | fixed | one line "Week 3 · Next in your weekly plan" + Open plan; no dots, no week strip; label = visible text (spec 3.9; wireframe C6) |
| 7 | ux | major | "route" means two things | fixed | "My route" = map; "weekly plan" = dated plan in learner copy (OD-7; FP-B15; all strings) |
| 8 | ux | major | skip behaviour contradicts itself; label drift | fixed | dismissal hides strip and Home prompt until next result or 14 days (OD-16); Profile "Make a weekly plan" always; one label "Not now" (AM-1, AM-6, AM-7) |
| 9 | ux | major | pace fixed by audience | fixed (check-in deferred) | three pace chips Gentle 2 / Steady 3 / Brisk 4, pre-selected from D1 and audience; Hoya check-in after week 4 as OD-13 in P2-7b (amendments 1.1, 1.5, FP-B2, FP-B14) |
| 10 | ux | major | G6 option (b) does not fix the level | fixed | default (c) + honest not-tested copy "Here is a good place to start" + one-tap retake (AM-14, OD-1; wireframe J3) |
| 11 | ux | major | no destination / can-do | fixed (speaking part rejected) | `stage.canDo.<n>` per stage, no numbers; goal line "Your first goal: read every Hangul letter."; OD-9; no speaking line (owner) (spec 3.11, Appendix A) |
| 12 | ux | major | `oneLinerEn` leaks "60" and speaking promises | fixed (speaking part rejected) | `oneLinerEn` never shown; can-do line is the later-stage caption; digit rule test (spec 3.11, 3.13) |
| 13 | ux | major | read-only view speaks to the child | fixed | `viewer: 'self' \| 'grownup'`; third-person `caregiver.journey` strings; skills note on the page (spec 3.12, Appendix B; wireframe C7) |
| 14 | ux | major | 14 dp shapes indistinct; colour-only connector | fixed | 20 / 24 dp drawn shapes; dotted later ring; solid vs dotted connector; greyscale and protanopia check in R-2b; border token through `design-token-sync`; legend in the stage sheet; fill bar below 360 dp (spec 3.4, 3.11, 3.14) |
| 15 | ux | minor | six actions on the result screen | fixed | four actions; "See my route" replaces "See the whole map" (AM-1; wireframe J1, J2) |
| 16 | ux | minor | "Tried"; Journey words differ; "Premium" | fixed (partly) | "Explored"; Journey "Premium" removed and "Soon" -> "Coming later" in R-J (OD-8); "Taste" kept as availability ("A taste" on both screens) (spec 3.3, 6.1) |
| 17 | ux | minor | Speak row sheet and mic glyph | superseded | no Speak row; `mic` dropped from R-2a |
| 18 | ux | minor | wireframe glyphs render as emoji | fixed | pips and markers are drawn shapes; legend marked documentation only and re-drawn without those characters; test bans U+25B6 / U+25C0 / U+25BC (spec 3.4; wireframe legend) |
| 19 | ux | minor | console shows no known count; "not included" noise | fixed / adapted | `known` per stage; line "N known from the level check, M quests done"; no "not included" line at all (the roster has no tier, `api.ts:25-34`) (spec 3.12; wireframe I) |
| 20 | ux | minor | road mostly dashed and long | fixed | `later` stages are compact one-line rows; consecutive ones merge ("Stages 5 to 7"); seven-segment overview on the Home strip and dashboard (spec 3.11; wireframe A, D) |
| 21 | ux | minor | "Hoya found new spots" unclear | fixed | "Hoya found a later place to start." / "Your weekly plan can move ahead and keep the same end date." / Update my plan / Keep my plan (AM-2; wireframe K3) |
| 22 | data | major | `e.placement === 'grid'` returns nothing on the unparsed bundle | fixed | `(e.placement ?? 'grid') === 'grid'`; test on the real `episodesAll` (spec 3.2, 5) |
| 23 | data | major | P-3 merged; `startQuestId` is a live cursor; wrong input type; no catalogue adapter named | fixed | `route: RouteSeed \| null` from `effectiveRoute` with **empty** completions; hero from `beyondContent` / `needsStage`; catalogue = `routeCatalogOf(CATALOG)` (P2-2 merged, #175) (spec 1, 3.2, 3.5, 3.6) |
| 24 | data | major | Stage 1 check places out nothing while `teaches` is empty; jamo-id vs symbol key; letter-wall "covered" not derivable | fixed | limit stated; R-7a after Q-6a; `jamoIdToSymbolKey` adapter in R-7c; "covered" from placed-out quests' `teaches` (spec 3.6, 3.11) |
| 25 | data | major | amendments 1.2 "today's catalogue" is false | fixed | column A (frozen fixture after Q-8 + stories) and column B (bundle shipped today: 4 weeks at Steady / Brisk, no proposal for Stage 2+ free); "never empty" depends on stories (amendments 1.1, 1.2) |
| 26 | data | major | two specs claim migration 0005 | fixed | next free number at PR time, order at merge; F-SPACE-002 named; CI uniqueness check (E-1) |
| 27 | data | major | `gateRequired` is device-level | fixed | visibility on `effectiveLearnerType === 'self'`; 2x2 matrix; OD-14 (AM-1, AM-7, AM-9; wireframe J1, J2) |
| 28 | data | major | override shrinks placed-out; "only grows" false | fixed | monotonic claim scoped to results without override; override puts quests back into the future queue; `diff.itemsAdded`; property test generates overrides (AM-2, FP-B3, FP-B4, FP-B8; spec 3.6) |
| 29 | data | major | derived Complete regresses; no latch on main | fixed | option (b): additive `stageDoneAt`, union merge, `ADDITIVE_FIELDS` entry, Worker first (R-W1); release rule: latch writer ships before Stage 1 grows (spec 3.3, 3.15, 6.1) |
| 30 | data | major | entitlement not enforced where the learner plays; R-4 silently changes Home | fixed | injected predicate defaulting to "every shipped stage playable"; Home keeps its replay fallback; OD-4 gates R-4a; neutral "Not open yet" if the other branch is chosen (spec 3.2, 3.3, 3.5) |
| 31 | data | major | skipped games still count as practice | fixed | inventory wording "In N quests you finished"; grown-up caveat; gap G4; later `kindsPlayed` (spec 3.7; amendments G4) |
| 32 | data | major | `teach/home` is counts-only | fixed | strip only on the `teach/space` roster card for class and family; not school (spec Scope, 3.12; wireframe I) |
| 33 | data | major | malformed `journey` makes the Worker refuse the whole PUT | fixed | `.optional().catch(undefined)`; `stage` / `state` as strings on the wire; backend test; `max(7)` client-only (spec 3.12, 5) |
| 34 | data | major | three specs claim the cursor / placed-out / cells | adapted | ownership table (spec 6.3); one cursor `nextQuestAfter` + `skipQuestIds`; `cell-look.ts` kept as a thin adapter over `pipStateOf` (not deleted, P-7 owns the look); `GridCell` order 5.5a, P-7, Q-9 (AM-13) |
| 35 | data | minor | pip order vs cursor order | fixed | one ordered list in route order; equality test on 8- and 15-quest fixtures (spec 3.2) |
| 36 | data | minor | `summarizeFor` lacks tier and placements | fixed | `journey` computed in sync-store and passed in; `locked` dropped from the wire (spec 3.12) |
| 37 | data | minor | `seen` shape, unguarded write, read-only write | fixed | `{ totals, doneKeys, at }`; try/catch; active profile only (spec 3.10) |
| 38 | data | minor | banned list exists nowhere; digit rule vs "Stage {n}"; telemetry rows missing | fixed | my-route-local fixture with es / ko; digits allowed in Stage / Week / dates; rows added in R-0 (spec 3.13, 3.16) |
| 39 | data | minor | start tag on an unavailable row; absent ids | fixed | tag on the stage of `startQuestId`, else highest known; absent ids ignored with a test (spec 3.4, 3.6) |
| 40 | data | minor | two route cards on Home with different dots | fixed | plan week folded into the My route strip; F-PLAN-002 Home card is only the prompt (spec 3.9, 6.4; FP-B6) |
| 41 | data | minor | deep link could bypass the gate | fixed | gate-session check, else `PinEntry`; e2e case (spec 3.1, 3.18, 5) |
| 42 | data | minor | one grown-up sentence in three wordings | fixed | one key `caregiver.skillsNote` everywhere (spec 3.12; AM-5) |
| 43 | data | minor | no end state per skill | fixed | OD-9 with a proposed v1 answer; gap G8 (spec 1.1, 9; amendments G8) |
| 44 | scope | blocker | no integrated scope or critical path | fixed | spec 6.0 milestones M1 / M2 / M3 with counts and deploy gates (about 27 PRs; 2 Worker deploys + 1 migration); mirrored in amendments section 7 |
| 45 | scope | major | "R-1 and R-2 can start now" breaks CLAUDE.md section 5 | fixed | start-order table (header); R-2 split into R-2a icons and R-2b `PipRow` after the design mock |
| 46 | scope | major | `startQuestId` semantics; catalogue adapter | fixed | as #23 |
| 47 | scope | major | wrong SplitPane PR; duplicate Journey pane | fixed | R-6 and wireframe F removed; wide = one reading column; SplitPane is PR 5a (`F-LAYOUT-001` line 260) |
| 48 | scope | major | MyRoute duplicates the Journey; R-5 collides with four specs | fixed | "Not the Journey" paragraph; R-5 deleted; `GridCell` order recorded (spec 3.1, 6.3) |
| 49 | scope | major | naming collision: rename page "Where I am" | rejected (rename) / fixed (ribbon) | naming resolved the other way (#7, OD-7 alternative recorded); ribbon reduced to one line and not repeated on Home |
| 50 | scope | major | R-4 mixes UI, behaviour and a new function; Home unowned | fixed | R-4a (logic, `skipQuestIds`, after OD-4) and R-4b (Home strip, after F-STORY-004 4.4a and F-LAYOUT-001 5c); Home stack order table (spec 6.4) |
| 51 | scope | major | scope beyond the ask | fixed | phased as milestones; adult views in M3 (spec 6.0) |
| 52 | scope | major | Write default contradicts "trace games" | fixed | as #2; OD-5 gates R-1a `skills.ts` |
| 53 | scope | major | decisions and assumptions mixed; id collisions | fixed | one OD table with default / effect / gated PR / reversible; separate assumptions table; amendment items renamed AM-n and FP-Bn; M9 / M12 moved to ODs (spec 8, 9) |
| 54 | scope | major | G6 scheduled too late; (b) changes merged code | fixed | G6 is OD-1, first in the list; gates P-6 under (c), P-4 + an amendment PR under (b); simulation data note (amendments 0, G6) |
| 55 | scope | major | gap list misses destination and growth pacing | fixed | G8 and G9; OD-9 (amendments 4) |
| 56 | scope | major | server-first ordering broken inside PRs | fixed | telemetry names in R-W1 (Worker first); R-8 joins the shared deploy D2 with P2-4, Q-10a and `route.*`; es / ko review precondition for R-10 (spec 6.0, 6.1) |
| 57 | scope | major | default-plan work stacked on L PRs; false "not started" claim | fixed | P2-3a / P2-3b with a benchmark gate, P2-7a / P2-7b; P2-7a before P-7b; true status list from `git worktree list` (FP-B11; amendments header) |
| 58 | scope | minor | basis stale | fixed | basis `27c771c`; cites re-verified (section 2) |
| 59 | scope | minor | R-1 too big; plan-position needs P2-4 types | fixed | R-1a / R-1b; `plan-position.ts` in R-7b, `start-marker.ts` in R-7a (spec 3.2, 6.1) |
| 60 | scope | minor | tests pin live content | fixed | frozen fixtures for all counts; one invariant smoke test on the live bundle (spec 5) |
| 61 | scope | minor | letter wall dependency mislabelled | fixed | R-7c after Q-6a (partial), complete after Q-8; E-5 (spec 6.1; amendments E-5) |
| 62 | scope | minor | 4-week card promises a finish it cannot reach | fixed | `lessons-cut-short` preview code and test (amendments 1.3, FP-B3, FP-B8; wireframe K1) |
| 63 | scope | minor | six entries multiply conflicts | adapted | Profile row dropped; parent row in M3; Journey header button kept as the first M1 entry (the Home strip waits on OD-3 and two Home rewrites; the result link waits on P-6) |

## 2. Cites re-verified against `origin/main` `27c771c`

| # | Claim | Result |
|---|---|---|
| 1 | `Episode = z.input<typeof EpisodeObjectSchema>` | true at `schemas/episode.ts:50` (finding said `:62`; corrected) |
| 2 | `placement` default `'grid'` | `schemas/episode.ts:28` true |
| 3 | `flags.voiceEchoEnabled` default off | field `config/flags.ts:30`, default `:66` (draft said `:24-30, 65-67`; narrowed) |
| 4 | only `letters-q2` has `trace-stroke` | `content/quests.ts:34` true; kinds per quest listed `:18-178` |
| 5 | `questsAll` | `content/quests.ts:185` true |
| 6 | `buildSeed` start = not placed out, not done, entitled | `placement/route-seed.ts:105-110` true |
| 7 | override deletes placed-out ids | `route-seed.ts:169-178` true |
| 8 | `higher()` level only rises | `route-seed.ts:145-146` true |
| 9 | `RouteQuest` / `RouteCatalog` shape | `route-seed.ts:14-26` true |
| 10 | Stage 1 placed out only with non-empty covered `teaches` | `placement/level-map.ts:62-74` (rule `:72`) true |
| 11 | `routeCatalogOf` merged; order stage, theme, cell list | `catalog/route-catalog.ts:15-46` true (P2-2 #175) |
| 12 | lessons' `teaches` empty; `CATALOG` | `catalog/data.ts:81-91`, `:175` true |
| 13 | `questTeaches` returns jamo ids | `logic/stage1/curriculum.ts:23-33` true |
| 14 | `effectiveLearnerType` | `logic/profiles/learner-type.ts:20` true |
| 15 | `gateRequired` is device-level | `learner-type.ts:52-57` true |
| 16 | `nextQuestAfter`, `offerableQuests` | `logic/next-quest.ts:44-48`, `:23-31` true |
| 17 | Home cursor without tier, replay fallback | `logic/homework/mission-builder.ts:115-122` true |
| 18 | Home bar divides by `questsAll.length` | `HomeScreen.tsx:108`, bar `:199-202` (draft said `:198-202`; corrected) |
| 19 | Home homework count | `HomeScreen.tsx:110` (F-PLAN-002 line 244 cites `:105` / groupAssignments: stale, E-3) |
| 20 | `isStageEntitled` used in three places | `ResultsScreen.tsx:138`, `JourneyScreen.tsx:69`, `store/plan-store.ts:36` true |
| 21 | Journey "Premium" pill | `JourneyScreen.tsx:104`, word `packages/i18n/src/messages/en/learner.ts:137`; availability words `:139` true |
| 22 | Journey cells open `EpisodeDetail` | `JourneyScreen.tsx:115` true |
| 23 | `FREE_STAGE_KEYS = ['stage1']` | `logic/content-access.ts:25` true |
| 24 | games can be skipped; check cannot | `logic/quest-flow/check-launcher.ts:35` / `:26`; skip button `QuestPlayerScreen.tsx:282` (finding's `:270` moved after PR 7a) |
| 25 | all-skipped run writes nothing | `logic/results-award.ts:39-48` (finding cited `QuestPlayerScreen.tsx:93-95`; the rule lives here) |
| 26 | nothing awards `stage1-complete` | definitions only at `content/heritage-cards.ts:35, 51, 67`; `results-award.ts` unlocks the quest card only; true |
| 27 | `QuestProgress` pooled fields | `schemas/progress.ts:7-15` true; snapshot `:78-99` |
| 28 | Worker 422 on bad summary | `packages/backend/src/routes/sync.ts:50-51` with `SnapshotPutSchema` (`schemas/sync.ts:52-58`) true |
| 29 | `ProgressSummarySchema` | `schemas/sync.ts:16-48` true |
| 30 | `summarizeFor` has no tier or placements | `store/sync-store.ts:92-93` true |
| 31 | `summarize` header: no per-quest detail | `logic/sync/summarize.ts:5-8`; stage1 counts `:73-77` true |
| 32 | `writeJson` does not catch | `platform/storage.ts:19-21` true |
| 33 | `scanLearnerCopy` knows four words | `logic/homework/banned-text.ts:10`, `:30-37` true; `banned-words.json` en learner 4, caregiver 2 true |
| 34 | console home is counts-only | `apps/web/src/app/teach/home/page.tsx:15` (header comment), `statusLine` `:66`; 84 lines; never reads `summary` — true |
| 35 | roster card summary lines; school renders `SchoolAdmin` first | `teach/space/page.tsx:161-168`, `:46` true |
| 36 | roster row has no tier | `apps/web/src/lib/console/api.ts:25-34` true |
| 37 | glyph set lacks pin / check-circle / book / ear / pencil / mic | `Icon/glyphs.ts:33-100` true |
| 38 | stage colours 2.3-3.0:1 | `tokens.ts:61-71` true |
| 39 | `a11y.gridCell` has no completion state | `en/a11y.ts:21-22` true |
| 40 | Stage 2 one-liner "first 60 Korean words" | `content/stages.ts:20` (anchor `:21`) true |
| 41 | `ADDITIVE_FIELDS` and `summaryKey` optional | `backend/src/lib/additive-fields.ts:15-34` true |
| 42 | roster order by recent activity | `routes/spaces.ts:386`; summary only `:374`, `:382` true |
| 43 | migrations 0001-0004; sorted shim | `apps/api/migrations/`; `backend/src/__tests__/helpers/sqlite.ts:22` true |
| 44 | simulations only `revealMode: 'tap'`; leaking templates unusable with `always` | `__tests__/placement-simulated.test.ts:66`; `placement/run.ts:95` true |
| 45 | no linking config in mobile | grep `linking` in `apps/mobile/src`: none — true |
| 46 | F-STORY-006 stage rule needs a fully shipped stage | `docs/specs/F-STORY-006-card-award-model.md:51` true |
| 47 | F-PLC-001 assumption 11 (sound guide) at line 509; assumption 10 cites `JourneyScreen.tsx:100` | true; `:100` is stale (now `:104`, E-3) |
| 48 | SplitPane is F-LAYOUT-001 PR 5a (needs 1, 4); 2a is the `#root` change | `docs/specs/F-LAYOUT-001-...md:256, 260` true |
| 49 | Q-6a = quests 1-3 with discover; Q-6b = 4-6; Q-8 = 10-15 | `F-QUEST-002` lines 454, 455, 458 true |
| 50 | F-SPACE-002 migration `0005_class_transfer.sql` | at `F-SPACE-002-class-transfer.md:11, 126` (finding's `:106` / `:413` moved) |

## 3. Symbols and routes verified to exist (or marked new)

Exist on main: `nextQuestAfter`, `offerableQuests`, `playableEpisodes`, `stageAvailability`, `isEpisodeComplete`, `completionState`, `isStageComplete`, `recordBestQuest`, `effectiveRoute`, `seedRoute`, `RouteSeed`, `RouteCatalog`, `RouteQuest`, `placedOutQuestIds`, `questsPlacedOutAtLevel`, `routeCatalogOf`, `CATALOG`, `CATALOG_VERSION`, `questTeaches`, `effectiveLearnerType`, `gateRequired`, `isStageEntitled`, `FREE_STAGE_KEYS`, `applyQuestResult`, `summarize`, `ProgressSummarySchema`, `SnapshotPutSchema`, `ADDITIVE_FIELDS`, `TELEMETRY_EVENT_NAMES`, `useLayoutClass`, `layoutClassFor`, `readJson` / `writeJson`, `scanLearnerCopy`, routes `EpisodeDetail`, `QuestPlayer`, `PinEntry`, `GrownUpDestination`.

New in these specs (not on main, marked as new): `buildMyRoute`, `pipStateOf`, `summarizeJourney`, `JourneySummarySchema`, `stageDoneAt`, `NextQuestInput.skipQuestIds`, `MyRoute` route, `PipRow`, `flags.myRouteEnabled`, `flags.routeEnabled` (F-PLAN-002), `proposeRoute`, `RouteProposal` route, `PACES`, `route_map.*` and `route.*` telemetry names, `caregiver.skillsNote`.

## 4. Open items (not blockers)

1. R-0: add a `revealMode: 'always'` row to the placement simulations and report the band-0 share next to OD-1.
2. P2-3b: replace the hand estimates of amendments 1.2 with generator output (both columns).
3. R-2b: design mock for the five pip shapes and the border token (CLAUDE.md section 5 gate).
4. Release checklist: the `stageDoneAt` writer reaches learners before any build that adds Stage 1 quests.
5. es / ko review of the new strings before the R-10 flag flip (or flip for `en` only).
6. Apply AM-13 / E-5 notes to F-QUEST-002 and F-STORY-005 dependency lines in the R-0 docs PR.
