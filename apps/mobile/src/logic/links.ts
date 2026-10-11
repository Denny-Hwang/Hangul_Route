const DEFAULT_SITE = 'https://hangulroute.com';

/**
 * Where the Privacy Policy lives (the marketing site's /privacy page), built
 * like `consoleBillingUrl` in ./paywall.ts: the console base URL is the site
 * root. Opened with `Linking.openURL` from the consent card (F-LEARN-001 §3.3).
 */
// Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads, so the default spells the key out.
export function privacyUrl(env: { EXPO_PUBLIC_CONSOLE_URL?: string } = { EXPO_PUBLIC_CONSOLE_URL: process.env.EXPO_PUBLIC_CONSOLE_URL }): string {
  const base = (env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_SITE).replace(/\/$/, '');
  return `${base}/privacy`;
}

/** Shown when the browser could not be opened (the card has no network use otherwise). */
export const PRIVACY_FALLBACK_NOTE = 'Open hangulroute.com/privacy in a browser.';
