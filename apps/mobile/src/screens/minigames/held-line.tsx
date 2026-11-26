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
  weight?: keyof typeof typography.weight;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function HeldText({ children, size, tone, weight = 'regular', italic = false, align = 'left' }: HeldTextProps): ReactElement {
  const fontSize = useTypeScale().size[size];
  return (
    <Text
      {...KOREAN_LINE_BREAK}
      {...HELD_LINE_PROPS}
      testID={HELD_LINE_TEST_ID}
      style={{
        fontSize,
        lineHeight: fontSize * typography.leading.normal,
        color: tone === 'muted' ? colors.text.muted : colors.text.secondary,
        fontWeight: typography.weight[weight],
        fontStyle: italic ? 'italic' : 'normal',
        textAlign: align,
        opacity: 0,
      }}
    >
      {children}
    </Text>
  );
}
