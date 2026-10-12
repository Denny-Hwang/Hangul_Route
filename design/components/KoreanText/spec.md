# KoreanText (component spec v1)

Spec: `docs/specs/F-I18N-001-ui-locales.md` §3.5 (rules 1-6, L5) and PR 4 in §6 · wireframe: `design/wireframes/profile/language-picker.md` section D (taught Korean in every locale) · also drawn in `design/wireframes/quest/discover.md` and `design/wireframes/story/check.md` (notation `~~ ko ~~`)
Code: `packages/design-system/src/components/KoreanText/` (paint) · `packages/design-system/src/korean-text.ts` (pure view model, unit-tested) · `packages/design-system/src/labels.ts` (the `StarRow` / `HoyaBubble` label defaults)

## What it is

The one renderer for **taught Korean** in every UI locale. The pedagogical signal "Korean on screen that sits in a chip = something I am learning" must survive a Korean UI, where all menus are Hangul too. The chip, the romanization line and the speaker affordance look the same in `en`, `es` and `ko`; only the gloss language changes.

The design system has no copy and no i18n dependency. The caller passes the already-localised `accessibilityLabel` (built from `m.a11y.koreanItem`) and the boolean `romanizationShown` (from `romanizationShown(mode, revealedByTap)`).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `ko` | `string` | - | The taught Hangul |
| `romanization` | `string` | - | Revised Romanization (D13). Required; an empty string draws no line |
| `gloss` | `string` | - | Meaning in the UI language. Never hidden with the romanization |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Hangul size tier; `xs` is the dense tier for a word under a picture in a grid (the Words word wall, F-VOC-003 C-4) |
| `romanizationShown` | `boolean` | `true` | `false` hides only the romanization line (reading-practice opt-in, D2) |
| `onPress` | `() => void` | - | Makes the item a button and shows the speaker icon (play audio / reveal) |
| `accessibilityLabel` | `string` | `"<ko>, <romanization>"` | Caller supplies the localised "Korean: ..." / "한글: ..." label |
| `testID` | `string` | - | |

## Anatomy

```
        +---------------+
        |   강아지       |   <- target chip: Hangul on the chip (sansKr)
        +---------------+
        gangaji   [spk]      <- romanization line + speaker (speaker only when onPress)
        puppy                <- gloss line (UI language, always shown)
```

All three lines are centred. Nothing is truncated: the gloss wraps (Spanish runs about 30% longer).

## Tokens (no literals)

| Part | Token |
|---|---|
| Chip fill | `colors.brand.secondaryLight` (the sky-blue tint; no other surface in the app uses it for text, so Hangul on it reads as a target) |
| Chip border | `colors.brand.secondary`, `borderWidth.base` |
| Chip radius | `radii.lg` |
| Chip padding | `spacing.md` vertical, `spacing.lg` horizontal; `xs`: `spacing.xs` vertical, `spacing.sm` horizontal |
| Hangul | `typography.family.sansKr`, weight `bold`, colour `colors.text.primary`; sizes `xs` `typography.size.body` (the 18 floor), `sm` `typography.size.title`, `md` `typography.size.display`, `lg` `typography.size.hero` |
| Romanization | `typography.size.bodySm` (`caption` at `xs`, `bodyLg` at `lg`), `colors.text.secondary`, medium weight, italic |
| Gloss | `typography.size.body`, `colors.text.secondary` (always at least the 18 body floor) |
| Speaker | `Icon name="speaker"`, 24 dp, `colors.brand.secondaryDark` |
| Touch target (pressable) | `minHeight` and `minWidth` of `touchTarget.min` (64) on the whole item; `hitSlop` `spacing.sm` |
| Gaps | `spacing.xs` chip to romanization, `spacing.xxs` romanization to gloss |

No new token. If review prefers another chip colour, it goes through the design-token-sync flow.

## Contrast (enforced in `packages/design-system/src/__tests__/contrast.test.ts`)

- `text.primary` on `brand.secondaryLight` >= 4.5:1 (Hangul on the chip)
- `text.secondary` on `surface.canvas`, `surface.paper` and `surface.sunken` >= 4.5:1 (romanization, gloss; already covered)
- `brand.secondary` border against `surface.canvas` and `surface.paper` >= 3:1 (non-text, WCAG 1.4.11)
- `brand.secondaryDark` speaker against `surface.canvas` and `surface.paper` >= 3:1

## Accessibility

- The item is one accessible element. Its label is the caller's `accessibilityLabel`; omitted, it is `"<ko>, <romanization>"`.
- Speech language: `accessibilityLanguage="ko"` on iOS (the screen reader speaks the label with the Korean voice) and `lang="ko"` on the Hangul text for web (react-native-web forwards `lang`; to be verified on device).
- `accessibilityRole="button"` only with `onPress`; otherwise it is plain content.
- Hiding the romanization is visual: it removes only the romanization line, never the gloss. The caller owns the reveal (tap) and passes the new `romanizationShown`.
- Colour is never the only cue: the chip also has a border and the romanization/gloss lines follow it.
- No emoji, no motion. Reduced motion is irrelevant.

## States

| State | Look |
|---|---|
| default | chip + romanization + gloss |
| romanization hidden | chip + gloss (no romanization line) |
| pressable | adds the speaker icon next to the romanization (or under the chip when it is hidden); pressed scale 1.04 like `Tile` |
| no gloss | chip + romanization only |
| long gloss | wraps to more lines; chip never grows |

## Where it appears

F-QUEST-002 (Discover, Hangul Check), F-STORY-003 (`ChoiceCard` Korean options, recap chips), F-STORY-004 (tiles, Culture notes), F-VOC-003 (topic tiles and the topic header at `sm`; the word wall at `xs`, `design/screens/vocab/topic.md`). This spec (PR 4) is the only creator of the component.

**`xs` (added by F-VOC-003 C-4).** A word wall tile on a phone is 88 to 115 dp wide; the `sm` chip of a three-syllable word is about 114 dp. `xs` keeps the chip, the border and the romanization line (so taught Korean still reads as taught Korean) at 18 dp Hangul, the body floor, with a 14 dp romanization and a tighter chip: about 74 dp for 바나나. Nothing else changes for `sm`, `md` and `lg`.
