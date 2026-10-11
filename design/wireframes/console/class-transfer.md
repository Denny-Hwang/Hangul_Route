# Console + App / Class moves — move a learner to another teacher's class (wireframe v2)

Spec: `docs/specs/F-SPACE-002-class-transfer.md` (drafted in `specs-out/F-SPACE-002-class-transfer.md`) · closest existing pattern: `design/wireframes/console/relink-approval.md` (one card per request, one primary CTA, quiet decline) · related: `console/space-settings.md` (learner rows), `console/roster.md` (chip), `console/home.md` (badge), `sync/join-space.md`, `profile/settings.md`
Code to extend: console `apps/web/src/app/teach/space/settings/page.tsx:139-152` (learner rows), `app/teach/space/page.tsx:136-138` (relink chip), `lib/console/routing.ts:9-12` (ROUTES); app `apps/mobile/src/components/SpacesCard.tsx:39-61`, `navigation/types.ts:5` (`GrownUpDestination`), `screens/parent/PinEntryScreen.tsx:100-113`
Audience: **teacher** (source and destination class), **parent / caregiver** (family space in the console), **learner or grown-up on the device** (app sheets). Shared surfaces say "learner", "class", "grown-up"; never "kid". Teacher surfaces use the singular member noun (student / learner / member). The user-facing word is **move** everywhere (internal name: transfer). Copy below is placeholder English; final wording goes through `COPY` (console) and `packages/i18n` (app). **The consent lines are different: they are one keyed list (`TRANSFER_CONSENT_LINES`, spec 4.11) and every sheet below renders the same line ids; this wireframe names ids, it does not paraphrase them.**

URL rule (owner, 2026-10-10): no learner name, nickname, initial, class name or teacher name in any URL, path, query, fragment or page title. Console routes carry the **space id** only; the learner and the request travel in request bodies and opaque ids (`transfer:<uuid>`) on API paths.

Style rule (CLAUDE.md section 4): design-system tokens only. Blocked and ended states use `colors.feedback.nudge` and `colors.text.muted`, never `colors.feedback.danger`; the Move button sits outside the settings Danger zone. Positive step ticks use a check-mark glyph plus text, never an X-like mark (`x` is only the close icon).

| Screen | URL | Notes |
|---|---|---|
| Start sheet (modal on settings) | `/teach/space/settings?id=<space id>` | no new URL; the learner id is in the POST body |
| Requests page (class or family) | `/teach/space/transfers?id=<space id>` | `ROUTES.spaceTransfers(id)`; also a permanent "Class moves" button on the roster pages |
| Family start (picker) | `/teach/space/transfers?id=<family space id>` | same page, family variant |

## Scenario (Given-When-Then)

Given: a learner is in teacher A's class; a parent (or A, or, when allowed, the learner) wants them in teacher B's class
When: one side starts a request with B's class code, and then each side that must agree says yes
Then: only when the learner side, A and B have all said yes **and two days have passed** does the move happen, in one step; before that nobody has lost or gained access, B has seen only initials, a picture and a level until the learner side said yes, and any caregiver or the learner's device can cancel

## Screen goal

"Move one learner from one class to another with everyone's yes, time to change their mind, and never leave them in no class."

## 1. Console / Start sheet — from class settings (teacher A)

```
+------------------------------------------------------------+
| Settings - Sunday Class A                                  |
|  ...                                                       |
|  Students                                                  |
|  +------------------------------------------------------+  |
|  | <Name>  joined 3 weeks ago                           |  |
|  |   [ Move to another class ]   [ Remove from class ]  |  |   <- new button; NOT inside the Danger zone
|  +------------------------------------------------------+  |
+------------------------------------------------------------+

   (sheet over the page; focus returns to the opener on close; Escape closes)
+------------------------------------------------------------+
| Move <Name> to another class                          [x]  |
|                                                            |
|  1. Ask the other teacher for their class code.            |
|     Class code [ ______ ]                  [ Find class ]  |   <- ONE field, box-like spacing, paste fills; same component as join
|                                                            |
|  2. (after Find class)  Move to "<Class name>"?            |   <- name from the server preview, never typed
|     - The family is asked first. The other teacher sees    |
|       only initials and a level until the family says yes. |
|     - Nothing changes until everyone has said yes, and     |
|       then not for 2 days.                                 |
|     - <Name> keeps cards and stars. You can cancel any     |
|       time before the move.                                |
|                                                            |
|                      [[ SEND REQUEST ]]       [ Cancel ]   |
+------------------------------------------------------------+
```

