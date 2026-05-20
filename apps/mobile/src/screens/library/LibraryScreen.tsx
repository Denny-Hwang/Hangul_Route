import type { HeritageCard, ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
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
  typography,
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { heritageCardsAll, themes } from '../../content';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

export function LibraryScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const [filter, setFilter] = useState<ThemeKey | 'all'>('all');

  const unlockedIds = useMemo(() => new Set((snap?.cards ?? []).map((c) => c.cardId)), [snap]);

  const visible = useMemo(() => {
    return filter === 'all' ? heritageCardsAll : heritageCardsAll.filter((c) => c.theme === filter);
  }, [filter]);

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Heading level="title">Heritage Library</Heading>
          <Caption tone="muted">{unlockedIds.size} of {heritageCardsAll.length} collected</Caption>
        </View>
        <Pill label={`${unlockedIds.size}/${heritageCardsAll.length}`} tone="primary" />
      </View>

      <Spacer size="md" />
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        {themes.map((t) => (
          <FilterChip
            key={t.key}
            label={t.titleEn.split(' ')[0] ?? t.titleEn}
            active={filter === t.key}
            onPress={() => setFilter(t.key)}
          />
        ))}
      </View>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {visible.map((card) => (
          <CardThumb
            key={card.id}
            card={card}
            unlocked={unlockedIds.has(card.id)}
            onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}
          />
        ))}
      </View>
      <Spacer size="xl" />

      <Card padding="md" tone="brand">
        <Heading level="prompt">How to collect more</Heading>
        <Spacer size="xs" />
        <Body tone="secondary" size="sm">
          Finish quests to unlock cards. Legendary cards appear when you complete a whole stage.
        </Body>
      </Card>
      <Spacer size="xl" />
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: active ? colors.brand.primary : colors.surface.paper,
        borderWidth: 1,
        borderColor: active ? colors.brand.primary : colors.border.subtle,
      }}
    >
      <Text style={{ color: active ? colors.text.inverse : colors.text.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function CardThumb({
  card,
  unlocked,
  onPress,
}: {
  card: HeritageCard;
  unlocked: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unlocked ? card.titleEn : `Locked card`}
      style={{
        flexBasis: '47%',
        backgroundColor: unlocked ? colors.surface.paper : colors.surface.sunken,
        borderRadius: radii.lg,
        borderWidth: 2,
        borderColor: unlocked ? colors.rarity[card.rarity] : colors.border.subtle,
        padding: spacing.md,
        minHeight: 140,
      }}
    >
      {!unlocked ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Icon name="lock" size={32} color={colors.text.muted} />
          <Caption tone="muted">Locked</Caption>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Pill tone={card.rarity === 'legendary' ? 'nudge' : card.rarity === 'rare' ? 'info' : card.rarity === 'uncommon' ? 'success' : 'neutral'} label={card.rarity} size="sm" />
          </View>
          <Spacer size="xs" />
          {supportedCardIds.includes(card.id) ? (
            <View style={{ alignItems: 'center' }}>
              <HeritageCardArt cardId={card.id} size={96} />
            </View>
          ) : null}
          <Spacer size="xs" />
          <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: colors.text.primary }}>
            {card.subtitleKo ?? card.titleEn}
          </Text>
          {card.romanization ? (
            <Caption tone="muted" style={{ fontStyle: 'italic' }}>
              {card.romanization}
            </Caption>
          ) : null}
          <Caption tone="secondary">{card.titleEn}</Caption>
        </>
      )}
    </Pressable>
  );
}
