import { Body, Button, Icon, Spacer, colors, radii, shadows, spacing } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { classUpdateLines } from '../../logic/class-update/class-update';
import { moveEntry } from '../../logic/transfers/transfer-views';
import type { LearnerType } from '@hangul-route/content-schema';
import type { RootStackParamList } from '../../navigation/types';
import { useAudience } from '../../store/audience';
import { useClassUpdateStore } from '../../store/class-update-store';
import { passGate } from '../../store/gate-telemetry';
import { useGateOpen } from '../transfer/use-transfer';

/**
 * [TV] Home lines about classes — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D5, TV-D10 (wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 5). A calm paper row per unseen teacher move
 * ("{name} moved to a new class: {class}." with OK, shown once on this device), and one row when the class update
 * waits: a child profile reads that a grown-up has an update and Open goes through the grown-up gate; a self profile
 * opens it directly where the device needs no PIN. No number, no timer, no red.
 */
export function ClassUpdateHomeLines({ profileId, learnerName, learnerType }: { profileId: string; learnerName: string; learnerType?: LearnerType }): React.ReactElement | null {
  const messages = useMessages();
  const t = messages.learner.classUpdate;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scope = useClassUpdateStore((s) => s.scopeByLearner[profileId] ?? null);
  const moves = useClassUpdateStore((s) => s.movesByLearner[profileId]);
  const seen = useClassUpdateStore((s) => s.seenByLearner[profileId]);
  const hydrateSeen = useClassUpdateStore((s) => s.hydrateSeen);
  const markSeen = useClassUpdateStore((s) => s.markSeen);
  const gateOpen = useGateOpen();
  const { opensDirectly } = useAudience();

  useEffect(() => {
    void hydrateSeen(profileId);
  }, [hydrateSeen, profileId]);

  // Until the seen list is read, no notice shows (it may have been shown already).
  const lines = classUpdateLines({ scope, moves: seen === undefined ? [] : (moves ?? []), seen: seen ?? [], profile: { learnerType } });
  if (lines.moves.length === 0 && lines.scope === null) return null;

  const open = (): void => {
    const direct = passGate('ClassScope', lines.scope === 'self' && moveEntry({ gateOpen, gated: !opensDirectly(false) }) === 'direct');
    if (direct) navigation.navigate('ClassScope', { profileId });
    else navigation.navigate('PinEntry', { next: 'ClassScope', profileId });
  };

  const row = { backgroundColor: colors.surface.paper, borderRadius: radii.lg, ...shadows.card, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm };
  return (
    <>
      {lines.moves.map((move) => (
        <React.Fragment key={move.id}>
          <Spacer size="md" />
          <View testID="class-move-notice" style={row}>
            <Body>{t.moved(learnerName, move.to.name)}</Body>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button label={t.ok.cta} tone="ghost" size="sm" onPress={() => void markSeen(profileId, move.id)} testID="class-move-notice-ok" />
            </View>
          </View>
        </React.Fragment>
      ))}
      {lines.scope ? (
        <>
          <Spacer size="md" />
          <View testID="class-scope-line" style={row}>
            <Body>{lines.scope === 'child' ? t.scopeChild : t.scopeSelf}</Body>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label={t.open.cta}
                tone="ghost"
                size="sm"
                leading={lines.scope === 'child' ? <Icon name="lock" size={16} color={colors.brand.primary} /> : undefined}
                accessibilityLabel={messages.caregiver.audience.gated(t.open.cta, lines.scope === 'child')}
                onPress={open}
                testID="class-scope-open"
              />
            </View>
          </View>
        </>
      ) : null}
    </>
  );
}
