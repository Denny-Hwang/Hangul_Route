import { Body, Button, Heading, Hoya, Screen, Spacer, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { accessView, type AccessAction } from '../../logic/browse/access-view';
import { BROWSE_ACTION_MAX_WIDTH } from '../../logic/browse/layout';
import type { BrowseStackParamList } from '../../navigation/browse';
import { leaveTo } from '../../platform/browse-env';
import { useBrowseSession } from './browse-session';

/**
 * The Access screen (F-BROWSE-001 section 4.3, OD-3; wireframe
 * `browse/access.md`; mock `design/screens/browse/access.md`): the root's only
 * screen when no pass is active. "This page is for parents and teachers.", one
 * line, and the action that fits how the visitor arrived (`accessView`). It
 * shows no lesson, title or card, and has no Close and no back: there is
 * nothing to return to. Every account target is a grown-up page behind sign-in
 * and the grown-up lock, so a child on a shared device reaches nothing here.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'BrowseAccess'>;

export function BrowseAccessScreen({ route }: Props): React.ReactElement {
  const m = useMessages().caregiver.browse.access;
  const { lastPersona, online } = useBrowseSession();
  const { width } = useLayoutClass();
  const view = accessView({ source: route.params.source, lastPersona, online });
  // Full width on phones, capped at 26rem and centred from the regular class.
  const actionWidth = width === 'compact' ? undefined : BROWSE_ACTION_MAX_WIDTH;
  const action = (a: AccessAction, tone: 'primary' | 'ghost'): React.ReactElement => (
    <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: actionWidth }}>
        <Button
          testID={`browse-access-${a.label}`}
          label={m[a.label].cta}
          tone={tone}
          size={tone === 'primary' ? 'lg' : 'md'}
          fullWidth
          onPress={() => leaveTo(a.href)}
        />
      </View>
    </View>
  );

  return (
    <Screen tone="canvas" testID="browse-access">
      <View style={{ alignItems: 'center' }}>
        <Spacer size="xl" />
        <Hoya pose="waving" size={touchTarget.hero} />
        <Spacer size="md" />
        <Heading level="title" align="center">
          {m.title}
        </Heading>
        <Spacer size="md" />
        <Body tone="secondary" align="center">
          {m.line[view.line]}
        </Body>
        <Spacer size="xl" />
        {action(view.primary, 'primary')}
        {view.secondary ? (
          <>
            <Spacer size="sm" />
            {action(view.secondary, 'ghost')}
          </>
        ) : null}
        {view.offlineLine ? (
          <>
            <Spacer size="md" />
            <Body tone="secondary" align="center">
              {m.offline}
            </Body>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
