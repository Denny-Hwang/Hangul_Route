# Shell/Tab-bar — the learner tab bar's selected tab carries a shape mark, not only a colour (wireframe v1)

Spec: `docs/specs/AMENDMENTS-FINISH-2026-11.md` row FN-8 (closes audit A11Y-5, left open by `docs/specs/AMENDMENTS-AUDIT-2026-11.md` AU-17) · amends the tab bar of `journey/learning-route.md` G and `layout/wide.md` H (their tab rows gain the mark; nothing else changes)
Audience: **everyone** in the learner app (the bar is the same for every age)
Mock: `design/screens/app-shell/tab-bar-selected.md` (`mock/tab-bar-selected.html`)
Code: `apps/mobile/src/navigation/tab-button.tsx` (the navigator's own tab button, `GuardedTabButton`), `navigation/tabs.tsx`

Notation: `( )` a tab, `<sel>` the selected tab, `===` the selected mark. No colours, fonts or pixel sizes; relative positions only.

## Scenario (Given-When-Then)

Given: a learner who cannot tell the tab colours apart (colour-blind, a greyscale or high-contrast screen, bright sunlight on a phone)
When: they look at the tab bar to see where they are
Then: the selected tab has a shape over its icon that the other tabs do not have, so "I am on Journey" reads without colour

## Screen goal

"See which tab is open." (it is a frame part, not a screen)

## Box diagram

Panel A — phone, 320 wide, four tabs (flag on), Journey selected

```
+--------------------------------+
|        [ screen content ]      |
|--------------------------------|  <- the bar's top rule (unchanged)
|                     ===        |  <- the mark: a short rounded bar, centred over the selected item, in the
|  (ico)   (ico)    (ico)  (ico) |     bar's top padding right under the rule; no other tab has one
| Today    Route   Journey Library|
+--------------------------------+
             Journey <sel>
```

Panel B — phone, 320 wide, three tabs (flag off), Today selected: the same mark, the same place

```
+--------------------------------+
|   ===                          |
|  (ico)      (ico)      (ico)   |
|  Today     Journey    Library  |
+--------------------------------+
```

Panel C — Largest text (native: the label grows up to its cap; web: the label stays at caption size)

```
+--------------------------------+
|                     ===        |  <- the mark keeps its place and size: it sits above the item's content,
|  (ico)   (ico)    (ico)  (ico) |     out of the label's flow, so a bigger label never moves or covers it
|  Today   Route  Journey Library|  <- labels larger; one line each (the existing cap and shrink-to-fit)
+--------------------------------+
```

Panel D — wide window (from 600), labels beside the icons, the bar centred in the content width

```
+------------------------------------------------------------------+
|              ===                                                 |
|   (ico) Today   (ico) Route   (ico) Journey   (ico) Library      |
+------------------------------------------------------------------+
               Today <sel>: the mark centred over the item, above the icon and label pair
```

Panel E — a high-contrast or forced-colours display (Windows contrast themes in the browser)

```
+--------------------------------+
|                     ===        |  <- the mark is drawn as an outline that is filled in, so a theme that
|  (ico)   (ico)    (ico)  (ico) |     replaces fills with the page colour still draws it in the system's
| Today    Route   Journey Library|     text colour; the label colours may all become the same here
+--------------------------------+
```

## Interaction points

- **Tap a tab** → that tab opens (unchanged); the mark moves to it at once, with no motion (nothing slides, so no reduced-motion case).
- **The mark is not a control.** It takes no taps (taps fall through to the tab) and is not read by a screen reader.
- **Screen reader** → unchanged: each tab is a `tab` in the `tablist` and the selected one says "selected" (AU-17c). The mark adds nothing to what is spoken.
- **Press** → the tab's own press look, unchanged.

## States

- **Selected:** colour (as today) + the mark.
- **Not selected:** colour only, no mark.
- **Loading / empty / error / offline:** the bar has no such states; it draws the same on every screen that shows it (the offline banner sits above it, `pwa/system-banners.md`).

## Navigation graph

- The bar is on the four (or three) tab roots: `home/todays-mission` (Today), `journey/learning-route` (Route), `journey/grid` (Journey), `library/gallery` (Library). Each tab goes to its root; nothing new.

## Data needs

- Only the navigator's selected state (`accessibilityState.selected`) of each tab. No storage, no network.

## Rules for the mock

- The mark is a non-text graphic, so it needs 3:1 against the bar (WCAG 1.4.11). It uses the selected tab's own colour token, which already passes 4.5:1 on the bar.
- Same size and place at every text size and every width. The mark sits in the bar's existing top padding, so the bar is not taller and the item keeps its full touch target.
- One look in every theme the app has. The app has one colour scheme today (no dark theme); the forced-colours case (Panel E) is the only other look on the web.

## Open questions (each with the default used until answered)

| Question | Default |
|---|---|
| A bar over the icon, or a filled pill behind it? A pill in the light brand tint is under 3:1 on the white bar, and a pill in the full brand colour would need the icon recoloured. | the bar over the icon |
| Should the selected label also get a heavier weight? | no: labels are already semibold, and a weight change shifts the label's width at 320 |
| A dark theme later: the mark takes that theme's selected-tab colour and needs its own 3:1 check. | recorded here; no dark theme yet |
