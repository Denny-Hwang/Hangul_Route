import type { ThemeKey } from '@hangul-route/content-schema';
import { Body, Button, Caption, Card, Icon, Spacer, colors, spacing } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { memoryChunk } from '../../logic/memory/boot';
import { cellOffer, testOutArmFor } from '../../logic/reviews/cell-check-offer';
import type { RootStackParamList } from '../../navigation/types';
import { useMastery } from '../../store/mastery-entry';
import { useProgressStore } from '../../store/progress-store';
import { useToday } from '../route/use-today';
import type { CellCheckSlotProps } from './cell-check-entry';

/**
 * The cell page's Cell Check block and Test out line (F-CURR-002 row CM-21; design/wireframes/reviews/cell-check.md A,
 * A2, B and journey/mastery-ring.md E; mock design/screens/cell-check/). Part of the Cell Check's chunk.
 *
 * - `top`: the mastery block (the 48 dp ring, the level word, Ready to refresh, New volume and the hint for the next
 *   level, while `mastery` is on), then the Cell Check (the title, its line and the button; "Cell Check done" once a
 *   3-star Check latched). One group for screen readers, read as its words; the ring is hidden.
 * - `bottom`: "Already know this?" and Test out, under the quest list, never above the first quest's Start.
 * - Nothing shows until the memory chunk says the cell has 5 or more playable rounds.
 */

export interface CellCheckBlockProps extends CellCheckSlotProps {
  checkOn: boolean;
  masteryOn: boolean;
}

export function CellCheckBlock({ place, profileId, episodeId, stage, theme, stars, open, checkOn, masteryOn }: CellCheckBlockProps): React.ReactElement | null {
  const m = useMessages();
  const copy = m.learner.cellCheck;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const snap = useProgressStore((s) => (profileId ? s.byProfile[profileId] : undefined));
  const today = useToday('local');
  const mastery = useMastery(place === 'top' && masteryOn ? profileId : null, snap, today);
  const [playable, setPlayable] = useState(false);
  useEffect(() => {
    if (!checkOn) return undefined;
    let live = true;
    memoryChunk()
      .then((chunk) => chunk.cellCheckApi().offerable(profileId, episodeId))
      .then(
        (yes) => live && setPlayable(yes),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [checkOn, profileId, episodeId]);

  const offer = cellOffer({
    stage,
    stars,
    open,
    testedOut: snap?.testedOut?.[episodeId] !== undefined,
    checkPassed: snap?.cellCheckAt?.[episodeId] !== undefined,
    level: snap?.cellBest?.[episodeId] ?? 0,
    checkOn,
    masteryOn: masteryOn && mastery !== null,
    arm: testOutArmFor(profileId),
    playable,
  });
  const go = (mode: 'check' | 'testout'): void => navigation.navigate('CellCheck', { cellId: episodeId, mode });

  if (place === 'bottom') {
    if (!offer.testOut) return null;
    return (
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }} testID="cell-check-test-out-line">
        <Body tone="secondary">{m.learner.testOut.prompt}</Body>
        <Button label={m.learner.testOut.title} tone="secondary" size="md" fullWidth accessibilityHint={m.learner.testOut.prompt} onPress={() => go('testout')} testID="cell-check-test-out" />
      </View>
    );
  }

  if (!offer.block) return null;
  const words = m.learner.mastery;
  const levelWord = offer.level === 3 ? words.level.mastered : offer.level === 2 ? words.level.practiced : words.level.done;
  const refresh = offer.level !== null && (mastery?.read?.refresh.includes(episodeId) ?? false);
  const newVolume = offer.level !== null && (mastery?.read?.newVolume.includes(episodeId) ?? false);
  const hint = offer.hint === null ? null : copy.hint[offer.hint];
  const lines = offer.level === null ? [] : [levelWord, refresh ? words.readyToRefresh : null, newVolume ? words.newVolume : null, hint].filter((w): w is string => w !== null);
  const Ring = mastery?.ui.LevelRing;
  return (
    <Card padding="md" style={{ marginTop: spacing.lg }} testID="cell-check-block">
      {offer.level !== null ? (
        <View accessible accessibilityRole="text" accessibilityLabel={lines.map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)).join(' ')} testID="cell-check-mastery">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {Ring ? (
              <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Ring level={offer.level} theme={theme as ThemeKey} reducedMotion />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Body size="lg" weight="semibold">
                {levelWord}
              </Body>
              {refresh ? <Caption tone="secondary">{words.readyToRefresh}</Caption> : null}
              {newVolume ? <Caption tone="secondary">{words.newVolume}</Caption> : null}
            </View>
          </View>
          {hint !== null ? (
            <>
              <Spacer size="sm" />
              <Body>{hint}</Body>
            </>
          ) : null}
        </View>
      ) : null}
      {offer.check !== null || offer.done ? (
        <View style={{ gap: spacing.xs, marginTop: offer.level !== null ? spacing.md : 0 }}>
          {offer.done ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="cell-check-done">
              <Body weight="semibold">{copy.done}</Body>
              <Icon name="check" size={spacing.lg} color={colors.feedback.success} />
            </View>
          ) : (
            <>
              <Body weight="semibold">{copy.title}</Body>
              <Body tone="secondary">{copy.body}</Body>
            </>
          )}
          {offer.check !== null ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                label={offer.check.again ? copy.again : copy.cta}
                tone={offer.check.tone}
                size="md"
                fullWidth
                onPress={() => go('check')}
                testID="cell-check-start"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
