Status: ready (spec, wireframes and mocks pass GX-0; amends F-SPACE-002 §4.2 and §4.8, `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` §5 (TV-D5 surface), F-APP-001 §3.8, F-TCH-001 §10.1 and F-CONSOLE-001 §3.4; implementation rows in section 13, GX-1 first; GX-5b owner-blocked on GX-OD-3; revised after the two PR #917 reviews, section 17)

# Amendment: approvals you cannot miss, a status next to every learner's name, and the grown-up UX pass of 2026-10-31

> Basis: `origin/main` `1bfda3fc8` (2026-10-31). Every `file:line` below is at that commit (paths under `apps/web/src/` unless they say otherwise).
>
> Wireframes (this PR): `design/wireframes/console/approvals.md` (status chip, attention banner, review sheet, re-link pop-up, home and nav badges, the incoming group) and `design/wireframes/parent/needs-you.md` (the family's Needs you strip, child chips, class line). Mocks (this PR): `design/screens/approvals/` (`README.md`, `mock/*.html`, `shots/*.png` at 360 and 1280, en, es and ko).

**Owner request 2026-10-31 (Korean, translated; with two phone screenshots of the Korean class page):** "When a learner joins a class or is moved and the teacher has to approve it, make it obvious: a pop-up or a clearer alert. A small 'Re-link requests 1' (연결 요청 1) is easy to miss. Better: an 'Awaiting approval' (승인 대기) button right next to the learner's name, or a class membership status like 'On board' next to each name. Also review, as a principal UX/UI designer would, everything a teacher or a parent does to look after learners and children, propose improvements and carry them out."

**Standing rules that apply here:** audience is anyone at any age (no age wording) · UI strings only through `packages/i18n` (`useMessages`), en + es + ko in the same PR, F-I18N-001 §3.10 style guide and glossary (Korean 해요체; never a particle on a variable); the es / ko values are re-signed in `review-ledger.json` only in a row's fix stage, after an independent reviewer passed them · design tokens only, no emoji · anti-shame (CLAUDE.md §1): no ranking, no comparison between learners, never `feedback.danger` for a learner's state, amber only · Worker first: a field or route ships in the Worker before a console build reads it · D1 additive only (this amendment adds no table and no column) · no PII in URLs, page titles or telemetry (opaque ids only; a count may go in the title, a name never) · `CLASS_TRANSFER` stays as it is (on, owner decision 2026-10-14) · Stripe sandbox only, no price added anywhere · production level: every row ships finished and passes the multi-agent review (MAR).

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | **The only sign of a waiting approval is a count inside one of nine equal pills.** "다시 연결 요청 1개" is the 7th pill of the class page's tool row (`app/(console)/teach/space/page.tsx:291-320`, owner screenshot 2); "기다리는 반 이동 N건" is another. Nothing appears next to the learner the request is about, nothing on the teacher home for a re-link, nothing in the nav. | A **status chip next to every learner's name** (section 4): amber **Needs your OK** (승인 대기) with the reason and inline **Approve / Deny** for a new device (Approve opens the confirm pop-up with the shipped safety hint, section 5.3); the quiet **In class** (참여 중) chip otherwise, the owner's "On board". A learner **asking to join** (a move into the class) gets its own card at the top of the roster with the same chip and inline **Accept / Not now**. An **attention banner** at the top of the class page with one **Review now** sheet (section 5). |
| 2 | **The most urgent request is the slowest to show.** A re-link closes after 10 minutes (`RELINK_WINDOW_MS`, `packages/content-schema/src/schemas/relink.ts:9`) but the class page re-reads it every 90 s (`VISIBLE_POLL_MS`, `lib/console/visible-refresh.ts:16`) and the teacher must tap home, class, pill, Approve. | A **pop-up for a new re-link only** (section 5.3) with one reminder at 2 minutes left, a re-link-only read every 20 s on the class page, a **re-link bar on every other console page** of the persona (section 5.5), and 1 tap in the pop-up (2 from a card or the sheet, where Approve opens the same pop-up; 3 from any other page). Moves, which stay open 14 days, get the chip and the banner, never a pop-up. |
| 3 | **The move count is wrong and stale.** `useMovesWaiting` counts only `transferRequests` (`components/console/MovesEntry.tsx:26-43`), so a teacher move into the class (TV-D8, `GET /class-moves` `incoming`) is never counted (the moves page showed 2 or 3 cards under a badge of 1 or 2); it reads once on mount and never again. | One count of **everything that needs this class's answer** (re-links + transfers whose own step waits + teacher moves into the class), refreshed with the page's poll and on roster changes (section 3.4). |
| 4 | **The family never sees its own approvals.** A move waiting for the family's OK is the last of five grey pills under every child card (`app/(console)/parent/page.tsx:451-455`), a child's re-link never shows on `/parent`, and the class-scope card (17 lines, `FamilyClassCards.tsx:89-140`) pushes every child off the first phone screen. | A compact **Needs you** strip under the family heading (the first child stays on the first phone screen; while a class-scope update is unread, only after GX-5b), a status chip and a class line on each child card, the move notice inside its child's card; the class-scope text in a sheet is proposed and waits for the owner (GX-OD-3, section 7). |
| 5 | **Joining is not approved today.** `POST /api/spaces/:id/join` takes a seat at once (`packages/backend/src/routes/spaces.ts:401-470`); what the owner saw as "approval" is a re-link (a known learner on a new device) or a move. | No join approval is added (default of GX-OD-4, section 15); a learner who joined in the last 7 days and has shared no practice yet (`summary === null`) shows **New** (새로 참여) instead of looking like a stale learner. |
| 6 | **The grown-up UX pass** (owner: "propose and carry out"): uneven buttons (the round "쪽지"), English stage titles in ko and es, "N haven't synced in a week" counting a learner who joined today, "1단계 기준: –", "다음 동기화를 기다리는 중" on learners who synced today, two "incoming" lists with opposite button order, the report's actions above its title, a phone nav that wraps, no error page. | Thirteen ranked improvements with exact copy (sections 8 to 10), rows GX-6 to GX-14. |

## 1. What was measured

Three read-only audits on detached worktrees of `origin/main` `1bfda3fc8` (no commits; scratch files outside the repo):

- **Approvals audit.** `next dev` against a Playwright-mocked API (`NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, `NEXT_PUBLIC_CLASS_TRANSFER=enabled`, ko-KR, 412 px): one class with three learners, one re-link, one family-started move out, one transfer in and one teacher move in. The class page badge read "기다리는 반 이동 2건" while the moves page held 3 waiting items; the re-link appeared only as the 7th pill.
- **Teacher console review.** The static export (`NEXT_PUBLIC_API_BASE_URL=https://api.ux-e2e.test`, dev auth, Learning Route, all locales, class transfer on) against a full API mock (4 learners: active, revisit letters, stale, joined today with no sync; one re-link with 7 minutes left; one teacher move and one transfer in; a 26-week route plan; a school; a family). 96 screenshots: 16 pages × ko / en / es × 390 and 1280 px. The ko 390 class page matches the owner's two screenshots line for line ("4단계 · Dialogue", the round "쪽지", "퀘스트 0 / 15 · 카드 1장" beside "이번 주 2분", "1단계 기준: –", "루트 · 26주: 다음 동기화를 기다리는 중").
- **Parent review.** The export with every parent flag on (reports, notes, class transfer, Learning Route, lecture mode, browse, content gating, PIN-reset sign-in, all locales): 12 parent pages × en / ko / es × 390 and 1280 px plus the PIN setup card and the lock screen, for a family of three (one with a waiting re-link and a teacher move notice, one with a move waiting for the family's OK and an unread class-scope update, one who joined and never synced). On a 390 px phone the move pill is about four screens down; the first screen shows no child at all. A mocked shape error on `/parent/notes` showed Next's white English "Application error": `app/` has no `error.tsx`.

Code facts each change rests on (checked at `1bfda3fc8`):
- the class page keeps only the length of the re-link list it already reads (`setPendingRelinks(relinks.data.length)`, `teach/space/page.tsx:111`), though every `RelinkView` carries `learnerId` and `learnerName`; each roster row carries `scope: 'base' | 'full'` (TV) and `joinedAt`, unused on the card;
- the card header holds only the name and the level pill (`teach/space/page.tsx:327-337`);
- the outgoing class-move view carries no `learnerId` (`packages/backend/src/routes/class-moves.ts:166-179`), and the source view of a transfer carries one only on a request this class started (`initiator === 'source'`, `packages/backend/src/lib/transfer-views.ts:346`; `lib/console/api.ts:644-653`), so neither can be matched to a roster card except by name. A class-started request is created with the source step already `consented`, so **the source class's own step waits only on family-started requests, which carry no `learnerId`**: before GX-W the "move out needs your answer" state can be counted and listed, never matched to a card;
- the class-move views' wire status is `'waiting' | 'moved' | 'ended'` (`routes/class-moves.ts:126` maps the stored `requested` to `waiting`; `lib/console/class-moves.ts:11`); `requested` is only the D1 status;
- a class transfer view carries `scheduledFor` (`lib/console/api.ts:633`), a family's learner-side view carries `executeAfter` (`:692`);
- re-links, transfers and class moves are expired lazily, on read (`expireIfDue` in `routes/relink.ts`; the transfer and class-move routes settle on read);
- `TeacherMovesSection`'s `live` ref is set false by the StrictMode double mount and never set true again (`components/console/TeacherMovesSection.tsx:66-72`): the section never renders under `next dev` (production is fine, dev QA and dev e2e miss it);
- `TeacherMovesSection` orders **Not now | Accept** (`:170-176`), `ClassTransferParts` orders **Accept | Not now** (`:300`);
- there is no web push, no `expo-notifications` and no mail sender in the repo; the settings page says email on join "opens later".

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| GX-D1 | **One learner status model.** A pure function `learnerStatus(input)` in `lib/console/learner-status.ts` turns the roster, the re-link list, the transfer list and the class-move list (or, once GX-W is deployed, the roster's own `pending` field) into **one status per learner**, the incoming items and the totals. The class roster, the review sheet, the settings rows, the home badges and the parent home all read it, so a learner never shows two different states on two screens. | The same fact is drawn today by five components with three counting rules. |
| GX-D2 | **A chip next to every learner's name, always with text.** One chip per learner, the highest-priority state wins (section 3.2). Action states are amber buttons labelled **Needs your OK** (승인 대기, the owner's word): a tap opens the decision for that item (the pop-up for a re-link, the review sheet at the item for a move); the card also keeps the inline buttons (Deny, Accept and Not now answer in one tap; a re-link's Approve opens the pop-up, which carries the safety hint, GX-D12). A learner asking to join gets its own card with the same chip at the top of the roster (section 4.1). The default state is a quiet **In class** (참여 중) chip on class rosters (GX-OD-1: shown, as the owner asked). Family rosters show no default chip. Amber means "your action" only; colour is never the only cue. | The owner's request, word for word: a button next to the name, or a membership status like "On board", for a learner joining or moving into the class too. |
| GX-D3 | **An attention banner and one review sheet.** When anything needs this class's answer, a banner sits under the class title, above everything else: "{n} requests need your OK · {r} new device · {m} class move" with **Review now**. The sheet lists every waiting item with its own action (Approve / Deny for a device, Accept / Not now for a move into the class, Review for a move out). `role="status"`, never auto-dismissed, gone when the count is 0. | One place to clear everything in one or two taps, the pattern of an inbox badge plus a triage sheet. |
| GX-D4 | **A pop-up for a new re-link, and a re-link bar everywhere else.** On the class page (and the parent home), when a poll finds a re-link id this tab has not shown, an `alertdialog` opens (Approve / Deny / Later), once per id per tab session, and once more at 2 minutes left if it was put off with Later. On every other console page of the teacher and parent personas (not lecture mode, not the presenter) the AdultFrame shows a re-link bar with **Review** while any re-link waits (section 5.5). Moves (open 14 days) never open a pop-up or the bar. | A re-link closes in 10 minutes and the learner is waiting at the device, so it must reach the grown-up on any page; a move is not urgent, and a modal for it would interrupt a teacher who is presenting. |
| GX-D5 | **Count everything that waits, and keep counting.** The count of a class = its pending re-links + its transfers whose own step waits (`pendingCount(views)`, every role) + its incoming teacher moves with wire status `'waiting'` and `kind: 'accept'`. Re-links count whatever `CLASS_TRANSFER` says; only the move parts follow the flag (`useTransfersShown`). The count refreshes on `useRosterChanges`, after any decision and on focus; how often it polls is section 5.4 (a re-link-only read every `RELINK_REFRESH_MS`, 20 s, on the class page while visible). | Fixes the uncounted teacher move (section 0 item 3) and the read-once count. |
| GX-D6 | **Home and nav carry counts, never learner names.** Each class row on the teacher home gets an amber **{n} need your OK** chip linking to the class page's sheet (`#attention`); the **Classes** tab (and **Home** for a parent) shows the number on screen ("Classes 2", "반 2") with the meaning in its accessible name; the tab title gets a "({n}) " prefix. | F-CONSOLE-001 §3.4: the home shows counts, not learners. A dot alone is the subtlety the owner complained about; a short number does not break the tab row. |
| GX-D7 | **The family's approvals come first, and the children stay on the first screen.** A compact **Needs you** strip directly under the family heading lists the family's waiting items (a move that needs its OK, a child's re-link, a class-scope update to read), one line each with its button inline; with more than 2 items the soonest-closing one keeps its row and the rest fold into one "{n} more things need you · See all" row. Each child card gets a status chip (text, not a second button) and a class line ("In: Sunday Class A"). The class-scope text stays the shipped card until the owner answers GX-OD-3 (owner-blocked row GX-5b). | The parent's approvals were the last thing on the page or missing; three full-height rows would push the first child off a phone screen again. |
| GX-D8 | **No new channel.** No push, email or SMS (GX-OD-5). Everything here is in the console. | No sender exists; a new channel is the owner's call. |
| GX-D9 | **No join approval mode.** Joining with a code stays instant (GX-OD-4). A learner who joined in the last 7 days and never synced shows **New**. The section 15 entry sketches what a "teacher approves joins" mode would need if the owner asks for it. | Today no join waits for anyone; adding a waiting state touches seats, the learner app and F-SPACE-001. |
| GX-D10 | **Privacy stays as it is.** A learner coming into a class shows initials, picture and level only until accepted (F-SPACE-002 T8, TV-D8); the source class's own learners are matched by id (GX-W adds the id where it is missing, GX-OD-2). | The source class already has the learner on its roster; T8 limits only the destination. |
| GX-D11 | **One button size.** `Button` and `buttonBase` (`components/console/ui.tsx`) get `minHeight: touchTarget.min` and `minWidth: touchTarget.child` (80), laid out `inline-flex` with the label centred, so no short label turns into a circle and no row mixes 40 px and 64 px buttons. | Owner screenshot 2: the round "쪽지" next to pills. |
| GX-D12 | **Every re-link Approve shows the safety hint.** Approving gives the new device a class-scoped credential for the learner (`packages/backend/src/routes/relink.ts:118-123`), and anyone with a live join code can look up the class's names (F-SPACE-002: "Lookup leaks names by design"). So no surface approves a re-link in one tap: **Approve** on the card, in the review sheet, in the parent strip and in the bar's destination opens the re-link pop-up (section 5.3), which shows the shipped `relinkApproveHint`, the platform and the request time next to its own Approve. **Deny** stays one tap everywhere (it only closes the request). | Review of PR #917: the countdown and the reminder push for speed, so the hint must sit on every approve surface; one dialog is simpler than repeating three lines on every card. |

## 3. The learner status model (GX-D1)

### 3.1 Types (`apps/web/src/lib/console/learner-status.ts`, pure, 100 % unit-tested)

```ts
export type LearnerStatusKind =
  | 'relink'        // a re-link request for this learner is pending in this space (action)
  | 'move_yours'    // a move of this learner out of this space waits for this space's answer (action; needs GX-W, section 3.3)
  | 'move_others'   // a move of this learner is open and waits for someone else
  | 'move_room'     // a move was agreed but the destination has no seat yet
  | 'move_scheduled'// a move is agreed and runs on a date
  | 'new'           // joined this space in the last 7 days and no summary yet
  | 'in_class'      // a member; nothing waits (class and school spaces only)
  | 'none';         // family spaces: no default chip

export interface LearnerStatus {
  learnerId: string;
  kind: LearnerStatusKind;
  action: boolean;                       // relink and move_yours only
  relink?: { id: string; expiresAt: string };
  move?: { source: 'transfer' | 'teacher'; id: string; to: string | null; on: string | null; expiresAt: string | null };
  scopeBase: boolean;                    // roster row scope === 'base' (a muted line, never a chip; TV-D3)
}

export interface IncomingItem {          // a learner asking to join this space (not on the roster yet)
  source: 'transfer' | 'teacher';
  id: string;
  alias: string;                         // initials only (T8)
  avatar: string | null;
  level: string | null;
  from: string | null;                   // the source class name (TV-D8) or null for a family
  expiresAt: string | null;              // transfer and teacher-move views both carry it (GX-1 adds it to the client class-move reader)
}

export interface OutgoingItem {          // a move out of this space that waits for this space's answer
  source: 'transfer';
  id: string;
  learnerId: string | null;              // null before GX-W on a family-started request (section 3.3)
  name: string | null;                   // the view's own learner name (the source class already lists the learner)
  avatar: string | null;
  to: string | null;
  expiresAt: string | null;
}

export interface AttentionModel {
  byLearner: Record<string, LearnerStatus>;
  incoming: IncomingItem[];
  outgoing: OutgoingItem[];              // every move_yours item, matched to a card or not
  totals: { relinks: number; moves: number; all: number };
}

export function attentionModel(input: {
  kind: 'class' | 'family' | 'school';
  roster: readonly RosterLearner[];       // with scope, joinedAt, summary and, after GX-W, pending
  relinks: readonly RelinkView[] | null;  // null = not read (older Worker or failed read)
  transfers: readonly TransferView[] | null;   // null also while class moves are hidden (useTransfersShown)
  classMoves: ClassMovesView | null;           // the same
  now: Date;
}): AttentionModel;
```

### 3.2 Priority (one chip per learner)

`relink` > `move_yours` > `move_room` > `move_scheduled` > `move_others` > `new` > `in_class` (or `none` in a family). An expired re-link (its `expiresAt` passed) is dropped before ranking; a move whose view status is not open (`moved` / `ended`, or a transfer `executed`, `declined`, `cancelled`, `expired`) is not a status (the learner leaves the roster or stays as `in_class`). `scopeBase` is never a chip: it adds the muted line "Words and more show once the family has read the update." (`console.reportScope.baseScope`, shipped) under the card's header.

### 3.3 Where each state comes from

| Kind | Before GX-W (client reads, all shipped) | After GX-W (one roster read) |
|---|---|---|
| `relink` | `GET /:id/relink-requests`, `learnerId`, `expiresAt` | `learners[].pending.relink` |
| `move_yours` | **never a chip**: the source class's own step waits only on family-started requests, whose source view carries `learnerId: null` (section 1). Each such view is still an `OutgoingItem` (name and avatar from the view), counted and listed in the sheet's "Moves out of this class" | `learners[].pending.move` with `step: 'yours'` (and the source view's `learnerId`, GX-W) |
| `move_others` | a transfer with role `source`, `learnerId` present (class-started), own step done, others waiting; an outgoing class move (`status === 'waiting'`) cannot be matched (no `learnerId`) and is not shown until GX-W | `step: 'others'` |
| `move_room` | the same transfer with `blockReason` present | `step: 'room'` |
| `move_scheduled` | the same transfer with `scheduledFor` in the future (class views; a family's learner-side view uses `executeAfter`) | `step: 'scheduled'`, `on` |
| `new` | roster `joinedAt` within 7 × 24 h of `now` and `summary === null` (nothing synced yet; a learner joins only from the app, so "never opened the app" is not true) | same |
| incoming | transfers with role `destination` and own step `waiting` (the list route already applies T8: a destination sees a request only once the learner slot or its own slot is `consented`); `class-moves` `incoming` with `status === 'waiting' && kind === 'accept'` | roster `incoming` count (with the same T8 predicate, section 12); items still from those two reads (the cards and the sheet need them) |

A read that fails, returns an unknown shape or is skipped (class moves hidden by `useTransfersShown` or the transfer lock) contributes nothing (never a guess, the `MovesEntry` rule). The model never matches by name. GX-1 therefore shows the `relink`, `new`, `in_class` chips and the class-started move states; `move_yours` chips appear once GX-W is deployed (GX-1 reads `pending` when present, so no second client row is needed).

### 3.4 Counts (GX-D5)

- `totals.relinks` = pending, unexpired re-links of the space. **Counted whatever `CLASS_TRANSFER` says.**
- `totals.moves` = `pendingCount(transfers)` (every view whose own step waits, matched to a card or not) + incoming class moves (`status === 'waiting' && kind === 'accept'`). Never computed from matched learners, so an unmatched family-started move out is still counted. 0 while class moves are hidden.
- `totals.all` = `relinks + moves`.

`useApprovalsWaiting(api, spaceIds, refreshKey)` (rename of `useMovesWaiting`, same file; the old name stays as an alias until no caller uses it) returns per space `{ relinks, moves, all }`. The re-link part runs even when `useTransfersShown()` is false; only the move reads are gated. With GX-W deployed it reads `GET /api/spaces` `spaces[].attention` (and, for a school admin, the school's `GET /api/spaces/:id/attention`, section 12) and asks nothing else; without it, it reads the lists per space **once on mount, on focus and after a decision** (`refreshKey`), never on a timer (section 5.4), so a school admin with 60 classes does not send 180 requests every 90 s.

## 4. The status chip (GX-D2; class roster, family roster, settings rows)

**Placement.** In the card header, right after `<strong id="roster-learner-{i}">{displayName}</strong>`, before the level pill; on a phone (below 45em) it wraps under the name, never pushes the name. One reason line under the header when the state has one.

| Kind | Chip (en / es / ko) | Reason line (en / es / ko) | Card actions | Style |
|---|---|---|---|---|
| `relink` | Needs your OK / Por aprobar / 승인 대기 | New device · {m} min left / Dispositivo nuevo · quedan {m} min / 새 기기 · {m}분 남음 | **Approve** (primary; opens the re-link pop-up with the safety hint, GX-D12) · **Deny** inline, one tap (`api.decideRelink`; result line `console.relink.approved` / `.denied`) | action chip; the card gets a `borderWidth.base` `feedback.nudge` border and moves to the top of the list |
| `move_yours` | Needs your OK / Por aprobar / 승인 대기 | Class move: {class} / Cambio de clase: {class} / 반 이동: {class}; with no destination name (the usual case): Moving to another class / Cambio a otra clase / 다른 반으로 이동 | **Review** (primary) opens the review sheet at this item | action chip, card border and order as above |
| `move_room` | Waiting for a seat / Esperando un lugar / 자리 기다리는 중 | — | none | `surface.sunken` (not amber: nothing for this teacher to do) |
| `move_scheduled` | Moving {date} / Cambia de clase el {date} / 이동 예정 · {date} | — | none | `feedback.infoLight` |
| `move_others` | Move waiting / Cambio en espera / 이동 대기 중 | Waiting for: {class} / Esperando a: {class} / 기다리는 반: {class} | none | `surface.sunken` |
| `new` | New / Nueva llegada / 새로 참여 | No practice shared yet / Aún sin práctica registrada / 아직 연습 기록이 없어요 | none | `feedback.infoLight` |
| `in_class` | In class / En la clase / 참여 중 | — | none | `feedback.successLight` with an 8 px `feedback.success` dot, text `text.primary` |

Rules:
- **Amber is "your action" only.** A `feedback.nudge` fill, border or dot appears on the action states (`relink`, `move_yours`, incoming) and nowhere else on the roster.
- `{m}` is whole minutes, rounded up, at least 1; the chip re-renders each minute (no seconds). At 0 the item drops on the next poll; an Approve that answers `409 expired` shows the shipped expired line and removes the chip.
- `{class}` is a class name the viewer may read (the source teacher chose the destination, TV-D8; a family's own classes). A family-started request carries the destination name only when `introduce` is set (F-SPACE-002 §4.3, off by default), so **a `move_yours` with no name uses `status.moveOut`** ("Moving to another class") as its reason line and in its chip's name; it is never left without a reason. For `move_others` and the incoming "From {class}" line, with no name the line is omitted.
- **An action chip is a `<button>`** (≥ `touchTarget.min` tall) whose accessible name is "{chip}: {reason}" (`aria-label`, e.g. "Needs your OK: New device · 8 min left"). Its tap opens the decision for that item: the re-link pop-up (section 5.3) for `relink`, the review sheet scrolled to the item for `move_yours` and incoming. The inline buttons stay (one tap for Deny, Accept and Not now; Approve opens the pop-up, GX-D12); each has `aria-describedby` = the name id and the reason line's id, so "Approve" is read with whose request it is. A status chip is a `<span>` inside the heading's text, read with the name.
- **Ordering.** Action cards first, by soonest `expiresAt` (a re-link, closing in minutes, before a move; transfers and teacher moves both carry `expiresAt`, GX-1 reads it from the class-move views too; a missing one last, then oldest request first); then the shipped "recent activity first" order (class) or join order (family, GX-8). A decided card keeps its place with its result line for 5 s (or until the next poll, whichever is later), then re-sorts, so the list never jumps under the teacher's thumb. This is ordering by what needs the teacher, never by a score.
- Never red, never "late", "behind" or "missing". Text is always `text.primary`; amber is a fill, border or dot only.

### 4.1 Learners asking to join (class roster, top)

Above the roster heading, under its own heading **Asking to join this class** (이 반에 들어오려는 학생 / Quieren unirse a esta clase), one card per incoming item (`attention.incoming`, both sources): the avatar chip, the initials only, the level pill (T8 holds until accepted), the **Needs your OK** action chip, the line "From {class}" (보낸 반: {class} / Viene de {class}) when the source class is known, and **Accept** (primary, first) · **Not now** inline (the shipped teacher-move or transfer decision; Not now on a transfer keeps the shipped reason step). The card has the action border. On Accept the card leaves and the learner appears on the roster after the reread with the state the model gives (usually **In class**: a moved learner already has a shared summary; **New** only when nothing has synced yet). The group is absent when nothing is incoming, and it shows on an empty class too. The review sheet still lists the same items so everything can be cleared in one place.

## 5. Attention banner, review sheet and the re-link pop-up (GX-D3, GX-D4)

### 5.1 Banner (class page, top; family roster page, top)

```
| [!] 3 requests need your OK                     [ Review now ] |
|     1 new device · 2 class moves                               |
```
- `role="status"`, `aria-live="polite"`; background `feedback.nudgeLight`, inline-start bar `borderWidth.thick` `feedback.nudge` (the `TeacherMovesSection` nudge pattern), text `text.primary`, **Review now** a primary button ≥ `touchTarget.min`.
- Shown only when `totals.all > 0`; the second line lists only the non-zero parts.
- **Its text changes only when a count changes** (the component keeps the last rendered counts and re-renders the region only on a difference), so a 20 s poll does not repeat the announcement.
- `#attention` in the URL opens the sheet on load (the home's link, GX-3); the hash carries no id.

### 5.2 Review sheet

A bottom sheet on a phone, a centred dialog from 45em (the `ConfirmSheet` frame: focus trap, Esc closes, focus returns to the opener, the page behind is inert). Title **Needs your OK** (승인 대기 / Por aprobar). Sections, each only when non-empty:
1. **New devices** — one row per re-link: avatar chip, name, "New device · {m} min left", **Approve** (opens the pop-up, GX-D12) / **Deny**.
2. **Asking to join this class** (이 반에 들어오려는 학생 / Quieren unirse a esta clase) — one row per incoming item: avatar, initials, level, "From {class}", **Accept** (primary, first) / **Not now**. This one list replaces the two lists of the moves page (section 0 item 6) in the sheet; the moves page itself is unified in GX-2 (one heading, primary first in both components).
3. **Moves out of this class** (다른 반으로 옮기려는 학생 / Salidas de esta clase) — one row per `attention.outgoing` item, matched to a card or not (name and avatar from the view): "Class move: {class}" when the destination is known, else "Moving to another class" (`status.moveOut`), **Review** (primary) opens the shipped consent card (Agree / Not now) inside the sheet.

Rows are ordered as the cards (section 4). After each decision the row shows its result line for 5 s and then leaves; the result is also written to a **polite live region inside the sheet** (`role="status"`, visually hidden), so a screen-reader user hears it although the row goes away. The count, banner and chips update at once (optimistic, then the reread). When the last item clears, the sheet **stays open** on its empty state, "Nothing is waiting." (기다리는 요청이 없어요. / No hay nada pendiente.), with focus on **Close**; it never closes itself.

### 5.3 Re-link pop-up (class page; parent home: opened by Approve from GX-4, on its own from GX-5)

- Opened by the action chip or **Approve** of any re-link (card, sheet, parent strip; GX-D12), and on its own by the trigger below.
- Trigger: a pending re-link id not in this tab's shown set (`sessionStorage` through the console's safe-storage wrapper, key `hr:console:relinkShown`, ids only), while the page is visible and no other dialog is open. One at a time, soonest-closing first. The action chip of a `relink` card opens the same pop-up for its request at any time.
- **Reminder.** A request put off with **Later** opens the pop-up once more when it has `RELINK_REMIND_MS` (2 minutes) or less left, with the same title and "This request closes in {m} min." (ids in a second set, `hr:console:relinkReminded`). Never a third time.
- `role="alertdialog"`, `aria-labelledby` the title, focus on the title; Esc = **Later**.
- Title: "New device request: {name}" / "Solicitud de dispositivo nuevo: {name}" / "새 기기 연결 요청: {name}". Body: the platform and the request time ("iPhone or iPad · asked 2 min ago": `relink.platform.*` with the shipped `relink.askedAgo` / `askedJustNow`, joined by `relinkPopup.meta`; the shipped `relink.device` when no platform is known), the shipped `relinkApproveHint`, and "This request closes in {m} min." / "Esta solicitud se cierra en {m} min." / "{m}분 뒤에 이 요청이 닫혀요.".
- Buttons: **Approve** (primary) · **Deny** · **Later** (Más tarde / 나중에). Later only closes; the chip and banner stay.
- Never on the lecture-mode or presenter pages (they are other routes; the pop-up lives in the class page and the parent home only; every other page has the bar of section 5.5).

### 5.4 Polling

| Page | Re-links | Moves and counts |
|---|---|---|
| Class page | a **re-link-only read** (`api.relinkRequests(spaceId)`, not the page's `load()` of five calls) every `RELINK_REFRESH_MS` (20 s) while the tab is visible, whether or not one is pending; also on focus and on `visibilitychange` to visible | with the shipped 90 s visible poll, on `useRosterChanges`, after each decision |
| Every other teacher or parent console page (AdultFrame, not lecture or presenter) | with GX-W: `GET /api/spaces` `attention` every `ATTENTION_POLL_MS` (30 s) while visible, on focus and on visible; without GX-W: none (the bar of section 5.5 needs `attention`) | the same `attention` read (home chips, school page counts, nav count); without GX-W: per-space lists once on mount, on focus and after a decision, never on a timer |
| Parent home | the family's re-link read every 20 s while visible, on focus | the quiet `load(true)`: 90 s visible poll and focus |

`document.title` gets "({n}) " in front while the page's total is above 0 (a count only, never a name). A test pins the number of calls per poll on each page.

### 5.5 Re-link bar (AdultFrame; GX-3 for teachers, GX-5 for parents)

While `attention` reports a pending re-link in any space of the persona, every console page of that persona except the class page, the parent home (they have the banner, the strip and the pop-up), lecture mode and the presenter shows a bar at the top of the main area, under the nav:

```
| [!] A new device needs your OK · Sunday Class A   [ Review ] |
|     8 min left                                               |
```
- One re-link: "A new device needs your OK · {space}" (Un dispositivo nuevo espera tu aprobación · {space} / 새 기기 승인 대기 · {space}), the second line "{m} min left" from `attention.relinkExpiresAt` (the soonest); **Review** goes to that space's page with `#attention` (a class) or to `/parent` (a family); the bar itself never approves.
- Two or more: "{n} new devices need your OK" (1 form: the one-space line) / "{n} dispositivos nuevos esperan tu aprobación" / "새 기기 승인 대기 {n}건"; **Review** goes to the space with the soonest one.
- `role="status"` (announced once when it appears; its text changes only with the count), `feedback.nudgeLight` with the inline-start amber bar, **Review** ≥ `touchTarget.min`. Not dismissible: it leaves when nothing is pending. A space name is on screen only (never in the URL or the title; the link uses the shipped `?id=` route, an opaque id).

## 6. Home, school and nav badges (GX-D6)

- **Teacher home** (`teach/home/page.tsx`, class rows): an amber chip **{n} need your OK** (1 form "1 needs your OK"; 승인 대기 {n}건 / {n} por aprobar) after the class name, linking to `ROUTES.space(id)#attention`. Replaces the separate "class moves waiting" pill on the row.
- **School page** (`SchoolAdmin.tsx`): each class link's count uses the same `all` (teacher moves and re-links included). `GET /api/spaces` lists only spaces the account is a member of (`packages/backend/src/routes/spaces.ts:143-171`), and a school admin acts on child classes through the cascade (`packages/backend/src/lib/can.ts:103-110`) without being a member, so these counts come from the school's own read: GX-W adds `GET /api/spaces/:id/attention` for a school (section 12), one grouped read for every child class. Before GX-W the school page keeps the shipped `TransferSchoolCountView` (transfers only) and adds no per-class reads.
- **Nav** (`AdultFrame.tsx`, `lib/console/shell-nav.ts`): the **Classes** (teacher) and **Home** (parent) tab shows the persona's total **as a number on screen**, a small `feedback.nudge` pill after the label ("Classes 2", "반 2"), when the total is above 0; the visible number is `aria-hidden` and the tab's accessible name carries the meaning: "Classes, {n} need your OK" (1 form "Classes, 1 needs your OK"; 반, 승인 대기 {n}건 / Clases, {n} por aprobar) and "Home, {n} to check" (홈, 확인할 일 {n}건 / Inicio, {n} por revisar). A one- or two-digit pill does not wrap the tab row (measured at 360 in the mocks); above 99 it reads "99+".
- **Per-persona totals.** Teacher: the sum of `all` over the classes the teacher can act on (member classes from `spaces[].attention`, a school's child classes from the school's `attention` read, each class counted once by `spaceId`). Parent: section 7.4.

## 7. Parent side (GX-D7)

### 7.1 Needs you strip (`/parent`, under `FamilyHeading`, before every card)

`role="region"` with the title as its name; amber inline-start bar per row. **Each row is compact**: avatar chip, one sentence (a second short line only for a time or a date), and its button(s) inline, wrapping under the text only when the row is narrower than the text plus buttons. Rows are ordered by soonest `expiresAt` (a re-link first), then oldest first.

**Fold rule.** With 1 or 2 items every item has its row. With 3 or more, the soonest-closing item keeps its row and the rest fold into one row: "{n} more things need you" (1 form "1 more thing needs you"; {n} cosas más por revisar / 확인할 일 {n}건 더) with **See all** (Ver todo / 모두 보기), which opens the items in the review-sheet frame of section 5.2 (title "Needs you", one row per item with the actions below). Goal, measured on the mocks at 360 x 740 with three items (a re-link and two class moves) and a move notice: the first child's name and week line are on the first screen.

**The shipped class-scope card until GX-OD-3.** `FamilyClassCards` renders the class-scope card right under `FamilyHeading` (`parent/page.tsx:481`), about 17 lines per child. GX-4 keeps it unchanged and in place, now directly under the strip and before the child cards (its move notices go into the child cards, see below); only GX-5b may move it, after the owner answers GX-OD-3. So while a class-scope update is unread, the first child is pushed below the first phone screen, as today; the first-screen goal and its e2e check (section 14) hold for any waiting items **without an unread class-scope update** in GX-4 and GX-5, and for every case only after GX-5b. The strip's **Read and OK** row scrolls to the card and focuses its heading.

**Who answers a family's move.** A learner-side move is the family's item only when the family can answer it from the console: `learnerRoute === 'caregiver'` on the learner-side view (`packages/backend/src/lib/transfer-views.ts:246-250`). When the learner manages their own classes or the caregiver route is off (`'device'` or `'none'`), the move is **not** a strip row, adds nothing to any count, and the child card shows the quiet status chip **Move waiting** (`status.moveWaiting`, `surface.sunken`, no amber).

| Item | Source | Sentence (en / es / ko) | Button |
|---|---|---|---|
| Move needs the family's OK | `transferRequests(familyId)` role `learner_side`, own step `waiting`, `learnerRoute === 'caregiver'` | A class move for {name} needs your OK. / Un cambio de clase de {name} espera tu aprobación. / {name}의 반 이동에 승인이 필요해요. · second line: New class: {to} · Ends in {n} days / Clase nueva: {to} · Termina en {n} días / 옮길 반: {to} · {n}일 뒤 마감 | **Review** (Revisar / 확인하기) opens the shipped consent sheet directly (2 taps, was 3-4) |
| A child's re-link | `relinkRequests(familyId)` | {name} wants to continue on a new device. / {name} quiere seguir en un dispositivo nuevo. / 새 기기 연결 요청: {name} · second line: {m} min left / Quedan {m} min / {m}분 남음 | **Approve** (opens the re-link pop-up, GX-D12; the pop-up ships on the parent home in GX-4, its auto-open in GX-5) · **Deny** inline |
| Class-scope update | `classScope(familyId).learners[].needed` | Read what {name}'s teachers can see. / Lee qué pueden ver los docentes de {name}. / {name}의 선생님이 보는 정보를 확인해 주세요. | **Read and OK** (Leer y aceptar / 읽고 확인): until GX-OD-3 is answered it scrolls to the shipped class-scope card (in place under the strip) and focuses its heading; after GX-5b, it opens the sheet of 7.3 |

The TV-D10 move notice ("{name} moved to a new class: {to}.", shipped) moves from its own card under the heading into the card of the child it is about, after the child's lines and before the buttons (same text, same **OK**, same seen write). All three reads join the page's quiet `load(true)` (90 s visible poll and focus), so a new item appears without a reload; the re-link read also runs every 20 s while visible (section 5.4).

### 7.2 Child card: status chip and class line

Right of the child's name (`parent/page.tsx` `card()` h3), one chip by the same priority, **a status `<span>`, not a button** (the strip owns the action; the card keeps its shipped border, no amber border): **Class move · needs your OK** (Cambio de clase · por aprobar / 반 이동 · 승인 대기), **New device · needs your OK** (Dispositivo nuevo · por aprobar / 새 기기 · 승인 대기), **Class info to read** (Aviso de clase por leer / 반 안내 확인 필요), **Moving {date}** (Cambia de clase el {date} / 이동 예정 · {date}), **Move waiting** (Cambio en espera / 이동 대기 중; a learner-side move the family cannot answer from the console, 7.1). The three action chips have the `feedback.nudgeLight` fill (the family's action); **Moving** has `feedback.infoLight`; **Move waiting** has `surface.sunken`.

**Class line.** Under the name, from `TransferList.options[].classes` of the family's `transferRequests(familyId)` read: GX-4 keeps the `options` that `useMovesWaiting` reads and discards today (a `familyOptions` state on `/parent`, filled by the same read in the quiet load). "In: {class}" (En: {class} / 소속: {class}); with two or more "In {n} classes" (En {n} clases / 소속 반 {n}곳) and the names in a second line; with none "Family only" (Solo en familia / 반 없이 가족 학습). **When the read is skipped (class moves hidden by `useTransfersShown` or the transfer lock), fails or returns an unknown shape, the class line is omitted** (never "Family only" on a guess).

The family's waiting-moves pill leaves the bottom row; the strip replaces it (its family wording, `console.transfer.familyNeedsYou(n)`: "{n} class move(s) need your OK" / "{n} cambio(s) de clase espera(n) tu aprobación" / "확인할 반 이동 {n}건", is the heading count on the family transfers page).

### 7.3 Class-scope sheet (amends TV-D5's surface; **owner-blocked**, row GX-5b)

Proposed: the class-scope text (`CLASS_SCOPE_TEXT`, content-schema) moves from an always-shown card on the home into a sheet opened from the strip or the chip. The text is unchanged and shown in full, with its list always open inside the sheet; **OK** writes the acknowledgement as today; the sheet cannot be closed by a backdrop tap while unread (Close is a button). `CLASS_SCOPE_TEXT_VERSION` does not change (no word changes). Because this changes a consent surface, it **does not ship on a default**: GX-OD-3 is owner-blocked and the shipped card stays where it is until the owner answers (the strip row scrolls to it).

### 7.4 Parent counts

- **Home tab number and `document.title` on `/parent`** = the family's pending re-links + its learner-side moves whose family step waits and that the family can answer (`learnerState` pending, role `learner_side`, `learnerRoute === 'caregiver'`) + its children with a class-scope update `needed`.
- With GX-W, the re-links and moves come from `attention` of the family space (section 12); the class-scope part from the shipped `classScope(familyId)` read of the quiet load (once on mount and on focus on other parent pages).
- The re-link bar (5.5) uses the re-link part only.

### 7.5 Family transfers page step word (Fix D)

When `view.role === 'learner_side'`, the learner slot's step word reads "Your answer needed" (Falta tu respuesta / 내 답을 기다려요) instead of "Family waiting", and the card shows "Ends {date}" (Termina el {date} / {date} 마감).

## 8. Teacher improvements, ranked by impact

| Rank | Problem (evidence) | Change | Row |
|---|---|---|---|
| T1 | Approvals invisible (sections 0-1) | Sections 3 to 6 | GX-1, GX-2, GX-3, GX-W |
| T2 | Buttons 40 px beside 64 px; short labels render as circles ("쪽지", "링크 복사"); `Button` / `buttonBase` have no `minHeight` (`components/console/ui.tsx`) | `buttonBase` gets `minHeight: touchTarget.min`, `minWidth: touchTarget.child` (80), `display: inline-flex`, centred; the per-call `minHeight` overrides are removed; **Remove from class** uses the danger tone (a destructive grown-up action, the token's reserved use; GX-10 decides whether it later becomes the quieter text button of T11/P7). Allowed exceptions until a follow-up row brings them onto `buttonBase`: the pills that keep their own 64 px floor (`TransferParts` `btnBase`, `ClassTransferParts` quiet and not-now buttons, `ConfirmSheet`, `DisplaySheet`, `BrowseLink` `actionStyle`); they already match the height | GX-6 |
| T3 | Class page order: the hero-size join code first, then goal, week, 9 equal pills, roster (owner screenshot 2) | Title row → banner → This week → action bar (primary **Plan: {title}** or **Plan this week**; secondary **Term plan**, **Lecture mode**, **Class report**; **More** holding Notes, Re-link, Class moves, Settings) → roster → **Invite students · code {code}** disclosure (expanded and hero-size only while the class is empty) | GX-7 |
| T4 | Roster card up to 9 lines; "Learning Route" dots + "Stage 1 in progress" + "Stage by stage" + "Route · 26 wk" say the same | Card = (1) avatar · name · chip … level pill; (2) "Practiced {when} · {n} min this week"; (3) "Stage 1 {title} · quests {d}/{t}" with the dots; (4) revisit letters when present; (5) plan line; (6) **Report** · **Note**. "Stage by stage" moves into the report | GX-7 |
| T5 | Empty class shows a code and 7 pills, most irrelevant | A 3-step checklist card; Re-link, Class moves, Notes and Lecture mode hidden until there is a learner | GX-7 |
| T6 | Stage titles are English in ko and es ("4단계 · Dialogue"; `lib/console/stage-titles.ts`) | The console shows the shipped es / ko stage titles of the content overlays (`content/i18n/{es,ko}/stages.json`, section 10.3), the same the learner app shows; en unchanged; tests against `apps/mobile/src/content/stages.ts` and the overlays | GX-9 |
| T7 | "N haven't synced in a week" counts a learner who joined today (`lib/console/rollup.ts:47`) | Exclude learners whose `joinedAt` is under 7 days ago; new copy | GX-8 |
| T8 | "1단계 기준: –" (null anchor; jargon) | Hidden when null; renamed "Stage 1 first-try answers: {a}" | GX-8 |
| T9 | "다음 동기화를 기다리는 중" on learners who synced today (`plans.ts:83`, `curriculum.ts:816` return `waiting` whenever `planProgress[planId]` is missing) | Two states: synced before the plan was published → "Gets this plan next time the app opens"; otherwise → "Not started yet (0 / {total})". The row also checks with real data why a learner who synced after publishing has no `planProgress` and records the finding in its PR | GX-8 |
| T10 | "퀘스트 0 / 15" next to "이번 주 2분" reads as nothing done | "Stage 1 quests: {done} of {total} · {cards} cards"; with 0 done and minutes > 0, "Working on the first quest" | GX-8 |
| T11 | Settings "Class learners" offers Move and Remove even for a learner with an open move; no status | The chip on each row; **Move to another class** disabled with the reason "A move is already open." while one is open; Remove in a quieter text-button style behind the shipped confirm | GX-10 |
| T12 | Re-link page: "Someone is asking to be {name}" alarms; Approve / Deny about 36 px; countdown static; "ios"; "240 min ago"; a 28 px native select; "Another way" printed twice | Section 10.2 copy, 64 px buttons, a minute countdown, platform names (`relink.platform.*`, added in GX-1), rolled-up times, the console's pill select, the prefix dropped; the shipped `relinkApproveHint` stays next to Approve on the page (the calmer "{name} · on a new device" never drops the hint); the page title and the class page's entry say "New device requests" (one term with the chip, section 10.1 glossary) | GX-12 |
| T13 | Learner report: actions and the print hint above the H1 (`ReportParts.tsx`); "36 / 연습 시간" has no unit; now and next-open stage repeat | H1 → status → actions; the hint only after Print; "36 min"; next-open hidden when equal to now; the classes line | GX-13 |
| T14 | Lecture card shows "약 20분" (preset) and "약 14분" (content) together | One line: "About 14 min (of 20)" | GX-14 |
| T15 | Class report "연습한 날 · 아직 없음: 9" unclear | "Didn't practice: {n}" | GX-8 |

## 9. Parent improvements, ranked by impact

| Rank | Problem (evidence) | Change | Row |
|---|---|---|---|
| P1 | Approvals last or missing (section 0 item 4) | Section 7 | GX-4, GX-5 (GX-5b owner-blocked) |
| P2 | A child card carries two facts; "Last active not yet" is not English | Line 1 "Practiced {d} of the last 7 days · {m} min" with the report's 7-day squares (fill only); line 2 "Next: {quest}" from `report-view.ts`'s next resolver; a child who never started: "Not started yet. Open the app on the device {name} uses." with **Open the app on this device** (opens the learner app in this browser, for when this is that device); quiet 7+ days: "A 5-minute quest is a good restart." | GX-11 |
| P3 | With 2+ children on a phone, the Lecture mode card sits between child 1 and child 2 (`lectureCardSlot` `afterFirstRow`) | 2+ learners below 70em: `afterMain`; the strip outranks Lecture mode in the 70em side column | GX-11 |
| P4 | Family roster titled "Most recent activity first" (backend sorts by `lastActiveAt`), contradicting the home's join order; "학생" for family members; "Stage 1 anchor"; sync jargon; "Joined: Tue" | Family roster in join order, heading "Learners" (우리 가족 학습자 / Quienes aprenden); kind-aware practiced line; "Joined Oct 14" via `formatDate` | GX-8 |
| P5 | No error page: any unexpected shape gives Next's white English "Application error" | `app/(console)/error.tsx` in the console locale with **Try again** (section 10.2) and the shipped **Learner app** as a way out (GX-14 review) | GX-14 |
| P6 | Phone nav wraps in en and es ("Billing" alone on row 2) | One row that scrolls inside itself (the app-shell D3 rule) with an inline-end edge fade while more tabs are hidden (new here; drawn in the 360 mocks), no second row | GX-14 |
| P7 | Family settings rows show only a join date; Move and Remove at equal weight; co-caregiver invite is a line of text | The class line and chip; equal button sizes; Remove quieter; **Invite another grown-up** copies the code with one line | GX-10 |
| P8 | Family re-link denial tells the child to "ask your teacher" | Kind-aware `console.relink.denied`: "…will say "ask your grown-up"." | GX-12 |
| P9 | PIN card's "Open the app" is vague | "Set the PIN in the app" | GX-14 |
| P10 | Report chooser rows show the name only | P2's line 1 under each name, join order | GX-11 |

Recorded, not changed: the class-scope text and the billing renewal line use 합니다체 (legal and pricing text, allowed by F-I18N-001 §3.10); a register change would bump `CLASS_SCOPE_TEXT_VERSION` and ask every family again (GX-OD-8).

## 10. Strings (drafts; en, es, ko land together in each row; the MAR reviews es and ko)

Korean rule applied throughout: no particle whose form depends on the final consonant (은/는, 이/가, 을/를, (으)로) on a variable; colon or "·" forms instead; the possessive 의, which never changes form, is kept; 해요체.

### 10.1 New keys of GX-1 to GX-5 (namespace `console`)

**One action wording per locale** (review of PR #917): en **Needs your OK**, es **Por aprobar** (a chip, a count or a title) / **Espera(n) tu aprobación** (a full sentence), ko **승인 대기**. Every status and count that asks the grown-up to decide is built from it, on the teacher and the parent side alike. One date order for a scheduled move: en "Moving {date}", es "Cambia de clase el {date}", ko "이동 예정 · {date}". Korean counts take the counter 건 ("새 기기 1건 · 반 이동 2건"). Plural keys go through `plural.ts` (en and es one / other; ko one form). **One name for a re-link** (glossary): en "new device", es "dispositivo nuevo", ko "새 기기" / "새 기기 연결"; GX-12 renames the shipped re-link page title and its class-page entry to match (10.2), so a grown-up never meets "다시 연결" and "새 기기" for one thing.

| Key | en | es | ko |
|---|---|---|---|
| `status.inClass` | In class | En la clase | 참여 중 |
| `status.needsOk` | Needs your OK | Por aprobar | 승인 대기 |
| `status.chipName(chip, reason)` | {chip}: {reason} | {chip}: {reason} | {chip}: {reason} |
| `status.newDevice(m)` | New device · {m} min left | Dispositivo nuevo · quedan {m} min | 새 기기 · {m}분 남음 |
| `status.moveTo(class)` | Class move: {class} | Cambio de clase: {class} | 반 이동: {class} |
| `status.moveOut` | Moving to another class | Cambio a otra clase | 다른 반으로 이동 |
| `status.moveWaiting` | Move waiting | Cambio en espera | 이동 대기 중 |
| `status.waitingFor(class)` | Waiting for: {class} | Esperando a: {class} | 기다리는 반: {class} |
| `status.moving(date)` | Moving {date} | Cambia de clase el {date} | 이동 예정 · {date} |
| `status.waitingSeat` | Waiting for a seat | Esperando un lugar | 자리 기다리는 중 |
| `status.new` | New | Nueva llegada | 새로 참여 |
| `status.noPractice` | No practice shared yet | Aún sin práctica registrada | 아직 연습 기록이 없어요 |
| `status.minutesLeft(m)` | {m} min left | Quedan {m} min | {m}분 남음 |
| `status.review` | Review | Revisar | 확인하기 |
| `attention.title(n)` | 1 request needs your OK / {n} requests need your OK | 1 solicitud espera tu aprobación / {n} solicitudes esperan tu aprobación | 승인을 기다리는 요청 {n}건 |
| `attention.devices(n)` | 1 new device / {n} new devices | 1 dispositivo nuevo / {n} dispositivos nuevos | 새 기기 {n}건 |
| `attention.moves(n)` | 1 class move / {n} class moves | 1 cambio de clase / {n} cambios de clase | 반 이동 {n}건 |
| `attention.cta` | Review now | Revisar ahora | 지금 확인 |
| `attention.sheetTitle` | Needs your OK | Por aprobar | 승인 대기 |
| `attention.devicesHeading` | New devices | Dispositivos nuevos | 새 기기 |
| `attention.incomingHeading` | Asking to join this class | Quieren unirse a esta clase | 이 반에 들어오려는 학생 |
| `attention.outgoingHeading` | Moves out of this class | Salidas de esta clase | 다른 반으로 옮기려는 학생 |
| `attention.from(class)` | From {class} | Viene de {class} | 보낸 반: {class} |
| `attention.empty` | Nothing is waiting. | No hay nada pendiente. | 기다리는 요청이 없어요. |
| `relinkPopup.title(name)` | New device request: {name} | Solicitud de dispositivo nuevo: {name} | 새 기기 연결 요청: {name} |
| `relinkPopup.closes(m)` | This request closes in {m} min. | Esta solicitud se cierra en {m} min. | {m}분 뒤에 이 요청이 닫혀요. |
| `relinkPopup.later` | Later | Más tarde | 나중에 |
| `relinkPopup.meta(platform, asked)` | {platform} · {asked} | {platform} · {asked} | {platform} · {asked} |
| `relink.platform.{ios,android,web}` | iPhone or iPad / Android / Web | iPhone o iPad / Android / Web | iPhone 또는 iPad / Android / 웹 |
| `relinkBar.one(space)` | A new device needs your OK · {space} | Un dispositivo nuevo espera tu aprobación · {space} | 새 기기 승인 대기 · {space} |
| `relinkBar.many(n)` | {n} new devices need your OK | {n} dispositivos nuevos esperan tu aprobación | 새 기기 승인 대기 {n}건 |
| `home.attention(n)` | 1 needs your OK / {n} need your OK | 1 por aprobar / {n} por aprobar | 승인 대기 {n}건 |
| `shell.navAttention.classes(n)` | Classes, 1 needs your OK / Classes, {n} need your OK | Clases, 1 por aprobar / Clases, {n} por aprobar | 반, 승인 대기 {n}건 |
| `shell.navAttention.home(n)` | Home, 1 to check / Home, {n} to check | Inicio, 1 por revisar / Inicio, {n} por revisar | 홈, 확인할 일 {n}건 |
| `parentHome.needsYou.title` | Needs you | Pendiente de tu respuesta | 확인이 필요해요 |
| `parentHome.needsYou.move(name)` | A class move for {name} needs your OK. | Un cambio de clase de {name} espera tu aprobación. | {name}의 반 이동에 승인이 필요해요. |
| `parentHome.needsYou.moveMeta(to, n)` | New class: {to} · Ends in {n} days | Clase nueva: {to} · Termina en {n} días | 옮길 반: {to} · {n}일 뒤 마감 |
| `parentHome.needsYou.relink(name)` | {name} wants to continue on a new device. | {name} quiere seguir en un dispositivo nuevo. | 새 기기 연결 요청: {name} |
| `parentHome.needsYou.scope(name)` | Read what {name}'s teachers can see. | Lee qué pueden ver los docentes de {name}. | {name}의 선생님이 보는 정보를 확인해 주세요. |
| `parentHome.needsYou.readOk` | Read and OK | Leer y aceptar | 읽고 확인 |
| `parentHome.needsYou.more(n)` | 1 more thing needs you / {n} more things need you | 1 cosa más por revisar / {n} cosas más por revisar | 확인할 일 {n}건 더 |
| `parentHome.needsYou.seeAll` | See all | Ver todo | 모두 보기 |
| `parentHome.status.move` | Class move · needs your OK | Cambio de clase · por aprobar | 반 이동 · 승인 대기 |
| `parentHome.status.relink` | New device · needs your OK | Dispositivo nuevo · por aprobar | 새 기기 · 승인 대기 |
| `parentHome.status.scope` | Class info to read | Aviso de clase por leer | 반 안내 확인 필요 |
| `parentHome.classLine.one(class)` | In: {class} | En: {class} | 소속: {class} |
| `parentHome.classLine.many(n)` | In {n} classes | En {n} clases | 소속 반 {n}곳 |
| `parentHome.classLine.none` | Family only | Solo en familia | 반 없이 가족 학습 |
| `transfer.familyNeedsYou(n)` | 1 class move needs your OK / {n} class moves need your OK | 1 cambio de clase espera tu aprobación / {n} cambios de clase esperan tu aprobación | 확인할 반 이동 {n}건 |
| `transfer.step.yourAnswer` | Your answer needed | Falta tu respuesta | 내 답을 기다려요 |
| `transfer.endsOn(date)` | Ends {date} | Termina el {date} | {date} 마감 |
| `settings.moveOpen` | A move is already open. | Ya hay un cambio abierto. | 이미 진행 중인 이동이 있어요. |

The parent's **Moving {date}** chip reuses `status.moving(date)`; the minutes line of the strip and the bar reuses `status.minutesLeft(m)`. These drafts go to the es and ko reviewers of each row's MAR with this consistency rule attached.

### 10.2 Changed and new keys of GX-7 to GX-14

| Key | en | es | ko |
|---|---|---|---|
| `space.week.notSynced(n)` (changed) | {n} haven't opened the app in over a week | {n} no abren la app desde hace más de una semana | {n}명은 일주일 넘게 앱을 열지 않았어요 |
| `space.week.anchor(a)` (changed) | Stage 1 first-try answers: {a} | Etapa 1, aciertos al primer intento: {a} | 1단계 첫 시도 정답률: {a} |
| `space.week.practicedFamily(p, n)` (new) | {p} of {n} learners practiced this week | {p} de {n} practicaron esta semana | 이번 주 연습한 학습자: {p}명 / {n}명 |
| `space.learner.questsCards(d, t, c)` (changed) | Stage 1 quests: {d} of {t} · {c} cards | Misiones de la Etapa 1: {d} de {t} · {c} tarjetas | 1단계 퀘스트 {d}/{t} · 카드 {c}장 |
| `space.learner.firstQuest` (new) | Working on the first quest | En la primera misión | 첫 퀘스트 진행 중 |
| `space.learner.practiced(when, n)` (new) | Practiced {when} · {n} min this week | Practicó {when} · {n} min esta semana | 연습: {when} · 이번 주 {n}분 |
| `plan.readout.notDelivered` (new) | Gets this plan next time the app opens | Recibe este plan al abrir la app | 앱을 다시 열면 이 계획을 받아요 |
| `plan.readout.notStarted(t)` (new) | Not started yet (0 / {t}) | Aún sin empezar (0 / {t}) | 아직 시작 전 (0 / {t}) |
| `space.rosterHeadingFamily` (new) | Learners | Quienes aprenden | 우리 가족 학습자 |
| `space.joinedOn(date)` (new) | Joined {date} | Se unió el {date} | 참여한 날: {date} |
| `space.invite(code)` (new) | Invite students · code {code} | Invitar estudiantes · código {code} | 학생 초대하기 · 코드 {code} |
| `space.more` (new) | More | Más | 더 보기 |
| `space.firstRun.steps` (new) | 1. Show the class code or QR. 2. Students tap Join a class in the app. 3. Plan this week. | 1. Muestra el código o el QR. 2. Los estudiantes tocan Unirme a una clase en la app. 3. Planea esta semana. | 1. 반 코드나 QR을 보여 주세요. 2. 학생이 앱에서 '반에 참여하기'를 눌러요. 3. 이번 주 계획을 만들어요. |
| `classReport.didntPractice(n)` (new) | Didn't practice: {n} | No practicaron: {n} | 연습하지 않은 학생: {n}명 |
| `relink.askingToBe(name)` (changed) | {name} · on a new device | {name} · desde un dispositivo nuevo | {name} · 새 기기에서 요청 |
| `relink.deniedFamily(name)` (new) | Closed. {name}'s device will say "ask your grown-up". | Cerrada. El dispositivo de {name} dirá "pregúntale a un adulto". | 닫았어요. {name}의 기기에는 "어른에게 물어보세요"라고 보여요. |
| `relink.title`, `relink.titleFor(space)` (changed) | New device requests · {space} · new device requests | Solicitudes de dispositivo nuevo · {space} · solicitudes de dispositivo nuevo | 새 기기 연결 요청 · {space} · 새 기기 연결 요청 |
| `space.relinkRequests.cta`, `space.relinkPending.cta(n)` (changed) | New device requests · 1 new device request / {n} new device requests | Dispositivos nuevos · 1 dispositivo nuevo / {n} dispositivos nuevos | 새 기기 연결 요청 · 새 기기 연결 요청 {n}건 |
| `relink.anotherWay` (changed) | the shipped sentence without its "Another way:" prefix, in all three | — | — |
| `parentHome.week(d, m)` (new) | Practiced {d} of the last 7 days · {m} min | Practicó {d} de los últimos 7 días · {m} min | 최근 7일 중 {d}일 연습 · {m}분 |
| `parentHome.next(title)` (new) | Next: {title} | Siguiente: {title} | 다음: {title} |
| `parentHome.notStarted(name)` (new) | Not started yet. Open the app on the device {name} uses. | Aún no ha empezado. Abre la app en el dispositivo que usa {name}. | 아직 시작 전이에요. {name}의 기기에서 앱을 열어 주세요. |
| `parentHome.restart` (new) | A 5-minute quest is a good restart. | Una misión de 5 minutos es un buen reinicio. | 5분짜리 퀘스트로 다시 시작해 봐요. |
| `parentHome.lastActive.notStarted` (new) | Not started yet | Aún no ha empezado | 아직 시작 전 |
| `settings.inviteGrownUp` (new) | Invite another grown-up | Invitar a otro adulto | 다른 보호자 초대하기 |
| `settings.inviteGrownUpLine(code)` (new) | They sign in, then enter this code: {code} | La otra persona inicia sesión y escribe este código: {code} | 로그인한 뒤 이 코드를 입력하면 돼요: {code} |
| `parentHome.pinCta` (changed) | Set the PIN in the app | Crear el PIN en la app | 앱에서 PIN 만들기 |
| `lecture.minutesOf(a, p)` (new) | About {a} min (of {p}) | Unos {a} min (de {p}) | 약 {a}분 ({p}분 중) |
| `report.minutesTile(n)` (changed) | {n} min | {n} min | {n}분 |
| `report.classesLine(list)` (new) | Classes: {list} | Clases: {list} | 소속 반: {list} |
| `errorPage.title` (new) | Something went wrong on this page. | Algo salió mal en esta página. | 이 화면을 여는 중에 문제가 생겼어요. |
| `errorPage.retry` (new) | Try again | Intentar de nuevo | 다시 시도 |

### 10.3 Stage titles (GX-9; content, heritage-accuracy bar)

| Stage | en (shipped `STAGE_TITLES`, unchanged) | es (shipped overlay) | ko (shipped overlay) |
|---|---|---|---|
| 1 | Hangul | Hangul | 한글 |
| 2 | Words | Palabras | 낱말 |
| 3 | Sentences | Oraciones | 문장 |
| 4 | Dialogue | Diálogo | 대화 |
| 5 | Stories | Historias | 이야기 |
| 6 | Real-use | Uso real | 실생활 |
| 7 | Self-expression | Expresión personal | 자기표현 |

The en values are the shipped `STAGE_TITLES` (`lib/console/stage-titles.ts`), equal to `titleEn` in `apps/mobile/src/content/stages.ts`. A stage title is content, not a dictionary string (F-I18N-001 §3.6, the comment in `stage-titles.ts`), and its es and ko values already ship in the content overlays `content/i18n/es/stages.json` and `content/i18n/ko/stages.json` (`stage:stageN.title`), which the learner app shows. GX-9 therefore adds **no** dictionary key and no new translation: the console shows the overlay title for the UI locale (English when the overlay has none), and its test asserts en equals `stages.ts` and the console's es / ko titles equal the overlay files. No en rename is proposed. (Corrected after review: the first draft listed en titles that do not exist and drafted es / ko for them.)

## 11. Accessibility, privacy, anti-shame, telemetry

- **Accessibility.** Every chip has text; colour is never the only cue (WCAG 1.4.1); amber is a fill, border or dot with `text.primary` text (contrast of `text.primary` on `nudgeLight` and `infoLight` is above 12:1). Action chips and every button are at least `touchTarget.min` tall; an action chip's name is "{chip}: {reason}" and the inline buttons are described by the name and the reason. The banner is a polite live region whose text changes only when a count changes; the review sheet's results go to its own polite region, and the sheet never closes or moves focus by itself (WCAG 3.2, 2.2.1); the pop-up is an `alertdialog` with focus on its title, Esc = Later, focus returned to where it was. The countdown updates once a minute and is not live-announced. The nav's visible number is `aria-hidden` and the tab's accessible name carries the count and its meaning. All of it holds at 320 px with the Largest text size and at 200 % browser text (the DN fit rule).
- **Privacy.** Incoming learners show initials, picture and level until accepted (T8). The home, the nav and the title carry counts only; the re-link bar shows a class or family name on screen, never a learner's name, and its link carries the shipped opaque space id only. `#attention` carries no id. The pop-up's shown set holds request ids only, in `sessionStorage`. No name reaches a URL or an event. GX-W's new fields are read under the same access checks as the roster (`learner.transfer` or roster read on the space) and add no field to any family or learner view beyond its own learners.
- **Anti-shame.** No chip says late, behind or missing; **New** describes a join, not a lack, and its reason line says what is true ("No practice shared yet"); the ordering puts what needs the grown-up first and is never by score; no counts of declined moves; no actor on an ended move (TV).
- **Telemetry.** None added. The Worker's existing `space.move.*` and re-link records are enough; a success measure for this amendment is the share of re-links approved before expiry, readable from the D1 rows already kept.

## 12. Data and API (GX-W, additive, Worker first)

| Route | Addition | Rule |
|---|---|---|
| `GET /api/spaces/:id/roster` | `learners[].pending?: { relink?: { id, expiresAt }, move?: { source: 'transfer' \| 'teacher', id, step: 'yours' \| 'others' \| 'room' \| 'scheduled', to: string \| null, on: string \| null, expiresAt: string \| null } }`; top-level `incoming?: number` | Built from the same rows the three list routes read. **The settle-on-read (expiry, executed transfers) runs before `membersOf`**, so an executed transfer is never listed both as a member and as pending. `to` only where the viewer may read the class name (TV-D8). **Each subfield is gated on the action that can decide it**: `pending.relink` needs `roster.manage` on the space; `pending.move` needs `learner.transfer` (class) or `snapshot.read` (family); `incoming` needs `learner.transfer` and counts with the T8 predicate below. The roster route itself still needs only `summary.read`, so a viewer without those actions gets no `pending`. Computed set-based for the whole roster (one query per source table, `IN` chunks of 100). |
| `GET /api/spaces` | `spaces[].attention?: { relinks: number, moves: number, relinkExpiresAt: string \| null }` (the route returns `{ spaces }`, `packages/backend/src/routes/spaces.ts:170`) | Counts only (plus the soonest re-link expiry for the bar's minutes). **Read-only and expiry-safe: every count filters `expires_at > now` (re-links, transfers, class moves) and never writes**, so a past-expiry row not yet settled is not counted and `attention` equals what the list routes return after their settle. `relinks` is present where the caller has `roster.manage`; `moves` where it has `learner.transfer` (class) or `snapshot.read` (family), else 0. **`moves` per space kind**: a class = transfers whose source step waits for this class + transfers whose destination step waits for this class **and that this destination may see under T8** (the learner slot is `consented` or the destination slot already is; F-SPACE-002 T8, the same predicate as its list route) + incoming class moves `requested` with `kind = 'accept'`; a family = learner-side transfers whose family step waits (`learner_state` pending) **and that the family can answer** (the learner does not manage their own classes and the caregiver route is on: `learnerRoute === 'caregiver'`, 7.1). The same T8 predicate applies to roster `incoming` and to `pending.move` on a destination. Test fixture: a class-started request with the learner step pending gives the destination `attention.moves` 0, `incoming` 0 and an empty list. Grouped `COUNT … GROUP BY space_id` over the caller's spaces, so a school admin with 60 classes stays inside the statement budget (test). |
| `GET /api/spaces/:id/attention` (school, new, read-only) | `{ classes: [{ spaceId, relinks, moves, relinkExpiresAt }] }` for every live child class | School admin only (the parent-school cascade, `packages/backend/src/lib/can.ts:103-110`); the same counting rules, T8 predicate and expiry filter as `spaces[].attention`; grouped `COUNT … GROUP BY space_id`, never per class, no settle; statement-budget test with 60 classes. Feeds the school page's per-class counts and a school admin's persona total (section 6) |
| `GET /:id/class-moves` (class) | `outgoing[].learnerId` while the stored status is `requested` (wire `waiting`) | the source class already lists the learner |
| `GET /:id/transfer-requests` (class, role `source`) | `learnerId` on every open request, family-started included (GX-OD-2; amends F-SPACE-002 §4.2) | the source class already lists the learner; the destination view is unchanged (T8) |

Schemas are lenient on the client (`.catch` defaults): a console that meets an older Worker falls back to its own reads (section 3.3). No migration; no new table, index or column.

## 13. Rows (implementation PRs; every UI row adds en, es and ko, links its GX-0 mock and attaches 360 and 1280 screenshots)

| Row | Content | Size | Depends on |
|---|---|---|---|
| **GX-0** (this PR) | `docs(specs,design)`: this amendment; wireframes `console/approvals.md`, `parent/needs-you.md`; mocks `design/screens/approvals/`; pointer lines in F-SPACE-002, the TV amendment, F-APP-001, F-TCH-001, F-CONSOLE-001 and the specs README | M | — |
| **GX-1** (owner's request, first) | `feat(web,i18n)`: `lib/console/learner-status.ts` (section 3; reads `pending` when present, so the `move_yours` chip lights up once GX-W is deployed); the chip and reason line on the class and family roster cards; the "Asking to join this class" cards with inline Accept / Not now (section 4.1); inline Deny and an Approve that opens the re-link decision dialog (`RelinkPopup.tsx`, opened by the chip and Approve only; title, platform, request time, the shipped hint; GX-D12); `expiresAt` added to the client class-move reader (lenient); action cards first by soonest expiry; `useApprovalsWaiting` (teacher moves counted, re-links counted whatever `CLASS_TRANSFER` says, `refreshKey`, no timer without `attention`); the class page's re-link-only read every 20 s while visible; `console.status.*`, `console.attention.incomingHeading`, `.from`, `console.relinkPopup.*`, `console.relink.platform.*` | M | GX-0 |
| **GX-W** | `feat(backend,content-schema)`: section 12 (roster `pending` and `incoming` with per-field gates and settle before `membersOf`, spaces `attention` with expiry filter, the T8 predicate, the caregiver-route rule and `relinkExpiresAt`, the school's `GET /:id/attention`, `learnerId` on open outgoing class moves and on family-started source transfer views); statement-budget test; memory and sqlite adapters | M | GX-0 |
| **GX-2** | `feat(web,i18n)`: attention banner, review sheet (`components/console/AttentionParts.tsx`, outgoing rows by view), the re-link pop-up's auto-open (`RelinkPopup.tsx` from GX-1) with the 2-minute reminder, the action chip opening the pop-up or the sheet at the item, `#attention`, the "(n) " title prefix; one incoming list with primary-first buttons on the moves page (`TeacherMovesSection.tsx`, `ClassTransferParts.tsx`); the `live` ref fix (set true in the effect body); `console.attention.*`, `console.relinkPopup.closes` | M | GX-1 |
| **GX-3** | `feat(web,i18n)`: teacher home row chip linking to `#attention`; the school page's counts include teacher moves and re-links (from the school's `attention` read); nav count on screen and accessible name (`AdultFrame.tsx`, `shell-nav.ts`), kept in sight on a phone: while the counted tab is scrolled out of GX-14's one-row nav (a page whose tab sits at the row's end), the start fade carries the amber count (GX-14 review); the teacher re-link bar on every other console page (section 5.5) and the 30 s `attention` poll; `console.relinkBar.*`, `console.home.attention`, `console.shell.navAttention.*` | S | GX-1, GX-W |
| **GX-4** | `feat(web,i18n)`: parent Needs you strip (`components/console/FamilyNeedsYou.tsx`, `needsYou(view)` in `lib/console/parent-home.ts`) with compact rows and the fold rule, a family move counted and shown only when `learnerRoute === 'caregiver'` (else the quiet Move waiting chip), the shipped class-scope card kept in place under the strip, child status chip and class line (`familyOptions` kept from the transfer read; omitted when unread), inline re-link (Deny one tap; Approve opens `RelinkPopup`), consent sheet opened directly, the move notice inside its child's card, the family pill leaves the bottom row; the three reads in the quiet load; Fix D step word and end date | M | GX-1, GX-2 |
| **GX-5** | `feat(web,i18n)`: re-link pop-up on the parent home (20 s re-link read while visible, the reminder); the parent Home nav count and the parent re-link bar on the other parent pages | S | GX-4, GX-2, GX-3 |
| **GX-5b** (owner-blocked: GX-OD-3) | `feat(web,i18n)`: class-scope sheet from the strip and chip (text unchanged, list open, version unchanged); until the owner answers, the shipped card stays and the strip row scrolls to it | S | GX-5, owner answer GX-OD-3 |
| **GX-6** | `fix(web)`: button system (T2): `buttonBase` minimums, the overrides removed, Remove in the danger tone; a scan test that no console file sets `minHeight` on a `Button` | M | GX-0 |
| **GX-7** | `feat(web,i18n)`: class page order, action bar with More, invite disclosure, compact roster card, empty-class checklist (T3-T5) | M | GX-2, GX-6 |
| **GX-8** | `fix(web,i18n)`: T7, T8, T9 (with the planProgress check), T10, T15, P4 (family join order, heading, practiced wording, dated join) | M | GX-0 |
| **GX-9** | `feat(web)`: stage titles from the shipped content overlays (section 10.3), every console use of `STAGE_TITLES` through a locale-aware reader; no dictionary key | S | GX-0 |
| **GX-10** | `feat(web,i18n)`: settings rows (T11, P7): chip, Move disabled with reason, equal sizes, quieter Remove, Invite another grown-up | S | GX-1, GX-6 |
| **GX-11** | `feat(web,i18n)`: child card lines and squares (P2), lecture slot with 2+ learners (P3), report chooser line (P10) | M | GX-4 |
| **GX-12** | `fix(web,i18n)`: re-link page (T12, P8), the re-link page title and class-page entry renamed to "New device requests" (10.2) | S | GX-6, GX-1 |
| **GX-13** | `fix(web,i18n)`: learner report order, print hint, minutes unit, next-open dedupe, classes line (T13) | S | GX-0 |
| **GX-14** | `fix(web,i18n)`: phone nav one row (P6), `error.tsx` (P5), PIN card CTA (P9), lecture minutes line (T14) | S | GX-6 |

**Order.** GX-1 first (the owner's request); GX-W in parallel (Worker first; GX-1 works without it and shows the move-out chips once it is deployed). Then GX-2, then GX-4 (it reuses GX-2's sheet frame for See all), GX-3 once GX-W is deployed; GX-5 after GX-4, GX-2 and GX-3; GX-5b only after the owner answers GX-OD-3. GX-6, GX-8, GX-9 and GX-13 can run at any time after GX-0; GX-7 after GX-2 and GX-6; GX-10 after GX-1 and GX-6; GX-11 after GX-4; GX-12 and GX-14 after GX-6. **Total:** 17 rows (GX-0 included; 1 owner-blocked), one Worker deploy (GX-W), no migration.

## 14. Tests (per row; e2e at 360 x 740 and 1280 x 800, each in ko, en and es)

| File | Row | Asserts |
|---|---|---|
| `apps/web/src/lib/console/__tests__/learner-status.test.ts` | GX-1 | every kind of section 3.2 from fixtures; priority order; an expired re-link dropped; never a name match (two learners with one name and one re-link: only the id's card gets it); `pending` preferred when present, the three reads when absent; a failed or skipped read adds nothing; **a family-started source view with `learnerId: null` is counted in `totals.moves` and listed in `outgoing`, and gives no chip**; **class moves read by wire status `waiting`** (a `requested` fixture is rejected by the client schema); `move_scheduled` from `scheduledFor` (class) and `executeAfter` (family); `new` only within 7 days and with no summary; a learner accepted by a move with a summary shows `in_class`; teacher moves ordered by their `expiresAt`; a `move_yours` with no destination name has the reason `status.moveOut`; a learner-side move with `learnerRoute !== 'caregiver'` adds nothing to the family's totals; family rosters get `none`, not `in_class`; totals; action order by soonest `expiresAt` |
| `apps/web/src/components/console/__tests__/status-chip.test.tsx` | GX-1, GX-2 | text for every kind in en, es and ko; the action chip is a button ≥ `touchTarget.min` with the name "{chip}: {reason}" whose tap opens the pop-up (`relink`) or the sheet at the item (`move_yours`, incoming); **every re-link Approve (card, sheet, parent strip) opens the pop-up, which shows `relinkApproveHint`, the platform and the request time; no re-link is approved without it**; Deny answers in one tap; inline buttons described by the name and reason ids; `move_room` and `move_others` carry no `feedback.nudge` (amber only on actions); no `feedback.danger` and no colour literal (token scan); minute countdown rounding; a decided card keeps its place for 5 s, then re-sorts |
| `apps/web/src/components/console/__tests__/moves-entry.test.tsx` (extend) | GX-1, GX-3 | a teacher move counted; **transfers flag off with one pending re-link: the count is 1 (home chip and nav show 1)**; `refreshKey` rereads; `attention` used when present, the lists otherwise; **without `attention` no timer: the number of calls after 10 minutes visible equals the mount read** |
| `apps/web/e2e/grownup-status.spec.ts` (new, mocked API, the `class-moves.spec.ts` pattern) | GX-1 | the class page shows Needs your OK beside the re-link learner and In class beside the others; an incoming card with initials, Needs your OK and Accept first above the roster; Approve on the card opens the pop-up with the hint, and its Approve removes the chip; New with "No practice shared yet" on a learner joined today; a new re-link appears within one 20 s re-link read with no pending one before; ko / en / es at 360 and 1280; no sideways scroll at 360 |
| `packages/backend/src/__tests__/grownup-attention.test.ts` (new), `db-contract.test.ts` (extend) | GX-W | `pending` per learner for each step; `incoming`; each `pending` subfield absent without its action (`roster.manage`, `learner.transfer`, `snapshot.read`); an executed-on-read transfer listed as a member only; `attention` counts equal the client rule on the same fixtures, per space kind; **a past-expiry pending re-link and an expired requested move are not counted, `attention` writes nothing and equals the list routes after settle**; only spaces the caller may act on; no field leaks a destination's learner name or id before acceptance; **T8: a class-started request with the learner step pending counts 0 for the destination (`attention.moves`, roster `incoming`, `pending`)**; a learner-side move of a self-managed learner (or with the caregiver route off) counts 0 for the family; the school's `GET /:id/attention` gives every child class to a school admin who is not a member, 404 to anyone else, and stays inside the statement budget with 60 classes; memory and sqlite |
| `apps/web/src/components/console/__tests__/attention-parts.test.tsx`, `relink-popup.test.tsx` | GX-2 | banner role and text, re-rendered only when a count changes; sheet sections only when non-empty; outgoing rows by view (an unmatched one included); results in the sheet's live region; the sheet stays open on its empty state with focus on Close; Accept first in both incoming components; pop-up once per id per session, once more at 2 minutes left after Later and never a third time, Esc = Later, focus return; not shown while another dialog is open; title prefix count only; the class page's 20 s read calls `relinkRequests` only |
| `apps/web/e2e/grownup-attention.spec.ts` (new) | GX-2, GX-3 | home chip → class page sheet open (`#attention`) → approve a device and accept a move in 2 taps; with nothing pending at load, a new re-link opens the pop-up within one re-link read (20 s, fake clock); the re-link bar on the Lessons page with GX-W `attention` mocked, Review → the class sheet; nav count on screen and its accessible name; ko / en / es at 360 and 1280 |
| `apps/web/src/lib/console/__tests__/parent-home.test.ts` (extend), `family-needs-you.test.tsx` | GX-4, GX-5 | `needsYou` builder for the three item kinds; order by soonest expiry; fold rule (2 rows; 3 items: the soonest row plus "2 more things need you"); chip priority, chips are spans; class line one / many / none, **omitted when the transfer read is skipped or failed**; the move notice in its child's card; quiet load rereads; the parent count of section 7.4 |
| `apps/web/e2e/class-moves.spec.ts` (extend) | GX-4, GX-5 | strip above the first child at 360; **with three items (one re-link, two moves, no unread class-scope update) and a notice, the first child's name and week line inside 360 x 740**; with an unread class-scope update the shipped card sits under the strip, unchanged, and **Read and OK** scrolls to it; consent in 2 taps; re-link approved through the pop-up; a self-managed learner's move shows Move waiting and no strip row; ko / en / es |
| `family-scope-sheet.test.tsx`, `class-moves.spec.ts` (extend) | GX-5b | the sheet shows every `CLASS_SCOPE_TEXT` line with the list open, cannot close by backdrop while unread, and writes the ack; **with three items including an unread class-scope update, the first child's name and week line inside 360 x 740** |
| `apps/web/src/components/console/__tests__/button-size.test.tsx`, source scan | GX-6 | every `Button` and link-button ≥ `touchTarget.min` tall and wide; no per-call `minHeight` left |
| render tests of the class page and card (extend), `apps/web/e2e/class-page-order.spec.ts` (new) | GX-7 | order of section 8 T3; invite disclosure collapsed with learners, open when empty; card lines; checklist on an empty class; 360 and 1280, three locales |
| `rollup.test.ts`, `plans.test.ts`, `curriculum.test.ts` (extend) | GX-8 | new joiners not counted; anchor hidden when null; the two plan states; family join order and wording |
| `stage-titles.test.ts` (extend) | GX-9 | en equals `stages.ts`; the console's es and ko titles equal `content/i18n/{es,ko}/stages.json` for all 7 stages |
| settings render tests (extend) | GX-10 | Move disabled with reason while a move is open; invite copies the code |
| parent-home render tests (extend) | GX-11 | lines 1-2, never-started and restart lines, squares fill only; lecture slot rule |
| relink page tests (extend) | GX-12 | 64 px buttons, countdown per minute, platform names, rolled-up times, family denial wording, no duplicate "Another way", `relinkApproveHint` still next to Approve, the "New device requests" title |
| report tests (extend) | GX-13 | H1 first; print hint only after Print; unit; next-open dedupe |
| `error-page.test.tsx`, nav render test | GX-14 | error page in the console locale with Try again; nav one row at 360 in en and es |
| i18n coverage ratchets, `length-budget.test.ts`, banned words, `review-ledger-current.test.ts` | every UI row | es and ko present for every new and changed key; the ledger re-signed in the fix stage after the independent es / ko review |

## 15. Owner decisions (each has a default that applies until answered)

| # | Question | Default (applied) |
|---|---|---|
| GX-OD-1 | Show **In class** on every class roster card, or only non-default states? | **Shown**, quietly (the owner's "On board"). |
| GX-OD-2 | May the source class see the `learnerId` of an open family-started transfer? | **Yes** (the source class already lists the learner); amends F-SPACE-002 §4.2. |
| GX-OD-3 | May the class-scope text move from an always-shown home card into a sheet opened from Needs you? | **Owner-blocked, no default applied** (it changes a consent surface). Until answered the shipped card stays and the strip row scrolls to it; row GX-5b waits. Proposed: text verbatim, list always open inside the sheet. |
| GX-OD-4 | Add a "teacher approves joins" class setting? (The owner's request says "when a learner joins a class or is moved and the teacher has to approve": today a join with the class code takes a seat at once; what needs the teacher is a re-link, a known learner on a new device, shown as 새 기기, or a move.) | **No**; joins stay instant and a new joiner shows **New**. If wanted later: a `pending` membership state that holds no seat until approved, a learner-app waiting screen, an F-SPACE-001 amendment and a migration; it would reuse this chip and sheet. |
| GX-OD-5 | Email or push for waiting approvals? | **None** (no channel exists). |
| GX-OD-6 | Re-link pop-up on or off? | **On**, once per request per tab session plus one reminder at 2 minutes left after Later, re-links only; the re-link bar on the persona's other console pages. |
| GX-OD-7 | Stage titles translated in ko and es? | **Yes**, the shipped content-overlay titles of section 10.3 (already shown in the learner app); no new wording. |
| GX-OD-8 | Change the ko register of the class-scope and billing texts? | **No** (legal and pricing text keeps 합니다체; a change would ask every family again). |

## 16. Edits to the amended specs (pointer lines in this PR; text in the rows named)

- **F-SPACE-002**: §4.2 source view `learnerId` on family-started requests (GX-W); §4.8 entry points and home badge become the attention chip and count of section 6 (GX-1, GX-3).
- **`AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md`**: §5 console family surface: the class-scope card may open as a sheet from Needs you (GX-5b, owner-blocked on GX-OD-3); TV-D8's incoming list shows as "Asking to join this class" cards on the roster and in the review sheet (GX-1, GX-2); TV-D10's notice sits in its child's card (GX-4); outgoing views carry `learnerId` while requested (GX-W).
- **F-APP-001**: §3.8 nav: the count on the Classes / Home tab and the re-link bar (GX-3, GX-5); one nav row on phones (GX-14).
- **F-TCH-001**: §10.1 re-link: the chip, inline approval, pop-up with one reminder, the 20 s re-link read on the class page and the re-link bar elsewhere (GX-1, GX-2, GX-3, GX-12).
- **F-CONSOLE-001**: §3.4 home counts include re-links and teacher moves (GX-3).

## 17. Review log

- 2026-10-31, GX-0 (this PR): measured on `1bfda3fc8` (section 1) through three read-only audits (approvals; teacher console, 96 screenshots; parent console, 12 pages × 3 locales × 2 widths); every `file:line` above re-read at that commit. Korean drafts rewritten to the F-I18N-001 §3.10 rule (no particle on a variable: the audits' "{name}이(가)", "{to}(으)로" forms are replaced by colon forms or the possessive 의, which never changes form); "퀘스트" kept over "레슨" (glossary). Multi-agent review of this PR to follow (design, accessibility, privacy and child safety, anti-shame copy, Spanish, Korean).
- 2026-10-31, GX-0 review fixes (PR #917, two independent reviews): one state per learner (the mocks' move-out learner is now the `move_yours` action card, matching the sheet and the banner count); a card per learner **asking to join** at the top of the roster (section 4.1), the owner's literal ask; `move_yours` is a chip only with GX-W (family-started source views carry no `learnerId`) and `totals.moves` comes from `pendingCount` + incoming, never from matched learners; class-move wire status `waiting`, not `requested`; `scheduledFor` for class views; `attention` counts filter unexpired rows and never write, roster settle runs before `membersOf`, `pending` subfields gated per action, `attention.moves` defined per space kind and the parent count defined (7.4); re-links counted whatever `CLASS_TRANSFER` says; a 20 s re-link-only read on the class page, a re-link bar on every other console page (5.5) and a 2-minute reminder; no per-space timer before GX-W; a visible count on the nav tab; amber only on action states (`move_room` now sunken); plural pairs for the home and nav counts; one action wording per locale and the es / ko copy fixes (10.1); `new`'s reason line "No practice shared yet"; the action chip's tap defined; action order by soonest expiry with no jump after a decision; the sheet never closes itself, results in a live region, the banner re-renders only on a count change; the parent strip compact with a fold rule and child chips as text, the move notice inside its child's card (first child's name and week line inside 360 x 740, measured: name at 516 px en / es, 495 ko; week line ends at 638, 659, 582); the class line omitted when its read is skipped; GX-OD-3 owner-blocked (row GX-5b). Mocks and shots regenerated.
- 2026-10-31, GX-0 second review round (PR #917, two independent reviews; every finding applied): the parent's first-screen goal no longer assumes GX-5b (the shipped class-scope card stays under the strip until GX-OD-3; the GX-4 check runs without an unread scope item, GX-5b adds that case); a `move_yours` with no destination name gets the reason "Moving to another class" (`status.moveOut`), drawn in the mocks as the usual case; stage titles corrected to the shipped en `Real-use` / `Self-expression`, and es / ko taken from the shipped content overlays instead of new drafts (GX-9 adds no key); T8 predicate stated for the destination's `attention.moves`, roster `incoming` and `pending`, with a fixture; every re-link Approve opens the pop-up with the shipped hint, platform and request time (GX-D12; Deny stays one tap); a family's move counts and shows as an action only when `learnerRoute === 'caregiver'`, else the quiet Move waiting chip; a school's per-class counts from a new read-only `GET /api/spaces/:id/attention`; `spaces[]`, not `items[]`; teacher moves ordered by their `expiresAt`; after Accept a moved learner is usually In class; es fixes ("Ruta de aprendizaje" in the mock, `inviteGrownUpLine`, `firstQuest`, sheet title "Por aprobar", `needsYou.title`, "Aún no ha empezado"); ko "다른 반으로 옮기려는 학생", "새 기기 연결 요청: {name}" and one re-link term (GX-12 renames "다시 연결"); the never-started line matches its button; mocks: a pill-height action chip with a 64 px hit area, inline buttons capped at 16rem on wide screens, the nav edge fade at 360, and a new `states` mock (Waiting for a seat, Moving {date}, Move waiting, nothing waiting) with the sheet's empty state. Mocks and shots regenerated.
