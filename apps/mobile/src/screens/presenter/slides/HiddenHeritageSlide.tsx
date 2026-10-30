import { borderWidth, colors, layout, presenter, radii, resolveColor, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { HiddenHeritageScene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { HIDDEN_HERITAGE_RINGS } from '@hangul-route/design-system/src/scene-art/hidden-heritage/types';
import { useEffect, useState, type ReactElement } from 'react';
import { Text, View } from 'react-native';
import { PictureArt } from '../../../components/PictureArt';
import { partsShown } from '../../../logic/lecture/build-steps';
import { stageSceneOn } from '../../../logic/lecture/hidden-heritage-stage';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { PIC_MD, units } from '../../../logic/lecture/stage-constants';
import { useRemoteConfigStore } from '../../../store/remote-config-store';
import { loadHiddenHeritageChunk, loadScene } from '../../minigames/hidden-heritage-scenes';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { KindLabel } from './ReadingParts';
import { revealProps } from './reveal';

type HiddenHeritageBody = Extract<Slide, { kind: 'hidden-heritage' }>;
type Chunk = typeof import('../../minigames/hidden-heritage-chunk');
type Loaded = { scene: HiddenHeritageScene; ui: Chunk };

/** The scene on the stage: the learner's widest scene (`layout.maxWidth.reading`, 720 stage units), 4:3. */
const SCENE_W = layout.maxWidth.reading;

/**
 * Hidden Heritage slide (F-CURR-002 §8, row CM-36; design/wireframes/minigame/hidden-heritage.md D, mock
 * design/screens/journey-topic-pages/mock/hidden-heritage-slide.html): a whole-class scene hunt. The kind label "Find
 * it together", the scene, and beside it the Korean word at `presenter.size.display` with its romanization; builds
 * `ko` (the scene and the word), `gloss` (the meaning), `answer` (the found ring on the thing's spot). The class looks
 * and points; nothing is scored and nobody's name is on the stage. The scene is its own lazy chunk; until it is in, or
 * when it cannot load, or while the switch is off (`stageSceneOn`), the target's own bundled picture stands in.
 */
export function HiddenHeritageSlide({ slide, reveal }: { slide: HiddenHeritageBody; reveal: number }): ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  // The scene and its renderer are lazy chunks (the game's): the target's own picture stands in until both are in.
  const sceneOn = useRemoteConfigStore((s) => stageSceneOn(s.cache));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!sceneOn) {
      setLoaded(null);
      return undefined;
    }
    let live = true;
    void Promise.all([loadScene(slide.sceneId), loadHiddenHeritageChunk()]).then(
      ([scene, ui]) => live && setLoaded(scene ? { scene, ui } : null),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [slide.sceneId, sceneOn]);

  const parts = partsShown(slide.builds, reveal);
  const romShown = parts.find((p) => p.name === 'ko')?.rom === true;
  const glossShown = parts.some((p) => p.name === 'gloss');
  const ringShown = parts.some((p) => p.name === 'answer');
  const width = units(unit, SCENE_W);
  const thick = Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.thick));
  const thin = Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.thin));
  const casing = resolveColor(HIDDEN_HERITAGE_RINGS.casing);
  const promptSize = size(presenter.size.prompt);
  const titleSize = size(presenter.size.title);
  return (
    <View testID="presenter-hidden-heritage" style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
      <KindLabel text={messages.learner.presenter.grid.kind.hiddenHeritage} testID="presenter-kind-label" />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP), minHeight: 0 }}>
        {sceneOn && loaded ? (
          <View accessible accessibilityRole="image" accessibilityLabel={slide.alt} testID="presenter-hh-scene" style={{ width, height: (width * 3) / 4, borderRadius: units(unit, STAGE_RADIUS), overflow: 'hidden' }}>
            <loaded.ui.HiddenHeritageSceneArt scene={loaded.scene} width={width} />
            {ringShown ? (
              <View testID="presenter-hh-ring" pointerEvents="none" style={{ position: 'absolute', ...loaded.ui.spotRect(slide.spot, width), borderWidth: thin, borderColor: casing, borderRadius: units(unit, radii.md) }}>
                <View style={{ flex: 1, borderWidth: thick, borderColor: resolveColor(HIDDEN_HERITAGE_RINGS.found), borderRadius: units(unit, radii.md) }}>
                  <View style={{ flex: 1, borderWidth: thin, borderColor: casing, borderRadius: units(unit, radii.md) }} />
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <PictureArt
            pictureRef={slide.picture}
            gloss={glossShown ? slide.word.gloss : ''}
            size={units(unit, PIC_MD)}
            tile={{ padding: units(unit, spacing.md), border: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)), radius: units(unit, STAGE_RADIUS) }}
            testID="presenter-hh-picture"
          />
        )}
        <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
          <TaughtKo size={size(presenter.size.display)} testID="presenter-hh-ko">
            {slide.word.ko}
          </TaughtKo>
          <View {...revealProps(romShown)}>
            <Text {...KOREAN_LINE_BREAK} testID="presenter-hh-rom" style={{ fontSize: promptSize, lineHeight: Math.round(promptSize * typography.leading.tight), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
              {slide.word.romanization}
            </Text>
          </View>
          <View {...revealProps(glossShown)} style={[revealProps(glossShown).style, { gap: units(unit, STAGE_GAP_INNER) }]}>
            <View style={{ borderTopWidth: thick, borderColor: colors.border.subtle }} />
            <Text {...KOREAN_LINE_BREAK} testID="presenter-hh-gloss" style={{ fontSize: titleSize, lineHeight: Math.round(titleSize * typography.leading.tight), color: colors.text.primary }}>
              {slide.word.gloss}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
