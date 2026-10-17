import { Body, Button, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useMessages } from '../../i18n/use-messages';
import { dashboardSignInLabel } from '../../logic/shell/entry-points';
import { useAudience } from '../../store/audience';

/**
 * The row at the top of the local dashboard (F-APP-001 A-7, section 3.6; wireframe
 * `design/wireframes/parent/grown-up-home-card.md` Panel B). Web only, behind `flags.grownUpHomeEnabled`; the
 * dashboard is behind the gate already. Owner request 2026-10-16 (item 8): it was a card with a filled Open; it is
 * now one full-width outline row that says what it opens ("Sign in for family and class tools", "Sign in to your
 * account" on a self-only device, D9), so the learner cards below keep the page's one filled button (See report).
 * It calls `openGrownUpArea({ via: 'dashboard' })` through `onOpen`. Offline (Panel C): the row is disabled with
 * "Needs the internet" under it as its description. The local dashboard below is unchanged and still works offline.
 */
export function GrownUpHomeCard({ onOpen }: { onOpen: () => void }): React.ReactElement {
  const messages = useMessages();
  const needsInternet = messages.learner.welcome.grownUps.needsInternet;
  const online = useOnline();
  const { audience } = useAudience();

  return (
    <View testID="dashboard-grown-up-home" style={{ gap: spacing.xs }}>
      <Button
        label={dashboardSignInLabel(audience, messages)}
        tone="ghost"
        size="md"
        fullWidth
        disabled={!online}
        accessibilityHint={online ? undefined : needsInternet}
        onPress={onOpen}
        testID="dashboard-grown-up-home-open"
      />
      {online ? null : (
        <Body tone="secondary" size="sm" align="center" testID="dashboard-grown-up-home-offline">
          {needsInternet}
        </Body>
      )}
    </View>
  );
}
