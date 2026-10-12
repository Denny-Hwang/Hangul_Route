# Tab bar: Today · Route · Journey · Library (screen spec v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 5.1 (LR-OD-2, LR-OD-3), assumption a · wireframe `design/wireframes/journey/learning-route.md` G
Mock: `mock/tab-bar.html` and the bar under `mock/route-tab.html` · shots `shots/tab-bar-320.png`, `-375.png`, `-1280.png`, `-320-text200.png`, `shots/route-tab-320-first.png`
Code (planned): `navigation/tabs.tsx`, `navigation/types.ts` (LR-4); glyph `route` (LR-2, `design/components/Icon/learning-route-glyphs.md`)

## What changes

- **Flag off:** the three tabs of today, unchanged.
- **Flag on (`flags.myRouteEnabled`):** four tabs in this order: Today, Route, Journey, Library.
- **The new item:** the drawn `route` glyph (24 dp) over the label "Route" (`a11y.tabs.route`). Its accessibility label is "Learning Route" (`a11y.myRoute.tab`).
- **Unchanged look:** `surface.paper`, the `border.subtle` top rule, items of `touchTarget.min`, caption labels at `weight.semibold`, active `brand.primary`, inactive `text.muted`. The bar is centred in `layout.maxWidth.full` on a wide window (`tabBarMetrics`).
- **Fit at 320:** four items of 80 x 64.
- **Headers:** Route shows "Learning Route" over "Where you are and where you are going."; Journey shows "Heritage Journey" over "Every lesson, by stage and theme." (LR-OD-3).

## Large text: a cap on the label (decision for LR-4)

- **The problem.** At 320 with 200 % text, an uncapped caption label is 28 px. "Journey" (104 px) and "Library" (89 px) are then wider than their 80 px items: on the mock they overflow, and React Navigation would clip them.
- **Only the four-tab bar changes.** Everything below applies while `flags.myRouteEnabled` is on (four 80 dp items). With the flag off, today's three-tab bar keeps its uncapped labels: at 320 its items are 106 px, and "Journey" at 28 px (104 px) still fits. `shots/tab-bar-320-text200.png` draws both.
- **Native (iOS, Android): a 1.3 x cap.** The label grows with the text size up to 1.3 x caption (18.2 px). LR-4 renders the label through `tabBarLabel` as a `Text` with `maxFontSizeMultiplier={1.3}`, `numberOfLines={1}` and `adjustsFontSizeToFit` (React Native 0.76 supports both on iOS and Android). At the cap the English labels fit on one line ("Journey" 69 px of 80). A label that is still wider than its item shrinks to fit instead of being cut off; `minimumFontScale` is `1 / 1.3`, so on iOS a capped label never drops below the 14 px caption size.
- **Web (the PWA).** React Native Web ignores `maxFontSizeMultiplier` and `adjustsFontSizeToFit`, and the app's web build sets its text in px, so the browser's text-size setting does not grow it. On web the label is always 14 px. What grows on web is page zoom, which narrows the layout instead: 200 % zoom of a 640 px window is the 320 px layout at 14 px, and the repo's 200 % proxy for tablets (1180 x 820 at 200 % = 590 x 410, `tablet-layout.spec.ts`) gives items of about 147 px. Both fit at 14 px. The `-text200` shots model the native case (text grows, the layout width stays 320).
- **Other languages.** The cap was measured with English labels. Measured with the mock's font stack (Chromium and WebKit at 320):

  | Label | at 14 px (100 %) | at 18.2 px (the cap) |
  |---|---|---|
  | Today, Route, Journey, Library | 41, 39, 55, 48 | 51, 50, 69, 60 |
  | ES drafts: Hoy, Ruta, Recorrido, Viaje, Biblioteca | 27, 31, 66, 33, 67 | 34, 39, 83, 42, 84 |
  | KO drafts: 오늘, 경로, 여정, 도서관 (WebKit's wider fallback) | 39, 36, 36, 66 | 50, 47, 46, 85 |
  | 12 characters, the `tab` budget's limit ("Aprendizajes") | 88 | 111 |

  - So "Biblioteca", "Recorrido" and "도서관" fit at 100 % but pass 80 px at the cap. On native, `adjustsFontSizeToFit` shrinks them to fit (to about 1.24 x instead of 1.3 x), so they stay on one line and nothing is cut off.
  - The 12-character `tab` budget (`packages/i18n` `length-budget.test.ts`) is a character count, not a width: a 12-character label does not fit 80 px even at 100 % on web, where nothing shrinks it. **The fit rule for translators:** every `a11y.tabs.*` label fits its 80 px item at the caption size, in one word where the language allows. LR-4 notes this next to the keys.
  - **The check.** LR-4's web e2e at 320 x 568 asserts, per shipped UI locale, that each tab label's text is no wider than its item (`scrollWidth <= clientWidth`, nothing clipped). The ES and KO overlays have no tab labels today, so the assertion covers them as soon as they ship.
- **Why a cap is acceptable:**
  - the icon and the full accessibility label ("Learning Route") still carry the meaning, and a screen reader reads the label at any text size;
  - the screens themselves keep growing without a cap;
  - the bar stays one row of 64 dp items, so it never pushes the page's primary action off the first screen.
- **Assumption a** ("Route" on one line at 320 with 200 % text) holds with the native cap (section 14, as revised by LR-D). LR-10 checks it on a device at text size 200 %; LR-4's web e2e checks the default size per locale.

## Observation (not changed here)

In greyscale, the selected tab differs from the others only by its tint, which is the bar's existing behaviour; the navigator does report the selected state to screen readers. The glyph sheet shows this. A second cue (a heavier label weight, or an indicator) would be a change to the existing bar for all tabs, so it is left to a later layout PR, not to LR-4.
