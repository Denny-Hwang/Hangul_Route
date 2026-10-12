import { Body, Button, Card, Heading, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useMessages } from '../../i18n/use-messages';

/**
 * The card at the top of the local dashboard (F-APP-001 A-7, section 3.6; wireframe
 * `design/wireframes/parent/grown-up-home-card.md` Panel B, mock
 * `design/screens/app-shell/learner-entry.md`). Web only, behind `flags.grownUpHomeEnabled`; the
 * dashboard is behind the gate already. "Grown-up home", the line, and Open (primary,
 * right-aligned), which calls `openGrownUpArea({ via: 'dashboard' })` through `onOpen`. Offline
 * (Panel C): Open disabled with "Needs the internet" above it as its description. The local
 * dashboard below is unchanged and still works offline.
 */
export function GrownUpHomeCard({ onOpen }: { onOpen: () => void }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.grownUpHome;
  const needsInternet = messages.learner.welcome.grownUps.needsInternet;
  const online = useOnline();

  return (
    <Card padding="md" testID="dashboard-grown-up-home">
      <Heading level="prompt">{m.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{m.line}</Body>
      <Spacer size="sm" />
      <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
        {online ? null : (
          <Body tone="secondary" size="sm" align="right" testID="dashboard-grown-up-home-offline">
            {needsInternet}
          </Body>
        )}
        {/* Right-aligned (learner-entry.md); `Button` itself aligns to the start of its box. */}
        <View>
          <Button
            label={m.cta}
            tone="primary"
            size="md"
            disabled={!online}
            accessibilityHint={online ? undefined : needsInternet}
            onPress={onOpen}
            testID="dashboard-grown-up-home-open"
          />
        </View>
      </View>
    </Card>
  );
}
