# Native sign-in (screen spec, NS-0b)

Spec: F-AUTH-004 sections 6.3, 6.4, 6.5, 12, 14, 15 (`auth.native.signin`), 17.1, 17.4 · wireframe `design/wireframes/account/native-sign-in.md` (Panels A to F) · mock `mock/sign-in.html` (boards 1 to 18), es and ko on `mock/lengths.html` rows 1 to 8, Largest on `mock/largest.html` board 1, tablet on `mock/tablet.html` board 3 · shots `shots/sign-in-320.png`, `-1280.png`, `-320-text200.png` · row NS-3

Audience: a grown-up. Route `SignIn { use? }` (`screens/account/SignInScreen.native.tsx`), a stack screen of the Grown-up area stack, inside `AccountGate`; native builds only.

## Anatomy (top to bottom)

1. `ScreenHeader`: Back (`common.buttons.back`; cancels to where the sign-in was opened), the title **Grown-up sign-in** (`caregiver.account.signIn.title`, the stack's small title), Display (Aa).
2. Offline only: the status strip `learner.welcome.grownUps.needsInternet` (`surface.sunken`, `border.shape` edge).
3. One column (`acc-form`): full width on a phone, `layout.pane.master` centred from `layout.breakpoint.regular`.
   - **email**: the intro (`signIn.intro`, `text.secondary`, relaxed leading); the **Email** label and field (`textContentType="emailAddress"`, `autoComplete="email"`, `keyboardType="email-address"`, no autocorrect or capitalisation); the error strip when there is one; **Continue** (`common.buttons.continue`, primary, full width); a `border.subtle` rule and two quiet lines, `signIn.learners` and `signIn.noNewAccounts` (`size.bodySm`, `text.secondary`, no link).
   - **code**: `signIn.codeSent(email)` (`text.primary`); the **Code** label and field (`textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, number pad, mono `size.prompt` bold with tracking, `acc-code-field` wide, accessible name `a11y.account.codeField`); the error strip; **Sign in** (primary), **Send a new code** (paper), **Use my password** (paper, only when the account has a password), **Use another email** (quiet).
   - **password**: the **Password** label and field (`textContentType="password"`, secure entry); the error strip; **Sign in** (primary), **Email me a code** (paper, only when the account has the email code), **Use another email** (quiet).
   - **second**: `signIn.secondStep` (status `needs_second_factor`) or `signIn.deviceCheck` (`needs_client_trust`); the **Code** field; **Sign in** (primary); **Send a new code** (paper, only when this step's code was sent: the device check, an emailed or texted second step; `prepareSecondFactor` again); **Use a backup code** (paper, only when the account has backup codes); **Use another email** (quiet). After Use a backup code the field is plain text (no number pad, no one-time-code autofill, backup codes hold letters), named by its visible label **Code**, and the button is gone (D4).
   - **unsupported**: the info strip `errors.unsupported` (role alert) and **Use another email** (paper) only.

Screen: `surface.canvas`, side padding `layout.gutter`, `spacing.lg` between blocks, `spacing.md` inside the column. Buttons are `rn-btn` (`touchTarget.min` high, pill, wrap their words).

## Boards

| # | State | Notes |
|---|---|---|
| 1 | email, empty | focus on the field; Continue `aria-disabled` until the value holds an @ (D1) |
| 2 | email, typed | |
| 3 | waiting for Clerk | Continue `aria-disabled` and busy, same words; every other button but Back waits too (D2) |
| 4 to 6 | `cantSignIn`, `tooMany`, `generic` | the strip under the field; the text is kept |
| 7 | code, password account | four actions |
| 8 | wrong code, email-code-only account | the field cleared and focused; no Use my password |
| 9 | expired code | |
| 10 to 12 | password; wrong password; an account without the email code | Email me a code only with the email code; while a re-trust is pending, Continue lands here first (D21) |
| 13 | second step (authenticator) with backup codes | |
| 14 | new-device check | Send a new code |
| 15 | backup code chosen | plain field, same line |
| 16 | unsupported | Use another email only |
| 17, 18 | offline on the email and code steps | strip under the header; the buttons that call Clerk wait (Continue, Sign in, Send a new code, Email me a code), the ones that only change the step stay enabled; typed values kept (D2) |

## Behaviour drawn

- The step machine is `logic/account/sign-in-step.ts`; the screen draws its state only. Clerk's own English never shows: every refusal maps to one of the seven lines of spec 6.3 (`wrongCode`, `codeExpired`, `wrongPassword`, `cantSignIn`, `tooMany`, `unsupported`, `generic`) or the offline strip.
- A wrong code or password clears the field, focuses it and announces the line. Send a new code clears and focuses the code field. Use another email returns to the email step with the email kept.
- No Google, Apple, passkey or email-link control, no sign-up and no link anywhere on the screen (ND-3, ND-4, CS-N10). The two quiet lines under the email step are the only words about accounts.
- After a completed sign-in the screen is replaced by the home of the row's use, or `nativeHomeFor(uses)` (spec 6.5); there is no success screen.

## Accessibility

- Visible labels on every field (never a placeholder). The code field's name `a11y.account.codeField` ("Sign-in code, 6 digits", es "Código de acceso, 6 dígitos", ko "로그인 코드, 6자리") contains its visible label in all three languages (WCAG 2.5.3) and reads digits one by one (`accessibilityValue.text`: the digits spaced). After Use a backup code the field's name is its label.
- The error strip is `role="alert"` on the web mock; native: `AccessibilityInfo.announceForAccessibility(line)` and the field's `accessibilityHint` set to the line (`aria-describedby` here); the field carries `aria-invalid` and keeps its `border.shape` border, thickened (an amber border would fall under 3:1), never `feedback.danger` (spec 14).
- Busy and offline submit buttons are `accessibilityState={{ disabled: true, busy }}` (`aria-disabled`, `aria-busy` here), kept in the reading order.
- Reading order: Back, title, Display, the offline strip, the step's line, the field, the error, the buttons in order, the two quiet lines.
- Text sizes Standard to Largest (board 1 of `largest.html`): every line and button wraps, nothing truncates, no sideways scroll at 320 with 200 % text.
