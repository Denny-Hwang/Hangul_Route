import { colors, koreanTextLabel, presenter, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { BuildName } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import type { LectureSceneView } from '../../../logic/lecture/sources/story';
import { units } from '../../../logic/lecture/stage-constants';
import { romShown } from '../../../logic/lecture/story-slides';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { StoryArt } from './StoryArt';

type StoryBody = Extract<Slide, { kind: 'story' }>;

/**
 * Story scene slide (design/screens/presenter/slide-story.md, README D8): the scene and the
 * narration share the first row, keyword tokens drawn as inline Korean chips; the scene's Korean
 * line and its gloss run full width under them. Builds `art`, `narration`, `korean`, and with
 * `romanization: 'tap'` one `rom` build that shows every romanization on the slide at once (D2).
 * Every word is the story's own (D14). A build that is not reached keeps its space.
 */
export function StorySlide({ slide, shown, scene }: { slide: StoryBody; shown: ReadonlySet<BuildName>; scene: LectureSceneView | undefined }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const bodySize = size(presenter.size.body);
  const promptSize = size(presenter.size.prompt);
  const chipRom = romShown(slide.builds, shown, 'narration');
  const lineRom = romShown(slide.builds, shown, 'korean');
  const reveal = (on: boolean) => ({ opacity: on ? 1 : 0 });
  const chip = {
    borderRadius: units(unit, STAGE_RADIUS),
    borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.secondaryLight,
    // web: an inline chip never breaks between its Korean and its romanization.
    ...noWrap,
  };
  return (
    <View testID="presenter-story" style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: units(unit, STAGE_GAP), minHeight: 0 }}>
        <View style={reveal(shown.has('art'))} accessibilityElementsHidden={!shown.has('art')} aria-hidden={!shown.has('art')}>
          <StoryArt scene={scene} testID="presenter-story-art" />
        </View>
        <Text {...KOREAN_LINE_BREAK}
          testID="presenter-story-narration"
          aria-hidden={!shown.has('narration')}
          style={[{ flex: 1, fontSize: bodySize, color: colors.text.primary, lineHeight: Math.round(bodySize * typography.leading.normal) }, reveal(shown.has('narration'))]}
        >
          {slide.narration.map((piece, i) =>
            'ko' in piece ? (
              // The romanization is named only once it shows, so a screen reader never says it early (D2).
              <Text {...KOREAN_LINE_BREAK} key={i} testID="presenter-story-chip" accessibilityLabel={chipRom ? koreanTextLabel(piece.ko, piece.romanization) : piece.ko} style={chip}>
                {' '}
                <TaughtKo size={bodySize}>{piece.ko}</TaughtKo>
                {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
                <Text {...KOREAN_LINE_BREAK} aria-hidden={!chipRom} style={[{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary }, reveal(chipRom)]}>
                  {` ${piece.romanization} `}
                </Text>
              </Text>
            ) : (
              <React.Fragment key={i}>{piece.text}</React.Fragment>
            ),
          )}
        </Text>
      </View>
      {slide.korean !== undefined ? (
        <View testID="presenter-story-korean" style={[{ gap: units(unit, spacing.xs), alignItems: 'flex-start' }, reveal(shown.has('korean'))]} accessibilityElementsHidden={!shown.has('korean')} aria-hidden={!shown.has('korean')}>
          <View
            testID="presenter-story-korean-line"
            accessibilityLabel={lineRom ? koreanTextLabel(slide.korean.ko, slide.korean.romanization) : slide.korean.ko}
            style={{
              ...chip,
              flexDirection: 'row',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: units(unit, spacing.md),
              paddingVertical: units(unit, spacing.xs),
              paddingHorizontal: units(unit, spacing.lg),
            }}
          >
            <TaughtKo size={promptSize}>{slide.korean.ko}</TaughtKo>
            <Text {...KOREAN_LINE_BREAK} aria-hidden={!lineRom} style={[{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary }, reveal(lineRom)]}>{slide.korean.romanization}</Text>
          </View>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, fontWeight: typography.weight.bold, color: colors.text.secondary, lineHeight: Math.round(bodySize * typography.leading.tight) }}>
            {slide.korean.gloss}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** `white-space: nowrap` (web); not in the native text style types. */
const noWrap = { whiteSpace: 'nowrap' } as unknown as Record<string, never>;
