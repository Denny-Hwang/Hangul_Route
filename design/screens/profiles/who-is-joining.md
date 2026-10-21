# Who is joining? (screen spec, OA-0b)

Spec: AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 10.2, 10.3, 10.6, OA-D14, CS-11, 17.4 · wireframe `design/wireframes/profiles/people-on-device.md` (Panels D, E) · mock `mock/who-is-joining.html` (boards 1 to 5) · shots `shots/who-is-joining-320.png`, `-1280.png`, `-320-text200.png` · row OA-7b

A family code on a device with 2 or more learner profiles, after the lookup found the family. Class codes never show this step.

## Checklist (boards 1, 2)

The shipped Join screen header (`caregiver.join.title`) and the found line (`bubble.found(space)`); then **Who is joining?** (`join.who.title`, `size.prompt` bold) and the hint (`join.who.hint`); then one row per learner profile, in tile order:

- a real check box (24, `text.primary` accent) inside a 64-high row (`surface.paper`, `border.strong`, `radii.md`) with the cub (40) and the name;
- the active learner starts checked; a locked profile starts unchecked and carries the lock glyph and `join.who.takesPlace` as its description;
- a class-scoped learner is a disabled row (`surface.sunken`, name `text.muted`) with `join.who.classOnly`.

**Next** (`common.buttons.next`, primary): when the pick includes anyone but the active learner, it asks a fresh PIN first (CS-11), then the name check per picked learner, then one consent step naming every picked learner (the existing consent text with the names listed), then the joins in sequence. Offline: Next is `aria-disabled` with "Needs the internet" under it.

## Results (boards 3 to 5)

A status heading `join.who.result(joined, total)`, then one line per learner: `join.who.joined(name)` (new in this pass), `join.who.already(name)`, or the name in the colon form followed by `caregiver.join.errors.familyFull(cap)`. A refused seat is a result, never an error. **Done** closes. When the network drops, the joins stop: the lines done so far, `caregiver.retry.offline` and **Try again** (`join.who.retry`) for the rest; a retry is idempotent.

## Accessibility

Check boxes are labelled by the learner's name; captions are their descriptions. The result heading is a polite status. Rows wrap at 200 % text; the longest caption (es `classOnly`, 52 characters) takes three lines at 320.
