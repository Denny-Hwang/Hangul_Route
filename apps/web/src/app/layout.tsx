import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteMetadata } from '../data/landing-copy';
import './globals.css';

/**
 * The top of the app (F-I18N-001 §3.4, PR 11b): the stylesheet and the site metadata, and no `<html>`.
 * Each route group renders its own document — `(en)` and `(console)` with `lang="en"`, `(loc)/[locale]` with
 * the locale's `lang` — so the static HTML carries the right `<html lang>` without middleware. Next 14 needs
 * this top layout for the exported 404 page (`not-found.tsx`), which renders its own document too.
 */
export const metadata: Metadata = siteMetadata;

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
