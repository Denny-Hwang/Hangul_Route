import type { StageKey, ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Card,
  Heading,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { episodeFor, stages, themes } from '../../content';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

export function JourneyScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">Heritage Journey</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">7 stages × 5 themes. Draw your own route.</Body>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
        {themes.map((t) => (
          <View key={t.key} style={{ flex: 1, alignItems: 'center' }}>
            <Caption tone="muted" align="center">
              {t.titleEn.split(' ')[0]}
            </Caption>
          </View>
        ))}
      </View>

      {stages.map((stage) => {
        const isLocked = stage.key !== 'stage1';
        return (
          <View key={stage.key} style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radii.circle,
                  backgroundColor: isLocked ? colors.surface.sunken : colors.stage[stage.key],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: isLocked ? colors.text.muted : colors.text.inverse, fontWeight: '700' }}>
                  {stage.order}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Body weight="bold" tone={isLocked ? 'secondary' : 'primary'}>
                  {stage.titleEn}
                </Body>
                <Caption tone="muted">{stage.oneLinerEn}</Caption>
              </View>
              {isLocked ? <Pill tone="neutral" label="Soon" size="sm" /> : <Pill tone="success" label="Open" size="sm" />}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {themes.map((theme) => (
                <GridCell
                  key={`${stage.key}-${theme.key}`}
                  stage={stage.key}
                  theme={theme.key}
                  onOpen={(episodeId) => navigation.navigate('EpisodeDetail', { episodeId })}
                  progressSnapshot={snap}
                />
              ))}
            </View>

            {stage.key === 'stage2' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                <Icon name="lock" size={14} color={colors.text.muted} />
                <Caption tone="muted">Finish Stage 1 to unlock the next stage.</Caption>
              </View>
            ) : null}
          </View>
        );
      })}

      <Card padding="md" tone="sunken">
        <Heading level="prompt">How the journey works</Heading>
        <Spacer size="xs" />
        <Body tone="secondary" size="sm">
          Each cell is one episode. Finish quests to earn Heritage cards. Stages 2-7 unlock as Stage 1 completes.
        </Body>
      </Card>
      <Spacer size="xl" />
    </Screen>
  );
}

interface GridCellProps {
  stage: StageKey;
  theme: ThemeKey;
  onOpen: (episodeId: string) => void;
  progressSnapshot?: { episodes: Array<{ episodeId: string; completedAt?: string }>; quests: Array<{ episodeId: string; completedAt?: string }> };
}

function GridCell({ stage, theme, onOpen, progressSnapshot }: GridCellProps): React.ReactElement {
  const episode = episodeFor(stage, theme);
  const isPreview = !episode || episode.status === 'preview';
  const completed = !!progressSnapshot?.quests.some((q) => q.episodeId === episode?.id && q.completedAt);
  const tone = colors.stage[stage];

  return (
    <Pressable
      onPress={() => episode && !isPreview && onOpen(episode.id)}
      disabled={isPreview}
      accessibilityRole="button"
      accessibilityLabel={`${theme} episode for ${stage}${isPreview ? ', coming soon' : ''}`}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.md,
        backgroundColor: isPreview ? colors.surface.sunken : completed ? colors.feedback.successLight : colors.surface.paper,
        borderWidth: 2,
        borderColor: isPreview ? colors.border.subtle : completed ? colors.feedback.success : tone,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xs,
      }}
    >
      {isPreview ? (
        <Icon name="lock" size={20} color={colors.text.muted} />
      ) : (
        <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: tone }}>
          {theme.charAt(0).toUpperCase()}
        </Text>
      )}
    </Pressable>
  );
}
