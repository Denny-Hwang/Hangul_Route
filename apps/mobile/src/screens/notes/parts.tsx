import { Pill, colors } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/** "New": a word in the secondary pill, never only a dot and never amber or red (mock N2). */
export function NewPill(): React.ReactElement {
  const m = useMessages();
  return (
    <View>
      <Pill tone="secondary" size="sm" label={m.common.notes.new.pill} />
    </View>
  );
}

/** The glyph on list rows and chips (mock constants: 20). */
export const ROW_GLYPH = 20;
/** The glyph on cards, dashboard rows and reactions (mock constants: 24). */
export const CARD_GLYPH = 24;
export const glyphColor = colors.text.primary;
