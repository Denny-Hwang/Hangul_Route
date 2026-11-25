import { Body, Pill, Spacer, borderWidth, colors, spacing, touchTarget } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { useAudioStore } from '../../store/audio-store';

/** The Sound row's glyph (`ProfileScreen`), so this row's label lines up with "Sound" (design pass MD9). */
const SOUND_GLYPH = 24;

/**
 * "Always show the letters" (AMENDMENTS-AUDIO-CANT-HEAR row CH-2, OD-CH1 (b); design/screens/audio-cant-hear/README.md):
 * a device switch under the Sound switch, in the same card. On, every sound-only round that offers "Can't hear it?"
 * opens with its text and the sound still plays. It applies to every learner on this device and is kept with the mute in
 * `device:audio`.
 *
 * The switch's name is its label only: the on / off state is the switch's own (`checked`), so the pill (which says
 * On or Off for the eye) is hidden from a screen reader instead of saying the state a second time (design pass Q6).
 */
export function AlwaysShowLettersRow(): ReactElement {
  const m = useMessages();
  const on = useAudioStore((s) => s.showLetters);
  const setShowLetters = useAudioStore((s) => s.setShowLetters);
  const label = m.learner.audio.alwaysShowLetters;
  return (
    <View testID="profile-always-show-letters-group">
      <Spacer size="sm" />
      <View style={{ borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle }} />
      <Spacer size="sm" />
      <Pressable
        onPress={() => setShowLetters(!on)}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        // react-native-web ignores `accessibilityState`, and the name no longer says on or off: the web needs its own.
        aria-checked={on}
        accessibilityLabel={label}
        testID="profile-always-show-letters"
        style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, paddingLeft: SOUND_GLYPH + spacing.sm }}>
            <Body weight="semibold">{label}</Body>
          </View>
          <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Pill tone={on ? 'success' : 'neutral'} label={on ? m.learner.profile.sound.on : m.learner.profile.sound.off} size="sm" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
