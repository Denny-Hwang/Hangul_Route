import { Body, Caption, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { licensesUrl } from '../../logic/links';

/**
 * "Open-source notices" at the foot of Profiles & settings (owner decision 2026-10-14, the proprietary LICENSE;
 * wireframe design/wireframes/site/licenses.md, "In the app"): opens the site's /licenses page, which lists every
 * open-source package the app ships with its license. A quiet link, not a card: it is for reading, not playing.
 * When no browser opens (offline native build), a calm line says where the page is, as the Privacy link does.
 */
export function LicensesLink({ url = licensesUrl() }: { url?: string }): React.ReactElement {
  const t = useMessages().learner.profile.licenses;
  const [note, setNote] = useState<string | null>(null);
  const open = async (): Promise<void> => {
    try {
      await Linking.openURL(url);
      setNote(null);
    } catch {
      setNote(t.fallback);
    }
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        testID="profile-licenses-link"
        onPress={() => void open()}
        accessibilityRole="link"
        accessibilityLabel={t.label}
        style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.md }}
      >
        <Body size="sm" tone="brand">
          {t.label}
        </Body>
      </Pressable>
      {note !== null ? <Caption tone="secondary">{note}</Caption> : null}
    </View>
  );
}
