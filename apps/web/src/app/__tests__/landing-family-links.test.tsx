import { getMessages } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../../components/landing/LandingPage';

/**
 * F-APP-001 A-5b review: `/parent` is the signed-in family home now (the public demo left, OD-4). The landing
 * page's header "Dashboard" and footer "Parent dashboard" therefore open the family sign-in through the site
 * links helper (`signIn('parent')`, F-SITE-002 section 3.8), never `/parent` itself, until F-SITE-002 S-6
 * replaces that header and footer.
 */
afterEach(() => vi.unstubAllEnvs());

const hrefsOf = (html: string, text: string): string[] =>
  [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].filter((m) => m[2] === text).map((m) => (m[1] ?? '').replace(/&amp;/g, '&'));

describe('the landing page links to the family sign-in, not to /parent', () => {
  it('header Dashboard and footer Parent dashboard open /signin?persona=parent on the same origin', () => {
    vi.stubEnv('CONSOLE_ORIGIN', '');
    const t = getMessages('en').landing;
    const html = renderToStaticMarkup(<LandingPage locale="en" />);
    expect(html).not.toMatch(/href="\/parent"/);
    expect(hrefsOf(html, t.nav.dashboard)).toEqual(['/signin?persona=parent']);
    expect(hrefsOf(html, t.footer.dashboard)).toEqual(['/signin?persona=parent']);
  });

  it('with the grown-up origin set on the site build, they go to the app host sign-in', () => {
    vi.stubEnv('CONSOLE_ORIGIN', 'https://app.hangulroute.com');
    const t = getMessages('en').landing;
    const html = renderToStaticMarkup(<LandingPage locale="en" />);
    expect(hrefsOf(html, t.nav.dashboard)).toEqual(['https://app.hangulroute.com/signin?persona=parent']);
  });
});
