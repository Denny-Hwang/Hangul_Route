# This week in Korea (row CM-48)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §5.7 (row **CM-48**, its decision record).
Wireframe: `design/wireframes/home/this-week-in-korea.md` (A card, B Meet, C practice, D Done, with its MAR design review).

No HTML mock: the card reuses Home's sunken card and the pages reuse the Daily Review's top row, round view and Hoya, so no new visual pattern is drawn (the wireframe's MAR review). These are the built screens, from the e2e spec `apps/mobile/e2e/web/this-week-in-korea.spec.ts` (`HR_SHOTS=1`, release build, device clock on Wednesday 4 November 2026, `weeklyDrop` on in the stored remote copy).

| File | What it shows |
|---|---|
| `shots/week-drop-home-320.png` | A1: Home at 320 wide, the card after Today's cards |
| `shots/week-drop-meet-320.png` | B: the Meet page at 320 wide (the note with its taught Korean and source line, the 5 words) |
| `shots/week-drop-round-320.png` | C: the first practice round (the Daily Review's round view, fill-only dots) |
| `shots/week-drop-done-320.png` | D: Done for this week |
| `shots/week-drop-home-wide.png` | A3: Home at 1280 wide, the card heading the side column |
| `shots/week-drop-meet-wide.png` | B at 1280 wide, reading width |

**Nothing here changes a string, a flag, a schema or a token.**
