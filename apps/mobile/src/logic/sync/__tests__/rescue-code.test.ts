import { normalizeRescueCode } from '@hangul-route/content-schema';
import { LOCALES, findBannedWord, getMessages, type Messages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { RESCUE_INPUT_MAX, claimErrorMessage, cleanRescueInput, rescueCodeHint, rescueCodeLines, rescueInputRows } from '../rescue-code';

const m = getMessages('en').caregiver;

describe('rescue code helpers (F-RESTORE-001)', () => {
  it('cleans the one code field while typing: upper case, letters, digits and single separators', () => {
    expect(cleanRescueInput('tiger moon')).toBe('TIGER MOON');
    expect(cleanRescueInput('  tiger\n\nmoon-river ')).toBe('TIGER MOON-RIVER ');
    expect(cleanRescueInput('tiger.moon!4821')).toBe('TIGERMOON4821');
    expect(cleanRescueInput('x'.repeat(100))).toHaveLength(RESCUE_INPUT_MAX);
    // the longest code (four 10-letter words + six digits) fits with room for spaces
    expect(RESCUE_INPUT_MAX).toBeGreaterThanOrEqual('LIGHTHOUSE-SUNFLOWER-LIGHTHOUSE-SUNFLOWER-482139'.length + 8);
  });

  it('a pasted or typed code of either shape normalizes after cleaning (SEC-5 + codes already issued)', () => {
    expect(normalizeRescueCode(cleanRescueInput('Tiger Moon River Apple 482139'))).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(normalizeRescueCode(cleanRescueInput('tiger-moon-4821'))).toBe('TIGER-MOON-4821');
    expect(normalizeRescueCode(cleanRescueInput('tiger moon'))).toBeNull();
  });

  it('describes the shape of the code a parent is looking at', () => {
    expect(rescueCodeHint('TIGER-MOON-RIVER-APPLE-482139', m.saveProgress)).toBe('four words + 6 digits');
    expect(rescueCodeHint('TIGER-MOON-4821', m.saveProgress)).toBe('two words + 4 digits');
    expect(rescueCodeHint('not a code', m.saveProgress)).toBeNull();
  });

  it('lays a code out one word per row, the number last, so no word breaks mid-way on a narrow phone', () => {
    expect(rescueCodeLines('TIGER-MOON-RIVER-APPLE-482139')).toEqual(['TIGER', 'MOON', 'RIVER', 'APPLE', '482139']);
    expect(rescueCodeLines('PADDLE-GLACIER-4992')).toEqual(['PADDLE', 'GLACIER', '4992']);
    expect(rescueCodeLines('tiger moon 4821')).toEqual(['TIGER', 'MOON', '4821']); // stored as typed, shown tidy
    expect(rescueCodeLines('not a code')).toEqual(['not a code']); // never hide what is stored
  });

  it('has calm copy for every error', () => {
    for (const c of ['code_not_found', 'too_many_attempts', 'network', 'invalid', 'unknown'] as const) {
      expect(claimErrorMessage(c, m).length).toBeGreaterThan(10);
    }
    expect(claimErrorMessage('code_not_found', m)).not.toMatch(/wrong|fail/i);
    // the format hint shows the new shape and still names the older one
    expect(claimErrorMessage('invalid', m)).toContain('TIGER-MOON-RIVER-APPLE-482139');
    expect(claimErrorMessage('invalid', m)).toContain('TIGER-MOON-4821');
  });

  it('keeps the English wording of every error', () => {
    expect(claimErrorMessage('code_not_found', m)).toBe('Check the code and try again.');
    expect(claimErrorMessage('too_many_attempts', m)).toBe("Let's wait a few minutes before trying again.");
    expect(claimErrorMessage('network', m)).toBe('This needs internet. Try again when you are online.');
    expect(claimErrorMessage('invalid', m)).toBe(
      'Type every word and the number, like TIGER-MOON-RIVER-APPLE-482139 (older codes: TIGER-MOON-4821).',
    );
    expect(claimErrorMessage('unknown', m)).toBe('Something went wrong. Try again in a moment.');
  });

  it('the invalid-code line is the one message the Forgot PIN screen uses too', () => {
    const other: Pick<Messages['caregiver'], 'restore' | 'retry' | 'pin'> = {
      ...m,
      pin: { ...m.pin, reset: { ...m.pin.reset, failure: { ...m.pin.reset.failure, badFormat: 'Formato.' } } },
    };
    expect(claimErrorMessage('invalid', other)).toBe('Formato.');
  });
});

describe('the rescue-code lines take their words from the message subtree (F-I18N-001 §3.4 rule 3)', () => {
  it('renders errors and the code shape from the subtree it is given', () => {
    const other: Pick<Messages['caregiver'], 'restore' | 'retry' | 'pin'> = {
      ...m,
      restore: { ...m.restore, code: { ...m.restore.code, notFound: 'Revisa el codigo.' } },
      retry: { tooManyAttempts: 'Espera.', offline: 'Sin internet.', unknown: 'Otra vez.' },
    };
    expect(claimErrorMessage('code_not_found', other)).toBe('Revisa el codigo.');
    expect(claimErrorMessage('too_many_attempts', other)).toBe('Espera.');
    expect(claimErrorMessage('network', other)).toBe('Sin internet.');
    expect(claimErrorMessage('unknown', other)).toBe('Otra vez.');
    const shape = { ...m.saveProgress, codeShape: (words: number, digits: number) => `${words} palabras + ${digits}` };
    expect(rescueCodeHint('TIGER-MOON-RIVER-APPLE-482139', shape)).toBe('4 palabras + 6');
    expect(rescueCodeHint('TIGER-MOON-4821', shape)).toBe('2 palabras + 4');
  });

  for (const locale of LOCALES) {
    it(`${locale}: every claim error is calm (no shaming word)`, () => {
      const caregiver = getMessages(locale).caregiver;
      for (const c of ['code_not_found', 'too_many_attempts', 'network', 'invalid', 'unknown'] as const) {
        expect(findBannedWord(claimErrorMessage(c, caregiver), locale, 'caregiver'), `${locale}.${c}`).toBeNull();
      }
    });
  }
});

describe('rescueInputRows', () => {
  it('plans one row per typed word or number, between two and five', () => {
    expect(rescueInputRows('')).toBe(2);
    expect(rescueInputRows('PADDLE')).toBe(2);
    expect(rescueInputRows('PADDLE GLACIER 4992')).toBe(3);
    expect(rescueInputRows('TIGER MOON RIVER APPLE')).toBe(4);
    expect(rescueInputRows('TIGER MOON RIVER APPLE 482139')).toBe(5);
    expect(rescueInputRows('  TIGER   MOON  ')).toBe(2);
    expect(rescueInputRows('A B C D E F G')).toBe(5);
  });

  it('counts a hyphen as a break too: a pasted code plans the same rows as a typed one (DN-3b review)', () => {
    expect(rescueInputRows('TIGER-MOON-RIVER-APPLE-482139')).toBe(5);
    expect(rescueInputRows('TIGER-MOON-RIVER-APPLE-482139')).toBe(rescueInputRows('TIGER MOON RIVER APPLE 482139'));
    expect(rescueInputRows('PADDLE-GLACIER-4992')).toBe(3);
    expect(rescueInputRows('TIGER-MOON RIVER-')).toBe(3);
    expect(rescueInputRows('-')).toBe(2);
  });
});
