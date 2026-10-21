# Who is joining? (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 10.2, 10.3, 10.6, OA-D14, CS-11, 17.4 · wireframe `design/wireframes/profiles/people-on-device.md` (Panels D, E) · mock `mock/who-is-joining.html` (boards 1 to 8) · shots `shots/who-is-joining-320.png`, `-1280.png`, `-320-text200.png` · row OA-7b

A family code on a device with 2 or more learner profiles, after the lookup found the family. Class codes never show this step.

## Checklist (boards 1, 2)

The shipped Join screen header (`caregiver.join.title`) and the found line (`bubble.found(space)`); then **Who is joining?** (`join.who.title`, `size.prompt` bold) and the hint (`join.who.hint`); then one row per learner profile, in tile order:

- a real check box (24, `text.primary` accent) inside a 64-high row (`surface.paper`, `border.strong`, `radii.md`) with the cub (40) and the name;
- the active learner starts checked; a locked profile starts unchecked and carries the lock glyph and `join.who.takesPlace` as its description;
- a class-scoped learner is a disabled row (`surface.sunken`, name `text.muted`) with `join.who.classOnly`.

**Next** (`common.buttons.next`, primary): when the pick includes anyone but the active learner, it asks a fresh PIN first (CS-11), then the name check per picked learner, then the consent step, then the joins in sequence. Offline: Next is `aria-disabled` with "Needs the internet" under it, which is its description (`aria-describedby`).

## Name step and consent (boards 6 to 8)

- **Name step** (board 6): only the fields of the shipped Join confirm step (`join.confirm.seeYouAs.family`, the name field, `sameEverywhere` and the name-rule hints), shown once per picked learner in turn, with **Next** (`common.buttons.next`, primary). Next keeps the name in memory and sends nothing. The shipped **That's me** is not reused: it calls `membership-store.join` at once (`JoinSpaceScreen.tsx` `confirmName`), which would register the learner before the consent step; **Not this one** belongs to class rosters and is not shown. Back returns to the previous learner's name step, or to the checklist from the first.
- **Consent** (boards 7, 8): one step for every picked learner, new strings in section 17.4 (OA-0b): the title `join.who.consentTitle(space)` (`size.prompt` bold), one line per picked learner `join.who.consentLine(name)` ("Mina: joining saves their progress to the account.", in pick order, divided by `border.subtle`), the line `join.who.consentSees`, then **Yes, join** (`join.who.consentYes`, primary) and **Not now** (`join.who.notNow`, ghost; back to the checklist, nothing is sent and nobody is registered). `membership-store.join` runs only after Yes, join. It names every learner it registers (spec 10.3); a learner not named here is never joined. The longest es line wraps at 320 (board 8).

## Fresh PIN across the steps (CS-11)

The PIN is asked at Next on the checklist when the pick includes anyone but the active learner. Once it is accepted the picked set is frozen: the name and consent steps show only those learners. After **Not now**, any change to the picks asks a fresh PIN again before Next goes on. **Yes, join** checks the PIN's age again and, when more than 2 minutes (`GROWN_UP_FRESH_PIN_MS`) have passed since it was entered, asks it again before the first join; a cancel there returns to the consent step and sends nothing.

## Results (boards 3 to 5)

A status heading `join.who.result(joined, total)`, then one line per learner: `join.who.joined(name)` (new in this pass), `join.who.already(name)`, or the name in the colon form followed by `caregiver.join.errors.familyFull(cap)`. A refused seat is a result, never an error. **Done** closes. When the network drops, the joins stop: the lines done so far, `caregiver.retry.offline` and **Try again** (`join.who.retry`) for the rest; a retry is idempotent.

## Accessibility

Check boxes are labelled by the learner's name; captions are their descriptions. The result heading is a polite status. Rows wrap at 200 % text; the longest caption (es `takesPlace`, 29 characters) takes two lines at 320.

## Notes for OA-7b's string review

- The screen keeps the shipped title `caregiver.join.title` ("Join a class") for every code; a family join under that title reads oddly. OA-7b decides in its MAR whether a family code gets its own title (a new key with es and ko).
- The cap line reuses `caregiver.join.errors.familyFull(cap)`, which ends "Ask a grown-up in your family.", written for a learner; here a grown-up runs the flow behind a fresh PIN. OA-7b decides whether this flow gets a grown-up wording.
