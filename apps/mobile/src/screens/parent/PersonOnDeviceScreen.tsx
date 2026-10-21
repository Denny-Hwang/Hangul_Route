import { Body, Button, Caption, Card, ConfirmSheet, Heading, Icon, KOREAN_LINE_BREAK, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, typography, useTypeScale } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { ProfileLockCard } from '../../components/ProfileLockCard';
import { reportsEnabledFor } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { checkedStep, openingStep, type AfterRemoval, type RemoveStep } from '../../logic/profiles/removal';
import { isParentSessionValid, needsFreshPin } from '../../logic/profiles/session';
import { reportEntry } from '../../logic/reports/entry';
import type { RootStackParamList } from '../../navigation/types';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { passGate } from '../../store/gate-telemetry';
import { useMembershipStore } from '../../store/membership-store';
import { useProfileStore } from '../../store/profile-store';
import { removeFromDevice, savedNow, syncThenCheck } from '../../store/remove-from-device';
import { useUiStore } from '../../store/ui-store';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonOnDevice'>;

const GLYPH = 20;

/**
 * [OA] One person on this device (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D9, OA-D13, OA-D5b (3), sections 10.4, 10.6;
 * row OA-7a; wireframe `profiles/people-on-device.md` Panels B, C, C2; mock `design/screens/profiles/
 * people-on-device.md` boards 3 to 9). In the Grown-up area stack, reached from the People on this device card:
 *
 * - **Lock with the grown-up PIN** (`ProfileLockCard`, the switch of row OA-5), Edit profile and the learner's report.
 * - **Remove from this device**, a secondary paper button, never red. It asks a PIN entered in the last 2 minutes
 *   (`needsFreshPin('remove')`, else `PinEntry { next: 'FreshPin' }`), then the ConfirmSheet with the name. A saved
 *   learner (registered and nothing pending) gets Remove and Cancel; any other first tries `syncNow` with the
 *   checking line, and stays unsaved when that fails: **Save progress first** (the main action: Save my progress for
 *   that learner), Cancel, and a quiet **Remove anyway** that opens a second step, **Keep** first and **Remove** in the
 *   danger tone, used only here for a grown-up's destructive confirmation (CS-12). `spacesStay` shows when the learner
 *   has memberships. Without a PIN the button is disabled with **Set a grown-up PIN first.**, as the lock is.
 * - The removal is local only (no server call, section 10.6 for a class-scoped learner too). Removing the active
 *   learner opens the chooser; removing the last one opens Welcome.
 */
