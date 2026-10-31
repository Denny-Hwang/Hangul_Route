Status: ready (spec, wireframes and mocks pass GX-0; amends F-SPACE-002 §4.2 and §4.8, `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` §5 (TV-D5 surface), F-APP-001 §3.8, F-TCH-001 §10.1 and F-CONSOLE-001 §3.4; implementation rows in section 13, GX-1 first)

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
| 1 | **The only sign of a waiting approval is a count inside one of nine equal pills.** "다시 연결 요청 1개" is the 7th pill of the class page's tool row (`app/(console)/teach/space/page.tsx:291-320`, owner screenshot 2); "기다리는 반 이동 N건" is another. Nothing appears next to the learner the request is about, nothing on the teacher home for a re-link, nothing in the nav. | A **status chip next to every learner's name** (section 4): amber **Needs your OK** (승인 대기) with the reason and inline **Approve / Deny** for a new device; the quiet **In class** (참여 중) chip otherwise, the owner's "On board". An **attention banner** at the top of the class page with one **Review now** sheet (section 5). |
| 2 | **The most urgent request is the slowest to show.** A re-link closes after 10 minutes (`RELINK_WINDOW_MS`, `packages/content-schema/src/schemas/relink.ts:9`) but the class page re-reads it every 90 s (`VISIBLE_POLL_MS`, `lib/console/visible-refresh.ts:16`) and the teacher must tap home, class, pill, Approve. | A **pop-up for a new re-link only** (section 5.3), a 10 s poll while one is waiting, and 1 tap from the class page (2 from home). Moves, which stay open 14 days, get the chip and the banner, never a pop-up. |
| 3 | **The move count is wrong and stale.** `useMovesWaiting` counts only `transferRequests` (`components/console/MovesEntry.tsx:26-43`), so a teacher move into the class (TV-D8, `GET /class-moves` `incoming`) is never counted (the moves page showed 2 or 3 cards under a badge of 1 or 2); it reads once on mount and never again. | One count of **everything that needs this class's answer** (re-links + family-started transfers + teacher moves), refreshed with the page's poll and on roster changes (section 3.4). |
| 4 | **The family never sees its own approvals.** A move waiting for the family's OK is the last of five grey pills under every child card (`app/(console)/parent/page.tsx:451-455`), a child's re-link never shows on `/parent`, and the class-scope card (17 lines, `FamilyClassCards.tsx:89-140`) pushes every child off the first phone screen. | A **Needs you** strip under the family heading, a status chip and a class line on each child card, the class-scope text in a sheet opened from the strip (section 7). |
| 5 | **Joining is not approved today.** `POST /api/spaces/:id/join` takes a seat at once (`packages/backend/src/routes/spaces.ts:401-470`); what the owner saw as "approval" is a re-link (a known learner on a new device) or a move. | No join approval is added (default of GX-OD-4, section 15); a learner who joined in the last 7 days shows **New** (새로 참여) instead of looking like a stale learner. |
| 6 | **The grown-up UX pass** (owner: "propose and carry out"): uneven buttons (the round "쪽지"), English stage titles in ko and es, "N haven't synced in a week" counting a learner who joined today, "1단계 기준: –", "다음 동기화를 기다리는 중" on learners who synced today, two "incoming" lists with opposite button order, the report's actions above its title, a phone nav that wraps, no error page. | Thirteen ranked improvements with exact copy (sections 8 to 10), rows GX-6 to GX-14. |

## 1. What was measured

Three read-only audits on detached worktrees of `origin/main` `1bfda3fc8` (no commits; scratch files outside the repo):

