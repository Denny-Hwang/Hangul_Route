import { en, getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, useConsoleLocale, useLocale, useMessages } from '../locale-context';

function Probe(): JSX.Element {
  const locale = useLocale();
  const messages = useMessages();
  const { available } = useConsoleLocale();
  return (
    <p>
      {locale}|{messages.console.language.label}|{available.join(',')}|{String(messages === getMessages(locale))}
    </p>
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('console LocaleProvider (F-I18N-001 §3.2)', () => {
  it('outside a provider the hooks give English and the English dictionary', () => {
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>en|Language|en|true</p>');
  });

  it('static HTML is always English: the stored or detected choice applies after mount', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider available={['en', 'es', 'ko']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(html).toBe('<p>en|Language|en,es,ko|true</p>');
  });

  it('lists only shipped locales by default (es and ko are hidden)', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(html).toBe('<p>en|Language|en|true</p>');
  });

  it('lists every locale on a QA build (NEXT_PUBLIC_SHOW_ALL_LOCALES=1)', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    const html = renderToStaticMarkup(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(html).toContain('|en,es,ko|');
  });

  it('renders children only: no wrapper element', () => {
    expect(renderToStaticMarkup(<LocaleProvider>x</LocaleProvider>)).toBe('x');
    expect(en.console.language.label).toBe('Language');
  });
});
