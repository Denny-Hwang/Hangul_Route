import { KOREAN_LINE_BREAK, borderWidth, colors, radii, spacing, touchTarget, typography, useTypeScale } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

/**
 * F-AUTH-004 design D2 and the mocks' `rn-btn` variants (`design/screens/profiles/mock/profiles.css`, used by
 * `design/screens/account/mock/sign-in.html` and `lock.html`; row NS-3): the native account screens' buttons.
 *
 * - `primary`: the step's submit (`brand.primary` fill, `text.onPrimary`), as the design-system Button draws it.
 * - `paper`: `surface.paper` with a `border.strong` outline and `text.primary` (Send a new code, Use my password,
 *   Email me a code, Use a backup code, the card's buttons), as People on this device's paper button draws it.
 * - `quiet`: no fill and no outline, `text.secondary` underlined (Use another email).
 *
 * The design-system Button has no busy state, and D2 asks the waiting submit to be announced as disabled and busy with
 * the same words: `waiting` is `disabled` (a press does nothing; on iOS and Android the button stays in the reading
 * order, with its reason as `hint`), `busy` adds `accessibilityState.busy`. Every button is at least `touchTarget.min`
 * high and wraps its words. Only the native account screens import this module.
 */

export type AccountButtonTone = 'primary' | 'paper' | 'quiet';

export interface AccountButtonProps {
  label: string;
  onPress: () => void;
  tone: AccountButtonTone;
  /** Drawn and announced as disabled; a press does nothing (offline, a Clerk call out, a field not ready). */
  waiting?: boolean;
  /** A Clerk call for this button is out (D2: the same words, announced busy). */
  busy?: boolean;
  /** Why it waits (Needs the internet), read after its name. */
  hint?: string;
  fullWidth?: boolean;
  testID?: string;
}

const FILL: Readonly<Record<AccountButtonTone, string>> = {
  primary: colors.brand.primary,
  paper: colors.surface.paper,
  quiet: 'transparent',
};
const PRESSED: Readonly<Record<AccountButtonTone, string>> = {
  primary: colors.brand.primaryDark,
  paper: colors.surface.sunken,
  quiet: colors.surface.sunken,
};
const INK: Readonly<Record<AccountButtonTone, string>> = {
  primary: colors.text.onPrimary,
  paper: colors.text.primary,
  quiet: colors.text.secondary,
};

export function AccountButton({ label, onPress, tone, waiting = false, busy = false, hint, fullWidth = false, testID }: AccountButtonProps): ReactElement {
  const scale = useTypeScale();
  const off = waiting || busy;
  return (
    <Pressable
      onPress={() => {
        if (!off) onPress();
      }}
      // A disabled view stays in VoiceOver's and TalkBack's reach on iOS and Android, as the design-system Button relies on.
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: off, busy }}
      aria-busy={busy}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        minWidth: touchTarget.min,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        borderWidth: tone === 'paper' ? borderWidth.base : 0,
        borderColor: tone === 'paper' ? colors.border.strong : 'transparent',
        backgroundColor: off ? (tone === 'quiet' ? 'transparent' : colors.surface.sunken) : pressed ? PRESSED[tone] : FILL[tone],
      })}
    >
      <Text
        {...KOREAN_LINE_BREAK}
        style={{
          fontSize: scale.size.body,
          lineHeight: scale.lineHeight(scale.size.body, 'tight'),
          fontWeight: tone === 'quiet' ? typography.weight.semibold : typography.weight.bold,
          textAlign: 'center',
          textDecorationLine: tone === 'quiet' ? 'underline' : 'none',
          color: off ? colors.text.muted : INK[tone],
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
