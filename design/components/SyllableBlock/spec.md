# SyllableBlock (component spec v1)

Spec: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md` §3.2 item 3 (batchim diagram on Discover), §3.7 (`BuildLetterGame` slots) and PR Q-5a in §6 · wireframes: `design/wireframes/quest/discover.md` S2 (final consonant page), `design/wireframes/minigame/audio-fallback.md` W6, `design/wireframes/minigame/build-letter.md` (slots and the block-shape hint)
Code: `packages/design-system/src/components/SyllableBlock/` (`SyllableBlock.tsx` paint, `layout.ts` pure view model and cell look, `types.ts`, `index.ts`)

## What it is

One Hangul syllable drawn as the boxes it is made of: **initial**, **vowel** and, when there is one, **final**. It is the only definition of the block shape in the app. Discover uses it to show where a final consonant sits ("at the bottom of the block", the final box lit); Build a Letter uses it for the answer slots and for the shape hint after a miss. Layout only, no copy and no i18n: the caller passes any text and the already-localised `accessibilityLabel`.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `vowel` | `'beside' \| 'under'` | - | Where the vowel sits: beside the initial (ㅏ ㅑ ㅓ ㅕ ㅣ) or under it (ㅗ ㅛ ㅜ ㅠ ㅡ) |
| `hasFinal` | `boolean` | - | A third, lower box for the final consonant |
| `highlight` | `'initial' \| 'vowel' \| 'final'` | none | The box that is the point of the picture (lit with the brand tint) |
| `parts` | `readonly (string \| undefined)[]` | none | Text inside each box in reading order `[initial, vowel, final]`; omitted or `undefined` draws an empty box |
| `renderCell` | `(cell: SyllableCell) => ReactNode` | none | Replaces the default box paint (Build a Letter slots and hint boxes). The block still owns the arrangement |
| `size` | `'sm' \| 'md'` | `'md'` | Default box side: `sm` = `touchTarget.min` (64), `md` = `touchTarget.child` (80) |
| `accessibilityLabel` | `string` | none | Names the whole diagram for a screen reader. Absent: the diagram is left to its parent (Build Letter wraps it in its own labelled view) |
| `testID` | `string` | - | |

`SyllableCell` is `{ index: 0 \| 1 \| 2; part: 'initial' \| 'vowel' \| 'final'; highlighted: boolean }`.

## Anatomy

```
vowel beside, no final      vowel beside + final        vowel under + final
+-----+-----+               +-----+-----+               +-----+
|  0  |  1  |               |  0  |  1  |               |  0  |
+-----+-----+               +-----+-----+               +-----+
                            |    2 (low)  |             |  1  |
                            +-----------+               +-----+
                                                        |  2  |
                                                        +-----+
```

Rows in reading order: `beside` puts boxes 0 and 1 on one row; `under` stacks 0 over 1; the final (2) is always its own lower row. Rows are centred with `spacing.sm` between boxes and between rows.

## Tokens (no literals)

| Part | Token |
|---|---|
| Box side | `touchTarget.min` (`sm`) or `touchTarget.child` (`md`) |
| Box radius | `radii.lg` |
| Gap | `spacing.sm` |
| Text | `typography.size.display`, `typography.weight.bold`, `typography.family.sansKr`, `colors.text.primary` |
| Box (normal) | fill `colors.surface.paper`, border `colors.border.subtle`, `borderWidth.base` |
| Box (highlighted) | fill `colors.brand.primaryLight`, border `colors.brand.primary`, `borderWidth.thick` |

The highlight is never colour alone: it is also the thicker border, and the caller says which box is meant in the line under the diagram and in the `accessibilityLabel`.

## States

- **static**: a diagram has no pressed or disabled state. In Build Letter the slots come from `renderCell` and keep their own filled / empty look.
- **empty `parts`**: empty boxes (the shape alone), as in the hint after a miss.
- **200 % text / small phone**: the boxes keep their size; the parent column scrolls.
- **reduced motion**: nothing moves.

## Used by

- Discover, final consonant page (F-QUEST-002 §3.2): `vowel` from the example block, `hasFinal`, `highlight="final"`, `parts` = the example's three jamo.
- Build a Letter (§3.7): slots (`renderCell`) and the block-shape hint diagram, replacing the screen-local `BlockLayout`.
