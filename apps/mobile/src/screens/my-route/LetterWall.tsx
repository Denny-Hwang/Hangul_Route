import { Body, Button, Icon, KoreanText, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { LetterState, LetterWallView } from '../../logic/my-route/letter-wall';

/**
 * The letter wall of the open Stage 1 (F-ROUTE-001 R-7c, section 3.11;
 * wireframe `design/wireframes/journey/my-route-overview.md` B). Every Stage 1
 * letter as taught content (`KoreanText`: the letter, its sound and, for a
 * final consonant, the "at the end" gloss), in teaching order. The state is a
 * shape around the letter, never colour alone: lit (a warm fill and a check),
 * outlined (a ring), or plain. It opens on tap, as the pip legend does, so the
 * open stage stays short; each letter is read by its own label.
 */

const CHECK_SIZE = spacing.md;

const frameOf = (state: LetterState) =>
  ({
    borderRadius: radii.lg,
    borderWidth: borderWidth.base,
    borderColor: state === 'known' ? colors.border.shape : 'transparent',
    backgroundColor: state === 'met' ? colors.brand.primaryLight : 'transparent',
  }) as const;

/** The check on a lit letter: drawn, hidden from screen readers (the label names the state). */
function MetCheck(): React.ReactElement {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: 'absolute', top: spacing.xxs, right: spacing.xxs }}>
      <Icon name="check-circle" size={CHECK_SIZE} color={colors.brand.primaryDark} />
    </View>
  );
}

/** A small letter tile for the legend: the frame of the state around a plain chip. */
function Swatch({ state }: { state: LetterState }): React.ReactElement {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ ...frameOf(state), padding: spacing.xs }}>
      <View
        style={{
          width: spacing.lg,
          height: spacing.lg,
          borderRadius: radii.sm,
          borderWidth: borderWidth.thin,
          borderColor: colors.brand.secondary,
          backgroundColor: colors.brand.secondaryLight,
        }}
      />
      {state === 'met' ? <MetCheck /> : null}
    </View>
  );
}

export function LetterWall({ wall }: { wall: LetterWallView }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <View testID="my-route-letter-wall">
      <Button label={wall.title} tone="ghost" size="sm" onPress={() => setOpen((v) => !v)} expanded={open} />
      {open ? (
        <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
          <Body size="sm" tone="secondary">
            {wall.lead}
          </Body>
          <View style={{ gap: spacing.xs }}>
            {wall.legend.map((line) => (
              <View key={line.state} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Swatch state={line.state} />
                <Body size="sm">{line.word}</Body>
              </View>
            ))}
          </View>
          <View accessibilityRole="list" accessibilityLabel={wall.title} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wall.tiles.map((tile) => (
              <View key={tile.key} testID={`my-route-letter-${tile.state}`} style={{ ...frameOf(tile.state), padding: spacing.xs }}>
                <KoreanText ko={tile.ko} romanization={tile.romanization} gloss={tile.gloss} size="sm" accessibilityLabel={tile.a11yLabel} />
                {tile.state === 'met' ? <MetCheck /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
