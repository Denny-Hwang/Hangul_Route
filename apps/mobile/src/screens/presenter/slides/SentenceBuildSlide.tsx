import { colors, presenter, radii, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { BuildTile } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { sentenceBuildView, type BuildBankPlace } from '../../../logic/lecture/slide-view';
import { BUILD_SLOT_EM, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { KindLabel, useFitLevel } from './ReadingParts';
import { revealProps } from './reveal';

export type SentenceBuildBody = Extract<Slide, { kind: 'sentence-build' }>;

/**
 * Compact levels of a long sentence or a full bank (`useFitLevel`): 1 draws the tiles at
 * `presenter.size.prompt`; 2 draws them, the question and the meaning at `presenter.size.body`.
 * Never below the stage text floor.
 */
const MAX_LEVEL = 2;

/**
 * Sentence build slide (design/screens/presenter/slide-sentence-build.md, V9; AMENDMENTS-LECTURE-V2
 * section 5.2, LV-S3): the kind label; the question ("Which word comes next?", on a particle tile
 * "Which ending fits?") at `presenter.size.prompt`; the sentence line, placed tiles in order and a
 * dashed box per tile still to come, over a `text.primary` stage rule; the whole build's romanization
 * and meaning under it; and the `surface.sunken` bank, the tiles in their shuffled order with the
 * distractors. Each `tile` build moves the next tile to the line and leaves a dashed ghost in its bank
 * place, so nothing in the bank reflows; at `whole` the distractors are set back at
 * `presenter.dimOpacity`, never crossed out or coloured. Every swap is instant (reduced motion or
 * not: nothing travels). A part not reached keeps its space, so nothing above the bank moves. Nothing
 * here takes input; the room points and the teacher clicks.
 */
export function SentenceBuildSlide({ slide, reveal }: { slide: SentenceBuildBody; reveal: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const fit = useFitLevel(MAX_LEVEL, unit);
  const view = sentenceBuildView(slide, reveal);
  const m = messages.learner.presenter.slide.build;
  const tileSize = size(fit.level >= 2 ? presenter.size.body : fit.level >= 1 ? presenter.size.prompt : presenter.size.title);
  const askSize = size(fit.level >= 2 ? presenter.size.body : presenter.size.prompt);
  const romSize = size(presenter.size.body);
  const glossSize = size(fit.level >= 2 ? presenter.size.body : presenter.size.prompt);
  const gap = units(unit, spacing.md);
  const rule = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const tileHeight = useTileHeight(tileSize);
  return (
    <View testID="presenter-build" style={{ flex: 1, gap }}>
      <KindLabel text={m.title} testID="presenter-kind-label" />
      <View onLayout={fit.onRoom} style={{ flex: 1, minHeight: 0 }}>
        <View ref={fit.contentRef} onLayout={fit.onContent} testID="presenter-build-content" {...{ dataSet: { fit: String(fit.level) } }} style={{ gap }}>
          <View {...revealProps(view.ask !== null)}>
            <Text {...KOREAN_LINE_BREAK} testID="presenter-build-ask" style={{ fontSize: askSize, lineHeight: Math.round(askSize * typography.leading.tight), fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {view.ask === 'particle' ? m.particle : m.next}
            </Text>
          </View>
          <View
            testID="presenter-build-line"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap,
              minHeight: tileHeight + 2 * gap,
              padding: gap,
              borderBottomWidth: rule,
              borderColor: colors.text.primary,
            }}
          >
            {slide.tiles.map((tile, i) => {
              const place = view.line[i];
              if (place === 'empty') return <EmptySlot key={i} size={tileSize} height={tileHeight} />;
              if (place === 'choosing') return <ParticleTile key={i} tile={tile} size={tileSize} compact={fit.level >= 1} />;
              return <Tile key={i} ko={tile.ko} size={tileSize} testID="presenter-build-placed" />;
            })}
          </View>
          <View {...revealProps(view.whole)}>
            <View testID="presenter-build-whole" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.xl) }}>
              <Text {...KOREAN_LINE_BREAK} testID="presenter-build-rom" style={{ fontSize: romSize, lineHeight: Math.round(romSize * typography.leading.tight), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
                {slide.sentence.romanization}
              </Text>
              <Text {...KOREAN_LINE_BREAK} testID="presenter-build-gloss" style={{ fontSize: glossSize, lineHeight: Math.round(glossSize * typography.leading.tight), color: colors.text.primary }}>
                {slide.sentence.gloss}
              </Text>
            </View>
          </View>
          <View
            testID="presenter-build-bank"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap,
              minHeight: tileHeight + 2 * units(unit, spacing.lg),
              padding: units(unit, spacing.lg),
              borderRadius: units(unit, STAGE_RADIUS),
              backgroundColor: colors.surface.sunken,
            }}
          >
            {slide.bank.map((place, i) => {
              const ko = 'tile' in place ? bankText(slide.tiles[place.tile]!) : place.distractor.ko;
              return <Tile key={i} ko={ko} size={tileSize} look={view.bank[i]!} testID="presenter-build-bank-tile" />;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

/** A tile as the bank draws it: a particle round's word as its stem (its ending is chosen on the line). */
const bankText = (tile: BuildTile): string => tile.particle?.stem ?? tile.ko;

/** A tile's height: one line of its Korean, `spacing.xs` units above and below, and the stage border (108 units at `presenter.size.title`). */
function useTileHeight(textSize: number): number {
  const { unit } = usePresenterView();
  return Math.round(textSize * typography.leading.tight) + 2 * units(unit, spacing.xs) + 2 * Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
}

/** The look every tile shares: paper, a `text.primary` stage border, `radii.lg` units. A ghost or empty place is dashed in `border.strong`. */
function useTileStyle(dashed: boolean): Record<string, string | number> {
  const { unit } = usePresenterView();
  return {
    borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
    borderColor: dashed ? colors.border.strong : colors.text.primary,
    borderStyle: dashed ? 'dashed' : 'solid',
    borderRadius: units(unit, radii.lg),
    backgroundColor: dashed ? colors.surface.sunken : colors.surface.paper,
    paddingVertical: units(unit, spacing.xs),
    paddingHorizontal: units(unit, spacing.xl),
  };
}

/**
 * A word tile. `ghost`: the dashed place a placed tile leaves in the bank, its Korean kept but not
 * drawn or read, so it holds the tile's size; `set-back`: a distractor at the whole build, at
 * `presenter.dimOpacity` in `text.primary` (the pinned dimmed pair, never crossed out or coloured).
 */
function Tile({ ko, size, look = 'tile', testID }: { ko: string; size: number; look?: BuildBankPlace; testID?: string }): React.ReactElement {
  const ghost = look === 'ghost';
  const style = useTileStyle(ghost);
  const hidden = revealProps(!ghost);
  return (
    <View
      testID={testID}
      aria-hidden={ghost}
      {...{ dataSet: { look } }}
      style={[style, { justifyContent: 'center' }, look === 'set-back' ? { opacity: presenter.dimOpacity } : null]}
    >
      <View style={hidden.style}>
        <TaughtKo size={size}>{ko}</TaughtKo>
      </View>
    </View>
  );
}

/**
 * An empty place on the sentence line: a dashed box `BUILD_SLOT_EM` of the tiles' text wide (200 units
 * at `presenter.size.title`), the same for every place, so no box's size gives a tile away.
 */
function EmptySlot({ size, height }: { size: number; height: number }): React.ReactElement {
  const style = useTileStyle(true);
  return <View testID="presenter-build-slot" aria-hidden style={[style, { width: Math.round(size * BUILD_SLOT_EM), height, backgroundColor: colors.surface.paper }]} />;
}

/**
 * A particle tile on the line before its ending is chosen (slide-sentence-build.md): the stem, then the
 * two endings in dashed boxes with a slash between them, at `presenter.size.prompt` (`compact`: body).
 */
function ParticleTile({ tile, size, compact }: { tile: BuildTile; size: number; compact: boolean }): React.ReactElement {
  const { unit } = usePresenterView();
  const stageSize = useStageText();
  const style = useTileStyle(false);
  const choiceSize = stageSize(compact ? presenter.size.body : presenter.size.prompt);
  const particle = tile.particle!;
  const border = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  return (
    <View testID="presenter-build-particle" style={[style, { flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.sm) }]}>
      <TaughtKo size={size}>{particle.stem}</TaughtKo>
      {particle.choices.map((choice, i) => (
        <React.Fragment key={choice.ko}>
          {i > 0 ? (
            <Text aria-hidden style={{ fontSize: choiceSize, color: colors.text.secondary }}>
              /
            </Text>
          ) : null}
          <View
            testID="presenter-build-choice"
            style={{ borderWidth: border, borderStyle: 'dashed', borderColor: colors.text.primary, borderRadius: units(unit, radii.md), paddingHorizontal: units(unit, spacing.md) }}
          >
            <TaughtKo size={choiceSize}>{choice.ko}</TaughtKo>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
