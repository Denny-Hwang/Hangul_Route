# Parent/Route-class-blend — the child's class days and practice in the family views (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-CLASS-BLEND.md` sections 8 (family weekly plan, BL-OD-6), 11 (grown-up views, BL-OD-11), 13, 19 · Siblings: GX-4 (#937, the child card's class line), GX-11 (#942, the child card's week line and squares), `parent/dashboard.md`, `reports/learner-report.md`
Mock: `design/screens/route-blend/parent.html` (shots at 320 and 1280 in en, es and ko)
Built by: BL-9 (after GX-4 and GX-11 merge), behind the console flag `routeBlendEnabled()`
Audience: **parent or caregiver** in a family space. Never a class viewer: `summary.practiceWeek` is redacted from class rosters.

## Scenario (Given-When-Then)

Given: Mina is in Evening Class D, which meets on Tuesday and has 3 practice days a week
When: her parent opens the family home or her report
Then: the card says when class is and how often she practises, on the class line that is already there, and the report shows how many days she practised this week with a strip that only fills

## Screen goal

"See the class rhythm and the week's practice at a glance, with nothing that reads as a debt."

## P1. Family home, the child card

```
┌ Mina ─────────────────────────────────────────────────────┐
│ In: Evening Class D · class on Tuesday, practice 3 times a week │  <- GX-4's class line, words appended (no new row)
│ (GX-11's week line and squares, unchanged)                │
│ Mina's class has practice days on Wednesday, Friday, and Sunday. │  <- only while a family weekly plan runs
│ Pause the family weekly plan while class runs              │  <- link; Resume the family weekly plan reverses it
└───────────────────────────────────────────────────────────┘
```

- The appended words come from the class's plan (its default practice days count), not from the child's own days.
- With two or more classes, GX-4's "In 2 classes" line stays as is; the meeting words are added only for one class (BL-9 decides the two-class wording in its review; default: none).
- "Mina's class has practice days on {weekdays}." has no key in section 19 yet: proposed `console.curriculum.blend.family.classHasPractice` (README).

## P2. Grown-up report, This week

```
│ Practised on 3 days this week   ■ ■ ■ □ □ □ □ │
```

- "Practised on {n} days this week" (ICU plural: "1 day"). With no practice yet this week the line and the strip are not drawn (a design choice of this row: a "0 days" line would say what was not done); the report's existing lines stay.
- The strip has 7 marks that fill from the start (n filled in `feedback.success`, the rest outlined): a meter that only fills, hidden from screen readers (the line says it). No denominator, no weekday names, no word for a day without practice (BL-OD-11).
- The class itself never counts; Refresh counts as practice.

## States

- **no class with practice days**: the card and report are today's.
- **class viewer (teacher)**: never sees this line or the field.
- **offline**: the last synced summary, as today.

## Data needs

- reads: `summary.practiceWeek.practicedDays` (family-only), the class plan's `blend` (lecture days, perWeek)
- writes: the family plan's `targetLearnerIds` (Pause / Resume, an existing field)
