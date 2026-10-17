import React from 'react';
import { Text } from 'react-native';
import { colors, typography } from '../../tokens';
import type { TypeSizeName } from '../../text-size';
import { useTypeScale } from '../TextSize';
import type { BodyProps, HeadingLevel, HeadingProps, TextTone } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

/** The type size of each heading level; the size itself comes from the chosen text size (`useTypeScale`). */
const sizeOf: Record<HeadingLevel, TypeSizeName> = {
  display: 'display',
  title: 'title',
  prompt: 'prompt',
  body: 'body',
  caption: 'caption',
};

const toneOf: Record<TextTone, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  inverse: colors.text.inverse,
  brand: colors.brand.primary,
};

export function Heading({
  children,
  level = 'title',
  tone = 'primary',
  align = 'left',
  weight = 'bold',
  style,
  testID,
}: HeadingProps): React.ReactElement {
  const fontSize = useTypeScale().size[sizeOf[level]];
  return (
    <Text {...KOREAN_LINE_BREAK}
      testID={testID}
      accessibilityRole="header"
      style={[
        {
          fontSize,
          color: toneOf[tone],
          textAlign: align,
          fontWeight: typography.weight[weight],
          lineHeight: fontSize * typography.leading.tight,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  tone = 'primary',
  align = 'left',
  weight = 'regular',
  size = 'md',
  style,
  testID,
}: BodyProps): React.ReactElement {
  const scale = useTypeScale().size;
  const fontSize = size === 'sm' ? scale.bodySm : size === 'lg' ? scale.bodyLg : scale.body;

  return (
    <Text {...KOREAN_LINE_BREAK}
      testID={testID}
      style={[
        {
          fontSize,
          color: toneOf[tone],
          textAlign: align,
          fontWeight: typography.weight[weight],
          lineHeight: fontSize * typography.leading.normal,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Caption({
  children,
  tone = 'muted',
  align = 'left',
  weight = 'medium',
  style,
  testID,
}: Omit<BodyProps, 'size'>): React.ReactElement {
  const fontSize = useTypeScale().size.caption;
  return (
    <Text {...KOREAN_LINE_BREAK}
      testID={testID}
      style={[
        {
          fontSize,
          color: toneOf[tone],
          textAlign: align,
          fontWeight: typography.weight[weight],
          lineHeight: fontSize * typography.leading.normal,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
