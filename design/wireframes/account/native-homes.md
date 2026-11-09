# Account/Native-homes — Family, Teacher and School homes, the space and school pages, reports, the code panel and the plan block on iOS and Android (wireframe v1)

Spec: `docs/specs/F-AUTH-004-native-sign-in.md` sections 8.1 to 8.8, 9.1, 9.2, 14, 17.3, 17.4 (rows NS-5, NS-6)
Audience: **grown-up** (parent or caregiver, teacher, school owner or admin), signed in and past `AccountGate`
Route: `AccountHome { use: 'family' | 'teacher' | 'school' | 'account' }`, `AccountSpace { spaceId }`, `AccountSchool { spaceId }`, `AccountLearnerReport { spaceId, learnerId, period }`, `AccountClassReport { spaceId, period }` (ids in memory only; no URL)
Mock: `design/screens/account/homes.md` (`mock/homes.html` boards 1 to 19, `mock/plan-block.html` boards 1 to 9, `mock/tablet.html`), `design/screens/account/reports.md` (`mock/reports.html`) (row NS-0b)

## Scenario (Given-When-Then)

Given: a parent signed in on their phone (which holds a grown-up PIN), owner of one family with two children, who also teaches a Saturday class
When: they open **Family**, then go Back and open **Teacher**
Then: they see each child's last active day and minutes this week with **See report**, the family code to copy or to join on this device, which plan covers the family (a name, nothing to act on), and their classes with student counts and class reports; one quiet line says some tools are not in the app, and nothing links out

## Screen goal

"Check on your learners and share a code." Read and share only; every edit tool stays where it is tested, and the app never says where.

## Box diagram

Panel A — Family home (phone 360)

```
| < Back   Family           ( Aa)|
| | The grown-up PIN on this   | |  <- once after a re-trust (7.3); no button
| | device changed since ...   | |
| Kim family                     |  <- family name, prompt size
| +----------------------------+ |
| | Mina                       | |  <- learner card, join order (never activity)
| | Last active today          | |
| | Minutes, last 7 days: 34   | |
| | (       See report       ) | |
| +----------------------------+ |
| | Jun ...                    | |
| +----------------------------+ |
| | Family code                | |  <- code panel: only when the server sends joinCode (space.manage)
| |        K7M PQ4             | |  <- display mono; wraps by groups of three, never below body size
| | (  Copy  ) (Join on this   | |
| |             device       ) | |
| +----------------------------+ |
| | Family Plan                | |  <- plan block: plain text, sunken, no border, not pressable
| | 2 of 6 learners            | |
|--------------------------------|
| Some grown-up tools aren't in  |  <- the quiet line: no link, no place
| this app.                      |
| (  Sign out  )                 |
```

Variants: a manager with no live code: **Make a code** in the panel; anyone else: "Ask the family owner for a family code."; an archived family: "(archived)" after its name, no code, usually no block; a family with no learner: "No learner has joined yet." and the panel; no family: "This account has no family." and the quiet line.

Panel B — Teacher home (and School: the same page titled School, focus on the first school row)

```
| < Back   Teacher          ( Aa)|
| Classes                        |  <- console.kind.group.class
| +----------------------------+ |
| | Saturday class 3B        > | |  <- the top is one pressable: AccountSpace
| | 24 students                | |
| | 2 need your OK             | |  <- attention: plain text, no action
| | ( Class report )           | |  <- its own button
| +----------------------------+ |
| | Spring 2026 class          | |  <- archived after live, sunken
| | (archived) ...             | |
| School                         |
| | Maple Heritage School    > | |  <- owner or admin: AccountSchool
| | Lakeside Korean School     | |  <- teacher member: plain text, no chevron
|--------------------------------|
| Some grown-up tools aren't ... |
| (  Sign out  )                 |
```

Panel C — class page (`AccountSpace`) and school page (`AccountSchool`)

```
| < Back   Saturday class 3B ( Aa)|      | < Back   Maple Heritage   ( Aa)|
| ( Class report )               |      | Classes                        |
| +----------------------------+ |      | | Saturday class 3B        > | |
| | Ana          ( See report )| |      | | Room 12                    | |
| | Ben          ( See report )| |      | | Can't load this right now. | |
| +----------------------------+ |      | Teachers: 6                    |
| | Class code   H3T RW9 ...   | |      | | School Contract            | |
| | Covered by Maple Heritage  | |      | | 6 of 20 teachers           | |
| | School's license until ... | |
```

Panel D — the plan block, every coverage (`nativePlanLines`)

```
| Free plan                      |   free, or own and expired
| Family Plan / Group License /  |   own: active, trial, past_due, cancelled -> the name only
|   School Contract              |
| 2 of 6 learners                |   the usage line, only when the card carries usage
| Covered by {school}'s license  |   school coverage (with "until {date}" when expiresAt)
```

