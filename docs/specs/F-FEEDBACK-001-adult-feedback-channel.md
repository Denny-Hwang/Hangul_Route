Status: ready

# F-FEEDBACK-001 — Notes from grown-ups: a one-way, child-safe feedback channel from a learner's teacher or family to the learner

> **Status note.** `ready` means: every behaviour, data shape, route, string family, test and PR below is decided, and every owner decision in section 12 has a default that applies until the owner answers. No decision blocks a PR; each one names the PRs it would change. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` is at that commit. Revised the same day after two reviews (review log at the end).
>
> **Owner request (2026-10-11, item 7, translated):** "A channel for teachers and parents to give feedback to students." This spec is that channel. It is **adult to learner only**. Messaging between a parent and a teacher stays out of scope (F-TCH-001 section 4 keeps it for a later F-NOTIF spec). Items 4 and 6 (reports) and 7 together mean "read the report, then encourage": the report's action slot opens this spec's composer (section 6.13).

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a wireframe and a design mock)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | FB-0 docs | — | promotes this spec, the nine wireframes, the telemetry rows, the app-map rows, the Home-order row and the cross-references |
| after FB-0 | FB-1 schemas + telemetry names, FB-1b text guard, FB-5 strings, FB-6 icons | FB-0 merged | new files plus append-only edits |
| after FB-1 | FB-2 migration + `Db` methods | the shared schemas | the migration must be **merged and deployed before** any route PR (server first) |
| after FB-2 is deployed | FB-3a send routes (behind the Worker switch `NOTES_SEND`, off), FB-4a device inbox + state | the tables exist in production D1 | a route on a missing table would 500 |
| after FB-3a / FB-4a | FB-3b sent list, withdraw, cleanup, purge; FB-4b-device; then FB-4b-family | each other, in that order | safety routes (hide, report, oversight, holds) are deployed before anyone can switch sending on |
| after FB-1, FB-1b, FB-5 | FB-7 app logic + store, FB-10 console logic | ids, guard, dictionary | logic only, flags off |
| after the design pass | FB-8 learner screens, FB-9 grown-up zone, FB-11a notes page, FB-11b entry points, FB-12 family view | design mocks in `design/screens/` (CLAUDE.md section 5) | "no component without a mock" |
| after FB-3b / FB-4a / FB-4b-* deployed and FB-1's names on the Worker | FB-8, FB-9, FB-11a, FB-11b, FB-12 may be merged with their flags off | Worker first (telemetry names, routes) | an app build must not call a route the Worker lacks |
| last | FB-13 runbook, privacy line, App Review notes; FB-14 e2e + flag flips; owner sets `NOTES_SEND` | every PR above | the flip is the only user-visible change |
| after FB-11a and F-BROWSE-001 BR-10 | FB-15 composer **Preview** link | the browse hand-off exists | optional add-on, never rendered before |

**Scope**: `packages/content-schema` (new `schemas/feedback.ts`, `schemas/sync.ts` inbox fields, `schemas/transfer-consent.ts` one new visible item, telemetry names) · `packages/i18n` (new `src/note-text.ts` exported as `@hangul-route/i18n/note-text`; strings `common.notes`, `learner.notes`, `caregiver.notes`, `console.notes`, `a11y.notes`) · `apps/api` (one additive migration; a daily Cron Trigger and a `scheduled` export in `src/index.ts`) · `packages/backend` (new `routes/notes.ts`, device routes in `routes/sync.ts`, `lib/can.ts` two actions, `lib/note-limits.ts`, `lib/notes-switch.ts`, `db/*` set-based methods, `deleteLearner` and membership-leave cleanup, dependency `@hangul-route/i18n`) · `apps/mobile` (new `logic/notes/`, new `store/notes-store.ts`, new `screens/notes/`, `screens/parent/NotesGrownUpScreen.tsx`, Home card, Profile row, dashboard rows, `platform/sync-api.ts` methods, navigation types, flag) · `apps/web` (new `lib/console/notes.ts`, `ROUTES.spaceNotes`, notes pages under `/teach/space/notes`, `/parent/space/notes`, hubs `/teach/notes` and `/parent/notes`, `components/console/NotesParts.tsx`, entries on the roster card, the parent home, the report action slot and the adult nav, a "Can send notes" toggle on the family settings page, flag) · `packages/design-system` (icons `note`, `heart`)
**Owner**: solo dev
**Rollout**: three switches, all default **off**: console flag `NEXT_PUBLIC_NOTES_ENABLED`, app flag `EXPO_PUBLIC_NOTES_ENABLED`, and the Worker variable `NOTES_SEND` (dashboard text variable kept by `keep_vars`; unset means nobody can send, section 7.8). FB-14 flips both client flags; the owner sets `NOTES_SEND=enabled` (runbook, FB-13) and can unset it at any time without a deploy. The inbox, hide, report and oversight routes have no switch: safety controls always work.
**Hosts**: every grown-up page of this spec is a console page on **app.hangulroute.com** under the persona prefixes of F-APP-001 (`/parent/*`, `/teach/*`). hangulroute.com (the intro site, F-SITE-002) carries no notes surface; it only gains one claim line when this spec ships (`SITE_CLAIMS.feedbackNotes`, FB-14). Billing plays no part in this spec (OD-7).
**Wireframes** (drafted with this spec, promoted in FB-0): `design/wireframes/home/notes-card.md` · `notes/list.md` · `notes/detail.md` · `parent/notes.md` · `parent/note-report.md` · `console/note-composer.md` · `console/notes-sent.md` · `console/family-notes.md` · `console/notes-hub.md`

Parent / siblings: CLAUDE.md section 1 (any age, anti-shame, child safety, UI languages) · F-SPACE-001 (spaces, roles, `can()`) · F-SYNC-001 (inbox, device principal) · F-TCH-001 (section 3.2 no ranking; section 4 messaging out of scope) · F-PAR-001 (section 3.4 voice message N5, section 3.6 caregiver anti-shame list) · F-SPACE-002 (teacher-visible consent items, `rate_hits`, bounded purge, `deleteLearner` pattern; `CLASS_TRANSFER` stays off) · F-I18N-001 (dictionary, banned words, fallback) · F-LEARN-001 (`gateRequired`, `gateOpensDirectly`, self-managed learners) · F-PROF-001 (grown-up gate) · F-ROUTE-001 (section 6.4 Home stack order) · F-CONSOLE-001 (console shell, static export, `?id=` addressing) · F-PLAN-001 (`PlanItem.note`, related gap in section 4) · siblings of the 2026-10-11 wave, drafted in parallel and named by id: **F-APP-001** persona app shell (routes, `ROUTES.space(id, kind)`, `ADULT_NAV`, `openGrownUpArea`, parent home) · **F-REPORT-001** progress reports (section 3.6 insight action slot) · **F-ENT-003** free plan, all of Stage 1 (`freeRouteQuestIds`, `contentGatingEnabled()`, `useQuestAccess()` / `isQuestOpen`) · **F-BROWSE-001** adult content browser (`openBrowse`, `BrowseSourceSchema`) · **F-SITE-002** layered intro site (`SITE_CLAIMS.feedbackNotes`) · F-BILL-002 and the LEARNING ROUTE amendment of F-ROUTE-001 (no seam with this spec)

---

## 1. Context

Today no grown-up can tell a learner "well done" through the product. Verified on `ea9049e4`:

- There is no message entity, route, table or learner surface. `git grep -i "message\|feedback"` in `packages/backend/src/routes` finds nothing of the kind; F-TCH-001 section 4 sends messaging to an F-NOTIF-001 that does not exist.
- The only adult-to-learner text field is `PlanItemSchema.note` (`packages/content-schema/src/schemas/plan-item.ts:12`, at most 80 characters). The console collects it, but `HomeworkAssignmentSchema` (`schemas/progress.ts:54-64`) has no note field and `apps/mobile/src/logic/homework/plan-derivation.ts` never reads it, so the learner never sees it.
- F-PAR-001 section 3.4 (spec still `draft`) describes a 10-second parent voice message (N5) that is local to one device. It was never built (`design/wireframes/parent/voice-recorder.md` only).
- The learner side already has the pieces a channel needs: an anonymous device principal per learner (F-SYNC-001), an inbox the app reads after every sync (`routes/sync.ts:111-131`, `store/membership-store.ts:89-93`), memberships that name the learner's family and classes, and a grown-up gate (F-PROF-001 section 10).
- The adult side has Clerk accounts, spaces, roles and the one access function `can()` (`packages/backend/src/lib/can.ts:36-77`). Anyone holding a live family join code becomes a family `caregiver` through the account path of `POST /api/spaces/:id/join` (`routes/spaces.ts:315`), the same code a child's device uses; this spec does not give such an account the right to send by default (section 6.1).
- `packages/i18n` depends on `@hangul-route/content-schema` (`packages/i18n/package.json`), so a text guard that needs the banned-word finder lives in `packages/i18n`, not in `content-schema` (section 6.4).
- D1 binds at most 100 parameters per statement (`IN_CHUNK = 90`, `packages/backend/src/db/d1.ts:223`), and Cloudflare counts every statement, also inside a batch, toward the per-invocation D1 query limit (50 on the Workers Free plan this project runs on, 1,000 on Paid). The send path is therefore set-based (section 7.4).

The owner wants teachers and parents to send feedback. Many learners are children, so the channel must be safe by construction, not by moderation alone: only linked adults the family trusts can send; the learner cannot type back; every message opens with a reviewed, translated encouragement; free text is short, filtered and visible to the learner's family; anyone at home can hide, report or stop a sender; a taken-back note stays visible to the family; and nothing in it shames, ranks or compares.

## 2. User stories

- As a **teacher**, I want to send one of my students a short, warm note after class ("Your reading is getting stronger" plus "Loved your work on ㄱ and ㄴ today"), and see the thank-you they pick, so my encouragement reaches them between lessons.
- As a **teacher**, I want to send the same encouragement to the whole class in one step, so I do not repeat myself 20 times.
- As a **teacher or parent reading a report**, I want "Send a note" right next to "went well" and "practice next", so I can encourage while the report is in front of me.
- As a **parent or grandparent**, I want to leave a note my child finds next time they open the app, signed "Grandma", so the family's support feels close even when we live far apart.
- As a **learner** of any age, I want to read notes from my teacher and family, keep them, and answer with one tap, without having to write anything.
- As a **parent**, I want to see every note my child receives, including notes from teachers and notes a sender took back, and to know which adult account wrote each family note, so I stay in charge of who talks to my child.
- As a **family owner**, I want to decide which other grown-ups in my family may send notes, and to stop one sender reaching my child, without having to report anyone.
- As an **adult self-learner** in a class, I want the same notes with no grown-up gate in my way and words that suit an adult.

## 3. Goals and non-goals

**Goals**

1. A linked adult (the family owner or a caregiver the owner allowed, or the teacher of a class the learner is in) sends a **note** made of one **preset encouragement**, plus an optional **short text** of at most 120 characters, plus an optional **suggested quest**.
2. The learner reads notes in the learner app: a card on Home while a note is new, a Notes list, a note page. Read state is kept and synced.
3. The learner answers only with one of four **preset reactions** (section 6.6). There is no free-text reply.
4. The family sees every note the learner receives (also taken-back ones), which adult account wrote each family note, and can hide, report or stop any sender, and can switch class notes to "encouragements only" or off.
5. Abuse is limited by design (who can send, filters, rate limits, a Worker switch) and handled when it happens (report, automatic hold, owner review).
6. Everything works offline on the learner side and is deleted with the learner.
7. A first-time grown-up finds the feature from the adult nav, the parent home, the report and the in-app grown-up zone (section 6.13).

**Non-goals** (section 4 lists the full out-of-scope set): learner-to-adult free text; adult-to-adult messaging; voice, images or files; push notifications; any statistic of who opened what.

## 4. Out of scope

- **Learner free-text replies, chat or threads.** Never (decision D1, section 11).
- **Parent to teacher messaging** and teacher to parent messaging: a later F-NOTIF spec (F-TCH-001 section 4).
- **Voice messages, pictures, stickers, attachments, links other than a quest in the bundle.** F-PAR-001 N5 is superseded (OD-12).
- **Push notifications, email or SMS to the learner.** The note waits in the app. (A later spec may add an email digest for adults; it is not this one.)
- **Read or reply statistics**: no open rate, no "unread for N days", no per-class or per-learner counts of notes, no sorting by opens (section 9).
- **Scheduling a note for later** and recurring notes.
- **School admins sending to students of classes they do not teach** (OD-6).
- **Delivering `PlanItem.note` to the learner.** That is a gap in F-PLAN-001 and needs its own amendment there; it may reuse this spec's text guard (`@hangul-route/i18n/note-text`) and is not built here.
- **An operator web screen for reports.** The owner reviews reports with the runbook queries (FB-13); a screen can come later.
- **A composer in the learner app.** Native store builds get the learner screens and the grown-up zone with the same code; composing, the sent list and the family view are console pages on app.hangulroute.com (F-APP-001). The in-app grown-up zone links there on web (section 6.10).
- **Any notes surface on hangulroute.com.** The intro site only shows the claim line (F-SITE-002 section 3.9) once FB-14 ships.

## 5. Vocabulary

| Term | Meaning |
|---|---|
| **note** | one message to one learner: a preset, an optional text, an optional suggested quest, a sender label, a time |
| **preset** | one encouragement line from a fixed, reviewed catalogue (section 6.3), stored as an id and rendered in the **viewer's** UI language |
| **text** | the optional free text an adult adds, at most 120 characters, shown as typed (never translated) |
| **sender label** | how the learner sees who wrote it: "Your teacher · <class name>" or a family relation picked from a list ("Grandma") — never an account's typed name |
| **sender account** | the adult account that sent the note; shown to the learner's family caregivers only (section 8.2), never to the learner |
| **reaction** | one of four preset answers a learner can pick on a note |
| **batch** | one send to several learners (the whole class or a chosen few): one note row per learner sharing a `batch_id` |
| **take back** | the sender withdraws a note: it leaves the learner's devices, stays visible to the family (status `withdrawn`) |
| **put away** | the learner hides a note on this device only, with no gate and nothing sent to the server |
| **hold** | a pause on an account's sending after reports (section 8.4) |
| **block** | a family's "Stop notes from this sender" for one learner (section 8.5) |
| **send grant** | the family owner's permission for one co-caregiver account to send notes in the family (section 6.1) |
| **notes mode** | per learner, what class notes deliver: `all`, `presets` (encouragements only, text dropped) or `off`. Family notes are always delivered. |

## 6. Behaviour

### 6.1 Who can send to whom

1. `can()` gains two actions (`packages/backend/src/lib/can.ts`):
   - `feedback.send`: the family `owner`; a family `caregiver` **only while the owner has granted it** (a row in `feedback_send_grants`, OD-17; code-joined caregivers start without it); class `teacher` and class `owner`. It is **not** cascaded to school admins through `ctx.parent` and not granted to a school-level `teacher` (OD-6). Because `can()` is synchronous over the membership context, the routes load the grant row with the membership and pass it in the context (`ctx.sendGrant: boolean`), so `can()` stays pure.
   - `feedback.oversee`: family `caregiver` / `owner`, granted or not. It lets an adult read, hide, report and block every note to a learner of that family, from any space. Hiding too much is the low-harm direction; every hide, report, block and setting change names the acting account to the other caregivers (section 8.2), so an unwanted adult is visible.
2. A note is sent **in a space** to a learner who is a current `student` member of that space (`memberships.member_kind = 'learner'`). A teacher can therefore reach only students of their own class; a caregiver only learners in their family space. Learner ids come from that space's roster; a learner id that is not a student of the space is answered `not_in_space` (no hint whether the learner exists elsewhere).
3. An archived space cannot send (`space_archived`).
4. The family's notes mode and blocks are applied **at send and again at delivery** (section 6.8). At send, a teacher whose student's family turned class notes off, or stopped this sender, sees the learner marked "Notes are off for this student" in the composer (the two look the same to the sender, so a block is never revealed) and the send skips that learner with reason `notes_off`; in `presets` mode the sender sees "Encouragement only" next to that learner and the learner gets the note without its text. At delivery, a mode or block changed later also applies to notes sent before the change.
5. A device approved through a teacher re-link (scope `class`, migration `0003_device_scope.sql`) sees class notes only; family notes stay with the family's own devices (the same rule as plans, `routes/sync.ts:117-126`, SEC-4).
6. A sender who loses `feedback.send` in the space (left the class or family, removed, or the owner withdrew the grant) stops reaching the learner: delivery rule 6 (section 6.8) drops their notes, and the family view shows them as "Not shown".

### 6.2 What a note contains

| Part | Required | Rule |
|---|---|---|
| preset | yes (OD-2) | one id of `NOTE_PRESET_IDS` whose `audience` allows the sender's role (section 6.3) |
| text | no | `checkNoteText` (section 6.4) passes; 1 to 120 characters after normalising |
| suggested quest | no (OD-13); **required with `next_try_this`** | one quest id that exists in the shared catalogue (`packages/content-schema/src/catalog`). Whether the learner can open it is the learner device's access rule (F-ENT-003 `isQuestOpen`): an open quest shows **Start**; a closed one shows the quest without Start and with the caption "Opens with the full route", and never a gate, a paywall link, a price or a plan word (section 6.5 item 3). The composer warns the adult beforehand (section 7.2, `console/note-composer.md`) |
| sender label | family only | one id of `FAMILY_LABEL_IDS`; default `family`. Teachers have no choice: "Your teacher" plus the class name the learner's app already knows from its memberships |

The learner never sees the adult's account name, email or picture (OD-5). The class name is typed by the teacher (40 characters, `SpaceSchema.name`) and already reaches the learner through `LearnerMembershipSchema.name`; this spec adds no new name on the learner side.

### 6.3 The preset catalogue

Fifteen presets, in four groups. Ids are frozen once shipped (a learner's stored note points at the id); wording may change in the dictionary. `audience` is who may pick it. English drafts are in Appendix A; the dictionary holds the final copy (`common.notes.presets`).

| Group | Id | Audience |
|---|---|---|
| effort | `effort_keep_trying` · `effort_proud` · `effort_practice_helps` | all |
| progress | `progress_new_letters` · `progress_reading` · `progress_writing` · `progress_listening` · `progress_new_card` | all |
| next step | `next_try_this` (needs a suggested quest) · `next_look_again` · `next_take_time` | all |
| warm | `warm_thinking_of_you` · `warm_cheering` | all |
| warm | `warm_see_you_in_class` | teacher |
| warm | `warm_learning_together` | family |

Wording rules for presets, reactions and every learner-facing string of this spec (tested in FB-5, section 13):

1. Second person, present or past tense, about effort or a concrete thing done. Never about speed, talent or comparison ("faster than", "best in class", "finally").
2. No banned word of `packages/i18n/src/banned-words.json`, learner **and** caregiver lists, in every locale.
3. No speaking words: no "say", "speak", "pronounce", "talk", "out loud" (owner decision 2026-10-10, F-ROUTE-001 header). Reading, listening and writing words only.
4. No age words, no "kids", no baby talk (CLAUDE.md section 1). A line an adult self-learner reads must not sound childish: on a self-managed profile (`gateOpensDirectly`) the learner page says "Report this note", not "Tell a grown-up".
5. Plain Pre-A1 English, at most 12 words per sentence, at most one exclamation mark per preset, no emoji. Presets and reactions contain no digits; a count in a UI line ("2 new notes") goes through the plural helper (`packages/i18n/src/plural.ts`).
6. Never conditional love or pressure ("if you practise, I will be happy", "don't let me down").
7. `next_*` presets are invitations, never instructions with a deadline. A preset never points at something the note may not carry (`next_look_again` reads "Let's look at your letters again together.", not "these letters").

### 6.4 The text guard (`packages/i18n/src/note-text.ts`, pure, 100 % covered)

The guard needs the banned-word finder of `packages/i18n` (`src/banned.ts` `findBannedWord`), and `packages/i18n` already depends on `@hangul-route/content-schema`, so the guard lives in `packages/i18n` (putting it in `content-schema` would make a workspace cycle). It is exported through a **subpath**, `@hangul-route/i18n/note-text` (`package.json` `exports` gains `"./note-text": "./src/note-text.ts"`), and imports only `./banned` (which reads `banned-words.json` and `./locales`), so the Worker bundle does not pull in the dictionaries. `packages/backend` gains the dependency `@hangul-route/i18n` in FB-3a; `apps/web` already has it. One function, used by the console before sending and by the Worker on every send (the Worker is the authority):

```ts
export const NOTE_TEXT_MAX = 120;
export type NoteTextProblem = 'empty' | 'too_long' | 'line_break' | 'link' | 'contact' | 'emoji' | 'tone' | 'invalid';
export function normalizeNoteText(raw: string): string;            // trim, NFC, runs of spaces and tabs -> one space
export function checkNoteText(raw: string): { ok: true; text: string } | { ok: false; problem: NoteTextProblem; word?: string };
```

Rules, in this order (the first problem found is returned):

1. `invalid`: a control character (U+0000-U+001F except tab, U+007F-U+009F), a bidi override (U+202A-U+202E, U+2066-U+2069), a lone surrogate, an invisible or format character that could hide a link or a number from the later rules (U+00AD, U+034F, U+061C, U+115F, U+1160, U+17B4, U+17B5, U+180B-U+180F, U+200B, U+200C, U+200E, U+200F, U+2060-U+2064, U+206A-U+206F, U+2800, U+3164, U+FE00-U+FE0E, U+FEFF, U+FFA0, U+FFF9-U+FFFB, U+E0000-U+E007F, U+E0100-U+E01EF; U+200D stays with rule 7), a mathematical letter or digit (U+1D400-U+1D7FF), or a run of more than two combining marks (U+0300-U+036F, U+1AB0-U+1AFF, U+1DC0-U+1DFF, U+20D0-U+20FF, U+FE20-U+FE2F), which would spill over the note.
2. `line_break`: CR, LF, U+2028 or U+2029. A note is one line.
3. `empty`: nothing left after `normalizeNoteText`.
4. `too_long`: more than `NOTE_TEXT_MAX` code points (`Array.from(text).length`), so Hangul and accented letters count as one each.
5. `link`: `://` anywhere or `www.` at the start of a token ("Awww." is not a link); or a domain-shaped token, case-insensitive: one or more labels of `[a-z0-9-]+` (one character is enough, so `t.me`, `m.me`, `x.com` and `t.co` are links) joined by dots and ending in a dot plus a TLD from the fixed list `NOTE_LINK_TLDS` (`com net org io co kr me app ly gg tv info biz xyz link site online us uk ca es mx edu gov page dev to so be gl ai ru jp live chat club gd cc`), followed by `/`, `:`, end, space or punctuation. `word` carries the matched token as typed so the console can quote it. Ordinary typos pass: "Good job.See you" and "Mr.Kim" have no listed TLD after the dot. A missing space before a word that is also a TLD ("you.Me") is caught; the console quotes it so the adult can add the space.
6. `contact`: any `@` or `﹫` (email or handle), or seven or more digits once spaces, dots, dashes, plus signs and brackets are removed, and once a single comma, slash, underscore, tilde, middle dot, bullet, other hyphen or dash, minus sign, wave dash or katakana middle dot between two digits is removed (phone numbers, account numbers; "Day 3, 4, 5" still passes because its commas are followed by spaces). A calendar date with a four-digit year (`2026.10.11`, `2026. 10. 11.`, `2026-10-11`, `10/12/2026`, `12.10.2026`) is set aside before counting, but only when no other digit touches it through separators ("Call 010 2026.10.11" is still a contact). The adult is told why (section 7.2).
7. `emoji`: code points in U+1F000-U+1FAFF, U+2600-U+27BF, U+FE0F or U+200D, and the emoji-presentation symbols outside those ranges: U+20E3, U+231A, U+231B, U+23E9-U+23F3, U+23F8-U+23FA, U+25FD, U+25FE, U+2934, U+2935, U+2B05-U+2B07, U+2B1B, U+2B1C, U+2B50, U+2B55, U+3030, U+303D, U+3297, U+3299. Explicit ranges, no Unicode property escapes (F-I18N-001 section 3.1, Hermes safety).
8. `tone`: `findBannedWord(text, locale, 'caregiver')` hits for **any** locale in `LOCALES` (the note may be written in any language and is read by a learner), unless the hit sits inside a word or phrase of the small allow-list `NOTE_TONE_ALLOW` for that locale (Korean matches substrings, so `뒤처리` must not trip `뒤처`; English and Spanish entries match whole tokens). The list is `en: missed you, behind you` (warm phrases: "We missed you today", "I am right behind you"; "You missed the quiz" and "You missed your chance" still fail) and `ko: 뒤처리`; it grows only with a test per entry. `word` carries the hit so the console can name it.

The link, contact and tone rules read a check-only copy of the normalised text: full-width ASCII folded to ASCII, `。` and `｡` read as `.`, circled letters and digits and superscript and subscript digits read as their ASCII letter or digit, and single combining marks dropped, so "ｋｉｍ．ｃｏｍ" and "kim.c̵om" read as "kim.com". The text that is stored and shown is the normalised text, and `word` quotes it as typed.

The guard does not judge meaning. Meaning is covered by the preset requirement, the family's view of every note, reports, blocks and holds (section 8).

### 6.5 Learner app: where notes appear

Behind `flags.notesEnabled` (`EXPO_PUBLIC_NOTES_ENABLED`, default off; `apps/mobile/src/config/flags.ts`).

1. **Home card** (`home/notes-card.md`). Shown for the active profile while it has at least one live, unread note that was not put away. One card, newest unread note first: sender label, the preset line, "New" pill, one primary button **Read**. With more than one unread note the card says how many are new ("2 new notes") and Read opens the Notes list instead of the note. No timer, no dismiss counter. Its place in the Home stack is row **2a** (after the Today mission cards, before the story card); FB-0 adds the row to F-ROUTE-001 section 6.4, which owns the table. Wide layout: right column.
2. **Notes list** (`notes/list.md`, new stack screen `Notes`). Every live note of the active profile that was not put away, newest first, grouped "New" then "Earlier". Each row: sender label, preset line, first words of the text, date, a reaction chip when one was picked. Entries: the Home card, and a **My notes** row on Profile, shown only when the flag is on **and** the profile has at least one class or family membership or at least one cached note (a self-learner with neither never sees it); a "New" pill while something is unread.
3. **Note page** (`notes/detail.md`, new stack screen `NoteDetail { noteId }`). Hoya in the `cheer` pose; the preset line large; the text below it, as typed, marked "From <sender label>"; the date; the suggested quest as a card: when `isQuestOpen(suggest.id)` (F-ENT-003 `useQuestAccess()`) the card has **Start** (opens `EpisodeDetail` / `QuestPlayer` as Journey does); when it is closed the card shows the quest title and art with the caption "Opens with the full route" (F-ENT-003's `learner.access.quest.closedCaption`), no Start, no button, no gate, no paywall route; the reaction row (section 6.6) with its disclosure line; at the bottom two quiet links: **Put this note away** (section 6.10 item 3) and **Tell a grown-up** ("Report this note" on a self-managed profile). Opening the page marks the note read (section 6.7).
4. Notes are per learner profile. Siblings on one device each see only their own. A profile switch changes the list.
5. Notes never block learning: no modal, no interruption of a quest, no sound on arrival.
6. A learner cannot delete a note from the server. Put away hides it on this device only. Old notes stay in "Earlier" until retention removes them (section 8.7); there is no warning before that.

### 6.6 Reactions (the only learner answer)

Four presets, picked with one tap on the note page under the heading **Answer with one tap**; the learner can change the pick (last one wins); there is no "remove":

| Id | Icon | English draft |
|---|---|---|
| `thanks` | `heart` (new) | Thank you |
| `will_try` | `pencil` | I will try it |
| `did_it` | `check-circle` | I did it |
| `happy` | `sparkle` | This made me happy |

- Nothing prompts the learner to react; there is no "Reply" call to action and no reminder.
- **Who sees the pick** is said on the page, before and after the pick, in one calm line: for a class note while the learner's notes mode is `all`, "Your teacher will see your answer." (`learner.notes.reactionSeenBy.teacher`); for a family note, "Your family will see your answer."; for a class note in `presets` mode the class sender gets no reaction (section 7.2), so the line reads "Your family will see your answer." The learner's family always sees reactions in its own view.
- The class sender sees the pick (section 7.2) and nothing else about the learner's reading (OD-8: no "Opened" for class senders by default). A note without a reaction is shown to the sender exactly like a note before any reaction: never "no reply".
- **Why preset reactions instead of none or free text (decision D1):** a free-text reply would let a child type personal details to an adult and would need human moderation of children's words; that is the main risk this channel must not create. No answer at all would leave adults unsure the note arrived and leave learners with no way to say thank you, which is part of the motivation the owner asked for. Four fixed ids carry gratitude and intent, contain no personal data, need no moderation, and cannot be used to arrange contact. They are learner data the teacher sees, so they are disclosed on the page, in the grown-up zone and in the family view, and are added to the teacher-visible consent items (section 7.7).

### 6.7 Read state

- A note becomes **read** when its note page opens (not when the Home card or the list shows it).
- `readAt` is set once and never cleared. It drives "New" on the learner's devices and the "Opened" status in the **family's** own views. A class sender never sees it (OD-8 default).
- Read state and reactions are written to the local store first and sent with the device's next sync (section 6.9).

### 6.8 Delivery rules (Worker, `GET /api/sync/learners/:id/inbox`)

The inbox gains `notes` and `notePrefs` (section 7.6). A note is delivered when all hold:

1. `status = 'live'` (not hidden, reported or withdrawn) and `created_at` within the last 180 days (section 8.7);
2. the learner is still a student member of the note's space, and the space is not archived;
3. the device may see the space (a class-scoped device: class spaces only);
4. for a class note, the learner's notes mode is not `off`; in `presets` mode the text is removed from the delivered row (`text: null`; the stored row keeps it for the sender and the family);
5. no family block of this sender for this learner exists (section 8.5);
6. the sender account still holds `feedback.send` in the note's space (still a teacher or owner of the class; still the family owner or a granted caregiver); otherwise the note is not delivered and the family view shows "Not shown";
7. at most the 30 newest such notes are sent (bounded inbox, about 15 KB at most).

The inbox query is one statement over `feedback_notes` joined with `memberships`, `spaces`, `learner_note_prefs`, `feedback_sender_blocks` and `feedback_send_grants` (rules 1-6 in SQL, `LIMIT 30`), so delivery adds one D1 query per inbox.

### 6.9 Offline and sync on the device

- `store/notes-store.ts` (zustand, persisted through `platform/storage` only, key `notes:<profileId>`) keeps the delivered notes, `readAt` and `reaction` per note, the local `putAway` set, a one-time `classNotesCardSeen` marker mirror, and a queue of pending writes.
- Apply inbox (`logic/notes/apply.ts`, pure): the inbox list is authoritative for **which** notes exist (a note missing from the inbox is gone: hidden, reported, withdrawn, expired, blocked, the sender lost the right, or the learner left the space); the device keeps local `readAt` / `reaction` that are not yet acknowledged, and takes the server's otherwise. `putAway` ids that are no longer in the inbox are dropped from the set. A note withdrawn while its page is open closes gently to the list ("This note was put away").
- The queue holds at most one pending state write per note (the newest pick replaces an older pending one) and at most one pending **report** per note, and is flushed before the inbox read in the same sync. A queued report hides the note on this device at once, so a worried learner is never left looking at it while offline, and apply inbox keeps that note hidden while its report is pending (the inbox may still list it until the report reaches the Worker). Hide, block and the notes-mode setting are **not** queued: they need a connection (the grown-up zone says so), because they must act on every device. A `404` for a note drops its pending write; `5xx` or offline keeps it for the next sync; a `409`/`422` drops it (the note changed on the server).
- With no network the Home card, list and page work from the cached notes. Nothing waits on the network.
- Merge on restore (F-SYNC-002, Rescue Code) needs nothing: notes live on the server and arrive with the first inbox on the new device. Read state is server state; `putAway` is device state and does not travel.

### 6.10 Grown-up zone in the app

Behind the gate (`PinEntry`, F-PROF-001; a self-managed learner's gate opens directly, `logic/profiles/gate-route.ts`). New `GrownUpDestination` values `NotesGrownUp` and `NoteReport`, and `PinEntry` gains the optional param `noteId?: string` (used with `next: 'NoteReport'`). Both land in FB-7 (navigation types, no screen), so FB-8's "Tell a grown-up" test can target them.

1. **Dashboard rows** (`parent/notes.md` A). `ParentDashboardScreen` shows, per local profile that has notes or memberships, one row **Notes for <learner>** with a "New" pill while a note arrived since the grown-up last opened that learner's notes. The row opens `NotesGrownUp { profileId }`. The dashboard does not list notes itself, so it does not grow with every note (it already holds F-APP-001's "Grown-up home" card and F-REPORT-001's "See report").
2. **Notes for <learner>** (`NotesGrownUpScreen`, `parent/notes.md` B): every delivered note of that profile, put-away ones marked "Put away on this device", sender label and full text, with **Hide from <learner>** and **Report** per note; the **class notes** setting (`all` / `presets` / `off`); the line "Teachers see the answer <learner> picks on their notes." (`caregiver.notes.disclosure`); and, on web only, **Send a note** which calls F-APP-001's `openGrownUpArea({ via: 'dashboard', target: '/parent/notes' })` (hidden on native and while F-APP-001 A-6 is not merged).
   - **Hide** calls its own device route (section 7.6): the note gets status `hidden` on every device and counts toward no hold (decision D8). **Report** opens the sheet of item 4.
   - The setting needs a full-scope device (a class-scoped device cannot change a family choice; the row says "Change this on a home device").
   - When the inbox carries a mode this app does not know or none at all (`notePrefs.classes === null`: a newer Worker's mode, or a prefs object without one), the setting row is left out and nothing is sent, so an older app never overwrites a newer choice.
   - Offline: Report stays enabled (queued, with a local hide at once); Hide and the setting are disabled with "Connect to the internet to do this."
3. **Put this note away** (learner page, **no gate**): hides the note on this device only (`putAway`), queues nothing and tells nobody. The learner sees "Put away. A grown-up can still see it." ("Put away. It is hidden on this device." on a self-managed profile, which may have no family) and returns to the list. It exists so a child alone with an upsetting note can always get it off the screen; the grown-up zone still lists it so an adult can report it.
4. **Tell a grown-up** (or "Report this note" on a self-managed profile) opens the gate with destination `NoteReport` and `noteId`, which shows the report sheet (`parent/note-report.md`) for that note: reasons `unkind`, `unsafe`, `not_for_me`, `other`; primary **Report and hide**; secondary **Just hide it** (full-scope device and online only; the same confirm as Hide, no report row, D8). The note leaves the learner's list at once (local) and on every device at the next inbox.
5. **One-time class-notes card.** The first time a class note reaches a learner whose family has not yet looked at the setting (`notePrefs.acknowledged === false`; never while `notePrefs.classes` is `null`), the grown-up zone shows one quiet card above that learner's notes: "Notes from classes: All notes." with **Keep** and **Change**. Either answer records the acknowledgement on the server (`PUT note-prefs` with `acknowledge: true`), so the card never returns on any device or in the console. No nag, no repeat.
6. When no grown-up is near, the learner can always put the note away or just close it. Nothing in the learner UI says the note will be "punished" or that anyone is "in trouble".

### 6.11 Copy, anti-shame and localisation

- Presets, reactions and family labels are ids rendered in the **viewer's** UI language: a learner with the Korean UI reads the Korean preset even if the teacher used the English console. Until a locale's strings pass native review they fall back to English (F-I18N-001 fallback, OD-15).
- The free text is shown as typed and is never machine-translated. It gets `lang="ko"` when it contains Hangul, otherwise the sender's console locale recorded on the note (`textLocale`), so screen readers pick a voice.
- Taught-content rules (romanization plus gloss) do not apply to a free text: it is a person's words, not lesson content. The note page shows it under "From <sender>" so it is never mistaken for a lesson.
- Dates: "Today", "Yesterday", otherwise a short date through `packages/i18n/src/format.ts`.
- No red, no danger colour, no "unread" warning anywhere on learner or adult screens.
- Family labels read as names an adult or a child can carry: "Your family", "Mom", "Dad", "Grandma", "Grandpa", "Aunt", "Uncle", "Your guardian", "Your partner" (for P6 partners and in-laws).
- "Your partner" is shown only on a profile whose learner type is `self` (`effectiveLearnerType(profile) === 'self'`, F-LEARN-001; an absent type reads as `child`), the adult learner it is meant for. On any other profile the app reads `partner` as "Your family" (`FAMILY_LABELS_SELF_LEARNER_ONLY`, FB-7 `view.ts`), so a family send to everyone, or a label picked by mistake, never shows a child "Your partner". The Worker does not refuse the label: the learner type lives only on the device, so the Worker cannot tell which recipients are adults, and the app rule already covers every learner screen.

### 6.12 Accessibility

- Every interactive target is at least `touchTarget`; body text at the body floor (18); the preset line uses the heading style of the page.
- The Home card is one focusable group announced as "New note from <sender label>: <preset line>. Read." (`a11y.notes.card`).
- Reactions are a radio group with a visible selected state that does not rely on colour (check mark plus label); the change is announced ("You picked: Thank you"); the disclosure line is part of the group's description.
- "New" is a text pill, never only a dot.
- The suggested quest card has the same label pattern as Journey quest cards; a closed quest card reads its title then "Opens with the full route" (F-ENT-003 `a11y.access.closed`).
- Reduced motion: Hoya's cheer is static; no arrival animation.
- Console: every field has a label; problems are linked with `aria-describedby`; the character counter is announced politely at 100 and at 120; the composer sub-view is a labelled dialog that returns focus to the button that opened it; after **Send** focus moves to the result line; the learner picker is a list of checkboxes with keyboard support; the family tabs are a tab list with arrow keys; nothing is reachable by hover only.

### 6.13 Console pages and entry points (app.hangulroute.com)

Routes follow F-APP-001 sections 3.2 and 3.8: a family space lives under `/parent`, a class or school under `/teach`, ids ride in `?id=`, and no learner name ever appears in a URL.

| Path | What | Built in |
|---|---|---|
| `/teach/space/notes?id=<classId>` | class notes: sent list (`console/notes-sent.md`) with **New note**; the composer opens as a sub-view (`&compose=1`) | FB-11a |
| `/parent/space/notes?id=<familyId>` | family notes: tabs **Received** (`console/family-notes.md`) and **Sent** (`console/notes-sent.md`), `&tab=received` (default) or `&tab=sent`; composer sub-view `&compose=1` | FB-11a (page, Sent tab), FB-12 (Received tab) |
| `/parent/notes`, `/teach/notes` | **hubs** (`console/notes-hub.md`): with one space of that persona where the account may send or oversee, a client `replace` to that space's notes page; with several, one row per space with **Notes** | FB-11b |

- `ROUTES.spaceNotes(id, kind, opts?: { learner?: string; compose?: boolean; quest?: string; tab?: 'received' | 'sent' })` (`apps/web/src/lib/console/routing.ts`, FB-10): `family` → `/parent/space/notes?id=…`, `class` and `school` → `/teach/space/notes?id=…`, the same kind rule as F-APP-001's `ROUTES.space(id, kind)`. `learner` is the opaque `profile:` id; `quest` a catalogue quest id.
- `app/(console)/parent/space/notes/page.tsx` re-exports the `/teach/space/notes` page component, as F-APP-001 does for plan, curriculum and settings. `/teach/space/notes?id=<familyId>` keeps working (same component); links are always generated with the persona prefix.
- **Composer as its own step.** "Send a note" and "New note" open the composer as a sub-view of the notes page (a modal dialog on wide windows, a full-height view on narrow ones), never inline above the lists. Closing it (Cancel, Back, Escape) returns to the list; the URL drops `&compose=1`. With `&learner=` that learner is preselected; with `&quest=` the suggested quest is prefilled. The family page auto-selects the learner when the family has exactly one.

**Entry points** (a first-time grown-up must find the feature without hunting):

1. **Adult nav** (F-APP-001 `lib/console/shell-nav.ts`, FB-11b): two items `{ id: 'parentNotes', persona: 'parent', href: '/parent/notes', labelKey: 'console.shell.nav.notes', enabled: notesEnabled }` and `{ id: 'teacherNotes', persona: 'teacher', href: '/teach/notes', … }`. Label "Notes". Not shown while the flag is off (F-APP-001: an item whose page is not built is not shown).
2. **Parent home** (F-APP-001 `/parent`, FB-11b): each learner card gains **Send a note** → `ROUTES.spaceNotes(familyId, 'family', { compose: true, learner })`.
3. **Roster card** (`app/(console)/teach/space/page.tsx`, class and family, FB-11a): **Send a note** with the learner preselected, and a **Notes** action in the roster header.
4. **Report action slot** (F-REPORT-001 section 3.6, the slot that section reserves; FB-11b): **Send a note** next to "went well" and "practice next" on the learner report, learner preselected. From a P1 `letters_revisit` line that carries a `questId`, the link adds `&quest=<questId>`; it **never** preselects a preset (section 9 still holds: nothing suggests an encouragement from a score).
5. **In-app grown-up zone**, web only: **Send a note** on `NotesGrownUp` (section 6.10 item 2).
6. **Never** from the learner app's learner screens, the intro site (hangulroute.com) or the paywall.

Strings: F-APP-001's card line "Reports, messages and billing for your account" and its nav sketch say "messages"; this feature is called **notes** everywhere (also in F-SITE-002). FB-11b sets F-APP-001's `caregiver.grownUpHome` line to "Reports, notes and billing for your account." if it is on `main` with "messages" by then; the F-APP-001 spec text is aligned in whichever docs PR of the two merges second.

## 7. Data and API (all additive)

### 7.1 Shared schemas (`packages/content-schema/src/schemas/feedback.ts`, exported from `src/index.ts` by append)

```ts
export const NOTE_PRESET_IDS = [/* the 15 ids of section 6.3, in that order */] as const;
export const NOTE_PRESET_AUDIENCE: Readonly<Record<NotePresetId, 'all' | 'teacher' | 'family'>>;
export const NOTE_PRESETS_NEED_SUGGEST: ReadonlySet<NotePresetId> = new Set(['next_try_this']);
export const NOTE_REACTION_IDS = ['thanks', 'will_try', 'did_it', 'happy'] as const;
export const FAMILY_LABEL_IDS = ['family', 'mom', 'dad', 'grandma', 'grandpa', 'aunt', 'uncle', 'guardian', 'partner'] as const;
export const FAMILY_LABELS_SELF_LEARNER_ONLY: ReadonlySet<FamilyLabelId> = new Set(['partner']);   // shown only to a self learner (section 6.11)
export const NOTE_REPORT_REASONS = ['unkind', 'unsafe', 'not_for_me', 'other'] as const;
export const NOTES_MODES = ['all', 'presets', 'off'] as const;
export const NOTE_SEND_MAX_LEARNERS = 300;
export const NOTE_LEARNER_ID_MAX = 80;

