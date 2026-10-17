import { LOCALE_META } from '@hangul-route/i18n';
import { Body, Button, Screen, Spacer, spacing } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { classScopeLines } from '../../logic/class-update/class-update';
import type { RootStackParamList } from '../../navigation/types';
import { useClassUpdateStore } from '../../store/class-update-store';
import { useProfileStore } from '../../store/profile-store';
import { FocusTitle } from '../transfer/FocusTitle';
import { useEndsGateOnLeave, useGateOpen } from '../transfer/use-transfer';

type Props = NativeStackScreenProps<RootStackParamList, 'ClassScope'>;

/**
 * [TV] The class update in the grown-up zone — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4, TV-D5 (wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 5, mock notes `design/screens/class-moves/README.md`).
 * The keyed lines of content-schema `CLASS_SCOPE_TEXT` (the same ids, in the same order, as the console card), the
 * list of what a teacher sees always open, and **OK**, which records the acknowledgement for this learner from this
 * device. Behind the grown-up gate whenever the device needs one (a child profile reaches it only through the PIN);
 * online only, never queued.
 */
export function ClassScopeScreen({ route, navigation }: Props): React.ReactElement {
  const { profileId } = route.params;
  const messages = useMessages();
  const t = messages.caregiver.classScope;
  const locale = useLocale();
  const online = useOnline();
  const gateOpen = useGateOpen();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const acknowledge = useClassUpdateStore((s) => s.acknowledge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On a managed device the PIN was entered for this screen only: the grown-up session ends when it closes.
  const leaving = useEndsGateOnLeave(navigation);
  useEffect(() => {
    if (!gateOpen && !leaving.current) navigation.replace('PinEntry', { next: 'ClassScope', profileId });
  }, [gateOpen, navigation, profileId, leaving]);

  const sheet = classScopeLines(locale, profile?.displayName ?? '');

  const ok = async (): Promise<void> => {
    if (!online) {
      setError(t.offline);
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await acknowledge(profileId);
    setBusy(false);
    if (outcome === 'ok') navigation.goBack();
    else setError(outcome === 'offline' ? t.offline : outcome === 'stale' ? t.stale : t.failed);
  };

  return (
    <Screen tone="canvas" scrollable>
      <FocusTitle text={t.title} />
      <Spacer size="md" />
      <View {...{ lang: LOCALE_META[sheet.locale].htmlLang }} style={{ gap: spacing.md }} testID="class-scope-lines">
        {sheet.lines.map((line) =>
          line.items ? (
            <View key={line.id} testID={`class-scope-line-${line.id}`}>
              <Body weight="semibold">{line.text}</Body>
              <View role="list" style={{ gap: spacing.xxs, paddingTop: spacing.xs }}>
                {line.items.map((item) => (
                  <View key={item} role="listitem" style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Body tone="secondary">{'•'}</Body>
                    <View style={{ flex: 1 }}>
                      <Body tone="secondary">{item}</Body>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View key={line.id} testID={`class-scope-line-${line.id}`}>
              <Body>{line.text}</Body>
            </View>
          ),
        )}
      </View>
      {error ? (
        <View accessibilityRole="alert" style={{ paddingTop: spacing.md }}>
          <Body tone="secondary" align="center">
            {error}
          </Body>
        </View>
      ) : null}
      <Spacer size="lg" />
      <Button label={busy ? t.saving.cta : t.ok.cta} size="lg" fullWidth disabled={busy} onPress={() => void ok()} testID="class-scope-ok" />
    </Screen>
  );
}
