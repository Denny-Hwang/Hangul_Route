import { SHELL_TELEMETRY_PAYLOADS, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import {
  dashboardSignInLabel,
  entryLine,
  grownUpEntriesOn,
  grownUpRowLabel,
  grownUpRowTitle,
  personaChosen,
  personaSignInPath,
  planOpenBlocked,
  runGrownUpHandoff,
  startEvent,
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
    const allowed = SHELL_TELEMETRY_PAYLOADS['shell.persona_chosen'] ?? {};
    for (const persona of ['learner', 'parent', 'teacher'] as const) {
      for (const from of ['welcome', 'welcome-continue'] as const) {
        const event = personaChosen(persona, from);
        expect(Object.keys(event.payload).sort()).toEqual(Object.keys(allowed).sort());
        expect(allowed.persona ?? []).toContain(event.payload.persona);
        expect(allowed.from ?? []).toContain(event.payload.from);
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

describe("startEvent (Let's start, section 3.18)", () => {
  it("sends shell.persona_chosen { persona: 'learner', from: 'welcome' } when the grown-ups' row shows", () => {
    expect(startEvent(true)).toEqual({ name: 'shell.persona_chosen', payload: { persona: 'learner', from: 'welcome' } });
  });

  it('sends nothing with the entries off (flag off or a native build)', () => {
    expect(startEvent(false)).toBeNull();
  });
});

describe('runGrownUpHandoff (Profile row and dashboard Open, section 3.6, behaviour 22)', () => {
  it('asks for the PIN with the same via when the hand-off needs a fresh one', async () => {
    const open = vi.fn().mockResolvedValue('pin');
    const askPin = vi.fn();
    await runGrownUpHandoff('dashboard', { current: false }, open, askPin);
    expect(open).toHaveBeenCalledWith({ via: 'dashboard' });
    expect(askPin).toHaveBeenCalledWith('dashboard');
  });

  it('does not ask for the PIN when the area opened', async () => {
    const askPin = vi.fn();
    await runGrownUpHandoff('profile', { current: false }, vi.fn().mockResolvedValue('opened'), askPin);
    expect(askPin).not.toHaveBeenCalled();
  });

  it('runs once for two taps in the same render, then frees the entry again', async () => {
    let finish: (v: 'opened') => void = () => undefined;
    const open = vi.fn(() => new Promise<'opened'>((resolve) => (finish = resolve)));
    const busy = { current: false };
    const first = runGrownUpHandoff('profile', busy, open, vi.fn());
    const second = runGrownUpHandoff('profile', busy, open, vi.fn());
    await second;
    expect(open).toHaveBeenCalledTimes(1);
    finish('opened');
    await first;
    expect(busy.current).toBe(false);
    const third = runGrownUpHandoff('profile', busy, open, vi.fn());
    expect(open).toHaveBeenCalledTimes(2);
    finish('opened');
    await third;
  });

  it('settles quietly and frees the entry when the hand-off throws', async () => {
    const busy = { current: false };
    const askPin = vi.fn();
    await expect(runGrownUpHandoff('profile', busy, vi.fn().mockRejectedValue(new Error('x')), askPin)).resolves.toBeUndefined();
    expect(askPin).not.toHaveBeenCalled();
    expect(busy.current).toBe(false);
  });
});

describe('planOpenBlocked (Plan screen Open billing offline, sections 3.6, 3.12, 3.19)', () => {
  it('blocks Open billing only with the entries on and the browser offline', () => {
    expect(planOpenBlocked(true, false)).toBe(true);
    expect(planOpenBlocked(true, true)).toBe(false);
    expect(planOpenBlocked(false, false)).toBe(false);
  });
});

describe('dashboardSignInLabel (D9 on the dashboard row; owner request 2026-10-16, item 8)', () => {
  it('says what it opens: family and class tools on a family device, the account on a self-only device', () => {
    expect(dashboardSignInLabel('family', en)).toBe('Sign in for family and class tools');
    expect(dashboardSignInLabel('self', en)).toBe('Sign in to your account');
    expect(dashboardSignInLabel('self', en)).not.toMatch(/family|grown-up/i);
  });
});
