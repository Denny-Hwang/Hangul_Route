import { KOREAN_LINE_BREAK, colors, typography, useTypeScale } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

/**
 * A line a Check holds while its question is open (AMENDMENTS-STAGE1-DECODING-CHECK section 3.1, row DC-1c): the same text,
 * invisible and unannounced, so its room is kept and nothing moves when the answer shows it. For the games that draw their
 * own lines (the design-system `KoreanText` and `ChoiceCard` have `romanizationReserved` for theirs). Off the accessibility
 * tree on every platform and not selectable; the screen-reader name of the thing it belongs to keeps the romanization.
 */
export const HELD_LINE_PROPS = {
  'aria-hidden': true,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no',
  selectable: false,
} as const;

export const HELD_LINE_TEST_ID = 'held-romanization';

/** The type steps a held line takes: the same ones the drawn line uses. */
type HeldSize = 'caption' | 'bodySm' | 'body';
type HeldTone = 'secondary' | 'muted';

interface HeldTextProps {
  children: string;
  size: HeldSize;
  tone: HeldTone;
  /**
   * The drawn line's line height, so the held line takes exactly its room: `body` for a line drawn with the design-system `Body`
   * (it sets `lineHeight` to the size times `leading.normal`), `none` for a plain `Text` that sets none.
   */
  leading: 'body' | 'none';
  weight?: keyof typeof typography.weight;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function HeldText({ children, size, tone, leading, weight, italic = false, align }: HeldTextProps): ReactElement {
  const fontSize = useTypeScale().size[size];
  // The same text style as the drawn line, no more: a `Body` sets its weight (regular), alignment (left) and line height; a plain
  // `Text` sets only what it names, so a held tile is exactly as tall as the drawn one.
  const asBody = leading === 'body';
  const fontWeight = weight ?? (asBody ? 'regular' : undefined);
  const textAlign = align ?? (asBody ? 'left' : undefined);
  return (
    <Text
      {...KOREAN_LINE_BREAK}
      {...HELD_LINE_PROPS}
      testID={HELD_LINE_TEST_ID}
      style={{
        fontSize,
        ...(leading === 'body' ? { lineHeight: fontSize * typography.leading.normal } : null),
        color: tone === 'muted' ? colors.text.muted : colors.text.secondary,
        ...(fontWeight === undefined ? null : { fontWeight: typography.weight[fontWeight] }),
        ...(italic ? { fontStyle: 'italic' as const } : null),
        ...(textAlign === undefined ? null : { textAlign }),
        opacity: 0,
      }}
    >
      {children}
    </Text>
  );
}
