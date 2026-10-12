# App shell screens: grown-up sign-in, lock, adult frame, family and teacher homes, offline page, learner entry points (design mocks v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md`. This is the **design pass** that the start-order table (rows "after A-4b and the design pass" and "after A-6 and the design pass") and section 6.1 ("A-4b, A-5a, A-5b and A-7 wait for their mocks") require under CLAUDE.md section 5. The mocks draw sections 3.6 (learner side), 3.7 (sign-in and routing), 3.8 (frame and homes), 3.9 (lock), 3.12 (offline), 3.15 (strings), 3.16 (accessibility) and 3.19 (states).
Wireframes: `design/wireframes/shell/` `signin.md`, `grown-up-lock.md`, `adult-frame.md`, `teacher-home.md`, `parent-home.md`, `offline.md`; `design/wireframes/onboarding/welcome-personas.md`; `design/wireframes/parent/grown-up-home-card.md`.
Built by:
- **A-4b**: `/signin` (persona intro, `as` alias, hidden sign-up, `mode=create` adult step, router, reverification, standalone email-first) → `signin.md`.
- **A-5a**: `AdultFrame` (persona switch, `ADULT_NAV`, phone layout, footer site links) and the teacher home (class rows, no-class state, cross-links) → `adult-frame.md`, `teacher-home.md`.
- **A-5b**: the family home (card actions, empty state with the join hand-off, no-family state) → `parent-home.md`.
- **A-5c**: the frame's Billing item (drawn in `adult-frame.md`; the billing page itself is F-BILL-002's).
- **A-7**: the Welcome persona row, the Profile "Grown-up home" row, the ParentDashboard card → `learner-entry.md` (which also draws the PIN screen without a PIN as A-6, #404, built it).
- Already shipped, drawn as built so every grown-up surface is on one board: the lock (A-4a, #387) → `grown-up-lock.md`; the offline page (A-2, #386) → `offline.md`.

## What is here

| File | What it fixes |
|---|---|
| `signin.md` | `/signin` Panels A to D, the adult step, the router, every error line; the Clerk theming rule |
| `grown-up-lock.md` | the lock as A-4a built it: Panel A and the five sign-in-only lines |
| `adult-frame.md` | the frame at phone and wide widths: one header row, persona switch, tab row, footer, the way back, the pending and error frames |
| `parent-home.md` | `/parent`: the learner card and its actions by flag, the family actions, the empty state with the join hand-off, no family yet, loading, one family failing |
| `teacher-home.md` | `/teach/home`: class rows with Class report and Notes, School, archived rows, Lessons, no class yet, archived only, error, cross-links |
| `offline.md` | `/grown-ups-offline.html` as A-2 generates it |
| `learner-entry.md` | Welcome A, B, C; Profile row (family device, self-only device, offline); dashboard card (and offline); PIN screen `GrownUpArea` without a PIN |
| `mock/` | static HTML on one stylesheet, `app-shell.css`: `signin.html`, `signin-states.html`, `lock.html`, `lock-states.html`, `frame-states.html`, `parent-home.html`, `parent-home-states.html`, `teacher-home.html`, `teacher-home-states.html`, `offline.html`, `welcome.html`, `learner-entry.html`, `check.html` |
| `shots/` | the mock rendered in Chromium at 2x. File names give the page and the viewport width; `-first` is the first screen only; `-text200` is the browser text size at 200 % (method below) |

**The mock is a design reference, not shipped code.**

- **Tokens.** Every value in `mock/app-shell.css` is a token of `packages/design-system/src/tokens.ts`, copied once into a custom property named after it: `--spacing-xl` is `spacing.xl`, `--colors-brand-secondaryDark` is `colors.brand.secondaryDark`. A-4b, A-5a, A-5b and A-7 write the same values with token imports. The numbers that are not tokens are under "Constants".
- **Units.** Grown-up pages: text in rem and the phone / wide switch in em (45em = 720 px, spec section 3.8), the method of the site mock (`design/screens/site/README.md`), so a browser text size moves the switch with the text. Learner screens keep the app's window classes in px.
- **Drawn parts.** Glyphs are `Icon/glyphs.ts` paths (`arrow-left`, `arrow-right`, `lock`, `parent`). Hoya on Welcome is the static port of `Hoya.tsx` (pose `waving`) that the site mock uses, with every colour as its token. Learner chips are `AvatarChip` (the cub's `furDark`, 28 px). `offline.html` is the page `apps/mobile/scripts/pwa/grown-ups.mjs` renders on this commit, unedited.
- **Clerk.** The Clerk widgets are drawn approximately (Clerk owns their inside); the mock fixes their place, their width and what surrounds them. A monospace note in each says which Clerk component and options it stands for.
- **Words.** Every drawn string is a dictionary value (`packages/i18n`, English) or an Appendix A draft of the spec, word for word. Nine strings had no draft; this PR adds them to Appendix A (see "New strings").
- **Annotations.** Grey dashed boxes and monospace labels are design-board notes, not UI: unchanged parts of a learner screen, the slot of a sibling row, the trust line.

Open any file in a browser (`design/screens/app-shell/mock/parent-home.html`). Links are placeholders.

## Constants

Values that are not tokens. Each one derives from code or a token; the PRs write them as named constants, never as bare literals (CLAUDE.md section 4).

| Where | Value | Derived from |
|---|---|---|
| Phone / wide frame switch | 45em (720 px at the default text size) | spec section 3.8 ("below 720 px"); the site header's switch (`SITE_BREAKPOINTS`), same Next app |
| Gutter steps | `layout.gutter.compact` below 45em, `.regular` from 45em, `.wide` from 70em | 70em = `layout.maxWidth.full` (the site mock's rule) |
| Brand mark | 48 px circle, "HR" | `spacing.xxxl`; the site header's mark, so both hosts carry one brand sign |
| Learner chip | 28 px | `AVATAR_CHIP_SIZE` (`AvatarChip.tsx`, unchanged) |
| Way back flex basis on phones | 7.5rem | the label "Back to learning" on two lines plus the glyph; lets the button shrink before the header row wraps (D2) |
| Brand name and the `/parent` side column | from 70em | `layout.maxWidth.full` (1120 px): below it the wide header has no room for the name on one row, and the main column would be narrower than the 400 px side column (D2, D6) |
| Learner card grid with the side column (from 70em) | `minmax(18rem, 1fr)` | two cards side by side in the 1120 − 400 − 32 px main column |
| Family action grid | `minmax(9rem, 1fr)` | the longest English label ("Family settings") at `size.bodySm` plus `spacing.lg` padding; two per row at 320 |
| Clerk widget width | `layout.pane.master` (400 px) | the lock's button column (`GrownUpLock.tsx`), so `/signin` and the lock line up |
| Welcome Hoya, copy and trust widths | 180 / 320 / 280 px | `WelcomeScreen.tsx` (unchanged) |
| Disabled learner button | opacity 0.6, `surface.sunken`, `text.muted` | design-system `Button` (unchanged) |
| Font stack | the system stack | `typography.family.sans` is `'System'` |
| Board column | 22rem | design board only, not UI |

## Screens

| Shot | Viewport | Shows |
|---|---|---|
| `signin-375.png`, `signin-1280.png` | page | `/signin?persona=parent`, signed out: Back to learning, brand mark, title, family intro, Clerk sign-in, create link, the learners line, I'm here to learn |
| `signin-320-text200.png` | 320, text 200 % | the same, every line enlarged, one column |
| `signin-states-375.png`, `-1280.png` | board | teacher intro (`?persona=` or `?as=`), neutral intro, adult step unticked and ticked, Clerk sign-up after Continue, router, reverification, standalone email-first, "Finish signing in here", Clerk unreachable, spaces fetch failed |
| `lock-375.png`, `lock-1280.png` | page | the lock with the PIN path (Panel A) |
| `lock-states-375.png`, `-1280.png` | board | Panel A and the five sign-in-only lines (Panel B) |
| `frame-states-320.png`, `-375.png`, `-768.png`, `-1280.png`, `-375-text200.png` | board | the frame: both personas (Family, Teacher), teacher only, family only on billing, Open the learner app, space kind pending (last persona's items), spaces fetch failed |
| `parent-home-375-first.png` | 375 x 667, first screen | the first-screen budget: frame and the whole first learner card |
| `parent-home-320.png`, `-375.png`, `-768.png`, `-1280.png`, `-320-text200.png` | page | `/parent`, both personas, every sibling flag on, two learners (one column with two cards side by side at 768; the side column from 1120) |
| `parent-home-states-375.png`, `-1280.png` | board | flags off (Open), Add a learner pressed (join panel inline), family without learners, no family yet, loading, one of two families failing |
| `teacher-home-375.png`, `-1280.png`, `-320-text200.png` | page | `/teach/home`, teacher only, reports, notes and lessons on |
| `teacher-home-states-375.png`, `-1280.png` | board | flags off with both personas, no class yet, archived only, error |
| `offline-375.png`, `-1280.png` | page | the offline page |
| `welcome-320-first.png` | 320 x 568, first screen | Let's start stays in the first view |
| `welcome-375.png`, `-1280.png`, `-320-text200.png` | page | Welcome Panel A with the grown-up row |
| `learner-entry-375.png`, `-1280.png` | board | Welcome B and C, Profile rows, dashboard card, Plan screen Open billing (online and offline), the PIN screen without a PIN |
| `check-375.png`, `-1280.png` | board | the greyscale and protanopia check with its contrast table |

## Measured on the mock (Chromium)

| Check | Target (spec) | Mock |
|---|---|---|
| Sideways scroll | none at 320, 375 and 768 for `/signin`, `/parent`, `/teach/home`, the lock and the offline page (section 3.16) | none on any of the 37 shots (`scrollWidth` equals the viewport), including 320 and 375 at 200 % text and the 768 shots |
| First-screen budget | on `/parent` at 375 x 667 the frame and the whole first learner card are visible (section 3.8) | **met**: the first card ends at 476 px of 667, with every sibling flag on (See report, Send a note, Learning Route). At 320 x 568 it ends at 548 px |
| Header rows at phone width | one header row plus the tab row (section 3.8) | one row at 320 and 375 with the switch and Back to learning (its label takes two lines at 320, D2). Wide header (from 45em): one row with both personas, Back to learning, Language and Sign out, measured on `/parent` at 720, 740, 768, 800, 840, 1024, 1120 and 1280 (84 px each). Two rows only at 200 % text, never sideways. Board frames are narrower than the viewport (board padding), so a board's frame at 320 may wrap; the page shots are the measure |
| Tab row | no hamburger; targets at least `touchTarget.min` | five tabs of at least 64 x 64 fit 375; at 320 five tabs scroll inside the row (the page does not), as the wireframe allows. Two or three tabs (every flag off, today's state) never scroll |
| Targets | every new button at least `touchTarget.min` (section 3.16) | every link, button, select, radio and checkbox row on the page mocks is at least 64 x 64 (measured). Text links get `min-width: touchTarget.min` and `spacing.sm` inline padding, so the router's "Go now" on the board is 79 x 64 too |
| Tab order = visual order | section 3.16 | in DOM order on every page mock. Where two learner cards sit side by side (from 45em) the order is card by card (Sam's See report, Send a note, Learning Route, then Mina's), then the family actions: the reading order of cards, which the checker reports as a step back up |
| Primary on the first screen, Welcome at 320 x 568 | wireframe `welcome-personas`: the row never pushes Let's start down | Let's start ends at 466 px; the row starts below it |
| Greyscale and protanopia | states never carried by hue alone (section 3.16) | `check.html`: every state pair keeps at least 3:1 in both simulations (table below) |

### Greyscale and protanopia (`mock/check.html`)

The state-carrying controls are drawn three times: as is, luminance greyscale (Rec. 709 weights in linear RGB) and Machado 2009 protanopia at severity 1.0 (the matrix of `word-art/color-science.ts`). The table computes the same pairs from the tokens. Greyscale keeps the WCAG luminance, so its column equals the normal one; it is shown to make that explicit.

| Pair | Normal | Greyscale | Protanopia | Floor |
|---|---|---|---|---|
| Persona switch: selected fill (`brand.secondaryDark`) vs the unselected paper | 7.59 | 7.59 | 6.98 | 3:1 |
| Persona switch: selected label, unselected label and outline | 7.59 | 7.59 | 6.98 | 4.5:1 |
| Nav: current underline (`brand.primary`) on paper | 5.44 | 5.44 | 6.83 | 3:1 |
| Nav: current label / other labels | 16.10 / 8.44 | 16.10 / 8.44 | 16.38 / 8.78 | 4.5:1 |
| Primary button label / fill vs canvas | 5.44 / 5.14 | 5.44 / 5.14 | 6.83 / 6.42 | 4.5:1 / 3:1 |
| Adult step: Continue enabled fill vs disabled fill | 4.59 | 4.59 | 5.71 | 3:1 |
| Checkbox: ticked frame on paper (and the tick itself) | 5.44 | 5.44 | 6.83 | 3:1 |
| "Needs the internet" line | 7.97 | 7.97 | 8.25 | 4.5:1 |
| Text links (`brand.secondaryDark` on canvas) | 7.17 | 7.17 | 6.56 | 4.5:1 |
| Footer links (`text.secondary` on sunken) | 7.12 | 7.12 | 7.33 | 4.5:1 |
| Focus ring (`border.focus` on canvas) | 4.06 | 4.06 | 3.67 | 3:1 |
| Learner chips on paper (Home, Feast, Book Tiger) | 5.72 / 5.18 / 3.28 | same | 5.22 / 4.97 / 3.60 | 3:1 |
| Two chips against each other (Home vs Feast Tiger) | 1.10 | 1.10 | 1.05 | none: the name is always beside the chip, and the chip's accessible name is the cub name |

Disabled labels (`text.muted` on `surface.sunken`, 5.07:1 before the 0.6 opacity of learner buttons) are exempt (WCAG 1.4.3); each disabled learner button keeps its label and has the "Needs the internet" line as its description.

## Enlarged text

The 200 % shots use the browser's own text-size setting (Chromium `Page.setFontSizes`, default font 32 instead of 16), as the site and Learning Route mocks do. Chromium drops that setting on a resize, so each `-text200` shot grows the viewport to the page height and sets it again before the capture. Note for A-4b, A-5a and A-5b: the console renders tokens as px inline styles today, which this setting does not enlarge; browser zoom still works. The rem / em method is the design target, and the PRs follow the site's approach (`globals.css` for the rules that change at a breakpoint) where they touch layout.

## New strings (added to the spec's Appendix A by this PR)

| Key | English draft | Used by |
|---|---|---|
| `console.signIn.create.back` | "Back to sign in" | A-4b, adult step (wireframe Panel C) |
| `console.signIn.router.goNow` | "Go now" | A-4b, router pages' visible link (section 3.16) |
| `a11y.shell.redirecting` | "Taking you to your home…" | A-4b (the key is in section 3.15; this is its first draft) |
| `console.signIn.unreachable` | "Sign-in can't load right now." | A-4b, Clerk unreachable (section 3.19) |
| `console.signIn.standaloneFinish` | "Finish signing in here with an email code" | A-4b, installed iOS PWA (section 3.19 wording) |
| `console.parentHome.title` | "Family home" | A-5b, the page's visually hidden `h1` (key in section 3.15; first draft) |
| `a11y.shell.personaSwitch` | "Switch between Family and Teacher" | A-5a, the persona switch's group label (key in section 3.15; first draft, so screen readers never hear "Persona") |
| `console.home.newClass.cta` | "+ New class" | A-5a (section 3.8 names the button; today's key says "+ New space") |
| `learner.profile.grownUpHome.selfTitle` | "Account home" | A-7, the Profile row on a self-only device (D9) |

`console.parentHome.empty.line` now gives the path, not only the label: `On the learner's own device, go to {profile}, then {section}, then "{join}", and enter this family code.` with `{profile}` = `learner.home.profileLabel` ("Profile"), `{section}` = `caregiver.spaces.title` ("Classes & family") and `{join}` = `caregiver.spaces.join.cta` ("Join a class"), so a rename of any of the three flows through, and "family code" says which code this is although the button says "class".

`console.signIn.reverify.line` is factor-agnostic: "This device has learner profiles. Confirm it's you to open grown-up pages." (Clerk may ask for an email code, a password or a passkey).

Existing keys the mock reuses: `console.signIn.title`, `console.space.codeLabel.family`, `console.joinCode.copy`, `console.space.learner.lastActive` with `common.time`, `console.kind.group.school`, `console.home.open.cta`, `console.home.archived`, `console.home.lastList`, `console.spaceCounts.*`, `console.cantReach`, `console.tryAgain`, `console.language.label`, `console.shell.signOut.cta`, `console.lock.*`, `console.offline.*`, `learner.welcome.*`, `caregiver.dashboard.*`, `caregiver.family.zoneLabel`, `caregiver.self.zoneLabel`, `caregiver.family.pinVerifyTitle`, `caregiver.spaces.join.cta`, `caregiver.gated`.

## Decisions taken in this design pass

- **D1. No Hoya on grown-up pages.** `/signin` carries the brand mark of the site header, not Hoya. Hoya is the learner's guide; the sign-in page and the lock are screens a child can reach, and learner art there invites them on. It also keeps the console free of learner art (the `AvatarChip` rule "No Hoya SVG on the console"). The wireframe drew "[hoya small]".
- **D2. One header row at every width.** Below 45em the row is the persona switch (or the brand mark and the persona as text) and the way back. With the switch, the brand steps out: the tab row's Home or Classes already leads home. The way back shrinks before the row wraps, so at 320 its label takes two lines inside its 64 px pill. From 45em the brand mark returns and the name joins it only from 70em, so the wide header (mark, switch, way back, Language, Sign out) stays one row from 720 px up. At 200 % text the row wraps; it never scrolls sideways.
- **D3. Tab row on phones.** Equal tabs, each at least 64 x 64. Five fit at 375. At 320 five tabs scroll inside the row (the wireframe's rule); with today's flags (two or three tabs) nothing scrolls. No hamburger, no icon-only tab. Lessons is a button in the row (it opens the lesson browser window); the others are links.
- **D4. Persona switch.** A segmented `radiogroup` in `brand.secondaryDark`: the selected option is filled, the other outlined, so the state is fill versus outline (7.59:1 in greyscale), not hue. It uses the secondary colour so it never competes with a page's primary action. Each option is at least 64 x 64; the labels stay text at every width (section 3.16).
- **D5. Current nav item.** `aria-current="page"`, bold label, and a `borderWidth.thick` underline in `brand.primary`: the site header's current-page marker, so both hosts mark "you are here" the same way. The nav landmark is labelled with the active persona's name ("Family", "Teacher").
- **D6. Family home layout.** The page `h1` ("Family home") is visually hidden; each family's name is the visible heading. A learner card: chip, name, "Last active …", "Minutes, last 7 days: n", then **See report** (or **Open**) full width, and **Send a note** / **Learning Route** side by side under it. From 45em the cards sit two side by side in one column; the 400 px side column with the family actions and the cross-link opens only from 70em, so the learner cards are never the narrower column. Family actions are equal buttons in a grid. No number is emphasised, no bar or target: the card states facts only.
- **D7. Join hand-off panel.** The family code large (monospace, `size.display`), labelled "Family code", with Copy; the line quotes the learner app's Join label; **Open the app on this device** is the primary.
- **D8. Teacher home.** `h1` "Classes" with **+ New class** beside it; "Hi, {name}" is dropped (the frame has no title slot and the header stays one row). Class report and Notes sit on a ruled line under each class row. Archived rows use `surface.sunken` and `text.secondary` instead of today's 0.6 opacity, which takes the row's text under 4.5:1. An archived class keeps Open and **Class report** (a teacher looks back at a past term; spec section 3.5 keeps archived spaces reachable) and drops **Notes** (an archived class takes no new notes).
- **D9. Self-only devices say "Account home".** The Profile row shows on a self-only device too (wireframe default). There the zone is "Account & backup" and `caregiver.self` never says "grown-up", so the row title is "Account home" (`learner.profile.grownUpHome.selfTitle`, new); the line is unchanged.
- **D10. Welcome row.** The two persona buttons use the ghost tone (outlined), not the blue secondary fill, so Let's start stays the only filled button. They sit side by side when both fit (375) and stack otherwise (320). The divider and the lead line are `border.subtle` and `text.secondary`.
- **D11. Profile row placement.** Today the grown-up zone is one ghost button at the end of Profile. The "Grown-up home" row is a card row (glyph `parent`, title, line, `arrow-right`) directly above that button, with no new heading (a heading would repeat "Grown-up zone"). Its accessible name ends with "(PIN required)" on a gated device (`caregiver.gated`). F-FEEDBACK-001's row goes below it.
- **D12. Lock and offline unchanged.** Both are drawn as shipped and need no change. One note for A-5a: the lock shows an empty canvas while it decides (as A-4a built it), not a frame without content as sections 3.9 and 3.19 first said (both now say an empty canvas); the frame appears with the page after the decision, and no API call happens before it either way.
- **D13. Clerk theming.** A-4b passes Clerk `appearance.variables` from token imports (`colorPrimary` `brand.primary`, `colorText` `text.primary`, `colorBackground` `surface.paper`, `borderRadius` `radii.md`, the system font stack) and keeps `footerAction` hidden. The widget column is at most 400 px.
- **D14. Old sign-in copy leaves `/signin`.** The `whySignIn` bullets and `clerkIntro` ("… Kids never need this page.") are not drawn: the persona intro and the learners line replace them, and `clerkIntro` names an age group on a shared surface. `kidsNoAccount` is replaced by `learnersNoAccount` (section 3.15). Section 3.15 now lists the keys A-4b and A-5a delete once nothing reads them: `console.whySignIn`, `console.clerkIntro`, `console.kidsNoAccount`, `console.home.title` ("Hi, {name}", D8) and `console.home.newSpace` (replaced by `console.home.newClass.cta`).
- **D15. Add a learner is a disclosure.** On a family with learners, Add a learner (`aria-expanded`) opens the family join panel and the join line inline directly under the family actions; focus stays on the button and a second press closes it. Open the app on this device stays in the empty state only.
- **D16. Kind lookup pending.** On a space page, while the space kind loads, the frame shows the switch with no option checked (or the persona text) and the nav items of the last persona, none highlighted. The tab row keeps its height and usually its items, so nothing jumps when the lookup returns.
- **D17. Persona switch commits on Space, Enter or click.** Arrow keys move focus only (manual activation), because choosing navigates (WCAG 3.2.2). A-5a tests that ArrowRight alone does not navigate.
- **D18. Plan screen Open billing (A-7).** Drawn in `learner-entry.md`: same-tab `openGrownUpArea({ via: 'plan' })` online, disabled with "Needs the internet" offline. F-APP-001 sections 3.6 and 3.12 and the shipped telemetry schema win over `billing/plan-status.md`'s `via: 'paywall'` and its offline-page line.
