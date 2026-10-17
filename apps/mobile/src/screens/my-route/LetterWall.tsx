import { Body, Button, Icon, KoreanText, borderWidth, colors, radii, spacing, useEffectiveFontScale } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { View } from 'react-native';
import { letterTileWidth, type LetterState, type LetterWallView } from '../../logic/my-route/letter-wall';

/**
 * The letter wall of the open Stage 1 (F-ROUTE-001 R-7c, section 3.11;
 * wireframe `design/wireframes/journey/my-route-overview.md` B). Every Stage 1
 * letter as taught content (`KoreanText`: the letter, its sound and, for a
 * final consonant, the "at the end" gloss), in teaching order. The state is a
 * shape around the letter, never colour alone: lit (a warm fill and a check),
 * outlined (a ring), or plain. It opens on tap, as the pip legend does, so the
 * open stage stays short; each letter is read by its own label.
 */

/**
 * One width for every tile, so the wall is an even grid (three across at 320 wide) and a gloss
 * wraps under its letter. It grows with the device text size (`letterTileWidth`), so a large
 * letter chip stays inside its tile and the row wraps to fewer tiles instead.
 */
const TILE_WIDTH = spacing.jumbo + spacing.sm;

const frameOf = (state: LetterState) =>
  ({
    borderRadius: radii.lg,
    borderWidth: borderWidth.base,
    borderColor: state === 'known' ? colors.border.shape : 'transparent',
    backgroundColor: state === 'met' ? colors.brand.primaryLight : 'transparent',
  }) as const;

/** The check on a lit letter: a drawn badge on paper, hidden from screen readers (the label names the state). */
function MetCheck({ size }: { size: number }): React.ReactElement {
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ position: 'absolute', top: 0, right: 0, padding: spacing.xxs, borderRadius: radii.pill, backgroundColor: colors.surface.paper }}
    >
      <Icon name="check-circle" size={size} color={colors.brand.primaryDark} />
    </View>
  );
}

/** A small letter tile for the legend: the frame of the state around a plain chip. */
function Swatch({ state }: { state: LetterState }): React.ReactElement {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ ...frameOf(state), padding: spacing.sm }}>
      <View
        style={{
          width: spacing.xl,
          height: spacing.xl,
          borderRadius: radii.sm,
          borderWidth: borderWidth.thin,
          borderColor: colors.brand.secondary,
          backgroundColor: colors.brand.secondaryLight,
        }}
      />
      {state === 'met' ? <MetCheck size={spacing.md} /> : null}
    </View>
  );
}

export function LetterWall({ wall }: { wall: LetterWallView }): React.ReactElement {
  const [open, setOpen] = useState(false);
  // OS text size x the chosen Display text size (owner items 6 and 7).
  const fontScale = useEffectiveFontScale();
  const tileWidth = letterTileWidth(TILE_WIDTH, fontScale);
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
              <View
                key={tile.key}
                role="listitem"
                testID={`my-route-letter-${tile.state}`}
                style={{ ...frameOf(tile.state), width: tileWidth, maxWidth: '100%', paddingVertical: spacing.xs, paddingHorizontal: spacing.xxs }}
              >
                <KoreanText ko={tile.ko} romanization={tile.romanization} gloss={tile.gloss} size="sm" accessibilityLabel={tile.a11yLabel} />
                {tile.state === 'met' ? <MetCheck size={spacing.lg} /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
