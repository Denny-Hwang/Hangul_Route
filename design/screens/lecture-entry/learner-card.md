# Learner app grown-up card: Lecture mode (screen spec, LV-0b)

Spec: AMENDMENTS-LECTURE-V2 sections 3 (E5), 4.2 N3, 7, 8, 12.4 · wireframe `classroom/lecture-entry-points.md` Panel E5 · row **LV-6**
Mock: `mock/learner-card.html` (two learners), `mock/learner-card-states.html` (two, one, none) · shots `learner-card-375`, `-1280`, `-320-text200`, `learner-card-states-1280`

## Anatomy

In `ParentDashboardScreen`, after `GrownUpHomeCard`, the same `rn-card` look: h2 **Lecture mode** (`caregiver.lecture.title`, `size.prompt`), the line (`caregiver.lecture.body`, `text.secondary`), then one row per learner on this device, **Next lesson for {name}** (`caregiver.lecture.next`) with the `arrow-right` glyph (a full-width row button, at least `touchTarget.min`, `border.subtle` rules between rows), then **Open lecture mode** (`caregiver.lecture.open.cta`, the ghost button, end-aligned like the card above).

- A row opens `/present#d=<deck>` in the same tab: the deck from that learner's `routeNext` (N3), quest ids only; the name stays on this screen and never reaches the deck, the link or telemetry.
- **Open lecture mode** opens `/present` (the presets home), same tab, nothing handed over.
- After the grown-up session lapses, a press asks for the PIN again (`gateOpensDirectlyNow`), as See report does.
- No learner on the device: only the line and Open lecture mode.
- Drawn only on the web build and only while `flags.lectureModeEnabled` is on (launch default off until LV-7); native builds draw nothing.

## Measured

375 and 1280: no overflow in the card, targets at least 64 px. 320 with 200 % text: the card wraps cleanly; the existing "Family Dashboard" heading row (unchanged, F-PAR-001) runs 3 px past 320, which is a separate existing issue (the heading needs `overflow-wrap`), not part of this card.

## Strings

Section 12.4 only: `caregiver.lecture.title`, `body`, `open.cta`, `next`. Korean `next` is "다음 수업: {name}" (no particle on the name). No gap found.
