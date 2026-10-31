# Class page order (GX-7 shots)

Spec: `docs/specs/AMENDMENTS-GROWNUP-UX.md` section 8 T3 to T5 (row GX-7). Wireframe: `design/wireframes/console/roster.md` "Class page order (GX-7)". The page reuses the GX-0 mock's parts (`design/screens/approvals/mock/class-*.html`: the action bar with More, the compact card), the shipped buttons (GX-6) and the join code panel (OR-UX); these are shots of the built page, not a new mock.

| Shot | Shows |
|---|---|
| `shots/class-{ko,en,es}-{360,1280}.png` | a class with learners: This week, the bar (Plan, Term plan, Lecture mode, Class report, More), the compact cards, Invite students collapsed at the end |
| `shots/class-open-{lc}-{w}.png` | the same with More and Invite students open |
| `shots/empty-{lc}-{w}.png` | an empty class: Invite students open with the code hero-size, the join link and Show QR code (a valid code, SUN234), the three first steps, the bar with More holding Settings |
| `shots/waiting-{lc}-{w}.png` | something waiting (a new device, a transfer and a teacher move in): the banner with the count in words, the asking-to-join cards with Accept / Not now, This week, the bar with the waiting entries in view (amber, with their counts), the action card first with Needs your OK and Approve / Deny, the other card In class |
| `shots/waiting-popup-{lc}-360.png` | the same page as it opens: the new-device pop-up (GX-2), before Later |

Made by `apps/web/e2e/class-page-order.spec.ts` with `HR_SHOTS=1` over the GX export (360 x 740 and 1280 x 800, full page). Measured there: no sideways scroll at 360 in any locale; every button of the bar and of More is at least 64 px tall; on an empty class the code sits inside the first 360 x 740 screen in ko, en and es; while something waits the page reads banner, asking cards, This week, bar, roster, invite.
