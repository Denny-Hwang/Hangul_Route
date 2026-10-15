import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The hidden half of `(loc)/[locale]/layout` (F-I18N-001 §3.4, PR 11b) after es and ko shipped (rows 15b / 16b).
 * Nothing in the real `LOCALE_STATUS` is hidden now, so this fixture stands es and ko in for a locale that has not
 * shipped (the way a new locale starts): its pages carry `HIDDEN_LOCALE_ATTR`, which `scripts/prune-hidden-locales.mjs`
 * removes from `out/`, and are noindex; the learner app's flag alone does not show it, the site's QA flag does.
 */
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return {
    ...actual,
    availableLocales: (showAll: boolean = actual.showAllLocalesEnabled()): import('@hangul-route/i18n').UiLocale[] =>
      showAll ? [...actual.LOCALES] : ['en'],
  };
});

import { HIDDEN_LOCALE_ATTR } from '../../lib/site-locales';
import * as locLayout from '../(loc)/[locale]/layout';

type LayoutModule = {
  default: (p: { children: ReactNode; params: { locale: string } }) => JSX.Element;
  generateMetadata: (p: { params: { locale: string } }) => { robots?: unknown };
};
const mod = locLayout as unknown as LayoutModule;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('a locale that has not shipped (fixture)', () => {
  it.each(['es', 'ko'])('renders lang="%s", marked hidden, and noindex', (locale) => {
    expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale } }))).toMatch(
      new RegExp(`^<html lang="${locale}" ${HIDDEN_LOCALE_ATTR}="${locale}">`),
    );
    expect(mod.generateMetadata({ params: { locale } })).toEqual({ robots: { index: false, follow: false } });
  });

  it.each(['es', 'ko'])('the learner app flag (EXPO_PUBLIC_SHOW_ALL_LOCALES=1) alone keeps %s hidden', (locale) => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale } }))).toContain(`${HIDDEN_LOCALE_ATTR}="${locale}"`);
    expect(mod.generateMetadata({ params: { locale } })).toEqual({ robots: { index: false, follow: false } });
  });

  it.each(['es', 'ko'])('a QA build (NEXT_PUBLIC_SHOW_ALL_LOCALES=1) shows %s: no marker, no noindex', (locale) => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(renderToStaticMarkup(mod.default({ children: 'x', params: { locale } }))).toMatch(new RegExp(`^<html lang="${locale}"><body `));
    expect(mod.generateMetadata({ params: { locale } })).toEqual({});
  });
});
