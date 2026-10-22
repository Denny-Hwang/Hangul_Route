import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WaitlistForm, WaitlistFormView, type WaitlistTone } from '../landing/WaitlistForm';
import { WAITLIST_COPY } from '../../data/landing-copy';
import type { WaitlistState } from '../../lib/waitlist';

/**
 * The landing signup form, rendered to markup for each state (the repo's web
 * tests run in node, no DOM). The interactive path — typing, submitting, no
 * page navigation — is covered in apps/web/e2e/waitlist.spec.ts.
 */
const noop = (): void => undefined;

function view(state: WaitlistState, email = ''): string {
  return renderToStaticMarkup(<WaitlistFormView state={state} email={email} website="" onEmailChange={noop} onWebsiteChange={noop} onSubmit={noop} words={WAITLIST_COPY} />);
}

const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('WaitlistFormView · idle', () => {
  const html = view({ kind: 'idle' });

  it('is a real form with a labelled email field and a submit button, posting nowhere by itself', () => {
    expect(html).toMatch(/<form[^>]*noValidate/i);
    expect(html).not.toMatch(/<form[^>]*\saction=/);
    expect(html).not.toMatch(/buttondown/i);
    expect(html).toMatch(/<label[^>]*for="waitlist-email"[^>]*>Your email<\/label>/);
    expect(html).toMatch(/<input[^>]*id="waitlist-email"[^>]*type="email"/);
    expect(html).toMatch(/autoComplete="email"|autocomplete="email"/i);
    expect(html).toMatch(/required/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Get launch news<\/button>/);
  });

  it('has a hidden honeypot that people and screen readers skip', () => {
    const trap = /<div[^>]*aria-hidden="true"[^>]*>[\s\S]*?<input[^>]*name="website"[^>]*>/.exec(html);
    expect(trap).not.toBeNull();
    expect(trap?.[0]).toMatch(/tabindex="-1"/i);
    expect(trap?.[0]).toMatch(/autocomplete="off"/i);
  });

  it('carries the consent line with links to the privacy policy and the contact address', () => {
    expect(text(html)).toContain('We use your email only to send Hangul Route launch news');
    expect(html).toMatch(/<a[^>]*href="\/privacy"/);
    expect(html).toMatch(/<a[^>]*href="mailto:hello@hangulroute\.com"/);
    expect(html).toMatch(/aria-describedby="[^"]*waitlist-consent/);
  });

  it('keeps a polite live region present so announcements work, and no error yet', () => {
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/);
    expect(html).not.toMatch(/role="alert"/);
    expect(html).not.toMatch(/aria-invalid="true"/);
  });
});

describe('WaitlistFormView · states', () => {
  it('sending: the button is disabled and says so, the form is marked busy', () => {
    const html = view({ kind: 'sending' }, 'a@b.co');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Sending<\/button>|<button[^>]*>Sending<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toMatch(/aria-busy="true"/);
  });

  it('success: shows the confirmation in the live region and takes the form away', () => {
    const html = view({ kind: 'success' });
    expect(text(html)).toContain("You're on the list");
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"[^>]*>[\s\S]*You&#x27;re on the list/);
    expect(html).not.toMatch(/<input/);
    expect(html).not.toMatch(/Get launch news/);
  });

  it('invalid: tells the visitor what to fix, in an alert tied to the field', () => {
    const html = view({ kind: 'invalid' }, 'nope');
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(html).toMatch(/aria-describedby="[^"]*waitlist-message/);
    expect(html).toMatch(/role="alert"[^>]*>[^<]*Please enter a valid email address/);
  });

  it('error: says what happened and offers a retry on the same button', () => {
    const html = view({ kind: 'error' }, 'a@b.co');
    expect(html).toMatch(/role="alert"[^>]*>[^<]*(could not|couldn&#x27;t) reach/i);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Try again<\/button>/);
    expect(html).toContain('value="a@b.co"');
  });

  it('rate_limited: asks the visitor to wait', () => {
    expect(view({ kind: 'rate_limited' })).toMatch(/role="alert"[^>]*>[^<]*wait/i);
  });

  it('unavailable: points to the contact address instead of failing silently', () => {
    const html = view({ kind: 'unavailable' });
    expect(html).toMatch(/role="alert"/);
    expect(html).toMatch(/href="mailto:hello@hangulroute\.com"/);
  });

  it('has no emoji or price talk in any state', () => {
    for (const kind of ['idle', 'sending', 'success', 'invalid', 'error', 'rate_limited', 'unavailable'] as const) {
      const html = view({ kind });
      expect(html, kind).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text(html), kind).not.toMatch(/\$\s?\d|\bprice\b|\bStripe\b/i);
    }
  });

  it('styles only from design tokens: no colour literal in the component source (CLAUDE.md section 4)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'landing', 'WaitlistForm.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(source).toContain('@hangul-route/design-system/tokens');
  });

  it('every visible string comes from the shared copy table', () => {
    const t = text(view({ kind: 'idle' }));
    expect(t).toContain(WAITLIST_COPY.label);
    expect(t).toContain(WAITLIST_COPY.submit);
  });
});

