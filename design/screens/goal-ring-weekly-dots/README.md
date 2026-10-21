# Goal ring and weekly dots (design mock v1, row CM-D1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.4, OD-6 (confirmed 2026-10-21: weekly dots and steady weeks as the Home headline, the local-day streak below, 2 automatic rest days a local week), OD-14, §7.7, §11.4 (E4). Wireframe: `design/wireframes/home/goal-ring-weekly-dots.md`. Built by **CM-17** (local-day streak by CM-4).
Stylesheet, tokens, constants and the checks made on the shots: `design/screens/daily-review/README.md`.

| File | Shows |
|---|---|
| `mock/goal-ring-weekly-dots.html` | A (Home: the week strip above the unchanged Next lesson hero; the words known pill), A (today's goal met), A2 (a run ended by the rest-day rule: Start a new run, best run kept), first day, C (the goals sheet with the defaults, Light and 3 days), D (the first choice), E (goal moments on Results) |
| `shots/goal-ring-weekly-dots-320.png`, `-768.png`, `-320-text200.png` | 320 (2x), 768 (1x: the strip on one row, the dots and steady weeks first, the daily goal after them), 320 at 200 % text |

New glyph proposed for CM-17: `rest`, a crescent outline (`M15.5 3.5 A8.5 8.5 0 1 0 20.5 15.5 A7 7 0 0 1 15.5 3.5 Z`, stroke 2.2, 24 viewBox), added with the glyph sheet test. It marks a granted rest day only, never a missed one.