export const NoteIdSchema = z.string().regex(/^note:[a-z0-9-]{8,64}$/);
export const NoteSuggestSchema = z.object({ kind: z.literal('quest'), id: z.string().min(1).max(64) }).strict();

/** POST /api/spaces/:id/notes body. `.strict()`: an early or stale client fails loudly. */
export const NoteSendSchema = z.object({
  to: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('learners'), ids: z.array(z.string().max(NOTE_LEARNER_ID_MAX).regex(/^profile:[a-z0-9-]+$/)).min(1).max(NOTE_SEND_MAX_LEARNERS)
      .refine((ids) => new Set(ids).size === ids.length) }).strict(),   // distinct ids: one send never delivers a note twice to one learner
    z.object({ kind: z.literal('everyone') }).strict(),
  ]),
  presetId: z.enum(NOTE_PRESET_IDS),
  text: z.string().max(400).optional(),          // length and content checked by checkNoteText
  textLocale: UiLocaleSchema.optional(),         // the console locale
  suggest: NoteSuggestSchema.optional(),         // required when presetId is in NOTE_PRESETS_NEED_SUGGEST (422 bad_preset)
  label: z.enum(FAMILY_LABEL_IDS).optional(),    // family spaces only; on a class space the Worker answers 422 label_not_allowed
}).strict()
  .superRefine((body, ctx) => { /* textLocale is required when text is present (issue path ['textLocale']) */ });

