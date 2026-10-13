import { Body, KoreanText, Progress, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { VocabTopic } from '@hangul-route/content-schema';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { TopicTileView } from '../../logic/vocab/topic-view';
import { PictureArt } from '../minigames/PictureArt';

/** Padding inside a tile and its border, per side: the cover is at most the tile's width less these. */
export const TOPIC_TILE_PADDING = spacing.md;
export const TOPIC_TILE_CHROME = 2 * (TOPIC_TILE_PADDING + borderWidth.base);

/** The topic tint (`theme.*` or `stage.stage2`): a border accent only, never a text colour. */
function tintColor(tint: VocabTopic['tint']): string {
  switch (tint) {
    case 'theme.letters':
      return colors.theme.letters;
    case 'theme.life':
      return colors.theme.life;
    case 'theme.rites':
      return colors.theme.rites;
    case 'theme.nature':
      return colors.theme.nature;
    case 'theme.crafts':
      return colors.theme.crafts;
    case 'stage.stage2':
      return colors.stage.stage2;
  }
}

/** Hides a view and everything in it from assistive technology on the web, iOS and Android. */
const HIDDEN = { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * One Words topic (F-VOC-003 §3.3): the cover picture, the title in the UI
 * language, the Korean title (`KoreanText`), a fill-only bar and the plain
 * count. The whole tile is one button (>= 80 dp) named "Food. 5 words
 * collected."; the bar is hidden from assistive technology because the count
 * is in the name. The tint is the border. A locked tile (gating on only, D5)
 * is drawn closed (F-ENT-003 OD-6): the sunken surface, a dotted border and
 * "Not open yet" in place of the meter and count; no lock glyph, no price.
 * Design: design/screens/vocab/topics.md.
 */
export function TopicTile({
  view,
  width,
  artSize,
  onPress,
  hint,
  testID,
}: {
  view: TopicTileView;
  /** The tile's outer width in dp (one grid cell). */
  width: number;
  /** The cover's side, already capped at the tile's inner width. */
  artSize: number;
  onPress: () => void;
  /** A closed tile's hint: the ask by audience (`askFor`, F-ENT-003 section 3.7). */
  hint?: string;
  testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        width,
        flexGrow: 1,
        minHeight: touchTarget.child,
        padding: TOPIC_TILE_PADDING,
        gap: spacing.sm,
        backgroundColor: view.locked ? colors.surface.sunken : colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: borderWidth.base,
        borderStyle: view.locked ? 'dotted' : 'solid',
        borderColor: pressed ? colors.border.focus : view.locked ? colors.border.shape : tintColor(view.tint),
      })}
    >
      <View style={{ alignItems: 'center' }}>
        <PictureArt pictureRef={view.cover.pictureRef} gloss={view.cover.gloss} size={artSize} decorative />
      </View>
      <Body weight="semibold">{view.title}</Body>
      <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        <KoreanText ko={view.ko} romanization={view.romanization} romanizationShown={view.romanizationShown} size="sm" />
      </View>
      {view.locked ? null : (
        <View {...HIDDEN}>
          <Progress variant="bar" value={view.collected} max={Math.max(view.total, 1)} height={spacing.sm} />
        </View>
      )}
      <Body weight="semibold" tone="secondary">
        {view.countLine}
      </Body>
    </Pressable>
  );
}
