# Account (native): grown-up sign-in, AccountGate, the account card, the native homes, reports, the code panel and the plan block (design mocks v1, NS-0b)

Spec: `docs/specs/F-AUTH-004-native-sign-in.md` (sections 6.3 to 6.6, 7.1 to 7.4, 8.1 to 8.8, 9.1, 9.2, 10, 12, 14, 17). This is design row **NS-0b**: the agent design pass that CLAUDE.md section 5 requires before a component is built (no component without a mock, no mock without a wireframe), approved by multi-agent review on the owner decision of 2026-10-12 (F-SPACE-002 T-0b precedent, #472; AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-0b, #771 stack).
Wireframes: `design/wireframes/account/native-sign-in.md`, `native-lock.md`, `native-homes.md` (new in this pass).
Built by:
- **NS-3**: the sign-in screen and its step machine, the account card, Sign out → `sign-in.md`, `lock.md` (card, sheet).
- **NS-4**: the chooser and Welcome rows, `AccountGate` and its lock card, the typed-PIN entry, the covers → `entries.md`, `lock.md`.
- **NS-5**: the Family home, the code panel, the plan block, the states, the account learner report → `homes.md`, `account-reports.md`.
- **NS-6**: the Teacher and School homes, the class and school pages, the class report → `homes.md`, `account-reports.md`.

## What is here

| File | What it fixes |
|---|---|
| `sign-in.md` | the sign-in screen: every step of spec 6.3 (email, code, password, second step, device check, backup code, unsupported), every error line, waiting, offline |
| `entries.md` | the chooser's native Grown-ups rows (uses known, Grown-up account, Sign in, `nopin`, offline, an open device, switch off) and Welcome's row |
| `lock.md` | the typed PIN before an account screen, AccountGate's locked results, the Grown-up area account card (signed out, in, locked, unknown, offline), the Sign out ConfirmSheet, the covers |
| `homes.md` | the Family, Teacher and School homes, the class and school pages, the code panel, the plan block, every state of spec 8.8 |
| `account-reports.md` | the account learner report and class report: what is drawn as in-app, what is left out on native |
| `mock/account.css` | the sheet of this pass, linked after `../../app-shell/mock/app-shell.css` (tokens, board), `../../app-shell/mock/display-nav.css` (text size, ScreenHeader, ConfirmSheet) and `../../profiles/mock/profiles.css` (GrownUpRow, PinPad, `rn-btn` variants, board helpers) |
| `mock/sign-in.html` | boards 1 to 18 |
| `mock/entries.html` | boards 1 to 9 |
| `mock/lock.html` | boards 1 to 17 |
| `mock/homes.html` | boards 1 to 19 |
| `mock/plan-block.html` | boards 1 to 9, one per row of spec 8.5 |
| `mock/reports.html` | boards 1 to 3 |
| `mock/tablet.html` | boards 1 to 4 at 1180 (tablet landscape): Family home, Teacher home, the sign-in, the chooser rows |
| `mock/largest.html` | boards 1 to 6 at the Largest text size (`html.ts-largest`) |
| `mock/lengths.html` | the es and ko check: 32 rows, each state drawn in en, es and ko side by side (every sign-in step and error, every lock line, the card, the sheet, the rows, Welcome, every home and state, every plan line, both reports) |
| `shots/` | each mock in Chromium at 320 and 1280, and at 320 with the browser text size at 200 % (`-320-text200`), full page, 1x, stored as 128-colour palette PNGs (27 files, about 6.9 MB) |

**The mocks are a design reference, not shipped code.** These are react-native screens of the learner app (native builds only) drawn as HTML in rem, so the browser text size and the Display sheet's text size both reach them.

- **Tokens.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it. `account.css` copies the two tokens the other sheets do not carry (`colors.feedback.nudge`, `colors.feedback.info`) and redefines none (checked: every `var()` used resolves; no name defined twice). No colour literal in the HTML, no emoji, no motion. No new token and no new glyph: lock, chevron, arrow-left (Back and the PinPad delete key) and close are the shipped Icon glyphs; the covers use the shipped splash image.
- **Words.** Every drawn English string and every accessible name is a dictionary value of `packages/i18n` or a row of the spec's section 17, word for word; es and ko are the section 17 drafts and the shipped dictionary values. This pass adds **no** string row (decisions below reuse shipped keys). The mocks were made by a throw-away generator that is not committed (as for the profiles, reports, billing and console mocks); it reads the dictionary itself, so a reused value cannot drift from the shipped one.
- **Annotations.** Grey monospace labels are board notes. A dashed box stands for an unchanged part of a screen. A struck-through dashed box marks a control that exists elsewhere and is **not** drawn on native (for example Use face or fingerprint on the account PIN, Open Learning Route on the account report).
- **Fixture.** Sun Nov 8, 2026. The grown-up `dana@example.com` (an example domain) owns Kim family (Mina joined first, then Jun), is a caregiver in Grandma Park's family, owns Saturday class 3B, teaches Sunflower class, has an archived Spring 2026 class, administers Maple Heritage School and is a teacher member of Lakeside Korean School. Codes `K7MPQ4` (family) and `H3TRW9` (class) use the shipped alphabet. Names are examples; in the deny scan they are marked as typed by grown-ups (spec 9.2: not checked).

## Constants

| Where | Value | Derived from |
|---|---|---|
| Sign-in column (`acc-form`) | `layout.pane.master` (400) from `layout.breakpoint.regular`, full width below | one readable form column on a tablet (`tablet.html` board 3) |
| Code field width (`acc-code-field`) | 12rem | six mono digits at `size.prompt` with tracking and the field padding; in rem so it grows with the text size |
| Learner card minimum (`acc-card-min`) | 18rem | two cards across a tablet column, one on any phone up to Largest |
| Strip edge (`acc-strip-edge`) | 4 (`spacing.xs`) | the coloured edge of a strip, a second cue beside its words |
| Cover image (`acc-cover-img`) | 180 on a 360 board | `app.json` splash `resizeMode: contain` drawn at the board's scale (design board only) |
| Lengths column (`len-col`) | 21rem | design board only: en, es and ko side by side at 1280 |

Every other number (`touchTarget.min` 64, the PIN key 80, the phone and tablet board frames) is the profiles sheet's (`design/screens/profiles/README.md`, "Constants").

## Decisions taken in this design pass

- **D1. Continue waits for an @.** On the email step Continue is `aria-disabled` until the field holds an @ (board 1), so an empty submit never needs a new "enter your email" line; a malformed address goes to Clerk and comes back as `cantSignIn`.
- **D2. Waiting has no words of its own.** While Clerk answers, the step's submit button is `accessibilityState={{ disabled: true, busy: true }}` with the same label (board 3); no new "Signing in…" string.
- **D3. Offline wins over `nopin` on a chooser row.** A `nopin` account row offline is disabled with Needs the internet; the Grown-up area row just below still runs PIN setup offline (`entries.md`).
- **D4. A backup code is typed in a plain field.** After Use a backup code the field drops the number pad and the mono style (backup codes hold letters), keeps the second-step line and the visible label Code, and the Use a backup code button goes (board 15).
- **D5. Error lines are amber strips, never red.** Every line of spec 6.3 is one strip under its field (`feedback.nudgeLight`, a `feedback.nudge` edge, `text.primary` semibold 14.02:1), `role="alert"` and the field's description, with `aria-invalid` and an amber field border. `unsupported` is an info strip with only Use another email. Offline is a `surface.sunken` strip under the header. Spec 14's "no danger colour" holds on every account screen.
- **D6. A locked result is one card under a header titled with the use.** The ScreenHeader title is the label of the row the grown-up pressed (`learner.who.use.*`, or Grown-up account), as the PIN screen titles itself (OA-0b D8), so no new title string; the card holds the lock glyph, the line and the buttons, and nothing of the account.
- **D7. The account card** sits after Switch user and before People on this device. Signed out: the line and a paper **Sign in** (`caregiver.account.signIn.submit`). Signed in: the email line, the uses as the shipped GrownUpRow (lock glyph, chevron; each goes through AccountGate), the shared-device line, a paper **Sign out**. An account with no space shows no use row: a Grown-up account button would only open "This account has no family." (board 10). Gate `unknown`: `lock.cantCheck` with **Try again**. Never on `nopin` (the Grown-up area runs setup first). Spec 7.1 amended.
- **D8. Sign out is not red.** The ConfirmSheet has its title only, **Cancel** first and focused, **Sign out** as the primary fill. Spec 14 allowed the danger colour there; signing out loses nothing (the next sign-in restores everything), so the ConfirmSheet's no-red default stands and spec 14 now has no exception.
- **D9. The plan block is plain text in a sunken box.** No border, no chevron, `text.primary` semibold plan line, `text.secondary` usage line. In React Native it is one accessible element: `accessibilityLabel` = `a11y.account.planBlock`, `accessibilityValue.text` = the visible lines in order, never a button (a label alone on a container would hide the plan name from VoiceOver). Spec 8.5 amended.
- **D10. The learner card's words are named.** Spec 8.2's "the console's words" are `console.space.learner.lastActive(describeRelativeDay(…))` ("Last active today", es "Última actividad: hoy", ko "마지막 활동: 오늘") and `console.parentHome.lastActive.notStarted` for a learner with no activity, then `console.parentHome.minutes7d(n)`. No avatar or chip (the server has no device avatar). Spec 8.2 amended.
- **D11. The code panel.** The code in `family.mono` at `size.display`, drawn in two groups of three that never break inside a group and wrap at the space between; if one group still does not fit, the text steps down (`adjustsFontSizeToFit`, `minimumFontScale` body / display) and never below `size.body` (spec 14). The accessible text is `a11y.account.joinCode(code)` with the six characters; the drawn groups are hidden. Copy and Join on this device are paper buttons side by side that wrap; Copied is a polite status for about 2 seconds; a refused copy is an info strip under the code. A manager with no live code sees the label and **Make a code** only.
- **D12. The covers draw the app's own splash.** Both the iOS native cover and the JS cover show `app.json`'s splash (image on `splash.backgroundColor`, which is `surface.canvas`), the same picture the system shows at launch, with no text of ours, hidden from assistive tech. Spec 7.4 amended.
- **D13. Titles and rows of the homes.** A home is titled with its use's label (Family, Teacher, School, Grown-up account); a class or school page with the space's name. A class row is one pressable top (name, count, attention line, chevron) with **Class report** as its own button under it (no pressable inside a pressable). The class page repeats **Class report** at its top, since on a phone a teacher enters the class first. Spec 8.3 amended.
- **D14. The account learner report leaves out the free-end line.** `report.insight.free_days_done` ("Mina finished the free lessons.") is not shown on native for any viewer: on a build where nothing can be bought, a line saying the free part is over is an indirect pointer to buying elsewhere (App Review 3.1.1, ND-8's reasoning). Also left out: "Now on" and Open Learning Route, line actions, Preview lessons, skills rows; on the class report Send a note, Print, Plan a lesson and the homework plan link. The deny list gains `free lessons`, `lecciones gratuitas`, `무료 레슨`. Spec 8.7 and 9.2 amended.
- **D15. The deny list's card words become payment-card phrases.** The account reports reuse `report.*`, which counts heritage cards in every language (`report.figure.cards` "New cards" / "Tarjetas nuevas" / "새 카드", `report.detail.totals` "…, 1 card", `report.insight.cards_new` "1 new heritage card collected." / "1 tarjeta nueva del patrimonio.", `report.class.cardsNew`). Spec 9.2's `card` (en, singular), `tarjeta` (es) and `카드` (ko, substring) would fail those, and its note "the account screens never show heritage cards" was not true. They are replaced by `credit card`, `debit card`, `gift card`, `card number`, `add a card`; `tarjeta de crédito`, `tarjeta de débito`, `tarjeta regalo`, `número de tarjeta`; `신용카드`, `체크카드`, `기프트 카드`, `카드 번호`, `카드 결제`, `카드 등록`. `pay`, `payment`, `billing` and their es and ko words stay. Spec 9.2 amended.
- **D16. Button keys land as `{ cta }` objects.** The rows marked (cta) in spec 17.1 and 17.3 (`signIn.submit`, `.resend`, `.usePassword`, `.useCode`, `.useBackup`, `.changeEmail`, `home.joinHere`, `home.makeCode`) land as `caregiver.account.signIn.submit.cta` and so on, as `console.lock.signInAgain.cta` does, so `length-budget.test.ts` holds them to 28 characters. Spec 17 amended.
- **D17. The typed-PIN entry is the shipped PinEntry** titled with the row label, with no face or fingerprint button; Forgot PIN? stays (the Rescue Code and the 24-hour wait are local; the Sign in to the account reset card stays hidden on native, OA-0b D11).
- **D18. The home end.** A `border.subtle` rule, the quiet line, then Sign out, on every home and on no other account screen; `unavailable` (`403 native_off`) keeps only Back.
- **D19. Korean wraps at spaces** (`:lang(ko) { word-break: keep-all }`), as the builds do (`packages/design-system/src/line-break.ts`).

## Spec amendments in this PR

`docs/specs/F-AUTH-004-native-sign-in.md`: 6.3 (D1, D2, D4, D5), 7.1 (D3, D7), 7.2 (D6), 7.4 (D12), 8.2 (D10, D11), 8.3 (D13), 8.5 (D9), 8.7 (D14), 9.2 (D14, D15), 14 (D8), 17 (D16), the header's wireframes line, the review log. No `packages/i18n` file changes, so the review ledger is untouched; NS-3, NS-5 and NS-6 land the section 17 rows and sign their own ledger entries.

## es and ko lengths

Character counts of the section 17 drafts (placeholders as `{email}`, `{n}`, `{code}`). Every row is drawn in en, es and ko on `lengths.html` at 320 and at 320 with 200 % text: nothing truncates or overflows, every line wraps inside its strip, card or button, and every control keeps at least 64 px.

| Key | en | es | ko | Where |
|---|---|---|---|---|
| `signIn.title` | 16 | 17 (106 %) | 6 | header title |
| `signIn.intro` | 66 | 61 (92 %) | 29 | intro |
| `signIn.noNewAccounts` | 44 | 42 (95 %) | 24 | quiet line |
| `signIn.codeSent(email)` | 34 | 42 (124 %) | 21 | step line |
| `signIn.deviceCheck` | 40 | 49 (123 %) | 17 | step line |
| `signIn.secondStep` | 45 | 47 (104 %) | 22 | step line |
| `signIn.resend` (cta) | 15 | 18 (120 %) | 8 | button |
| `signIn.usePassword` (cta) | 15 | 18 (120 %) | 8 | button |
| `signIn.useCode` (cta) | 15 | 18 (120 %) | 10 | button |
| `signIn.useBackup` (cta) | 17 | 23 (135 %) | 8 | button |
| `signIn.changeEmail` (cta) | 17 | 16 (94 %) | 9 | quiet button |
| `errors.wrongCode` | 46 | 54 (117 %) | 26 | strip |
| `errors.wrongPassword` | 52 | 56 (108 %) | 31 | strip |
| `errors.tooMany` | 51 | 55 (108 %) | 29 | strip |
| `errors.unsupported` | 56 | 61 (109 %) | 28 | strip |
| `errors.generic` | 47 | 52 (111 %) | 31 | strip |
| `lock.cantCheck` | 57 | 70 (123 %) | 36 | lock card, account card |
| `lock.retrustPassword` | 84 | 81 (96 %) | 44 | lock card |
| `card.signedOut` | 52 | 56 (108 %) | 29 | account card |
| `signOut.ask` | 40 | 42 (105 %) | 21 | sheet title |
| `home.moreTools` | 39 | 53 (136 %) | 22 | quiet line |
| `home.joinHere` (cta) | 19 | 26 (137 %) | 11 | button beside Copy |
| `home.codeLabel.family` | 11 | 15 (136 %) | 5 | panel label |
| `home.retrustNotice` | 121 | 122 (101 %) | 60 | strip |
| `home.offline` | 46 | 47 (102 %) | 26 | state box |
| `a11y.account.codeField` | 22 | 27 (123 %) | 11 | accessible name |
| `a11y.account.joinCode(code)` | 30 | 38 (127 %) | 21 | accessible text |

The longest relative growth is es `home.joinHere` (137 %) and `home.moreTools` (136 %): the button wraps under Copy at 320 and the quiet line takes two lines. The longest absolute line is es `home.retrustNotice` (122): five lines at 320 inside its strip. Reused values drawn beside them in their shipped es and ko: `console.lock.pinRenew` (es 90), `console.lock.pinChanged` (es 82), `console.parentHome.askOwner` (es 57), `console.billing.coverage.schoolUntil` (es "Con la licencia de Maple Heritage School hasta el 30 jun 2027").

### Length budget (F-I18N-001 section 3.11, `length-budget.test.ts`)

Every section 17 row fits: each (cta) row is at most 26 characters in every language (D16 makes the test see them), and every es value is within max(8, ceil(1.5 x en)) (checked with the placeholders above; the tightest is `codeLabel.class`, 15 of 15). No `ES_LENGTH_ALLOW_LIST` entry is needed.

## Measured on the mock (Chromium)

- No sideways scroll on any of the 27 renders (nine mocks at 320, 1280, and 320 with 200 % text); no element wider than its board; no duplicate id; no dangling `aria-labelledby`, `aria-describedby` or `for`; no console error or failed request. No button, field or tab under 64 px tall (PIN keys 80).
- **Deny scan** (spec 9.2 as amended by D14 and D15): the text and every `aria-label`, `alt`, `title` and `value` inside each board, board notes and fixture names removed, in the board's language, en words and es words bounded by letters (es stems `suscrib`, `renov`, `gestion` bounded at the start only), ko as substrings, plus the symbols `$`, `€`, `£`, `₩`, `USD`, `hangulroute.com`, `http` and a digit before 원: **no hit** on any board in en, es or ko, the plan-block lines and both reports included. With spec 9.2's earlier card words the report boards fail in all three languages (`New cards` / `Tarjetas nuevas` / `새 카드` and the singular "1 card"), which is D15's reason.
- Contrast from the token values: `text.primary` on `feedback.nudgeLight` 14.02 (error strips), on `feedback.infoLight` 12.69 (notices), on `surface.sunken` 13.58 (plan block, offline strip); `text.secondary` on paper 8.44, on canvas 7.97, on sunken 7.12 (usage line, quiet line, card facts); `text.muted` on sunken 5.07 (disabled labels); `text.onPrimary` on `brand.primary` 5.44; field border `border.shape` on paper 4.55; `border.focus` on canvas 4.06.
- Fit at Largest and at 320 with 200 % text: the code's groups stay whole (`K7M` / `PQ4` on two lines at 300 %), names wrap, every button wraps its words.

**Outside this pass (pre-existing, left to the owner):** Welcome's title in Korean ("안녕하세요! 저는 호야예요.") does not fit a 320 window at a 200 % root with `keep-all`, so `entries.html` draws Welcome's top as unchanged. It is the shipped Welcome, not built by F-AUTH-004.

## Review

Author pass (design, accessibility, anti-shame, child safety, privacy, store policy, copy, against sections 6 to 10, 14, 17 and the wireframes), done before the PR; each finding is fixed in this PR:

- Spec conflicts found and settled here: the deny list's card words against the reports' heritage cards (D15); the reports' free-end line on a build with no purchase (D14); the plan block's accessible label hiding the plan name (D9); the learner card's unnamed words (D10); the (cta) rows not reaching the length test (D16).
- Fit: the code groups first rode one unbreakable span and overflowed at 320 with 200 % text; each group is now its own unbreakable box and the two wrap. The lengths board first put ko under en and es at 1280; three columns now.
- Child safety and privacy: no email, name or account data on a lock card, a chooser row or Welcome (CS-N9); the email only on the code step and the signed-in card, both inside the stack and past the gate; no face or fingerprint on the account PIN (CS-N11); the covers carry no content (CS-N12); `nopin` rows never open the account (ND-7).
- Store policy: no buy, price, renewal, manage, billing, receipt or web wording and no link on any board, in three languages (deny scan above); no sign-up and no word about where accounts are made (CS-N10); no "yet", "soon" or "coming" in any section 17 row (reused learner-state lines such as `console.parentHome.empty.title` describe a learner, not the app).
- Anti-shame: every list in join or creation order; no ranking, no progress on a row, minutes shown per learner only on that learner's card; no red on any account screen.

Independent multi-agent review (CLAUDE.md section 5): recorded below after the reviewers' rounds.
