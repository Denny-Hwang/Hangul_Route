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
  ],
};

module.exports = nextConfig;
