Status: ready

# F-FEEDBACK-001 — Notes from grown-ups: a one-way, child-safe feedback channel from a learner's teacher or family to the learner

> **Status note.** `ready` means: every behaviour, data shape, route, string family, test and PR below is decided, and every owner decision in section 12 has a default that applies until the owner answers. No decision blocks a PR; each one names the PRs it would change. Basis: `origin/main` `ea9049e4` (2026-10-11). Every `file:line` is at that commit.
>
> **Owner request (2026-10-11, item 7, translated):** "A channel for teachers and parents to give feedback to students." This spec is that channel. It is **adult to learner only**. Messaging between a parent and a teacher stays out of scope (F-TCH-001 section 4 keeps it for a later F-NOTIF spec).

**Start order (CLAUDE.md section 5: no code before `ready`; no component before a wireframe and a design mock)**

| Can start when | PR | Waits for what | Why |
|---|---|---|---|
| now | FB-0 docs | — | promotes this spec, the wireframes, the telemetry rows, the app-map rows, the Home-order row and the cross-references |
| after FB-0 | FB-1 schemas + text guard + telemetry names, FB-5 strings, FB-6 icons | FB-0 merged | new files plus append-only edits |
| after FB-1 | FB-2 migration + `Db` methods | the shared schemas | the migration must be **merged and deployed before** any route PR (server first) |
| after FB-2 is deployed | FB-3 account routes, FB-4a device inbox + state, FB-4b reports, prefs, oversight | the tables exist in production D1 | a route on a missing table would 500 |
| after FB-1, FB-5 | FB-7 app logic + store, FB-10 console logic | ids, guard, dictionary | logic only, flag off |
| after the design pass | FB-8 learner screens, FB-11 composer + sent list, FB-12 family view, FB-9 grown-up zone | design mocks in `design/screens/` (CLAUDE.md section 5) | "no component without a mock" |
| after FB-3 / FB-4a / FB-4b deployed and FB-1's names on the Worker | FB-8, FB-9, FB-11, FB-12 may be built and merged with their flags off | Worker first (telemetry names, routes) | an app build must not call a route the Worker lacks |
| last | FB-13 runbook + privacy line, FB-14 e2e + flag flip | every PR above | the flip is the only user-visible change |

**Scope**: `packages/content-schema` (new `schemas/feedback.ts`, new `feedback/note-text.ts`, `schemas/sync.ts` inbox fields, `schemas/transfer-consent.ts` one new visible item, telemetry names) · `apps/api/migrations` (one additive migration) · `packages/backend` (new `routes/notes.ts`, device routes in `routes/sync.ts`, `lib/can.ts` two actions, `lib/note-limits.ts`, `db/*` methods, `deleteLearner` and membership-leave cleanup) · `apps/mobile` (new `logic/notes/`, new `store/notes-store.ts`, new `screens/notes/`, Home card, Profile row, grown-up zone section, `platform/sync-api.ts` methods, flag) · `apps/web` (new `lib/console/notes.ts`, new `app/(console)/teach/space/notes/page.tsx`, `components/console/NotesParts.tsx`, a roster-card button, flag) · `packages/design-system` (icons `note`, `heart`) · `packages/i18n` (`common.notes`, `learner.notes`, `caregiver.notes`, `console.notes`, `a11y.notes`)
**Owner**: solo dev
**Rollout**: console flag `NEXT_PUBLIC_NOTES_ENABLED` and app flag `EXPO_PUBLIC_NOTES_ENABLED`, both default **off**, flipped in FB-14. The Worker routes have no flag: with both clients off nobody can send, and the inbox answers `notes: []`.
**Wireframes** (drafted with this spec, promoted in FB-0): `design/wireframes/home/notes-card.md` · `notes/list.md` · `notes/detail.md` · `parent/notes.md` · `parent/note-report.md` · `console/note-composer.md` · `console/notes-sent.md` · `console/family-notes.md`

Parent / siblings: CLAUDE.md section 1 (any age, anti-shame, child safety, UI languages) · F-SPACE-001 (spaces, roles, `can()`) · F-SYNC-001 (inbox, device principal) · F-TCH-001 (section 3.2 no ranking; section 4 messaging out of scope) · F-PAR-001 (section 3.4 voice message N5, section 3.6 caregiver anti-shame list) · F-SPACE-002 (teacher-visible consent items, `rate_hits`, bounded purge, `deleteLearner` pattern; `CLASS_TRANSFER` stays off) · F-I18N-001 (dictionary, banned words, fallback) · F-LEARN-001 (`gateRequired`, self-managed learners) · F-PROF-001 (grown-up gate) · F-ROUTE-001 (section 6.4 Home stack order) · F-CONSOLE-001 (console shell, static export, `?id=` addressing) · F-PLAN-001 (`PlanItem.note`, related gap in section 4)

---

## 1. Context

Today no grown-up can tell a learner "well done" through the product. Verified on `ea9049e4`:

- There is no message entity, route, table or learner surface. `git grep -i "message\|feedback"` in `packages/backend/src/routes` finds nothing of the kind; F-TCH-001 section 4 sends messaging to an F-NOTIF-001 that does not exist.
- The only adult-to-learner text field is `PlanItemSchema.note` (`packages/content-schema/src/schemas/plan-item.ts:12`, at most 80 characters). The console collects it, but `HomeworkAssignmentSchema` (`schemas/progress.ts:54-64`) has no note field and `apps/mobile/src/logic/homework/plan-derivation.ts` never reads it, so the learner never sees it.
- F-PAR-001 section 3.4 (spec still `draft`) describes a 10-second parent voice message (N5) that is local to one device. It was never built (`design/wireframes/parent/voice-recorder.md` only).
- The learner side already has the pieces a channel needs: an anonymous device principal per learner (F-SYNC-001), an inbox the app reads after every sync (`routes/sync.ts:111-131`, `store/membership-store.ts:89-93`), memberships that name the learner's family and classes, and a grown-up gate (F-PROF-001 section 10).
- The adult side has Clerk accounts, spaces, roles and the one access function `can()` (`packages/backend/src/lib/can.ts:36-77`).

The owner wants teachers and parents to send feedback. Many learners are children, so the channel must be safe by construction, not by moderation alone: only linked adults can send; the learner cannot type back; every message opens with a reviewed, translated encouragement; free text is short, filtered and visible to the learner's family; anyone at home can hide or report a note; and nothing in it shames, ranks or compares.

## 2. User stories

- As a **teacher**, I want to send one of my students a short, warm note after class ("Your reading is getting stronger" plus "Loved your work on ㄱ and ㄴ today"), and see that it arrived, so my encouragement reaches them between lessons.
- As a **teacher**, I want to send the same encouragement to the whole class in one step, so I do not repeat myself 20 times.
- As a **parent or grandparent**, I want to leave a note my child finds next time they open the app, signed "Grandma", so the family's support feels close even when we live far apart.
- As a **learner** of any age, I want to read notes from my teacher and family, keep them, and say "Thank you" with one tap, without having to write anything.
- As a **parent**, I want to see every note my child receives, including notes from teachers, and hide or report one that is not right, so I stay in charge of who talks to my child.
- As an **adult self-learner** in a class, I want the same notes with no grown-up gate in my way.

## 3. Goals and non-goals

**Goals**

