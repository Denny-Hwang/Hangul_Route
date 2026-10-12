import { Body, Caption, Card, Icon, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useOnline } from '../../components/use-online';
import { useMessages } from '../../i18n/use-messages';
import { entryLine, grownUpRowLabel, grownUpRowTitle } from '../../logic/shell/entry-points';
import { useAudience } from '../../store/audience';

/** Title and glyphs of a disabled row (learner-entry.md: 0.6, as a disabled `Button`). */
const DISABLED_OPACITY = 0.6;

/**
 * The first row of the grown-up zone on Profile (F-APP-001 A-7, section 3.6; wireframe
 * `design/wireframes/parent/grown-up-home-card.md` Panel A, mock
 * `design/screens/app-shell/learner-entry.md`, decisions D9 and D11). Web only, behind
 * `flags.grownUpHomeEnabled`; the caller places it directly above the zone button.
 *
 * "Grown-up home" ("Account home" on a self-only device) with the line "Your family, classes and
 * billing"; its accessible name is the title and the line it shows, plus "(PIN required)" on a
 * gated device. Offline (Panel C) the row is disabled, its title and glyphs at 0.6, and the line
 * becomes "Needs the internet" at full contrast (so the name says it too).
 */
export function GrownUpHomeRow({ onOpen }: { onOpen: () => void }): React.ReactElement {
  const m = useMessages();
  const row = m.learner.profile.grownUpHome;
  const needsInternet = m.learner.welcome.grownUps.needsInternet;
  const { audience, copy, pinSet } = useAudience();
  const online = useOnline();
  const title = grownUpRowTitle(audience, row);
  const line = entryLine(online, row.line, needsInternet);
  const dim = online ? 1 : DISABLED_OPACITY;

  return (
    <Card padding="md">
      <Pressable
        testID="profile-grown-up-home"
        onPress={online ? onOpen : undefined}
        disabled={!online}
        accessibilityRole="button"
        accessibilityLabel={copy.gatedA11y(grownUpRowLabel(title, line), pinSet)}
        accessibilityState={{ disabled: !online }}
        style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View style={{ opacity: dim }}>
          <Icon name="parent" size={24} color={colors.text.secondary} />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Body weight="semibold" style={{ opacity: dim }}>
            {title}
          </Body>
          <Caption tone={online ? 'muted' : 'secondary'} testID="profile-grown-up-home-line">
            {line}
          </Caption>
        </View>
        <View style={{ opacity: dim }}>
          <Icon name="arrow-right" size={24} color={colors.text.muted} />
        </View>
      </Pressable>
    </Card>
  );
}
