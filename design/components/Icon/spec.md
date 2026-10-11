# Icon: My route glyphs `pin`, `check-circle`, `book`, `ear`, `pencil` (component spec v1)

Spec: `docs/specs/F-ROUTE-001-my-route-overview.md` §3.3 (stage badges), §3.6 (start marker), §3.7 (skill rows), §3.14 (no colour-only meaning), PR R-2a in §6.1 · wireframe: `design/wireframes/journey/my-route-overview.md` (legend `pin`; screens A, B and C1 to C5: stage badges, tags and the practice rows) · also needed by F-PLC-001 P-7 (start pin and placed-out look, amendment AM-10)
Code: `packages/design-system/src/components/Icon/glyphs.ts` (geometry, pure data) · `types.ts` (`IconName`) · tests `Icon/__tests__/glyphs.test.ts`
Preview: `route-glyphs-v1.png` (20, 24, 48 and 96 dp next to `check`, `journey` and `card` for family fit)

## What they are

Five glyphs for the My route page and the level-check result. They join the existing set on the same 24 x 24 grid with the same drawing rules: round caps and joins, stroke 2 (2.2 to 2.4 where a line risks a hairline at 20 dp), filled parts are solid silhouettes. All five are mostly outline, so they sit quietly next to the filled tab icons and never compete with the hero button.

| Glyph | Meaning | Where (spec) | Geometry |
|---|---|---|---|
| `pin` | "You started here" | stage-row tag (R-3, R-7a); placement start cell (F-PLC-001 P-7) | outlined drop, stroke 2.2, closed; solid centre dot r 2.6 at (12, 9.5) |
| `check-circle` | Complete: the `complete` stage state of F-ROUTE-001 §3.3 (latched, **or** every grid quest done before the latch is written, **or** the stage card owned); it stays Complete once latched | stage badge (R-3), keyed on `StageRow.state === 'complete'`, never on `latched` or `stageDoneAt`; never used for `known` (that badge is the ring-with-disc pip shape, R-2b) or `explored` (bare `check`) | ring r 9 at the centre, stroke 2.2; the `check` mark scaled into it, stroke 2.4 |
| `book` | Read | skill row (R-3) | open book outline, stroke 2.2; spine line, stroke 2 |
| `ear` | Listen | skill row (R-3) | ear rim and an inner curl that closes back on itself (no free downward hook, so it never reads as a question mark), two sound waves on the left, stroke 2.2 / 2 |
| `pencil` | Write (trace games) | skill row (R-3) | diagonal pencil outline, stroke 2.2; tip line and ferrule line, stroke 2 |

```
pin:           stroke M12 21.5 C9.5 18.5 5 14 5 9.5 A7 7 0 0 1 19 9.5 C19 14 14.5 18.5 12 21.5 Z (2.2) + fill circle(12, 9.5, 2.6)
check-circle:  stroke circle(12, 12, 9) (2.2) + stroke M7.5 12.5 L10.5 15.5 L16.5 8.5 (2.4)
book:          stroke M12 6.5 C10 5 7 4.5 3.5 5 V18.5 C7 18 10 18.5 12 20 C14 18.5 17 18 20.5 18.5 V5 C17 4.5 14 5 12 6.5 Z (2.2) + stroke M12 6.5 V20
ear:           stroke M9 10 A5.5 5.5 0 0 1 20 10 C20 13.5 17 14.5 17 17.5 A3 3 0 0 1 11.5 19 (2.2) + stroke M12.5 13 V10.5 A2.5 2.5 0 0 1 17.5 10.5 C17.5 12 15.5 12.5 14 13.5 + stroke M6.5 8.5 Q4.5 12 6.5 15.5 + stroke M3.5 6.5 Q1 12 3.5 17.5
pencil:        stroke M4 20 L5 15 L15 5 L19 9 L9 19 Z (2.2) + stroke M5 15 L9 19 + stroke M13 7 L17 11
```

## Rules

- **Tokens only.** Callers pass a colour token (`colors.text.primary` by default, `colors.text.muted` on a quiet tag, the stage colour only as decoration). The glyph is never the only carrier of meaning: every use sits next to its word ("Complete", "You started here", "Read", "Listen", "Write"), F-ROUTE-001 §3.14.
- **No commerce, no failure.** None of these is a lock or a price; `check-circle` is earned-only (the `complete` stage state), never a quiz verdict. A miss stays amber with Hoya `thinking` (CLAUDE.md §1).
- **No speaking glyph.** There is no microphone or mouth glyph in this set (owner decision 2026-10-10; F-ROUTE-001 §10). `mic` was dropped from R-2a in review.
- **Explored is not Complete.** `explored` (a taste stage, F-ROUTE-001 §3.3) uses the existing bare `check` on its badge, never `check-circle`; `check-circle` is reserved for `complete`. The R-3 badge tests cover `complete`, `explored` and `known`.
- **Sizes.** Minimum 20 dp (stage-row tag and skill rows); 24 dp in the stage badge. Checked at 20 and 24 dp in the preview: each glyph stays distinct from `check`, `journey` and `card` and from each other.
- **Accessibility.** Glyphs are decorative inside a labelled row; the row label carries the words. `Icon` has no accessibility props of its own, so the call site hides it: either the Icon sits inside the row's single accessible element (`accessible` with an `accessibilityLabel`, which groups its children), or it is wrapped in a `View` with `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden`. A hide-by-default prop on `Icon` would be a separate design-system change, not R-2a.
- **Tests.** The existing glyph tests (every name drawn, valid paths, all glyphs distinct, inside the 24 x 24 box, stroke band 1.5 to 3) cover them; R-2a adds a block that pins the outline style (stroke 2 to 2.6), the closed pin drop with its dot inside it, the check mark inside the ring with a visible gap (0.5 at 20 dp), and the ear's inner curl closing on itself (no question-mark tail).
