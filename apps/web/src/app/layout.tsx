import { colors, typography } from '@hangul-route/design-system/tokens';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hangul Route — Korean for kids who don’t speak it yet',
  description:
    'A Korean language learning app for English-speaking children 5–11. Heritage Journey across 7 stages and 5 culture themes, 8 mini-games, 24 collectable culture cards, and a tiger guide named Hoya. Free for the first 12 cards. No ads, ever.',
  applicationName: 'Hangul Route',
  keywords: [
    'Korean for kids',
    'Hangul',
    'heritage Korean',
    'Korean American kids',
    'K-culture learning',
    'kids language app',
    'Hoya',
  ],
  openGraph: {
    title: 'Hangul Route — Korean for kids who don’t speak it yet',
    description:
      'Heritage Journey + 24 culture cards + Hoya the tiger. Made for kids 5–11. Free for the first 12 cards.',
    siteName: 'Hangul Route',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hangul Route — Korean for kids who don’t speak it yet',
    description:
      'Heritage Journey + 24 culture cards + Hoya the tiger. Made for kids 5–11.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          backgroundColor: colors.surface.canvas,
          color: colors.text.primary,
          fontFamily:
            typography.family.sans === 'System'
              ? '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
              : typography.family.sans,
          fontSize: typography.size.body,
          lineHeight: typography.leading.normal,
        }}
      >
        {children}
      </body>
    </html>
  );
}