- One primary CTA. The class name in step 2 is read from the **preview** (`POST …/transfer-requests/preview`, writes nothing); the request is then created for that exact class (`destinationSpaceId`), and refused if the code no longer resolves to it.
- A teacher's preview shows the class name only. Errors under the field, calm: wrong code "That code didn't work."; expired "That code is too old. Ask for a new one."; full "That class is full right now."; already there "<Name> is already in that class."; limit "Too many tries. Try again later."; cannot send (family switched requests off, learner manages their own classes, or a recent refusal; **one neutral message, no reason**) "This request can't be sent right now."; no family account "A family account is needed to answer this. Ask the family to start the move from their app."
- `[ Move to another class ]` is hidden when the class is archived (settings stays readable, `spaces.ts:361-365`); disabled with "This needs internet." offline. On a **family** settings row the same slot shows `[ Move to a class ]` only for a learner who is in a live class (opens the family start flow, learner and class preselected). School rows never show it.

## 2. Console / Requests page — class space (A or B)

```
+------------------------------------------------------------+
| [< back to roster]   Class moves - Sunday Class A          |
|                                                            |
|  Leaving this class                                        |
|  +------------------------------------------------------+  |
|  | <Name>      asked 2 days ago - 12 days left          |  |
|  |  Family        (check) said yes                      |  |   <- three small steps with text, not a progress bar
|  |  This class    (check) you said yes                  |  |
|  |  New class     waiting                               |  |
|  |  "Nothing changes until all three say yes."          |  |
|  |                                [ Cancel request ]    |  |
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  | <Name>      asked by the family - 1 day ago          |  |
|  |  Family (check)   This class waiting   New class waiting |
|  |  "<Name>'s family asked to move to another class."   |  |   <- destination name only if the family chose to share it
|  |   [[ AGREE ]]                      [ Not now ]       |  |
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  | <Name>   Everyone agreed. The move happens Oct 14.   |  |   <- scheduled (the 2-day wait); Cancel stays
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  | A student moved to another class      Oct 3          |  |   <- terminal: date only, no name
|  | This request ended.                   Oct 1          |  |   <- ended: no actor, no reason, for every kind of ending
|  +------------------------------------------------------+  |
|                                                            |
|  Joining this class                                        |
|  +------------------------------------------------------+  |
|  | M. K.   [avatar]   Level: Some reading               |  |   <- initials via rosterAlias, ALWAYS, whatever this class's setting; no learner id; no summary
|  |  The family has said yes.                            |  |
|  |   [[ ACCEPT ]]                     [ Not now v ]     |  |
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  | M. K.   [avatar]                                     |  |
|  |  Everyone has said yes. This class is full right now.|  |   <- status `approved` + block reason; amber nudge tone, text + icon
|  |   [ Try again ]                                      |  |
|  +------------------------------------------------------+  |
|  After a move into this class:  [ New class code ]         |   <- offered once; the old code may be in other hands
|                                                            |
|  empty: "Nothing waiting."                                 |
+------------------------------------------------------------+
```

