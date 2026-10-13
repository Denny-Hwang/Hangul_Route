import {
  Body,
  Button,
  Caption,
  Heading,
  Hoya,
  HoyaBubble,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, Text, View, type PressableStateCallbackType } from 'react-native';
import { episodesAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
import { completeStages } from '../../logic/my-route/latch';
import {
  ownsStagePrize,
  stageCompleteActions,
  stagePrizeCards,
  symbolWall,
  wallTileLabel,
  type WallTile,
} from '../../logic/stage1/stage-complete';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { CardArtThumb } from './CardArtThumb';

/**
 * F-QUEST-002 §3.8 — the Stage 1 prize ceremony (wireframe `design/wireframes/results/stage1-complete.md`).
 * Opened from Results on the run that completed Stage 1, and again from the Journey Stage 1 header
 * (never automatically a second time). It shows only to a learner who holds the prize cards. Hoya cheering, the wall of all 30
 * symbols (every one lit, never counted, D3), the legendary cards (each opens its card), one
 * primary See my cards and Back home as a ghost. No Premium pill and no purchase (D5). It writes
 * nothing: the awards were written with the Results score.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'StageComplete'>;

/** react-native-web also reports keyboard focus to the style callback. */
type TileState = PressableStateCallbackType & { focused?: boolean };

/** A wall tile is not a target; the nearest size token keeps the glyph and its sound value roomy. */
const WALL_TILE = touchTarget.min;

export function StageCompleteScreen({ route, navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.stageComplete;
  const locale = useLocale();
  const { stageKey } = route.params;
  const profile = useProfileStore(activeProfileSelector);
  const snapshot = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const complete = useMemo(() => (snapshot ? completeStages(snapshot, episodesAll).has(stageKey) : false), [snapshot, stageKey]);
  const cards = useMemo(() => stagePrizeCards(stageKey).map((c) => localizeCard(c, locale)), [stageKey, locale]);
  const wall = useMemo(() => symbolWall(), []);
  // The learner holds every prize card: a stage Complete by the old latch alone never shows cards it does not own.
  const owned = useMemo(() => (snapshot ? ownsStagePrize(snapshot.cards, stageKey) : false), [snapshot, stageKey]);
  const ready = complete && owned && cards.length > 0;

  const goHome = (): void => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  };
  // The Library opens on its Cards section, whichever section it was left on.
  const seeCards = (): void => navigation.navigate('Main', { screen: 'Library', params: { section: 'cards' } });

  if (!ready) {
    return (
      <Screen tone="canvas" scrollable>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }} testID="stage-complete-not-ready">
          <Hoya pose="thinking" size={120} accessibilityLabel={messages.a11y.hoya('thinking')} />
          <Spacer size="lg" />
          <Body align="center">{m.notFound}</Body>
          <Spacer size="xl" />
          <Button label={m.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }} testID="stage-complete">
        <Hoya pose="cheering" size={140} accessibilityLabel={messages.a11y.hoya('cheering')} />
        <Spacer size="lg" />
        <Heading level="display" align="center">
          {m.title}
        </Heading>
      </View>
      <Spacer size="lg" />
      <HoyaBubble tone="cheering" message={`${m.headline} ${m.canDo}`} />

      <Spacer size="xl" />
      <Heading level="title">{m.wallTitle}</Heading>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="stage-complete-wall">
        {wall.map((tile) => (
          <WallTileView key={tile.id} tile={tile} label={wallTileLabel(tile, messages.a11y)} />
        ))}
      </View>

      <Spacer size="xl" />
      <Heading level="title">{m.cardsTitle}</Heading>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} testID="stage-complete-cards">
        {cards.map((card) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            accessibilityLabel={messages.learner.results.extraCards.seeA11y(card.titleEn)}
            onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}
            style={({ pressed, focused }: TileState) => ({
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.xs,
              borderRadius: radii.lg,
              borderWidth: borderWidth.base,
              borderColor: pressed || focused ? colors.border.focus : colors.border.subtle,
              backgroundColor: colors.surface.paper,
            })}
          >
            <CardArtThumb card={card} />
            <View style={{ maxWidth: touchTarget.hero }} aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Body size="sm" weight="semibold" align="center">
                {card.titleEn}
              </Body>
            </View>
          </Pressable>
        ))}
      </View>

      <Spacer size="xl" />
      {stageCompleteActions().map((action) => (
        <View key={action.id} style={{ marginBottom: spacing.sm }}>
          <Button
            label={action.id === 'seeCards' ? m.seeCards.cta : m.backHome.cta}
            tone={action.tone}
            size={action.size}
            fullWidth
            onPress={action.id === 'seeCards' ? seeCards : goHome}
          />
        </View>
      ))}
      <Spacer size="lg" />
    </Screen>
  );
}

/**
 * One lit symbol: the glyph and its sound value in the taught-Korean chip colours. The tile is one
 * element for assistive tech, read as "Korean letter g/k" or "Korean final consonant n" (never the
 * glyph alone). A final sits at the bottom of its block, so its tile has a heavier bottom edge (a
 * shape cue, never colour alone).
 */
function WallTileView({ tile, label }: { tile: WallTile; label: string }): React.ReactElement {
  const final = tile.kind === 'batchim';
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      testID={`stage-complete-tile-${tile.id}`}
      style={{
        width: WALL_TILE,
        minHeight: WALL_TILE,
        paddingVertical: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.brand.secondaryLight,
        borderWidth: borderWidth.base,
        borderBottomWidth: final ? borderWidth.thick * 2 : borderWidth.base,
        borderColor: colors.brand.secondary,
      }}
    >
      <Text
        style={{
          fontFamily: typography.family.sansKr,
          fontSize: typography.size.title,
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          lineHeight: typography.size.title * typography.leading.normal,
        }}
      >
        {tile.char}
      </Text>
      <Caption tone="secondary" align="center">
        {tile.romanization}
      </Caption>
    </View>
  );
}
