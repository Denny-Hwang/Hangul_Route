import { spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { BlockShape } from '../../logic/build-letter-view';

interface Props {
  shape: BlockShape;
  /** Renders the cell for part `index` (0 initial, 1 vowel, 2 final). */
  renderCell: (index: number) => React.ReactNode;
}

/**
 * The boxes of one syllable block (design/wireframes/minigame/build-letter.md):
 * initial and vowel side by side, or the vowel under the initial; a final
 * consonant, when there is one, fills a lower row. Layout only.
 */
export function BlockLayout({ shape, renderCell }: Props): React.ReactElement {
  const top =
    shape.vowel === 'beside' ? (
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {renderCell(0)}
        {renderCell(1)}
      </View>
    ) : (
      <View style={{ gap: spacing.sm, alignItems: 'center' }}>
        {renderCell(0)}
        {renderCell(1)}
      </View>
    );
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      {top}
      {shape.hasFinal ? renderCell(2) : null}
    </View>
  );
}
