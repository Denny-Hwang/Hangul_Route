# Guest save: Results' save card, the two save steps, Not now, the first Home (mock v1, GU-0b)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 7.1, 8.1 to 8.6, 10, 14, 16.2 · Wireframe: `design/wireframes/onboarding/guest-save.md` (Panels A to F) · Row that builds it: **GU-4** · Mocks: `mock/guest-results.html`, `mock/guest-save-steps.html`, `mock/guest-later.html`, `mock/guest-home.html` · Shots: `shots/guest-{results,save-steps,later,home}-*.png`

## Results, guest variant (spec 7.1, 8.1; boards 1 to 12 of `guest-results.html`)

### D3. What stays

Kept as shipped, top to bottom: Hoya (140; cheering at 2 or 3 stars, thinking below), the tier word (display; first focus, unchanged), the stars (48), Hoya's cheer in a bubble (cheering tone, or the amber thinking tone below 2 stars: never red), and with 2 or more stars the new-card banner ("New card for your library!", the card thumb, title, Korean, romanization, **See my card**). **Not drawn** in a guest run (board 1's dashed note): the name row, the next-quest teaser, the stage prize, practice, Back to Journey, the Episode page, and the locked-quest Paywall / PinEntry hand-off.

### D4. Back on Results opens Not now

Results keeps its route header (`back`, AMENDMENTS-DISPLAY-NAV). In a guest run its Back (and the browser's and the phone's back) opens `GuestLater`, exactly as **Not now** does: a back never drops the save offer silently and never reaches a route outside the `Guest` stack (CS-G1). Spec 7.1 amended in this PR.

### D5. The save card

Under the card (or under Hoya's cheer when no card was earned), by `guestSaveGate`:

| Case | The card | Under it, full width |
|---|---|---|
| `open` (no profile, no PIN) | Hoya idle (56) and **Add a name so Hoya can keep your card and stars.** (no card: **…keep your first quest.**) | **Keep my progress** (hero, the screen's one filled button), then **Not now** (a quiet underlined text button, 64 tall) |
| `verify` (a PIN is stored) | the same | **Keep my progress**, then the caption **A grown-up on this device adds you with the PIN.** (`text.secondary`, `bodySm`, centred; the button's description), then **Not now** |
| `owner` (profiles, no PIN) | Hoya idle and **The person who uses this device can add you.** | **Not now**, now the one button and filled (hero). No Keep my progress, no PIN pad, no caption |

- The card is paper with a 2-wide `brand.primary` outline (5.44 on paper) and `radii.lg`: it reads as the next thing to do without a second filled block. Hoya's line is its heading (`accessibilityRole="header"`, `size.bodyLg` bold); focus stays on the tier word when Results opens (spec 14).
- The buttons sit **under** the card at the screen's full width, as Results' shipped action column does, not inside it: inside a padded card the hero button lost 36 px at 320 and es "Conservar mi progreso" broke inside a word at Largest. Full width, it stays on one line at Standard and at Largest in en, es and ko.
- The primary label is **Keep my progress** in every case and locale (GU-D8): never "Save my progress", the rescue-code action of the Grown-up area.
- Reading order: Hoya, tier word, stars, cheer, card banner, the save card's heading, Keep my progress, the gate caption, Not now.

## The save form: `CreateProfile { from: 'guest' }` (spec 8.3; `guest-save-steps.html`)

The shipped CreateProfile screen and rules (F-LEARN-001 section 3.15) in two steps. The header is the route's (**Back**, Display); the step caption and the heading are one focus stop ("Step 1 of 2. Keep your progress"), as shipped.

### D6. Step 1 of 2 (boards 1, 2)

**Keep your progress** (title size); the field label **Name** (semibold); the shipped field (paper, `radii.lg`, `bodyLg`, placeholder **Type a name**, `NAME_MAX`, `autoCapitalize="words"`); under it **You can pick a Hoya and a reading level later in Profile.** as the field's description (caption, `text.secondary`); then **Continue** (hero). Empty, Continue is disabled with the shipped calm caption **Type a name** under it. No level cards, no cub picker (they take `DEFAULT_LEARNER_LEVEL` and `DEFAULT_AVATAR`).

### D7. Step 2 of 2: Privacy (boards 3 to 7)

**Privacy** (title size); then **Who is learning?** (`createProfile.title`) as the semibold label of the radio group (it was step 1's heading in the shipped form), the two shipped option cards with **nothing preselected**, and under them `createProfile.lessons.plain` (**This doesn't change the lessons.**) whatever `placementEnabled` says. After an answer, the shipped agreement card for it (the "Me" card with **I'm under 13** and its latch; the grown-up card with the PIN when one is required), **Agreeing doesn't change the lessons.**, then the **Ready to go!** card (cheering Hoya, `readyLine`), then **Continue**. Before an answer there is no agreement card and no Ready card (wireframe D1), and Continue is disabled with **Choose who is learning**. When the device already holds the consent the answer needs (board 7), only the who cards, the Ready card and an enabled Continue.

### D8. Add an email (optional)

Inside either agreement card the email field is replaced by one disclosure row in the field's place: the shipped `plus` glyph (closed) or `close` glyph (open) in `text.secondary` and **Add an email (optional)** in `bodySm`, the whole row at least 64 tall, `accessibilityRole="button"` with `aria-expanded`; `aria-controls` points at the field only while it is open. It is the same row pattern as the shipped **Protect settings with a PIN (optional)** row right under it, so the card has one way to open an optional part. Opening it shows today's **Email (optional)** label, its caption and the field, and moves focus to the field (board 5, drawn with the focus ring); closing it clears what was typed (spec 8.3). On the grown-up card (board 6) the row sits above the PIN field.

## Not now: `GuestLater` (spec 8.6; `guest-later.html`)

### D9

- A screen of the `Guest` stack with the route header's lead **none** and only the Display control (as "Who is using this?"): its way out is the card's own **Close**, so there is never a second Close.
- Hoya idle (140), the heading **Hoya can keep your quest in this browser for up to {days} days without play.** (prompt size, centred, first focus, `accessibilityRole="header"`), the line **It isn't backed up yet. Add a name to back it up and keep going.** (`text.secondary`), **Add my name** (hero) and **Close** (outlined).
- `{days}` is `guestTtlDays(profiles)`: 30 with no learner profile on the device (board 1), 7 on a device that holds learner profiles (board 2).
- `owner` case (board 3): **The person who uses this device can add you.** replaces both the line and Add my name (the line asks for a name the guest cannot add here; Results' owner case replaces Hoya's line the same way), and **Close** becomes the one filled button.
- Nothing on the card counts down, and nothing is removed by it.

## The first Home (spec 8.4; `guest-home.html`)

### D10

Home of the new profile as for any new learner, with one cheering HoyaBubble on its first render, in the place Home's catch-up card takes (under the greeting and the subtitle, above the next-lesson hero), read in order, shown once: **Sam, your card is in your Library.** when the guest earned the card, otherwise **Sam, your first quest is saved.** (Sam is the example name). The next-lesson hero (quest 2 next), the cards of the day and the level-check card (**Already know some Korean?** / **Take the level check**) are unchanged and drawn as dashed notes.

## Accessibility

- Every control at least 64 x 64; option cards at least `touchTarget.child` (80); text sizes up to Largest; no colour-only cue (the selected option has its check mark, the disclosure its glyph and `aria-expanded`).
- Focus: Results' tier word; each step's caption and heading; GuestLater's heading; the email field when Add an email opens.
- The save card's heading, the gate caption as the primary's description, and Not now as a real button (not a link).