/** One delivered note (inbox row). Lenient on the device: one bad row is dropped, not the inbox. */
export const InboxNoteSchema = z.object({
  id: NoteIdSchema,
  spaceId: z.string(),
  from: z.object({ role: z.enum(['teacher', 'family']), label: z.enum(FAMILY_LABEL_IDS).nullable().catch(null) })
    .transform((from) => (from.role === 'family' ? from : { role: from.role, label: null })),   // a class note never shows a family label
  presetId: z.string().max(64),                  // a plain string on the wire: an unknown id renders the fallback line
  text: z.string().max(400).nullable(),
  textLocale: UiLocaleSchema.nullable().catch(null),
  suggest: NoteSuggestSchema.strip().nullable().catch(null),   // read without .strict(): a field a newer Worker adds never costs the quest
  createdAt: z.string(),
  readAt: z.string().nullable(),
  reaction: z.string().max(32).nullable(),       // unknown ids are ignored by the app
});

export const NotePrefsSchema = z.object({
  classes: z.enum(NOTES_MODES).nullable().catch(null),   // null = unknown: a mode this app does not know (newer Worker) or none
  acknowledged: z.boolean().catch(true),                 // read-only on the wire: the family has seen the class-notes card (section 6.10 item 5); unreadable or missing reads as given
});
export const NOTE_PREFS_DEFAULT = Object.freeze({ classes: 'all', acknowledged: false });     // notePrefs absent (older Worker)
export const NOTE_PREFS_UNREADABLE = Object.freeze({ classes: null, acknowledged: true });    // notePrefs not an object
export const NotePrefsPutSchema = z.object({ classes: z.enum(NOTES_MODES), acknowledge: z.literal(true).optional() }).strict();   // family route (7.2)
export const NoteDevicePrefsPutSchema = NotePrefsPutSchema.extend({ attest: z.enum(['grown_up_pin', 'self']).optional() }).strict();   // device route (7.6)
export const NoteStatePutSchema = z.object({ read: z.literal(true).optional(), reaction: z.enum(NOTE_REACTION_IDS).optional() })
  .strict().refine((v) => v.read !== undefined || v.reaction !== undefined);
