import { colors, presenter, radii, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import type { BuildTile } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { buildPlaceWidth, sentenceBuildView, type BuildBankPlace } from '../../../logic/lecture/slide-view';
import { units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { KindLabel, useFitLevel } from './ReadingParts';
import { revealProps } from './reveal';

export type SentenceBuildBody = Extract<Slide, { kind: 'sentence-build' }>;

/**
 * Compact levels of a long sentence or a full bank (`useFitLevel`): 1 draws the tiles at
 * `presenter.size.prompt` (a particle tile's endings at `presenter.size.body`); 2 draws the tiles, the
 * question and the meaning at `presenter.size.body` (the endings at `presenter.size.caption`). Never
 * below the stage text floor. Every build of the slide has the same height (the line's places keep one
 * size), so the level the bank build finds holds to the end.
 */
const MAX_LEVEL = 2;

/**
 * Sentence build slide (design/screens/presenter/slide-sentence-build.md, V9; AMENDMENTS-LECTURE-V2
 * section 5.2, LV-S3): the kind label; the question ("Which word comes next?", on a particle tile
 * "Which ending fits?") at `presenter.size.prompt`; the sentence line, placed tiles in order and a
 * dashed place per tile still to come, over a `text.primary` stage rule; the whole build's romanization
 * and meaning under it; and the `surface.sunken` bank, the tiles in their shuffled order with the
 * distractors. Each `tile` build moves the next tile to the line and leaves a dashed ghost in its bank
 * place, so nothing in the bank reflows; at `whole` the distractors are set back at
 * `presenter.dimOpacity`, never crossed out or coloured. Every place on the line has one size (the
 * widest tile's, `buildPlaceWidth`), so the line never reflows and no empty place gives its tile away.
 * Every swap is instant (nothing travels, reduced motion or not). A part not reached keeps its space.
 * Nothing here takes input; the room points and the teacher clicks.
 */
export function SentenceBuildSlide({ slide, reveal }: { slide: SentenceBuildBody; reveal: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const fit = useFitLevel(MAX_LEVEL, unit);
  const view = sentenceBuildView(slide, reveal);
  const m = messages.learner.presenter.slide.build;
  const tileSize = size(fit.level >= 2 ? presenter.size.body : fit.level >= 1 ? presenter.size.prompt : presenter.size.title);
  const choiceSize = size(fit.level >= 2 ? presenter.size.caption : fit.level >= 1 ? presenter.size.body : presenter.size.prompt);
  const askSize = size(fit.level >= 2 ? presenter.size.body : presenter.size.prompt);
  const romSize = size(presenter.size.body);
  const glossSize = size(fit.level >= 2 ? presenter.size.body : presenter.size.prompt);
  const gap = units(unit, spacing.md);
  const border = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const tile: TileMetrics = {
    size: tileSize,
    choiceSize,
    border,
    padX: units(unit, spacing.xl),
    padY: units(unit, spacing.xs),
    inner: units(unit, spacing.sm),
    choicePadX: units(unit, spacing.md),
    radius: units(unit, radii.lg),
  };
  // One line of the tile's Korean, or of an ending in its dashed box, whichever is taller, inside the padding and border.
  const lineOf = (n: number): number => Math.round(n * typography.leading.tight);
  const placeHeight = Math.max(lineOf(tileSize), lineOf(choiceSize) + 2 * border) + 2 * (tile.padY + border);
  const placeWidth = buildPlaceWidth(slide, { tile: tileSize, choice: choiceSize, padX: tile.padX, border, gap: tile.inner, choicePadX: tile.choicePadX });
  const place: ViewStyle = { width: placeWidth, height: placeHeight };
  const whole = revealProps(view.whole);
  return (
    <View testID="presenter-build" style={{ flex: 1, gap }}>
      <KindLabel text={m.title} testID="presenter-kind-label" />
      <View onLayout={fit.onRoom} style={{ flex: 1, minHeight: 0 }}>
        <View ref={fit.contentRef} onLayout={fit.onContent} testID="presenter-build-content" {...{ dataSet: { fit: String(fit.level) } }} style={{ gap }}>
          <View {...revealProps(view.ask !== null)}>
            <Text {...KOREAN_LINE_BREAK} testID="presenter-build-ask" style={{ fontSize: askSize, lineHeight: lineOf(askSize), fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {view.ask === 'particle' ? m.particle : m.next}
            </Text>
          </View>
          <View
            testID="presenter-build-line"
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap, padding: gap, borderBottomWidth: border, borderColor: colors.text.primary }}
          >
            {slide.tiles.map((t, i) => {
              const state = view.line[i];
              if (state === 'empty') return <View key={i} testID="presenter-build-slot" aria-hidden style={[tileLook(tile, 'dashed'), place, { backgroundColor: colors.surface.paper }]} />;
              if (state === 'choosing') return <ParticleTile key={i} tile={t} metrics={tile} place={place} />;
              return <Tile key={i} ko={t.ko} metrics={tile} place={place} testID="presenter-build-placed" />;
            })}
          </View>
          <View
            testID="presenter-build-whole"
            aria-hidden={whole['aria-hidden']}
            style={[whole.style, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.xl) }]}
          >
            <Text {...KOREAN_LINE_BREAK} testID="presenter-build-rom" style={{ fontSize: romSize, lineHeight: lineOf(romSize), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
              {slide.sentence.romanization}
            </Text>
            <Text {...KOREAN_LINE_BREAK} testID="presenter-build-gloss" style={{ fontSize: glossSize, lineHeight: lineOf(glossSize), color: colors.text.primary }}>
              {slide.sentence.gloss}
            </Text>
          </View>
          <View
            testID="presenter-build-bank"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap,
              minHeight: placeHeight + 2 * units(unit, spacing.lg),
              padding: units(unit, spacing.lg),
              borderRadius: units(unit, STAGE_RADIUS),
              backgroundColor: colors.surface.sunken,
            }}
          >
            {slide.bank.map((p, i) => (
              <Tile key={i} ko={'tile' in p ? bankText(slide.tiles[p.tile]!) : p.distractor.ko} metrics={tile} place={{ height: placeHeight }} look={view.bank[i]!} testID="presenter-build-bank-tile" />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** A tile's sizes in pixels at the slide's fit level. */
interface TileMetrics {
  size: number;
  choiceSize: number;
  border: number;
  padX: number;
  padY: number;
  /** The gap between a particle tile's stem, its endings and the slash. */
  inner: number;
  choicePadX: number;
  radius: number;
}

/** A tile as the bank draws it: a particle round's word as its stem (its ending is chosen on the line). */
const bankText = (tile: BuildTile): string => tile.particle?.stem ?? tile.ko;

/**
 * The look every tile shares: paper, a `text.primary` stage border, `radii.lg` units; `dashed` (an
 * empty place, a ghost): a dashed `border.strong` border on the ground under it.
 */
function tileLook(m: TileMetrics, line: 'solid' | 'dashed'): ViewStyle {
  const dashed = line === 'dashed';
  return {
    borderWidth: m.border,
    borderColor: dashed ? colors.border.strong : colors.text.primary,
    borderStyle: line,
    borderRadius: m.radius,
    backgroundColor: dashed ? colors.surface.sunken : colors.surface.paper,
    paddingVertical: m.padY,
    paddingHorizontal: m.padX,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/**
 * A word tile. On the line it takes the place's one size; in the bank its own width. `ghost`: the
 * dashed place a placed tile leaves in the bank, its Korean kept but neither drawn nor read, so it
 * holds the tile's size; `set-back`: a distractor at the whole build, at `presenter.dimOpacity` in
 * `text.primary` (the pinned dimmed pair, never crossed out or coloured).
 */
function Tile({ ko, metrics, place, look = 'tile', testID }: { ko: string; metrics: TileMetrics; place: ViewStyle; look?: BuildBankPlace; testID?: string }): React.ReactElement {
  const ghost = look === 'ghost';
  return (
    <View
      testID={testID}
      aria-hidden={ghost}
      {...{ dataSet: { look } }}
      style={[tileLook(metrics, ghost ? 'dashed' : 'solid'), place, look === 'set-back' ? { opacity: presenter.dimOpacity } : null]}
    >
      <View style={revealProps(!ghost).style}>
        <TaughtKo size={metrics.size}>{ko}</TaughtKo>
      </View>
    </View>
  );
}

/**
 * A particle tile on the line before its ending is chosen (slide-sentence-build.md): the stem, then the
 * two endings in dashed `text.primary` boxes with a slash between them, smaller than the stem.
 */
function ParticleTile({ tile, metrics, place }: { tile: BuildTile; metrics: TileMetrics; place: ViewStyle }): React.ReactElement {
  const particle = tile.particle!;
  return (
    <View testID="presenter-build-particle" style={[tileLook(metrics, 'solid'), place, { flexDirection: 'row', gap: metrics.inner }]}>
      <TaughtKo size={metrics.size}>{particle.stem}</TaughtKo>
      {particle.choices.map((choice, i) => (
        <React.Fragment key={choice.ko}>
          {i > 0 ? (
            <Text aria-hidden style={{ fontSize: metrics.choiceSize, color: colors.text.secondary }}>
              /
            </Text>
          ) : null}
          <View
            testID="presenter-build-choice"
            style={{ borderWidth: metrics.border, borderStyle: 'dashed', borderColor: colors.text.primary, borderRadius: metrics.radius, paddingHorizontal: metrics.choicePadX }}
          >
            <TaughtKo size={metrics.choiceSize}>{choice.ko}</TaughtKo>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
