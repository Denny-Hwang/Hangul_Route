# Tab bar: the selected tab's mark (design mock, FN-8)

Spec: `docs/specs/AMENDMENTS-FINISH-2026-11.md` row FN-8 (audit A11Y-5; left open by `docs/specs/AMENDMENTS-AUDIT-2026-11.md` AU-17) · wireframe `design/wireframes/shell/tab-bar.md` (Panels A to E) · amends the bar of `design/screens/learning-route/tab-bar.md` (everything there stays; this adds the mark)
Mock: `mock/tab-bar-selected.html` on `../learning-route/mock/learning-route.css` (the bar's own rules and the token properties) and `mock/tab-bar-selected.css` (the mark)
Shots (Chromium, device scale 1): `shots/tab-bar-selected-320.png`, `-320-text200.png` (browser text at 200 %), `-320-forced-colors.png` (forced colours on), `-1280.png`
Code: `apps/mobile/src/navigation/tab-button.tsx` (`GuardedTabButton` draws the mark when its `accessibilityState.selected` is true; `TAB_SELECTED_MARK` holds the look)

## The mark

- **Shape.** A short bar with round ends: `spacing.xxl` wide, `spacing.xs` tall, `radii.pill`, centred over the selected item.
- **Place.** In the bar's top padding (`tabBarMetrics().paddingTop`, which is `spacing.xs`), right under the `border.subtle` top rule. It fills that padding, so the bar is no taller, and it is outside the item's content, so no label size, icon or window width can move it or draw over it.
- **Colour.** The selected tab's own tint, `brand.primary`: 5.9:1 on `surface.paper`, over the 3:1 WCAG 1.4.11 asks of a non-text graphic. The unit test checks this from the token values.
- **Drawn as a border.** The bar is a `borderWidth.base` border in `brand.primary` filled with the same colour. A forced-colours theme (Windows contrast themes in a browser) drops background fills but keeps borders in the system text colour, so the mark still shows there (`-320-forced-colors.png`), where the label tints all become one link colour.
- **Only on the selected tab.** The other tabs draw nothing in its place.
- **Not a control, not spoken.** No taps (`pointerEvents="none"`), hidden from screen readers. What a screen reader says is unchanged: each tab is a `tab` in the `tablist` with its selected state (AU-17c).
- **No motion.** The mark moves to a new tab at once; nothing slides.

## Every theme, every text size, every width

- **Themes.** The app has one colour scheme (no dark theme in `packages/design-system/src/tokens.ts`). The only other look on the web is forced colours, drawn above. A dark theme later gives the mark that theme's selected-tab colour and its own 3:1 check.
- **Text size.** On the web the tab label stays at the caption size at every text size (`learning-route/tab-bar.md`, "Large text"); on iOS and Android it grows up to its cap. Either way the mark keeps its size and place (`-320-text200.png`, where the mock's labels grow).
- **Width.** 320 (four items of 80), 375 and up, and the wide window from 600, where the navigator sets each label beside its icon: the mark is still centred over the item (`-1280.png`, last panel).
- **Greyscale.** With colour taken away (fourth panel), the mark alone shows the selected tab.

## Not changed

The bar's surface, rule, height, item size, icons, label size and weight, tint colours, the press guard and the accessible roles.
