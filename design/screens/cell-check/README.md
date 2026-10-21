# Cell Check and Test out (design mock v1, row CM-D1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §4.4, §4.5 (Cell Check, test-out details), §7.7, §11.4 (E3). Wireframe: `design/wireframes/reviews/cell-check.md`. Built by **CM-21**.
Stylesheet, tokens, constants and the checks made on the shots: `design/screens/daily-review/README.md`.

| File | Shows |
|---|---|
| `mock/cell-check.html` | A (the cell page with the mastery block and the Cell Check as the page primary), A2 (Cell Check done), B (an unstarted cell: Test out under the quest list), C (the test-out intro), D (a Read Pick Meaning round from the cell), E (3 stars, the level rose to Mastered), E2 (2 stars, a calm next step), F (test out, 3 stars: Done), G (test out, 2 stars: Good start), H (Tested out pills and 2 stars), I (Stop the check?) |
| `shots/cell-check-320.png`, `shots/cell-check-768.png`, `shots/cell-check-320-text200.png` | the page at 320 (2x) and 768 (1x); and 320 with the text at 200 % |

Decisions drawn here:
- The 80 % rule is the 3-star tier of F-RVW-001 §3.1, so the learner sees only stars; no result says pass or fail.
- Test out never sits above the first quest's Start; it is hidden in E3's hidden arm, on a not-open-yet cell and with `cellCheck` off.
- A result under 3 stars changes nothing on the map.
