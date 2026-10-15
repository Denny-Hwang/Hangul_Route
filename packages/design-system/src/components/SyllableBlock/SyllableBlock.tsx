import React from 'react';
import { Text, View } from 'react-native';
import { colors, typography } from '../../tokens';
import { syllableBlockView, syllableCellLook } from './layout';
import type { SyllableBlockProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

/**
 * SyllableBlock — one Hangul syllable drawn as its boxes (initial, vowel, an
 * optional lower final). Layout only: no copy, no i18n; the caller passes any
 * text and the localised `accessibilityLabel`.
 * Spec: design/components/SyllableBlock/spec.md.
 */
export function SyllableBlock({
  vowel,
  hasFinal,
  highlight,
  parts,
  renderCell,
  size,
  accessibilityLabel,
  testID,
}: SyllableBlockProps): React.ReactElement {
  const view = syllableBlockView({ vowel, hasFinal, highlight, parts, size });

  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      style={{ alignItems: 'center', gap: view.gap }}
    >
      {view.rows.map((row) => (
        <View key={row.map((c) => c.index).join('-')} style={{ flexDirection: 'row', gap: view.gap }}>
          {row.map((cell) =>
            renderCell ? (
              <React.Fragment key={cell.index}>{renderCell(cell)}</React.Fragment>
            ) : (
              <View
                key={cell.index}
                style={{
                  width: view.cellSize,
                  height: view.cellSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...syllableCellLook(cell.highlighted),
                }}
              >
                {cell.text !== undefined ? (
                  <Text {...KOREAN_LINE_BREAK}
                    style={{
                      fontFamily: typography.family.sansKr,
                      fontSize: typography.size.display,
                      fontWeight: typography.weight.bold,
                      color: colors.text.primary,
                    }}
                  >
                    {cell.text}
                  </Text>
                ) : null}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}
