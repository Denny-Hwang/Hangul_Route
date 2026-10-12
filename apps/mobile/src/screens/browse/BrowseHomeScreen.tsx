import { Body, Heading, Icon, Screen, Spacer, colors, spacing, touchTarget, typography } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { closeAction } from '../../logic/browse/boot';
import type { BrowseStackParamList } from '../../navigation/browse';
import { cameFromSameOrigin, goBack, leaveTo } from '../../platform/browse-env';
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

export function BrowseHomeScreen(_props: Props): React.ReactElement {
  const m = useMessages().caregiver.browse.home;
  const { pass, lastPersona } = useBrowseSession();

  const onClose = (): void => {
    const action = closeAction({ sameOriginReferrer: cameFromSameOrigin(), from: pass?.from ?? 'gate', lastPersona });
    if (action.kind === 'back') goBack();
    else leaveTo(action.url);
  };

  return (
    <Screen tone="canvas" testID="browse-home">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          testID="browse-close"
          onPress={onClose}
          accessibilityRole="button"
          style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.sm }}
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
