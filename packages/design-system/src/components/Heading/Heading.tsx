import React from 'react';
import { Text } from 'react-native';
import { colors, typography } from '../../tokens';
import type { BodyProps, HeadingLevel, HeadingProps, TextTone } from './types';

const sizeOf: Record<HeadingLevel, number> = {
  display: typography.size.display,
  title: typography.size.title,
  prompt: typography.size.prompt,
  body: typography.size.body,
  caption: typography.size.caption,
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
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      style={[
        {
          fontSize: sizeOf[level],
          color: toneOf[tone],
          textAlign: align,
          fontWeight: typography.weight[weight],
          lineHeight: sizeOf[level] * typography.leading.tight,
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
  const fontSize =
    size === 'sm'
      ? typography.size.bodySm
      : size === 'lg'
        ? typography.size.bodyLg
        : typography.size.body;

  return (
    <Text
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
  return (
    <Text
      testID={testID}
      style={[
        {
          fontSize: typography.size.caption,
          color: toneOf[tone],
          textAlign: align,
          fontWeight: typography.weight[weight],
          lineHeight: typography.size.caption * typography.leading.normal,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