1. A linked adult (the learner's family caregiver, or the teacher of a class the learner is in) sends a **note** made of one **preset encouragement**, plus an optional **short text** of at most 120 characters, plus an optional **suggested quest**.
2. The learner reads notes in the learner app: a card on Home while a note is new, a Notes list, a note page. Read state is kept and synced.
3. The learner answers only with one of four **preset reactions** (section 6.6). There is no free-text reply.
4. The family sees every note the learner receives and can hide or report any of them, and can switch class notes to "encouragements only" or off.
5. Abuse is limited by design (who can send, filters, rate limits) and handled when it happens (report, automatic hold, owner review).
6. Everything works offline on the learner side and is deleted with the learner.

**Non-goals** (section 4 lists the full out-of-scope set): learner-to-adult free text; adult-to-adult messaging; voice, images or files; push notifications; any statistic of who opened what.

## 4. Out of scope

- **Learner free-text replies, chat or threads.** Never (decision D1, section 11).
- **Parent to teacher messaging** and teacher to parent messaging: a later F-NOTIF spec (F-TCH-001 section 4).
- **Voice messages, pictures, stickers, attachments, links other than a quest in the bundle.** F-PAR-001 N5 is superseded (OD-12).
- **Push notifications, email or SMS to the learner.** The note waits in the app. (A later spec may add an email digest for adults; it is not this one.)
- **Read or reply statistics**: no open rate, no "unread for N days", no per-class or per-learner counts of notes, no sorting by opens (section 9).
- **Scheduling a note for later** and recurring notes.
- **School admins sending to students of classes they do not teach** (OD-6).
- **Delivering `PlanItem.note` to the learner.** That is a gap in F-PLAN-001 and needs its own amendment there; it may reuse this spec's text guard (`feedback/note-text.ts`) and is not built here.
- **An operator web screen for reports.** The owner reviews reports with the runbook queries (FB-13); a screen can come later.
- **Native store builds** get the learner screens with the same code; the composer is web console only. Moving the console to another host (owner items 1, 3, 12) is another spec; this spec's console paths are relative to whatever host the console is on.

## 5. Vocabulary

| Term | Meaning |
|---|---|
| **note** | one message to one learner: a preset, an optional text, an optional suggested quest, a sender label, a time |
| **preset** | one encouragement line from a fixed, reviewed catalogue (section 6.3), stored as an id and rendered in the **learner's** UI language |
| **text** | the optional free text an adult adds, at most 120 characters, shown as typed (never translated) |
| **sender label** | how the learner sees who wrote it: "Your teacher · <class name>" or a family relation picked from a list ("Grandma") — never an account's typed name |
| **reaction** | one of four preset answers a learner can pick on a note |
| **batch** | one send to several learners (the whole class or a chosen few): one note row per learner sharing a `batch_id` |
| **hold** | a pause on an account's sending after reports (section 8.4) |
| **notes mode** | per learner, what class notes deliver: `all`, `presets` (encouragements only, text dropped) or `off`. Family notes are always delivered. |

## 6. Behaviour

### 6.1 Who can send to whom

1. `can()` gains two actions (`packages/backend/src/lib/can.ts`):
   - `feedback.send`: family `caregiver` (and the family `owner`, who acts as caregiver), class `teacher` (and the class `owner`). It is **not** cascaded to school admins through `ctx.parent` and not granted to a school-level `teacher` (OD-6).
   - `feedback.oversee`: family `caregiver` / `owner` only. It lets an adult read, hide and report every note to a learner of that family, from any space.
2. A note is sent **in a space** to a learner who is a current `student` member of that space (`memberships.member_kind = 'learner'`). A teacher can therefore reach only students of their own class; a caregiver only learners in their family space. Learner ids come from that space's roster; a learner id that is not a student of the space is answered `not_in_space` (no hint whether the learner exists elsewhere).
3. An archived space cannot send (`space_archived`).
4. The family's notes mode is applied **at send and again at delivery** (section 6.8). At send, a teacher whose student's family turned class notes off sees the learner marked "Notes are off" in the composer (section 7.2) and the send skips that learner with reason `notes_off`; in `presets` mode the sender sees "Encouragement only" next to that learner and the learner gets the note without its text. At delivery, a mode changed later also applies to notes sent before the change.
5. A device approved through a teacher re-link (scope `class`, migration `0003_device_scope.sql`) sees class notes only; family notes stay with the family's own devices (the same rule as plans, `routes/sync.ts:117-126`, SEC-4).

### 6.2 What a note contains

| Part | Required | Rule |
|---|---|---|
| preset | yes (OD-2) | one id of `NOTE_PRESET_IDS` whose `audience` allows the sender's role (section 6.3) |
| text | no | `checkNoteText` (section 6.4) passes; 1 to 120 characters after normalising |
| suggested quest | no (OD-13) | one quest id that exists in the shared catalogue (`packages/content-schema/src/catalog`); the app opens it like any Journey quest (every shipped stage is playable, F-ROUTE-001 OD-4) |
| sender label | family only | one id of `FAMILY_LABEL_IDS`; default `family`. Teachers have no choice: "Your teacher" plus the class name the learner's app already knows from its memberships |

The learner never sees the adult's account name, email or picture (OD-5). The class name is typed by the teacher (40 characters, `SpaceSchema.name`) and already reaches the learner through `LearnerMembershipSchema.name`; this spec adds no new name.

### 6.3 The preset catalogue

Fifteen presets, in four groups. Ids are frozen once shipped (a learner's stored note points at the id); wording may change in the dictionary. `audience` is who may pick it. English drafts are in Appendix A; the dictionary holds the final copy (`common.notes.presets`).

| Group | Id | Audience |
|---|---|---|
| effort | `effort_keep_trying` · `effort_proud` · `effort_practice_helps` | all |
| progress | `progress_new_letters` · `progress_reading` · `progress_writing` · `progress_listening` · `progress_new_card` | all |
| next step | `next_try_this` · `next_look_again` · `next_take_time` | all |
| warm | `warm_thinking_of_you` · `warm_cheering` | all |
| warm | `warm_see_you_in_class` | teacher |
| warm | `warm_learning_together` | family |

Wording rules for presets, reactions and every learner-facing string of this spec (tested in FB-5, section 10):

1. Second person, present or past tense, about effort or a concrete thing done. Never about speed, talent or comparison ("faster than", "best in class", "finally").
2. No banned word of `packages/i18n/src/banned-words.json`, learner **and** caregiver lists, in every locale.
3. No speaking words: no "say", "speak", "pronounce", "talk", "out loud" (owner decision 2026-10-10, F-ROUTE-001 header). Reading, listening and writing words only.
4. No age words, no "kids", no baby talk (CLAUDE.md section 1).
5. Plain Pre-A1 English, at most 12 words per sentence, at most one exclamation mark per preset, no emoji. Presets and reactions contain no digits; a count in a UI line ("2 new notes") goes through the plural helper (`packages/i18n/src/plural.ts`).
6. Never conditional love or pressure ("if you practise, I will be happy", "don't let me down").
7. `next_*` presets are invitations, never instructions with a deadline.

### 6.4 The text guard (`packages/content-schema/src/feedback/note-text.ts`, pure, 100 % covered)

One function, used by the console before sending and by the Worker on every send (the Worker is the authority):

```ts
export const NOTE_TEXT_MAX = 120;
export type NoteTextProblem = 'empty' | 'too_long' | 'line_break' | 'link' | 'contact' | 'emoji' | 'tone' | 'invalid';
export function normalizeNoteText(raw: string): string;            // trim, NFC, runs of spaces and tabs -> one space
export function checkNoteText(raw: string): { ok: true; text: string } | { ok: false; problem: NoteTextProblem; word?: string };
```

Rules, in this order (the first problem found is returned):

1. `invalid`: a control character (U+0000-U+001F except tab, U+007F-U+009F), a bidi override (U+202A-U+202E, U+2066-U+2069) or a lone surrogate.
2. `line_break`: CR, LF, U+2028 or U+2029. A note is one line.
3. `empty`: nothing left after `normalizeNoteText`.
4. `too_long`: more than `NOTE_TEXT_MAX` code points (`Array.from(text).length`), so Hangul and accented letters count as one each.
5. `link`: `://`, `www.`, or a token shaped like a domain (`[a-z0-9-]+\.[a-z]{2,}` followed by `/`, end, space or punctuation).
6. `contact`: any `@` (email or handle), or seven or more digits once spaces, dots, dashes, plus signs and brackets are removed (phone numbers, account numbers). The adult is told why (section 7.2).
7. `emoji`: code points in U+1F000-U+1FAFF, U+2600-U+27BF, U+FE0F or U+200D. Explicit ranges, no Unicode property escapes (F-I18N-001 section 3.1, Hermes safety).
8. `tone`: `findBannedWord(text, locale, 'caregiver')` hits for **any** locale in `LOCALES` (the note may be written in any language and is read by a learner). `word` carries the hit so the console can name it.

The guard does not judge meaning. Meaning is covered by the preset requirement, the family's view of every note, reports and holds (section 8).

### 6.5 Learner app: where notes appear

Behind `flags.notesEnabled` (`EXPO_PUBLIC_NOTES_ENABLED`, default off; `apps/mobile/src/config/flags.ts`).

1. **Home card** (`home/notes-card.md`). Shown for the active profile while it has at least one live, unread note. One card, newest unread note first: sender label, the preset line, "New" pill, one primary button **Read**. With more than one unread note the card says how many are new ("2 new notes") and Read opens the Notes list instead of the note. No timer, no dismiss counter. Its place in the Home stack is row **2a** (after the Today mission cards, before the story card); FB-0 adds the row to F-ROUTE-001 section 6.4, which owns the table. Wide layout: right column.
2. **Notes list** (`notes/list.md`, new stack screen `Notes`). Every live note of the active profile, newest first, grouped "New" then "Earlier". Each row: sender label, preset line, first words of the text, date, a reaction chip when one was picked. Entries: the Home card, and a **My notes** row on Profile (shown when the flag is on, with a "New" pill while something is unread).
3. **Note page** (`notes/detail.md`, new stack screen `NoteDetail { noteId }`). Hoya in the `cheer` pose; the preset line large; the text below it, as typed, marked "From <sender label>"; the date; the suggested quest as a card with **Start** (opens `EpisodeDetail` / `QuestPlayer` as Journey does); the reaction row (section 6.6); a quiet **Tell a grown-up** link at the bottom. Opening the page marks the note read (section 6.7).
4. Notes are per learner profile. Siblings on one device each see only their own. A profile switch changes the list.
5. Notes never block learning: no modal, no interruption of a quest, no sound on arrival.
6. A learner cannot delete a note. Old notes stay in "Earlier" until retention removes them (section 8.6); there is no warning before that.

### 6.6 Reactions (the only learner answer)

Four presets, picked with one tap on the note page; the learner can change the pick (last one wins); there is no "remove":

| Id | Icon | English draft |
|---|---|---|
| `thanks` | `heart` (new) | Thank you |
| `will_try` | `pencil` | I will try it |
| `did_it` | `check-circle` | I did it |
| `happy` | `sparkle` | This made me happy |

- Nothing prompts the learner to react; there is no "Reply" call to action and no reminder.
- The sender sees the pick (section 7.2). A note without a reaction is shown to the sender exactly like a note before any reaction: never "no reply".
- **Why preset reactions instead of none or free text (decision D1):** a free-text reply would let a child type personal details to an adult and would need human moderation of children's words; that is the main risk this channel must not create. No answer at all would leave adults unsure the note arrived and leave learners with no way to say thank you, which is part of the motivation the owner asked for. Four fixed ids carry gratitude and intent, contain no personal data, need no moderation, and cannot be used to arrange contact. They are learner data the sender sees, so they are added to the teacher-visible consent items (section 7.7).

### 6.7 Read state

- A note becomes **read** when its note page opens (not when the Home card or the list shows it).
- `readAt` is set once and never cleared. The sender sees "Opened" (OD-8).
- Read state and reactions are written to the local store first and sent with the device's next sync (section 6.9).

### 6.8 Delivery rules (Worker, `GET /api/sync/learners/:id/inbox`)

The inbox gains `notes` and `notePrefs` (section 7.6). A note is delivered when all hold:

1. `status = 'live'` (not hidden, not reported) and `created_at` within the last 180 days (section 8.6);
2. the learner is still a student member of the note's space, and the space is not archived;
3. the device may see the space (a class-scoped device: class spaces only);
4. for a class note, the learner's notes mode is not `off`; in `presets` mode the text is removed from the delivered row (`text: null`; the stored row keeps it for the sender and the family);
5. at most the 30 newest such notes are sent (bounded inbox, about 15 KB at most).

### 6.9 Offline and sync on the device

- `store/notes-store.ts` (zustand, persisted through `platform/storage` only, key `notes:<profileId>`) keeps the delivered notes, `readAt` and `reaction` per note, and a queue of pending writes.
- Apply inbox (`logic/notes/apply.ts`, pure): the inbox list is authoritative for **which** notes exist (a note missing from the inbox is gone: hidden, reported, withdrawn, expired or the learner left the space); the device keeps local `readAt` / `reaction` that are not yet acknowledged, and takes the server's otherwise. A note withdrawn while its page is open closes gently to the list ("This note was put away").
- The queue holds at most one pending state write per note (the newest pick replaces an older pending one) and at most one pending **report** per note, and is flushed before the inbox read in the same sync. A queued report hides the note on this device at once, so a worried learner is never left looking at it while offline, and apply inbox keeps that note hidden while its report is pending (the inbox may still list it until the report reaches the Worker). Hide and the notes-mode setting are **not** queued: they need a connection (the grown-up zone says so), because they must act on every device. A `404` for a note drops its pending write; `5xx` or offline keeps it for the next sync; a `409`/`422` drops it (the note changed on the server).
- With no network the Home card, list and page work from the cached notes. Nothing waits on the network.
- Merge on restore (F-SYNC-002, Rescue Code) needs nothing: notes live on the server and arrive with the first inbox on the new device. Read state is server state.

### 6.10 Grown-up zone in the app

Behind the gate (`PinEntry`, F-PROF-001; a self-managed learner's gate opens directly, `logic/profiles/gate-route.ts`). New `GrownUpDestination` values `NotesGrownUp` and `NoteReport`.

1. **Notes for <learner>** section on `ParentDashboardScreen` (`parent/notes.md`): every delivered note of each local profile, sender label and full text, with **Hide from <learner>** and **Report** per note, and the **class notes** setting (`all` / `presets` / `off`).
   - **Hide** calls its own device route (section 7.6): the note gets status `hidden` on every device and counts toward no hold (decision D8). **Report** is the sheet of item 2.
   - The setting needs a full-scope device (a class-scoped device cannot change a family choice; the row says "Change this on a home device").
2. **Tell a grown-up** on a note page opens the gate with destination `NoteReport { noteId }`, which shows the report sheet (`parent/note-report.md`) for that note: reasons `unkind`, `unsafe`, `not_for_me`, `other`; **Report and hide**. The note leaves the learner's list at once (local) and on every device at the next inbox.
3. When no grown-up is near, the learner can always just close the note. Nothing in the learner UI says the note will be "punished" or that anyone is "in trouble".

### 6.11 Copy, anti-shame and localisation

- Presets, reactions and family labels are ids rendered in the **viewer's** UI language: a learner with the Korean UI reads the Korean preset even if the teacher used the English console. Until a locale's strings pass native review they fall back to English (F-I18N-001 fallback, OD-15).
- The free text is shown as typed and is never machine-translated. It gets `lang="ko"` when it contains Hangul, otherwise the sender's console locale recorded on the note (`textLocale`), so screen readers pick a voice.
- Taught-content rules (romanization plus gloss) do not apply to a free text: it is a person's words, not lesson content. The note page shows it under "From <sender>" so it is never mistaken for a lesson.
- Dates: "Today", "Yesterday", otherwise a short date through `packages/i18n/src/format.ts`.
- No red, no danger colour, no "unread" warning anywhere on learner or adult screens.

### 6.12 Accessibility

- Every interactive target is at least `touchTarget`; body text at the body floor (18); the preset line uses the heading style of the page.
- The Home card is one focusable group announced as "New note from <sender label>: <preset line>. Read." (`a11y.notes.card`).
- Reactions are a radio group with a visible selected state that does not rely on colour (check mark plus label); the change is announced ("You picked: Thank you").
- "New" is a text pill, never only a dot.
- The suggested quest card has the same label pattern as Journey quest cards.
- Reduced motion: Hoya's cheer is static; no arrival animation.
- Console: every field has a label; problems are linked with `aria-describedby`; the character counter is announced politely at 100 and at 120; after **Send** focus moves to the result line; the learner picker is a list of checkboxes with keyboard support; nothing is reachable by hover only.

## 7. Data and API (all additive)

### 7.1 Shared schemas (`packages/content-schema/src/schemas/feedback.ts`, exported from `src/index.ts` by append)

```ts
export const NOTE_PRESET_IDS = [/* the 15 ids of section 6.3, in that order */] as const;
export const NOTE_PRESET_AUDIENCE: Readonly<Record<NotePresetId, 'all' | 'teacher' | 'family'>>;
export const NOTE_REACTION_IDS = ['thanks', 'will_try', 'did_it', 'happy'] as const;
export const FAMILY_LABEL_IDS = ['family', 'mom', 'dad', 'grandma', 'grandpa', 'aunt', 'uncle', 'guardian'] as const;
export const NOTE_REPORT_REASONS = ['unkind', 'unsafe', 'not_for_me', 'other'] as const;
export const NOTES_MODES = ['all', 'presets', 'off'] as const;

export const NoteIdSchema = z.string().regex(/^note:[a-z0-9-]{8,64}$/);
export const NoteSuggestSchema = z.object({ kind: z.literal('quest'), id: z.string().min(1).max(64) }).strict();

/** POST /api/spaces/:id/notes body. `.strict()`: an early or stale client fails loudly. */
export const NoteSendSchema = z.object({
  to: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('learners'), ids: z.array(z.string().regex(/^profile:[a-z0-9-]+$/)).min(1).max(300) }).strict(),
    z.object({ kind: z.literal('everyone') }).strict(),
  ]),
  presetId: z.enum(NOTE_PRESET_IDS),
  text: z.string().max(400).optional(),          // length and content checked by checkNoteText
  textLocale: UiLocaleSchema.optional(),         // the console locale; required when text is present
  suggest: NoteSuggestSchema.optional(),
  label: z.enum(FAMILY_LABEL_IDS).optional(),    // family spaces only; on a class space the Worker answers 422 label_not_allowed
}).strict();

/** One delivered note (inbox row). Lenient on the device: one bad row is dropped, not the inbox. */
export const InboxNoteSchema = z.object({
  id: NoteIdSchema,
  spaceId: z.string(),
  from: z.object({ role: z.enum(['teacher', 'family']), label: z.enum(FAMILY_LABEL_IDS).nullable() }),
  presetId: z.string().max(64),                  // a plain string on the wire: an unknown id renders the fallback line
  text: z.string().max(400).nullable(),
  textLocale: UiLocaleSchema.nullable(),
  suggest: NoteSuggestSchema.nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  reaction: z.string().max(32).nullable(),       // unknown ids are ignored by the app
});

export const NotePrefsSchema = z.object({ classes: z.enum(NOTES_MODES).default('all') });
export const NoteStatePutSchema = z.object({ read: z.literal(true).optional(), reaction: z.enum(NOTE_REACTION_IDS).optional() })
  .strict().refine((v) => v.read !== undefined || v.reaction !== undefined);
export const NoteReportSchema = z.object({ reason: z.enum(NOTE_REPORT_REASONS), attest: z.enum(['grown_up_pin', 'self']).optional() }).strict();
```

- An unknown `presetId` on the device renders `common.notes.presetFallback` ("A note for you"), so a newer Worker never breaks an older app.
- `SyncInboxSchema` (`schemas/sync.ts:131-151`) gains, appended after `transfers`:
  `notes: lenientArray(InboxNoteSchema).default([])` and `notePrefs: NotePrefsSchema.default({ classes: 'all' })`.
  An old Worker omits both (defaults apply); an old app strips both (zod).

### 7.2 Account routes (`packages/backend/src/routes/notes.ts`, mounted at `/api/spaces`, Clerk account auth through `requireAccount` / `accountActor`)

| Method and path | Action | Body / query | Answer |
|---|---|---|---|
| `GET /:id/notes/recipients` | `feedback.send` on the space | — | `{ learners: [{ id, displayName, notes: 'all' \| 'presets' \| 'off', today: n }] }`; `displayName` follows `anonymizeRoster` (`rosterName`); `today` = notes this account sent that learner in the last 24 hours (for the limit line) |
| `POST /:id/notes` | `feedback.send` | `NoteSendSchema` | `201 { batchId, sent: n, skipped: [{ learnerId, reason: 'notes_off' \| 'limit' }], presetsOnly: [learnerId] }` |
| `GET /:id/notes?before=<iso>&learner=<id>` | `feedback.send` | — | notes sent **in this space** (by any adult of it), newest first, 50 rows per page. Without `learner`, the notes of one `everyone` batch collapse into one row `{ batchId, to: 'everyone', size, presetId, text, suggest, label, createdAt, status: 'sent', mine }` (never a count of opens); every other note is its own row `{ id, batchId, to: 'learner', learnerId, displayName, presetId, text, suggest, label, createdAt, status: 'sent' \| 'opened' \| 'not_shown', reaction, mine }`. With `learner`, only that learner's rows, each with its own status. `{ rows, next }` |
| `POST /:id/notes/:noteId/withdraw` | `feedback.send`, the note is this space's **and** was sent by this account (`mine`) | `{ batch?: true }` | `200 { withdrawn: n }`; the row is deleted; with `batch: true` every unreported note of its batch is deleted; a reported note answers `409 note_reported` (single) or is skipped (batch) |
| `GET /:familyId/learners/:learnerId/notes?before=` | `feedback.oversee` on the family, learner is its student | — | every note to this learner from **any** space, with the space kind and name, status `live` / `hidden` / `reported`, text always included |
| `POST /:familyId/learners/:learnerId/notes/:noteId/hide` | `feedback.oversee` | — | `200`; status `hidden`, `hidden_at`, `hidden_via = 'family'` |
| `POST /:familyId/learners/:learnerId/notes/:noteId/report` | `feedback.oversee` | `NoteReportSchema` (no `attest`) | `201`; status `reported`; a `feedback_reports` row; hold check (section 8.4). Any note to the learner may be reported, a family note included (a co-caregiver's note can be wrong too); the reporter's own note answers `422 own_note` (take it back instead) |
| `GET`/`PUT /:familyId/learners/:learnerId/note-prefs` | `feedback.oversee` | `NotePrefsSchema` | the prefs |

- Status mapping for the sender: `opened` when `read_at` is set; `not_shown` when the row is `hidden` or `reported` (the sender is never told which, or why) or, for a class note, the learner's notes mode is now `off` (a learner whose mode was `off` at send gets no row at all: the send skipped them); otherwise `sent`.
- Errors (one envelope, `envelope.ts`): `401` no session; `403 not_allowed` (no action); `403 sending_paused` (hold); `404 not_found` (space or note, without saying which); `409 space_archived`; `422 note_text { problem, word? }`; `422 bad_preset` (audience); `422 bad_suggest` (unknown quest); `422 label_not_allowed`; `429 too_many { scope: 'learner' \| 'account', retryAfter }`.
- `to: everyone` resolves to the space's current student members at send time.

### 7.3 Limits (`packages/backend/src/lib/note-limits.ts`)

Durable counters in the existing `rate_hits` table (migration `0005_class_transfer.sql:90-95`); keys `note:acct:<accountId>`, `note:pair:<learnerId>:<accountId>`, `note:learner:<learnerId>`, `note:report:acct:<accountId>`, `note:report:learner:<learnerId>`. A "day" is the rolling 24 hours the transfer limits use (`routes/transfers.ts:276-279`); the existing bounded `purgeRateHits` keeps the table small.

| Limit | Value (OD-14) | When exceeded |
|---|---|---|
| notes from one account to one learner per day | 3 | that learner is skipped with `limit` (the batch still sends to the others) |
| notes to one learner from all senders per day | 10 | skipped with `limit` |
| notes from one account per day (all learners) | 400 | `429 too_many { scope: 'account' }`, nothing sent |
| sends (batches) from one account per minute | 10 | `429` (per-isolate limiter, `lib/rate-limit.ts`) |
| family reports from one account per day | 20 | `429` |
| device reports per learner per day | 10 | `429` |

`learnerRateKeys(learnerId)` gains `note:learner:<learnerId>` and `note:report:learner:<learnerId>`, and `deleteLearner` also runs `DELETE FROM rate_hits WHERE key LIKE 'note:pair:<learnerId>:%'` (learner ids match `^profile:[a-z0-9-]+$`, so they hold no `%` or `_`).

### 7.4 Migration `NNNN_feedback_notes.sql` (FB-2; `NNNN` = the next free prefix when FB-2 merges, checked by `scripts/check-migrations.mjs`)

Additive only: four new tables, their indexes, nothing existing touched; safe to re-run (`IF NOT EXISTS`); a Worker that predates it never reads it.

```sql
CREATE TABLE IF NOT EXISTS feedback_notes (
  id                TEXT PRIMARY KEY,                                   -- note:<uuid>
  learner_id        TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  space_id          TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  sender_account_id TEXT NOT NULL,                                      -- accounts.id; never shown to the learner
  sender_role       TEXT NOT NULL CHECK (sender_role IN ('teacher','family')),
  sender_label      TEXT,                                               -- family label id; NULL for teachers
  batch_id          TEXT NOT NULL,
  batch_kind        TEXT NOT NULL CHECK (batch_kind IN ('everyone','learners')),
  preset_id         TEXT NOT NULL,
  body              TEXT,                                               -- checked by checkNoteText; NULL when none
  body_locale       TEXT,
  suggest_kind      TEXT CHECK (suggest_kind IS NULL OR suggest_kind = 'quest'),
  suggest_id        TEXT,
  status            TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','hidden','reported')),
  hidden_via        TEXT CHECK (hidden_via IN ('family','device')),
  created_at        TEXT NOT NULL,
  read_at           TEXT,
  reaction          TEXT,
  reaction_at       TEXT,
  hidden_at         TEXT,
  CHECK (sender_role = 'family' OR sender_label IS NULL),
  CHECK (status <> 'hidden' OR (hidden_at IS NOT NULL AND hidden_via IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_learner ON feedback_notes(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_space   ON feedback_notes(space_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_sender  ON feedback_notes(sender_account_id, created_at);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id                TEXT PRIMARY KEY,                                   -- notereport:<uuid>
  note_id           TEXT NOT NULL REFERENCES feedback_notes(id) ON DELETE CASCADE,
  learner_id        TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  sender_account_id TEXT NOT NULL,
  reason            TEXT NOT NULL CHECK (reason IN ('unkind','unsafe','not_for_me','other')),
  via               TEXT NOT NULL CHECK (via IN ('family','device')),
  evidence          TEXT NOT NULL,                                      -- reporting account id or device id; never a name
  attest            TEXT CHECK (attest IN ('grown_up_pin','self')),     -- device reports only (a client claim)
  created_at        TEXT NOT NULL,
  reviewed_at       TEXT,
  outcome           TEXT CHECK (outcome IN ('kept_hidden','restored','sender_held'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_sender ON feedback_reports(sender_account_id, created_at);

CREATE TABLE IF NOT EXISTS feedback_sender_holds (
  account_id  TEXT PRIMARY KEY,
  reason      TEXT NOT NULL CHECK (reason IN ('reports','unsafe','owner')),
  created_at  TEXT NOT NULL,
  lifted_at   TEXT
);

CREATE TABLE IF NOT EXISTS learner_note_prefs (
  learner_id  TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  classes     TEXT NOT NULL DEFAULT 'all' CHECK (classes IN ('all','presets','off')),
  updated_at  TEXT NOT NULL,
  updated_via TEXT NOT NULL CHECK (updated_via IN ('family','device'))
);
```

`Db` (`packages/backend/src/db/types.ts`, `d1.ts`, `memory.ts`) gains: `insertNotes(rows)` (one batch), `notesForLearner(learnerId, since, limit)`, `notesForSpace(spaceId, before, limit, learnerId?)`, `notesForOversight(learnerId, before, limit)`, `getNote(id)`, `setNoteRead(id, at)` (only when `read_at IS NULL`), `setNoteReaction(id, reaction, at)`, `hideNote(id, via, at)`, `deleteNote(id)`, `deleteBatch(batchId, senderAccountId)` (unreported rows only), `insertNoteReport(row)`, `countReportsAgainst(accountId, since)` (distinct learners), `getSenderHold(accountId)`, `putSenderHold(row)`, `getNotePrefs(learnerId)`, `putNotePrefs(row)`, `deleteNotesForMembership(learnerId, spaceId)` (live and hidden rows; reported rows stay for review), `purgeNotes(before, reportedBefore, liftedBefore, limit)` (live and hidden notes older than `before`, reported notes and their reports older than `reportedBefore` by report time, lifted holds older than `liftedBefore`).

`deleteLearner` (`d1.ts:291`) deletes `feedback_reports`, `feedback_notes` and `learner_note_prefs` rows of the learner explicitly, children first, inside its existing transaction, each statement only when `presentTables` finds the table (the pattern of the transfer tables, F-SPACE-002 section 4.7), so an erase never fails on a Worker that runs before the migration.

### 7.5 Cleanup on leave and removal

When a learner's student membership of a space ends (the device leave route `POST /:id/leave` in `routes/spaces.ts:325`, used by Leave in Profile, or an adult removing the learner with `DELETE /:id/members/learner/:memberId` in `routes/spaces.ts:337`), the same request calls `deleteNotesForMembership(learnerId, spaceId)`. The learner's devices drop those notes at the next inbox (section 6.9).

### 7.6 Device routes (`packages/backend/src/routes/sync.ts`, `authorizeDevice`)

| Method and path | Scope | Body | Answer |
|---|---|---|---|
| `GET /learners/:id/inbox` (existing) | full or class | — | gains `notes`, `notePrefs` (section 6.8) |
| `PUT /learners/:id/notes/:noteId/state` | full or class (class: class notes only) | `NoteStatePutSchema` | `200 { readAt, reaction }`; idempotent; `404` when the note is not delivered to this device (gone, hidden, other learner) |
| `POST /learners/:id/notes/:noteId/hide` | full | — | `200`; status `hidden`, `hidden_via = 'device'` (grown-up zone only, the app sends it after the gate) |
| `POST /learners/:id/notes/:noteId/report` | full or class | `NoteReportSchema` with `attest` | `201`; status `reported`; report row with `via = 'device'`, `evidence = deviceId`; hold check |
| `PUT /learners/:id/note-prefs` | full only | `NotePrefsSchema` and `attest` | `200`; `403 scope` on a class-scoped device |

A report from a device is allowed from a class-scoped device on purpose: a learner on a class tablet must always be able to get a note away.

### 7.7 Consent and the teacher-visible list

- `TEACHER_VISIBLE_ITEM_IDS` (`schemas/transfer-consent.ts:98-106`) gains `note_replies`, with English text "Whether {learner} opened notes from the teacher, and the thank-you picked". This is the only new learner data a teacher receives (`read_at` mapped to "opened", and `reaction`). `TRANSFER_CONSENT_TEXT_VERSION` (`schemas/transfer.ts:38`, `'transfer-2026-10'`) is bumped in the same PR (FB-1; the per-locale hash test forces it). `CLASS_TRANSFER` stays unset; this changes text that is shown only when the owner enables it.
- A new constant `TEACHER_VISIBLE_NOTE_FIELDS = { readAt: 'note_replies', reaction: 'note_replies' }` pins that mapping in a test, the way `TEACHER_VISIBLE_ROSTER_FIELDS` pins roster fields.
- No consent is needed for a learner to **receive** notes: no personal data of the learner leaves the device by receiving one. Family control is the notes mode (section 6.10, 7.2), the family view of every note, hide and report. Whether class notes start at `all` for a child is OD-3.

## 8. Privacy and safety

### 8.1 Data minimisation

- The learner sends nothing but four kinds of facts: a note id was opened, a reaction id, a report reason id, the notes mode. No free text ever leaves a learner device through this feature.
- The server stores the adult's text, the sender's account id and the learner id. The learner sees neither the account id nor the account's name.
- The Worker never logs note text (no `console.log` in production code, CLAUDE.md section 8) and puts no note text, label or name in an error answer.

### 8.2 Who sees what

| Viewer | Sees |
|---|---|
| learner (own device) | delivered notes with sender label, preset, text (unless `presets` mode for class notes), suggested quest |
| sender and co-adults of the same space | notes sent in that space, with status `sent` / `opened` / `not_shown` and the reaction |
| family caregiver (`feedback.oversee`) | every note to the learner from every space, with status and text, and who hid or reported it (family / device) |
| teacher of another class | nothing |
| school admin | nothing (no cascade) |
| owner (operator) | report rows and the reported note's text through the runbook queries (FB-13) |

### 8.3 Abuse handling

1. **Before it happens:** only linked adults can send (6.1); every note starts with a reviewed preset (OD-2); text is short and filtered (6.4); limits (7.3); a learner cannot reply in words (6.6).
2. **When it happens:** any grown-up at home can hide (no record against the sender) or report (a record); a learner can always ask for a grown-up from the note page; a reported note disappears from every device at the next inbox and from the sender's list as `not_shown`.
3. **Hold** (section 8.4) stops an account from sending to anyone.
4. **Review:** the owner checks open reports with the runbook query every day (OD-11) and records an `outcome`.

### 8.4 Automatic hold

After every report the Worker counts reports against the sender's account in the last 30 days from **distinct learners** (`countReportsAgainst`). It inserts a `feedback_sender_holds` row when the count reaches 2, or at once when the reason is `unsafe` (OD-10). While a row with `lifted_at IS NULL` exists, `POST /:id/notes` answers `403 sending_paused` and the console shows "Sending notes is paused for this account. Write to hello@hangulroute.com." The account's other console features are unaffected. Only the owner lifts a hold (runbook, sets `lifted_at`). A hold never hides earlier notes by itself; reported notes are already hidden.

### 8.5 Child-safety checks this spec passes

- No ads, no tracking of note content, no third-party service sees a note.
- Local-first learner data: the device works offline; the server keeps only what delivery and oversight need.
- No new personal data linked to an account (verifiable parental consent rule): notes link an adult's words to a learner the adult is already linked to.
- No public or comparative display: no note is shown to anyone but the learner, the sending space and the learner's family.
- No student name in any URL: console paths carry the space id and an opaque learner id only (`?id=<spaceId>&learner=<profile:...>`).

### 8.6 Retention and deletion

| Data | Kept until |
|---|---|
| live or hidden note | 180 days after `created_at` (OD-9), then purged; never delivered after 180 days even before the purge runs |
| reported note and its report rows | 90 days after the report, then purged (both) |
| a note of a space the learner left | deleted when the membership ends (7.5); reported rows follow the 90-day rule |
| withdrawn note | deleted at once (unless reported) |
| learner deleted | every note, report and pref row of the learner, in the `deleteLearner` transaction |
| space deleted | cascade (`ON DELETE CASCADE` on `space_id`) |
| hold rows | kept while active; lifted rows purged 365 days after `lifted_at` |
| device copy | replaced by every inbox; dropped with the profile (`store/profile-removal.ts` clears `notes:<profileId>`) |

The purge is bounded and lazy, like transfers (`routes/transfers.ts:280-282`): every `POST /:id/notes` calls `purgeNotes(now - 180 d, now - 90 d, now - 365 d, 200)` before inserting. Every read also filters by age (live and hidden notes older than 180 days, reported notes whose report is older than 90 days), so purge lag is never visible.

The public privacy page gains one line about notes (FB-13; English-authoritative drafts, F-I18N-001 L10): who can send, what the learner can send back, how long notes are kept, how to hide, report and delete.

## 9. Anti-shame rules for adult screens

- The sent list is ordered by send time only. No sorting or filtering by opened, reacted or not.
- No counts of unopened notes per learner, per class or per space; no open rate; no "last opened" chip on the roster.
- Status words are neutral: "Sent", "Opened", "Not shown". There is no "Unread", "Ignored", "No reply" or a time since sending.
- The composer never suggests who "needs" a note based on progress, and never offers a preset tied to a low score.
- A batch to the whole class shows one line ("Sent to 18 students") and never lists who has not opened it.
- Family view copy (caregiver surface) passes the caregiver banned list.

## 10. Telemetry (Worker first)

Names are appended to `TELEMETRY_EVENT_NAMES` (`packages/content-schema/src/schemas/telemetry.ts:9`) in FB-1, and the exact-list test is updated (TELEMETRY-NAMES-2 rule 2). The API Worker must be deployed with FB-1 before any app build that sends them (rule 1); FB-8 and FB-9 are merged only after that deploy. The console has no telemetry client (F-PLAN-002 section 3.11), so adult actions send no events. Rows go to `docs/roadmap/TELEMETRY-NAMES-2.md` section L in FB-0.

| Name | Payload (ids, codes and counts only) | Emitted by |
|---|---|---|
| `notes.card_shown` | `{ unread }` once per app session when the Home card first shows | FB-8 |
| `notes.list_viewed` | `{ notes, unread }` | FB-8 |
| `notes.note_opened` | `{ presetId, fromRole: 'teacher' \| 'family', hasText, hasSuggest, firstOpen }` | FB-8 |
| `notes.reaction_picked` | `{ reaction, fromRole, changed }` | FB-8 |
| `notes.suggest_started` | `{ fromRole }` | FB-8 |
| `notes.report_sent` | `{ reason, via: 'note_page' \| 'grown_up_zone' }`, **sent without `profileId`** | FB-9 |
| `notes.prefs_changed` | `{ classes }`, sent without `profileId` | FB-9 |

Never in a payload: note text, note id, batch id, sender label, space name or id, account id, learner name.

## 11. Decisions made in this spec

| # | Decision | Why |
|---|---|---|
| D1 | The learner answers only with four preset reactions | section 6.6 |
| D2 | One-way channel per space; a note belongs to the space it was sent in | the space is what links an adult to a learner and what the family can see |
| D3 | Preset ids rendered in the viewer's language; free text untranslated | correct copy in every UI language without machine translation of a person's words |
| D4 | Notes live on the server, not in the progress snapshot | they are adult-authored, need oversight and deletion; the snapshot stays learner-owned and `ADDITIVE_FIELDS` is untouched |
| D5 | The family can always see and act on every note to its learner | the strongest single safety control; it costs nothing to teachers who write kind notes |
| D6 | Inbox is authoritative for which notes exist; read state and reactions are server state | one source of truth across siblings' devices and restores |
| D7 | No Worker flag | the routes are inert until a client flag is on; one less production switch |
| D8 | Hide is not a report | a family that only wants less noise must not put a mark against a teacher |

## 12. Owner decisions (each has a default that applies until the owner answers)

| # | Question | Default (applied) | Alternatives | PRs it would change |
|---|---|---|---|---|
| OD-1 | How can the learner answer? | Four preset reactions (section 6.6) | no answer at all; preset reactions plus a "Show my teacher I read it" only | FB-1, FB-4a, FB-8, FB-11 |
| OD-2 | Must every note start with a preset? | Yes; text optional | allow text-only notes for family senders | FB-1, FB-3, FB-11 |
| OD-3 | Class notes for a child before a guardian chooses | `all` (presets and text), changeable by the family | `presets` until a guardian opts in; `off` until opted in | FB-4a (default value), FB-9, FB-12 |
| OD-4 | Text length | 120 characters | 80 (as `PlanItem.note`); 200 | FB-1 |
| OD-5 | How the sender is named to the learner | teacher: "Your teacher · <class name>"; family: a relation from a list; never the account name | let teachers type a display name, checked by the text guard | FB-1, FB-3, FB-5 |
| OD-6 | Who can send | class teacher / owner and family caregiver / owner; not school admins | school admins too | FB-3 (`can()`) |
| OD-7 | Free or paid | Free for every linked adult; no plan check | paid spaces only | FB-3, FB-11 |
| OD-8 | Does the sender see "Opened"? | Yes, with the consent item `note_replies` | reactions only; nothing | FB-1, FB-3, FB-11 |
| OD-9 | Retention | 180 days; reported 90 days from the report | 90 days; one school year | FB-2, FB-4a |
| OD-10 | When is a sender held automatically? | reports from 2 distinct learners in 30 days, or 1 `unsafe` report | 3 learners; only manual holds | FB-4b |
| OD-11 | How does the owner learn of reports? | a daily check with the runbook query | an email to hello@ on each `unsafe` report (needs an email provider) | FB-13 |
| OD-12 | F-PAR-001 N5 voice message | Superseded by this channel; the F-PAR-001 rewrite drops N5 | keep N5 as a later add-on | none here (F-PAR-001 text) |
| OD-13 | Suggested quest in a note | Included, one quest | leave out | FB-1, FB-8, FB-11 |
| OD-14 | Limits | 3 per sender per learner per day, 10 per learner per day, 400 per sender per day | stricter per-learner limit | FB-3 |
| OD-15 | Korean and Spanish | ship English; ko / es presets fall back to English until a native review passes | hold the flag until ko / es are reviewed | FB-5, FB-14 |
| OD-16 | Where the composer lives after the console moves host (owner items 1, 3, 12) | with the console, same relative path `/teach/space/notes` | a separate notes app | none here (the host spec) |

## 13. Tests

| File | Level | What |
|---|---|---|
| `packages/content-schema/src/feedback/__tests__/note-text.test.ts` | unit, 100 % | every problem code and its order; Hangul and accents count as one; 120 passes, 121 fails; domains, `@`, seven digits across separators, emoji ranges, bidi overrides; banned words in en / es / ko incl. Korean substrings; `word` returned; `normalizeNoteText` idempotent |
| `packages/content-schema/src/schemas/__tests__/feedback.test.ts` | unit | `NoteSendSchema` strict (unknown key fails), label only enum, 300-id cap; `InboxNoteSchema` accepts unknown preset and reaction strings; `NoteStatePutSchema` refuses an empty body |
| `packages/content-schema/src/schemas/__tests__/sync.test.ts` (append) | unit | an inbox without `notes` / `notePrefs` parses with defaults; one malformed note is dropped, the rest and the plans survive |
| `packages/content-schema/src/schemas/__tests__/transfer-consent.test.ts` (append) | unit | `note_replies` exists with text; version bumped (hash test); `TEACHER_VISIBLE_NOTE_FIELDS` maps both fields |
| `packages/content-schema/src/__tests__/telemetry.test.ts` (append) | unit | exact list includes the seven `notes.*` names |
| `packages/backend/src/lib/__tests__/can.test.ts` (append) | unit | `feedback.send` for family caregiver / owner and class teacher / owner; not for school admin over a class, not for a school teacher; `feedback.oversee` family only |
| `packages/backend/src/__tests__/notes-routes.test.ts` | integration (memory and `test:sqlite`) | send to learners and to everyone; `not_in_space`; archived space; preset audience; label on a class refused; text problems answered 422 with `problem`; skipped `notes_off` and `limit`; `presetsOnly`; account limit 429; hold 403; list paging and statuses; an `everyone` batch collapses to one row without counts and splits per learner with `learner=`; withdraw own note; withdraw a co-adult's note 403; batch withdraw skips reported rows; withdraw a reported note 409; another space's teacher 404 |
| `packages/backend/src/__tests__/notes-device.test.ts` | integration (memory and `test:sqlite`) | inbox delivery rules 1-5 of section 6.8 incl. class scope and `presets` mode stripping text; 30 cap; state PUT idempotent, `readAt` set once, reaction last-wins; 404 for a hidden note; report from a class-scoped device allowed; prefs from a class-scoped device 403; hold after 2 distinct learners and after one `unsafe`; family report of a family note allowed, of the reporter's own note `422 own_note` |
| `packages/backend/src/__tests__/notes-retention.test.ts` | integration | 180-day filter before purge; purge bounds; reported 90-day rule; leave deletes live and hidden rows, keeps reported; `deleteLearner` removes all three tables and works when the tables are missing (pre-migration Worker) |
| `scripts/__tests__/check-migrations` (existing) | script | the new prefix is unique |
| `packages/i18n/src/__tests__/notes-messages.test.ts` | unit | every preset id, reaction id, family label id and report reason has en text; the rules of section 6.3 on every `common.notes`, `learner.notes` string (banned learner and caregiver lists in en / es / ko, no speaking words, no digits, no emoji, at most 12 words per sentence, length budget); `console.notes` and `caregiver.notes` pass the caregiver list; `viewer` third person in caregiver strings |
| `packages/design-system/src/components/Icon/__tests__/glyphs.test.ts` (append) | unit | `note`, `heart` exist and use the stroke helpers |
| `apps/mobile/src/logic/notes/__tests__/*.test.ts` | unit, 100 % (business logic) | `apply.ts` (inbox authoritative, pending writes kept, server ack replaces local, gone notes removed, withdrawn-while-open signal); `queue.ts` (one pending write per note, flush order, 404 / 409 / 5xx handling); `view.ts` (New / Earlier grouping, Home card selection and count, sender label from memberships, unknown preset fallback, `lang` choice); `copy.ts` selectors |
| `apps/mobile/src/store/__tests__/notes-store.test.ts` | unit (platform lane) | persistence through `platform/storage` only; profile removal clears the key; sibling isolation |
| `apps/mobile/src/screens/notes/__tests__/*.test.tsx` | component | Home card states; list empty / new / earlier; note page marks read on open, reaction radio group, suggest Start navigates, Tell a grown-up opens the gate with `NoteReport` |
| `apps/mobile/src/screens/parent/__tests__/ParentDashboardScreen.notes.test.tsx` | component | notes section, hide, report sheet, prefs disabled on a class-scoped device |
| `apps/web/src/lib/console/__tests__/notes.test.ts` | unit, 100 % (verification logic) | composer validation mirrors `checkNoteText` with friendly messages; recipient rows (`notes_off`, `presets`, limit line); status line words; family view grouping; no sorting by status (asserted) |
| `apps/web/src/app/__tests__/notes-page.test.tsx` | component | class view and family view; flag off renders nothing and hides the roster button; anonymized roster names in the picker |
| `apps/mobile/e2e/notes.spec.ts` (FB-14) | e2e, Playwright on the PWA build with a stubbed API | inbox note shows on Home, open marks read, react, go offline, react again, back online flushes; withdrawn note leaves the list |
| `apps/web/e2e/notes.spec.ts` (FB-14) | e2e over `apps/web/out` with a stubbed API | compose, text problem message, send to everyone, sent list statuses; no sideways scroll at 320 / 375 / 768 |

Coverage targets: `docs/tests/coverage-targets.md` rows for `packages/content-schema` (100 %), `packages/backend` (90 %), mobile business logic (90 % now, 100 % target), web verification logic (90 %).

## 14. Rollout and PR breakdown

### 14.1 PR table

| PR | Content | Size | Needs |
|---|---|---|---|
| FB-0 | `docs`: this spec; the eight wireframes; `docs/roadmap/TELEMETRY-NAMES-2.md` section L; F-ROUTE-001 section 6.4 row 2a; `docs/blueprints/10-app-map.md` screen rows; specs and wireframes README index rows; one-line cross-references in F-TCH-001 section 4 and F-PAR-001 section 3.4 | S | — |
| FB-1 | `feat(content-schema)`: `schemas/feedback.ts`, `feedback/note-text.ts`, inbox fields, `note_replies` consent item + version bump, `TEACHER_VISIBLE_NOTE_FIELDS`, seven telemetry names (append) | M | FB-0 |
| FB-2 | `feat(api)`: migration `NNNN_feedback_notes.sql` (additive), `Db` methods in types / memory / d1, `deleteLearner` extension, `learnerRateKeys` keys; sqlite round-trip tests. **Merge and deploy before FB-3 / FB-4a / FB-4b** | M | FB-1 |
| FB-3 | `feat(backend)`: `can()` actions, `lib/note-limits.ts`, `routes/notes.ts` recipients / send / list / withdraw, hold check on send, bounded purge, leave cleanup in the membership routes | M | FB-2 deployed |
| FB-4a | `feat(backend)`: inbox `notes` / `notePrefs` and the device state route | S | FB-2 deployed |
| FB-4b | `feat(backend)`: device hide / report / prefs routes, family oversight / hide / report / prefs routes, automatic hold | M | FB-4a |
| FB-5 | `feat(i18n)`: `common.notes` (presets, reactions, family labels, fallback), `learner.notes`, `caregiver.notes`, `console.notes`, `a11y.notes` in en; ko / es entries left to the F-I18N-001 review process; copy tests | M | FB-1 |
| FB-6 | `feat(design-system)`: icons `note`, `heart` | S | FB-0 |
| FB-7 | `feat(mobile)`: `logic/notes/*`, `store/notes-store.ts`, `sync-api` methods, inbox hook in `membership-store`, queue flush before inbox, profile-removal key, `flags.notesEnabled` (default off) | M | FB-1, FB-5 |
| FB-8 | `feat(mobile)`: Home card (row 2a), `Notes` and `NoteDetail` screens, Profile row, telemetry emits | M | FB-6, FB-7, design mocks, FB-1 names on the Worker, FB-4a deployed |
| FB-9 | `feat(mobile)`: grown-up zone notes section, report sheet, `NotesGrownUp` / `NoteReport` gate destinations, prefs | M | FB-8, FB-4b deployed |
| FB-10 | `feat(web)`: `lib/console/notes.ts` (API client, view models, validation messages), `ROUTES.spaceNotes`, `NEXT_PUBLIC_NOTES_ENABLED` in `config.ts` (default off) | M | FB-1, FB-5 |
| FB-11 | `feat(web)`: composer (`console/note-composer.md`) as a page section and a roster-card **Send a note** button; sent list (`console/notes-sent.md`) on `/teach/space/notes?id=` for class and family spaces | M | FB-10, design mocks, FB-3 deployed |
| FB-12 | `feat(web)`: family view (`console/family-notes.md`): every note to each learner, hide, report, class-notes setting | M | FB-11, FB-4b deployed |
| FB-13 | `docs`: owner runbook section (open reports query, record an outcome, place and lift a hold, delete a note on request); privacy page line in `landing.ts` legal (English) | S | FB-4b |
| FB-14 | `test` + `chore`: mobile and web e2e; flip both flags to default on (English; ko / es per OD-15) | S | all above |

### 14.2 Sequence notes

- FB-2 is the only migration. Server first: its merge applies the migration to production D1 (`apps/api` deploy command), then FB-3 / FB-4a / FB-4b may merge.
- FB-1 appends to `packages/content-schema/src/index.ts`, `schemas/sync.ts`, `schemas/telemetry.ts` and its test; keep the edits append-only so parallel rebases stay mechanical (implementation brief).
- FB-8 edits `HomeScreen.tsx` and `ProfileScreen.tsx`, which other specs edit; keep the edit to one block each (CLAUDE.md section 10) and follow the Home order table.
- FB-11 adds one button to the roster card in `app/(console)/teach/space/page.tsx`; nothing else on that page changes.

### 14.3 Dependencies

- Shipped: F-SPACE-001 (spaces, roles), F-SYNC-001 (inbox, devices), F-CONSOLE-001 (console shell), F-AUTH-002 (Clerk), F-I18N-001 (dictionary, banned words), F-PROF-001 (gate), F-LEARN-001 (self-managed learners), F-SPACE-002 T-3b (`rate_hits`, `presentTables`).
- Design: mocks in `design/screens/` for the learner card, list, note page, grown-up section, composer, sent list and family view (CLAUDE.md section 5), before FB-8, FB-9, FB-11, FB-12.
- Not needed: F-PAR-001 (still draft); this spec does not depend on its rewrite. The console host move (owner items 1, 3, 12) does not block anything here.

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
| `next_look_again` | Let's look at these letters again together. |
| `next_take_time` | Take your time. There is no rush. |
| `warm_thinking_of_you` | Thinking of you. Have fun learning today. |
| `warm_cheering` | Hoya and I are cheering for you. |
| `warm_see_you_in_class` | See you in class soon. |
| `warm_learning_together` | We love learning Korean with you. |

Fallback for an unknown id: "A note for you."

**Reactions:** Thank you · I will try it · I did it · This made me happy.
**Family labels:** Your family · Mom · Dad · Grandma · Grandpa · Aunt · Uncle · Your grown-up.
**Teacher label:** Your teacher · {class}.
**Learner lines:** Home card "A note from {sender}" / "{n} new notes" · button "Read" · list title "My notes" · empty "No notes yet. Notes from your teacher or family will show here." · groups "New", "Earlier" · note page "From {sender}" · suggest "Try this quest" with "Start" · reactions heading "Send a thank-you" · "Tell a grown-up" · withdrawn "This note was put away."
**Console lines:** "Send a note" · "Pick an encouragement" · "Add a few words (optional)" · counter "{n} of 120" · "Suggest a quest (optional)" · "Sign as" (family) · "Send to: everyone / choose" · "Notes are off for this student" · "Encouragement only for this student" · "3 notes today. You can send more tomorrow." · problems: link "Links can't be sent in a note." · contact "Email addresses, handles and phone numbers can't be sent in a note." · emoji "Please use words instead of emoji." · tone "Please choose a kinder word than \"{word}\"." · line break "Please keep the note to one line." · too long "Please keep it to 120 characters." · result "Sent to {n} students." · statuses "Sent" · "Opened" · "Not shown" · "Take back".
**Caregiver lines:** "Notes for {learner}" · "Hide from {learner}" · "Report" · reasons "Unkind" · "Unsafe" · "Not meant for {learner}" · "Something else" · "Report and hide" · "Notes from classes: All notes / Encouragements only / Off" · class-scoped device "Change this on a home device."

## Review log

- 2026-10-11: drafted from the owner request of 2026-10-11 item 7 and the current-system map (`ea9049e4`); child-safety, anti-shame, privacy, offline and deletion passes applied in the text; promoted to `ready` with every open choice turned into an owner decision with a default (section 12).
