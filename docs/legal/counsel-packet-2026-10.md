# Counsel review packet: classes, class moves and word progress (October 2026)

> **Status: DRAFT for outside counsel. No legal review has taken place.** Nothing in this packet has been reviewed or approved by a lawyer. Every piece of proposed wording below is a draft written by the product team for counsel to correct, replace or reject. The live privacy policy and terms carried the banner "Draft for review. This document is a working draft pending review by qualified legal counsel before public launch." (`landing.legal.draft`) until the owner removed it on 2026-10-21 (AMENDMENTS-SITE-NEWUSER SN-2, #804); the pages now say nothing about a legal review either way.
>
> **This file is public** (the repository is public). Do not add counsel's replies, privileged advice or notes of a call with counsel to this file or anywhere else in the repository; keep them outside the repository.
>
> **Overtaken in part by the owner's decisions of 2026-10-14** (`docs/specs/AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md`): the owner chose not to wait for counsel on T-8 and P-4b. Teachers see a learner's full progress, words included, once the family has read a one-time update; a teacher may move a learner between classes they teach, or into another class that accepts, without family consent, and the family is told afterwards; class moves are switched on. The privacy policy and terms describe this as the owner's decision. This packet still describes the earlier design in places; its questions remain open for counsel, and any answer can be applied through a new consent text version.
>
> Prepared 2026-10-14 for the owner of Hangul Route, to hand to an outside lawyer. Written for a reader who does not know the codebase. File paths and spec sections are given so each statement can be checked; "spec" means a feature specification under `docs/specs/`.

## How to read this packet

Hangul Route is a Korean alphabet (Hangul) learning app for learners of any age. Many learners are children. It runs as a web app at app.hangulroute.com (the same code is built for iPhone and Android). The intro site is hangulroute.com, which also hosts the Privacy Policy (`/privacy`) and Terms of Service (`/terms`).

This packet asks for decisions on two features that are built but switched off, or held back, until counsel approves:

- **Part A, gate T-8**: privacy and terms wording for teachers, classes, rosters and **class moves** (spec `docs/specs/F-SPACE-002-class-transfer.md`, PR row T-8, flip gate G2; the separate device-consent gate G6 is in A.9).
- **Part B, gate P-4b**: a new consent item that would let teachers see a learner's **word progress** summary (spec `docs/specs/F-VOC-005-word-progress-srs-sync.md`, PR row P-4b, which waits for the same counsel gate G2).
- **Part C**: a one-page summary table.
- **Part D**: the proprietary license (`LICENSE`, added 2026-10-14) and its fit with the Terms. No flag or gate depends on it; it asks counsel to confirm text that is already live.

Terms used below:

| Term | Meaning |
|---|---|
| Learner | The person learning on the app. Can be a child or an adult. Identified on our server by a random id, a nickname and progress data. |
| Family space | A group made by a grown-up's account. Its adults ("owner" and "caregivers") can see the learners in it, including their full saved progress. |
| Class | A group made by a teacher's account. A learner joins it by typing a 6-character join code. The teacher sees a summary of each learner's progress (the "roster"). |
| School | A group above classes. Its owner and admins can see and manage the classes under it (the "school-admin cascade"). |
| Grown-up path | How a profile is set up for someone else (a child or a student): a grown-up ticks a consent box and, if the device has no grown-up PIN yet, sets a 4-digit PIN (one PIN per device, not per adult; spec `docs/specs/F-LEARN-001-all-ages-onboarding.md` section 3.3). |
| Self path | How a learner sets up their own profile: they tick "I'm 13 or older and I agree to the Privacy Policy." (F-LEARN-001 decision L3). |
| Flag | A server or build setting that keeps a feature switched off. Only the owner changes a flag, never a code change. |

---

## Part A. Gate T-8: teachers, classes, rosters and class moves

### A.1 What exists today (live)

These parts are live and are already partly described in the privacy policy (A.6 quotes it):

1. **Joining a class.** A learner's device sends the class's 6-character join code. There is no approval step by the teacher and no grown-up PIN at this point (F-SPACE-002 section 2; `packages/backend/src/routes/spaces.ts`, `POST /:id/join`). A join code lives 30 days.
2. **What the teacher sees (the roster).** For each learner in the class: a display name (or initials only, if the class turns on "anonymize roster"; this is off by default for a class and on by default for a school), a picture (avatar), a reading-level label (not an age), the date the learner joined, the last active and last saved times, and a progress summary limited to an allow-list (A.4). The teacher never receives the learner's full saved progress (`packages/backend/src/lib/can.ts`: no teacher role holds `snapshot.read`). There is no export or download of a roster.
3. **Schools.** A school owner or admin automatically gets the same summary view and roster management on every class under the school (`can.ts`, the cascade block). A school-level teacher gets only "create a class".
4. **Leaving.** The learner's own device can leave a class at any time (Profile, then Leave). This is not PIN-gated.
5. **Removing.** The class teacher (or a school admin) can remove a learner from the class. No consent is needed for that.
6. **Deletion.** A family owner or caregiver can delete a learner's data everywhere (`DELETE /api/spaces/:id/learners/:learnerId/data`, F-TCH-001 section 10.3): the learner, devices, saved progress, memberships, re-link requests, notes and move records. A class teacher can do this only if the class is in "school consent mode", which is **locked off** until legal review (server setting `SCHOOL_CONSENT_MODE`, app-map decision #27; the console shows the option as "not yet").
7. **Name lookup by code.** Anyone holding a live class code can ask the server for that class's list of learner names (or initials) and learner ids. This exists so a returning student can pick themselves on a new tablet (F-TCH-001 section 10.1). It is rate-limited per server instance (F-SPACE-002 section 2, "Lookup leaks names by design"). A learner id is not a password: on its own it does not let anyone save progress for, join or leave a class as, or move the learner. Each of those needs a device already linked to that learner (`authorizeDevice` in `packages/backend/src/routes/spaces.ts` and `routes/sync.ts`). With the class code and a learner id, a new device can only ask to be linked, and the class's teacher must approve that request (F-TCH-001 section 10.1; `routes/relink.ts`).
8. **Onboarding consent** (F-LEARN-001 section 3.3, strings in `packages/i18n/src/messages/en/learner.ts`):
   - Grown-up path checkbox: "I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy." The option above it reads "Someone I look after (a child or a student)" with the line "I'm a parent, guardian or teacher, setting it up for them."
   - Self path checkbox: "I'm 13 or older and I agree to the Privacy Policy."
   - The answer to "who is learning" (child or self) stays on the device. The server never learns it (F-LEARN-001 decision L2). So the server cannot tell a child's record from an adult's.
   - **The consent tick itself stays on the device.** Ticking either box saves a time stamp on the device only (`guardianConsentAcceptedAt` or `selfConsentAcceptedAt`, `apps/mobile/src/store/account-store.ts`; F-LEARN-001 section 3.3). No account, no identity check and no server record go with it: the server code (`packages/backend`, `apps/api`) and the shapes the app sends to the server do not contain these fields. There is no method of verifying that the person who ticked is a parent.
   - **The server backup starts without any sign-in.** The first time the app saves a learner it sends the learner's nickname, level and avatar to our servers, and it backs up the learner's progress on start and after each change, so the learner can be restored with a Rescue Code (F-SITE-002 section 3.7 and its open counsel item OD-13; the in-app privacy card quoted in A.7 says the same).
   - **A class's consent setting records nothing today.** A class has a setting `consentMode`, which is `'parent'` by default. In that mode nothing is captured from a parent when a learner joins: no parent email, no consent record (F-SPACE-002 assumption A9; `docs/blueprints/10-app-map.md` decision #22). The only effect of the setting is that a class teacher cannot delete a learner's data unless it is `'school'` (A.1 item 6).

### A.2 The new feature: class moves (built, switched off)

A **class move** moves a learner from one teacher's class (the "source") to another teacher's class (the "destination") with the agreement of three parties. Everything below is from F-SPACE-002 sections 1 and 4. It is switched off by the server setting `CLASS_TRANSFER` (unset) and the console setting `NEXT_PUBLIC_CLASS_TRANSFER`; while off, every move route answers "not available" (`transfers_locked`). The owner turns it on only after every flip gate in F-SPACE-002 section 7 is met; counsel's part is gate G2 (this packet) and, separately, gate G6 (A.9).

**Who must agree (three "slots", all required, decision T2):**

| Slot | Who fills it |
|---|---|
| Learner side | A guardian, through the web console. Optionally (switched off separately, A.9) the learner's own device. |
| Source | The teacher of the class being left (or that school's admin). |
| Destination | The teacher of the class being joined (or that school's admin). |

**Who counts as a guardian (guard 9, section 4.2).** The server has no proof of parenthood. A "guardian" is an account that is the owner or a caregiver of a family space the learner is in, with three added checks: (a) the family membership is live; (b) both that account's and the learner's family memberships are at least 24 hours old; (c) the account has no role in the source or destination class or the school above either, and is not one of the teachers who agreed to this move. These checks are friction, **not proof of parenthood** (owner decision O-3). Any signed-in account can create a family space, and anyone with a family code can join it as a caregiver.

**Who can start a move (T4).** A guardian, or the source teacher. The destination teacher cannot start one. A guardian can switch off teacher-started requests for a learner ("Do not accept move requests from teachers"). An adult learner who manages their own profile can make the guardian route refuse to act for them (`selfManaged`).

**What the destination teacher sees, and when (T8).**

- Before the learner side agrees: nothing. The request is not listed for the destination.
- After the learner side agrees, until the move happens: the learner's **initials, picture and level label only**. Never the full name, never the learner id, never the source class or teacher, unless the learner side ticked "Tell the new class where I am coming from".
- After the move: the normal roster view (A.4), with the joined date set to the move date.

**Timing (T9, T12).** A request lives 14 days, then expires. After all three slots agree, there is a **48-hour cooling-off**. During it any guardian of the learner's families, and the learner's own device, can cancel. The move then happens as one database step: the learner joins the destination and leaves the source. The source class's tablets that were linked for that learner are unlinked, and its pending re-link requests are closed.

**What a move changes and what it does not (4.6, 4.10).** It changes one class membership. It does not copy, move or delete saved progress, cards, stars, the Rescue Code, the learner's own devices, their name, family memberships or other class memberships. The source teacher stops seeing the learner on their next page load; their own history keeps one line, "A student moved to another class", with a date and no name. What the source teacher saw, wrote down or printed before is outside the system. Unfinished homework from the source class goes away on the device; finished homework stays.

**School-admin cascade (T10, T11, as confirmed by the owner on 2026-10-14).** A school owner or admin can fill the source or destination slot for a class under their school, one slot per action, recorded as "via school admin". They can **never** fill the learner slot. Each class page shows the neutral line "Agreed by the school admin." only when that page's own slot was filled through the school admin; a page whose own slot a teacher filled does not show it, so the destination does not learn that the source agreed. (F-SPACE-002 decision T11 and review-log entry "2026-10-14, owner decision on T11 / D17"; mockup review item D17.) One account may fill both teacher slots in one click only when it directly owns or teaches both classes.

**Consent record (4.11, T13).** When the learner side agrees, the server stores: time, basis (`caregiver` or `device_attested`), the account or device id (never a name), the role, the consent text version, the language shown, which consent lines were shown, and fingerprints (SHA-256 hashes) of the destination and source names plus the destination's settings at the time. If any of those change before the move (for example the class is renamed, its owner changes, or it switches to school consent mode), the guardian is asked again. An audit table, `transfer_events`, records who did what and when, with ids and codes only, no names and no free text. Usage telemetry is never used as evidence of consent.

### A.3 What data moves on a move

Nothing is copied. A move swaps one membership row. What changes is **who can read** the learner's existing data:

| Party | Before the move | After the move |
|---|---|---|
| Source teacher (and its school admins) | Roster view (A.4) | Nothing new. One history line with no name. |
| Destination teacher (and its school admins) | Initials, picture, level label (after the learner side agrees) | Roster view (A.4). Homework progress only for the destination's own homework. |
| Family caregivers | Everything they saw before | Unchanged |

**Known gaps the wording must not hide (4.10, owner decisions B1 and O-5):**

1. Join-by-code and Leave stay as they are, so "leave class A, then join class B by code" is still a move with no consent from anyone. The guarantee "nobody gets the learner's data without the family" holds for the move path only. Flip gate G3 says the privacy copy must not call a move "the consent path" until the owner decides this (B1).
2. Anyone who holds the destination's live join code can read its list of learner names through the lookup (A.1 item 7) until the code is replaced. After a move into their class, the destination teacher is offered a "New class code" button.
3. A teacher could build a "family" around a child. The 24-hour and conflict checks above stop the simple case. The guardian's consent sheet lists everyone who can currently see the learner ("Today these people can see {learner}:"), and an audit event flags any former teacher who can still see the learner through another space.

### A.4 What a teacher can see: the allow-list

The roster summary is cut down to an allow-list (`packages/content-schema/src/schemas/transfer-consent.ts`, `TEACHER_VISIBLE_SUMMARY_KEYS`; F-SPACE-002 section 4.11). The same list produces the "What the new teacher sees" bullets in the consent sheet, and a test fails if the roster returns anything outside it. The current items, with their English consent wording:

| Item id | Consent wording (en) | Data behind it |
|---|---|---|
| `name_picture_level` | "{learner}'s name, picture and level" | display name (or initials), avatar, level label |
| `activity` | "When {learner} practiced, minutes each day and days in a row" | last active, streak, minutes in the last 7 days, day-by-day practice for reports (a class sees no day before the learner joined) |
| `quests` | "Quests done and how many answers were right" | Stage 1 quest counts and accuracy, stage-level route counts |
| `cards_letters` | "Cards earned, letters learned and letters that need practice" | cards, letters recognized, letters to practice |
| `level_check` | "Level check results" | placement level and strand statuses |
| `plan_progress` | "Progress on homework from {destination}" | homework progress, only for the viewing class's own homework |
| `sync_time` | "When {learner} joined the class and when progress was last saved" | joined date, last saved time |
| `note_replies` | "The answer {learner} picks on a note from the teacher" | one of four fixed reactions (F-FEEDBACK-001 section 7.7) |

Hidden from every teacher: `stage1Anchor` (Hangul Check detail), `selfRoute`, `routeGoal`, and `vocab` (word progress; that is Part B) (`TEACHER_HIDDEN_SUMMARY_KEYS`).

### A.5 Retention and deletion

From F-SPACE-002 section 4.1, and `TRANSFER_PURGE_AFTER_MS` in `packages/content-schema/src/schemas/transfer.ts`:

| Record | Kept for |
|---|---|
| Move requests that ended without a move (declined, cancelled, expired) and their audit events | Deleted 90 days after they ended |
| Move requests that happened (`executed`) and their audit events: the consent evidence | Kept while the learner exists and is still in the destination class. Once the learner is no longer in that class, deleted as soon as 90 days have passed since the move (so a learner who leaves a year after a move loses the record at the next purge). **The spec asks counsel to confirm this length (T-8).** |
| Abuse counters (`rate_hits`: failed code attempts, requests created) | Short-lived. Purged in bounded batches; the limits look back one hour or one day. |
| Per-learner switches (`learner_transfer_prefs`) | While the learner exists |

Purging runs when a new request is created, not on a timer, so a deletion can run later than the stated day if no one creates a request, and never if no request is created again (for example if `CLASS_TRANSFER` is switched off after some moves) (F-SPACE-002 section 4.1; the purge is called only from the request-creation routes in `packages/backend/src/routes/transfers.ts` and `transfer-device.ts`). See question A.10-7.

**Deletion.** Erasing a learner (A.1 item 6) also deletes that learner's move requests, audit events, switches and counters (`packages/backend/src/db/d1.ts`, `deleteLearner`; the database also cascades them). So consent evidence does not survive an erasure.

### A.6 Children under 13 and the grown-up path

- A profile for a child is made on the grown-up path (A.1 item 8): a grown-up ticks the box and, if the device has none yet, sets the device's grown-up PIN. **The box can be ticked by a teacher** ("or I set it up for them"); the option line names teachers. This is how a class-only learner (no family space) usually starts.
- The self path is for learners who attest they are 13 or older. The server is never told which path was used.
- The tick on either path is a time stamp kept on the device only, with no server record and no verification method, and the server backup of the learner's nickname, level, avatar and progress begins at the first save with no sign-in (A.1 item 8). The live policy's promise of "verifiable parental consent before any personal data is linked to an account" (A.7) must be read against these facts; see question A.10-13.
- For a move, the learner side can be filled only by a guardian in the console (a signed-in adult account in a family space). A teacher-started move for a class-only learner (no family space with a guardian account) cannot be answered by anyone and is refused (`family_needed`, F-SPACE-002 section 4.13). This is a known limit of version 1.
- The device route (A.9) is off. If it is turned on, a managed (child) profile's device could agree only for a move the learner side started, only behind a grown-up PIN at least 24 hours old, and the record says `device_attested`, never "guardian". The spec says plainly that this is **not** verifiable parental consent (decision A4).
- A self-managed learner aged 13 to 15 who moves classes raises the question of whether a single "13 or older" line fits every country's digital-consent age (owner decision B4).

### A.7 Current text that would change (quoted from the live pages)

The English text is the source; Spanish and Korean pages show it in English with a note that the English version applies (`landing.legal.englishAuthoritative`). All quotes are from `packages/i18n/src/messages/en/landing.ts`, `landing.legal`, rendered by `apps/web/src/components/landing/PrivacyPage.tsx` and `TermsPage.tsx` at `/privacy` and `/terms` (`apps/web/src/app/(en)/privacy/page.tsx`, `apps/web/src/app/(en)/terms/page.tsx`).

**Privacy Policy, "Who creates the account" (`privacy.sections.account.paragraphs.p1`):**

> Accounts are created and managed by the account holder (a parent or legal guardian when the learner is a child). When the learner is a child, the child uses the app, but a grown-up sets it up, enters any billing details, and confirms consent behind a parent-gate. We do not knowingly let a child under 13 create an account without verifiable parental consent.

**Privacy Policy, "What we collect", who can see progress (`privacy.sections.collect.bullets.progressWho`):**

> Who can see progress and reports: the learner's family caregivers, who can also recover the full saved progress; the teacher of a class the learner joined; and the owner and admins of that class's school. A class sees day-by-day history only from the day the learner joined, and all-time totals without the first practice day.

**Privacy Policy, "Children's privacy (COPPA / GDPR-K)" (`privacy.sections.children.paragraphs.p1`):**

> Many of our learners are children. Hangul Route is designed to comply with the U.S. Children's Online Privacy Protection Act (COPPA) and similar rules for minors. We practice data minimization, require verifiable parental consent before any personal data is linked to an account, and give parents the right to review or delete their child's data at any time.

**Privacy Policy, "Parental rights and choices" (`privacy.sections.rights.paragraphs.p1`):**

> A parent can review, export, correct, or delete their child's data, withdraw consent, and close the account. To make a request, email us from the address on the account and we will respond within 30 days.

**Privacy Policy, "Data retention and security" (`privacy.sections.retention.paragraphs.p1`):**

> We keep account data while the account is active and delete it within 90 days of an account being closed, unless we are legally required to keep it longer. We use industry-standard safeguards, but no system is perfectly secure.

**Terms, "Accepting these terms" (`terms.sections.accepting.paragraphs.p1`):**

> By using Hangul Route, you agree to these Terms of Service. If you do not agree, please do not use the app. Hangul Route is for learners of any age, and many learners are children: when the learner is a child, the parent or legal guardian who sets up the account accepts these terms on the family's behalf.

**Terms, "Accounts and parental responsibility" (`terms.sections.accounts.paragraphs.p1`):**

> The account holder (a parent or legal guardian when the learner is a child) creates and supervises the account, keeps sign-in details secure, and is responsible for activity under it. A child may use the app under that supervision. Account changes, purchases, and other sensitive actions sit behind a parent-gate.

**Terms, "Acceptable use" (`terms.sections.use.bullets`):**

> Use the app for personal, non-commercial learning.
> Do not copy, resell, reverse-engineer, or redistribute the content or software.
> Do not attempt to disrupt the service or access other families' data.

Note on "Acceptable use": the first bullet limits use to "personal, non-commercial learning", but teachers and schools use classes, and a school can buy a paid Group License. See DRAFT 7 and question A.10-14.

**In-app privacy card (grown-up area of the app)** (`caregiver.privacy.body` in `packages/i18n/src/messages/en/caregiver.ts`). Families and caregivers see this text in the app, so PR T-8 must keep it consistent with DRAFTs 1 and 2:

> Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When a learner joins a class or family with a code, that space sees the name they join with and their progress. A family's grown-ups can also restore their progress. We do not share with third parties.

(On a build with cloud saving switched off, `caregiver.privacy.bodyDeviceOnly` is shown instead; it does not mention classes.)

What the pages do **not** say today: anything about join codes, the name lookup by code, roster contents beyond "progress and reports", anonymized rosters, class moves, the consent record and its retention, school-admin agreement to a move, school consent mode, or the terms a teacher or school accepts. (The spec's assumption A9 says the pages never mention teachers; that is out of date, since `progressWho` and the notes bullet now do. They still say nothing about any of the items in this paragraph.)

### A.8 Proposed replacement and added wording (DRAFT)

Every block below is **DRAFT, not reviewed by counsel**. Plain English at a beginner reading level, as the rest of the site. Spanish and Korean versions follow only after counsel approves the English. Where counsel's answer to a question in A.10 changes the facts, the draft changes with it.

**DRAFT 1. Privacy Policy, new section "Classes, teachers and schools"** (after "What we collect"):

> A learner can join a class by typing the class's code. The class's teacher then sees the learner's name (or only initials, if the class hides names), picture, reading level, when the learner joined and last practiced, and a summary of their progress. The full list is shown in the app before a class move. A teacher never sees the learner's full saved progress, and cannot download the class list. If the class belongs to a school, the school's owner and admins see the same summary. Anyone who has a class's code can see the names (or initials) of the learners in that class, so a teacher can help a student find their own name on a new tablet. A teacher can make a new code at any time. A learner can leave a class at any time in Profile. A family caregiver can delete a learner's data at any time.

**DRAFT 2. Privacy Policy, new section "Moving to another class"** (only once `CLASS_TRANSFER` is on):

> A learner can move from one class to another. A move needs a yes from a grown-up in the learner's family, from the old class and from the new class. Before the family says yes, the new class sees nothing. After that, and until the move happens, the new class sees only the learner's initials, picture and level. The move happens 2 days after everyone agrees; until then anyone in the learner's family, or the learner on their own device, can cancel. A move copies nothing: cards, stars and progress stay with the learner. The old class stops seeing the learner when the move happens. We keep a record of each yes (who said it, when, and which version of the text they saw), without names. We delete records of moves that did not happen after about 90 days. We keep the record of a move that happened while the learner is in the new class. After they leave it, we delete it once about 90 days have passed since the move. **[Counsel: "about" is used because deletion today runs only when a new move request is created; see question A.10-7.]** Deleting a learner's data deletes these records too. Joining a class by code and leaving a class do not use this process.

**DRAFT 3. Privacy Policy, "Who creates the account", replacement:**

> Accounts are created and managed by the account holder (a parent or legal guardian when the learner is a child). When the learner is a child, a grown-up sets up the profile on the device, confirms consent behind a grown-up PIN, and enters any billing details. A teacher may set up a profile for a student. **[Counsel: state here the basis on which a teacher or school may consent for a student, or remove this sentence (question A.10-1).]** A learner aged 13 or older can set up their own profile. We do not knowingly let a child under 13 create an account without verifiable parental consent. **[Counsel: this last sentence depends on question A.10-13. Today the consent tick is kept on the device with no verification method, and the server backup starts with no sign-in (A.1 item 8).]**

**DRAFT 4. Privacy Policy, "Data retention and security", added sentence:**

> Records of class moves are kept as described under "Moving to another class".

**DRAFT 5. Terms, new section "Teachers, classes and schools":**

> If you create a class or a school, you agree to: invite only learners you teach; use what you see only to teach those learners; not copy or share learners' names or progress outside the app; and keep your class code private to your class. If you set up a profile for a student, you confirm that you are allowed to do so by the student's parent or guardian, or by the school. **[Counsel: wording depends on question A.10-1 and A.10-4.]** A school owner or admin can see and manage the classes of the school. We may remove a class or a teacher account that breaks these rules.

**DRAFT 6. Terms, "Acceptable use", added bullet:**

> Do not try to get a learner moved to your class, or see a learner's data, without their family's agreement.

**DRAFT 7. Terms, "Acceptable use", first bullet, replacement:**

> Use the app for personal learning, or for teaching a class you run, and not for any other commercial purpose. **[Counsel: question A.10-14.]**

**Consent lines for the move itself.** The text a guardian agrees to is in `packages/content-schema/src/schemas/transfer-consent.ts` (English and Spanish) and `transfer-consent-ko.ts` (Korean), current version `transfer-2026-10c` (`TRANSFER_CONSENT_TEXT_VERSION` in `schemas/transfer.ts`). Gate G2 requires counsel to review it in all three languages. The English lines:

| id | Shown | Text (en) |
|---|---|---|
| `moving` | always | "{learner} would move from {source} to {destination}." |
| `new_teacher` | always | "The teacher of {destination} will see {learner}'s progress." |
| `old_teacher` | always | "The teacher of {source} stops seeing {learner} in that class when the move happens, not before." |
| `keeps` | always | "Cards, stars and finished lessons stay with {learner}." |
| `cooling_off` | always | "The move happens after 2 days. Anyone in the family can cancel before then." |
| `visible_list` | always | "What the new teacher sees:" followed by the items of A.4 |
| `nothing_else` | always | "Nothing else from the app is shared with the teacher." |
| `visible_today` | always | "Today these people can see {learner}:" followed by a list from the server |
| `typed_names` | always | "Class and teacher names are typed by the teacher. We do not check them. Only continue if you know this teacher." |
| `from_teacher` | teacher-started | "This request came from the teacher of {source}, not from you." |
| `premium_may_change` | when access may change | "Lessons that were open through {source}'s plan may close after the move. Lessons already finished stay." |
| `school_delete` | destination in school consent mode | "The teacher of {destination} will be able to delete {learner}'s record." |
| `device_relink` | when a class tablet is affected | "A tablet that joined through {source} may need to join {destination} again." |
| `homework_drops` | when old homework is affected | "Homework from {source} that is not finished will go away. Finished homework stays." |
| `cannot_undo` | always | "A move can't be undone. {learner} can still leave a class in Profile at any time." |
| `introduce` | option, off by default | "Tell {destination} where {learner} is coming from." |

The sheet's agree button stays inactive until the reader has scrolled to the end. This is a scroll-position rule, not proof of reading; the spec leaves it to the owner and counsel at G2 whether it is enough (F-SPACE-002 section 4.11, "Layering").

### A.9 Separate gate G6: consent from the learner's own device

Built and off behind its own server setting, `CLASS_TRANSFER_DEVICE_CONSENT`, which stays off even after `CLASS_TRANSFER` is on (`apps/api/wrangler.toml` comments; F-SPACE-002 decision A4 and gate G6). If turned on, a learner's own device could start a move and say yes for the learner side, either through a grown-up PIN (managed profile) or as a self-managed learner (13 or older by attestation). The server cannot see the PIN or the learner's age, and the PIN belongs to the device, not to a named adult. The PIN can be set by whoever holds the device, including a child. The spec requires **written counsel sign-off that a PIN-gated or self attestation is acceptable as learner-side consent in the learner's jurisdictions** before this is turned on. Counsel may answer G6 later than G2; until then only the web guardian route can agree to a move.

### A.10 Questions for counsel (Part A)

1. **COPPA, school authorization.** Class-only learners are often set up by a teacher who ticks "I'm a parent or guardian of this learner (or I set it up for them)". Can a school or teacher authorize collection for a child under 13 in place of a parent for this app's educational use, and if so, what must the school agree to (a written agreement, a notice to parents, limits on use)? Must the checkbox wording change? Should a teacher-created profile be treated differently from a parent-created one?
2. **COPPA, verifiable parental consent for a move.** The guardian route relies on a signed-in account that has been in a family space for 24 hours and holds no class role. Is that adequate parental consent for a teacher of a new class to start seeing a child's progress, or is a stronger method needed? Is a move a new "disclosure" that needs fresh consent at all, given the child's data already reaches the old class's teacher?
3. **The join-by-code gap (B1).** Joining a class by code needs no consent from anyone. Is this acceptable under COPPA and the other regimes below, or must a join that lets a new teacher see a child's data be gated (owner options (a) to (c) in F-SPACE-002 section 9, B1)? Must the privacy policy describe the gap?
4. **Data processor terms for schools.** Should schools (and teachers acting for a school) sign a data processing agreement or school-service terms, with us as processor or service provider? Which terms are needed before a school uses classes, and before school consent mode (teacher deletion) is unlocked?
5. **FERPA.** If a US school uses classes, are we a "school official" handling education records, and what does that require (use limits, no redisclosure, deletion on request)? Does a class move between two schools raise a records-transfer question?
6. **GDPR (Article 8, children) and the UK Age Appropriate Design Code**, if the app is offered in the EU or UK. What is the lawful basis for a teacher's roster view and for a move? Does the single "13 or older" self line (B4) fit countries with a higher digital-consent age (up to 16)? Do the design defaults (initials-only before the family agrees, 48-hour cooling-off, the device veto, no ranking) meet the Code, and what else is needed (for example a data protection impact assessment)?
7. **Retention.** Is keeping the consent record of a move while the learner stays in the new class, then deleting it once they have left and 90 days have passed since the move, the right length? (A learner who leaves soon after a move keeps the record for up to 90 days; one who leaves later loses it at the next purge.) Is 90 days right for moves that never happened? Is deleting the consent evidence when a family erases the learner acceptable? Note that deletion today runs only when a new move request is created (A.5), not on a timer, so if moves go quiet, or `CLASS_TRANSFER` is switched off again after some moves, the records may be kept with no end date. May the policy say "about 90 days" (DRAFT 2), or must a scheduled deletion exist before launch?
8. **Name lookup by code.** Anyone with a live class code can read that class's list of names or initials and learner ids (A.1 item 7, owner decision O-5). Is this acceptable with notice (DRAFT 1), or must it be closed before moves are switched on?
9. **Consent lines, three languages.** Please review the lines in A.8 in English, Korean and Spanish (G2). Is the scroll-to-end rule an adequate record that the text was shown? Which language version governs if they differ?
10. **App store privacy labels.** The App Privacy label note in `docs/launch/app-store-submission.md` (section 5) predates server sync and classes. What must the labels say once classes, rosters and moves are live?
11. **Which countries.** The UI is offered in English, Spanish and Korean. Please list any other regime we must meet for launch markets (for example US state student-privacy laws, or Korea's Personal Information Protection Act).
12. **Device attestation (G6, may be answered later).** Is a PIN-gated or self attestation on the learner's device acceptable as learner-side consent in any of these jurisdictions (A.9)?
13. **Verifiable parental consent, as built today.** The grown-up tick is a check box plus (on a device with no PIN yet) a 4-digit device PIN, stored only on the device with no server record; the server backup of nickname, level, avatar and progress begins at the first save with no sign-in; joining a class by code records no parent consent (A.1 item 8). Is a device check box plus PIN a verifiable parental consent method under COPPA, or does an exception apply (for example to the backup)? Must the "Who creates the account" and "Children's privacy" sentences (A.7), and the last sentence of DRAFT 3, change to match these facts? (The same point is open as F-SITE-002 OD-13 item 5.)
14. **Classroom and school use under "Acceptable use".** The Terms limit use to "personal, non-commercial learning" (A.7), while teachers run classes and schools may buy a paid Group License. Does that bullet need an exception for classroom and school use, and is DRAFT 7 enough?

---

## Part B. Gate P-4b: teachers seeing a learner's word progress

### B.1 What the feature is

The app keeps a record of the Korean words each learner has met, for spaced review (F-VOC-005). It holds word ids, counts and days only: no free text, no names, no audio, no answer content (F-VOC-005 section 3.8, "Privacy"). From it the learner's device sends a short summary (`VocabSummarySchema`, F-VOC-005 section 3.8):

| Field | Meaning |
|---|---|
| `collected` | Number of words the learner has met |
| `strong` | Number of words the learner knows well (has reached review box 3 or higher) |
| `topicsStarted` | Number of word topics started |
| `topicsPracticed7d` | Number of word topics practiced in the last 7 days |
| `firstTryRate` | Share of first-try answers that were right, 0 to 1 |
| `needsPractice` | Up to three word ids to look at together |

Today **family caregivers** see a row in the grown-up dashboard: "Words: N collected, M strong. First-try rate: P %. To look at together: ...". **Teachers see none of it.** `vocab` is on the hidden list (`TEACHER_HIDDEN_SUMMARY_KEYS` in `packages/content-schema/src/schemas/transfer-consent.ts`), and the daily word counts in the activity history (`w`) are set to 0 for every class and school viewer (`packages/backend/src/lib/roster-summary.ts`, `withoutWords`). The console lines that would show words were shipped dormant (PR row P-4).

### B.2 What P-4b would change

PR row P-4b (F-VOC-005 section 6) would, in one change:

1. Add a `words` item to the "What the new teacher sees" list (`TEACHER_VISIBLE_ITEM_IDS`), in English, Spanish and Korean.
2. Move `vocab` from the hidden list to the teacher allow-list.
3. Bump the consent text version (from `transfer-2026-10c` to a new version) and keep the earlier versions on the accepted list (`ACCEPTED_CONSENT_TEXT_VERSIONS`), as the two earlier text changes did.
4. Copy only the known summary fields to teachers, and **drop `firstTryRate` for every roster viewer** (teachers and school admins never receive it).
5. Stop setting the daily word counts (`w`) to 0 in the activity history a class sees.

**What a teacher would then see:** per learner, "Words: N collected · M strong" and, when there are any, "Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)" (Korean word, romanization, meaning); a class-wide line "Words to revisit together: ..." listing the up to three words most often needing practice across the class, with no ranking or ordering of students (F-VOC-005 section 3.8); the number of words practiced each day in progress reports (from the day the learner joined). The fields `topicsStarted` and `topicsPracticed7d` would also reach the teacher's console, though no current console line displays them. School owners and admins see the same through the school cascade (A.1 item 3).

**Important for counsel: P-4b has no flag of its own.** Once it is merged, word progress becomes visible to the teacher of **every class** a learner is in, at the next page load. That includes classes joined by code with no consent sheet at all. The consent sheet with its item list is shown only on the class-move path, which is itself switched off (Part A). So for ordinary class joins the only notice is the privacy policy. Approval must therefore come **before** the P-4b change is merged.

### B.3 Current consent text that would change

The "What the new teacher sees" items quoted in A.4 (English), current version `transfer-2026-10c`. Spanish is in `transfer-consent.ts`, Korean in `transfer-consent-ko.ts`. The privacy policy's "What we collect" progress bullet (`privacy.sections.collect.bullets.progress`) already names "words for each day" among the data kept for progress reports, and the `progressWho` bullet (quoted in A.7) says a class teacher and the school's owner and admins can see "progress and reports".

### B.4 Proposed wording for the new item (DRAFT)

**DRAFT, not reviewed by counsel.** The Spanish and Korean lines are first drafts by the product team for counsel's review; they follow the existing consent items' style and the console's word terms (Spanish "palabras", Korean "낱말"), and have not had the product's language review yet.

| Locale | Item `words` (DRAFT) |
|---|---|
| en | "Words collected and known well, words each day, and up to 3 words to revisit" |
| es | "Las palabras conseguidas y las que ya sabe bien, las palabras de cada día y hasta 3 palabras para repasar" |
| ko | "모은 낱말과 잘 아는 낱말의 수, 날마다 연습한 낱말 수, 다시 볼 낱말 최대 3개" |

The English draft is 15 words, under the 16-word limit the consent text test enforces. It does not name the topic counts (`topicsStarted`, `topicsPracticed7d`); see question B.6-2.

**DRAFT privacy addition** (end of the `progressWho` bullet):

> For words, a teacher sees how many words a learner has collected and knows well, how many words they practiced each day, and up to three words to practice again. A teacher never sees how often the learner's first answer was right.

### B.5 How a family withdraws

There is no switch to hide words alone. What a family can do today:

| Action | Effect | Where |
|---|---|---|
| Leave the class | The teacher stops seeing all of the learner's data, words included, at the next page load | Learner's device, Profile, then Leave (`POST /api/spaces/:id/leave`; not PIN-gated) |
| Delete the learner's data | Erases the learner everywhere, including word progress | Console, family settings (`DELETE /api/spaces/:id/learners/:learnerId/data`) |
| Email request | "withdraw consent" under the privacy policy's parental rights (A.7) | Email to the privacy contact |

A family cannot remove a learner from a class in the console (that needs the class's own roster permission). What a teacher has already seen cannot be recalled.

### B.6 Questions for counsel (Part B)

1. Is a teacher's view of word counts and up to three words to revisit a new purpose or disclosure that needs fresh consent for learners already in a class, or is notice in the privacy policy enough? If fresh consent is needed, P-4b cannot ship as one change for every class at once.
2. Should the item list every field the teacher's console receives (including the topic counts), or only what is displayed?
3. Is dropping `firstTryRate` for teachers and school admins the right line (keeping it for families only), or should anything else be dropped?
4. Must a family be able to hide words (or the whole progress summary) from a class without leaving it? The product has no such switch today.
5. Versioning: earlier consent text versions stay accepted after a change, so a guardian who agreed under `transfer-2026-10c` (which does not mention words) would still have a valid record for a move. Is that acceptable, or must earlier versions be retired when the words item is added, so guardians agree again?
6. Do the Spanish and Korean drafts in B.4 say the same thing as the English?

---

## Part C. Summary table

| Gate | What counsel must approve | What ships after approval | Flag / PR |
|---|---|---|---|
| **T-8 / G2** (F-SPACE-002 section 7) | **Required for G2 (spec):** the consent lines in English, Korean and Spanish (A.8) and the retention length (A.5). **Also asked, for the wording of PR T-8:** privacy and terms wording for classes, teachers, schools, rosters, the name lookup and class moves (A.7, A.8, DRAFTs 1 to 7), and answers to A.10 questions 1 to 11, 13 and 14 | PR T-8: privacy and terms text (with Spanish and Korean), a legal-copy test, App Privacy label note. Then the owner may set `CLASS_TRANSFER=enabled` (server first) and `NEXT_PUBLIC_CLASS_TRANSFER` (console), **only** once the other flip gates are also met: G1, G3, G4 and G5 (owner decisions or design) and G7 (Worker code preconditions shipped by PRs) | Server `CLASS_TRANSFER` (unset), console `NEXT_PUBLIC_CLASS_TRANSFER`; PR row T-8 (not yet opened) |
| **G6** (F-SPACE-002 decision A4) | Written sign-off that a PIN-gated or self attestation on the learner's device is acceptable as learner-side consent (A.9, A.10 question 12) | No new PR needed for the routes (built and off). The spec lists further code preconditions before G6 (recording who changed `selfManaged`, a family line, a 24-hour wait). Then the owner may set `CLASS_TRANSFER_DEVICE_CONSENT=enabled` | Server `CLASS_TRANSFER_DEVICE_CONSENT` (unset) |
| **P-4b / G2** (F-VOC-005 section 6) | The `words` consent item in three languages (B.4), the field list with `firstTryRate` dropped (B.2), the version bump policy (B.6 question 5), the withdrawal position (B.5), the privacy addition (B.4) | PR P-4b: words item, version bump, `vocab` on the teacher allow-list, daily word counts unhidden. Live for every class at merge. The F-REPORT-001 `words_revisit` report line follows it | **No flag**: approval must come before the PR is merged |
| Related, not asked here: school consent mode (app-map decision #27, F-TCH-001 section 10.3) | Whether a class or school teacher may delete a learner's data under "school consent mode" | Owner sets `SCHOOL_CONSENT_MODE=enabled` (server) and `NEXT_PUBLIC_SCHOOL_CONSENT_MODE=enabled` (console) | Overlaps A.10 questions 1 and 4; counsel may answer it in the same review |

Nothing in this packet changes any flag, consent text version, code or live page. It records drafts and questions only.

---

## Part D. The proprietary license and the Terms

### D.1 What exists today (live)

- **`LICENSE`** at the repository root (owner decision 2026-10-14): "Copyright (c) 2026 Sungjoo Hwang. All rights reserved." It covers the software, the content (lessons, stories, art, audio, translations) and the trademarks (Hangul Route, Hoya). It grants no right to copy, modify, distribute or otherwise use them except (1) under a separate written agreement signed by Sungjoo Hwang, or (2) for end users of the service, to use the service as the published Terms of Service permit. It adds a no-warranty clause and a limitation-of-liability clause, both "to the maximum extent permitted by law", and states that use outside the grant is unlicensed. It names no governing law. It was written by the product team, not by a lawyer.
- **Every `package.json`** is `"private": true` and `"license": "UNLICENSED"`; nothing is published to npm.
- **Third-party notices**: `THIRD_PARTY_NOTICES.md` and the page hangulroute.com/licenses list the open-source packages, the iOS native libraries and the font the apps ship, with their licenses (generated by `scripts/third-party-notices.mjs`). The Terms' "Our content and your data" section now says those components keep their own licenses (`terms.sections.content.paragraphs.openSource`).
- **Copyright holder as shown**: `LICENSE`, the README and /licenses name "Sungjoo Hwang", an individual. The site footer reads "© {year} Hangul Route". The Terms say "us" and "our licensors" and never name the operator.

### D.2 Questions for counsel (Part D)

1. **Who is the operator and copyright holder?** `LICENSE` names an individual; the Terms name no one; the App Store seller name will be whatever the developer account says. Should all three name the same person or entity (and should a company be formed first)? If the holder changes, `LICENSE`, `landing.licenses.copyright` (en, es, ko), the generator's header and the footer change together.
2. **Footer and public name.** Is "© {year} Hangul Route" in the site footer an acceptable copyright notice next to a `LICENSE` that names Sungjoo Hwang, or should the footer name the holder? Should the individual's full name appear on public pages at all (it does on /licenses today)?
3. **Classroom and school use.** `LICENSE` lets end users use the service only as the Terms permit, and the Terms' "Acceptable use" says "personal, non-commercial learning", while teachers and schools buy a paid Group License. This is question A.10-14 and DRAFT 7; the license makes it more pressing, because a school customer is, on the text, outside the grant until the Terms change.
4. **Governing law and venue.** Since AMENDMENTS-SITE-NEWUSER SN-2 (#804) the Terms say only "These terms are governed by the laws of the jurisdiction stated at launch." (`terms.sections.law`); no jurisdiction or venue is named anywhere yet, and naming one is a new commitment for the owner to word. Which jurisdiction and venue should the Terms name? Should `LICENSE` carry the same clause once it is set, or defer to the Terms?
5. **Is `LICENSE` enough as written?** It is an all-rights-reserved notice for a private repository, not an end-user license agreement. Please confirm or correct its text (grant, warranty, liability, unlicensed use), and say whether the app needs a separate EULA, or whether Apple's standard EULA plus the Terms is enough for the App Store.
6. **Open-source notices.** Is listing the notices on hangulroute.com/licenses, linked from the app (behind the grown-up gate) and the site footer, an adequate way to meet the attribution and notice terms of MIT, BSD, Apache-2.0 (with NOTICE files), BSL-1.0 and OFL-1.1 for the web app and the iOS app? The Android app's native libraries are not listed yet; it is not released.
