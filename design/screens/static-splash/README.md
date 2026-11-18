# Static splash — design pass (AMENDMENTS-FINISH-2026-11 FN-2)

Wireframe: `design/wireframes/pwa/static-splash.md`. Finding: F7 of `docs/launch/performance-review-2026-11.md` (the
first paint on the mobile profile was the start bundle's, at about 9.9 s).

**The mock is a design reference, not shipped code.** `apps/mobile/scripts/pwa/static-splash.mjs` writes the same page
part into `dist/index.html` at build time, with every value taken from the design tokens module and every string from
`packages/i18n`.

| File | Shows |
|---|---|
| `mock/splash.html` | the splash as the shell paints it (English, motion allowed) |
| `mock/splash-states.html` | board: English, Spanish, Korean with reduced motion, 320 x 568 at 200 % text |
| `mock/splash.css` | the rules, every value a token copied once as a custom property named after it |
| `shots/splash-375.png`, `shots/splash-1280.png` | `splash.html` at a phone and a desktop width |
| `shots/splash-states.png` | the board |

## Decisions

- **S1. The site's brand sign, not Hoya.** The mark is the circle "HR" of the site header and the grown-up pages
  (`design/screens/app-shell/README.md`, Constants: brand mark), larger (`spacing.jumbo`), with the app name under it.
  Hoya belongs to the app's own screens and comes with the first frame; drawing the cub in the HTML would mean a second
  copy of `Hoya.tsx` to keep in step. Inline text only: no image request, so the splash paints with the HTML itself.
- **S2. The shell's canvas.** `colors.surface.canvas`, the background the shell already sets on `html, body`, so the
  window does not change colour when the app's first frame replaces the splash.
- **S3. One line, the UI language.** "Loading" (`common.splash.loading`), in the language the device chose (the
  device record's language, mirrored for a synchronous read), else the browser's first shipped language, else English;
  `<html lang>` follows. The app name stays "Hangul Route" in every locale (`landing.brand.name`).
- **S4. Motion.** Only the line moves: it breathes between full and 0.8 opacity over `motion.duration.celebration`
  x 2, `motion.easing.standard`, and only under `prefers-reduced-motion: no-preference`. Reduced motion: nothing moves.
- **S5. Out of the way.** Nothing is focusable or tappable; the mark is hidden from assistive tech (the name says the
  same); no live region. The app's first frame removes it, so the crash screen and the shelf's waiting line are never
  covered.

## Values

| Part | Token |
|---|---|
| Background | `colors.surface.canvas` |
| Mark | `spacing.jumbo` circle (`radii.circle`), `colors.brand.primary`, "HR" in `colors.text.inverse`, `typography.size.prompt`, `weight.bold` (5.4:1) |
| Name | `typography.size.title`, `weight.bold`, `colors.text.primary` (15.2:1) |
| Line | `typography.size.body`, `colors.text.secondary` (8.0:1; 4.7:1 at the breathing floor) |
| Gaps | `spacing.lg` between the three; `spacing.xl` side padding of the text |
| Line height | `typography.leading.normal` |

## Constants

Values that are not tokens. The build writes them as named constants.

| Where | Value | Derived from |
|---|---|---|
| Breathing floor | opacity 0.8 | the lowest opacity that keeps `text.secondary` on `canvas` over 4.5:1 (4.7:1) |
| Breathing period | `motion.duration.celebration` x 2, alternating | slow enough to read as calm, not as a blink |
| Sizes in rem | token / 16 | the site mock's method, so a browser text size enlarges the splash |
| Font stack | the system stack | `typography.family.sans` is `'System'` |
| Board frames | 375 x 667, 320 x 568 | design board only, not UI |
