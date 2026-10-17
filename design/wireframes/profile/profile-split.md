# Profile/Profile-split — the learner's own Profile, and one Grown-up area behind the gate (wireframe v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` sections 9.2, 9.4, 9.5 (row DN-8) · amends `profile/settings.md`, `profile/language-picker.md` (the Language card goes) and `parent/grown-up-home-card.md` (its row is renamed Account pages and moves into the Grown-up area)
Audience: **learner** (Profile) and **grown-up** (Grown-up area)
Routes: learner app `Profile` (stack) and `ParentDashboard` (stack, behind the gate)
Mock: `design/screens/learner-shell/profile-split.md`

## Scenario (Given-When-Then)

Given: a learner opens Profile, or a grown-up wants backup, classes or billing
When: Profile shows
Then: the learner sees only their own things in one short page; everything for grown-ups is one row, **Grown-up area**, behind the gate as today

## Screen goal

Profile: "Change my own settings." · Grown-up area: "Manage this device and the account."

## Box diagram

Panel A — Profile, 360 x 740

```
+--------------------------------+
| [< Back] Profile        ( Aa ) |  <- ScreenHeader
| (Mina)  (Jun)  [+ Add]         |  <- who is playing; tap to switch; Edit under each
| Mina: quests 3 · cards 2 · ★1  |  <- stats, unchanged numbers
|--------------------------------|
| Display      English · Standard >|  <- opens the Display sheet
| Sound        On                  |
| Reading practice: hide           |
|   romanization until I tap  Off  |
| Challenge                   Off  |  <- only where Words is offered
| Find my starting spot again   >  |
| Make a weekly plan            >  |  <- a child's plan still asks the gate
| My notes                      >  |
| Got a class code?             >  |  <- opens Join (not gated, as today)
|   Join a class or a family with  |
|   the code you were given.       |
|--------------------------------|
| [ Free plan · Plan details ]     |  <- the plan card, no PIN (F-BILL-002 §4.7)
|--------------------------------|
| (lock) Grown-up area          >  |  <- ONE row; the gate as today
+--------------------------------+
```

Panel B — Grown-up area (after the gate), 360 x 740

```
+--------------------------------+
| [< Back] Grown-up area  ( Aa ) |
| Account pages                 >|  <- web only: opens the app host (was "Grown-up home")
|   Your family, classes and     |
|   billing                      |
|--------------------------------|
| Learners on this device        |  <- the existing dashboard list (read-only)
| [ Mina  ...  See report ]      |
|--------------------------------|
| Progress backup                |
| [ Save my progress ]           |
| [ Back up to a file ]          |
| [ Restore from a file ]        |
|--------------------------------|
| Classes & family               |  <- SpacesCard: classes, Join, Leave
|--------------------------------|
| [ Install on this device ]     |
| Open-source notices            |
+--------------------------------+
```

Panel C — a self-only device (an adult learning alone): the row reads **Account & backup** and opens without a PIN (it never says "grown-up")

```
| Account & backup              >|
```

## Interaction points

- Profile tile → switch learner (unchanged); Edit → Edit profile (gate as today); [+ Add] → new profile (gate as today).
- Display row → `shell/display-sheet.md`.
- Sound, Reading practice, Challenge → toggles (unchanged).
- Find my starting spot again → placement (not gated, unchanged); Make a weekly plan → route proposal (a child's goes through the gate, unchanged); My notes → Notes.
- Got a class code? → Join (`JoinSpace`).
- Plan card → Plan screen (no PIN).
- Grown-up area → PIN (or sign-in where the device has no PIN, F-APP-001 §3.9) → Panel B.
- Panel B rows: each keeps its current action and gate (backup buttons, Account pages hand-off with `?lang=`, Classes & family, Install, notices).

## Navigation graph

Enter from: Home (Profile button) · Results "Profile" links (unchanged)
Exit to: Edit profile · create profile · placement · route proposal · Notes · Join · Plan screen · PIN → Grown-up area → app host pages, backup screens, Join / Leave, install guide, notices

## States

- **success**: Panels A and B.
- **self-only device**: Panel C.
- **one locale offered**: the Display row reads "Standard text" only (no language part).
- **no learner yet** (a grown-up on a fresh device): Profile shows Add a profile and the Grown-up area row.
- **gate lapsed** while in Panel B: back to Profile with the gate's own line (unchanged).

## Data needs

- Profiles, stats, sound, romanization, challenge, plan card state, notes count, gate marker (as today); the device record for the Display row's summary. Nothing new stored.

## Open questions

- None blocking.
