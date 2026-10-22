import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from '../(en)/page';

/**
 * The landing's email signup is first-party (docs/launch/waitlist.md): it
 * posts to our own API, never to a third-party newsletter service, and it
 * carries the consent line the privacy policy relies on.
 */
const html = renderToStaticMarkup(<HomePage />);

describe('landing page · launch-invite signup', () => {
  it('no longer posts to a third-party newsletter form', () => {
    expect(html).not.toMatch(/buttondown/i);
    expect(html).not.toMatch(/embed-subscribe/i);
    expect(html).not.toMatch(/<form[^>]*\saction=/);
    expect(html).not.toMatch(/<form[^>]*target="_blank"/);
  });

  it('puts the form inside the #news band under "Launch news by email" (F-SITE-002 §3.3 block 6)', () => {
    const section = /<section id="news"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(section).toContain('Launch news by email');
    expect(section).toMatch(/<form/);
    expect(section).toMatch(/<input[^>]*type="email"/);
    expect(section).toContain('Get launch news');
    // The app is live: the band never reads as a pre-launch invite (F-SITE-002 site facts, 2026-10-21).
    expect(section).not.toMatch(/invite|when Hangul Route launches/i);
  });

  it('shows the consent line with a link to /privacy right under the field', () => {
    const section = /<section id="news"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(section).toContain('We use your email only to send Hangul Route launch news.');
    expect(section).toMatch(/href="\/privacy"/);
    expect(section.indexOf('</form>')).toBeLessThan(section.indexOf('We use your email only'));
  });

  it('promises launch news only, with no free-code or other commercial promise', () => {
    const text = html.replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
    expect(text).toContain("We'll email you when family and class plans launch. Nothing else.");
    // The consent line (CONSENT_TEXT_VERSION) is unchanged: the band's words stay within "launch news".
    expect(text).toContain('We use your email only to send Hangul Route launch news. It is never sold or shared.');
    expect(text).not.toMatch(/family code/i);
    expect(text).not.toMatch(/launch day/i);
  });
});
