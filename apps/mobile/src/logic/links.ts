const DEFAULT_SITE = 'https://hangulroute.com';

/**
 * Where the Privacy Policy lives (the marketing site's /privacy page; legal pages stay on the
 * site). Opened with `Linking.openURL` from the consent card (F-LEARN-001 §3.3). The site root is
 * `EXPO_PUBLIC_SITE_URL`, then `EXPO_PUBLIC_CONSOLE_URL` (back-compat: F-BILL-002 keeps reading it as
 * "the site root"), then https://hangulroute.com (F-APP-001 section 3.6, A-7; F-SITE-002 S-10 gate
 * item 3: Privacy must resolve to the site at every step).
 */
export interface SiteEnv {
  EXPO_PUBLIC_SITE_URL?: string;
  EXPO_PUBLIC_CONSOLE_URL?: string;
}

// Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads, so the default spells the keys out.
export function privacyUrl(
  env: SiteEnv = { EXPO_PUBLIC_SITE_URL: process.env.EXPO_PUBLIC_SITE_URL, EXPO_PUBLIC_CONSOLE_URL: process.env.EXPO_PUBLIC_CONSOLE_URL },
): string {
  const base = (env.EXPO_PUBLIC_SITE_URL?.trim() || env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_SITE).replace(/\/$/, '');
  return `${base}/privacy`;
}

/** Shown when the browser could not be opened (the card has no network use otherwise). */
export const PRIVACY_FALLBACK_NOTE = 'Open hangulroute.com/privacy in a browser.';
