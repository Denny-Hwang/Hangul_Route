import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  KOREAN_LINE_BREAK,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useTypeScale,
} from '@hangul-route/design-system';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import {
  CHECK_INPUT_MAX,
  answerGrownUpCheck,
  cleanCheckInput,
  type GrownUpCheck,
  type OfflineResetMethod,
} from '../../logic/profiles/grown-up-check';

export interface PinResetCheckCardProps {
  check: GrownUpCheck;
  /** A miss: the next check (a new number, the calm line). The screen stores it. */
  onMiss: (next: GrownUpCheck) => void;
  /** The right number: the screen opens the new-PIN screen with this way. */
  onPass: (via: OfflineResetMethod) => void;
}

/**
 * [FN] AMENDMENTS-FINISH-2026-11 FN-1 (audit SEC-7): the check before a new PIN on the two offline reset ways.
 * Wireframe `design/wireframes/onboarding/all-ages-onboarding.md` box G2, mock `design/screens/profiles/pin-reset-check.md`
 * (boards 1 to 6). A number from 100 to 999 written out in words in the UI language, typed as digits. A miss shows a
 * new number and one calm line: no count, no lock, no red. No "grown-up" word (a self-only device shows none).
 */
export function PinResetCheckCard({ check, onMiss, onPass }: PinResetCheckCardProps): ReactElement {
  const messages = useMessages();
  const c = messages.caregiver.pin.reset.check;
  const continueLabel = messages.common.buttons.continue;
  const scale = useTypeScale().size;
  const [answer, setAnswer] = useState('');

  const submit = (): void => {
    const out = answerGrownUpCheck(check, answer);
    if (out.passed) {
      onPass(out.via);
      return;
    }
    if (out.check === check) return;
    setAnswer('');
    onMiss(out.check);
  };

  return (
    <Card padding="lg" tone="paper" testID="pin-reset-check">
      <Heading level="prompt">{c.heading}</Heading>
      <Spacer size="sm" />
      <Body tone="secondary">{c.prompt}</Body>
      <Spacer size="md" />
      <Text
        {...KOREAN_LINE_BREAK}
        testID="pin-reset-check-words"
        style={{
          fontSize: scale.prompt,
          lineHeight: scale.prompt * typography.leading.tight,
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          textAlign: 'center',
        }}
      >
        {c.words(check.value)}
      </Text>
      <Spacer size="md" />
      <TextInput
        value={answer}
        onChangeText={(v) => setAnswer(cleanCheckInput(v))}
        onSubmitEditing={submit}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="go"
        maxLength={CHECK_INPUT_MAX}
        accessibilityLabel={c.fieldLabel}
        testID="pin-reset-check-input"
        style={{
          minHeight: touchTarget.child,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          textAlign: 'center',
          fontSize: scale.bodyLg,
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
          backgroundColor: colors.surface.sunken,
          borderWidth: borderWidth.base,
          // The Rescue Code field's boundary (`border.shape`, 4.55:1 on paper, WCAG 1.4.11).
          borderColor: colors.border.shape,
          borderRadius: radii.lg,
        }}
      />
      <Spacer size="md" />
      <Button
        label={continueLabel}
        tone="primary"
        size="lg"
        fullWidth
        disabled={answer.length === 0}
        onPress={submit}
        testID="pin-reset-check-continue"
      />
      <View accessibilityLiveRegion="polite" style={{ paddingTop: spacing.sm }}>
        {check.missed ? (
          <Caption tone="secondary" align="center" testID="pin-reset-check-line">
            {c.again}
          </Caption>
        ) : null}
      </View>
    </Card>
  );
}
