import { APP_ROUTES } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { GATE_BROWSE_INTENT_SHIPPED, accessView, gateBrowseUrl } from '../access-view';

/**
 * The Access screen (F-BROWSE-001 section 4.3, OD-3; wireframe browse/access.md;
 * mock design/screens/browse/access.md): one line and the action that fits how
 * the visitor arrived. No lesson, title or card is ever part of it.
 */
describe('accessView without the gate=browse boot intent (gateIntent false: the form before BR-12b, kept for a build without it)', () => {
  it('no action leads to /?gate=browse', () => {
    for (const source of ['gate', 'account', 'unknown'] as const) {
      const view = accessView({ source, lastPersona: 'parent', online: true, gateIntent: false });
      expect([view.primary.href, view.secondary?.href]).not.toContain(gateBrowseUrl());
    }
  });

  it('gate: the grown-up time ended; back to the app, the only button', () => {
    expect(accessView({ source: 'gate', lastPersona: null, online: true, gateIntent: false })).toEqual({
      line: 'gateUntilIntent',
      primary: { label: 'backToApp', href: APP_ROUTES.learn },
      secondary: null,
      offlineLine: false,
    });
  });

  it('account: open lessons again from the account (the persona home), or sign in', () => {
    expect(accessView({ source: 'account', lastPersona: 'parent', online: true })).toEqual({
      line: 'account',
      primary: { label: 'openFromAccount', href: APP_ROUTES.parentHome },
      secondary: { label: 'signIn', href: APP_ROUTES.signIn },
      offlineLine: false,
    });
    expect(accessView({ source: 'account', lastPersona: 'teacher', online: true }).primary).toEqual({ label: 'openFromAccount', href: APP_ROUTES.teacherHome });
    // An expired account pass in a browser that remembers no persona: one Sign in button (sign-in routes to the right home), never two buttons to one page.
    expect(accessView({ source: 'account', lastPersona: null, online: true })).toEqual({
      line: 'account',
      primary: { label: 'signIn', href: APP_ROUTES.signIn },
      secondary: null,
      offlineLine: false,
    });
  });

  it('no view shows two buttons that lead to one page', () => {
    for (const source of ['gate', 'account', 'unknown'] as const) {
      for (const lastPersona of ['parent', 'teacher', null] as const) {
        for (const gateIntent of [false, true]) {
          const view = accessView({ source, lastPersona, online: true, gateIntent });
          expect(view.secondary?.href, `${source} ${lastPersona} ${gateIntent}`).not.toBe(view.primary.href);
        }
      }
    }
  });

  it('unknown: the spec line unchanged, back to the app leads, sign in stays', () => {
    expect(accessView({ source: 'unknown', lastPersona: null, online: true, gateIntent: false })).toEqual({
      line: 'unknown',
      primary: { label: 'backToApp', href: APP_ROUTES.learn },
      secondary: { label: 'signIn', href: APP_ROUTES.signIn },
      offlineLine: false,
    });
  });

  it('offline: account and unknown say grown-up pages need the internet; the gate source does not (its way back works offline)', () => {
    expect(accessView({ source: 'account', lastPersona: 'parent', online: false }).offlineLine).toBe(true);
    expect(accessView({ source: 'unknown', lastPersona: null, online: false }).offlineLine).toBe(true);
    expect(accessView({ source: 'gate', lastPersona: null, online: false }).offlineLine).toBe(false);
  });
});

describe('accessView with the gate=browse boot intent (BR-12b, the shipped default)', () => {
  it('the intent has shipped: the default view leads the gate and unknown sources to /?gate=browse', () => {
    expect(GATE_BROWSE_INTENT_SHIPPED).toBe(true);
    expect(accessView({ source: 'gate', lastPersona: null, online: true }).primary.href).toBe(gateBrowseUrl());
    expect(accessView({ source: 'unknown', lastPersona: null, online: true }).primary.href).toBe(gateBrowseUrl());
  });

  it('gate: back to the grown-up area (PIN, then a fresh gate pass), or back to the app', () => {
    expect(accessView({ source: 'gate', lastPersona: null, online: true, gateIntent: true })).toEqual({
      line: 'gate',
      primary: { label: 'backToGrownUp', href: '/?gate=browse' },
      secondary: { label: 'backToApp', href: APP_ROUTES.learn },
      offlineLine: false,
    });
  });

  it('unknown: back to the grown-up area, or sign in; account is unchanged', () => {
    expect(accessView({ source: 'unknown', lastPersona: null, online: true, gateIntent: true })).toEqual({
      line: 'unknown',
      primary: { label: 'backToGrownUp', href: gateBrowseUrl() },
      secondary: { label: 'signIn', href: APP_ROUTES.signIn },
      offlineLine: false,
    });
    expect(accessView({ source: 'account', lastPersona: 'parent', online: true, gateIntent: true })).toEqual(accessView({ source: 'account', lastPersona: 'parent', online: true }));
  });
});
