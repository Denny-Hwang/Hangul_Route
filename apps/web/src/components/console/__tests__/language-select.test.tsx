import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { LanguageSelect } from '../LanguageSelect';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('console header language select (F-I18N-001 §3.3, wireframe language-picker.md §C)', () => {
  it('shows by default now that es and ko ship (the same LOCALE_STATUS rule as the mobile pickers)', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <LanguageSelect />
      </LocaleProvider>,
    );
    expect(html).toContain('<option value="es" lang="es">Español</option>');
    expect(html).toContain('<option value="ko" lang="ko">한국어</option>');
  });

  it('is absent when only one locale is available', () => {
    expect(
      renderToStaticMarkup(
        <LocaleProvider available={['en']}>
          <LanguageSelect />
        </LocaleProvider>,
      ),
    ).toBe('');
  });

  it('is a native select of endonyms, each option tagged with its language, when more than one locale is available', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider available={['en', 'es', 'ko']}>
        <LanguageSelect />
      </LocaleProvider>,
    );
    expect(html).toMatch(/^<select[^>]* aria-label="Language"/);
    expect(html).toContain('<option value="en" lang="en" selected="">English</option>');
    expect(html).toContain('<option value="es" lang="es">Español</option>');
    expect(html).toContain('<option value="ko" lang="ko">한국어</option>');
    expect(html).toContain('data-testid="console-language"');
  });

  it('shows on a QA build with every locale (NEXT_PUBLIC_SHOW_ALL_LOCALES=1)', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <LanguageSelect />
      </LocaleProvider>,
    );
    expect(html).toContain('<option value="ko" lang="ko">한국어</option>');
  });

  // Its place in the adult frame (header from 45em, footer below it) is adult-frame.test.tsx's (F-APP-001 A-5a).
});
