import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from '../page';

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

  it('puts the form inside the #get section, which keeps its heading and "Play now" link', () => {
    const section = /<section id="get"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(section).toContain('Try Hangul Route this week.');
    expect(section).toMatch(/<form/);
    expect(section).toMatch(/<input[^>]*type="email"/);
    expect(section).toContain('Send me the invite');
    expect(section).toContain('Play now');
  });

  it('shows the consent line with a link to /privacy right under the field', () => {
    const section = /<section id="get"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(section).toContain('We use your email only to send Hangul Route launch news.');
    expect(section).toMatch(/href="\/privacy"/);
    expect(section.indexOf('</form>')).toBeLessThan(section.indexOf('We use your email only'));
  });

  it('promises launch news only, with no free-code or other commercial promise', () => {
    const text = html.replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
    expect(text).toContain("Leave your email and we'll send you the launch news.");
    expect(text).not.toMatch(/family code/i);
    expect(text).not.toMatch(/launch day/i);
  });
});