- A destination card exists only after the learner side said yes (T8). It shows **initials, picture and level label only**: never the full name, never the old class or teacher, never progress, plan ids or an email. If the family chose "Tell the new class where I am coming from", one extra line appears: "Coming from <Class name>." The full name (per this class's anonymize setting) appears only after the move.
- Source cards never show the destination teacher's name; the class name only when this class started the request or the family chose to share it.
- **No card ever says who said no.** Every ending (the family, the other teacher, this class, expiry) reads "This request ended." with a date. Only the party that decided sees their own choice in their own history.
- A teacher who owns or teaches **both** classes sees one card with `[[ AGREE FOR BOTH CLASSES ]]`; the family step is still separate. A school admin acting for a class fills one step per click and the cards of both classes then show "Agreed by the school admin."
- "Not now" opens a small menu with two quiet reasons **on the receiving class only**: "Not now" and "No room". Other cards have a plain "Not now" with no menu. No free text.
- Terminal cards stay 30 days; no names. Order is stable within a refresh: waiting for you first, then waiting for others, then finished; the page **re-sorts only on reload or when focus is outside a card**, and announces changes through one polite live region. Nothing auto-dismisses.
- Refresh every 30 s (nothing here is time-critical). No sound, no red. The `[ Cancel request ]` is plain text-weight.

## 3. Console / Family page — the guardian's inbox and consent (caregiver account)

```
+------------------------------------------------------------+
| [< back]   Class moves - <Family space name>               |
|                                                            |
|  Asked about your learners                                 |
|  +------------------------------------------------------+  |
|  | <Name> - Sunday Class A  ->  Saturday Class B        |  |
|  |  Asked by Sunday Class A's teacher - 1 day ago       |  |
|  |  Family waiting   Sunday Class A (check)   Saturday Class B waiting |
|  |   [[ REVIEW AND AGREE ]]           [ Not now ]       |  |
|  +------------------------------------------------------+  |
|  +------------------------------------------------------+  |
|  | <Name> - A move is planned for Oct 14                |  |   <- cooling-off: any caregiver can cancel
|  |   [ Cancel ]                                         |  |
|  +------------------------------------------------------+  |
|                                                            |
|  Start a move                                              |
|   Learner [ <Name> v ]  Now in [ Sunday Class A v ]        |   <- options: this family's own learners, their live classes
|   New class code [ ______ ]               [ Find class ]   |
|                                                            |
|  [ ] Do not accept move requests from teachers  ({Name})   |   <- per learner; teachers then see a neutral "can't be sent"
|  (if the learner manages their own classes:)               |
|  "<Name> manages their own classes. Ask them to start a    |
|   move on their device."                                   |
+------------------------------------------------------------+

   (consent sheet; same for "Review and agree" and after "Find class"; lines are ids from TRANSFER_CONSENT_LINES)
+------------------------------------------------------------+
| Move <Name> to Saturday Class B?          [ EN v ]    [x]  |   <- language switch en / ko / es; "Not available in your language yet." if a locale is not reviewed
|                                                            |
|  Summary (always visible)                                  |
|   moving         <Name> would move from A to B.            |
|   new_teacher    The teacher of B will see <Name>'s progress. |
|   old_teacher    The teacher of A stops seeing <Name> in that class when the move happens, not before. |
|                                                            |
|  Who is the new class? (from the server)                   |
|   Saturday Class B - teacher <Owner name> - <School name>  |
|   class is 3 months old - 8 learners                       |
|   typed_names    Class and teacher names are typed by the teacher. We do not check them. Only continue if you know this teacher. |
|   from_teacher   [only if a teacher started it] This request came from the teacher of A, not from you. |
|                                                            |
|  What the new teacher sees (open by default)     [ hide ]  |
|   visible_list   <items generated from the allow-list>     |
|   nothing_else   Nothing else from the app is shared with the teacher. |
|                                                            |
|  visible_today   Today these people can see <Name>:        |
|                  - Sunday Class A (teacher <Owner name>)   |
|                  - <Family space name> (you)               |
|                                                            |
|  Also (only the lines that apply, one short sentence each) |
|   premium_may_change   Lessons that were open through A's plan may close after the move. Lessons already finished stay. |
|   school_delete        The teacher of B will be able to delete <Name>'s record. |
|   device_relink        A tablet that joined through A may need to join B again. |
|   homework_drops       Homework from A that is not finished will go away. Finished homework stays. |
|   keeps                Cards, stars and finished lessons stay with <Name>. |
|   cooling_off          The move happens after 2 days. Anyone in the family can cancel before then. |
|   cannot_undo          A move can't be undone. <Name> can still leave a class in Profile at any time. |
|                                                            |
|  [ ] introduce   Tell B where <Name> is coming from  (optional, off) |
|                                                            |
|       [[ YES, MOVE <NAME> ]] (active after the end is reached or the list is opened)   [ Not now ] |
+------------------------------------------------------------+
```

- The sheet is the consent record: "Yes" sends the consent-text version, the **locale shown** and the ids of the lines shown. If the text version is no longer accepted the sheet reloads with the new text (never a silent accept).
- The primary button never sits above an unread conditional line; it is not the first focus target. Reading level: one idea per sentence, at most 16 words.
- No price, plan name, or "lifelong" promise anywhere. The premium line appears only when the server says the tier would differ.
- Only a signed-in owner or caregiver of a live family space with this learner, whose membership and the learner's are at least a day old and who holds no role in either class, can use this page's actions. A brand-new family sees "Moves open one day after a family is set up."; an account that is a teacher of either class sees "A teacher of this class can't answer for the family."
- Waiting state after Yes: "Waiting for the other classes. The move happens after Oct 14 if both say yes. You can cancel any time." (`[ Cancel ]`).
- If the terms change before the move (the new class changes its settings or name), the card returns to "Please check this again." and the sheet reloads; nothing moves in the meantime.

## 4. App / Classes card (Profile -> Settings) — learner or grown-up

The route is decided from the inbox **before** any tap, so no PIN is spent on a dead end. Four row variants:

```
(a) class-linked tablet (class scope)        (b) the family has an account
+--------------------------------------+     +--------------------------------------+
|  Sunday Class A            Class     |     |  Sunday Class A            Class     |
|                        [ Leave ]     |     |                        [ Leave ]     |
|  Use your grown-up's rescue code     |     |  Ask the grown-up with the account   |
|  first.                              |     |  to answer this in the console.      |
+--------------------------------------+     +--------------------------------------+

(c) this device can answer                   (d) nobody can answer yet
+--------------------------------------+     +--------------------------------------+
|  Sunday Class A            Class     |     |  Sunday Class A            Class     |
|                 [ Move ]   [ Leave ] |     |                        [ Leave ]     |
|  Asked: a move to Saturday Class B.  |     |  A grown-up needs to set up a PIN    |
|                       [ Review ]     |     |  first. Open Profile, then Grown-ups.|
+--------------------------------------+     |  [ Set up PIN ]                      |
                                             +--------------------------------------+
```

- No Move button on a class-scoped device (a) and in (b) and (d); no PIN screen before a dead end. `[ Move ]` / `[ Review ]` appear only in (c), through the grown-up gate on a managed device (new `GrownUpDestination`s `MoveClass` and `ApproveTransfer`) and directly on a self-only device with no PIN (`gateOpensDirectly`, `gate-route.ts:11-17`). `[ Set up PIN ]` opens `PinEntry` in `mode: 'setup'`; the device route becomes available 24 hours after the PIN is created.
- Nothing is shown at all while `transfersEnabled` is false in the inbox.
- Leave keeps its confirm dialog; a failure now shows "This needs internet." instead of nothing.
- A request a teacher started appears here **read-only**, with a quiet Decline inside the gated sheet; it can only be answered in the console.

## 5. App / Move a class (start) — PIN-gated, device route only

```
 Step 1                               Step 2 (consent sheet; the same line ids as screen 3)
+------------------------------+     +----------------------------------+
| Move to another class        |     | Move <Name> to Saturday Class B? |
|                              |     |                                  |
| Ask the new teacher for      |     |  moving / new_teacher /          |
| their class code.            |     |  old_teacher   (summary)         |
|  Class code [ ______ ]       |     |  [ What the new teacher sees v ] |
|  6 letters or numbers -      |     |  typed_names                     |
|  no O, I, 0 or 1             |     |  [lines that apply, one by one:  |
|                              |     |   premium / school_delete /      |
|     [[ FIND CLASS ]]         |     |   device_relink / homework]      |
+------------------------------+     |  cooling_off  cannot_undo        |
                                     |  [ ] introduce                   |
                                     |    [[ YES, MOVE ]]  [ Not now ]  |
                                     +----------------------------------+
```

- The app sheet may fold the list behind a disclosure for space; it renders **every id that applies, in the same order, with the same words** as the console, and sends the same version and locale. The button is active once the sheet has been scrolled to the end or the disclosure opened.
- Offered only when the inbox says this device may answer (variant (c) of screen 4). The PIN branch needs a PIN created at least a day ago (a legacy PIN counts as old enough); `self` attestation needs a self-managed profile with its consent timestamp.
- **Decline** and **Cancel** live inside this gated sheet and the console only; there is no un-gated button. A device decline never says "the family said no" to anyone.

## 6. App / A teacher started it (read-only)

```
+----------------------------------+
| A move is waiting                |
|                                  |
|  Sunday Class A asked about      |
|  moving <Name> to Saturday       |
|  Class B.                        |
|  A grown-up with an account      |
|  answers this in the console.    |
|                                  |
|            [ Not now ]           |   <- gated; ends the request quietly
+----------------------------------+
```

- A device can never consent for a request a teacher started (the server refuses with `caregiver_required_for_teacher_request`). It can decline or, during the 2 days, cancel.

## 7. App / Home line (only when this learner side needs to answer or a move is planned)

```
+------------------------------------------------------------+
| Sunday Class A asked about moving <Name> to Saturday Class B.   [ Review ] |   <- teacher-started
| A move to Saturday Class B is waiting.                          [ Review ] |   <- guardian-started
| A move is waiting for you.                                      [ Review ] |   <- self audience; the sheet button reads "Yes, move me"
| A move is planned for Oct 14.                                   [ Cancel ] |   <- cooling-off, any device of the learner
+------------------------------------------------------------+
```

- One calm line under the Hoya tip; no number, no timer, no red. Copy depends on who started the request and on the device audience, not one sentence for everyone.

## Interaction points

- **[[ SEND REQUEST ]] / [[ YES, MOVE ]]** -> creates the request with this side's consent in the same call; the sheet closes to "Request sent. Nothing changes until everyone says yes." with `[ View ]`. A lost response is safe to repeat: the same request comes back.
- **[[ AGREE ]] (teacher)** -> records that class's slot; when the last slot is in, the card shows "Everyone agreed. The move happens <date>." and the swap happens once that time has passed (the next time the page or the learner's app is opened).
- **[[ ACCEPT ]] (destination)** -> same; if the class has no room the card shows the full state and `[ Try again ]`.
- **[ Not now ]** -> request ends, quietly, for everyone, with no one named; the learner and family can still leave a class themselves; the same pair cannot be asked again for 7 days after a learner-side request is declined, and a teacher cannot start a new request for that learner for 30 days (the teacher sees only "can't be sent right now").
- **[ Cancel request ] / [ Cancel ]** -> ends the request; allowed for the starter, for any caregiver of the learner and for the learner's own device at any time before the move; there is no undo after the move (a new request moves back).
- **Move executes** -> destination teacher sees the learner (full name per their setting); source teacher no longer does; the app refreshes its classes, plans and lessons on the next inbox pull. A tablet linked through the old class says "Join your new class again."

