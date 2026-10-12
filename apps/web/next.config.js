const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export → one assets-only Cloudflare Worker (apps/web/wrangler.toml),
  // same shape as the learner app. No server runtime, no adapter.
  output: 'export',
  images: { unoptimized: true },
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
