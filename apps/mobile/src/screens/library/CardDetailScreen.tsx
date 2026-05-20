import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HeritageCardArt,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  supportedCardIds,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { cardById } from '../../content';
import { speak } from '../../platform/audio';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

export function CardDetailScreen({ route, navigation }: Props): React.ReactElement {
  const card = cardById(route.params.cardId);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const unlocked = snap?.cards.some((c) => c.cardId === route.params.cardId) ?? false;

  if (!card) {
    return (
      <Screen>
        <Body>Card not found.</Body>
      </Screen>
    );
  }

  const rarityTone = card.rarity === 'legendary' ? 'nudge' : card.rarity === 'rare' ? 'info' : card.rarity === 'uncommon' ? 'success' : 'neutral';

  return (
    <Screen tone="canvas">
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        style={{ alignSelf: 'flex-start' }}
      >
        <Icon name="close" size={28} />
      </Pressable>
      <Spacer size="lg" />

      <Card padding="lg" tone="paper" style={{ borderWidth: 4, borderColor: colors.rarity[card.rarity], borderRadius: radii.xl }}>
        <View style={{ alignItems: 'center' }}>
          <Pill tone={rarityTone} label={card.rarity} />
          <Spacer size="md" />
          <View
            style={{
              width: 200,
              height: 200,
              borderRadius: radii.xxl,
              backgroundColor: unlocked
                ? supportedCardIds.includes(card.id)
                  ? colors.surface.paper
                  : colors.theme[card.theme]
                : colors.surface.sunken,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: unlocked ? (supportedCardIds.includes(card.id) ? 1 : 0.85) : 0.4,
              overflow: 'hidden',
            }}
          >
            {unlocked ? (
              supportedCardIds.includes(card.id) ? (
                <HeritageCardArt cardId={card.id} size={200} />
              ) : (
                <Text style={{ fontSize: 80, fontWeight: '800', color: colors.text.inverse }}>
                  {card.subtitleKo ?? card.titleEn.charAt(0)}
                </Text>
              )
            ) : (
              <Icon name="lock" size={80} color={colors.text.muted} />
            )}
          </View>
          <Spacer size="lg" />
          <Heading level="display" align="center">
            {card.titleEn}
          </Heading>
          {card.subtitleKo ? (
            <>
              <Spacer size="xs" />
              <Heading level="title" tone="brand">
                {card.subtitleKo}
              </Heading>
            </>
          ) : null}
          {card.romanization ? (
            <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
              {card.romanization}
            </Caption>
          ) : null}
        </View>
      </Card>

      <Spacer size="lg" />
      <Card padding="md">
        <Body size="lg">{card.blurbEn}</Body>
        {card.factEn ? (
          <>
            <Spacer size="sm" />
            <Body tone="secondary" size="sm">
              💡 {card.factEn}
            </Body>
          </>
        ) : null}
      </Card>

      {card.subtitleKo && unlocked ? (
        <>
          <Spacer size="lg" />
          <Button
            label="Hear it"
            tone="secondary"
            size="lg"
            onPress={() => speak(card.subtitleKo ?? '', { language: 'ko-KR' })}
          />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
