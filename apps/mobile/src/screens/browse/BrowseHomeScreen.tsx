import { Body, Heading, Icon, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View, type PressableStateCallbackType } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { closeAction } from '../../logic/browse/boot';
import type { BrowseStackParamList } from '../../navigation/browse';
import { canGoBack, goBack, leaveTo } from '../../platform/browse-env';
import { useBrowseSession } from './browse-session';

/**
 * All lessons home (F-BROWSE-001 sections 4.1 and 4.5; wireframe
 * `browse/home.md`; mock `design/screens/browse/home.md`, README decision 1):
 * the header row with [ Close ] in the one fixed top-left position, the title
 * "All lessons" (the screen's one header) and the how-to line. BR-7 adds the
 * Lesson display button, the scope and pointer lines, Route · Journey ·
 * Library and the keep switch below, from the params this screen already
 * takes (`section`, `stage`, `note`).
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'BrowseHome'>;
/** react-native-web adds `focused` (keyboard focus) to the pressable's state. */
type FocusState = PressableStateCallbackType & { focused?: boolean };

export function BrowseHomeScreen(_props: Props): React.ReactElement {
  const m = useMessages().caregiver.browse.home;
  const { pass, lastPersona } = useBrowseSession();

  const onClose = (): void => {
    const action = closeAction({ canGoBack: canGoBack(), from: pass?.from ?? 'gate', lastPersona });
    if (action.kind === 'back') goBack(action.fallbackUrl);
    else leaveTo(action.url);
  };

  return (
    <Screen tone="canvas" testID="browse-home">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          testID="browse-close"
          onPress={onClose}
          accessibilityRole="button"
          // The `border.focus` ring shows keyboard focus (design README decision 20); at rest the same width is clear, so nothing moves.
          style={({ focused }: FocusState) => ({
            minHeight: touchTarget.min,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingLeft: spacing.xs,
            paddingRight: spacing.sm,
            borderRadius: radii.md,
            borderWidth: borderWidth.thick,
            borderColor: focused ? colors.border.focus : 'transparent',
          })}
        >
          <Icon name="arrow-left" size={spacing.xl} color={colors.text.primary} />
          <Text style={{ color: colors.text.primary, fontSize: typography.size.body, fontWeight: typography.weight.semibold }}>{m.close.cta}</Text>
        </Pressable>
      </View>
      <Spacer size="sm" />
      <Heading level="title">{m.title}</Heading>
      <Spacer size="sm" />
      <Body tone="secondary">{m.howTo}</Body>
    </Screen>
  );
}
