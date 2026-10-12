import { SHELL_TELEMETRY_PAYLOADS, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  entryLine,
  grownUpEntriesOn,
  grownUpRowLabel,
  grownUpRowTitle,
  personaChosen,
  personaSignInPath,
  welcomeRow,
} from '../entry-points';

const en = getMessages('en');

describe('grownUpEntriesOn (F-APP-001 section 3.6, OD-6)', () => {
  it('shows the entries on the web with the flag on only', () => {
    expect(grownUpEntriesOn(true, 'web')).toBe(true);
    expect(grownUpEntriesOn(false, 'web')).toBe(false);
  });

  it('never shows them on a native build or an unknown platform, whatever the flag', () => {
    for (const os of ['ios', 'android', undefined]) expect(grownUpEntriesOn(true, os)).toBe(false);
  });
});

describe('welcomeRow (Panels A and B)', () => {
  it('offers both persona buttons on a browser with no last persona', () => {
    expect(welcomeRow(null, false)).toEqual({ kind: 'choose' });
  });

  it('offers Continue as the remembered persona', () => {
    expect(welcomeRow('teacher', false)).toEqual({ kind: 'continue', persona: 'teacher' });
    expect(welcomeRow('parent', false)).toEqual({ kind: 'continue', persona: 'parent' });
  });

  it('swaps back to both buttons after Someone else', () => {
    expect(welcomeRow('teacher', true)).toEqual({ kind: 'choose' });
  });
});

describe('personaSignInPath', () => {
  it('opens sign-in with the persona hint for a button of Panel A', () => {
    expect(personaSignInPath('parent')).toBe('/signin?persona=parent');
    expect(personaSignInPath('teacher')).toBe('/signin?persona=teacher');
  });

  it('opens the plain sign-in router for Continue, which routes a signed-in grown-up home', () => {
    expect(personaSignInPath(null)).toBe('/signin');
  });
});

describe('personaChosen (shell.persona_chosen, section 3.18)', () => {
  it('builds the event with codes only and no profile id', () => {
    expect(personaChosen('learner', 'welcome')).toEqual({ name: 'shell.persona_chosen', payload: { persona: 'learner', from: 'welcome' } });
    expect(personaChosen('teacher', 'welcome-continue')).toEqual({
      name: 'shell.persona_chosen',
      payload: { persona: 'teacher', from: 'welcome-continue' },
    });
  });

  it('sends only names and values the Worker keeps', () => {
    expect(TELEMETRY_EVENT_NAMES).toContain('shell.persona_chosen');
    const allowed = SHELL_TELEMETRY_PAYLOADS['shell.persona_chosen'];
    for (const persona of ['learner', 'parent', 'teacher'] as const) {
      for (const from of ['welcome', 'welcome-continue'] as const) {
        const event = personaChosen(persona, from);
        expect(Object.keys(event.payload).sort()).toEqual(Object.keys(allowed).sort());
        expect(allowed.persona).toContain(event.payload.persona);
        expect(allowed.from).toContain(event.payload.from);
        expect(event).not.toHaveProperty('profileId');
      }
    }
  });
});

describe('the Profile row (D9, D11)', () => {
  const row = en.learner.profile.grownUpHome;

  it('says "Grown-up home" on a family device and "Account home" on a self-only device', () => {
    expect(grownUpRowTitle('family', row)).toBe('Grown-up home');
    expect(grownUpRowTitle('self', row)).toBe('Account home');
  });

  it('reads its title and line together, then the gate hint the caller adds', () => {
    expect(grownUpRowLabel('Grown-up home', 'Your family, classes and billing')).toBe('Grown-up home, Your family, classes and billing');
  });
});

describe('entryLine (offline, section 3.12)', () => {
  it('keeps the line online and says "Needs the internet" offline', () => {
    expect(entryLine(true, 'Your family, classes and billing', 'Needs the internet')).toBe('Your family, classes and billing');
    expect(entryLine(false, 'Your family, classes and billing', 'Needs the internet')).toBe('Needs the internet');
  });
});
