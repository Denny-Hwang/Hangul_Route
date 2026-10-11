import { Linking } from 'react-native';
import { isSafeHttpsUrl, type OpenLinkOutcome } from '../logic/story/source-link';

/**
 * Hands a source link to the system browser (F-STORY-002 §3.8). Native:
 * `Linking.openURL` in a try/catch like the Paywall; a refusal is reported,
 * never thrown. Anything but a plain `https:` link is refused here too.
 * The web build uses `external-link.web.ts`.
 */
export async function openExternalUrl(url: string): Promise<OpenLinkOutcome> {
  if (!isSafeHttpsUrl(url)) return 'failed';
  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
