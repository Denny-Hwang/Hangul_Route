import {
  Body,
  Caption,
  Icon,
  KOREAN_LANGUAGE,
  KoreanText,
  StarRow,
  StoryScene,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StoryTileView } from '../../logic/story/story-tile';

/** Padding inside a tile; the cover fills the rest of the tile's width. */
const TILE_PADDING = spacing.sm;
const TILE_CHROME = 2 * TILE_PADDING + 2 * borderWidth.base;
/** Below this cover width the scene is drawn as a thumbnail (detail shapes and hairlines dropped). */
const THUMB_BELOW = 240;
const STAR_SIZE = spacing.lg;
// Speech language for the Korean title on the fallback tint; `lang` is forwarded to the DOM on the web.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** The cover width for a tile `width` wide (its padding and border taken off); never negative. */
export function storyTileCoverWidth(width: number): number {
  return Math.max(0, Math.floor(width - TILE_CHROME));
}

/** Lines of the Korean title on the fallback tint; the full title is always in the `KoreanText` below. */
const FALLBACK_LINES = 3;

/**
 * The Korean title centred on the theme tint: the cover of a story whose cover
 * scene has no art yet, or whose art does not resolve (§3.4 error state). The
 * type steps down on a narrow cover so a long title stays inside the 4:3 box.
 */
export function CoverFallback({ ko, coverWidth }: { ko: string; coverWidth: number }): React.ReactElement {
  const size = coverWidth < THUMB_BELOW ? typography.size.bodyLg : typography.size.title;
  return (
    <Text
      {...koreanSpeech}
      numberOfLines={FALLBACK_LINES}
      style={{
        fontFamily: typography.family.sansKr,
        fontSize: size,
        fontWeight: typography.weight.bold,
        lineHeight: size * typography.leading.normal,
        color: colors.text.primary,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
      }}
    >
      {ko}
    </Text>
  );
}

/**
 * One story on the shelf (F-STORY-004 §3.4): the cover (4:3, or the theme
 * tint with the Korean title), the English title, the Korean title with its
 * romanization (`KoreanText`), "about N min" and a state line in words, with
 * stars only on a finish that earned some. The whole tile is one button
 * (>= 64 dp) whose label carries title, state and duration. A locked tile
 * (gating on only) shows the lock and "Locked". Design:
 * design/components/StoryTile/spec.md, wireframe design/wireframes/library/stories.md B, G, H.
 */
export function StoryTile({
  view,
  width,
  onPress,
  testID,
}: {
  view: StoryTileView;
  /** The tile's outer width in dp (one grid cell). */
  width: number;
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  const coverWidth = storyTileCoverWidth(width);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      style={({ pressed }) => ({
        width,
        minHeight: touchTarget.min,
        padding: TILE_PADDING,
        gap: spacing.sm,
        backgroundColor: view.locked ? colors.surface.sunken : colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: borderWidth.base,
        borderColor: pressed ? colors.border.focus : colors.border.subtle,
      })}
    >
      {coverWidth > 0 ? (
        <StoryScene
          art={view.cover}
          theme={view.theme}
          variant={coverWidth < THUMB_BELOW ? 'thumb' : 'full'}
          width={coverWidth}
          decorative
          fallback={<CoverFallback ko={view.ko} coverWidth={coverWidth} />}
        />
      ) : null}
      <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
        <Body weight="semibold">{view.titleEn}</Body>
        <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
          <KoreanText ko={view.ko} romanization={view.romanization} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          {view.locked ? <Icon name="lock" size={STAR_SIZE} color={colors.text.secondary} /> : null}
          <Body size="sm" weight="semibold" tone="secondary">
            {view.stateLine}
          </Body>
          {view.stars > 0 ? <StarRow stars={view.stars} size={STAR_SIZE} /> : null}
        </View>
        <Caption tone="muted">{view.minutesLine}</Caption>
      </View>
    </Pressable>
  );
}
