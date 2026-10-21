import { Body, Caption, spacing, touchTarget } from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { licensesUrl } from '../../logic/links';
import { openLinkStep, pendingLinkStep, type OpenLinkOutcome } from '../../logic/story/source-link';
import { HAND_OFF_NEEDS_TAP, openExternalUrl } from '../../platform/external-link';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { passGate } from '../../store/gate-telemetry';
import { endGrownUpSessionAfterUse } from '../../store/grown-up-session';

export interface LicensesLinkProps {
  url?: string;
  /** Sends the grown-up through the gate (`PinEntry { next: 'ExternalLink', url }`); the screen owns navigation. */
  onGate: (url: string) => void;
  /** Whether the gate opens directly right now (tests inject it). */
  opensDirectly?: () => boolean;
  /** The browser hand-off (tests inject it). */
  open?: (url: string) => Promise<OpenLinkOutcome>;
  /** Native opens a link waiting on the gate by itself; the web asks for one more tap (tests inject it). */
  handOffNeedsTap?: boolean;
}

/**
 * "Open-source notices" at the foot of Profiles & settings (owner decision 2026-10-14, the proprietary LICENSE;
 * wireframe design/wireframes/site/licenses.md, "In the app"): opens the site's /licenses page, which lists every
 * open-source package the app ships with its license. A quiet link, not a card: it is for reading, not playing.
 *
 * Leaving the app is a grown-up action, as Sources' Open link is (F-STORY-002 §3.8): where the device has a gate
 * the tap goes through `PinEntry` first; a self-only device with no PIN, or an open grown-up session, opens it
 * directly. The hand-off is `platform/external-link` (pop-up rules on the web, the offline check on native).
 * Back from the gate, native opens the waiting link; the web asks for one more tap, which then opens directly.
 * When nothing opens, a calm line says where the page is.
 */
export function LicensesLink({
  url = licensesUrl(),
  onGate,
  opensDirectly = gateOpensDirectlyNow,
  open = openExternalUrl,
  handOffNeedsTap = HAND_OFF_NEEDS_TAP,
}: LicensesLinkProps): React.ReactElement {
  const t = useMessages().learner.profile.licenses;
  const [note, setNote] = useState<string | null>(null);
  const waiting = useRef(false);

  const handOff = useCallback(async (): Promise<void> => {
    const outcome = await open(url);
    // [OA] CS-1: the PIN served this one link; the next gated control asks it again.
    endGrownUpSessionAfterUse();
    setNote(outcome === 'opened' ? null : t.fallback);
  }, [open, url, t.fallback]);

  useFocusEffect(
    useCallback(() => {
      const step = pendingLinkStep(waiting.current ? { url, factId: '' } : null, opensDirectly(), handOffNeedsTap);
      waiting.current = false;
      if (step === 'open') void handOff();
      else if (step === 'tap-again') setNote(t.gateDone);
    }, [handOff, handOffNeedsTap, opensDirectly, url, t.gateDone]),
  );

  const onPress = (): void => {
    if (openLinkStep(passGate('ExternalLink', opensDirectly())) === 'open') {
      // Called straight from the press so the web hand-off keeps the tap (pop-up rules).
      void handOff();
      return;
    }
    setNote(null);
    waiting.current = true;
    onGate(url);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        testID="profile-licenses-link"
        onPress={onPress}
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
