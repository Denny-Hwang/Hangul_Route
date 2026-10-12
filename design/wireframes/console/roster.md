# Console/Roster — class roster, summary only (wireframe v1)

Spec: `docs/specs/F-TCH-001-teacher-classroom.md` §3.1–3.2, §3.6 · `docs/roadmap/multi-persona-sync-platform.md` §3.1 (teacher reads `summary_json` only), §3.3 (`ProgressSummary`), §4 (offline reach), §5 (re-link), §6 step 4, §7 (free cap)
Code (F-CONSOLE-001, 2026-09-21): `apps/web/src/app/teach/space/[id]/page.tsx` — join code (copy · regenerate with confirm), cap banner from 80 %, this-week roll-up (`lib/console/rollup.ts`), student cards most-recent-first, empty state with the enlarged code panel. Not yet: plan CTA, re-link badge, settings, learner detail, anonymize mode, per-card rescue code (becomes "Issue a new code", §7 #24).
Audience: **teacher** (school admin reaches it per class, read-only)

## Scenario (Given-When-Then)

Given: a teacher opens their class on Sunday afternoon, students have been practicing at home during the week
When: the roster loads
Then: they see the join code, one class roll-up, and one summary card per student sorted by most-recent activity — enough to know who is ready for today, who hasn't synced, and what to plan next; never a raw quest history, never a ranking

## Screen goal

"Show the class at a glance from `summary_json` and route the teacher to plan / approve / settings."

## Box diagram

```
+------------------------------------------------------------+
| [< back to home]   Sunday Class A - 12 students   [ Settings ] |  -> console/space-settings
|                                                            |
|  Join code  K7M2X9   expires in 18 days   [ copy ] [ regenerate ] |
|                                                            |
|  +------------------------------------------------------+  |
|  | Free plan: 12 / 20 students (placeholder cap)   [ Upgrade ] |  <- only when >= 80% of cap
|  +------------------------------------------------------+  |  -> console/billing
|                                                            |
|  This week (whole class)                                   |
|   o 9 of 12 practiced this week                            |
|   o Stage 1 anchor: 71% (was 67%)                          |  <- delta always paired
|   o Jamo to revisit together: [b][s]                       |  <- invitation framing
|   o 3 students haven't synced since Tue (1 line)           |  <- summary.lastActiveAt
|                                                            |
|  [[ PLAN THIS WEEK ]]        [ 1 re-link request ]         |  -> console/plan-builder / console/relink-approval
|                                                            |
|  Students (most recent activity first)                     |
|  +------------------------------------------------------+  |
|  | [avatar] Minho        Stage 1 - Ch 2     today       |  |
|  |  quests  [####....] 7 / 11    plan "Week 3"  2 / 3   |  |  <- summary.stage1 / planProgress
|  |  38 min this week   revisit: [b]        [ rescue code ] |  |
|  +------------------------------------------------------+  |
|  | [avatar] Suji         Stage 1 - Ch 1     Tue         |  |
|  |  quests  [##......] 3 / 11    plan "Week 3"  0 / 3   |  |
|  |  12 min this week   not synced since Tue             |  |  <- hint, no color warning
|  +------------------------------------------------------+  |
|  | ... one card per student ...                          |  |
+------------------------------------------------------------+
```

- Each card shows the learner's cub as a 28 px colour chip (`AvatarChip`: the avatar's shade, English cub name as its accessible name, no name or initial on it) and a level pill from `levelLabel(ageGroup)` ("Some reading"); the pill is hidden for a level this build does not know. Never an age (F-LEARN-001 §3.6, §3.7).
- Card tap → `parent/learner-detail` in read-only mode (same component, summary fields only, no recent-quest list).
- Anonymize mode (space setting) swaps names for nicknames / initials on every card and in the roll-up.
- Banned on this tree: sort by accuracy, per-student percentile, schedule-pressure wording from the F-PAR-001 §3.6 banned list (F-TCH-001 §3.2).

## Interaction points

