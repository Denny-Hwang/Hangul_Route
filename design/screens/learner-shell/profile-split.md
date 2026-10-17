# Profile and the Grown-up area (screen spec, DN-8)

Spec: AMENDMENTS-DISPLAY-NAV sections 9.2, 9.4, 9.5 · wireframe `design/wireframes/profile/profile-split.md` · mock `mock/profile-split.html`, `mock/grown-up-area.html`

## Profile (no gate)

`ScreenHeader` (Back, "Profiles & settings", Aa); "Tap a profile to switch."; the profile tiles (the active one `brand.primaryLight` with a thick `brand.primary` outline and "Playing now") and **+ Add a profile**; the stats card; then one card per group of rows: **Display** ("English · Text: Standard", `learner.profile.display.row` / `.line`, opens the Display sheet), **Sound**, **Reading practice**, **Challenge** (unchanged toggles), **Find my starting spot again**, **Make a weekly plan**, **My notes** (unchanged rows), **Got a class code?** with "Join a class or a family with the code you were given." (`learner.profile.classCode.*`, opens Join); the **Plan** card (unchanged, no PIN); last, **Grown-up area** with the `lock` glyph (`caregiver.audience.family.zoneLabel`, changed; "Account & backup" on a self-only device), behind the gate as today.

Removed from Profile: the Language card (the Display sheet replaces it; Reading practice stays here), and every grown-up block (they move below).

## Grown-up area (behind the gate)

`ScreenHeader` (Back, "Grown-up area" = `caregiver.dashboard.title`, changed); **Account pages** with "Your family, classes and billing" (`caregiver.grownUpHome.title`, changed from "Grown-up home"; web only); the dashboard's learners on this device (unchanged); **Progress backup** (Save my progress, Back up to a file, Restore from a file); **Classes & family** (`SpacesCard`); **Install on this device**; **Open-source notices**. Every block keeps its action and its gate.

## Measured

Profile at 360: about 1 565 px (was 2 895 px on `426384b45`); Grown-up area under two screens; no sideways scroll at 320 with 200 % text; every row and button at least 64 px.

## As built (row OR-UX, 2026-10-17)

Shot of the build: `shots/profile-as-built-360.png` (a new learner, 360 x 640, the top of Profile).

The first OR-UX pass split Profile into two groups on the same page instead of moving the grown-up blocks to the Grown-up area screen, and the owner decision of 2026-10-17 moved the class and family card up. As built:

- Profile (no gate): the profiles and stats; then **Classes & family** (`SpacesCard`, with **Join a class** and **Leave**, both as before), right under the stats; then **My settings**, open (Sound, Display, Reading practice, Challenge, Find my starting spot, the weekly plan, My notes); then **For grown-ups** (`learner.profile.groups.grownUps`; **Account & more** on a self-only device, which never says "grown-up"), collapsed until tapped: the Plan card, Progress backup, Install, the account pages row, **Grown-up area** (the gated dashboard, `zoneLabel`) and the notices.
- Each block keeps its action and its gate; **Leave a class or a family keeps today's behaviour** (no gate), because the card is on Profile again (DN-0 section 9.2 had put it behind the gate together with the Join card's move to the Grown-up area; with the card moved up, Join and Leave stay together where a learner finds them).
- **Got a class code?** is on Welcome (both panels) and on a brand-new learner's Home (no quest yet, in no class); on Profile the card's own Join a class is the way in, so Profile has no second row for it.
- The console's "Write it on the board. Students join from Profile → Classes & family → Join a class." is true again word for word.
