import {
  Body,
  Caption,
  KOREAN_LANGUAGE,
  KoreanText,
  RouteTag,
  TagMark,
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
import { storyCoverVariant, storyTileCoverWidth, type StoryTileView } from '../../logic/story/story-tile';

/** Padding inside a tile; the cover fills the rest of the tile's width. */
const TILE_PADDING = spacing.sm;
const TILE_CHROME = 2 * TILE_PADDING + 2 * borderWidth.base;
const STAR_SIZE = spacing.lg;
// Speech language for the Korean title on the fallback tint; `lang` is forwarded to the DOM on the web.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** Lines of the Korean title on the fallback tint; the full title is always in the `KoreanText` below. */
const FALLBACK_LINES = 3;
/**
 * The fallback title grows with the OS text size only this far: it sits in the fixed 4:3 cover box, so
 * at 200 % text three lines would overflow it and be clipped mid-glyph. The `KoreanText` below the
 * cover carries the full title at the learner's text size.
 */
const FALLBACK_MAX_FONT_SCALE = 1.3;

/**
 * The Korean title centred on the theme tint: the cover of a story whose cover
 * scene has no art yet, or whose art does not resolve (§3.4 error state). The
 * type steps down on a narrow cover so a long title stays inside the 4:3 box.
 */
export function CoverFallback({ ko, coverWidth }: { ko: string; coverWidth: number }): React.ReactElement {
  const size = storyCoverVariant(coverWidth) === 'thumb' ? typography.size.bodyLg : typography.size.title;
  return (
    <Text
      {...koreanSpeech}
      numberOfLines={FALLBACK_LINES}
      maxFontSizeMultiplier={FALLBACK_MAX_FONT_SCALE}
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
 * (>= 64 dp) whose label carries title, state and duration. A closed tile
 * (free-plan switch on only) shows the dotted ring and "Not open yet", and its hint is the ask; a
 * story in the plan carries the In your plan tag (F-ENT-003 section 3.7). Design:
 * design/components/StoryTile/spec.md, wireframe design/wireframes/library/stories.md B, G, H,
 * design/wireframes/library/access-and-plan-tags.md, design/components/RouteMarkers/spec.md.
 */
export function StoryTile({
  view,
  width,
  romanizationShown,
  onPress,
  hint,
  inPlanLabel,
  testID,
}: {
  view: StoryTileView;
  /** A closed tile's hint: the ask label (`askFor`). */
  hint?: string;
  /** The In your plan word when the story is in the plan (the chip on its own line under the minutes). */
  inPlanLabel?: string;
  /**
   * D2: false when the profile hides romanization until a tap. The whole tile is one button, so the
   * shelf has no tap-to-reveal: the romanization is left off here and revealed in the reader.
   */
  romanizationShown: boolean;
  /** The tile's outer width in dp (one grid cell). */
  width: number;
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  const coverWidth = storyTileCoverWidth(width, TILE_CHROME);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={hint}
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
          variant={storyCoverVariant(coverWidth)}
          width={coverWidth}
          decorative
          fallback={<CoverFallback ko={view.ko} coverWidth={coverWidth} />}
        />
      ) : null}
      <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
        <Body weight="semibold">{view.titleEn}</Body>
        <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
          <KoreanText ko={view.ko} romanization={view.romanization} romanizationShown={romanizationShown} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          {view.locked ? <TagMark kind="notOpen" testID="story-tile-not-open" /> : null}
          {view.stateLine ? (
            <Body size="sm" weight="semibold" tone="secondary">
              {view.stateLine}
            </Body>
          ) : null}
          {view.stars > 0 ? <StarRow stars={view.stars} size={STAR_SIZE} /> : null}
        </View>
        <Caption tone="muted">{view.minutesLine}</Caption>
        {inPlanLabel ? <RouteTag kind="inPlan" label={inPlanLabel} testID="story-tile-in-plan" /> : null}
      </View>
    </Pressable>
  );
}
