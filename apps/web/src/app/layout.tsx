import { colors, typography } from '@hangul-route/design-system/tokens';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hangul Route — Korean for kids',
  description:
    'Korean language learning for English-speaking children 5–11. Heritage Journey, mini-games, and a Hoya the tiger guide.',
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
