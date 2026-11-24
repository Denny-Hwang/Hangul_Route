# AMENDMENTS-CLASS-CODE-OVERLAY — show the class code, not the class

Status: draft (revision 1, 2026-11-23). Row **CO-0** of work order WO-09 (`docs/roadmap/review-2026-11/phase-1-safety.md`), which brings forward WO-30 (`docs/roadmap/review-2026-11/phase-4-console-site.md`). The work order was written on `d5ba0217c`; this spec re-reads every citation on `origin/main` `e72336a7d`, and every `file:line` below is at that commit. Owner decisions OD-CO1 to OD-CO6 (§10) are open; the spec goes `ready` once they are answered and the multi-agent review has passed.

**Amends**: F-SPACE-001 §1 and §3.2 (the join code "written on the board": a second way to show it to a room) · `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` §5 "Console, teacher", *Roster* (a full-scope learner's "Words to revisit" line starts folded on a class roster, if OD-CO1 is yes) · tag **[CO]**
**Also amends** (found while re-reading the cited lines; the work order names only the two above): `AMENDMENTS-GROWNUP-UX.md` §8 T3 (the class action bar gains **Show the code**) and T4 (card line 4 becomes a disclosure) · F-CONSOLE-001 §3.5 (student cards: "revisit jamo") · F-VOC-005 §3.8 (the roster card's "Words to revisit" line, if OD-CO1 is yes). Their "Amended by" lines land in row CO-3.
**Not amended**: F-TCH-001 §10.3 (`anonymizeRoster` keeps meaning names only); F-TCH-004 (the presenter's End slide keeps its code panel); `AMENDMENTS-DISPLAY-NAV.md` §8 (the overlay follows ConfirmSheet's focus rules but is not a ConfirmSheet).
**Scope**: `apps/web/src/app/(console)/teach/space/page.tsx` (shared with WO-31: merge serially, roadmap README §6), `apps/web/src/lib/console/class-page.ts`, `apps/web/src/lib/console/class-code-overlay.ts` (new), `apps/web/src/components/console/ClassCodeOverlay.tsx` (new), `ClassPageParts.tsx`, `JoinLinkParts.tsx`, `VocabWordsParts.tsx`, `packages/i18n/src/messages/{en,es,ko}/console.ts`, the tests of §6. No Worker, schema, migration or design-token change.
**Owner**: solo dev
**Rollout**: next console build, no flag (§7)

---

## 1. Context

CLAUDE.md §1 forbids "public ranking of children — leaderboards, class rankings, learner-vs-learner comparisons". When a learner walks in late, the teacher puts the class page on the classroom screen to show the code, and the room sees every learner's name next to the letters that learner still needs to practise.

### 1.1 The work order's citations, re-read on `e72336a7d`

| # | Work order (`d5ba0217c`) | On `e72336a7d` | Verdict |
|---|---|---|---|
| 1 | `W/app/(console)/teach/space/page.tsx:740` `{classPage && !empty ? invite : null}` comes **after** the roster | `apps/web/src/app/(console)/teach/space/page.tsx:740`, unchanged. The code sits inside **Invite students · code {code}** (`InviteDisclosure`, `apps/web/src/components/console/ClassPageParts.tsx:86-154`), closed while the class has learners (`useState(empty)`, `:98`). To show the code the teacher opens a disclosure under the last roster card, so the roster is on screen with it. An empty class leads with the code instead (`page.tsx:582`), where there is no roster to show. | True; line unchanged |
| 2 | every roster card has `needsPractice` letters (`:685-690`) | `page.tsx:685-691` (the block closes at `:691`): "Revisit: ㅂ · ㅅ" (`console.space.learner.revisit`), always shown. The work order missed the next line, `:692`: `StudentWordsLines` draws "Words: N collected · M strong" and "Words to revisit: 사과 sagwa (apple) · …" (`apps/web/src/components/console/VocabWordsParts.tsx:59-78`), shown for every full-scope learner since `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` (TV-D2; §5 *Roster*). | True; one line moved; a second weak-point line found (OD-CO1) |
| 3 | `anonymizeRoster` only swaps names for initials | `packages/backend/src/routes/spaces.ts:116-118` `rosterName` calls `rosterAlias` (`packages/content-schema/src/schemas/relink.ts:46-50`: "Minho Kim" → "M. K.") on the roster's `displayName` (`:613`); the level (`:614`), the avatar (`:615`) and the summary (`:621`, `rosterSummary`) pass unchanged. A class starts with it off (`:147`, `anonymizeRoster: input.kind === 'school'`). | True |

### 1.2 Also found (they shape the design)

- **The page is built to stay on a classroom screen.** The roster reads itself again while the tab is in view, "a classroom screen" (`page.tsx:190-192`).
- **The frame shows the teacher's email.** The AdultFrame header carries the signed-in grown-up's email or name (`apps/web/src/components/console/AdultFrame.tsx:562`). Anything that leaves the frame on a projector shows it.
- **A pop-up can name a learner by itself.** On a class page the new-device pop-up opens on its own (`page.tsx:245-251`, `auto` at `:249`) with the learner's name (`:530`); it waits only while the review sheet or a confirm step is open (`blocked`, `:247`).
- **Only managers get a code, and only a live one.** The roster carries `joinCode` only for a `space.manage` role and only while the code is live (`spaces.ts:78-80`, `:634`); otherwise both code fields are `null`.
- **The QR code exists.** `JoinLinkQr` (`apps/web/src/components/console/JoinLinkParts.tsx:71-92`) draws `rosterJoinLink` (`apps/web/src/lib/console/join-link.ts:12-15`: `<app origin>/join#c=<code>`, the code alone in the fragment, never a name) at a fixed side `QR_SIDE = touchTarget.min * 4` (256 px, `:13`), with error correction M and the 4-module quiet zone (`join-link.ts:22-62`); every unit run reads the drawing back (`apps/web/src/lib/console/__tests__/join-link-qr-decode.test.ts`). On the class page it is behind **Show QR code** inside Invite students (`JoinLinkParts.tsx:47-56, 63-65`).
- **The console's dialog rules.** ConfirmSheet (`AMENDMENTS-DISPLAY-NAV.md` §8; `apps/web/src/components/console/ConfirmSheet.tsx`) keeps the control that had focus when it opened and focuses it again when it closes (`:107-117`), makes the rest of the page `inert` (`inertOthers`, `:82-95`), and catches Escape and Tab for the whole document (`:119-134`, `:137-148`). The review sheet (`apps/web/src/components/console/AttentionParts.tsx:245-290`) applies the same rules with first focus on its title.
- **The presenter is not a quick path.** The lecture presenter's End slide can show the code (F-TCH-004 §3.3 item 9; `apps/mobile/src/screens/presenter/slides/EndSlide.tsx:152-191`), but only in a deck the teacher built with "+ Class code" (presets never add it, `AMENDMENTS-LECTURE-V2.md` LV-D7), at the end of a lesson, and the code then rides in the link (F-TCH-004 §8 item 4).
- **A roster card has no `<details>`.** The class page test asserts it (`apps/web/src/components/console/__tests__/class-page-order-wiring.test.tsx:213`); the console's disclosures are buttons with `aria-expanded` (`ClassActionBar`, `InviteDisclosure`).

Who this hurts: every learner in the room, whose letters to revisit are shown beside the others' names; most of all a learner who is just starting and has the longest list.

## 2. User story

> As a teacher, when a learner walks in late, I press one button and the classroom screen shows our class name, the code and a QR code, and nothing else. I press Escape and I am back on my class page.
>
> As a learner, I never see on the classroom screen which letters another learner still needs to practise, and nobody sees mine.

## 3. Acceptance criteria

### 3.1 The entry: Show the code (row CO-1)

- The class page's action bar (`ClassActionBar`, GX-7 T3) gains **Show the code** (`console.space.codeOverlay.open.cta`), a secondary button that stays in the bar, never under More: after the everyday buttons (Plan, Term plan, Lecture mode, Class report) and before any waiting entry (new devices, class moves). `classActions` (`apps/web/src/lib/console/class-page.ts:36-51`) gains the input `code: boolean` and the action `'showCode'`.
- It is shown when `codeOverlayShown(roster, now)` is true (new, pure, `apps/web/src/lib/console/class-code-overlay.ts`): the space is a `class`, `archivedAt` is null, `joinCode` is not null and `joinCodeExpiresAt` is later than `now`. An empty class shows it too: its page leads with the code already (§1.1 #1), but the overlay also hides the frame and the teacher's email.
- No entry on a family roster, a school, an archived class, a class with no code or an expired one, or for a role that receives no code (§1.2). A class with no code keeps **Create a code** in Invite students, unchanged.
- The button has `aria-haspopup="dialog"`; its accessible name is its visible label; it is at least `touchTarget.min` tall (the console's `buttonBase`).

### 3.2 What the overlay shows, and nothing else

A full-viewport dialog over the page:

| Part | Content | Source |
|---|---|---|
| Heading | the class name | `roster.space.name` (a rename shows at once: the page lays `names` over each read, `page.tsx:163`) |
| Caption | **Class code** | `console.space.codeLabel.class` (shipped) |
| The code | the six characters, very large, with space between the letters | `roster.joinCode` |
| Expiry | "expires in 18 days", "expires today" | `codeExpiry(roster.joinCodeExpiresAt, now, locale)` (`apps/web/src/lib/console/rollup.ts:184-192`, shipped) |
| QR code | the join link as a QR image, and under it "Scan it with the camera of a phone or tablet." | `rosterJoinLink` and the QR drawing (§3.5); `console.space.joinLink.qr.label`, `.caption` (shipped) |
| How to join (only if OD-CO5 is yes) | "Tap “Join a class” in Hangul Route and type this code." | `console.space.codeOverlay.howToJoin(cta)`, `cta` = `caregiver.spaces.join.cta` |
| Close | **Close** | `common.buttons.close` (shipped) |

- **Never in the overlay**: a learner's name, initials, avatar or level; any progress or summary value; the number of learners or seats; plans; the frame (tabs, the account's email, the attention banner); Copy, Regenerate or Create a code (no re-issue, WO-30); the join link as text (the QR carries it; Copy link stays in Invite students).
- `codeOverlayView(roster, now, locale, origin)` (pure) builds the overlay's whole model, `{ spaceName, codeLabel, code, spokenCode, expiry, joinLink }`, and nothing else. `ClassCodeOverlay` takes this view, never the roster, so no learner field can reach it by accident.
- **Opaque.** The overlay fills the viewport (`position: fixed; inset: 0`) with `colors.surface.paper`, with no scrim: no part of the page shows through, at any size or on any projector.

### 3.3 Opening, closing, focus and the page behind

ConfirmSheet's focus rules (`AMENDMENTS-DISPLAY-NAV.md` §8), with the review sheet's first focus:

- `role="dialog"`, `aria-modal="true"`, named by the heading (`aria-labelledby`) and described by the caption, the spoken code and the expiry (`aria-describedby`, in that order). A screen reader hears: "Sunday Class A, dialog. Class code, S U N 2 3 4, expires in 18 days."
- On open, focus goes to the heading (`tabIndex={-1}`), as the review sheet's title (`AttentionParts.tsx:247-255`): the content is to be read, and the one control comes next. Tab and Shift+Tab stay on Close (`tabTarget`, `ConfirmSheet.tsx`).
- **Escape** closes, caught for the whole document while the overlay is open (a click on the code takes focus off the button). **Close** closes. There is no backdrop to click.
- While it is open every other element of the page is `inert` (`inertOthers`), undone when it closes.
- On close, focus goes back to the control that opened it (Show the code). When that control is gone (the code ended or was replaced and the bar drew again), focus goes to the page head (`spaceHead`, `page.tsx:108` and `:487`), the fallback `focusAfterIncoming` already uses (`:211-213`).
- No address change, no history entry, no hash: the browser back leaves the page as it always has, and the overlay with it (the console has no history bridge, `AMENDMENTS-DISPLAY-NAV.md` §8).
- No motion: it appears and goes at once, so `prefers-reduced-motion` needs no branch.

### 3.4 Size on a phone, a laptop and a projector (tokens only)

The overlay sizes its type by the window, as the lecture presenter does (F-TCH-004 §3.6, the `presenter` tokens): one stage unit is `min(100vw / presenter.stage.width, 100dvh / presenter.stage.minHeight)` (1280 and 600; `vh` where `dvh` is missing). Each part has a console floor, so a phone never shows less than the console's own sizes.

| Part | Size | 1280 x 720 | 1920 x 1080 | 360 x 740 |
|---|---|---|---|---|
| Code | `max(typography.size.hero, presenter.size.display units)`, at most what fits six characters on one line of its column (§3.4 "Fit") | 140 px | 210 px | 48 px |
| Space between the letters | `max(spacing.sm, spacing.xl units)` | 24 px | 36 px | 8 px |
| Class name | `max(typography.size.title, presenter.size.prompt units)` | 56 px | 84 px | 28 px |
| Caption, expiry, QR caption (and how to join) | `max(typography.size.body, presenter.size.caption units)` | 28 px | 42 px | 18 px |
| QR side | `max(4 x touchTarget.min, presenter.size.glyph units)`, at most its column | 380 px | 570 px | 256 px |
| Close | the console button, `touchTarget.min` tall | 64 px | 64 px | 64 px |

- **The code**: `typography.family.mono`, `typography.weight.bold`, `colors.text.primary`, on one line (`white-space: nowrap`), never broken. It is drawn `aria-hidden`, with a visually hidden copy of its characters separated by spaces (`spokenCode`), so a screen reader reads it letter by letter (the presenter's rule, `EndSlide.tsx:172-175`).
- **Fit**: the code's column is a size container; its font size is at most `100cqi / CODE_WIDTH_EM`, where `CODE_WIDTH_EM = 4.7` is six monospace characters at the 0.6 em advance of Menlo and Courier plus the letter spacing (about 0.17 em), rounded up. The one constant of this spec; the mock lists it under Constants.
- **Floors grow with the text size.** The floors are in rem (`typography.size.*` / 16), so the browser text size and the Display sheet's text size raise them; the stage sizes follow the window.
- **Two columns** when the window is landscape and at least `layout.sideBySideMin` (700 px) wide, the story reader's two-column rule (F-STORY-002): the class name, the caption, the code and the expiry at the inline start; the QR and its caption at the inline end; both centred in the height; Close in the top inline-end corner. The switch is in px, not em: like the presenter stage, the overlay follows the window, so 200 % text on a 1280-wide projector keeps two columns.
- **One column** otherwise, centred: Close at the top inline-end, then the class name, the caption, the code, the expiry, the QR and its caption. The overlay scrolls (`overflow-y: auto`) when it does not fit (320 x 568 at 200 % text), never sideways.
- **Space**: gutters `layout.gutter.compact` / `.regular` / `.wide` by the window class; gaps `spacing.*`, scaled by the stage unit like the type, with the console gap as the floor.
- **Colour**: `colors.text.primary` for the heading, the code and the QR modules; `colors.text.secondary` (8.4:1 on paper) for the caption, the expiry and the QR caption, never `text.muted`, because a projector washes contrast out. No `feedback.*` colour anywhere.
- At 1280 x 720 and 1024 x 768 (16:9 and 4:3 projectors) the code and the whole QR are in the first screen, with no scrolling.

### 3.5 Reusing the QR

- The QR comes from the shipped code: `rosterJoinLink` makes the link and `qrModules` / `qrPath` / `qrViewSize` draw it (`join-link.ts:22-62`). Row CO-1 moves the `<svg>` of `JoinLinkQr` (`JoinLinkParts.tsx:76-88`) into an exported `JoinLinkQrImage({ url, label, side })`; `JoinLinkQr` calls it with `QR_SIDE`, so the roster panel draws exactly what it draws today and its tests do not change. The overlay calls it with a CSS size. No second QR library and no new drawing code.
- In the overlay the QR is always shown (no Show QR code toggle) and has no border: the paper around it is the quiet zone.

### 3.6 While the overlay is open

- **The new-device pop-up waits.** `useRelinkPopup`'s `blocked` (`page.tsx:247`) becomes `sheet !== null || confirmSheet !== null || codeOpen`. A request that arrives while the code is shown opens its pop-up after Close (the pop-up's own rules unchanged); the 20-second re-link read goes on, so nothing is missed.
- **The code follows the roster.** The quiet re-read goes on (`page.tsx:192`). A new code (Regenerate in another tab) replaces the code and the QR in place. When the roster no longer has a live code (`codeOverlayShown` turns false) or the roster goes (forbidden, gone), the overlay closes, with the focus fallback of §3.3.
- **The grown-up lock is unchanged.** The idle lock and the hidden-tab cover (`apps/web/src/components/console/GrownUpLock.tsx:428-437`, opaque, at the highest `z` token) cover the overlay too and show no learner data; the overlay never holds the lock off. The overlay uses `z.modal`.
- **Offline**: the overlay draws from the roster in memory and the QR in the page, so it works offline.

### 3.7 The roster card: what to revisit starts folded (row CO-2)

- On a **class** roster, a card with a summary shows at line 4 (GX-7 T4) a disclosure button **What to revisit** (`console.space.learner.revisitToggle`) with the console chevron (`ClassPageParts.tsx:22-35`): `aria-expanded`, `aria-controls` only while open, `aria-describedby` the learner's name (`roster-learner-{index}`, as Send a note does, `page.tsx:729`), at least `touchTarget.min` tall. It starts **closed** on every page load.
- Open, its body shows the card's "Revisit: ㅂ · ㅅ" line (the text and `lang="ko"` of `page.tsx:685-691`, unchanged) and, if OD-CO1 is yes, the "Words to revisit: …" line (`VocabWordsParts.tsx:69-75`, romanization and gloss unchanged). A card with neither shows **Nothing to revisit yet.** (`console.space.learner.revisitNothing`).
- Which cards get the button: if OD-CO2 is yes (recommended), every card with a summary, so a closed card never tells a room who has something to revisit; if no, only cards with something to revisit.
- A closed body is not mounted: no jamo and no word of it is in the page while it is closed, so find-in-page and a screen reader do not reach it.
- Open state lives in the page's memory, keyed by learner id: it survives the quiet re-reads, a new card order (`rosterOrder`) and the overlay; it is not stored, so the next visit starts closed. A card's button opens that card only. No "open all" (OD-CO3).
- The other card lines stay as they are: the practiced line, the stage segments and quests, "Words: N collected · M strong" (it moves above the button when OD-CO1 is yes, since its partner line leaves), the plan lines, the starting spot, own route, free lessons and the base-scope line.
- **This week** keeps "Jamo to revisit together" and "Words to revisit together" in view (`page.tsx:596-612`): they name no learner.
- A **family** roster is unchanged: a family sees everything (TV-D1) and its page is not a classroom screen.
- `anonymizeRoster` is unchanged and independent: with names or with initials, the card folds the same.

### 3.8 Strings (`packages/i18n/src/messages/en/console.ts`)

| Key | English | Row |
|---|---|---|
| `console.space.codeOverlay.open.cta` | Show the code | CO-1 |
| `console.space.codeOverlay.howToJoin` `(cta: string)` | Tap “{cta}” in Hangul Route and type this code. *(only if OD-CO5 is yes; the words of the presenter's `learner.presenter.slide.end.howToJoin`, so its reviewed es and ko can be followed)* | CO-1 |
| `console.space.learner.revisitToggle` | What to revisit | CO-2 |
| `console.space.learner.revisitNothing` | Nothing to revisit yet. *(the words of `console.lecture.source.noRevisit`)* | CO-2 |

Reused unchanged: `console.space.codeLabel.class`, `console.codeExpiry.*`, `console.space.joinLink.qr.label`, `console.space.joinLink.qr.caption`, `common.buttons.close`, `console.space.learner.revisit`, `console.space.learner.wordsRevisit`, `console.space.learner.words`.

- English at CEFR Pre-A1. The bar and the card speak to the teacher; the overlay's words are read by a room, so they name no age and no audience. Every new string passes `isCaregiverSafe` (`apps/web/src/lib/console/banned-text.ts`) and the 28-character `cta` budget (`packages/i18n/src/__tests__/length-budget.test.ts`).
- Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:31-35`; a missing key fails the `es` and `ko` coverage ratchets), so each row that adds a key carries reviewed es and ko values in the same PR: R8 draft, F-I18N-001 §3.10 review, ledger re-signed (as `AMENDMENTS-DURABLE-PROGRESS.md` and `AMENDMENTS-STROKE-ORDER-STANDARD.md` do). This spec gives the English only. Korean: 해요체, no particle on a variable.

### 3.9 [On a projector, owner]

- On a classroom projector or a TV, at its own resolution: Show the code; from the back of the room the code can be read, and a phone camera opens Join a class from the QR.
- VoiceOver (macOS Safari) and NVDA (Windows, Chrome): opening says the class name, "Class code", the code letter by letter and the expiry; Escape goes back to Show the code.

## 4. Out of scope

- **A family roster's Show the code.** A family code goes to one co-parent or one device, never to a room; the family home has "Open the app on this device" (`AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` OA-D20).
- **Browser full screen** (OD-CO4).
- **Folding other card lines** (OD-CO6) and a roster "presenting mode" that hides every per-learner line.
- **Telemetry.** No event is added; nothing here needs measuring.
- **Printing** the code or the QR.
- The class page's other open items: the copy feedback (WO-31 #2), the roster grid's `minmax(280px, 1fr)` (WO-31 #13), the error title (WO-31 #1). They touch the same file; WO-31 owns them.
- The lecture presenter's End slide (F-TCH-004), unchanged.

## 5. UI sketch

- Wireframe: `design/wireframes/console/class-code-overlay.md` (this PR, row CO-0).
- Mock: `design/screens/console/class-code-overlay.md` with `mock/class-code-overlay*.html`, `mock/class-code-overlay.css`, `tools/class-code-overlay-capture.mjs` and `shots/class-code-overlay-*.png` (this PR; agent-made and approved by the multi-agent review, CLAUDE.md §5).
- Neighbours it follows: `design/wireframes/console/roster.md` ("Join link and QR code", "Class page order (GX-7)"), `design/screens/app-shell/join-link.md`, `design/screens/approvals/` (the roster card), `design/screens/class-page/` (shots of the built page).

## 6. Tests

Unit (`apps/web/src/lib/console/__tests__/`):

1. `class-code-overlay.test.ts` (new): `codeOverlayShown` for a class with a live code (true); a family and a school (false); `joinCode` null, `joinCodeExpiresAt` null, an expiry equal to `now` and one in the past (false); an archived class (false). `codeOverlayView`: its keys are exactly `spaceName, codeLabel, code, spokenCode, expiry, joinLink`; `spokenCode` is `S U N 2 3 4`; `expiry` equals `codeExpiry(...)`; `joinLink` equals `rosterJoinLink(...)`; for a roster of learners with awkward names (Hangul, accents, a hyphen, an apostrophe), with and without `anonymizeRoster`, the serialized view holds no `displayName`, no `rosterAlias` of one, no `needsPractice` jamo and no vocab id; in en, es and ko.
2. `class-page.test.ts` (extend): `'showCode'` is in the bar after `classReport` and before `relink` / `moves`; absent when `code` is false; present on an empty class; never in `more`.

Component (`apps/web/src/components/console/__tests__/`):

3. `class-code-overlay.test.tsx` (new): `role="dialog"`, `aria-modal`, `aria-labelledby` and `aria-describedby` point at mounted ids in the order of §3.3; the heading takes focus on open; Escape on the document and Close each call `onClose` once; Tab and Shift+Tab stay on Close; the opener gets focus back on close, and the fallback target when the opener is gone; `inertOthers` marks the page and is undone (the page-node fakes of `confirm-sheet.test.tsx`); the QR path equals `qrPath(qrModules(joinLink))`; the code node is `aria-hidden` and the spoken copy is present.
4. **`class-code-overlay-wiring.test.tsx` (new), the overlay renders no learner name and no progress.** The class page renders with three learners (one with `needsPractice: ['ㅂ', 'ㅅ']`, one with words to revisit, one with a plan readout) and a pending re-link; Show the code is pressed. Every text node and every attribute value (`aria-label`, `title`, `alt`) inside the overlay is collected: each is one of the allowed strings (the class name, `codeLabel.class`, the code, the spoken code, the `codeExpiry` line, `qr.label`, `qr.caption`, `common.buttons.close`, and `howToJoin` if OD-CO5 is yes), and none contains a learner's `displayName`, its initials, a needs-practice jamo, a word's romanization or any `console.space.learner.*` line. The same with `anonymizeRoster: true`. Also: the re-link pop-up is not rendered while the overlay is open and is rendered after Close; a quiet re-read with a new code redraws the code and the QR; a quiet re-read with `joinCode: null` closes the overlay and focuses the page head; a family roster has no Show the code.
5. `class-page-parts.test.tsx` (extend, CO-2): the What to revisit disclosure is closed by default with no body mounted (no jamo in the tree); `aria-expanded` follows the state; `aria-controls` only while open; `aria-describedby` names the learner; the body shows the jamo line, the words line (OD-CO1) or "Nothing to revisit yet.".
6. `class-page-order-wiring.test.tsx` (extend, CO-2): on a class card no jamo and no "Words to revisit" text until the button is pressed; the button on every card with a summary (OD-CO2) and on none without one; opening one card opens only that card; the open state survives a quiet re-read and a reorder; a family card keeps today's lines in view. `card-actions` stays `['see-report', 'send-note', 'suggest-start']` and the card still has no `<details>`.
7. `vocab-words-wiring.test.tsx` (update, CO-2): a class card's words-to-revisit line appears after the card's button is pressed (OD-CO1); a family card's line is unchanged.
8. Copy: the new strings pass `isCaregiverSafe` in en, es and ko and the length budget.

End to end (`apps/web/e2e/`, Playwright, the mocked-API export of `join-link.spec.ts`):

9. `class-code-overlay.spec.ts` (new, CO-1): **keyboard only**: Tab to Show the code, Enter opens the dialog with focus on its heading; Escape closes it and focus is on Show the code; Tab, Enter on Close does the same. With it open: every point of a 12 x 8 grid over the viewport hits the overlay (`elementFromPoint`); the roster cards are inside an `inert` element; the overlay's `innerText` holds no learner name. At 1280 x 720, 1920 x 1080, 1024 x 768, 360 x 740 and 320 x 568 with 200 % text: no sideways scroll; the code is on one line inside the viewport; the QR is at least 256 px wide; at 1280 x 720 and 1024 x 768 the code and the whole QR are inside the first viewport; the QR reads back as the join link where the browser has `BarcodeDetector` (as `join-link.spec.ts:77-124`). `HR_SHOTS=1` writes `design/screens/console/shots/class-code-overlay-built-{lc}-{w}.png` in en, es and ko.
10. `class-page-order.spec.ts` (update, CO-2): line 4 of a card is the What to revisit button; opening it shows the line; its shots in `design/screens/class-page/shots/` are taken again.

Coverage: `apps/web` verification logic stays at or above 90 % (CLAUDE.md §6); `class-code-overlay.ts` is pure and covered fully.

## 7. Rollout

No flag. Show the code adds a button and takes nothing away (Invite students and its code panel are unchanged), and CO-2 puts two lines one press away. Nothing on the Worker changes and there is no migration, so a revert of the row's PR is the rollback. CO-1 ships first: it is the projector path, the first defence; CO-2 is the second defence against a page shared by mistake.

## 8. Dependencies

- `page.tsx` is shared with WO-31 (roadmap README §6): merge serially and rebase mechanically; CO-1 and CO-2 also merge one after the other.
- `packages/i18n/src/messages/en/console.ts` is shared with almost every UI work order: mechanical rebase.
- Tokens used all exist: `presenter`, `typography`, `layout`, `spacing`, `touchTarget`, `z`, `colors`. No design-system change, so `design-token-sync.yml` has nothing new to check.
- `join-link-qr-decode.test.ts` keeps holding the QR drawing that the overlay reuses.

## 9. Rows

| Row | Model | Work | Tests | Depends on | Branch |
|---|---|---|---|---|---|
| CO-0 | Opus 5.5 | This spec, the wireframe and the mock (§5); multi-agent review | the mock's capture checks (`tools/class-code-overlay-capture.mjs`) | — | `docs/class-code-overlay-spec` |
| CO-1 | Sonnet 5.5 | §3.1 to §3.6: `lib/console/class-code-overlay.ts` (`codeOverlayShown`, `codeOverlayView`); `classActions` `code` input and `'showCode'`; `ClassCodeOverlay.tsx`; `JoinLinkQrImage` split out of `JoinLinkQr`; the page's open state, action node, overlay, `blocked` and focus fallback; §3.8 CO-1 strings in en, es and ko | 1, 2, 3, 4, 8, 9 | CO-0 `ready` (OD-CO4, OD-CO5 answered) | `feat/class-code-overlay` |
| CO-2 | Sonnet 5.5 | §3.7: the What to revisit disclosure on class cards (in `ClassPageParts.tsx`), its open state by learner id in the page, `StudentWordsLines` split so the count line and the revisit line can sit apart (if OD-CO1 is yes); §3.8 CO-2 strings in en, es and ko | 5, 6, 7, 8, 10 | CO-0 `ready` (OD-CO1, OD-CO2, OD-CO3, OD-CO6 answered); merges after CO-1 (same file) | `feat/roster-revisit-folded` |
| CO-3 | Sonnet 5.5 | Finishing (roadmap README §5.1 step 6): "Amended YYYY-MM-DD by `AMENDMENTS-CLASS-CODE-OVERLAY.md` [CO]" lines in F-SPACE-001, `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md`, `AMENDMENTS-GROWNUP-UX.md`, F-CONSOLE-001 and F-VOC-005; a pointer in `design/wireframes/console/roster.md`; the `docs/specs/README.md` index line; status `shipped` | — | CO-1, CO-2 | `docs/class-code-overlay-amended` |

One commit = test + implementation (CLAUDE.md §5). A row that meets a decision this spec does not make stops and reports (roadmap README §3).

## 10. Owner decisions (open)

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| OD-CO1 | Does the fold of §3.7 also take the card's **"Words to revisit"** line (`VocabWordsParts.tsx:69-75`), which the work order did not name? | **Yes.** It names one learner's weak words the way the letters line names weak letters, and it shows for every full-scope learner (TV-D2). The counts line ("Words: 12 collected · 4 strong") stays in view, like the other progress lines. | CO-2 |
| OD-CO2 | Does every card with a summary get the What to revisit button, or only the cards that have something to revisit? | **Every card with a summary.** A button only on some cards tells the room who has something to revisit, which is the comparison this fold is for. The cost is one more control on a card with nothing; it opens to "Nothing to revisit yet.". | CO-2 |
| OD-CO3 | An **Open all** control on the roster? | **No.** It would bring the whole list back with one press, on the screen a room may see. The class view already exists without names: This week's "Jamo to revisit together" and the class report; one learner's full list is in See report. | CO-2 |
| OD-CO4 | Should Show the code also put the browser in **full screen** (the Fullscreen API, from the click)? | **No, the overlay only.** The overlay already covers the page and the frame. Full screen does not work on an iPhone, and the first Escape would leave full screen, not close the overlay, so Escape would mean two things. The browser's own full screen (F11, the green button) stays the teacher's choice. | CO-1 |
| OD-CO5 | Add one line for the room, **"Tap “Join a class” in Hangul Route and type this code."**, to the overlay? The work order lists only the class name, code, QR, expiry and close. | **Yes.** A learner who walks in late reads the screen, not the teacher's console, and the presenter's End slide already says the same thing next to the same code (`learner.presenter.slide.end.howToJoin`). With no answer, CO-1 builds the work order's list without it. | CO-1 |
| OD-CO6 | Fold more of the card (the practiced line, the stage segments and quests, the plan lines) for the same reason? | **Not now.** The teacher reads these lines every week and they are not weak points; the overlay is the projector path, and the fold is the second defence for the most sensitive lines. Look again after the first classes use the overlay. | CO-2 (only if yes) |

## 11. Review log

- 2026-11-23, revision 1 (row CO-0): written on `e72336a7d`. Citations of WO-30 re-read (§1.1): #1 and #3 true as written; #2 true with its block one line longer (`:685-691`), and a second per-learner weak-point line found at `:692` (OD-CO1). Found and designed for: the frame's email (`AdultFrame.tsx:562`), the self-opening re-link pop-up (`page.tsx:245-251`), the live-code-only roster (`spaces.ts:78-80`), the existing QR drawing (`JoinLinkParts.tsx:71-92`), the card's no-`<details>` test. Multi-agent review pending.