## Navigation graph

Enter from: `console/space-settings` (Move on a class learner row; Move to a class on a family row) · `console/roster` ([ N class moves waiting ] chip, plus a permanent [ Class moves ] button on class and family rosters, shown with zero requests) · `console/home` (badge on the class, family or school row) · app `Profile -> Classes & family` (Move / Review) · app `Home` line
Exit to: `console/roster` · `console/home` · app `Profile`

## States

- **loading**: skeleton cards; no spinner text, no blame.
- **success**: cards in the three groups; steps tick as each side agrees; after the move the guardian and the learner see "Moved. <Name> is now in Saturday Class B. Cards and stars stayed with <Name>." plus the tablet line when relevant.
- **empty**: "Nothing waiting." (the page stays reachable from the permanent button and from a stale link).
- **waiting for others**: "Waiting for the other classes." plain text, no countdown shouting. On a teacher-started request with no family account route: "Waiting for the family." only (no "their app may need an update").
- **scheduled**: "Everyone agreed. The move happens <date>." with Cancel (any caregiver, the learner's device, the starter).
- **blocked (approved but no room)**: amber nudge tone, text + icon, "This class is full right now." + `[ Try again ]`; never red; contrast checked against the token. After 3 days blocked the family is asked again ("Please check this again.").
- **ended**: one quiet line, "This request ended." with a date; no actor, no reason, no names in history. The family may see "Ended from <Name>'s tablet." on their own side.
- **offline**: actions disabled with "This needs internet." Consent is never queued for later. The app never persists transfer rows, so an offline device never shows a stale answerable prompt.
- **error**: a failed action keeps the card and shows "Didn't go through" + `[ TRY AGAIN ]`; if the request ended meanwhile (`not_open` / `expired`) the card becomes the ended state (no silent success).
- **signed out (401)**: "Sign in again." and return to the same page.
- **role lost (403)**: "You can no longer answer this class's moves." (no names).
- **locked** (flag off, or the Worker answers `transfers_locked`): the Move button, chip and badge do not render; a stale link to the page shows "Class moves aren't available yet." with a link to the roster; the app rows do not render (the inbox says `transfersEnabled: false`).
- **not available in your language**: the consent sheet says "Not available in your language yet." and offers the language switch.
- **archived class**: the Move action is hidden; a request against an archived destination ends on the next read; if the source is archived after the family agreed, the request continues.

## Data needs

- reads: console `GET /api/spaces/:id/transfer-requests` (source, destination, family or school-count view; family also `options`); `POST …/transfer-requests/preview` (writes nothing); app inbox `transfers[]` plus `transfersEnabled`, `transferDeviceConsent`, `selfManaged`.
- writes: `POST …/transfer-requests`, `…/:tid/approve`, `…/decline`, `…/cancel`, `…/retry`; `PUT …/learners/:learnerId/transfer-prefs` (guardian) and `PUT /api/sync/learners/:id/transfer-prefs` (device); device `POST /api/sync/learners/:id/transfer-requests[/preview|/:tid/approve|decline|cancel]`.
- never stored client-side beyond the app's cached membership list; consoles keep nothing in storage; the app does not persist transfer rows.
- telemetry (app only, counts and codes only, **no profile id**): `space.transfer.requested`, `.consented`, `.declined`, `.cancelled`, `.completed`. Telemetry is not consent evidence.

## Accessibility

- Every card is a labelled region; the step ticks have text ("said yes", "waiting"), a check-mark glyph and an icon for blocked, not colour alone.
- Touch targets use the existing child-sized defaults; sheets trap focus, return it to the opener, close on `Escape`, and the primary button is not the first focus target in the consent sheet; the consent sheet is readable by a screen reader in the order written above.
- Card order does not change under the pointer; updates go through one polite live region; nothing dismisses on a timer.
- The class code is one labelled field ("Class code", autocomplete off, paste fills), the shipped component, not six inputs.
- Plain, short English (CEFR Pre-A1, at most 16 words a sentence); KO (합니다체 on the consent lines) and ES come with the catalogs and the counsel review; no emoji.

## Open questions

- Does the owner want the source teacher's "agree" to be notify-only (spec A3)?
- Is a PIN-gated or self-attested device approval acceptable as guardian consent (A4, flip gate G6, counsel)? Until yes, class-only learners cannot be moved by transfer.
- Should a school admin be able to agree for both teachers of an intra-school move (A6)? This wireframe shows one slot per admin click and a neutral "Agreed by the school admin" line.
- Is 14 days the right life for a weekly class, is 2 days the right cooling-off, and is a 30 s refresh enough without push (F-NOTIF-001 does not exist yet)?
- After a move, the student's tablet that was linked through the old class stops seeing class data until the new teacher approves a re-link (spec 4.6). Acceptable, or should the family's own full-scope device be the only path?
- Family-code and lookup-roster exposure (spec O-3, O-5): accept the documented gaps or change F-SPACE-001 / F-TCH-001?
