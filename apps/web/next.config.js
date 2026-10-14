const path = require('node:path');

/** Hosts where a plain-http CONSOLE_ORIGIN is allowed: this machine only. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
/** The only domain an https CONSOLE_ORIGIN may name (itself or a subdomain), so a mistyped host fails the build. */
const SITE_DOMAIN = 'hangulroute.com';
/** The kill switch values (trimmed, lower case): grown-up links stay on the site (CONSOLE_ORIGIN_OFF in site-links.ts). */
const CONSOLE_ORIGIN_OFF = ['false', '0'];

/**
 * CONSOLE_ORIGIN as the build inlines it: unset = '', a blank value as it is (both mean the default, the app
 * host since F-SITE-002 S-10), and the kill switch `false` or `0` as it is (the site's own origin). Any other
 * value must be an https URL on hangulroute.com or a subdomain (plain http only on LOCAL_HOSTS), the rule of
 * parseConsoleOrigin in src/lib/site-links.ts, which this CommonJS file cannot import; site-links.test.ts checks
 * they agree. A value that parseConsoleOrigin would ignore (the likeliest typo leaves out "https://") fails the
 * build, and a failed build keeps the previous deployment live, instead of shipping links nobody asked for.
 * @param {string | undefined} raw
 * @returns {string}
 */
function consoleOrigin(raw) {
  const value = raw ?? '';
  const trimmed = value.trim();
  if (!trimmed || CONSOLE_ORIGIN_OFF.includes(trimmed.toLowerCase())) return value;
  let url = null;
  try {
    url = new URL(trimmed);
  } catch {
    url = null;
  }
  const ownHost = url !== null && (url.hostname === SITE_DOMAIN || url.hostname.endsWith(`.${SITE_DOMAIN}`));
  const allowed = url !== null && ((url.protocol === 'https:' && ownHost) || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)));
  if (!allowed) {
    throw new Error(
      `CONSOLE_ORIGIN must be an https origin on hangulroute.com such as https://app.hangulroute.com (plain http only for localhost), got ${JSON.stringify(value)}. Set it to false to keep grown-up links on this site.`,
    );
  }
  return value;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export → one assets-only Cloudflare Worker (apps/web/wrangler.toml),
  // same shape as the learner app. No server runtime, no adapter.
  output: 'export',
  images: { unoptimized: true },
  // The site build variable of F-SITE-002 §3.8: where the site's grown-up links point (lib/site-links.ts).
  // Inlined in server and client code alike; unset = the app host (S-10), false or 0 = the site's own origin.
  env: { CONSOLE_ORIGIN: consoleOrigin(process.env.CONSOLE_ORIGIN) },
  transpilePackages: [
    '@hangul-route/content-schema',
    '@hangul-route/shared-types',
    '@hangul-route/design-system',
    '@hangul-route/i18n',
  ],
  // The design system's HeritageCardArt draws with react-native-svg; on the
  // web console its shapes map to DOM SVG (src/shims/react-native-svg.tsx), so
  // /design-preview/word-art can show the real card art (F-VOC-002 §3.11).
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, 'react-native-svg$': path.join(__dirname, 'src/shims/react-native-svg.tsx') };
    return config;
  },
};

module.exports = nextConfig;
