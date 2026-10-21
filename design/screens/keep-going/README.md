# Keep going (design mock v1, row CM-D1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.5 (Keep going: 10 more, up to 3 times a day, never required, never shown as owed), §7.4, §7.7. Wireframe: `design/wireframes/reviews/keep-going.md`. Built by **CM-14**.
Stylesheet, tokens, constants and the checks made on the shots: `design/screens/daily-review/README.md` (the mock links `../../daily-review/mock/reviews.css`).

| File | Shows |
|---|---|
| `mock/keep-going.html` | A (the offer under Back home on a Daily Review result), B (the round: the Daily Review screen), C (a Keep going result with one more offer), D (the last offer used: one calm line), E (the collected Home card tapped: with and without an offer) |
| `shots/keep-going-320.png`, `shots/keep-going-768.png` | the page at 320 (2x) and 768 (1x) |

Decisions drawn here:
- **Back home is always the primary**; Keep going is a secondary button under "Want a few more?". Only E, which the learner opened on their own to do more, makes Keep going the primary.
- **Never owed**: no count of remaining items, no badge, no second Home card, no notification.
