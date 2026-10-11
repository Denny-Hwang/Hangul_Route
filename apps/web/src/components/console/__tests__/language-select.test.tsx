import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { LanguageSelect } from '../LanguageSelect';
import { ConsoleShell } from '../ui';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('console header language select (F-I18N-001 §3.3, wireframe language-picker.md §C)', () => {
  it('is absent while only English ships (the same LOCALE_STATUS rule as the mobile pickers)', () => {
    expect(renderToStaticMarkup(<LanguageSelect />)).toBe('');
    expect(
      renderToStaticMarkup(
        <LocaleProvider>
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

  it('sits first in the ConsoleShell header nav, which wraps on narrow screens; the default header is unchanged', () => {
    const plain = renderToStaticMarkup(
      <LocaleProvider>
        <ConsoleShell title="Class A">body</ConsoleShell>
      </LocaleProvider>,
    );
    expect(plain).not.toContain('<select');
    expect(plain).toMatch(/<nav[^>]*><button[^>]*disabled=""[^>]*>Account<\/button>/);
    expect(plain).toMatch(/<nav style="[^"]*flex-wrap:wrap/);

    const qa = renderToStaticMarkup(
      <LocaleProvider available={['en', 'es', 'ko']}>
        <ConsoleShell title="Class A">body</ConsoleShell>
      </LocaleProvider>,
    );
    expect(qa).toMatch(/<nav[^>]*><select[^>]*aria-label="Language"[\s\S]*<\/select><button[^>]*>Account<\/button>/);
  });
});