- **Approvals audit.** `next dev` against a Playwright-mocked API (`NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, `NEXT_PUBLIC_CLASS_TRANSFER=enabled`, ko-KR, 412 px): one class with three learners, one re-link, one family-started move out, one transfer in and one teacher move in. The class page badge read "기다리는 반 이동 2건" while the moves page held 3 waiting items; the re-link appeared only as the 7th pill.
- **Teacher console review.** The static export (`NEXT_PUBLIC_API_BASE_URL=https://api.ux-e2e.test`, dev auth, Learning Route, all locales, class transfer on) against a full API mock (4 learners: active, revisit letters, stale, joined today with no sync; one re-link with 7 minutes left; one teacher move and one transfer in; a 26-week route plan; a school; a family). 96 screenshots: 16 pages × ko / en / es × 390 and 1280 px. The ko 390 class page matches the owner's two screenshots line for line ("4단계 · Dialogue", the round "쪽지", "퀘스트 0 / 15 · 카드 1장" beside "이번 주 2분", "1단계 기준: –", "루트 · 26주: 다음 동기화를 기다리는 중").
- **Parent review.** The export with every parent flag on (reports, notes, class transfer, Learning Route, lecture mode, browse, content gating, PIN-reset sign-in, all locales): 12 parent pages × en / ko / es × 390 and 1280 px plus the PIN setup card and the lock screen, for a family of three (one with a waiting re-link and a teacher move notice, one with a move waiting for the family's OK and an unread class-scope update, one who joined and never synced). On a 390 px phone the move pill is about four screens down; the first screen shows no child at all. A mocked shape error on `/parent/notes` showed Next's white English "Application error": `app/` has no `error.tsx`.

Code facts each change rests on (checked at `1bfda3fc8`):
- the class page keeps only the length of the re-link list it already reads (`setPendingRelinks(relinks.data.length)`, `teach/space/page.tsx:111`), though every `RelinkView` carries `learnerId` and `learnerName`; each roster row carries `scope: 'base' | 'full'` (TV) and `joinedAt`, unused on the card;
- the card header holds only the name and the level pill (`teach/space/page.tsx:327-337`);
- the outgoing class-move view carries no `learnerId` (`packages/backend/src/routes/class-moves.ts:166-179`), and the source view of a family-started transfer carries one only "on a request this class started" (`lib/console/api.ts:644-653`), so neither can be matched to a roster card except by name;
- `TeacherMovesSection`'s `live` ref is set false by the StrictMode double mount and never set true again (`components/console/TeacherMovesSection.tsx:66-72`): the section never renders under `next dev` (production is fine, dev QA and dev e2e miss it);
- `TeacherMovesSection` orders **Not now | Accept** (`:170-176`), `ClassTransferParts` orders **Accept | Not now** (`:300`);
- there is no web push, no `expo-notifications` and no mail sender in the repo; the settings page says email on join "opens later".

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| GX-D1 | **One learner status model.** A pure function `learnerStatus(input)` in `lib/console/learner-status.ts` turns the roster, the re-link list, the transfer list and the class-move list (or, once GX-W is deployed, the roster's own `pending` field) into **one status per learner**, the incoming items and the totals. The class roster, the review sheet, the settings rows, the home badges and the parent home all read it, so a learner never shows two different states on two screens. | The same fact is drawn today by five components with three counting rules. |
| GX-D2 | **A chip next to every learner's name, always with text.** One chip per learner, the highest-priority state wins (section 3.2). Action states are amber buttons labelled **Needs your OK** (승인 대기, the owner's word); the default state is a quiet **In class** (참여 중) chip on class rosters (GX-OD-1: shown, as the owner asked). Family rosters show no default chip. Colour is never the only cue. | The owner's request, word for word: a button next to the name, or a membership status like "On board". |
| GX-D3 | **An attention banner and one review sheet.** When anything needs this class's answer, a banner sits under the class title, above everything else: "{n} requests need your OK · {r} new device · {m} class move" with **Review now**. The sheet lists every waiting item with its own action (Approve / Deny for a device, Accept / Not now for a move into the class, Review for a move out). `role="status"`, never auto-dismissed, gone when the count is 0. | One place to clear everything in one or two taps, the pattern of an inbox badge plus a triage sheet. |
| GX-D4 | **A pop-up for a new re-link only.** When a poll finds a re-link id this tab has not shown, an `alertdialog` opens (Approve / Deny / Later), once per id per tab session. Moves (open 14 days) never open a pop-up. | A re-link closes in 10 minutes and the learner is waiting at the device; a move is not urgent, and a modal for it would interrupt a teacher who is presenting. |
| GX-D5 | **Count everything that waits, and keep counting.** The count of a space = its pending re-links + its transfers whose own step waits (`pendingCount`) + its incoming teacher moves with status `requested` (`kind: 'accept'`). It refreshes with the page's visible poll, on `useRosterChanges` and after any decision; re-links poll every `RELINK_REFRESH_MS` (10 s) while at least one is pending and the tab is visible. | Fixes the uncounted teacher move (section 0 item 3) and the read-once count. |
| GX-D6 | **Home and nav carry counts, never names.** Each class row on the teacher home gets an amber **{n} need your OK** chip linking to the class page's sheet (`#attention`); the **Classes** tab (and **Home** for a parent) gets a dot with a count in its accessible name; the tab title gets a "({n}) " prefix. | F-CONSOLE-001 §3.4: the home shows counts, not learners. Names stay off the home, the nav and the title. |
| GX-D7 | **The family's approvals come first.** A **Needs you** strip directly under the family heading lists the family's waiting items (a move that needs its OK, a child's re-link, a class-scope update to read), each with one primary action; each child card gets a chip and a class line ("In: Sunday Class A"). The class-scope text opens in a sheet from the strip, verbatim and with its list always open (GX-OD-3). | The parent's approvals were the last thing on the page or missing. |
| GX-D8 | **No new channel.** No push, email or SMS (GX-OD-5). Everything here is in the console. | No sender exists; a new channel is the owner's call. |
| GX-D9 | **No join approval mode.** Joining with a code stays instant (GX-OD-4). A learner who joined in the last 7 days and never synced shows **New**. The section 15 entry sketches what a "teacher approves joins" mode would need if the owner asks for it. | Today no join waits for anyone; adding a waiting state touches seats, the learner app and F-SPACE-001. |
| GX-D10 | **Privacy stays as it is.** A learner coming into a class shows initials, picture and level only until accepted (F-SPACE-002 T8, TV-D8); the source class's own learners are matched by id (GX-W adds the id where it is missing, GX-OD-2). | The source class already has the learner on its roster; T8 limits only the destination. |
| GX-D11 | **One button size.** `Button` and `buttonBase` (`components/console/ui.tsx`) get `minHeight: touchTarget.min`, so no short label turns into a circle and no row mixes 40 px and 64 px buttons. | Owner screenshot 2: the round "쪽지" next to pills. |

## 3. The learner status model (GX-D1)

### 3.1 Types (`apps/web/src/lib/console/learner-status.ts`, pure, 100 % unit-tested)

```ts
export type LearnerStatusKind =
  | 'relink'        // a re-link request for this learner is pending in this space (action)
  | 'move_yours'    // a move of this learner out of this space waits for this space's answer (action)
  | 'move_others'   // a move of this learner is open and waits for someone else
  | 'move_room'     // a move was agreed but the destination has no seat yet
  | 'move_scheduled'// a move is agreed and runs on a date (family-started cooling-off)
  | 'new'           // joined this space in the last 7 days and no summary yet
  | 'in_class'      // a member; nothing waits (class and school spaces only)
  | 'none';         // family spaces: no default chip

export interface LearnerStatus {
  learnerId: string;
  kind: LearnerStatusKind;
  action: boolean;                       // relink and move_yours only
  relink?: { id: string; expiresAt: string };
  move?: { source: 'transfer' | 'teacher'; id: string; to: string | null; on: string | null };
  scopeBase: boolean;                    // roster row scope === 'base' (a muted line, never a chip; TV-D3)
}

export interface IncomingItem {          // a learner asking to join this space (not on the roster yet)
  source: 'transfer' | 'teacher';
  id: string;
  alias: string;                         // initials only (T8)
  avatar: string | null;
  level: string | null;
  from: string | null;                   // the source class name (TV-D8) or null for a family
  expiresAt: string;
}

export interface AttentionModel {
  byLearner: Record<string, LearnerStatus>;
  incoming: IncomingItem[];
  totals: { relinks: number; moves: number; all: number };   // moves = move_yours + incoming
}

export function attentionModel(input: {
  kind: 'class' | 'family' | 'school';
  roster: readonly RosterLearner[];       // with scope, joinedAt, summary and, after GX-W, pending
  relinks: readonly RelinkView[] | null;  // null = not read (older Worker or failed read)
  transfers: readonly TransferView[] | null;
  classMoves: ClassMovesView | null;
  now: Date;
}): AttentionModel;
```

### 3.2 Priority (one chip per learner)

`relink` > `move_yours` > `move_room` > `move_scheduled` > `move_others` > `new` > `in_class` (or `none` in a family). An expired re-link (its `expiresAt` passed) is dropped before ranking; a move in `executed`, `declined`, `cancelled` or `expired` is not a status (the learner leaves the roster or stays as `in_class`). `scopeBase` is never a chip: it adds the muted line "Words and more show once the family has read the update." (`console.reportScope.baseScope`, shipped) under the card's header.

### 3.3 Where each state comes from

| Kind | Before GX-W (client reads, all shipped) | After GX-W (one roster read) |
|---|---|---|
| `relink` | `GET /:id/relink-requests`, `learnerId`, `expiresAt` | `learners[].pending.relink` |
| `move_yours` | `GET /:id/transfer-requests`, role `source`, own step `waiting`, with `learnerId` (class-started requests only) | `learners[].pending.move` with `step: 'yours'` |
| `move_others` | the same, own step done, others waiting; `GET /:id/class-moves` `outgoing` `requested` cannot be matched (no `learnerId`) and is not shown until GX-W | `step: 'others'` |
| `move_room` | transfer `blockReason` present | `step: 'room'` |
| `move_scheduled` | transfer `executeAfter` in the future | `step: 'scheduled'`, `on` |
| `new` | roster `joinedAt` within 7 × 24 h of `now` and `summary === null` | same |
| incoming | transfers with role `destination` and own step `waiting`; `class-moves` `incoming` with status `requested` | roster `incoming` count; items still from those two reads (the sheet needs them) |

A read that fails or returns an unknown shape contributes nothing (never a guess, the `MovesEntry` rule). The model never matches by name.

### 3.4 Counts (GX-D5)

`totals.all = relinks + move_yours + incoming`, and `useApprovalsWaiting(api, spaceIds, refreshKey)` (rename of `useMovesWaiting`, same file; the old name stays as an alias until no caller uses it) returns per space `{ relinks, moves, all }`. With GX-W deployed it reads `GET /api/spaces` `items[].attention` and asks nothing else; without it, it reads the three lists per space as today (bounded: the home already lists every space). `refreshKey` changes on the page's visible poll, on `useRosterChanges` and after each decision.

## 4. The status chip (GX-D2; class roster, family roster, settings rows)

**Placement.** In the card header, right after `<strong id="roster-learner-{i}">{displayName}</strong>`, before the level pill; on a phone (below 45em) it wraps under the name, never pushes the name. One reason line under the header when the state has one.

| Kind | Chip (en / es / ko) | Reason line (en / es / ko) | Card actions | Style |
|---|---|---|---|---|
| `relink` | Needs your OK / Por aprobar / 승인 대기 | New device · {m} min left / Dispositivo nuevo · quedan {m} min / 새 기기 · {m}분 남음 | **Approve** (primary) · **Deny**, inline (`api.decideRelink`; result line `console.relink.approved` / `.denied`) | amber button chip; the card gets a `borderWidth.base` `feedback.nudge` border and moves to the top of the list |
| `move_yours` | Needs your OK / Por aprobar / 승인 대기 | Class move: {class} / Cambio de clase: {class} / 반 이동: {class} | **Review** opens the review sheet at this item | amber button chip, card border as above, card to the top |
| `move_room` | Waiting for a seat / Esperando lugar / 자리 기다리는 중 | — | none | amber outline (no fill) |
| `move_scheduled` | Moving {date} / Se cambia el {date} / 이동 예정 · {date} | — | none | `feedback.infoLight` |
| `move_others` | Move waiting / Cambio en espera / 이동 대기 중 | Waiting for: {class} / Esperando a: {class} / 기다리는 반: {class} | none | `surface.sunken` |
| `new` | New / Nueva llegada / 새로 참여 | Hasn't opened the app yet / Aún no abre la app / 아직 앱을 열지 않았어요 | none | `feedback.infoLight` |
| `in_class` | In class / En la clase / 참여 중 | — | none | `feedback.successLight` with an 8 px `feedback.success` dot, text `text.primary` |

Rules:
- `{m}` is whole minutes, rounded up, at least 1; the chip re-renders each minute (no seconds). At 0 the item drops on the next poll; an Approve that answers `409 expired` shows the shipped expired line and removes the chip.
- `{class}` is a class name the viewer may read (the source teacher chose the destination, TV-D8; a family's own classes); with none, the line is omitted.
- An action chip is a `<button>` (≥ `touchTarget.min` tall, the console floor) whose accessible name is "{chip}: {reason}" and `aria-describedby` = the name id (the existing card pattern); a status chip is a `<span>` inside the heading's text, read with the name.
- Ordering: action cards first (newest request first), then the shipped "recent activity first" order (class) or join order (family, GX-8). This is ordering by what needs the teacher, never by a score.
- Never red, never "late", "behind" or "missing". Text is always `text.primary`; amber is a fill, border or dot only.

## 5. Attention banner, review sheet and the re-link pop-up (GX-D3, GX-D4)

### 5.1 Banner (class page, top; family roster page, top)

```
| [!] 3 requests need your OK                     [ Review now ] |
|     1 new device · 2 class moves                               |
```
- `role="status"`, `aria-live="polite"`; background `feedback.nudgeLight`, inline-start bar `borderWidth.thick` `feedback.nudge` (the `TeacherMovesSection` nudge pattern), text `text.primary`, **Review now** a primary button ≥ `touchTarget.min`.
- Shown only when `totals.all > 0`; the second line lists only the non-zero parts.
- `#attention` in the URL opens the sheet on load (the home's link, GX-3); the hash carries no id.

### 5.2 Review sheet

A bottom sheet on a phone, a centred dialog from 45em (the `ConfirmSheet` frame: focus trap, Esc closes, focus returns to the opener, the page behind is inert). Title **Needs your OK** (승인 대기 / Espera tu aprobación). Sections, each only when non-empty:
1. **New devices** — one row per re-link: avatar chip, name, "New device · {m} min left", **Approve** / **Deny**.
2. **Asking to join this class** (이 반에 들어오려는 학생 / Quieren unirse a esta clase) — one row per incoming item: avatar, initials, level, "From {class}" (보낸 반: {class} / Viene de {class}), **Accept** (primary, first) / **Not now**. Not now on a transfer keeps the shipped reason step. This one list replaces the two lists of the moves page (section 0 item 6) in the sheet; the moves page itself is unified in GX-2 (one heading, primary first in both components).
3. **Moves out of this class** — one row per `move_yours`: name, "Class move: {class}", **Review** opens the shipped consent card (Agree / Not now) inside the sheet.

After each decision the row shows its result line for 5 s and leaves; the count, banner and chips update at once (optimistic, then the reread). Empty: "Nothing is waiting." (기다리는 요청이 없어요. / No hay nada pendiente.) and the sheet closes itself after 2 s only if it was opened from the banner.

### 5.3 Re-link pop-up (class page; parent home after GX-5)

- Trigger: a pending re-link id not in this tab's shown set (`sessionStorage` through the console's safe-storage wrapper, key `hr:console:relinkShown`, ids only), while the page is visible and no other dialog is open. One at a time, newest first.
- `role="alertdialog"`, `aria-labelledby` the title, focus on the title; Esc = **Later**.
- Title: "New device request: {name}" / "Solicitud de dispositivo nuevo: {name}" / "새 기기 연결 요청: {name}". Body: the shipped `relinkApproveHint` and "This request closes in {m} min." / "Esta solicitud se cierra en {m} min." / "{m}분 뒤에 이 요청이 닫혀요.".
- Buttons: **Approve** (primary) · **Deny** · **Later** (Más tarde / 나중에). Later only closes; the chip and banner stay.
- Never on the lecture-mode or presenter pages (they are other routes; the pop-up lives in the class page and the parent home only).

### 5.4 Polling

| Page | Re-links | Moves and counts |
|---|---|---|
| Class page | every `RELINK_REFRESH_MS` (10 s) while ≥ 1 pending and visible, else with the 90 s visible poll | with the 90 s poll, on `useRosterChanges`, after each decision |
| Teacher home, school page | counts only, 90 s visible poll | same |
| Parent home | every 20 s while ≥ 1 pending and visible, else 90 s | 90 s, on focus |

`document.title` gets "({n}) " in front while `totals.all > 0` on these pages (a count only, never a name).

## 6. Home, school and nav badges (GX-D6)

- **Teacher home** (`teach/home/page.tsx`, class rows): an amber chip **{n} need your OK** (승인 대기 {n} / {n} por aprobar) after the class name, linking to `ROUTES.space(id)#attention`. Replaces the separate "class moves waiting" pill on the row.
- **School page** (`SchoolAdmin.tsx`): each class link's count uses the same `all` (teacher moves included).
- **Nav** (`AdultFrame.tsx`, `lib/console/shell-nav.ts`): a `feedback.nudge` dot (8 px, `radii.circle`) on **Classes** (teacher) and **Home** (parent) when the persona's total is above 0; accessible name "Classes, {n} need your OK" (반, 승인 대기 {n} / Clases, {n} por aprobar) and "Home, {n} to check" (홈, 확인할 일 {n}개 / Inicio, {n} por revisar). The dot is not a number on screen (the label carries it), so the tab row's width does not change.

## 7. Parent side (GX-D7)

### 7.1 Needs you strip (`/parent`, under `FamilyHeading`, before every card)

`role="region"` with the title as its name; one row per item, newest first; amber inline-start bar; each row: the child's avatar chip, one sentence, one primary button.

| Item | Source | Sentence (en / es / ko) | Button |
|---|---|---|---|
| Move needs the family's OK | `transferRequests(familyId)` role `learner_side`, own step `waiting` | A class move for {name} needs your OK. / Un cambio de clase de {name} espera tu permiso. / {name}의 반 이동에 승인이 필요해요. · second line: New class: {to} · Ends in {n} days / Clase nueva: {to} · Termina en {n} días / 옮길 반: {to} · {n}일 뒤 마감 | **Review** (Revisar / 확인하기) opens the shipped consent sheet directly (2 taps, was 3-4) |
| A child's re-link | `relinkRequests(familyId)` | {name} wants to continue on a new device. / {name} quiere seguir en un dispositivo nuevo. / 새 기기에서 이어서 하려는 요청: {name} · second line: {m} min left / Quedan {m} min / {m}분 남음 | **Approve** · **Deny** inline |
| Class-scope update | `classScope(familyId).learners[].needed` | Read what {name}'s teachers can see. / Lee qué pueden ver los docentes de {name}. / {name}의 선생님이 보는 정보를 확인해 주세요. | **Read and OK** (Leer y aceptar / 읽고 확인) opens the class-scope sheet (7.3) |

The move notice of TV-D10 stays the shipped card, placed right under the strip. All three reads join the page's quiet `load(true)` (90 s visible poll and focus), so a new item appears without a reload.

### 7.2 Child card: status chip and class line

Right of the child's name (`parent/page.tsx` `card()` h3), one chip by the same priority: **Move: your OK needed** (Cambio: falta tu permiso / 반 이동 승인 대기), **New device asking** (Dispositivo nuevo pide entrar / 새 기기 연결 요청), **Class info to read** (Aviso de clase por leer / 반 안내 확인 필요), **Moving {date}** (Se cambia el {date} / {date} 반 이동 예정); an action chip is a button that runs the strip's action. Under the name, a class line from `TransferList.options[].classes` (already read for the family): "In: {class}" (En: {class} / 소속: {class}), with two or more "In {n} classes" (En {n} clases / 소속 반 {n}곳) and the names in a second line, with none "Family only" (Solo en familia / 가족 학습만). The family's waiting-moves pill leaves the bottom row; the strip replaces it (its family wording, `console.transfer.familyNeedsYou(n)`: "{n} class move(s) need your OK" / "{n} cambio(s) de clase espera(n) tu respuesta" / "확인할 반 이동 {n}건", stays as the strip's heading count on the family transfers page).

### 7.3 Class-scope sheet (amends TV-D5's surface)

The class-scope text (`CLASS_SCOPE_TEXT`, content-schema) moves from an always-shown card on the home into a sheet opened from the strip or the chip. The text is unchanged and shown in full, with its list always open inside the sheet; **OK** writes the acknowledgement as today; the sheet cannot be closed by a backdrop tap while unread (Close is a button). `CLASS_SCOPE_TEXT_VERSION` does not change (no word changes). GX-OD-3 records this; until the owner answers, the default applies.

### 7.4 Family transfers page step word (Fix D)

When `view.role === 'learner_side'`, the learner slot's step word reads "Your answer needed" (Falta tu respuesta / 내 답을 기다려요) instead of "Family waiting", and the card shows "Ends {date}" (Termina el {date} / {date} 마감).

## 8. Teacher improvements, ranked by impact

| Rank | Problem (evidence) | Change | Row |
|---|---|---|---|
| T1 | Approvals invisible (sections 0-1) | Sections 3 to 6 | GX-1, GX-2, GX-3, GX-W |
| T2 | Buttons 40 px beside 64 px; short labels render as circles ("쪽지", "링크 복사"); `Button` / `buttonBase` have no `minHeight` (`components/console/ui.tsx`) | `buttonBase` gets `minHeight: touchTarget.min`, `minWidth: touchTarget.child` (80), `display: inline-flex`, centred; the per-call `minHeight` overrides are removed; **Remove from class** uses the danger tone (a destructive grown-up action, the token's reserved use) | GX-6 |
| T3 | Class page order: the hero-size join code first, then goal, week, 9 equal pills, roster (owner screenshot 2) | Title row → banner → This week → action bar (primary **Plan: {title}** or **Plan this week**; secondary **Term plan**, **Lecture mode**, **Class report**; **More** holding Notes, Re-link, Class moves, Settings) → roster → **Invite students · code {code}** disclosure (expanded and hero-size only while the class is empty) | GX-7 |
| T4 | Roster card up to 9 lines; "Learning Route" dots + "Stage 1 in progress" + "Stage by stage" + "Route · 26 wk" say the same | Card = (1) avatar · name · chip … level pill; (2) "Practiced {when} · {n} min this week"; (3) "Stage 1 {title} · quests {d}/{t}" with the dots; (4) revisit letters when present; (5) plan line; (6) **Report** · **Note**. "Stage by stage" moves into the report | GX-7 |
| T5 | Empty class shows a code and 7 pills, most irrelevant | A 3-step checklist card; Re-link, Class moves, Notes and Lecture mode hidden until there is a learner | GX-7 |
| T6 | Stage titles are English in ko and es ("4단계 · Dialogue"; `lib/console/stage-titles.ts`) | `console.stageTitles.stage1..7` in i18n (section 10.3); en unchanged; test against `apps/mobile/src/content/stages.ts` | GX-9 |
| T7 | "N haven't synced in a week" counts a learner who joined today (`lib/console/rollup.ts:47`) | Exclude learners whose `joinedAt` is under 7 days ago; new copy | GX-8 |
| T8 | "1단계 기준: –" (null anchor; jargon) | Hidden when null; renamed "Stage 1 first-try answers: {a}" | GX-8 |
| T9 | "다음 동기화를 기다리는 중" on learners who synced today (`plans.ts:83`, `curriculum.ts:816` return `waiting` whenever `planProgress[planId]` is missing) | Two states: synced before the plan was published → "Gets this plan next time the app opens"; otherwise → "Not started yet (0 / {total})". The row also checks with real data why a learner who synced after publishing has no `planProgress` and records the finding in its PR | GX-8 |
| T10 | "퀘스트 0 / 15" next to "이번 주 2분" reads as nothing done | "Stage 1 quests: {done} of {total} · {cards} cards"; with 0 done and minutes > 0, "Working on the first quest" | GX-8 |
| T11 | Settings "Class learners" offers Move and Remove even for a learner with an open move; no status | The chip on each row; **Move to another class** disabled with the reason "A move is already open." while one is open; Remove in a quieter text-button style behind the shipped confirm | GX-10 |
| T12 | Re-link page: "Someone is asking to be {name}" alarms; Approve / Deny about 36 px; countdown static; "ios"; "240 min ago"; a 28 px native select; "Another way" printed twice | Section 10.2 copy, 64 px buttons, a minute countdown, platform names, rolled-up times, the console's pill select, the prefix dropped | GX-12 |
| T13 | Learner report: actions and the print hint above the H1 (`ReportParts.tsx`); "36 / 연습 시간" has no unit; now and next-open stage repeat | H1 → status → actions; the hint only after Print; "36 min"; next-open hidden when equal to now; the classes line | GX-13 |
| T14 | Lecture card shows "약 20분" (preset) and "약 14분" (content) together | One line: "About 14 min (of 20)" | GX-14 |
| T15 | Class report "연습한 날 · 아직 없음: 9" unclear | "Didn't practice: {n}" | GX-8 |

## 9. Parent improvements, ranked by impact

| Rank | Problem (evidence) | Change | Row |
|---|---|---|---|
| P1 | Approvals last or missing (section 0 item 4) | Section 7 | GX-4, GX-5 |
| P2 | A child card carries two facts; "Last active not yet" is not English | Line 1 "Practiced {d} of the last 7 days · {m} min" with the report's 7-day squares (fill only); line 2 "Next: {quest}" from `report-view.ts`'s next resolver; a child who never started: "Not started yet. Open the app on {name}'s device." with **Open the app on this device**; quiet 7+ days: "A 5-minute quest is a good restart." | GX-11 |
| P3 | With 2+ children on a phone, the Lecture mode card sits between child 1 and child 2 (`lectureCardSlot` `afterFirstRow`) | 2+ learners below 70em: `afterMain`; the strip outranks Lecture mode in the 70em side column | GX-11 |
| P4 | Family roster titled "Most recent activity first" (backend sorts by `lastActiveAt`), contradicting the home's join order; "학생" for family members; "Stage 1 anchor"; sync jargon; "Joined: Tue" | Family roster in join order, heading "Learners" (우리 가족 학습자 / Quienes aprenden); kind-aware practiced line; "Joined Oct 14" via `formatDate` | GX-8 |
| P5 | No error page: any unexpected shape gives Next's white English "Application error" | `app/(console)/error.tsx` in the console locale with **Try again** (section 10.2) | GX-14 |
| P6 | Phone nav wraps in en and es ("Billing" alone on row 2) | One row that scrolls inside itself with an edge fade (the app-shell mock's D3 rule), no second row | GX-14 |
| P7 | Family settings rows show only a join date; Move and Remove at equal weight; co-caregiver invite is a line of text | The class line and chip; equal button sizes; Remove quieter; **Invite another grown-up** copies the code with one line | GX-10 |
| P8 | Family re-link denial tells the child to "ask your teacher" | Kind-aware `console.relink.denied`: "…will say "ask your grown-up"." | GX-12 |
| P9 | PIN card's "Open the app" is vague | "Set the PIN in the app" | GX-14 |
| P10 | Report chooser rows show the name only | P2's line 1 under each name, join order | GX-11 |

Recorded, not changed: the class-scope text and the billing renewal line use 합니다체 (legal and pricing text, allowed by F-I18N-001 §3.10); a register change would bump `CLASS_SCOPE_TEXT_VERSION` and ask every family again (GX-OD-8).

## 10. Strings (drafts; en, es, ko land together in each row; the MAR reviews es and ko)

Korean rule applied throughout: no particle whose form depends on the final consonant (은/는, 이/가, 을/를, (으)로) on a variable; colon or "·" forms instead; the possessive 의, which never changes form, is kept; 해요체.

### 10.1 New keys of GX-1 to GX-5 (namespace `console`)

| Key | en | es | ko |
|---|---|---|---|
| `status.inClass` | In class | En la clase | 참여 중 |
| `status.needsOk` | Needs your OK | Por aprobar | 승인 대기 |
| `status.newDevice(m)` | New device · {m} min left | Dispositivo nuevo · quedan {m} min | 새 기기 · {m}분 남음 |
| `status.moveTo(class)` | Class move: {class} | Cambio de clase: {class} | 반 이동: {class} |
| `status.moveWaiting` | Move waiting | Cambio en espera | 이동 대기 중 |
| `status.waitingFor(class)` | Waiting for: {class} | Esperando a: {class} | 기다리는 반: {class} |
| `status.moving(date)` | Moving {date} | Se cambia el {date} | 이동 예정 · {date} |
| `status.waitingSeat` | Waiting for a seat | Esperando lugar | 자리 기다리는 중 |
| `status.new` | New | Nueva llegada | 새로 참여 |
| `status.notOpened` | Hasn't opened the app yet | Aún no abre la app | 아직 앱을 열지 않았어요 |
| `status.review` | Review | Revisar | 확인하기 |
| `attention.title(n)` | 1 request needs your OK / {n} requests need your OK | 1 solicitud espera tu aprobación / {n} solicitudes esperan tu aprobación | 승인을 기다리는 요청 {n}건 |
| `attention.devices(n)` | 1 new device / {n} new devices | 1 dispositivo nuevo / {n} dispositivos nuevos | 새 기기 {n} |
| `attention.moves(n)` | 1 class move / {n} class moves | 1 cambio de clase / {n} cambios de clase | 반 이동 {n} |
| `attention.cta` | Review now | Revisar ahora | 지금 확인 |
| `attention.sheetTitle` | Needs your OK | Espera tu aprobación | 승인 대기 |
| `attention.devicesHeading` | New devices | Dispositivos nuevos | 새 기기 |
| `attention.incomingHeading` | Asking to join this class | Quieren unirse a esta clase | 이 반에 들어오려는 학생 |
| `attention.outgoingHeading` | Moves out of this class | Cambios fuera de esta clase | 이 반에서 나가는 이동 |
| `attention.from(class)` | From {class} | Viene de {class} | 보낸 반: {class} |
| `attention.empty` | Nothing is waiting. | No hay nada pendiente. | 기다리는 요청이 없어요. |
| `relinkPopup.title(name)` | New device request: {name} | Solicitud de dispositivo nuevo: {name} | 새 기기 연결 요청: {name} |
| `relinkPopup.closes(m)` | This request closes in {m} min. | Esta solicitud se cierra en {m} min. | {m}분 뒤에 이 요청이 닫혀요. |
| `relinkPopup.later` | Later | Más tarde | 나중에 |
| `home.attention(n)` | {n} need your OK | {n} por aprobar | 승인 대기 {n} |
| `shell.navAttention.classes(n)` | Classes, {n} need your OK | Clases, {n} por aprobar | 반, 승인 대기 {n} |
| `shell.navAttention.home(n)` | Home, {n} to check | Inicio, {n} por revisar | 홈, 확인할 일 {n}개 |
| `parentHome.needsYou.title` | Needs you | Necesita tu respuesta | 확인이 필요해요 |
| `parentHome.needsYou.move(name)` | A class move for {name} needs your OK. | Un cambio de clase de {name} espera tu permiso. | {name}의 반 이동에 승인이 필요해요. |
| `parentHome.needsYou.moveMeta(to, n)` | New class: {to} · Ends in {n} days | Clase nueva: {to} · Termina en {n} días | 옮길 반: {to} · {n}일 뒤 마감 |
| `parentHome.needsYou.relink(name)` | {name} wants to continue on a new device. | {name} quiere seguir en un dispositivo nuevo. | 새 기기에서 이어서 하려는 요청: {name} |
| `parentHome.needsYou.minutesLeft(m)` | {m} min left | Quedan {m} min | {m}분 남음 |
| `parentHome.needsYou.scope(name)` | Read what {name}'s teachers can see. | Lee qué pueden ver los docentes de {name}. | {name}의 선생님이 보는 정보를 확인해 주세요. |
| `parentHome.needsYou.readOk` | Read and OK | Leer y aceptar | 읽고 확인 |
| `parentHome.status.move` | Move: your OK needed | Cambio: falta tu permiso | 반 이동 승인 대기 |
| `parentHome.status.relink` | New device asking | Dispositivo nuevo pide entrar | 새 기기 연결 요청 |
| `parentHome.status.scope` | Class info to read | Aviso de clase por leer | 반 안내 확인 필요 |
| `parentHome.status.moving(date)` | Moving {date} | Se cambia el {date} | {date} 반 이동 예정 |
| `parentHome.classLine.one(class)` | In: {class} | En: {class} | 소속: {class} |
| `parentHome.classLine.many(n)` | In {n} classes | En {n} clases | 소속 반 {n}곳 |
| `parentHome.classLine.none` | Family only | Solo en familia | 가족 학습만 |
| `transfer.familyNeedsYou(n)` | 1 class move needs your OK / {n} class moves need your OK | 1 cambio de clase espera tu respuesta / {n} cambios de clase esperan tu respuesta | 확인할 반 이동 {n}건 |
| `transfer.step.yourAnswer` | Your answer needed | Falta tu respuesta | 내 답을 기다려요 |
| `transfer.endsOn(date)` | Ends {date} | Termina el {date} | {date} 마감 |
| `settings.moveOpen` | A move is already open. | Ya hay un cambio abierto. | 이미 진행 중인 이동이 있어요. |

### 10.2 Changed and new keys of GX-7 to GX-14

| Key | en | es | ko |
|---|---|---|---|
| `space.week.notSynced(n)` (changed) | {n} haven't opened the app in over a week | {n} no abren la app desde hace más de una semana | {n}명은 일주일 넘게 앱을 열지 않았어요 |
| `space.week.anchor(a)` (changed) | Stage 1 first-try answers: {a} | Etapa 1, aciertos al primer intento: {a} | 1단계 첫 시도 정답률: {a} |
| `space.week.practicedFamily(p, n)` (new) | {p} of {n} learners practiced this week | {p} de {n} practicaron esta semana | 이번 주 연습한 학습자: {p}명 / {n}명 |
| `space.learner.questsCards(d, t, c)` (changed) | Stage 1 quests: {d} of {t} · {c} cards | Misiones de la Etapa 1: {d} de {t} · {c} tarjetas | 1단계 퀘스트 {d}/{t} · 카드 {c}장 |
| `space.learner.firstQuest` (new) | Working on the first quest | Con la primera misión | 첫 퀘스트 진행 중 |
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
| `relink.platform.{ios,android,web}` (new) | iPhone or iPad / Android / Web | iPhone o iPad / Android / Web | iPhone 또는 iPad / Android / 웹 |
| `relink.anotherWay` (changed) | the shipped sentence without its "Another way:" prefix, in all three | — | — |
| `parentHome.week(d, m)` (new) | Practiced {d} of the last 7 days · {m} min | Practicó {d} de los últimos 7 días · {m} min | 최근 7일 중 {d}일 연습 · {m}분 |
| `parentHome.next(title)` (new) | Next: {title} | Siguiente: {title} | 다음: {title} |
| `parentHome.notStarted(name)` (new) | Not started yet. Open the app on {name}'s device. | Aún no empieza. Abre la app en el dispositivo de {name}. | 아직 시작 전이에요. {name}의 기기에서 앱을 열어 주세요. |
| `parentHome.restart` (new) | A 5-minute quest is a good restart. | Una misión de 5 minutos es un buen reinicio. | 5분짜리 퀘스트로 다시 시작해 봐요. |
| `parentHome.lastActive.notStarted` (new) | Not started yet | Aún no empieza | 아직 시작 전 |
| `settings.inviteGrownUp` (new) | Invite another grown-up | Invitar a otro adulto | 다른 보호자 초대하기 |
| `settings.inviteGrownUpLine(code)` (new) | They sign in, then enter this code: {code} | Inicia sesión y escribe este código: {code} | 로그인한 뒤 이 코드를 입력하면 돼요: {code} |
| `parentHome.pinCta` (changed) | Set the PIN in the app | Crear el PIN en la app | 앱에서 PIN 만들기 |
| `lecture.minutesOf(a, p)` (new) | About {a} min (of {p}) | Unos {a} min (de {p}) | 약 {a}분 ({p}분 중) |
| `report.minutesTile(n)` (changed) | {n} min | {n} min | {n}분 |
| `report.classesLine(list)` (new) | Classes: {list} | Clases: {list} | 소속 반: {list} |
| `errorPage.title` (new) | Something went wrong on this page. | Algo salió mal en esta página. | 이 화면을 여는 중에 문제가 생겼어요. |
| `errorPage.retry` (new) | Try again | Intentar de nuevo | 다시 시도 |

### 10.3 Stage titles (GX-9; content, heritage-accuracy bar)

| Stage | en (unchanged) | es (draft) | ko (draft) |
|---|---|---|---|
| 1 | Hangul | Hangul | 한글 |
| 2 | Words | Palabras | 낱말 |
| 3 | Sentences | Oraciones | 문장 |
| 4 | Dialogue | Diálogo | 대화 |
| 5 | Stories | Cuentos | 이야기 |
| 6 | Real life | Vida real | 실생활 |
| 7 | In your own words | Con tus palabras | 내 말로 |

The en values are the shipped `STAGE_TITLES`; the row reads them, the test asserts en equals `apps/mobile/src/content/stages.ts`. 낱말 is the F-I18N-001 glossary word. The MAR checks each title against the stage's can-do line (F-ROUTE-001 Appendix A) before the row's fix stage re-signs `console`.

## 11. Accessibility, privacy, anti-shame, telemetry

- **Accessibility.** Every chip has text; colour is never the only cue (WCAG 1.4.1); amber is a fill, border or dot with `text.primary` text (contrast of `text.primary` on `nudgeLight` and `infoLight` is above 12:1). Action chips and every button are at least `touchTarget.min` tall. The banner is a polite live region; the pop-up is an `alertdialog` with focus on its title, Esc = Later, focus returned to where it was. The countdown updates once a minute and is not live-announced (only the banner is). The nav dot's count lives in the tab's accessible name. All of it holds at 320 px with the Largest text size and at 200 % browser text (the DN fit rule).
- **Privacy.** Incoming learners show initials, picture and level until accepted (T8). The home, the nav and the title carry counts only. `#attention` carries no id. The pop-up's shown set holds request ids only, in `sessionStorage`. No name reaches a URL or an event. GX-W's new fields are read under the same access checks as the roster (`learner.transfer` or roster read on the space) and add no field to any family or learner view beyond its own learners.
- **Anti-shame.** No chip says late, behind or missing; **New** describes a join, not a lack; the ordering puts what needs the grown-up first and is never by score; no counts of declined moves; no actor on an ended move (TV).
- **Telemetry.** None added. The Worker's existing `space.move.*` and re-link records are enough; a success measure for this amendment is the share of re-links approved before expiry, readable from the D1 rows already kept.

## 12. Data and API (GX-W, additive, Worker first)

| Route | Addition | Rule |
|---|---|---|
| `GET /api/spaces/:id/roster` | `learners[].pending?: { relink?: { id, expiresAt }, move?: { source: 'transfer' \| 'teacher', id, step: 'yours' \| 'others' \| 'room' \| 'scheduled', to: string \| null, on: string \| null } }`; top-level `incoming?: number` | Built from the same rows the three list routes read, with the same expiry settle; `to` only where the viewer may read the class name (TV-D8); computed set-based for the whole roster (one query per source table, `IN` chunks of 100) |
| `GET /api/spaces` | `items[].attention?: { relinks: number, moves: number }` | Counts only; only for spaces where the caller may act (`learner.transfer` or relink approval); grouped `COUNT … GROUP BY space_id` over the caller's spaces, so a school admin with 60 classes stays inside the statement budget (test) |
| `GET /:id/class-moves` (class) | `outgoing[].learnerId` while `status = 'requested'` | the source class already lists the learner |
| `GET /:id/transfer-requests` (class, role `source`) | `learnerId` on every open request, family-started included (GX-OD-2; amends F-SPACE-002 §4.2) | the source class already lists the learner; the destination view is unchanged (T8) |

Schemas are lenient on the client (`.catch` defaults): a console that meets an older Worker falls back to its own reads (section 3.3). No migration; no new table, index or column.

## 13. Rows (implementation PRs; every UI row adds en, es and ko, links its GX-0 mock and attaches 360 and 1280 screenshots)

| Row | Content | Size | Depends on |
|---|---|---|---|
| **GX-0** (this PR) | `docs(specs,design)`: this amendment; wireframes `console/approvals.md`, `parent/needs-you.md`; mocks `design/screens/approvals/`; pointer lines in F-SPACE-002, the TV amendment, F-APP-001, F-TCH-001, F-CONSOLE-001 and the specs README | M | — |
| **GX-1** (owner's request, first) | `feat(web,i18n)`: `lib/console/learner-status.ts` (section 3, reads `pending` when present); the chip and reason line on the class and family roster cards; inline Approve / Deny for re-links; action cards first; `useApprovalsWaiting` (teacher moves counted, `refreshKey`); re-link poll 10 s while pending; `console.status.*` | M | GX-0 |
| **GX-W** | `feat(backend,content-schema)`: section 12 (roster `pending` and `incoming`, spaces `attention`, `learnerId` on open outgoing class moves and on family-started source transfer views); statement-budget test; memory and sqlite adapters | M | GX-0 |
| **GX-2** | `feat(web,i18n)`: attention banner, review sheet (`components/console/AttentionParts.tsx`), re-link pop-up (`RelinkPopup.tsx`), `#attention`, the "(n) " title prefix; one incoming list with primary-first buttons on the moves page (`TeacherMovesSection.tsx`, `ClassTransferParts.tsx`); the `live` ref fix (set true in the effect body); `console.attention.*`, `console.relinkPopup.*` | M | GX-1 |
| **GX-3** | `feat(web,i18n)`: teacher home row chip linking to `#attention`; the school page's counts include teacher moves; nav dot and accessible name (`AdultFrame.tsx`, `shell-nav.ts`); reads `attention` from GX-W when present, else per-space reads | S | GX-1 |
| **GX-4** | `feat(web,i18n)`: parent Needs you strip (`components/console/FamilyNeedsYou.tsx`, `needsYou(view)` in `lib/console/parent-home.ts`), child chip and class line, inline re-link, consent sheet opened directly, the family pill leaves the bottom row; the three reads in the quiet load; Fix D step word and end date | M | GX-1 |
| **GX-5** | `feat(web,i18n)`: class-scope sheet from the strip and chip (text unchanged, list open, version unchanged); re-link pop-up on the parent home (20 s poll while pending); the parent Home nav dot | S | GX-4, GX-2 |
| **GX-6** | `fix(web)`: button system (T2): `buttonBase` minimums, the overrides removed, Remove in the danger tone; a scan test that no console file sets `minHeight` on a `Button` | M | GX-0 |
| **GX-7** | `feat(web,i18n)`: class page order, action bar with More, invite disclosure, compact roster card, empty-class checklist (T3-T5) | M | GX-2, GX-6 |
| **GX-8** | `fix(web,i18n)`: T7, T8, T9 (with the planProgress check), T10, T15, P4 (family join order, heading, practiced wording, dated join) | M | GX-0 |
| **GX-9** | `feat(web,i18n)`: stage titles in i18n (section 10.3), every console use of `STAGE_TITLES` through the dictionary | S | GX-0 |
| **GX-10** | `feat(web,i18n)`: settings rows (T11, P7): chip, Move disabled with reason, equal sizes, quieter Remove, Invite another grown-up | S | GX-1, GX-6 |
| **GX-11** | `feat(web,i18n)`: child card lines and squares (P2), lecture slot with 2+ learners (P3), report chooser line (P10) | M | GX-4 |
| **GX-12** | `fix(web,i18n)`: re-link page (T12, P8) | S | GX-6 |
| **GX-13** | `fix(web,i18n)`: learner report order, print hint, minutes unit, next-open dedupe, classes line (T13) | S | GX-0 |
| **GX-14** | `fix(web,i18n)`: phone nav one row (P6), `error.tsx` (P5), PIN card CTA (P9), lecture minutes line (T14) | S | GX-6 |

**Order.** GX-1 first (the owner's request); GX-W in parallel (Worker first; GX-1 works without it). Then GX-2, GX-3 and GX-4 in parallel; GX-5 after GX-4 and GX-2. GX-6, GX-8, GX-9 and GX-13 can run at any time after GX-0; GX-7 after GX-2 and GX-6; GX-10 after GX-1 and GX-6; GX-11 after GX-4; GX-12 and GX-14 after GX-6. **Total:** 16 rows (GX-0 included), one Worker deploy (GX-W), no migration.

## 14. Tests (per row; e2e at 360 x 740 and 1280 x 800, each in ko, en and es)

| File | Row | Asserts |
|---|---|---|
| `apps/web/src/lib/console/__tests__/learner-status.test.ts` | GX-1 | every kind of section 3.2 from fixtures; priority order; an expired re-link dropped; never a name match (two learners with one name and one re-link: only the id's card gets it); `pending` preferred when present, the three reads when absent; a failed read adds nothing; `new` only within 7 days and with no summary; family rosters get `none`, not `in_class`; totals |
| `apps/web/src/components/console/__tests__/status-chip.test.tsx` | GX-1 | text for every kind in en, es and ko; action chip is a button ≥ `touchTarget.min` with name "{chip}: {reason}" and `aria-describedby`; no `feedback.danger` and no colour literal (token scan); minute countdown rounding |
| `apps/web/src/components/console/__tests__/moves-entry.test.tsx` (extend) | GX-1, GX-3 | a teacher move counted; `refreshKey` rereads; `attention` used when present, three reads otherwise |
| `apps/web/e2e/grownup-status.spec.ts` (new, mocked API, the `class-moves.spec.ts` pattern) | GX-1 | the class page shows Needs your OK beside the re-link learner and In class beside the others; Approve inline removes the chip; New on a learner joined today; ko / en / es at 360 and 1280; no sideways scroll at 360 |
| `packages/backend/src/__tests__/grownup-attention.test.ts` (new), `db-contract.test.ts` (extend) | GX-W | `pending` per learner for each step; `incoming`; `attention` counts equal the client rule on the same fixtures; only spaces the caller may act on; no field leaks a destination's learner name or id before acceptance; statement budget for a school admin with 60 classes; memory and sqlite |
| `apps/web/src/components/console/__tests__/attention-parts.test.tsx`, `relink-popup.test.tsx` | GX-2 | banner role and text; sheet sections only when non-empty; Accept first in both incoming components; pop-up once per id per session, Esc = Later, focus return; not shown while another dialog is open; title prefix count only |
| `apps/web/e2e/grownup-attention.spec.ts` (new) | GX-2, GX-3 | home chip → class page sheet open (`#attention`) → approve a device and accept a move in 2 taps; a new re-link during the visit opens the pop-up within 10 s; nav dot name; ko / en / es at 360 and 1280 |
| `apps/web/src/lib/console/__tests__/parent-home.test.ts` (extend), `family-needs-you.test.tsx` | GX-4, GX-5 | `needsYou` builder for the three item kinds; chip priority; class line one / many / none; quiet load rereads; scope sheet shows every `CLASS_SCOPE_TEXT` line with the list open and writes the ack |
| `apps/web/e2e/class-moves.spec.ts` (extend) | GX-4, GX-5 | strip above the first child at 360; consent in 2 taps; re-link approved inline; ko / en / es |
| `apps/web/src/components/console/__tests__/button-size.test.tsx`, source scan | GX-6 | every `Button` and link-button ≥ `touchTarget.min` tall and wide; no per-call `minHeight` left |
| render tests of the class page and card (extend), `apps/web/e2e/class-page-order.spec.ts` (new) | GX-7 | order of section 8 T3; invite disclosure collapsed with learners, open when empty; card lines; checklist on an empty class; 360 and 1280, three locales |
| `rollup.test.ts`, `plans.test.ts`, `curriculum.test.ts` (extend) | GX-8 | new joiners not counted; anchor hidden when null; the two plan states; family join order and wording |
| `stage-titles.test.ts` (extend) | GX-9 | en equals `stages.ts`; es and ko present for 7 stages |
| settings render tests (extend) | GX-10 | Move disabled with reason while a move is open; invite copies the code |
| parent-home render tests (extend) | GX-11 | lines 1-2, never-started and restart lines, squares fill only; lecture slot rule |
| relink page tests (extend) | GX-12 | 64 px buttons, countdown per minute, platform names, rolled-up times, family denial wording, no duplicate "Another way" |
| report tests (extend) | GX-13 | H1 first; print hint only after Print; unit; next-open dedupe |
| `error-page.test.tsx`, nav render test | GX-14 | error page in the console locale with Try again; nav one row at 360 in en and es |
| i18n coverage ratchets, `length-budget.test.ts`, banned words, `review-ledger-current.test.ts` | every UI row | es and ko present for every new and changed key; the ledger re-signed in the fix stage after the independent es / ko review |

## 15. Owner decisions (each has a default that applies until answered)

| # | Question | Default (applied) |
|---|---|---|
| GX-OD-1 | Show **In class** on every class roster card, or only non-default states? | **Shown**, quietly (the owner's "On board"). |
| GX-OD-2 | May the source class see the `learnerId` of an open family-started transfer? | **Yes** (the source class already lists the learner); amends F-SPACE-002 §4.2. |
| GX-OD-3 | May the class-scope text move from an always-shown home card into a sheet opened from Needs you? | **Yes**, text verbatim and list always open inside the sheet; amends TV-D5's surface. |
| GX-OD-4 | Add a "teacher approves joins" class setting? | **No**; joins stay instant and a new joiner shows **New**. If wanted later: a `pending` membership state that holds no seat until approved, a learner-app waiting screen, an F-SPACE-001 amendment and a migration; it would reuse this chip and sheet. |
| GX-OD-5 | Email or push for waiting approvals? | **None** (no channel exists). |
| GX-OD-6 | Re-link pop-up on or off? | **On**, once per request per tab session, re-links only. |
| GX-OD-7 | Stage titles translated in ko and es? | **Yes**, the section 10.3 drafts after the MAR heritage check. |
| GX-OD-8 | Change the ko register of the class-scope and billing texts? | **No** (legal and pricing text keeps 합니다체; a change would ask every family again). |

## 16. Edits to the amended specs (pointer lines in this PR; text in the rows named)

- **F-SPACE-002**: §4.2 source view `learnerId` on family-started requests (GX-W); §4.8 entry points and home badge become the attention chip and count of section 6 (GX-1, GX-3).
- **`AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md`**: §5 console family surface: the class-scope card opens as a sheet from Needs you (GX-5); TV-D8's incoming list merges into the review sheet's "Asking to join this class" (GX-2); outgoing views carry `learnerId` while requested (GX-W).
- **F-APP-001**: §3.8 nav: the attention dot (GX-3, GX-5); one nav row on phones (GX-14).
- **F-TCH-001**: §10.1 re-link: the chip, inline approval, pop-up and 10 s poll (GX-1, GX-2, GX-12).
- **F-CONSOLE-001**: §3.4 home counts include re-links and teacher moves (GX-3).

## 17. Review log

- 2026-10-31, GX-0 (this PR): measured on `1bfda3fc8` (section 1) through three read-only audits (approvals; teacher console, 96 screenshots; parent console, 12 pages × 3 locales × 2 widths); every `file:line` above re-read at that commit. Korean drafts rewritten to the F-I18N-001 §3.10 rule (no particle on a variable: the audits' "{name}이(가)", "{to}(으)로" forms are replaced by colon forms or the possessive 의, which never changes form); "퀘스트" kept over "레슨" (glossary). Multi-agent review of this PR to follow (design, accessibility, privacy and child safety, anti-shame copy, Spanish, Korean).
