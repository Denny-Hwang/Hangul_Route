/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@hangul-route/content-schema',
    '@hangul-route/shared-types',
    '@hangul-route/design-system',
  ],
};

module.exports = nextConfig;
