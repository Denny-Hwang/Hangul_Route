'use client';

import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { DEFAULT_LOCALE, getMessages, type Messages, type UiLocale } from '@hangul-route/i18n';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { CONTACT_EMAIL } from '../../data/contact';
import { apiBaseUrl } from '../../lib/console/config';
import { submitSignup, type WaitlistState } from '../../lib/waitlist';

/**
 * Launch-invite signup on the landing page (#get). First-party: posts JSON to
 * the API Worker, no third-party form and no page navigation. Design reference:
 * the existing "Email signup / get" block of design/screens landing (same
 * fields and tokens; states added). Only the view is exported for tests.
 */
const MESSAGE_ID = 'waitlist-message';
const CONSENT_ID = 'waitlist-consent';
const EMAIL_ID = 'waitlist-email';

const onPrimary: CSSProperties = { color: colors.text.onPrimary };
const visuallyHidden: CSSProperties = { position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' };
const mailto = `mailto:${CONTACT_EMAIL}`;

type WaitlistWords = Messages['landing']['waitlist'];

const messageFor = (state: WaitlistState, words: WaitlistWords): string | null => {
  switch (state.kind) {
    case 'invalid':
      return words.invalid;
    case 'error':
      return words.error;
    case 'rate_limited':
      return words.rateLimited;
    case 'unavailable':
      return words.unavailable;
    default:
      return null;
  }
};

export interface WaitlistFormViewProps {
  state: WaitlistState;
  email: string;
  website: string;
  onEmailChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** UI locale of the words (`landing.waitlist`); English by default. */
  locale?: UiLocale;
}

export function WaitlistFormView({ state, email, website, onEmailChange, onWebsiteChange, onSubmit, locale = DEFAULT_LOCALE }: WaitlistFormViewProps): JSX.Element {
  const words = getMessages(locale).landing.waitlist;
  const sending = state.kind === 'sending';
  const message = messageFor(state, words);
  const done = state.kind === 'success';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Polite live region: always in the DOM, so the confirmation is announced when it appears. */}
      <div role="status" aria-live="polite" style={{ ...onPrimary, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, lineHeight: typography.leading.relaxed }}>
        {done ? words.success : null}
      </div>
      {done ? null : (
        <>
          <form
            noValidate
            aria-busy={sending}
            onSubmit={onSubmit}
            style={{ display: 'flex', gap: spacing.sm, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <label htmlFor={EMAIL_ID} style={{ position: 'absolute', left: -9999 }}>
              {words.label}
            </label>
            <input
              id={EMAIL_ID}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-required="true"
              aria-invalid={state.kind === 'invalid' ? true : undefined}
              aria-describedby={message ? `${MESSAGE_ID} ${CONSENT_ID}` : CONSENT_ID}
              placeholder={words.placeholder}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              style={{
                flex: '1 1 240px',
                minWidth: 0,
                minHeight: 48,
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radii.pill,
                border: 'none',
                fontSize: typography.size.body,
                color: colors.text.primary,
                backgroundColor: colors.surface.paper,
              }}
            />
            {/* Honeypot: people never see or reach it; a script that fills every field gets silently dropped by the API. */}
            <div aria-hidden="true" style={visuallyHidden}>
              <label htmlFor="waitlist-website">{words.honeypot}</label>
              <input id="waitlist-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => onWebsiteChange(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={sending}
              style={{
                minHeight: 48,
                padding: `${spacing.sm}px ${spacing.xl}px`,
                borderRadius: radii.pill,
                border: 'none',
                backgroundColor: colors.text.primary,
                color: colors.text.inverse,
                fontWeight: typography.weight.bold,
                fontSize: typography.size.body,
                cursor: sending ? 'progress' : 'pointer',
              }}
            >
              {sending ? words.sending : state.kind === 'error' || state.kind === 'rate_limited' ? words.retry : words.submit}
            </button>
          </form>
          {message ? (
            <p
              id={MESSAGE_ID}
              role="alert"
              style={{
                marginTop: spacing.md,
                marginBottom: 0,
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radii.md,
                border: `2px solid ${colors.feedback.nudge}`,
                backgroundColor: colors.surface.paper,
                color: colors.text.primary,
                fontSize: typography.size.bodySm,
                lineHeight: typography.leading.relaxed,
                textAlign: 'left',
              }}
            >
              {message}
              {state.kind === 'unavailable' ? (
                <>
                  {' '}
                  <a href={mailto} style={{ color: colors.brand.primary }}>
                    {CONTACT_EMAIL}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          <p id={CONSENT_ID} style={{ ...onPrimary, marginTop: spacing.md, marginBottom: 0, fontSize: typography.size.bodySm, lineHeight: typography.leading.relaxed }}>
            {words.consentLead}
            <a href={mailto} style={{ ...onPrimary, textDecoration: 'underline' }}>
              {words.contactLink}
            </a>
            {'. '}
            <Link href="/privacy" style={{ ...onPrimary, textDecoration: 'underline' }}>
              {words.privacyLink}
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

export function WaitlistForm(): JSX.Element {
  const [state, setState] = useState<WaitlistState>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (state.kind === 'sending') return;
    setState({ kind: 'sending' });
    void submitSignup({ email, website, endpoint: apiBaseUrl(), source: 'landing', locale: 'en' }).then(setState);
  };

  return <WaitlistFormView state={state} email={email} website={website} onEmailChange={setEmail} onWebsiteChange={setWebsite} onSubmit={onSubmit} />;
}