describe('WaitlistForm (stateful wrapper)', () => {
  it('renders the idle form on first paint, same as the view', () => {
    expect(renderToStaticMarkup(<WaitlistForm words={WAITLIST_COPY} />)).toContain('Get launch news');
  });

  it('renders the words it is given (the page passes them in its locale)', () => {
    const words = { ...WAITLIST_COPY, submit: 'Enviarme la invitación' };
    expect(renderToStaticMarkup(<WaitlistForm words={words} locale="es" />)).toContain('Enviarme la invitación');
  });

  it('links the privacy policy in the page locale (F-I18N-001 PR 11b)', () => {
    expect(renderToStaticMarkup(<WaitlistForm words={WAITLIST_COPY} />)).toMatch(/<a[^>]*href="\/privacy"/);
    expect(renderToStaticMarkup(<WaitlistForm words={WAITLIST_COPY} locale="es" />)).toMatch(/<a[^>]*href="\/es\/privacy"/);
  });
});

/** [SN] AMENDMENTS-SITE-NEWUSER §3.3 item 6: the home's launch news sits in a plain section, `tone="plain"`. */
describe('WaitlistFormView · tone', () => {
  const toned = (tone?: WaitlistTone): string =>
    renderToStaticMarkup(
      <WaitlistFormView state={{ kind: 'idle' }} email="" website="" onEmailChange={noop} onWebsiteChange={noop} onSubmit={noop} words={WAITLIST_COPY} tone={tone} />,
    );
  const consentOf = (html: string): string => /<p id="waitlist-consent"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
  const field = (html: string): string => /<input[^>]*id="waitlist-email"[^>]*>/.exec(html)?.[0] ?? '';
  const button = (html: string): string => /<button[^>]*type="submit"[^>]*>/.exec(html)?.[0] ?? '';

  it('defaults to the band: unchanged markup without the prop, 48 px controls, text on primary', () => {
    expect(toned()).toBe(view({ kind: 'idle' }));
    expect(toned('band')).toBe(view({ kind: 'idle' }));
    expect(field(toned())).toContain('min-height:48px');
    expect(consentOf(toned())).toContain(`color:${colors.text.onPrimary}`);
  });

  it('plain: secondary text, links in brand.primaryDark, field and button touchTarget.min (64) tall', () => {
    const html = toned('plain');
    expect(touchTarget.min).toBe(64);
    expect(field(html)).toContain(`min-height:${touchTarget.min}px`);
    expect(button(html)).toContain(`min-height:${touchTarget.min}px`);
    expect(html).toMatch(new RegExp(`<p id="waitlist-consent" style="color:${colors.text.secondary}`));
    const anchors = [...consentOf(html).matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(anchors).toHaveLength(2);
    for (const a of anchors) expect(a).toContain(`color:${colors.brand.primaryDark}`);
    expect(html).toMatch(new RegExp(`<div role="status" aria-live="polite" style="color:${colors.text.secondary}`));
  });

  it('the consent words are byte-identical in both tones (CONSENT_TEXT_VERSION does not move)', () => {
    expect(text(consentOf(toned('plain')))).toBe(text(consentOf(toned('band'))));
    expect(text(toned('plain'))).toBe(text(toned('band')));
  });
});
