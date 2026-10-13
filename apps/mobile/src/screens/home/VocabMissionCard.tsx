import { Body, Button, Caption, Card, Icon, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { missionCardText, type MissionCard } from '../../logic/homework/mission-builder';

/** The leading icon slot, the width of the other mission cards' icon or cover. */
const LEAD = 48;

/**
 * Home card (3) "Words are ready" (F-VOC-005 section 3.7, PR P-3; wireframe
 * design/wireframes/vocab/flashcards.md G): the `library` icon, the title,
 * "<N> words would like another look" and one button, "Say hello again", that
 * opens a Relaxed Speed Round of the topic with the most due words. A gift,
 * not a guilt trip: no day count and no word about a delay. A collected card
 * keeps its slot and switches tone, as every mission card does (F-HW-001
 * section 3.2). The button is the one control, so its accessible name carries
 * the card's lines and where it goes (section 3.10).
 */
export function VocabMissionCard({ card, onPress }: { card: MissionCard; onPress: () => void }): React.ReactElement {
  const m = useMessages();
  const { title, subtitle } = missionCardText(card, m.learner);
  return (
    <View testID="home-vocab-card">
      <Card padding="md" tone={card.collected ? 'success' : 'paper'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
          <View style={{ width: LEAD, alignItems: 'center' }}>
            <Icon name="library" size={32} color={colors.text.secondary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body weight="semibold" size="lg">
              {title}
            </Body>
            <Caption tone="muted">{subtitle}</Caption>
          </View>
          {card.collected ? <Icon name="sparkle" size={28} color={colors.brand.primary} /> : null}
        </View>
        <Spacer size="sm" />
        <Button
          label={m.learner.home.mission.vocab.cta}
          tone={card.collected ? 'secondary' : 'primary'}
          size="md"
          fullWidth
          onPress={onPress}
          accessibilityLabel={m.a11y.vocabMissionCard(title, subtitle, card.collected)}
          testID="home-vocab-card-open"
        />
      </Card>
    </View>
  );
}
