/**
 * The one rule for which links the Sources screen may hand to a browser
 * (F-STORY-002 §3.8, §3.14 #3): a plain absolute `https:` URL with a host, no
 * credentials, no whitespace, backslash or control characters. Its own module
 * so the view model (`sources-view`, which decides whether Open link is
 * offered), the link rules (`source-link`) and the platform hand-off
 * (`platform/external-link`) share it without importing each other. Written
 * without `URL` (React Native's is partial).
 */
const SAFE_HTTPS = /^https:\/\/[^\s/?#@\\]+(?:[/?#][^\s\\]*)?$/i;

export function isSafeHttpsUrl(url: string): boolean {
  // eslint-disable-next-line no-control-regex
  return SAFE_HTTPS.test(url) && !/[\u0000-\u001f\u007f]/.test(url);
}
