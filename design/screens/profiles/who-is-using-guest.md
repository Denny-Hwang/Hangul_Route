# Who is using this? with the guest tiles; People on this device's first-quest row; the guest-only gate (mock v1, GU-0b)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 9.1, 9.2, 10 (CS-G1, CS-G5, CS-G10), 14, 16.3 · Wireframe: `design/wireframes/profiles/who-is-using-guest.md` (Panels L to Q) · Extends `who-is-using.md` and `people-on-device.md` of OA-0b; every other board there is unchanged · Row that builds it: **GU-5** · Mocks: `mock/who-is-using-guest.html` (boards 1 to 9), `mock/who-is-using-guest-largest.html` (boards 1 to 9, `html.ts-largest`), `mock/people-on-device-guest.html` (boards 1 to 15) · Shots: `shots/who-is-using-guest*-*.png`, `shots/people-on-device-guest-*.png` · Pass notes, strings and lengths: `../onboarding/README.md`

## The chooser's guest tiles (spec 9.1)

At most one guest tile, after **Add a learner** in the Learning section, only with the guest switch on:

| Board | Trigger | Tile |
|---|---|---|
| 1, 4, 7 (Panel L) | `try` (the site's Start learning), no live guest | **Try the first quest** with **No profile needed** |
| 2, 5, 8 (Panel M) | any, while a guest lives | the guest's own tile: **First quest**, **Not saved yet** |
| 3, 6, 9 (Panel N) | `join` (a held class code) | none: joining needs a profile; the caption **Pick who is joining.** as shipped |

### D11. Two tiles, two shapes

- **Try the first quest** is drawn like **Add a learner** (a start, not a person): the dashed `border.shape` outline on `surface.canvas`, no shadow, the 48 paper circle with the shipped **play** glyph (Add has **plus**), the label in `size.body` semibold like Add's, and under it the line in `size.bodySm`, `text.secondary`. Its accessible name is the whole sentence `a11y.who.try` ("Try the first quest without a profile."), never the label and line joined. It is gated by nothing: one tap starts the run, no PIN (spec 9.1).
- **The guest's tile** is drawn like a learner tile (someone's run): the paper tile with the card shadow, the plate in `surface.sunken` with the **default cub** (orange) in the **idle** pose, the label **First quest** in `size.bodyLg` bold and the caption **Not saved yet** in `size.bodySm`, `text.secondary`. It never takes a tint (`tileTints` counts profiles only; a guest is not one), never a lock badge, and never shows stars, a card count, a level, a streak, a time or a progress mark (CS-G5, OA CS-6). Its accessible name is `a11y.who.guest` ("First quest, not saved yet. Tap to keep going.").
- The two never show together (one guest per device): with a live guest the try tile is gone and the guest's tile is the way back in.
- Both join the grid's roving tab order after Add a learner; the classroom grid puts them at the end, as Add.

### D12. 320, two columns, Largest (spec 14)

Spec 14 asks both tiles to wrap untruncated "in two columns at 320 px with text at Largest in en, es and ko". The shipped grid (WHO_TILE_MIN 8rem, OA-0b D3) never draws that: at Largest it takes a column away first, so a 320 window shows one column of 288 (`who-is-using-guest-largest.html` boards 2, 3, 5, 6, 8, 9). Board 1, 4, 7 are therefore a **stress check** stricter than any real layout: the two tiles side by side in two forced columns of 138 px in a true 320 window (288 inside the gutters) at Largest. Measured in Chromium in en, es and ko: every label and line wraps at spaces and stays inside its tile (138 x 211 to 138 x 273); no word breaks; nothing is cut. GU-5's component test checks the same at 138 px and Largest; the grid rule itself does not change.

## People on this device: the first-quest row (spec 9.2; `people-on-device-guest.html`)

### D13. The row

- Inside the shipped People on this device card, after the people, whenever a live record exists (whatever the guest switch says): the default cub (40) and **First quest, not saved** (semibold). It is **not** a button and has **no chevron**: there is no person page for a guest (the wireframe's ">" is dropped, since it would open nothing). The row and its buttons are one group labelled by the row's text.
- Under it, full width, 64 tall: **Keep as a learner** (outlined, only while the guest switch is on; opens `CreateProfile { from: 'guest' }` inside this grown-up session) and **Remove the first quest** (the paper secondary of OA-0b D19, never red). Board 2: the switch off, Remove only.

### D14. The ConfirmSheet

Remove the first quest asks the existing fresh-PIN step first only when a PIN is stored (OA, 2 minutes), then the ConfirmSheet: title **Remove the first quest?** (`caregiver.people.guestRemoveAsk`, new in spec 16.3 from this pass), message **The card and stars of this quest are removed from this browser.**, **Cancel** first and focused (drawn with the focus ring), then **Remove the first quest** as the primary. Not the danger tone: OA-0b D19 keeps `feedback.danger` for Remove anyway (a saved learner's cards and stars), and this removes only a visitor's unsaved record. With no PIN on the device the sheet alone (board 5 from the PIN setup).

## The guest-only gate on PIN setup (spec 9.2, Panel Q; boards 4 and 5 of each locale)

### D15

On the L8 PIN setup (`PinEntry` create: **Create a grown-up PIN** and its subtitle) that a device without a PIN and without a child shows only because a guest lives (`guestOnlyGate`): one `surface.sunken` box between the subtitle and the dots, the OA-0b D5 box, holding **Someone tried the first quest on this browser and didn't keep it. Set a PIN, or remove that quest.** and the quiet underlined text button **Remove the first quest** (64 tall). It opens the same ConfirmSheet (no fresh PIN: there is no PIN yet), the sweep, and then the destination opens directly, as before the guest. The dots and pad are unchanged. The box is plain text in reading order, not a live region; it never appears inside a guest run (CS-G1), and no screen of the `Guest` stack opens L8 setup (CS-G10). The L8 screen itself sits outside the `Guest` stack: a visitor who left the run can tap the chooser's Grown-up area on a no-PIN, child-free device and see this box. That is the same access the device gave before the guest existed (anyone could open its Grown-up area), not a new one; GU-5 records it in its notes and adds the e2e "a guest leaves the run, then taps Grown-up area" (spec section 19), so CS-G10's scope is tested on purpose.

## Accessibility

- Tiles at least `touchTarget.hero` both ways (the stress tiles are 138 wide); rows and buttons at least 64; text sizes up to Largest; the dashed outline is never the only cue (the try tile has its glyph, label and line).
- Reading order on the chooser: the learner tiles, Add a learner, the guest tile, the grown-ups section (unchanged).
