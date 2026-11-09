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
| `shots/` | each mock in Chromium at 320 and 1280, and at 320 with the browser text size at 200 % (`-320-text200`), full page, 1x, stored as 128-colour palette PNGs (27 files, about 9.5 MB) |

**The mocks are a design reference, not shipped code.** These are react-native screens of the learner app (native builds only) drawn as HTML in rem, so the browser text size and the Display sheet's text size both reach them.

- **Tokens.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it. `account.css` copies the two tokens the other sheets do not carry (`colors.feedback.nudge`, `colors.feedback.info`; both only as a strip's edge beside its words) and redefines none (checked: every `var()` used resolves; no name defined twice). No colour literal in the HTML, no emoji, no motion. No new token and no new glyph: lock, chevron, arrow-left (Back and the PinPad delete key) and close are the shipped Icon glyphs; the covers use the shipped splash image.
- **Words.** Every drawn English string and every accessible name is a dictionary value of `packages/i18n` or a row of the spec's section 17, word for word; es and ko are the section 17 drafts and the shipped dictionary values. This pass adds **no** string row (decisions below reuse shipped keys). The mocks were made by a throw-away generator that is not committed (as for the profiles, reports, billing and console mocks); it reads the dictionary itself, so a reused value cannot drift from the shipped one.
- **Annotations.** Grey monospace labels are board notes. A dashed box stands for an unchanged part of a screen. A struck-through dashed box marks a control that exists elsewhere and is **not** drawn on native (for example Use face or fingerprint on the account PIN, Open Learning Route on the account report).
- **Fixture.** Sun Nov 8, 2026. The grown-up `dana@example.com` (an example domain) owns Kim family (Mina joined first, then Jun), is a caregiver in Grandma Park's family, owns Saturday class 3B, teaches Sunflower class, has an archived Spring 2026 class, administers Maple Heritage School and is a teacher member of Lakeside Korean School. Codes `K7MPQ4` (family) and `H3TRW9` (class) use the shipped alphabet. Names are examples; in the deny scan they are marked as typed by grown-ups (spec 9.2: not checked).

## Constants

| Where | Value | Derived from |
|---|---|---|
| Sign-in column (`acc-form`) | `layout.pane.master` (400) from `layout.breakpoint.regular`, full width below | one readable form column on a tablet (`tablet.html` board 3) |
| Code field width (`acc-code-field`) | 12rem | six mono digits at `size.prompt` with tracking and the field padding; in rem so it grows with the text size |
| Learner card minimum (`acc-card-min`) | 18rem | two cards across a tablet column, one on any phone up to Largest |
| Strip edge (`acc-strip-edge`) | `spacing.xs` | the coloured edge of a strip, a second cue beside its words |
| Report figure tile minimum (`rp-fig-min`) | 7rem | the reports' own constant (`design/screens/reports/README.md`, "Figure tile minimum") |
| Cover image (`acc-cover-img`) | 180 on a 360 board | `app.json` splash `resizeMode: contain` drawn at the board's scale (design board only) |
| Lengths column (`len-col`) | 21rem | design board only: en, es and ko side by side at 1280 |

Every other number (`touchTarget.min` 64, the PIN key 80, the phone and tablet board frames) is the profiles sheet's (`design/screens/profiles/README.md`, "Constants").

## Decisions taken in this design pass

- **D1. Continue waits for an @.** On the email step Continue is `aria-disabled` until the field holds an @ (board 1), so an empty submit never needs a new "enter your email" line; a malformed address goes to Clerk and comes back as `cantSignIn`.
- **D2. Waiting has no words of its own; offline disables only what calls Clerk.** While Clerk answers, the step's submit button is `accessibilityState={{ disabled: true, busy: true }}` with the same label (board 3), and every other button but Back waits too; no new "Signing in…" string. Offline, the buttons that call Clerk are disabled (Continue, Sign in, Send a new code, Email me a code) and the ones that only change the step stay enabled (Use my password, Use a backup code, Use another email) (boards 17, 18). Spec 6.3 amended.
- **D3. Offline wins over `nopin` on a chooser row.** A `nopin` account row offline is disabled with Needs the internet; the Grown-up area row just below still runs PIN setup offline (`entries.md`).
- **D4. A backup code is typed in a plain field.** After Use a backup code the field drops the number pad, the one-time-code autofill and the mono style (backup codes hold letters), keeps the second-step line and the visible label Code, which is now also its accessible name ("Sign-in code, 6 digits" would be false), and the Use a backup code button goes (board 15). **Send a new code** shows on the second step only when its code was sent (the device check, an emailed or texted second step) and calls `prepareSecondFactor` again (boards 14, 18). Spec 6.3 amended.
- **D5. Error lines are amber strips, never red.** Every line of spec 6.3 is one strip under its field (`feedback.nudgeLight`, a `feedback.nudge` edge, `text.primary` semibold 14.02:1), `role="alert"` and the field's description, with `aria-invalid`; the field's own border stays `border.shape` (4.55:1) and thickens to `borderWidth.thick` (an amber border would be 1.86:1, under WCAG 1.4.11). `unsupported` is an info strip with only Use another email. Offline is a `surface.sunken` strip under the header. Spec 14's "no danger colour" holds on every account screen.
- **D6. A locked result is one card under a header titled with the use.** The ScreenHeader title is the label of the row the grown-up pressed (`learner.who.use.*`), as the PIN screen titles itself (OA-0b D8), so no new title string; an entry with no use (the card's Sign in, SignIn without `use`) is titled **Grown-up account** on the PIN screen, the lock and SignIn's PIN step. The card holds the lock glyph, the line and the buttons, and nothing of the account.
- **D7. The account card** sits after Switch user and before People on this device. Signed out: the line and a paper **Sign in** (`caregiver.account.signIn.submit.cta`). Signed in with the trust matching the epoch: the uses as the shipped GrownUpRow (lock glyph, chevron), the shared-device line and a paper **Sign out**; the **email line** only with a fresh proof as well (a PIN typed, or a native sign-in, within 2 minutes; board 9), so a Grown-up area opened with face or fingerprint, or a PIN older than 2 minutes, never shows the email (board 10; CS-N9). Every card button that opens an account screen or signs in (Sign in, a use row, Sign in again on a locked card) goes through AccountGate and so asks the typed PIN first without a fresh proof; Sign out, which only deletes, does not. An account with no space shows no use row (board 12b): a Grown-up account button would only open "This account has no family space." and the card already has Sign out; the chooser keeps its Grown-up account row because from the chooser that home is the way to Sign out. Gate `unknown`: `lock.cantCheck` with **Try again**. Never on `nopin` (the Grown-up area runs setup first). On an `open` device the signed-in card's rows come from this run's in-memory spaces query (no record is kept). The card decides on mount, focus and return to `active`, as AccountGate does (no timer). Spec 7.1 and CS-N9 amended.
- **D8. Sign out is not red.** The ConfirmSheet has its title only, **Cancel** first and focused, **Sign out** as the primary fill. Spec 14 allowed the danger colour there; signing out loses nothing (the next sign-in restores everything), so the ConfirmSheet's no-red default stands and spec 14 now has no exception.
- **D9. The plan block is plain text in a sunken box.** No border, no chevron, `text.primary` semibold plan line, `text.secondary` usage line. In React Native it is one accessible element: `accessibilityLabel` = `a11y.account.planBlock`, `accessibilityValue.text` = the visible lines in order, never a button (a label alone on a container would hide the plan name from VoiceOver). NS-5 checks that TalkBack reads the value of a non-adjustable element; if it does not, the block stays ungrouped on Android and its two lines are read in order (the plan name speaks for itself). Spec 8.5 amended.
- **D10. The learner card's words are named.** Spec 8.2's "the console's words" are `console.space.learner.lastActive(describeRelativeDay(…))` ("Last active today", es "Última actividad: hoy", ko "마지막 활동: 오늘") and `console.parentHome.lastActive.notStarted` for a learner with no activity, then `console.parentHome.minutes7d(n)`. No avatar or chip (the server has no device avatar). Spec 8.2 amended.
- **D11. The code panel.** The code in `family.mono` at `size.display`, drawn in two groups of three that never break inside a group and wrap at the space between; if one group still does not fit, the text steps down (`adjustsFontSizeToFit`, `minimumFontScale` body / display) and never below `size.body` (spec 14). The accessible text is `a11y.account.joinCode(code)` with the six characters passed spaced (`K 7 M P Q 4`) so they are spelled out; the drawn groups are hidden. In React Native the groups are two `Text` elements in a wrapping row; `minimumFontScale` is iOS only, so the size floor is computed from the measured width on both platforms; Copied is announced with `announceForAccessibility` on iOS and `accessibilityLiveRegion="polite"` on Android. Copy and Join on this device are paper buttons side by side that wrap; Copied is a polite status for about 2 seconds; a refused copy is an info strip under the code. A manager with no live code sees the label and **Make a code** only (the shipped `console.confirm.issueCode`, not a new row).
- **D12. The covers draw the app's own splash.** Both the iOS native cover and the JS cover show `app.json`'s splash (image on `splash.backgroundColor`, which is `surface.canvas`), the same picture the system shows at launch, hidden from assistive tech. The image carries the app name and the English tagline "Korean, played not taught." in every UI language, as the launch screen already does (accepted by the review); it holds no account content. Spec 7.4 amended.
- **D13. Titles and rows of the homes.** A home is titled with its use's label (Family, Teacher, School, Grown-up account); a class or school page with the space's name. A class row is one pressable top (name, count, attention line, chevron) with **Class report** as its own button under it (no pressable inside a pressable). The class page repeats **Class report** at its top, since on a phone a teacher enters the class first. Spec 8.3 amended.
- **D14. The account learner report leaves out the free-end line.** `report.insight.free_days_done` ("Mina finished the free lessons.") is not shown on native for any viewer: on a build where nothing can be bought, a line saying the free part is over is an indirect pointer to buying elsewhere (App Review 3.1.1, ND-8's reasoning). Also left out: "Now on" and Open Learning Route, line actions, Preview lessons, skills rows; on the class report Send a note, Print, Plan a lesson and the homework plan link. The deny list gains `free lessons`, `lecciones gratuitas`, `무료레슨`. The filter lives in the account report's wrapper (it drops the P4 line whose code is `free_days_done`), not in the shared `report-blocks.tsx`, so the in-app report is unchanged. **Left to the owner:** the same reasoning applies to the shipped native in-app report, which still shows that line (`apps/mobile/src/logic/reports/report-view.ts`); it is outside this spec (a follow-up under F-BILL-002 section 4.8). Spec 8.7 and 9.2 amended.
- **D15. The deny list's card words become payment-card phrases.** The account reports reuse `report.*`, which counts heritage cards in every language (`report.figure.cards` "New cards" / "Tarjetas nuevas" / "새 카드", `report.detail.totals` "…, 1 card", `report.insight.cards_new` "1 new heritage card collected." / "1 tarjeta nueva del patrimonio.", `report.class.cardsNew`). Spec 9.2's `card` (en, singular), `tarjeta` (es) and `카드` (ko, substring) would fail those, and its note "the account screens never show heritage cards" was not true. They are replaced by `credit card`, `debit card`, `gift card`, `prepaid card`, `card number`, `card details`, `card on file`, `add a card`, `update your card`, `declined`; `tarjeta de crédito`, `tarjeta de débito`, `tarjeta regalo`, `tarjeta de regalo`, `tarjeta prepago`, `número de tarjeta`, `datos de la tarjeta`, `agregar una tarjeta`, `añadir una tarjeta`; `신용카드`, `체크카드`, `기프트카드`, `선불카드`, `카드번호`, `카드결제`, `카드등록`, `카드변경`, `상품권` (not `카드 정보`: the shipped heritage-card detail pane says it). `pay`, `payment`, `billing` and their es and ko words stay. The matcher takes an optional plural (`s`, `es`) on every en and es word of a phrase and compares Korean with every space removed, so "credit cards", "tarjetas de crédito", "pagos", "신용 카드" and "카드 번호" match too. Spec 9.2 amended.
- **D16. Button keys land as `{ cta }` objects.** The rows marked (cta) in spec 17.1 and 17.3 (`signIn.submit`, `.resend`, `.usePassword`, `.useCode`, `.useBackup`, `.changeEmail`, `home.joinHere`) land as `caregiver.account.signIn.submit.cta` and so on, as `console.lock.signInAgain.cta` does, so `length-budget.test.ts` holds them to 28 characters. Spec 17 amended.
- **D17. The typed-PIN entry is the shipped PinEntry** titled with the row label, with no face or fingerprint button; Forgot PIN? stays (the Rescue Code and the 24-hour wait are local; the Sign in to the account reset card stays hidden on native, OA-0b D11).
- **D18. The home end.** A `border.subtle` rule, the quiet line, then Sign out, on every home and on no other account screen; `unavailable` (`403 native_off`) keeps only Back.
- **D19. Korean wraps at spaces** (`:lang(ko) { word-break: keep-all }`), as iOS does (`lineBreakStrategyIOS: 'hangul-word'`, `packages/design-system/src/line-break.ts`). Android in React Native 0.76 keeps per-syllable breaks (the fallback F-I18N-001 section 10 (5) accepts), so on Android a Korean line may break inside a word but never overflows; the mocks show the iOS wrap.
- **D20. The plan block never draws a date or a free cap.** School coverage is always `console.billing.coverage.school(name)` on native: with `expiresAt` the line would carry a date, and for a school's own admin (the fixture's Maple Heritage School) it is the contract's end, the date to act on that ND-8 rules out by another route. A free plan (and own `expired`) shows its name only, never the usage line: "3 of 3 learners" on a free plan, on a build where nothing can be bought, reads as a limit to lift elsewhere (D14's reasoning). `nativePlanLines` never returns a date (a unit test in NS-2). ND-8 and spec 8.5 amended (`plan-block.html` boards 2, 6, 7).
- **D21. A pending re-trust asks for the password first.** While a re-trust is pending (a trust record for another epoch, or `account:pinResetByWait`), Continue on the email step goes to the password step first when the account has a password, so Sign in again from the lock (board 7) never sends a code that cannot re-trust; Email me a code stays offered. Spec 7.3 amended.
- **D22. GrownUpRow on native.** The shipped component spec (`design/components/GrownUpRow/spec.md`) gains an [NS-0b] note: the `use` type gains `'account'` (label `caregiver.account.card.title`), and the disabled offline state applies on native too (NS-4).

## Spec amendments in this PR

`docs/specs/F-AUTH-004-native-sign-in.md`: ND-8 (D20), 6.3 (D1, D2, D4, D5), 7.1 (D3, D6, D7), 7.2 (D6), 7.3 (D21), 7.4 (D12), 8.2 (D10, D11, the Back note), 8.3 (D13, the attention line), 8.5 (D9, D20), 8.7 (D14), 9.1 (D20), 9.2 (D14, D15), 10 (CS-N9), 14 (D8, D11), 17 (D16 and the review's es and ko values; `home.makeCode` replaced by the shipped `console.confirm.issueCode`), the header's wireframes line, the review log. `design/components/GrownUpRow/spec.md` (D22). No `packages/i18n` file changes, so the review ledger is untouched; NS-3, NS-5 and NS-6 land the section 17 rows and sign their own ledger entries.

## es and ko lengths

Character counts of the section 17 drafts (placeholders as `{email}`, `{n}`, `{code}`). Every row is drawn in en, es and ko on `lengths.html` at 320 and at 320 with 200 % text: nothing truncates or overflows, every line wraps inside its strip, card or button, and every control keeps at least 64 px.

| Key | en | es | ko | Where |
|---|---|---|---|---|
| `signIn.title` | 16 | 19 (119 %) | 6 | header title |
| `signIn.intro` | 66 | 69 (105 %) | 32 | intro |
| `signIn.noNewAccounts` | 44 | 42 (95 %) | 24 | quiet line |
| `signIn.codeSent(email)` | 34 | 42 (124 %) | 21 | step line |
| `signIn.deviceCheck` | 40 | 60 (150 %) | 17 | step line |
| `signIn.secondStep` | 45 | 47 (104 %) | 19 | step line |
| `signIn.resend` (cta) | 15 | 18 (120 %) | 8 | button |
| `signIn.usePassword` (cta) | 15 | 18 (120 %) | 9 | button |
| `signIn.useCode` (cta) | 15 | 18 (120 %) | 10 | button |
| `signIn.useBackup` (cta) | 17 | 23 (135 %) | 10 | button |
| `signIn.changeEmail` (cta) | 17 | 16 (94 %) | 11 | quiet button |
| `errors.wrongCode` | 46 | 54 (117 %) | 26 | strip |
| `errors.wrongPassword` | 50 | 57 (114 %) | 28 | strip |
| `errors.tooMany` | 51 | 55 (108 %) | 29 | strip |
| `errors.unsupported` | 56 | 61 (109 %) | 28 | strip |
| `errors.generic` | 47 | 60 (128 %) | 31 | strip |
| `lock.cantCheck` | 57 | 71 (125 %) | 36 | lock card, account card |
| `lock.retrustPassword` | 84 | 89 (106 %) | 47 | lock card |
| `card.signedOut` | 52 | 64 (123 %) | 29 | account card |
| `signOut.ask` | 40 | 42 (105 %) | 21 | sheet title |
| `home.noFamily` | 33 | 38 (115 %) | 18 | home line |
| `home.noClass` | 26 | 35 (135 %) | 14 | home line |
| `home.moreTools` | 39 | 53 (136 %) | 22 | quiet line |
| `home.joinHere` (cta) | 19 | 26 (137 %) | 11 | button beside Copy |
| `home.codeLabel.class` | 10 | 15 (150 %) | 4 | panel label |
| `home.retrustNotice` | 121 | 122 (101 %) | 61 | strip |
| `home.offline` | 46 | 47 (102 %) | 26 | state box |
| `a11y.account.codeField` | 22 | 27 (123 %) | 11 | accessible name |
| `a11y.account.joinCode(code)` | 30 | 38 (127 %) | 24 | accessible text |

The longest relative growth is es `signIn.deviceCheck` and `home.codeLabel.class` (150 %, exactly at the budget) and `home.joinHere` (137 %): the line takes three lines at 320, the label one, and the button wraps under Copy. The longest absolute line is es `home.retrustNotice` (122): five lines at 320 inside its strip. Reused values drawn beside them in their shipped es and ko: `console.lock.pinRenew` (es 90), `console.lock.pinChanged` (es 82), `console.parentHome.askOwner` (es 57), `console.confirm.issueCode` (es 15).

### Length budget (F-I18N-001 section 3.11, `length-budget.test.ts`)

Every section 17 row fits, after the review's es and ko values: each (cta) row is at most 26 characters in every language (D16 makes the test see them), and every es value is within max(8, ceil(1.5 x en)) (checked with the placeholders above; the tightest are `signIn.deviceCheck`, 60 of 60, and `codeLabel.class`, 15 of 15). No `ES_LENGTH_ALLOW_LIST` entry is needed.

## Measured on the mock (Chromium)

- No sideways scroll on any of the 27 renders (nine mocks at 320, 1280, and 320 with 200 % text); no element wider than its board; no duplicate id; no dangling `aria-labelledby`, `aria-describedby` or `for`; no console error or failed request. No button, field or tab under 64 px tall (PIN keys 80).
- **Deny scan** (spec 9.2 as amended by D14, D15 and the review): the text and every `aria-label`, `alt`, `title` and `value` inside each board, board notes and fixture names removed, in the board's language; en and es words bounded by letters with an optional plural ending (es stems `suscrib`, `renov`, `gestion` bounded at the start only); ko as substrings with every space removed from both sides; plus the symbols `$`, `€`, `£`, `₩`, `USD`, `hangulroute.com`, `http` and a digit before 원: **no hit** on any board in en, es or ko, the plan-block lines and both reports included. With spec 9.2's earlier bare card words the report boards fail in ko (`새 카드`, a substring), and en and es fail on the singular forms the reports produce for a count of one ("Since the start: 3 quests, 1 card", "1 tarjeta nueva del patrimonio."), which is D15's reason.
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

Independent multi-agent review (CLAUDE.md section 5), 2026-11-08, two reviewers on the files (one on design fidelity, accessibility and consistency with the spec and the code; one on store policy, child safety, privacy, anti-shame and the es and ko copy): 0 blockers, 6 majors (one raised by both), 13 minors, 7 nits; both asked for changes. Adjudication, fixed in this PR unless marked otherwise:

- The account card showed the email after face or fingerprint (major, both reviews, CS-N9, ND-5): the email line now needs a fresh proof as well as the trust; the card's Sign in, use rows and Sign in again go through AccountGate and its typed PIN (D7, boards 9, 10, 11, 12b; spec 7.1, CS-N9).
- The school coverage line carried the school's end date (major, store): never on native, and a free plan shows no cap (D20, `plan-block.html` boards 2, 6, 7; ND-8, 8.5, 9.1).
- The amber invalid-field border was 1.86:1 (major, WCAG 1.4.11): the field keeps `border.shape` and thickens; the strip carries the words (D5).
- D14's reasoning also fits the shipped in-app report (major): the filter is placed in the account report's wrapper by insight code, and the in-app report is **left to the owner** as a follow-up under F-BILL-002 section 4.8 (out of this spec; PR body).
- Send a new code on the second step and the offline state of every button were not in spec 6.3 (major): 6.3 amended (D2, D4).
- Minors and nits fixed: `errors.wrongPassword` no longer points to a code a password-only account cannot get ("That password didn't work. Check it and try again." in three languages); the backup-code field's name is its label (D4) and the mock drops the numeric input mode; React Native mechanisms named for the code panel, the code field and Copied (D11, spec 14); TalkBack check and fallback for the plan block (D9); D12 no longer says the covers carry no text; D7 explains why the chooser keeps its Grown-up account row; GrownUpRow's component spec gains the `account` use and native offline state (D22); titles for an entry with no use (D6), the open device's card rows (D7) and the other buttons while busy (D2) specified; Sign in again after a re-trust lock opens on the password step (D21, spec 7.3); spec 8.2's "one Back away" corrected; the attention line accepted in 8.3; the deny list's phrase lists completed, plural-tolerant and spacing-free in Korean (D15); the wireframes no longer name colours, type or tokens (wireframe-skill rule 4); wrong decision references on boards, `reports.md` in the wireframe, `.submit.cta` in `lock.md`, literal constants in `account.css`, the tablet board's usage count; `home.makeCode` dropped for the shipped `console.confirm.issueCode`.
- es and ko language review: 11 es and 12 ko values revised as proposed, each checked against the length budget and the deny list: es "Inicia sesión" in sentences and "Entrar" on buttons, as the shipped console splits them (`signIn.intro`, `card.signedOut`, `lock.retrustPassword`, `errors.cantSignIn`, `errors.generic`), `signIn.title` "Acceso para adultos" (the console's title), "verificar" for the device check (`deviceCheck`, `lock.cantCheck`), `codeExpired` "ya no sirve", `noFamily` "espacio familiar", `noClass` "ninguna clase"; ko 사용하기 for 쓰기 where it could read as "write" (`changeEmail`, `useBackup`), 한 뒤에 for 뒤로 (the Back button's word on the same screen) and 어른용 PIN (`lock.retrustPassword`, `home.retrustNotice`), 해 주세요 for instructions (`signIn.intro`, `secondStep` as 2단계 인증, `codeExpired`), `usePassword` 비밀번호로 로그인, `learners` as the shipped `learnersNoAccount`, `noFamily` 가족 공간, `a11y.joinCode` 알려 주세요. The en `home.noFamily` follows ("This account has no family space."). Every other es and ko draft passed (style guide 3.10, glossary, tú, 해요체, no particle on a variable). Spec 17 carries the values; no `packages/i18n` file changes in this row.
- Accepted without a change: siblings' 7-day minutes on adjacent cards (the console's accepted pattern, ND-2), Android's per-syllable Korean breaks (D19).

Independent multi-agent review, round 2, 2026-11-08, the same two reviewers on commit `b0898c7f6`: **both approve**; every round 1 finding resolved (the in-app report's free-end line deferred to the owner, accepted). Remaining minors and nits, fixed in this PR:

- Board 14 (offline, signed in) showed the email without saying a fresh proof was present: its note now says so.
- The code field's spoken digits: spec 14 names a fallback (the spaced digits in the field's hint, else one number is accepted) if a platform ignores `accessibilityValue.text`.
- The card's 2-minute email window: decided on mount, focus and `active` like AccountGate, no timer (D7, spec 7.1).
- Spec 6.3's email row points to D21's password-first exception; the wireframe's last colour word ("amber strips") is gone.
- Deny list (spec 9.2): every word of a phrase takes the plural, so "tarjetas de crédito" matches; `카드정보` dropped because the shipped heritage-card detail pane says 카드 정보; the covers' English tagline accepted as the launch splash (D12).
- Not adopted: ko `signIn.secondStep` mentioning backup codes. The line shows on every second step, also for accounts with no backup codes, and "Use a backup code" names the other path; the reviewer marked it optional.
- es and ko: every revised value passed round 2 (`errors.wrongPassword`, `home.noFamily` and the shipped `console.confirm.issueCode` included).
