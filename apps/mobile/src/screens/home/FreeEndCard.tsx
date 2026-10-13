import { Body, Button, Card, Hoya, Spacer, spacing, useMediaSize } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/** Hoya beside the title at scale 1 (RouteMarkers "The cards": `useMediaSize(72)`). */
const HOYA_SIZE = 72;

/**
 * Home card (2) at the end of the free lessons, shown once per profile and device (F-ENT-003
 * section 3.7; wireframe design/wireframes/home/next-and-free-end-card.md B; mock
 * design/components/RouteMarkers/spec.md "The cards", D8): a paper card with Hoya cheering beside
 * "You finished your first lessons!", the line "You played every quest that is open for you.",
 * then Practice words (or Read a story), Play a favorite again and the ask by audience. The only
 * place Home ever shows the ask; the practice card that follows has none.
 */
export function FreeEndCard({
  primary,
  onPrimary,
  onReplay,
  askLabel,
  onAsk,
}: {
  /** Practice words, Read a story, or none when this build offers neither. */
  primary: 'practice' | 'story' | null;
  onPrimary: () => void;
  onReplay: () => void;
  askLabel: string;
  onAsk: () => void;
}): React.ReactElement {
  const m = useMessages();
  const access = m.learner.access;
  const hoya = useMediaSize(HOYA_SIZE);
  return (
    <View testID="home-free-end-card">
      <Card padding="md" tone="paper">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Hoya pose="cheering" size={hoya} accessibilityLabel={m.a11y.hoya('cheering')} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body weight="bold" size="lg">
              {access.freeEnd.title}
            </Body>
          </View>
        </View>
        <Spacer size="md" />
        <Body tone="secondary">{access.openForYou}</Body>
        <Spacer size="md" />
        {primary ? (
          <>
            <Button
              label={primary === 'story' ? access.readStory.cta : access.practiceWords.cta}
              tone="primary"
              size="lg"
              fullWidth
              onPress={onPrimary}
              testID="home-free-end-primary"
            />
            <Spacer size="sm" />
          </>
        ) : null}
        <Button label={access.replay.cta} tone="secondary" size="md" fullWidth onPress={onReplay} testID="home-free-end-replay" />
        <Spacer size="sm" />
        <Button label={askLabel} tone="ghost" size="md" fullWidth onPress={onAsk} testID="home-free-end-ask" />
      </Card>
    </View>
  );
}