export function PersonOnDeviceScreen({ navigation, route }: Props): React.ReactElement {
  const messages = useMessages();
  const people = messages.caregiver.people;
  const locale = useLocale();
  const scale = useTypeScale();
  const { profileId } = route.params;
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const pinSet = useAccountStore((s) => s.parentPinHash !== null);
  const lastPinVerifiedAt = useUiStore((s) => s.lastPinVerifiedAt);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const hasSpaces = useMembershipStore((s) => (s.byLearner[profileId] ?? []).length > 0);
  const hydrateMemberships = useMembershipStore((s) => s.hydrate);
  const { opensDirectly } = useAudience();
  const [step, setStep] = useState<RemoveStep | null>(null);
  /** Remove was pressed and the fresh PIN it asked for has not come back yet. */
  const pendingRemove = useRef(false);
  /** Bumped when the sheet opens or closes, so a sync check that lands after Cancel changes nothing. */
  const run = useRef(0);

  useEffect(() => {
    void hydrateMemberships(profileId);
  }, [profileId, hydrateMemberships]);

  const openSheet = useCallback(async (): Promise<void> => {
    const token = ++run.current;
    const saved = await savedNow(profileId);
    if (run.current !== token) return;
    const first = openingStep(saved);
    setStep(first);
    if (first !== 'checking') return;
    const savedAfterSync = await syncThenCheck(profileId);
    if (run.current !== token) return;
    setStep(checkedStep(savedAfterSync));
  }, [profileId]);

  // OA-D5b (3): the fresh PIN came back right; the Remove it was asked for goes on now.
  useEffect(() => {
    if (!pendingRemove.current || needsFreshPin('remove', lastPinVerifiedAt, Date.now())) return;
    pendingRemove.current = false;
    void openSheet();
  }, [lastPinVerifiedAt, openSheet]);

  const onRemove = (): void => {
    if (!pinSet || step !== null) return;
    if (needsFreshPin('remove', useUiStore.getState().lastPinVerifiedAt, Date.now())) {
      pendingRemove.current = true;
      navigation.navigate('PinEntry', { next: 'FreshPin' });
      return;
    }
    void openSheet();
  };

  const close = useCallback((): void => {
    run.current += 1;
    setStep(null);
  }, []);

  const goAfter = (after: AfterRemoval): void => {
    if (after === 'welcome') navigation.reset({ index: 0, routes: [{ name: 'Onboarding', params: { screen: 'Welcome' } }] });
    else if (after === 'chooser') navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'WhoIsUsing', params: { trigger: 'return' } }] });
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('ParentDashboard');
  };

  const remove = (from: RemoveStep): void => {
    const after = removeFromDevice(profileId, from);
    close();
    if (after !== null) goAfter(after);
  };

  const openReport = (): void => {
    const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
    const entry = reportEntry(profileId, passGate('LearnerReport', opensDirectly(sessionOpen)));
    if (entry.screen === 'LearnerReport') navigation.navigate('LearnerReport', entry.params);
    else navigation.navigate('PinEntry', entry.params);
  };

  // The learner is gone (removed here or in another tab): nothing to show while the stack moves on.
  if (profile === null) return <Screen tone="canvas">{null}</Screen>;

  const name = profile.displayName;
  const spacesLine = hasSpaces ? people.spacesStay : undefined;
  const sheet = sheetFor(step, {
    title: people.removeAsk(name),
    people,
    cancel: messages.common.buttons.cancel,
    remove: messages.console.confirm.remove,
    spacesLine,
  });

  return (
    <Screen tone="canvas" scrollable>
      {/* The way back is the route's ScreenHeader (AMENDMENTS-DISPLAY-NAV section 7.1); the title stays in the screen. */}
      <Heading level="title" style={{ overflowWrap: 'anywhere' } as TextStyle}>
        {name}
      </Heading>
      <Spacer size="lg" />
      <ProfileLockCard profileId={profileId} onAskPin={() => navigation.navigate('PinEntry', { next: 'FreshPin' })} failedLine={messages.learner.editProfile.saveFailed} testID="person-lock" />
      <Spacer size="md" />
      <Card padding="md">
        <Pressable
          onPress={() => navigation.navigate('EditProfile', { profileId })}
          accessibilityRole="button"
          testID="person-edit"
          style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Body weight="semibold" style={{ flex: 1 }}>
            {messages.learner.editProfile.title}
          </Body>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <Icon name="arrow-right" size={GLYPH} color={colors.text.muted} />
          </View>
        </Pressable>
      </Card>
      {reportsEnabledFor(locale) ? (
        <>
          <Spacer size="md" />
          <Button label={messages.report.action.seeReport} tone="primary" size="md" fullWidth onPress={openReport} testID="person-see-report" />
        </>
      ) : null}
      <Spacer size="xl" />
      <Pressable
        onPress={onRemove}
        disabled={!pinSet}
        accessibilityRole="button"
        accessibilityState={{ disabled: !pinSet }}
        {...(!pinSet ? { accessibilityHint: messages.caregiver.pin.needsPinFirst } : {})}
        testID="person-remove"
        style={({ pressed }) => ({
          minHeight: touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radii.pill,
          borderWidth: borderWidth.base,
          borderColor: pinSet ? colors.border.strong : colors.border.subtle,
          backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
        })}
      >
        <Text
          {...KOREAN_LINE_BREAK}
          style={{
            fontSize: scale.size.body,
            lineHeight: scale.lineHeight(scale.size.body, 'tight'),
            fontWeight: typography.weight.bold,
            textAlign: 'center',
            color: pinSet ? colors.text.primary : colors.text.muted,
          }}
        >
          {people.remove}
        </Text>
      </Pressable>
      {!pinSet ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" testID="person-remove-needs-pin">
            {messages.caregiver.pin.needsPinFirst}
          </Caption>
        </>
      ) : null}
      <Spacer size="xl" />

      <ConfirmSheet
        visible={sheet !== null}
        title={sheet?.title ?? ''}
        message={sheet?.message}
        detail={sheet?.detail}
        cancelLabel={sheet?.cancelLabel ?? messages.common.buttons.cancel}
        confirmLabel={sheet?.confirmLabel ?? ''}
        confirmTone={sheet?.tone ?? 'primary'}
        confirmFirst={sheet?.confirmFirst ?? false}
        busy={step === 'checking'}
        onCancel={close}
        onConfirm={() => {
          if (step === 'saved' || step === 'anyway') remove(step);
          else if (step === 'unsaved') {
            close();
            navigation.navigate('SaveProgress', { profileId });
          }
        }}
        {...(step === 'unsaved' ? { quietLabel: people.removeAnyway, onQuiet: () => setStep('anyway') } : {})}
        testID="remove-sheet"
      />
    </Screen>
  );
}

interface SheetCopy {
  title: string;
  message?: string;
  detail?: string;
  cancelLabel: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  confirmFirst: boolean;
}

/** What each step of the Remove sheet says and offers (mock boards 6 to 9); null while it is closed. */
function sheetFor(
  step: RemoveStep | null,
  c: { title: string; people: { checking: string; removeSaved: string; removeUnsaved: string; saveFirst: string; removeAnywayAsk: string; keep: string }; cancel: string; remove: string; spacesLine: string | undefined },
): SheetCopy | null {
  switch (step) {
    case 'checking':
      return { title: c.title, message: c.people.checking, cancelLabel: c.cancel, confirmLabel: c.remove, tone: 'primary', confirmFirst: false };
    case 'saved':
      return { title: c.title, message: c.people.removeSaved, detail: c.spacesLine, cancelLabel: c.cancel, confirmLabel: c.remove, tone: 'primary', confirmFirst: false };
    case 'unsaved':
      return { title: c.title, message: c.people.removeUnsaved, detail: c.spacesLine, cancelLabel: c.cancel, confirmLabel: c.people.saveFirst, tone: 'primary', confirmFirst: true };
    case 'anyway':
      return { title: c.people.removeAnywayAsk, cancelLabel: c.people.keep, confirmLabel: c.remove, tone: 'danger', confirmFirst: false };
    default:
      return null;
  }
}
