# Native entries: the chooser's Grown-ups rows and the Welcome row (screen spec, NS-0b)

Spec: F-AUTH-004 sections 7.1, 12, 14, 17.2; AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 6.1 · wireframe `design/wireframes/account/native-sign-in.md` (Panels G to I) · mock `mock/entries.html` (boards 1 to 9), es and ko on `mock/lengths.html` rows 19 to 22, Largest `mock/largest.html` board 4, tablet `mock/tablet.html` board 4 · shots `shots/entries-320.png`, `-1280.png`, `-320-text200.png` · components `design/components/GrownUpRow/spec.md` (unchanged), `design/screens/profiles/who-is-using.md` · row NS-4

Only the Grown-ups section of "Who is using this?" and the grown-up group of Welcome change. Everything above them is drawn as a dashed box (unchanged).

## Rows (`grownUpRows` with `nativeAccount`)

| Board | Device | Rows, in order | Row name (accessible) | Caption (description) |
|---|---|---|---|---|
| 1 | `pin`, uses record Family, Teacher, School | Family, Teacher, School, Grown-up area | `a11y.who.grownUpRow(label)` | — |
| 2 | `pin`, record with no use | **Grown-up account** (`caregiver.account.card.title`, use code `account`), Grown-up area | as 1 | — |
| 3 | `pin`, no record | **Sign in as a grown-up** (`learner.who.use.signIn`), Grown-up area | as 1 | — |
| 4 | `nopin` | Sign in as a grown-up, Grown-up area | the label alone (entering runs PIN setup) | `caregiver.pin.needsPinFirst`; Grown-up area keeps `learner.who.nopinCaption` |
| 5 | offline (`pin`, Family and Teacher known; D3) | Family, Teacher (`aria-disabled`, `surface.sunken`, `text.muted` label, no chevron), Grown-up area (enabled) | as 1 | `learner.welcome.grownUps.needsInternet` |
| 6 | `open` (self-only, marker `none`) | Sign in as a grown-up, the zone row (`caregiver.audience.self.zoneLabel`) | the label alone, no lock glyph | — |
| 7 | switch off or no valid key | Grown-up area only (CS-N13) | as today | — |

- The row is the shipped `GrownUpRow` (lock glyph, label at `size.body` semibold, chevron, at least `touchTarget.min`, `border.strong` outline on paper); nothing new is drawn on it. Rows never show a name or an email (CS-N9).
- A row press on a `pin` device opens `PinEntry { next: 'GrownUpUse', use }` typed only (`lock.html` board 1); on `nopin` it opens `PinEntry { next: 'ParentDashboard' }` (setup); on `open` it opens SignIn (no PIN exists).
- `nopin` and offline together: offline wins (the row is disabled with Needs the internet), because the row exists for the account, which needs the network; the Grown-up area row just below still runs PIN setup offline (D3).
- On an `open` device no uses record is ever written (ND-9), so the row is always **Sign in as a grown-up** and every visit starts with a sign-in (CS-N14).

## Welcome (boards 8, 9)

Under **I already have progress**: the existing `grownups` group, its lead `learner.welcome.grownUps.lead` and **one** outlined button **Sign in as a grown-up** (`rn-ghost`, at least `touchTarget.min`). **Let's start** stays the only filled button. Never a use row (a device with no profile keeps no session, ND-9). Offline: the button `aria-disabled` with `needsInternet` under it as its description (board 9).

The top of Welcome (Hoya, the title, the invitation) and the trust line are unchanged.

## Accessibility

- Reading order unchanged: title, Learning, its tiles, Grown-ups, the rows in order.
- Captions are `accessibilityHint` (`aria-describedby` here), never joined into the name.
- Disabled rows stay focusable in the reading order (`aria-disabled`), so the reason is heard.