- [ regenerate ] → confirm sheet ("the old code stops working") → `POST /spaces/:id/code`; new code replaces inline
- [ copy ] → clipboard
- [[ PLAN THIS WEEK ]] → `console/plan-builder` (class preselected)
- [ 1 re-link request ] → `console/relink-approval` (badge count from pending requests; hidden at 0)
- [ Upgrade ] → `console/billing` (group_license, $153/yr — decision #30)
- [ Settings ] → `console/space-settings`
- Student card tap → `parent/learner-detail` (read-only)
- [ rescue code ] on a card → in-place sheet showing that learner's Rescue Code (roadmap §5.1 — not progress data, so allowed on a teacher surface)
- [< back to home] → `console/home` (from a school: `console/school-admin`)

## Navigation graph

Enter from: `console/home` (class row) · `console/school-admin` (class in tree) · `console/onboarding-role` (teacher path step 3) · `console/plan-builder` / `console/relink-approval` / `console/space-settings` (back)
Exit to:    `console/plan-builder` · `console/relink-approval` · `console/space-settings` · `parent/learner-detail` · `console/billing` · `console/home` · `console/school-admin`

## States

- **success**: as above.
- **empty** (no students yet): roll-up and cards replaced by one large join-code panel + "write it on the board; students join from Profile Picker > Join a class" (2 lines) + [ regenerate ]. Plan CTA still available (a plan can be drafted before anyone joins).
- **partial / not synced**: cards whose `lastActiveAt` predates the latest published plan show the "not synced since" line; roll-up counts them. No red, no exclamation.
- **cap reached** (free, placeholder 20/20): banner becomes persistent; join attempts beyond the cap are refused server-side and the student app shows "ask your teacher" (roadmap §7).
- **error** (roster fetch fails): header + join code still render from cache; card area shows "can't load the class yet" + [ TRY AGAIN ].

## Data needs

- reads: `GET /spaces/:id/roster` → learners (display_name, avatar, age_group) + `summary_json` per learner — **never** `payload_json` (roadmap §3.1) · latest published plan (title, item count) for the planProgress label · pending re-link requests count · space `join_code`, `join_code_expires_at`, `settings_json.anonymize_roster` · membership count vs cap
- writes: `POST /spaces/:id/code` (regenerate) · telemetry `console_roster_viewed{students, notSynced}`, `console_join_code_regenerated`
- roll-up is computed client-side from the summaries (pure function, `logic/` 100% coverage)

## Open questions

- Teacher free cap: 20 (roadmap §7) vs 30 (roadmap §11 Q4) — **deferred**; the banner threshold is a placeholder.
- F-TCH-001 §3.2 shows "class avg time-on-app" in the roll-up; F-PAR-001 §3.2 bans class averages on the *parent* card. Keep the average here (teacher, whole-class) but never pass it into the shared `parent/learner-detail` component — confirm when F-TCH-001 is promoted to `ready`.
- Should "not synced since" be per card, roll-up only, or both? Default both; measure whether teachers act on it in the pilot.
- F-TCH-001 §5 names `design/wireframes/teacher/roster.md`; app map v1 moved it to `console/roster` — update the spec's §5 paths when promoting.

## Journey strip (F-ROUTE-001 R-9a)

Split from `design/wireframes/journey/my-route-overview.md` screen I when it was built (spec `docs/specs/F-ROUTE-001-my-route-overview.md` §3.12, PR R-9a). Code: `apps/web/src/lib/console/journey-strip.ts` (pure, tested) and `apps/web/src/components/console/JourneyParts.tsx` (`JourneyStrip`), rendered under the minutes line of each roster card in `app/(console)/teach/space/page.tsx`. Data: the learner's own `summary.journey` (R-8), nothing else. Strings: `console.journey`.

```
┌──────────────────────────────────────┐
│ (avatar) Mina          [Some reading] │
│ Last active today                     │
│ Starting spot: Stage 2 · Words · Oct 9        (F-PLC-001 P-9, when a level check exists)
│ Quests 4 / 8 · 3 cards                │   existing
│ 38 min this week                      │
│ Learning Route  (K) ^(O) (L) (C) (L)(L)(L)  On Stage 2   │   seven drawn segments + the stage the learner is on (label renamed from "Journey" by AMENDMENTS-ROUTE-LEARNING-ROUTE §7.2, LR-1)
│ v Stage by stage                      │   <details>, closed by default
│    Stage 1: 8 known from the level check, 0 quests done
│    Stage 2: 1 quest done              │   "known" part only when > 0; never "N / total"
│    Stage 3: Coming later              │
│    Stage 4: 1 quest done              │
│    Stages 5 to 7: Coming later        │   consecutive empty coming-later stages merge
└──────────────────────────────────────┘
```

**Segments.** One drawn shape per stage, 20 px, the My route shape vocabulary (`design/components/PipRow/spec.md`, geometry imported from `@hangul-route/design-system/pip-geometry`, so the shapes match the app exactly). Every state differs in geometry, not only in ink:

| Stage state | Segment | Ink |
|---|---|---|
| `complete` | filled disc with a check (the done pip) | fill = the stage colour (decoration), edge `border.shape`, check `text.primary` |
| `known` | ring with an inner disc (the known pip) | `border.shape` |
| `explored` | the check alone, no ring (never drawn as complete) | `text.primary` |
| `open` | ring (the open pip) | `border.shape` |
| `later` | dotted ring, 8 dashes (the later pip) | `border.shape` |
| `here` | the cursor triangle above the segment | `text.primary` |

- Segments are equal size: `total` sizes nothing visible and is never shown as a goal (no fill share, no ratio).
- The segments are `aria-hidden`; a visually hidden list reads the same facts as words ("Stage 1: Known from the level check", "Stage 2: Open", ...). "On Stage N" is visible text.
- Shows on **class and family** roster cards only: not on a `school` space (it renders `SchoolAdmin` before any roster) and not on `teach/home` (counts only, no names).
- `summary.journey` absent (an old build, or no upload yet) or malformed: no strip at all, never a "no progress" look. An entry with an unknown stage key, an unknown state or unreadable counts (a newer build) is skipped; a `here` that is not a readable stage drops only "On Stage N".
- Hard rules: cards stay in recent-activity order; no class average, distribution, sort or filter by stage; no "ahead" / "behind"; no "not included" line (the roster has no tier).
- Fits the 280 px minimum card width: the label, the seven segments and "On Stage N" wrap onto a second line when needed (spec §9 assumption e).

## Words lines (F-VOC-005 P-4)

A copy change on the existing card and week panel (spec `docs/specs/F-VOC-005-word-progress-srs-sync.md` §3.8, behaviour 14; no new screen). Code: `apps/web/src/lib/console/vocab-words.ts` and `rollup.ts` (`vocabRevisit`, pure, tested) and `apps/web/src/components/console/VocabWordsParts.tsx`. Data: the learner's own `summary.vocab`, words from the generated `apps/web/src/data/vocab-catalog.ts`. Strings: `console.space.learner.words`, `.wordsRevisit`, `console.space.week.wordsRevisit`, `console.space.wordGloss`.

```
This week
 o 9 of 12 practiced this week
 o Jamo to revisit together: ㅂ · ㅅ
 o Words to revisit together: 눈 nun (eye) · 사과 sagwa (apple) · 우유 uyu (milk)   <- the three words most often on the lists, ties by id

┌──────────────────────────────────────┐
│ (avatar) Mina          [Some reading] │
│ Last active today                     │
│ Quests 4 / 8 · 3 cards                │
│ 38 min this week                      │
│ Revisit: ㅂ                           │   existing jamo line
│ Words: 12 collected · 4 strong        │   counts only, no rate
│ Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)   │   up to three, in the order the device sent them
└──────────────────────────────────────┘
```

- Plain text in the card's existing type and colour (`text.secondary`, `bodySm`); no chart, no bar, no colour per word.
- Each word: Hangul marked `lang="ko"`, then the romanization and the gloss in the UI language ("sagwa (apple)"); the gloss tells the two senses of a homonym apart. An id this build does not know shows its romanized slug alone, with no Hangul.
- Wrapping: the Hangul and its romanization never break apart; the gloss may wrap after them (real glosses run to 40-plus characters, "tteokbokki (pasteles de arroz picantes)"), and each line may break inside one long word rather than overflow a 280 px card.
- **Shown only when the roster carries `summary.vocab`.** `vocab` stays on `TEACHER_HIDDEN_SUMMARY_KEYS` until a consent item covers it (F-SPACE-002 T-1a), so today no card shows these lines and the week shows no words line. F-VOC-005 P-4b adds that consent item and the Worker's `vocab` projection (known keys only, no `firstTryRate`); the console needs no further change then.
- Never shown: the first-try rate (a student's detail view only), a percent, a ranking, a sort by words. Cards keep the roster's order. "Words to revisit", never "weak words", "failed" or "behind".
