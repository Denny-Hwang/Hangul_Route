# /signin: grown-up sign-in, the adult step and the router (design mock v1, for A-4b)

Wireframe: `design/wireframes/shell/signin.md` (Panels A to D) · spec §3.7, §3.9 (secret-proving sign-in), §3.11, §3.16, §3.19 · mock: `mock/signin.html`, `mock/signin-states.html` · shots: `shots/signin-375.png`, `signin-1280.png`, `signin-320-text200.png`, `signin-states-375.png`, `signin-states-1280.png`

`/signin` is exempt from the lock and has no adult frame: it is a single centred column, like the lock, at every width.

## Panel A: signed out

```
 [< Back to learning]                      quiet button, top left -> learnerHome()
            (HR)                            brand mark, 48 (D1: no Hoya)
     Grown-ups sign in                      h1, size.title (console.signIn.title)
  Sign in to see your family's learning.    persona intro, text.secondary, leading.relaxed
 +----------------------------------+
 | Clerk <SignIn routing="hash">     |       max layout.pane.master (400); footerAction hidden
 +----------------------------------+
  New here? Create a grown-up account       text link -> /signin?mode=create (persona kept)
  Learners don't need an account. They ...  muted, size.bodySm
  I'm here to learn                          text link -> /
```

- Intro by hint (`personaHint`: `persona`, then `as`): `parent` → `console.signIn.persona.parent.intro`, `teacher` → `.teacher.intro`, none or unknown → `console.signIn.neutralIntro`. `?as=teacher` draws exactly like `?persona=teacher`.
- No persona choice on this page: the hint changes only the line and which home (or its "not set up yet" state) opens.
- Installed PWA (`display-mode: standalone`, OD-15): the email-code method is listed first, Google under "or" (`signin-states`, standalone frame). A-4b orders Clerk's first factors; the page around it does not change.

## Panel C: `?mode=create`, the adult step

```
 [< Back to sign in]                        -> /signin (persona kept)
            (HR)
     Grown-ups sign in
  Grown-up accounts are for parents,        size.bodyLg bold; the checkbox's description
  guardians and teachers.
 +----------------------------------+
 | [ ] I am a parent, guardian or teacher |  label row, touchTarget.min tall, borderWidth.base border.strong;
 +----------------------------------+        ticked: border brand.primary (the tick is the main cue)
 [[            Continue              ]]      real <button disabled> until ticked: surface.sunken, text.muted
```

- After Continue the step is replaced by Clerk `<SignUp>` (with `unsafeMetadata.adultAffirmedAt`), under the same title and Back to sign in. The sign-up form never renders before the tick (behaviour 27).
- The disabled Continue is announced as disabled (native `disabled`); ticked versus unticked and enabled versus disabled keep at least 3:1 in greyscale and protanopia (`check.html`).

## Panel B: router

One line "Taking you to your home…" in a polite live region (`a11y.shell.redirecting`) and a visible link "Go now" (`console.signIn.router.goNow`) that works without script. Centred, `spacing.jumbo` above and below. Shown for a moment only.

## Panel D: reverification (OAuth on a device with learner profiles)

A paper card like the lock's: h1 "Confirm it's you", the line ("This device has learner profiles. Enter the code we email you to open grown-up pages."), Clerk's reverification (email code, password or passkey) at most 400 px wide, and **Back to learning** as a secondary button. Cancelled: still signed in, the lock shows.

## Errors

| Case | Drawn |
|---|---|
| Clerk unreachable | the widget's place holds a panel: "Sign-in can't load right now." and Try again; Back to learning and the links under it stay |
| spaces fetch failed after sign-in | router column: "Can't reach the console right now." and Try again (no wrong home) |
| standalone PWA, Google finished in Safari | an info line above the widget, `feedback.infoLight`: "Finish signing in here with an email code", and the email-code method first |
| `next` rejected | nothing shown; the home is used |

## Tokens

| Part | Tokens |
|---|---|
| Page | `surface.canvas`; column max `layout.maxWidth.reading`, gutter `layout.gutter.compact` (`.regular` from 45em); items `spacing.md` apart |
| Back to learning | quiet button: `text.secondary`, bold `size.body`, glyph `arrow-left` 24, `touchTarget.min` tall |
| Brand mark | 48 circle `brand.primary`, `text.inverse` bold `size.bodyLg` |
| Title / intro | `size.title` bold `leading.tight` / `text.secondary` `leading.relaxed` |
| Widget box | `surface.paper`, `borderWidth.thin` `border.subtle`, `radii.lg`, `shadows.card`; Clerk appearance variables from tokens (README, D13) |
| Text links | `brand.secondaryDark` semibold, underline offset `spacing.xs`, `touchTarget.min` tall |
| Learners line | `text.muted` `size.bodySm`, max 400 px |
| Checkbox row | `surface.paper`, `borderWidth.base` `border.strong`, `radii.md`, box `spacing.xl` square with `accent-color: brand.primary` |
| Continue | primary: `brand.primary` / `text.onPrimary`, `radii.pill`, `touchTarget.min`, full column width; disabled `surface.sunken` / `text.muted` |
| Info line | `feedback.infoLight`, `radii.md`, padding `spacing.md` `spacing.lg` |

## Accessibility

- `main` holds one `h1`. The checkbox has a visible label; the lead sentence is its description (`aria-describedby`).
- Router pages: `role="status"` with `aria-live="polite"`, and a real link.
- Tab order: Back to learning, the widget, create link, I'm here to learn (visual order; measured).
- No sideways scroll at 320 with 200 % text (`signin-320-text200.png`).