Never: a renewal or end date of the space's own plan, a payment state, "manage", a payer, a price, a button.

Panel E — reports (the in-app report's blocks over the server's answer)

```
| < Back   Mina: report     ( Aa)|
| Last practice: Nov 8           |
| ( Today ) ([This week]) ( This month ) ( All time )
| ( Last week )  Nov 2 to Nov 8  |
| Mina practiced on 4 days this week.
| What went well  - ...          |
| What to practice next - ...    |  <- no line actions, no Preview lessons, no free-end line
| This period  [4] [34 min] [3] [2]   <- figures (heritage cards are a learning fact here)
| - calendar, More detail -      |  <- unchanged blocks; no skills rows, no Open Learning Route
```

Panel F — states

```
| (skeleton cards)               |  loading: tokens only, no data
| You're offline. These pages    |  offline: Try again; reloads on reconnect
|   need a connection. (Try again)
| Can't load this right now.     |  error online: Try again
| This isn't available right now.|  403 native_off: Back only; no quiet line, no Sign out
|   (Back)                       |
```

`401`: the records are deleted and SignIn opens after the gate. A `403` or `404` on one space: that space's card reads "Can't load this right now." with **Try again**; the rest stays.

Panel G — tablet 1180 x 820

```
| < Back   Family                                              ( Aa) |
| Kim family                                                         |
| [ Mina card ] [ Jun card ]                                         |  <- cards two across on a wide window
| [ Sora card ]                                                      |
| [ Family code  K7M PQ4  (Copy) (Join on this device)            ]  |
| [ Family Plan  2 of 6 learners                                  ]  |
```

## Interaction points

- See report: `AccountLearnerReport { spaceId, learnerId, period: 'week' }`. Class report: `AccountClassReport { spaceId, period: 'week' }`. A class row's top: `AccountSpace`; a school row (owner, admin): `AccountSchool`; a teacher member's school row: nothing (plain text).
- Copy: `expo-clipboard`; the button reads **Copied** (polite) for about 2 seconds; a refusal shows `copyFailed` and the code stays. Make a code: `POST /api/spaces/:id/code`, then the panel. Join on this device: closes the grown-up session, holds the code in memory, leaves the stack like a `join` boot intent.
- Try again: refetches the screen's queries. Back on `unavailable`: pops the stack. Sign out: the ConfirmSheet of `native-lock.md` Panel D.
- The period tabs and the stepper of a report refetch with the new `period`; nothing else on a report is pressable.

## Entry and exit

Enter from: `account/sign-in` (after a sign-in) · `profiles/who-is-using` rows through `native-lock.md` · the Grown-up area account card
Exit to: `account/report` (learner, class) · `account/space` · `account/school` · `profiles/who-is-using` with the `join` trigger (Join on this device) · the Grown-up area (Back at the root, Sign out)

## States

- Every home: loading · ready · offline · error online · `401` (sign-in) · `403 native_off` (unavailable) · one space refused · after a re-trust (the notice, once) · empty (no family, no class, stale school).
- Family: owner with a code · owner with no live code · caregiver (askOwner) · archived · no learner yet · copied · copy refused.
- Plan block: every coverage row of Panel D; no block without a status card.
- Reports: ready · error · offline (the home's offline line).

## Data needs

- Reads (online only, `logic/account/api.ts`, `X-HR-Client: native`, `no-store`, a fresh token per call): `GET /api/spaces`; `GET /api/spaces/:id/roster` (Family home per family, `AccountSpace`); `GET /api/spaces/:id/school`; `GET /api/billing/summary?view=status`; the two report routes.
- Writes: the uses record after each successful `GET /api/spaces` on a PIN device; `POST /api/spaces/:id/code` (Make a code); the clipboard (Copy). No account data is kept on the device (ND-10).

## Open questions

- None open. The last-active words, the class page's Class report, the plan block's accessible value, the report's left-out blocks and the card words of the deny list are D9, D10, D13, D14 and D15 in `design/screens/account/README.md` (spec sections 8.2, 8.3, 8.5, 8.7 and 9.2 amended in NS-0b).

## Accessibility

- Reading order (spec 14): heading, the space sections in order, the plan block, the quiet line, Sign out.
- The code is read as `a11y.account.joinCode(code)` ("Code K7MPQ4. Copy it to share."); the drawn groups are hidden from assistive tech.
- The plan block is one accessible element: label `a11y.account.planBlock`, value its visible lines; it is never a button.
- No status by colour alone; the archived word is text; nothing truncates a name or a code at Largest.
