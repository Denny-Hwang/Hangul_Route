import { KoreanText, borderWidth, colors, radii, spacing, touchTarget, useLayoutClass, useEffectiveFontScale } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { contentWidth, gridCellWidth, gridRows } from '../../logic/layout/pane-sizes';
import { wallArtSize, wallColumns, type WallTileView } from '../../logic/vocab/topic-view';
import { PictureArt } from '../minigames/PictureArt';

const GAP = spacing.sm;
/** A wall tile's padding and border, per side. */
const TILE_PADDING = spacing.xs;
const TILE_CHROME = 2 * (TILE_PADDING + borderWidth.base);

/**
 * The word wall of a topic page (F-VOC-003 §3.4): every word of the topic in
 * file order, never re-sorted. A collected word shows its picture and its
 * Korean (`KoreanText`: romanization per the learner's setting, and the
 * meaning in the UI language, D2); a new word
 * shows a soft silhouette named "Not collected yet" and no Korean. Columns are
 * as many 120 dp tiles as fit (`wallColumns`), so every word stays whole.
 * `onOpen` makes the collected tiles buttons (once the flashcards exist,
 * `VOCAB_SCREENS.learn`). Design: design/screens/vocab/topic.md.
 */
export function WordWall({
  tiles,
  onOpen,
}: {
  tiles: readonly WallTileView[];
  onOpen?: (id: string) => void;
}): React.ReactElement {
  // OS text size x the chosen Display text size (owner items 6 and 7).
  const fontScale = useEffectiveFontScale();
  const lc = useLayoutClass();
  const [measured, setMeasured] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent): void => {
    const width = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev === width ? prev : width));
  };
  const gridWidth = measured ?? contentWidth(lc.windowWidth, lc.gutter, lc.maxWidth.reading);
  const columns = wallColumns(gridWidth, GAP, fontScale);
  const cellWidth = gridCellWidth(gridWidth, columns, GAP);
  const art = wallArtSize(cellWidth, TILE_CHROME);

  return (
    <View role="list" style={{ gap: GAP }} onLayout={onLayout} testID="vocab-word-wall">
      {gridRows(tiles, columns).map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: GAP, alignItems: 'stretch' }}>
          {row.map((tile, i) =>
            tile ? (
              <View key={tile.id} role="listitem" style={{ width: cellWidth }}>
                <WallTile tile={tile} art={art} onOpen={onOpen} />
              </View>
            ) : (
              <View key={`pad-${i}`} style={{ width: cellWidth }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function WallTile({ tile, art, onOpen }: { tile: WallTileView; art: number; onOpen?: (id: string) => void }): React.ReactElement {
  const frame = {
    flexGrow: 1,
    minHeight: touchTarget.min,
    alignItems: 'center' as const,
    gap: spacing.xs,
    padding: TILE_PADDING,
    borderRadius: radii.lg,
    borderWidth: borderWidth.base,
  };

  if (tile.state === 'new') {
    // One element named "Not collected yet": the silhouette is drawn hidden, and no Korean shows (no spoilers).
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={tile.accessibilityLabel}
        testID={`vocab-wall-${tile.id}`}
        style={{ ...frame, borderColor: 'transparent' }}
      >
        <PictureArt pictureRef={tile.pictureRef} gloss="" size={art} mono />
      </View>
    );
  }

  const body = (
    <>
      <PictureArt pictureRef={tile.pictureRef} gloss={tile.gloss} size={art} decorative />
      <KoreanText
        ko={tile.ko}
        romanization={tile.romanization}
        romanizationShown={tile.romanizationShown}
        gloss={tile.gloss}
        size="sm"
        accessibilityLabel={tile.accessibilityLabel}
      />
    </>
  );

  if (!onOpen) {
    return (
      <View testID={`vocab-wall-${tile.id}`} style={{ ...frame, borderColor: 'transparent' }}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onOpen(tile.id)}
      accessibilityRole="button"
      accessibilityLabel={tile.accessibilityLabel}
      testID={`vocab-wall-${tile.id}`}
      style={({ pressed }) => ({ ...frame, borderColor: pressed ? colors.border.focus : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}