export const NoteReportSchema = z.object({ reason: z.enum(NOTE_REPORT_REASONS), attest: z.enum(['grown_up_pin', 'self']).optional() }).strict();   // device route (7.6)
export const NoteAccountReportSchema = NoteReportSchema.omit({ attest: true }).strict();   // family route (7.2): never attest
```

- An unknown `presetId` on the device renders `common.notes.presetFallback` ("A note for you"), so a newer Worker never breaks an older app. An unknown family label renders "Your family".
- A preset in `NOTE_PRESETS_NEED_SUGGEST` whose `suggest` reads as `null` (a suggestion this app cannot read) or names a quest this app does not have also renders `common.notes.presetFallback`, with the text and without a quest card (FB-7 `view.ts`), so a note never points at a quest it does not carry (section 6.3 rule 7). The note itself is kept.
- `SyncInboxSchema` (`schemas/sync.ts:131-151`) gains, appended after `transfers`:
  `notes: lenientArray(InboxNoteSchema).default([])` and `notePrefs: NotePrefsSchema.default(NOTE_PREFS_DEFAULT).catch(() => ({ ...NOTE_PREFS_UNREADABLE }))`.
  An old Worker omits both (defaults apply); an old app strips both (zod). An unreadable value never falls back towards a looser setting: an unknown or missing mode reads as `null` (section 6.10 item 2 leaves the setting row out), and an unreadable or missing acknowledgement reads as given (the one-time card does not come back). Only an absent `notePrefs` reads as the server defaults. Both constants are frozen and every parse returns its own object, so a consumer that changes a parsed inbox can never change a later fallback.

### 7.2 Account routes (`packages/backend/src/routes/notes.ts`, mounted at `/api/spaces`, Clerk account auth through `requireAccount` / `accountActor`)

| Method and path | Action | Body / query | Answer |
|---|---|---|---|
| `GET /:id/notes/recipients` | `feedback.send` on the space; `NOTES_SEND` on | — | `{ learners: [{ id, displayName, notes: 'all' \| 'presets' \| 'off', today: n }] }`; `displayName` follows `anonymizeRoster` (`rosterName`); `notes` is `off` for a blocked sender too (never revealed); `today` = notes this account sent that learner in the last 24 hours, from **one** grouped query |
| `POST /:id/notes` | `feedback.send`; `NOTES_SEND` on | `NoteSendSchema` | `201 { batchId, sent: n, skipped: [{ learnerId, reason: 'notes_off' \| 'limit' }], presetsOnly: [learnerId] }` |
| `GET /:id/notes?before=<iso>&learner=<id>` | `feedback.send` **or**, in a family, `feedback.oversee` | — | notes sent **in this space** (by any adult of it), newest first, 50 rows per page. Without `learner`, the notes of one `everyone` batch collapse into one row `{ batchId, to: 'everyone', size, presetId, text, suggest, label, createdAt, status: 'sent' \| 'withdrawn', mine }` (never a count of opens or reactions); every other note is its own row `{ id, batchId, to: 'learner', learnerId, displayName, presetId, text, suggest, label, createdAt, status, reaction, mine }`. With `learner`, only that learner's rows, each with its own status. `{ rows, next }` |
| `POST /:id/notes/:noteId/withdraw` | `feedback.send`, the note is this space's **and** was sent by this account (`mine`) | `{ batch?: true }` | `200 { withdrawn: n }`; the row becomes `status = 'withdrawn'`, `withdrawn_at = now` (never deleted, section 8.3); with `batch: true` every live note of its batch is withdrawn; a reported note answers `409 note_reported` (single) or is skipped (batch) |
| `GET /:familyId/learners/:learnerId/notes?before=` | `feedback.oversee` on the family, learner is its student | — | every note to this learner from **any** space, newest first: space kind and name, sender label, **sender account display name or email for family notes** (section 8.2), text always included, status `live` / `opened` / `hidden` / `reported` / `withdrawn` / `not_shown`, who acted (`hiddenBy`, `reportedBy`: an account name for family actions, `"device"` for device actions, except rule 8.2-c) |
| `POST /:familyId/learners/:learnerId/notes/:noteId/hide` | `feedback.oversee` | — | `200`; status `hidden`, `hidden_at`, `hidden_via = 'family'`, `acted_by_account_id` |
| `POST /:familyId/learners/:learnerId/notes/:noteId/report` | `feedback.oversee` | `NoteAccountReportSchema` (no `attest`) | `201`; status `reported`; a `feedback_reports` row; hold check (section 8.4). Any note to the learner may be reported, a family note and a withdrawn note included; the reporter's own note answers `422 own_note` (take it back instead) |
| `POST /:familyId/learners/:learnerId/blocks` / `DELETE …/blocks/:senderRef` | `feedback.oversee` | `{ noteId }` (the block names the sender of that note; the account id never travels to the client) | `201` / `200`; section 8.5. `GET …/blocks` lists `{ senderRef, label: 'Your teacher · <class>' \| '<account name>', createdAt }`; `senderRef` is an opaque HMAC of the account id per family |
| `GET`/`PUT /:familyId/learners/:learnerId/note-prefs` | `feedback.oversee` | `NotePrefsPutSchema` | the prefs, plus `updatedBy` (account name or `"device"`) |
| `GET /:familyId/note-senders` / `PUT /:familyId/note-senders/:accountId` | family **owner** only (`space.manage`) | `{ canSend: boolean }` | the family's adult members with `canSend`; writes or deletes the `feedback_send_grants` row (section 6.1) |

- Status mapping for the **class** sender: `not_shown` when the row is `hidden` or `reported` (the sender is never told which, or why), when the learner's notes mode is now `off` or a block exists, or when the sender lost `feedback.send`; `withdrawn` when taken back; otherwise `sent`. `reaction` is returned only while the learner's notes mode is `all` and the row is live; in `presets` or `off` mode it is `null`. `opened` is never returned to a class sender (OD-8).
- Status mapping in a **family** space (the viewer has `feedback.oversee`): the same, plus `opened` when `read_at` is set. A device-reported family note is shown to its own sender account as `not_shown`, never as "reported via device" (section 8.2-c).
- Errors (one envelope, `envelope.ts`): `401` no session; `403 not_allowed` (no action, also a caregiver without a grant); `403 sending_paused` (hold); `404 not_found` (space or note, without saying which; also both send routes while `NOTES_SEND` is off); `409 space_archived`; `422 note_text { problem, word? }`; `422 bad_preset` (audience, or `next_try_this` without `suggest`); `422 bad_suggest` (unknown quest); `422 label_not_allowed`; `429 too_many { scope: 'learner' \| 'account', retryAfter }`.
- `to: everyone` resolves to the space's current student members at send time.

### 7.3 Limits (`packages/backend/src/lib/note-limits.ts`)

Durable counters in the existing `rate_hits` table (migration `0005_class_transfer.sql:90-95`); keys `note:acct:<accountId>`, `note:pair:<learnerId>:<accountId>`, `note:learner:<learnerId>`, `note:report:acct:<accountId>`, `note:report:learner:<learnerId>`. A "day" is the rolling 24 hours the transfer limits use (`routes/transfers.ts:276-279`); the existing bounded `purgeRateHits` keeps the table small. Limits are checked with the set-based methods of section 7.4, never one query per learner.

| Limit | Value (OD-14) | When exceeded |
|---|---|---|
| notes from one account to one learner per day | 3 | that learner is skipped with `limit` (the batch still sends to the others) |
| notes to one learner from all senders per day | 10 | skipped with `limit` |
| notes from one account per day (all learners) | 400 | `429 too_many { scope: 'account' }`, nothing sent |
| learners in one send | 300 (`NOTE_SEND_MAX_LEARNERS`) | `422` by the schema |
| sends (batches) from one account per minute | 10 | `429` (per-isolate limiter, `lib/rate-limit.ts`) |
| family reports from one account per day | 20 | `429` |
| device reports per learner per day | 10 | `429` |

`learnerRateKeys(learnerId)` (`db/transfer-types.ts:202`) gains `note:learner:<learnerId>` and `note:report:learner:<learnerId>`, and `deleteLearner` also runs `DELETE FROM rate_hits WHERE key LIKE 'note:pair:<learnerId>:%'` (learner ids match `^profile:[a-z0-9-]+$`, so they hold no `%` or `_`).

### 7.4 Migration `NNNN_feedback_notes.sql` and `Db` (FB-2; `NNNN` = the next free prefix when FB-2 merges, checked by `scripts/check-migrations.mjs`)

Additive only: six new tables, their indexes, nothing existing touched; safe to re-run (`IF NOT EXISTS`); a Worker that predates it never reads it.

```sql
CREATE TABLE IF NOT EXISTS feedback_notes (
  id                  TEXT PRIMARY KEY,                                   -- note:<uuid>
  learner_id          TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  space_id            TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  sender_account_id   TEXT NOT NULL,                                      -- accounts.id; never shown to the learner
  sender_role         TEXT NOT NULL CHECK (sender_role IN ('teacher','family')),
  sender_label        TEXT,                                               -- family label id; NULL for teachers
  batch_id            TEXT NOT NULL,
  batch_kind          TEXT NOT NULL CHECK (batch_kind IN ('everyone','learners')),
  preset_id           TEXT NOT NULL,
  body                TEXT,                                               -- checked by checkNoteText; NULL when none
  body_locale         TEXT,
  suggest_kind        TEXT CHECK (suggest_kind IS NULL OR suggest_kind = 'quest'),
  suggest_id          TEXT,
  status              TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','hidden','reported','withdrawn')),
  hidden_via          TEXT CHECK (hidden_via IN ('family','device')),
  acted_by_account_id TEXT,                                               -- the caregiver who hid it from the console; NULL for device actions
  created_at          TEXT NOT NULL,
  read_at             TEXT,
  reaction            TEXT,
  reaction_at         TEXT,
  hidden_at           TEXT,
  withdrawn_at        TEXT,
  CHECK (sender_role = 'family' OR sender_label IS NULL),
  CHECK (status <> 'hidden' OR (hidden_at IS NOT NULL AND hidden_via IS NOT NULL)),
  CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_learner ON feedback_notes(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_space   ON feedback_notes(space_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_sender  ON feedback_notes(sender_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_batch   ON feedback_notes(batch_id);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id                  TEXT PRIMARY KEY,                                   -- notereport:<uuid>
  note_id             TEXT NOT NULL REFERENCES feedback_notes(id) ON DELETE CASCADE,
  learner_id          TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  sender_account_id   TEXT NOT NULL,
  reason              TEXT NOT NULL CHECK (reason IN ('unkind','unsafe','not_for_me','other')),
  via                 TEXT NOT NULL CHECK (via IN ('family','device')),
  evidence            TEXT NOT NULL,                                      -- reporting account id or device id; never a name
  reporter_key        TEXT NOT NULL,                                      -- the reporting family (section 8.4)
  attest              TEXT CHECK (attest IN ('grown_up_pin','self')),     -- device reports only (a client claim)
  created_at          TEXT NOT NULL,
  reviewed_at         TEXT,
  outcome             TEXT CHECK (outcome IN ('kept_hidden','restored','sender_held'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_sender ON feedback_reports(sender_account_id, created_at);

CREATE TABLE IF NOT EXISTS feedback_sender_holds (
  account_id  TEXT PRIMARY KEY,
  reason      TEXT NOT NULL CHECK (reason IN ('reports','unsafe','owner')),
  created_at  TEXT NOT NULL,
  lifted_at   TEXT
);

CREATE TABLE IF NOT EXISTS learner_note_prefs (
  learner_id          TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  classes             TEXT NOT NULL DEFAULT 'all' CHECK (classes IN ('all','presets','off')),
  acknowledged_at     TEXT,                                               -- the one-time class-notes card was answered
  updated_at          TEXT NOT NULL,
  updated_via         TEXT NOT NULL CHECK (updated_via IN ('family','device')),
  updated_by_account  TEXT                                                -- NULL for device changes
);

CREATE TABLE IF NOT EXISTS feedback_sender_blocks (
  learner_id          TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  sender_account_id   TEXT NOT NULL,
  family_space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_by_account  TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  PRIMARY KEY (learner_id, sender_account_id)
);

CREATE TABLE IF NOT EXISTS feedback_send_grants (
  space_id            TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,  -- a family space
  account_id          TEXT NOT NULL,
  granted_by          TEXT NOT NULL,
  granted_at          TEXT NOT NULL,
  PRIMARY KEY (space_id, account_id)
);
```

**`Db` methods** (`packages/backend/src/db/types.ts`, `d1.ts`, `memory.ts`). Every method that takes a list is **set-based**: it binds the whole list as **one JSON array parameter** and reads it with SQLite's `json_each(?)` (supported by D1), so the number of statements does not grow with the list and the 100-parameter cap never applies:

- `studentsOf(spaceId, learnerIds)` — one statement (`member_id IN (SELECT value FROM json_each(?))`).
- `notePrefsFor(learnerIds)`, `blocksFor(learnerIds, senderAccountId)` — one statement each.
- `countRateHitsByKeys(keys, since)` — one `SELECT key, COUNT(*) … WHERE key IN (SELECT value FROM json_each(?)) AND at >= ? GROUP BY key`.
- `insertNotes(rows)` and `addRateHits(rows)` — one `INSERT … SELECT … FROM json_each(?)` each, run together in one `d1.batch` with the hold re-check, so a send is all-or-nothing.
- `notesForLearner(learnerId, deviceScope, limit)` (the inbox query of section 6.8), `notesForSpace(spaceId, before, limit, learnerId?)`, `notesForOversight(learnerId, before, limit)`, `getNote(id)`, `setNoteRead(id, at)` (only when `read_at IS NULL`), `setNoteReaction(id, reaction, at)`, `hideNote(id, via, at, actedBy?)`, `withdrawNote(id, at)`, `withdrawBatch(batchId, senderAccountId, at)` (live rows only), `insertNoteReport(row)`, `countReportersAgainst(accountId, since)` (distinct `reporter_key`), `getSenderHold(accountId)`, `putSenderHold(row)`, `getNotePrefs(learnerId)`, `putNotePrefs(row)`, `putBlock(row)`, `deleteBlock(learnerId, senderAccountId)`, `listBlocks(learnerId)`, `getSendGrant(spaceId, accountId)`, `putSendGrant(row)`, `deleteSendGrant(spaceId, accountId)`, `deleteNotesForMembership(learnerId, spaceId)` (live, hidden and withdrawn rows; reported rows stay for review), `purgeNotes(before, reportedBefore, liftedBefore, limit)`.

**Statement budget.** A send runs at most **16** D1 statements whatever the number of learners (auth and membership 3, hold 1, grant 1, students 1, prefs 1, blocks 1, counts 1, the insert batch 3, the lazy purge 4), well under the Free plan's 50. A sqlite test sends to 1 and to 300 learners and asserts the same prepared-statement count (≤ 16). `GET recipients` runs at most 6.

`deleteLearner` (`d1.ts:291`) deletes `feedback_reports`, `feedback_notes`, `learner_note_prefs` and `feedback_sender_blocks` rows of the learner explicitly, children first, inside its existing transaction, each statement only when `presentTables` finds the table (the pattern of the transfer tables, F-SPACE-002 section 4.7), so an erase never fails on a Worker that runs before the migration. `RESET_TABLES` (`d1.ts:231`) and `memory.ts` `reset()` gain the six tables, children first.

### 7.5 Cleanup on leave and removal

When a learner's student membership of a space ends (the device leave route `POST /:id/leave` in `routes/spaces.ts:325`, used by Leave in Profile, or an adult removing the learner with `DELETE /:id/members/learner/:memberId` in `routes/spaces.ts:337`), the same request calls `deleteNotesForMembership(learnerId, spaceId)`. When an adult account leaves or is removed from a family (`DELETE /:id/members/account/:memberId`), its `feedback_send_grants` row is deleted in the same request; delivery rule 6 already stops its notes. The learner's devices drop those notes at the next inbox (section 6.9).

If `CLASS_TRANSFER` is ever enabled (it stays off), the transfer completion batch (`d1.ts:582`, which deletes the source membership) must also delete the learner's live, hidden and withdrawn notes of the source space; FB-3b adds a test that fails when that path deletes the membership without the notes, so the gap cannot ship silently.

### 7.6 Device routes (`packages/backend/src/routes/sync.ts`, `authorizeDevice`)

| Method and path | Scope | Body | Answer |
|---|---|---|---|
| `GET /learners/:id/inbox` (existing) | full or class | — | gains `notes`, `notePrefs` (section 6.8) |
| `PUT /learners/:id/notes/:noteId/state` | full or class (class: class notes only) | `NoteStatePutSchema` | `200 { readAt, reaction }`; idempotent; `404` when the note is not delivered to this device (gone, hidden, other learner) |
| `POST /learners/:id/notes/:noteId/hide` | full | — | `200`; status `hidden`, `hidden_via = 'device'` (grown-up zone and the "Just hide it" button only; the app sends it after the gate) |
| `POST /learners/:id/notes/:noteId/report` | full or class | `NoteReportSchema` (`attest` optional) | `201`; status `reported`; report row with `via = 'device'`, `evidence = deviceId`, `reporter_key` per section 8.4; hold check |
| `PUT /learners/:id/note-prefs` | full only | `NoteDevicePrefsPutSchema` (`NotePrefsPutSchema` plus an optional `attest`) | `200`; `403 scope` on a class-scoped device |

A report from a device is allowed from a class-scoped device on purpose: a learner on a class tablet must always be able to get a note away.

### 7.7 Consent, disclosure and the teacher-visible list

- **Where families learn what a teacher sees.** The only learner data a class sender receives from this feature is the **reaction** (OD-8 default; no read receipt). It is disclosed where families and learners actually look: the learner's note page (section 6.6, `learner.notes.reactionSeenBy.*`), the grown-up zone (`caregiver.notes.disclosure`, section 6.10) and the console family view (`console.notes.family.disclosure`, "Teachers see the answer <learner> picks on their notes. They do not see when a note was read."). In `presets` or `off` mode the class sender gets no reaction at all (section 7.2).
- `TEACHER_VISIBLE_ITEM_IDS` (`schemas/transfer-consent.ts:98-106`) also gains `note_replies`, English text "The answer {learner} picks on a note from the teacher", so the class-transfer sheet stays complete if the owner ever enables it. `TRANSFER_CONSENT_TEXT_VERSION` (`schemas/transfer.ts:42`) is bumped in FB-1 (the per-locale hash test forces it) and the old `'transfer-2026-10'` **stays in** `ACCEPTED_CONSENT_TEXT_VERSIONS` (`transfer.ts:44`), so the dormant flow does not reject a sheet signed before the change. `CLASS_TRANSFER` stays unset. F-REPORT-001 RP-W2 also bumps the version (its `activity` sentence) and merged first, as `'transfer-2026-10b'`, so FB-1 bumps it to **`'transfer-2026-10c'`**: one pinned hash over both text changes (the RP-W2 `activity` sentence and the `note_replies` item), with `ACCEPTED_CONSENT_TEXT_VERSIONS` = `['transfer-2026-10c', 'transfer-2026-10b', 'transfer-2026-10']`, so every earlier version stays accepted; a test asserts that every pinned version is in `ACCEPTED_CONSENT_TEXT_VERSIONS`. FB-1's interim name `'transfer-2026-10-notes'` never reached main and is not accepted.
- A new constant `TEACHER_VISIBLE_NOTE_FIELDS = { reaction: 'note_replies' }` pins that mapping in a test, the way `TEACHER_VISIBLE_ROSTER_FIELDS` pins roster fields. Choosing OD-8's alternative adds `readAt` to it, and the disclosure lines change with it in the same PR.
- No consent is needed for a learner to **receive** notes: no personal data of the learner leaves the device by receiving one. Family control is the notes mode, the one-time class-notes card (section 6.10 item 5), the family view of every note, hide, report and block. Whether class notes start at `all` for a child is OD-3.

### 7.8 The Worker switch `NOTES_SEND` (`packages/backend/src/lib/notes-switch.ts`)

- `notesSendEnabled(env)` is true only when `env.NOTES_SEND === 'enabled'` (the `CLASS_TRANSFER` pattern, `lib/transfer.ts:46`). It is a dashboard text variable on `hangul-route-api`, kept across deploys by `keep_vars = true` (`apps/api/wrangler.toml`), so the owner turns sending on or off in a minute without a deploy or an app build.
- While it is off, `GET /:id/notes/recipients` and `POST /:id/notes` answer `404 not_found` before auth or body checks; the console shows "Sending notes is not open yet." Every other route works, so lists, take back, the inbox, hide, report, block, oversight and the prefs keep working during an abuse wave.
- `GET /health` gains `features.notesSend: boolean` so the owner can check it took effect.

## 8. Privacy and safety

### 8.1 Data minimisation

- The learner sends nothing but four kinds of facts: a note id was opened, a reaction id, a report reason id, the notes mode. No free text ever leaves a learner device through this feature. Put away is local only.
- The server stores the adult's text, the sender's account id and the learner id. The learner sees neither the account id nor the account's name.
- The Worker never logs note text (no `console.log` in production code, CLAUDE.md section 8) and puts no note text, label or name in an error answer.

### 8.2 Who sees what

| Viewer | Sees |
|---|---|
| learner (own device) | delivered notes with sender label, preset, text (unless `presets` mode for class notes), suggested quest |
| class sender and co-teachers of the same class | notes sent in that class, status `sent` / `withdrawn` / `not_shown`, and the reaction while the learner's mode is `all`; never "opened" (OD-8) |
| family caregiver (`feedback.oversee`) | every note to the learner from every space, also withdrawn ones (labelled "Taken back by the sender"), with status (including "Opened"), text, reaction, **the sending account's display name or email for family notes** (adult to adult inside the family), who hid, reported or blocked (an account name, or "on a device"), and the list of family adults who may send |
| teacher of another class | nothing |
| school admin | nothing (no cascade) |
| owner (operator) | report rows and the reported note's text through the runbook queries (FB-13) |

Rules:
- **(a)** The teacher's account name or email is never shown to the family; a class note is "From <class name> (teacher)".
- **(b)** The family owner sees the adult members list with a **Can send notes** toggle each (family settings page, `console/family-notes.md` D); other caregivers see the list read-only.
- **(c)** A family note that a learner reported **from a device** is shown to the sender's own account as "Not shown" only, never "Reported" or "via device", so an adult at home is never told that the child reported them. Other caregivers see "Reported on a device".

### 8.3 Abuse handling

1. **Before it happens:** only linked adults can send, and in a family only the owner and caregivers the owner allowed (6.1); every note starts with a reviewed preset (OD-2); text is short and filtered (6.4); limits (7.3); a learner cannot reply in words (6.6); the Worker switch (7.8).
2. **When it happens:** any grown-up at home can hide (no record against the sender), report (a record) or stop the sender for that learner (8.5); a learner can always put a note away or ask for a grown-up from the note page; a reported note disappears from every device at the next inbox and from the sender's list as `not_shown`.
3. **Take back keeps the evidence.** Withdrawing a note removes it from the learner's devices but never erases it: the family view keeps it with its text and "Taken back by the sender", and the family can still report it. So a sender cannot deliver something, wait for it to be read, and erase it before a caregiver looks. Withdrawn rows follow the normal 180-day rule (8.7).
4. **Hold** (section 8.4) stops an account from sending to anyone.
5. **Review:** the owner checks open reports with the runbook query every day (OD-11) and records an `outcome`.

### 8.4 Automatic hold

- After every report the Worker counts reports against the sender's account in the last 30 days from **distinct reporting families** (`countReportersAgainst`, distinct `reporter_key`). `reporter_key` is: for `via = 'family'`, `family:<familyId>` of the route; for `via = 'device'`, `family:<id>` of the learner's family membership, or `device:<deviceId>` when the learner has none. So one parent with two children, or two profiles on one family tablet, counts once.
- A `feedback_sender_holds` row is inserted when the count reaches 2 (OD-10), or at once on an `unsafe` report that comes from a family account (`via = 'family'`) or from a device with `attest = 'grown_up_pin'`. Other `unsafe` device reports (no grown-up attestation, for example a class tablet) hide the note and go to the top of the daily review queue (FB-13) without an automatic hold.
- While a row with `lifted_at IS NULL` exists, `POST /:id/notes` answers `403 sending_paused` and the console shows "Sending notes is paused for this account. Write to hello@hangulroute.com." The account's other console features are unaffected. Only the owner lifts a hold (runbook, sets `lifted_at`). A hold never hides earlier notes by itself; reported notes are already hidden.

### 8.5 Stopping one sender (family block)

- **Stop notes from this sender** on any received note in the family view (`console/family-notes.md`) inserts `feedback_sender_blocks (learner_id, sender_account_id)`. From then on that sender's notes to this learner are not delivered (rule 6.8-5), earlier ones included, and the sender's composer shows the learner as "Notes are off for this student" (indistinguishable from the notes mode). It is not a report and counts toward no hold.
- The Received tab's settings disclosure lists stopped senders ("Your teacher · <class>" or the family adult's account name) with **Allow again**.
- A family co-caregiver is usually better handled by the owner switching off **Can send notes**; the block works for any sender.
- This and the report and hide actions answer App Store guideline 1.2 for user-generated content (filter, report, block, contact), recorded in the App Review notes (FB-13).

### 8.6 Child-safety checks this spec passes

- No ads, no tracking of note content, no third-party service sees a note.
- Local-first learner data: the device works offline; the server keeps only what delivery and oversight need.
- No new personal data linked to an account (verifiable parental consent rule): notes link an adult's words to a learner the adult is already linked to; the family decides which co-caregivers may write.
- No public or comparative display: no note is shown to anyone but the learner, the sending space and the learner's family.
- No student name in any URL: console paths carry the space id and an opaque learner id only (`?id=<spaceId>&learner=<profile:...>`).
- No commerce through a note: a suggested quest the learner cannot open shows no gate, paywall link, price or plan word (6.2).

### 8.7 Retention and deletion

| Data | Kept until |
|---|---|
| live, hidden or withdrawn note | 180 days after `created_at` (OD-9), then purged; never delivered after 180 days even before the purge runs |
| reported note and its report rows | 90 days after the report, then purged (both) |
| a note of a space the learner left | deleted when the membership ends (7.5); reported rows follow the 90-day rule |
| learner deleted | every note, report, pref and block row of the learner, in the `deleteLearner` transaction |
| space deleted | cascade (`ON DELETE CASCADE` on `space_id`, `family_space_id`) |
| hold rows | kept while active; lifted rows purged 365 days after `lifted_at` |
| send grants | while the account is a member of the family (7.5) |
| device copy | replaced by every inbox; dropped with the profile (`store/profile-removal.ts` clears `notes:<profileId>`) |

The purge is bounded and runs in two ways, so the "kept until" promise holds even when nobody sends:

1. **Lazy**: every `POST /:id/notes` and every family oversight read call `purgeNotes(now - 180 d, now - 90 d, now - 365 d, 200)`.
2. **Daily**: a Cron Trigger in `apps/api/wrangler.toml` (`[triggers] crons = ["17 11 * * *"]`, allowed on the Free plan) calls a `scheduled` handler that `apps/api/src/index.ts` exports next to `fetch` (`export default { fetch: app.fetch, scheduled }`); it runs the bounded note purge and the existing `purgeRateHits`, at most 5 rounds of 200 rows.

Every read also filters by age (live, hidden and withdrawn notes older than 180 days, reported notes whose report is older than 90 days), so purge lag is never visible.

The public privacy page gains one line about notes (FB-13; English-authoritative drafts, F-I18N-001 L10): who can send, what the learner can send back, what a teacher sees, how long notes are kept, how to hide, report, stop a sender and delete.

## 9. Anti-shame rules for adult screens

- The sent list is ordered by send time only. No sorting or filtering by reacted or not.
- No counts of unopened notes per learner, per class or per space; no open rate; no "last opened" chip on the roster. Class senders never see "opened" at all (OD-8).
- Status words are neutral: "Sent", "Opened" (family views only), "Not shown", "Taken back". There is no "Unread", "Ignored", "No reply" or a time since sending.
- The composer never suggests who "needs" a note based on progress, and never offers a preset tied to a low score. The report's action slot preselects the learner and may prefill a quest from a P1 line; it never preselects a preset.
- A batch to the whole class shows one line ("Sent to 18 students") and never lists who has not reacted.
- Family view copy (caregiver surface) passes the caregiver banned list.

## 10. Telemetry (Worker first)

Names are appended to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9`) in FB-1, and the exact-list test is updated (TELEMETRY-NAMES-2 rule 2). The API Worker must be deployed with FB-1 before any app build that sends them (rule 1); FB-8 and FB-9 are merged only after that deploy. The console has no telemetry client (F-PLAN-002 section 3.11), so adult actions send no events. Rows go to `docs/roadmap/TELEMETRY-NAMES-2.md` section M in FB-0.

**Every `notes.*` event is sent without `profileId`**, so the server never holds a per-learner log of which notes were opened. The Worker enforces it: `keptEventFields` in `lib/server-events.ts` (shared by `POST /api/telemetry` and the Worker's own events since F-REPORT-001 RP-W1) never stores a `profileId` for a name that starts with `notes.`, and keeps, per name, only the payload keys of the table below in their documented shapes (`NOTES_PAYLOAD_RULES`, the pattern of the `browse.*` filter): codes from `NOTE_PRESET_IDS`, `NOTE_REACTION_IDS`, `NOTE_REPORT_REASONS` and `NOTES_MODES`, `fromRole` and `via` from their two values, booleans, and counts that are whole numbers 0-30 (the inbox delivers at most 30 notes, section 6.8 rule 7). Every other key and every value of another shape is dropped, whatever a client sends (FB-1, added after its reviews on 2026-10-12).

| Name | Payload (ids, codes and counts only) | Emitted by |
|---|---|---|
| `notes.card_shown` | `{ unread }` once per app session when the Home card first shows | FB-8 |
| `notes.list_viewed` | `{ notes, unread }` | FB-8 |
| `notes.note_opened` | `{ presetId, fromRole: 'teacher' \| 'family', hasText, hasSuggest, suggestOpen }` | FB-8 |
| `notes.reaction_picked` | `{ reaction, fromRole, changed }` | FB-8 |
| `notes.suggest_started` | `{ fromRole }` | FB-8 |
| `notes.report_sent` | `{ reason, via: 'note_page' \| 'grown_up_zone' }` | FB-9 |
| `notes.prefs_changed` | `{ classes }` | FB-9 |

Never in a payload: note text, note id, batch id, sender label, space name or id, account id, learner name, profile id.

## 11. Decisions made in this spec

| # | Decision | Why |
|---|---|---|
| D1 | The learner answers only with four preset reactions | section 6.6 |
| D2 | One-way channel per space; a note belongs to the space it was sent in | the space is what links an adult to a learner and what the family can see |
| D3 | Preset ids rendered in the viewer's language; free text untranslated | correct copy in every UI language without machine translation of a person's words |
| D4 | Notes live on the server, not in the progress snapshot | they are adult-authored, need oversight and deletion; the snapshot stays learner-owned and `ADDITIVE_FIELDS` is untouched |
| D5 | The family can always see and act on every note to its learner, including taken-back ones | the strongest single safety control; it costs nothing to teachers who write kind notes |
| D6 | Inbox is authoritative for which notes exist; read state and reactions are server state | one source of truth across siblings' devices and restores |
| D7 | A Worker switch `NOTES_SEND` gates only the two send routes, default off; safety routes are never switched | the owner can stop sending in a minute without a deploy or a native rebuild; hide, report and oversight keep working during an incident (replaces the earlier "no Worker flag") |
| D8 | Hide is not a report | a family that only wants less noise must not put a mark against a teacher |
| D9 | Take back is a soft state | a sender must not be able to erase what the family oversight relies on |
| D10 | The text guard lives in `packages/i18n` behind a subpath export | `i18n` already depends on `content-schema`; the reverse would be a cycle |
| D11 | Send-path queries are set-based (`json_each`) | a fixed statement count per send, under D1's per-invocation limit on the Free plan |

## 12. Owner decisions (each has a default that applies until the owner answers)

| # | Question | Default (applied) | Alternatives | PRs it would change |
|---|---|---|---|---|
| OD-1 | How can the learner answer? | Four preset reactions (section 6.6) | no answer at all; preset reactions plus a "Show my teacher I read it" only | FB-1, FB-4a, FB-8, FB-11a |
| OD-2 | Must every note start with a preset? | Yes; text optional | allow text-only notes for family senders | FB-1, FB-3a, FB-11a |
| OD-3 | Class notes for a child before a guardian chooses | `all` (presets and text), changeable by the family; the one-time card (6.10 item 5) tells the family | `presets` until a guardian opts in; `off` until opted in | FB-4a (default value), FB-9, FB-12 |
| OD-4 | Text length | 120 characters | 80 (as `PlanItem.note`); 200 | FB-1b |
| OD-5 | How the sender is named to the learner | teacher: "Your teacher · <class name>"; family: a relation from a list; never the account name | let teachers type a display name, checked by the text guard | FB-1, FB-3a, FB-5 |
| OD-6 | Who can send in a class or school | class teacher / owner; not school admins | school admins too | FB-3a (`can()`) |
| OD-7 | Free or paid | Free for every linked adult; no plan check, no billing surface | paid spaces only | FB-3a, FB-11a |
| OD-8 | What does a class sender see about the learner? | the reaction only, while the learner's mode is `all`; no "Opened" | "Opened" and the reaction (adds `readAt` to `TEACHER_VISIBLE_NOTE_FIELDS` and changes the disclosure lines); nothing | FB-1, FB-3b, FB-5, FB-8, FB-11a |
| OD-9 | Retention | 180 days (also withdrawn notes); reported 90 days from the report | 90 days; one school year | FB-2, FB-3b |
| OD-10 | When is a sender held automatically? | reports from 2 distinct families in 30 days, or 1 `unsafe` report from a family account or a PIN-attested device | 3 families; only manual holds | FB-4b-device |
| OD-11 | How does the owner learn of reports? | a daily check with the runbook query | an email to hello@ on each `unsafe` report (needs an email provider) | FB-13 |
| OD-12 | F-PAR-001 N5 voice message | Superseded by this channel; the F-PAR-001 rewrite drops N5 | keep N5 as a later add-on | none here (F-PAR-001 text) |
| OD-13 | Suggested quest in a note | Included, one quest; a closed quest shows "Opens with the full route" without Start | leave out | FB-1, FB-8, FB-11a |
| OD-14 | Limits | 3 per sender per learner per day, 10 per learner per day, 400 per sender per day, 300 learners per send | stricter per-learner limit | FB-3a |
| OD-15 | Korean and Spanish | ship English; ko / es presets fall back to English until a native review passes | hold the flag until ko / es are reviewed | FB-5, FB-14 |
| OD-16 | Where the console notes pages live | app.hangulroute.com under the persona prefixes (`/parent/space/notes`, `/teach/space/notes`, hubs `/parent/notes`, `/teach/notes`), per F-APP-001 | — (decided by F-APP-001; kept as a row so earlier references resolve) | FB-10, FB-11a, FB-11b |
| OD-17 | Which family adults may send | the family owner always; a co-caregiver only after the owner turns on **Can send notes** for that account (default off for code-joined accounts) | every caregiver can send (the earlier draft) | FB-2, FB-3a, FB-4b-family, FB-12 |
| OD-18 | What "Take back" does | soft: the note leaves the learner's devices, stays in the family view for 180 days and can still be reported | hard delete allowed while `read_at IS NULL` (a true retraction of an unread note) | FB-2, FB-3b, FB-11a, FB-12 |
| OD-19 | When may the Worker switch `NOTES_SEND` be turned on? | by the owner after FB-14 is deployed and the runbook is read | — | FB-13, FB-14 |

## 13. Tests

| File | Level | What |
|---|---|---|
| `packages/i18n/src/__tests__/note-text.test.ts` | unit, 100 % (i18n target) | every problem code and its order; Hangul and accents count as one; 120 passes, 121 fails; `://`, `www.`, listed-TLD domains (`kim.com`, `a-b.co.kr/x`); **false positives pass**: "Good job.See you", "Mr.Kim", "ㄱ.ㄴ", "3.5"; `@`, seven digits across separators, emoji ranges, bidi overrides; banned words in en / es / ko incl. Korean substrings and the `NOTE_TONE_ALLOW` exception (`뒤처리` passes); `word` returned for `tone` and `link`; `normalizeNoteText` idempotent; the subpath module imports no dictionary file (import scan) |
| `packages/content-schema/src/__tests__/feedback.test.ts` | unit | `NoteSendSchema` strict (unknown key fails), label only enum (incl. `partner`), 300-id cap, distinct ids, `NOTE_LEARNER_ID_MAX` (80) id cap; `FAMILY_LABELS_SELF_LEARNER_ONLY` holds `partner` only; `NOTE_PREFS_DEFAULT` and `NOTE_PREFS_UNREADABLE` pinned and frozen; `InboxNoteSchema` accepts unknown preset and reaction strings, keeps a quest suggestion with an extra field, keeps a `next_try_this` note whose suggestion it cannot read (suggest `null`), nulls a family label on a class note; `NoteDevicePrefsPutSchema` takes `attest`, `NoteAccountReportSchema` refuses it; `NoteStatePutSchema` refuses an empty body; `NotePrefsSchema` has no field defaults (a missing mode reads as `null`, a missing acknowledgement as `true`), an unknown mode reads as `null` and keeps the acknowledgement, an unreadable acknowledgement reads as `true`; `NOTE_PRESETS_NEED_SUGGEST` holds `next_try_this` |
| `packages/content-schema/src/__tests__/sync.test.ts` (append) | unit | an inbox without `notes` / `notePrefs` parses with defaults; one malformed note is dropped, the rest and the plans survive; a `notePrefs` that is not an object reads as `NOTE_PREFS_UNREADABLE`, a partial one never as `all`; every fallback is a fresh object (changing one parsed inbox leaves the constant and the next parse unchanged) |
| `packages/content-schema/src/__tests__/transfer-consent.test.ts` (append) | unit | `note_replies` exists with text; version bumped to `transfer-2026-10c` over the RP-W2 text (hash test; the current text without `note_replies` hashes to the pinned `transfer-2026-10b`, and also with the earlier `activity` sentence to the pinned `transfer-2026-10`); `transfer-2026-10b` and `transfer-2026-10` still accepted; every pinned version is accepted (the list only grows); `TEACHER_VISIBLE_NOTE_FIELDS` maps `reaction` only |
| `packages/content-schema/src/__tests__/telemetry.test.ts` (append) | unit | exact list includes the seven `notes.*` names |
| `packages/backend/src/__tests__/telemetry.test.ts` (append) | integration | the Worker accepts the seven names with their documented payloads; a `notes.*` event posted with a `profileId` is stored without one, an ordinary event keeps it; a note id, space id, label, text or profile id inside a `notes.*` payload is not stored |
| `packages/backend/src/lib/__tests__/server-events.test.ts` (append) | unit | `keptEventFields` never keeps a `profileId` on a `notes.*` event and keeps per name only the documented keys in their shapes (codes, booleans, counts 0-30); smuggled ids, labels and text are dropped; a `notes.*` name without rules keeps nothing |
| `packages/backend/src/lib/__tests__/can.test.ts` (append) | unit | `feedback.send` for family owner, for a family caregiver only with `sendGrant`, class teacher / owner; not for school admin over a class, not for a school teacher; `feedback.oversee` family caregiver and owner with or without a grant |
| `packages/backend/src/__tests__/notes-send.test.ts` | integration (memory and `test:sqlite`) | `NOTES_SEND` unset answers 404 on both send routes before auth, other routes unaffected; send to learners and to everyone; `not_in_space`; archived space; preset audience; `next_try_this` without suggest 422; label on a class refused; text problems answered 422 with `problem`; skipped `notes_off` (mode and block look the same) and `limit`; `presetsOnly`; account limit 429; hold 403; caregiver without grant 403; **statement count**: a send to 1 and to 300 learners prepares the same number of statements, at most 16; recipients `today` from one query |
| `packages/backend/src/__tests__/notes-list.test.ts` | integration (memory and `test:sqlite`) | list paging and statuses; an `everyone` batch collapses to one row without counts and splits per learner with `learner=`; class sender never gets `opened`; reaction null in `presets` / `off`; withdraw own note sets `withdrawn` (row kept); withdraw a co-adult's note 403; batch withdraw skips reported rows; withdraw a reported note 409; another space's teacher 404; leave and removal cleanup; account removal deletes its grant; the transfer-completion guard test (7.5) |
| `packages/backend/src/__tests__/notes-device.test.ts` | integration (memory and `test:sqlite`) | inbox delivery rules 1-7 of section 6.8 incl. class scope, `presets` stripping text, block, sender lost the right; 30 cap; one statement for delivery; state PUT idempotent, `readAt` set once, reaction last-wins; 404 for a hidden or withdrawn note; report from a class-scoped device allowed; prefs from a class-scoped device 403; prefs `acknowledge` sets `acknowledged`; hold after 2 distinct families, **not** after two profiles of one family; immediate hold on `unsafe` from a family or PIN-attested device, none from an unattested device |
| `packages/backend/src/__tests__/notes-family.test.ts` | integration (memory and `test:sqlite`) | oversight lists withdrawn notes with text and label; sender account name on family notes, never on class notes; family report of a family note allowed, of the reporter's own note `422 own_note`; a device-reported family note reads `not_shown` to its sender and "Reported on a device" to another caregiver; block and allow again; `senderRef` never equals an account id; note-senders owner-only, grant on and off |
| `packages/backend/src/__tests__/notes-retention.test.ts` | integration | 180-day filter before purge (live, hidden, withdrawn); purge bounds; reported 90-day rule; the `scheduled` handler runs the bounded purges; `deleteLearner` removes all learner tables and works when the tables are missing (pre-migration Worker); `reset()` empties the six tables |
| `scripts/__tests__/check-migrations` (existing) | script | the new prefix is unique |
| `packages/i18n/src/__tests__/notes-messages.test.ts` | unit | every preset id, reaction id, family label id and report reason has en text; the rules of section 6.3 on every `common.notes`, `learner.notes` string (banned learner and caregiver lists in en / es / ko, no speaking words, no digits, no emoji, at most 12 words per sentence, length budget); "Report this note" exists for self-managed profiles; `console.notes` and `caregiver.notes` pass the caregiver list; `viewer` third person in caregiver strings |
| `packages/design-system/src/components/Icon/__tests__/glyphs.test.ts` (append) | unit | `note`, `heart` exist and use the stroke helpers |
| `apps/mobile/src/logic/notes/__tests__/*.test.ts` | unit, 100 % (business logic) | `apply.ts` (inbox authoritative, pending writes kept, server ack replaces local, gone notes removed, put-away ids pruned, withdrawn-while-open signal); `queue.ts` (one pending write per note, flush order, 404 / 409 / 5xx handling); `view.ts` (New / Earlier grouping without put-away notes, Home card selection and count, sender label from memberships, unknown preset and label fallback, `partner` read as "Your family" unless the profile's learner type is `self`, the fallback line for a `NOTE_PRESETS_NEED_SUGGEST` preset whose suggest is `null` or an unknown quest, `lang` choice, **suggest open vs closed** through an injected `isQuestOpen`, the reaction disclosure line by role and mode, **My notes row shown only with a membership or a cached note**, self-managed "Report this note"); `copy.ts` selectors |
| `apps/mobile/src/store/__tests__/notes-store.test.ts` | unit (platform lane) | persistence through `platform/storage` only; profile removal clears the key; sibling isolation; put away survives a restart and is not sent |
| `apps/mobile/src/screens/notes/__tests__/*.test.tsx` | component | Home card states; list empty / new / earlier; note page marks read on open, reaction radio group with the disclosure line, open suggest Start navigates, **closed suggest shows the caption and no Start, no gate, no paywall route**, Put this note away hides it without a gate, Tell a grown-up opens the gate with `NoteReport` and `noteId` |
| `apps/mobile/src/screens/parent/__tests__/NotesGrownUpScreen.test.tsx` | component | dashboard row with New pill opens the screen; notes listed with put-away marker; hide, report sheet with Report and hide and Just hide it; prefs disabled on a class-scoped device; offline: Report enabled, Hide and prefs disabled; one-time card answers once; Send a note on web only |
| `apps/web/src/lib/console/__tests__/notes.test.ts` | unit, 100 % (verification logic) | composer validation mirrors `checkNoteText` with friendly messages (link quotes the token); recipient rows (`notes_off`, `presets`, limit line); quest picker marks closed quests only when `contentGatingEnabled()` and the space is unlicensed; `next_try_this` needs a quest; status line words (no "Opened" for class); family view grouping; no sorting by status (asserted); `ROUTES.spaceNotes` prefixes and options |
| `apps/web/src/app/__tests__/notes-page.test.tsx` | component | class view and family view with tabs; composer opens as a dialog and returns focus; `&learner=` and `&quest=` prefill; single learner auto-selected; flag off renders nothing and hides every entry; anonymized roster names in the picker; hubs redirect with one space and list with several; nav items only with the flag; parent home and report action slot links carry ids only |
| `apps/mobile/e2e/notes.spec.ts` (FB-14) | e2e, Playwright on the PWA build with a stubbed API | inbox note shows on Home, open marks read, react, go offline, react again, back online flushes; put away; withdrawn note leaves the list |
| `apps/web/e2e/notes.spec.ts` (FB-14) | e2e over the console build with a stubbed API | compose from the roster, text problem message, send to everyone, sent list statuses; family Received and Sent tabs, block and allow again; no sideways scroll at 320 / 375 / 768 |

Coverage targets: `docs/tests/coverage-targets.md` rows for `packages/content-schema` (100 %), `packages/i18n` (100 %, the guard), `packages/backend` (90 %), mobile business logic (90 % now, 100 % target), web verification logic (90 %).

## 14. Rollout and PR breakdown

### 14.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| FB-0 | `docs`: this spec; the nine wireframes; `docs/roadmap/TELEMETRY-NAMES-2.md` section M; F-ROUTE-001 section 6.4 row 2a; `docs/blueprints/10-app-map.md` screen rows; specs and wireframes README index rows; one-line cross-references in F-TCH-001 section 4 and F-PAR-001 section 3.4 | S | — |
| FB-1 | `feat(content-schema)`: `schemas/feedback.ts`, inbox fields, `note_replies` consent item + version bump (old version kept accepted), `TEACHER_VISIBLE_NOTE_FIELDS`, seven telemetry names (append) | M | FB-0 |
| FB-1b | `feat(i18n)`: `src/note-text.ts` (guard, `NOTE_LINK_TLDS`, `NOTE_TONE_ALLOW`), subpath export `./note-text`, tests at 100 % | S | FB-0 |
| FB-2 | `feat(api)`: migration `NNNN_feedback_notes.sql` (additive, six tables), set-based `Db` methods in types / memory / d1, `deleteLearner` extension, `RESET_TABLES` and memory reset, `learnerRateKeys` keys; sqlite round-trip and statement-count tests. **Merge and deploy before FB-3a / FB-4a** | M | FB-1 |
| FB-3a | `feat(backend)`: `can()` actions with `sendGrant`, `lib/note-limits.ts`, `lib/notes-switch.ts` (`NOTES_SEND`, default off) and `/health` field, recipients and send routes, hold check on send, dependency `@hangul-route/i18n` | M | FB-1b, FB-2 deployed |
| FB-3b | `feat(backend,api)`: sent list, soft withdraw, membership-leave and account-removal cleanup, transfer-completion guard test, bounded purge (lazy on send and oversight reads), daily Cron Trigger and `scheduled` export | M | FB-3a |
| FB-4a | `feat(backend)`: inbox `notes` / `notePrefs` (delivery rules 1-7, one query) and the device state route | S | FB-2 deployed |
| FB-4b-device | `feat(backend)`: device hide / report / prefs (with `acknowledge`) routes, `reporter_key`, automatic hold | M | FB-4a |
| FB-4b-family | `feat(backend)`: family oversight / hide / report / prefs / blocks routes, note-senders (grants) routes, rule 8.2-c | M | FB-3b, FB-4b-device |
| FB-5 | `feat(i18n)`: `common.notes` (presets, reactions, family labels, fallback), `learner.notes`, `caregiver.notes`, `console.notes` (incl. `console.shell.nav.notes`), `a11y.notes` in en; ko / es entries left to the F-I18N-001 review process; copy tests | M | FB-1 |
| FB-6 | `feat(design-system)`: icons `note`, `heart` | S | FB-0 |
| FB-7 | `feat(mobile)`: `logic/notes/*`, `store/notes-store.ts`, `sync-api` methods, inbox hook in `membership-store`, queue flush before inbox, profile-removal key, `flags.notesEnabled` (default off), `GrownUpDestination` `'NotesGrownUp' \| 'NoteReport'` and `PinEntry.noteId?` (types only) | M | FB-1, FB-5 |
| FB-8 | `feat(mobile)`: Home card (row 2a), `Notes` and `NoteDetail` screens (open and closed suggest, put away, disclosure line, Tell a grown-up / Report this note), Profile row with its condition, telemetry emits | M | FB-6, FB-7, design mocks, FB-1 names on the Worker, FB-4a deployed, F-ENT-003 E3-2 merged (`useQuestAccess`) |
| FB-9 | `feat(mobile)`: dashboard rows, `NotesGrownUpScreen`, report sheet (Report and hide, Just hide it), prefs, one-time class-notes card, web-only Send a note (`openGrownUpArea`, shown once F-APP-001 A-6 is merged) | M | FB-8, FB-4b-device deployed |
| FB-10 | `feat(web)`: `lib/console/notes.ts` (API client, view models, validation messages, quest-picker marks), `ROUTES.spaceNotes(id, kind, opts)`, `notesEnabled()` in `config.ts` (default off) | M | FB-1, FB-1b, FB-5; the quest-picker marks use F-ENT-003 E3-1a `freeRouteQuestIds` and E3-9 `contentGatingEnabled()` and are left out until both are merged |
| FB-11a | `feat(web)`: notes page `/teach/space/notes` and its `/parent/space/notes` re-export; sent list (`console/notes-sent.md`); composer sub-view (`console/note-composer.md`) with `&learner` / `&quest` prefill and closed-quest marks; Sent tab on the family page; roster-card **Send a note** and roster **Notes** | M | FB-10, design mocks, FB-3b deployed |
| FB-11b | `feat(web)`: hubs `/parent/notes`, `/teach/notes` (`console/notes-hub.md`); `ADULT_NAV` items (after F-APP-001 A-5a); **Send a note** on parent-home learner cards (after A-5b); **Send a note** in the F-REPORT-001 insight action slot (after RP-7a); the "notes" wording of F-APP-001's card line | S | FB-11a; each entry waits for its host PR and is left out until then |
| FB-12 | `feat(web)`: family Received tab (`console/family-notes.md`): every note incl. withdrawn, sender account names, hide, report, stop sender and allow again, class-notes setting with the one-time card and the disclosure line; **Can send notes** toggles on the family settings page | M | FB-11a, FB-4b-family deployed |
| FB-13 | `docs`: owner runbook section (open reports query with unattested `unsafe` first, record an outcome, place and lift a hold, turn `NOTES_SEND` on and off, delete a note on request); privacy page line in `landing.ts` legal (English); App Review notes for UGC (filter, report, hide, block, hold, contact `hello@hangulroute.com`) in `docs/launch/app-store-submission.md` | S | FB-4b-family |
| FB-14 | `test` + `chore`: mobile and web e2e; flip both client flags to default on (English; ko / es per OD-15); flip F-SITE-002 `SITE_CLAIMS.feedbackNotes` to `true` with its copy test; owner step: set `NOTES_SEND=enabled` (OD-19). The native release goes through Xcode with the flag on only after the Worker switch exists (it does from FB-3a) | S | all above |
| FB-15 | `feat(web,content-schema)`: optional **Preview** link per quest in the composer's picker, `openBrowse({ kind: 'quest', id }, 'notes')` (F-BROWSE-001 section 4.3); appends `'notes'` to `BrowseSourceSchema`. Never rendered before BR-10 ships | S | FB-11a, F-BROWSE-001 BR-10 |

### 14.2 Sequence notes

- FB-2 is the only migration. Server first: its merge applies the migration to production D1 (`apps/api` deploy command), then FB-3a / FB-4a may merge.
- Sending stays impossible in production until the owner sets `NOTES_SEND=enabled`, which happens after FB-3b, FB-4b-device and FB-4b-family are deployed (FB-14). So the safety routes always exist before the first real note.
- FB-1 appends to `packages/content-schema/src/index.ts`, `schemas/sync.ts`, `schemas/telemetry.ts` and its test; keep the edits append-only so parallel rebases stay mechanical (implementation brief).
- FB-8 edits `HomeScreen.tsx` and `ProfileScreen.tsx`, which other specs edit; keep the edit to one block each (CLAUDE.md section 10) and follow the Home order table.
- FB-9 edits `ParentDashboardScreen.tsx`, which F-APP-001 A-7, F-REPORT-001 RP-9 and F-BROWSE-001 BR-12 also edit; one block (the rows) only.
- FB-11a adds one button to the roster card and one action to the roster header in `app/(console)/teach/space/page.tsx`; F-REPORT-001 RP-7a and F-ROUTE-001 R-9a edit the same card: keep each edit to the link itself.
- FB-11b touches F-APP-001's `shell-nav.ts` and parent home, and F-REPORT-001's action slot, by appending only.
- FB-3b changes `apps/api/src/index.ts` from `export default app` to `export default { fetch: app.fetch, scheduled }` and adds `[triggers]` to `apps/api/wrangler.toml`; the deploy command is unchanged.

### 14.3 Dependencies

- Shipped: F-SPACE-001 (spaces, roles), F-SYNC-001 (inbox, devices), F-CONSOLE-001 (console shell), F-AUTH-002 (Clerk), F-I18N-001 (dictionary, banned words), F-PROF-001 (gate), F-LEARN-001 (self-managed learners), F-SPACE-002 T-3b (`rate_hits`, `presentTables`).
- Siblings (same request; each seam waits only on the PR named): F-APP-001 A-5a (nav registry), A-5b (parent home, `ROUTES.space(id, kind)`), A-6 (`openGrownUpArea`) · F-REPORT-001 RP-7a (insight action slot) · F-ENT-003 E3-1a (`freeRouteQuestIds`), E3-2 (`useQuestAccess`), E3-9 (`contentGatingEnabled()` in the console) · F-BROWSE-001 BR-10 (`openBrowse`) · F-SITE-002 S-2 (`SITE_CLAIMS`). Until a host PR is merged, the entry or mark that needs it is not rendered; nothing in this spec blocks them.
- Design: mocks in `design/screens/` for the learner card, list, note page, grown-up screen, composer, sent list, family view and hub (CLAUDE.md section 5), before FB-8, FB-9, FB-11a, FB-11b, FB-12.
- Not needed: F-PAR-001 (still draft); this spec does not depend on its rewrite.

## Appendix A — English drafts (final copy is the dictionary's)

**Presets (`common.notes.presets`)**

| Id | Draft |
|---|---|
| `effort_keep_trying` | You keep trying. That is how we learn. |
| `effort_proud` | I am proud of how hard you worked. |
| `effort_practice_helps` | Your practice is helping you. |
| `progress_new_letters` | You learned new letters. Great work! |
| `progress_reading` | Your reading is getting stronger. |
| `progress_writing` | Your writing looks neat and clear. |
| `progress_listening` | You listen so carefully. |
| `progress_new_card` | You earned a new card. Well done! |
| `next_try_this` | Try this quest next. I think you will like it. |
| `next_look_again` | Let's look at your letters again together. |
| `next_take_time` | Take your time. There is no rush. |
| `warm_thinking_of_you` | Thinking of you. Have fun learning today. |
| `warm_cheering` | Hoya and I are cheering for you. |
| `warm_see_you_in_class` | See you in class soon. |
| `warm_learning_together` | We love learning Korean with you. |

Fallback for an unknown id: "A note for you."

**Reactions:** Thank you · I will try it · I did it · This made me happy.
**Family labels:** Your family · Mom · Dad · Grandma · Grandpa · Aunt · Uncle · Your guardian · Your partner.
**Teacher label:** Your teacher · {class}.
**Learner lines:** Home card "A note from {sender}" / "{n} new notes" · button "Read" · list title "My notes" · empty "No notes yet. Notes from your teacher or family will show here." · groups "New", "Earlier" · note page "From {sender}" · suggest "Try this quest" with "Start" · closed suggest "Opens with the full route" (F-ENT-003) · reactions heading "Answer with one tap" · seen-by "Your teacher will see your answer." / "Your family will see your answer." · "Put this note away" · put away "Put away. A grown-up can still see it." (self-managed: "Put away. It is hidden on this device.") · "Tell a grown-up" (self-managed: "Report this note") · withdrawn "This note was put away."
**Console lines:** nav "Notes" · "Send a note" · "New note" · "Pick an encouragement" · "Add a few words (optional)" · counter "{n} of 120" · "Suggest a quest (optional)" · "Needed for this encouragement" · closed-quest mark "Some learners can open this lesson only with the full route." · "Sign as" (family) · "Send to: everyone / choose" · "Notes are off for this student" · "Encouragement only for this student" · "3 notes today. You can send more tomorrow." · problems: link "Links can't be sent in a note (\"{word}\")." · contact "Email addresses, handles and phone numbers can't be sent in a note." · emoji "Please use words instead of emoji." · tone "Please choose a kinder word than \"{word}\"." · line break "Please keep the note to one line." · too long "Please keep it to 120 characters." · result "Sent to {n} students." · statuses "Sent" · "Opened" (family only) · "Not shown" · "Taken back" · "Take back" · switch off "Sending notes is not open yet." · family tabs "Received" · "Sent" · "Sent by {account}" · "Taken back by the sender" · "Stop notes from this sender" · "Allow again" · "Can send notes" · disclosure "Teachers see the answer {learner} picks on their notes. They do not see when a note was read." · one-time card "Notes from classes: All notes." with "Keep" / "Change".
**Caregiver lines:** "Notes for {learner}" · "Hide from {learner}" · "Report" · reasons "Unkind" · "Unsafe" · "Not meant for {learner}" · "Something else" · "Report and hide" · "Just hide it" · "Put away on this device" · "Notes from classes: All notes / Encouragements only / Off" · class-scoped device "Change this on a home device." · offline "Connect to the internet to do this." · disclosure "Teachers see the answer {learner} picks on their notes."

## Review log

- 2026-10-11: drafted from the owner request of 2026-10-11 item 7 and the current-system map (`ea9049e4`); child-safety, anti-shame, privacy, offline and deletion passes applied in the text; promoted to `ready` with every open choice turned into an owner decision with a default (section 12).
- 2026-10-11, review round 1 (two reviews: "approve with changes", five majors; "changes required", one blocker and six majors). All blockers and majors applied:
  - **Blocker, dependency cycle**: the guard moved to `packages/i18n` behind the subpath `@hangul-route/i18n/note-text`; backend gains the i18n dependency in FB-3a; coverage under the i18n target (6.4, D10, FB-1b). Option (b), an injected finder, was not chosen: two call sites would each have to remember to inject it.
  - **Persona routing**: `ROUTES.spaceNotes(id, kind)`, `/parent/space/notes` re-export, OD-16 resolved by F-APP-001 (6.13).
  - **Entry points**: `ADULT_NAV` items, hubs, parent-home and report action-slot "Send a note" (quest prefill from P1, never a preset), web-only Send a note in the grown-up zone (6.13, 6.10).
  - **Suggested quests and F-ENT-003**: closed quest shows "Opens with the full route" with no Start, gate or paywall; composer marks closed quests for unlicensed spaces when gating is on; `next_try_this` requires a quest (6.2, 6.5, 7.2).
  - **Disclosure of what teachers see**: OD-8 default changed to reactions only (no "Opened" for class senders); disclosure lines on the learner page, grown-up zone and family view; no reaction to class senders in `presets` / `off`; `note_replies` kept with the old consent version still accepted (6.6, 7.7).
  - **Long family page**: composer is its own sub-view; family page has Received and Sent tabs; duplicate block dropped; single learner auto-selected (6.13, wireframes).
  - **Take back erased evidence**: soft `withdrawn` status kept for 180 days and visible and reportable in the family view (OD-18, D9, 8.3).
  - **Join-code caregivers**: sending needs the owner's grant (OD-17); family views name the sending account and every acting caregiver; delivery rule 6 drops notes of a sender who lost the right (6.1, 6.8, 8.2).
  - **D1 query budget**: set-based `json_each` methods, at most 16 statements per send, a statement-count test (7.4, D11). The 300-learner cap stays, because the statement count no longer grows with it.
  - **No server switch**: `NOTES_SEND` Worker variable, send routes only, default off, turned on after every safety route is deployed (7.8, D7, OD-19).
  - Minors applied: offline Report stays enabled (queued); "Just hide it" on the report sheet; "Report this note" for self-managed profiles, "Your guardian", added "Your partner", heading "Answer with one tap"; `next_try_this` requires a quest and `next_look_again` reworded; My notes row only with a membership or a cached note; grown-up zone notes moved to their own screen with one dashboard row per learner; `SITE_CLAIMS.feedbackNotes` flip in FB-14, "notes" wording for F-APP-001's strings, FB-15 Preview link via F-BROWSE-001; one-time class-notes card stored on the server; hold counts distinct families and the immediate `unsafe` hold needs a family account or a PIN-attested device; device-reported family notes read "Not shown" to their sender; daily Cron Trigger plus lazy purge, new tables in `RESET_TABLES`; gate destinations and `PinEntry.noteId` moved to FB-7; every `notes.*` event without `profileId` (`firstOpen` replaced by `suggestOpen`); ungated local "Put this note away"; family "Stop notes from this sender" and App Review notes for UGC; link rule uses a TLD list and quotes the token; FB-3 and FB-4b split; the family view lives on app.hangulroute.com and hangulroute.com carries no notes surface.
  - Not applied, with reason: a "friend" family label (an unknown adult signing as a child's "friend" is a grooming pattern; "Your partner" covers P6); changing the Korean substring rule of `findBannedWord` for every surface (it is F-I18N-001's shared rule; the note guard adds a tested allow-list instead); lowering the 300-learner cap (not needed once statements are constant); reactions-only via a new per-family control (the default change plus disclosure is simpler and safer; a control can come later through OD-8).
- 2026-10-12, FB-1b review (two code reviews of PR #378: one blocker, two majors, minors). Section 6.4 amended in the same PR: invisible and format characters, mathematical letters and stacked marks are `invalid` (rule 1); one-character labels, eight more TLDs, `www.` only at a token start, and a folded check-only copy (rules 5, 6, 8); single punctuation marks between digits and isolated calendar dates (rule 6); default-emoji symbols outside the old ranges (rule 7); `missed you` and `behind you` on the English allow-list (rule 8). Not applied, with reason: dropping the common-word TLDs (`so`, `me`, `us`, `to`, `es`) unless a `/` follows (it would let `kim.me` through, and the console already quotes the token so a missing space is a one-key fix).
- 2026-10-12, FB-1 (#383) rebased after F-REPORT-001 RP-W2 (#392) merged with its own consent bump (`transfer-2026-10b`). Section 7.7 amended: FB-1 now bumps to `transfer-2026-10c`, whose pinned hash covers both text changes, and keeps `transfer-2026-10b` and `transfer-2026-10` accepted; the interim `transfer-2026-10-notes` is dropped, because it never reached main. The Worker's `notes.*` profile-id rule moved with F-REPORT-001 RP-W1's refactor into `keptEventFields` (`lib/server-events.ts`), so `POST /api/telemetry` and the Worker's own events share it (section 10). CLASS_TRANSFER stays unset.
- 2026-10-12, FB-1 reviews (code reviews of PR #383). Round 1, applied in the PR: `notePrefs` falls back field by field and never towards a looser setting (`NOTE_PREFS_UNREADABLE` when it is not an object; section 6.10 item 2 leaves the setting row out and item 5 the one-time card while the mode is unknown); learner ids in a send are distinct and at most `NOTE_LEARNER_ID_MAX` (80) characters; the Worker never stores a `profileId` on a `notes.*` event. Round 2 (two reviews: "approve with minor changes", six minors; "no blockers", one major and six minors). Applied:
  - **Major, notes payloads stored as sent**: the Worker keeps, per `notes.*` name, only the keys of section 10 in their documented shapes (`NOTES_PAYLOAD_RULES` in `lib/server-events.ts`, the `browse.*` pattern), so a note id, a space id, a label, the note text or a profile id inside a payload is never stored (section 10, TELEMETRY-NAMES-2 section M).
  - `NOTE_PREFS_DEFAULT` and `NOTE_PREFS_UNREADABLE` are frozen and every parse returns its own prefs object, so one consumer write can never loosen a later fallback; `NotePrefsSchema` has no field defaults, so a partial object never reads as `all` (only an absent `notePrefs` reads as the server defaults) (7.1, 6.10 item 2).
  - The inbox reads a suggestion without `.strict()`; a `NOTE_PRESETS_NEED_SUGGEST` preset whose suggestion this app cannot read keeps the note and renders the fallback line (7.1, FB-7 `view.ts`); a class note never carries a family label on the device (7.1).
  - "Your partner" is shown only to a learner whose learner type is `self` and reads "Your family" on any other profile (`FAMILY_LABELS_SELF_LEARNER_ONLY`, 6.11, FB-7 `view.ts`).
  - Each route names its body: `NoteDevicePrefsPutSchema` (device prefs, optional `attest`) and `NoteAccountReportSchema` (account report, never `attest`) (7.1, 7.2, 7.6).
  - The consent hash tests derive `transfer-2026-10b` and `transfer-2026-10` from the current text instead of comparing two pinned literals; the 7.1 code block matches `feedback.ts` (incl. the `textLocale` rule); section 13 test paths corrected to `src/__tests__/`; new constants asserted directly.
  - Not applied, with reason: a Worker `422 label_not_allowed` for `partner` sent to a learner who is not a self learner (the learner type lives only on the device, so the Worker cannot tell; a send to everyone would fail for a whole family; the app rule covers every learner screen); freezing `NOTE_PRESETS_NEED_SUGGEST` (`Object.freeze` does not stop `Set.add`, and its `ReadonlySet` type already refuses a write at compile time; it keeps the shape of section 7.1).
