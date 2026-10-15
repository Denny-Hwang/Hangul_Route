import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  Pill,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  typography,
  useLayoutClass,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import { cardById } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeStage, localizeStory, localizeTheme } from '../../logic/content-locale';
import { accessOf } from '../../logic/browse/home-view';
import { episodeOutline, type OutlineQuestRow } from '../../logic/browse/facts';
import { CardRow, KoChip, SkillChips, WordChip } from './browse-ui';
import { useBrowseSession } from './browse-session';

/**
 * The episode outline (F-BROWSE-001 section 4.6; wireframe `browse/episode.md`;
 * mock `design/screens/browse/episode.md`): the episode as the learner page
 * introduces it (kicker, title, subtitle, Hoya's line), "About N minutes",
 * one row per lesson with the letters it introduces (or its first three
 * words), its skills and [ Open ], then the cards it awards. A coming-later
 * episode shows one line. Used by the outline screen and the Journey's detail
 * pane on wide windows (`asPane`: the title is a sub-heading there).
 */

/** The lesson number disc (`EpisodeDetailView`'s, unchanged): 44. */
const DISC = spacing.xxl + spacing.md;
/** Hoya in the intro bubble. */
const HOYA = spacing.jumbo - spacing.sm;

export interface EpisodeOutlineViewProps {
  episodeId: string;
  onOpenItem: (item: { kind: 'quest' | 'story'; id: string }) => void;
  onOpenCard: (cardId: string) => void;
  asPane?: boolean;
}

export function EpisodeOutlineView({ episodeId, onOpenItem, onOpenCard, asPane = false }: EpisodeOutlineViewProps): React.ReactElement | null {
  const messages = useMessages();
  const m = messages.caregiver.browse;
  const locale = useLocale();
  const { bundle, pass, gatingEnabled } = useBrowseSession();
  const twoColumns = useLayoutClass().width !== 'compact';
  const outline = episodeOutline(episodeId, bundle, locale);
  if (!outline || !pass) return null;
  const { episode } = outline;
  const stage = bundle.stages.find((s) => s.key === episode.stage);
  const theme = bundle.themes.find((t) => t.key === episode.theme);
  const localStage = stage ? localizeStage(stage, locale) : null;
  const access = { bundle, scope: pass.scope, gatingEnabled };

  const kicker = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
      {localStage ? <Pill label={m.episode.stagePill(localStage.order, localStage.titleEn)} tone={localStage.key === 'stage1' ? 'success' : 'primary'} size="sm" /> : null}
      {theme ? (
        <Body size="sm" tone="secondary">
          {localizeTheme(theme, locale).titleEn}
        </Body>
      ) : null}
    </View>
  );
  const title = (
    <View accessibilityRole="header" aria-level={asPane ? 2 : 1}>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.title, fontWeight: typography.weight.bold, color: colors.text.primary }}>{episode.titleEn}</Text>
    </View>
  );

  if (outline.comingLater) {
    return (
      <View testID="browse-episode" style={{ gap: spacing.sm }}>
        {kicker}
        {title}
        <View style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.md, padding: spacing.lg }}>
          <Body tone="secondary">{m.episode.comingLater}</Body>
        </View>
      </View>
    );
  }

  const cards = outline.rewardCardIds.flatMap((id) => {
    const card = cardById(id);
    return card ? [card] : [];
  });

  return (
    <View testID="browse-episode">
      {kicker}
      <Spacer size="xs" />
      {title}
      {episode.subtitleEn ? <Body tone="secondary">{episode.subtitleEn}</Body> : null}
      <Body size="sm" weight="semibold">
        {m.minutes(outline.minutes)}
      </Body>
      {episode.hoyaIntroEn ? (
        <>
          <Spacer size="md" />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.surface.paper,
              borderWidth: borderWidth.base,
              borderColor: colors.border.subtle,
            }}
          >
            <Hoya pose="idle" size={HOYA} />
            <View style={{ flex: 1 }}>
              <Body weight="semibold">{episode.hoyaIntroEn}</Body>
            </View>
          </View>
        </>
      ) : null}

      {outline.quests.length > 0 ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.episode.lessons}</Heading>
          <Spacer size="sm" />
          <View style={{ gap: spacing.sm }}>
            {outline.quests.map((row, index) => (
              <LessonRow
                key={row.id}
                row={row}
                number={index + 1}
                closed={accessOf({ kind: 'quest', id: row.id }, access) === 'closed'}
                onOpen={() => onOpenItem({ kind: 'quest', id: row.id })}
              />
            ))}
          </View>
        </>
      ) : null}

      {outline.stories.length > 0 ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.episode.stories}</Heading>
          <Spacer size="sm" />
          <View style={{ gap: spacing.sm }}>
            {outline.stories.map((entry) => {
              const story = localizeStory(entry.story, locale);
              const scenes = story.tiers[0]?.scenes.length ?? 0;
              return (
                <Card key={entry.storyId} padding="md">
                  <Body weight="bold">{story.title.en}</Body>
                  <Body size="sm" tone="secondary">
                    {m.episode.storyMeta(story.tiers.length, scenes)}
                  </Body>
                  {accessOf({ kind: 'story', id: entry.storyId }, access) === 'closed' ? (
                    <Body weight="semibold" tone="secondary">
                      {m.item.closed}
                    </Body>
                  ) : null}
                  <Spacer size="xs" />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Button label={m.episode.open.cta} accessibilityLabel={m.episode.openA11y(story.title.en)} tone="ghost" size="sm" onPress={() => onOpenItem({ kind: 'story', id: entry.storyId })} />
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      ) : null}

      {cards.length > 0 ? (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{m.episode.cards}</Heading>
          <Spacer size="sm" />
          <View style={{ flexDirection: twoColumns && !asPane ? 'row' : 'column', flexWrap: 'wrap', gap: spacing.sm }}>
            {cards.map((card) => (
              <View key={card.id} style={twoColumns && !asPane ? { flexBasis: '48%', flexGrow: 1 } : undefined}>
                <CardRow card={card} onPress={() => onOpenCard(card.id)} testID={`browse-episode-card-${card.id}`} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function LessonRow({ row, number, closed, onOpen }: { row: OutlineQuestRow; number: number; closed: boolean; onOpen: () => void }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse;
  return (
    <Card padding="md" testID={`browse-outline-${row.id}`}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ width: DISC, height: DISC, borderRadius: radii.circle, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>{number}</Text>
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Body weight="bold">{row.title}</Body>
          <Body size="sm" tone="secondary">
            {m.minutes(row.minutes)}
          </Body>
          {row.letters.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {row.letters.map((l) => (
                <KoChip key={l.jamoId} ko={l.char} romanization={l.romanization} />
              ))}
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {row.tasteWords.map((w) => (
                <WordChip key={w.ko} ko={w.ko} romanization={w.romanization} gloss={w.gloss} />
              ))}
            </View>
          )}
          {closed ? (
            <Body weight="semibold" tone="secondary">
              {m.item.closed}
            </Body>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <View style={{ flexShrink: 1 }}>
              <SkillChips skills={row.skills} />
            </View>
            <Button label={m.episode.open.cta} accessibilityLabel={m.episode.openA11y(row.title)} tone="ghost" size="sm" onPress={onOpen} testID={`browse-outline-open-${row.id}`} />
          </View>
        </View>
      </View>
    </Card>
  );
}
