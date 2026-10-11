import { LOCALES, findBannedWord, getMessages, type Messages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { cloudStatusLine, saveNowNote, type CloudStatusInput } from '../status-line';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const state = (patch: Partial<CloudStatusInput> = {}): CloudStatusInput => ({ status: 'idle', lastError: null, lastSyncedAt: null, ...patch });
const m = getMessages('en').caregiver.sync;

describe('cloudStatusLine (F-SYNC-002 §3.3)', () => {
  it('says calmly where progress is saved', () => {
    expect(cloudStatusLine(undefined, NOW, m)).toBe('Saved on this device only.');
    expect(cloudStatusLine(state({ status: 'off' }), NOW, m)).toBe('Saved on this device only.');
    expect(cloudStatusLine(state({ status: 'error', lastError: 'network' }), NOW, m)).toBe("Couldn't reach the cloud — will retry.");
    expect(cloudStatusLine(state({ status: 'syncing' }), NOW, m)).toBe('Saving to the cloud…');
    expect(cloudStatusLine(state(), NOW, m)).toBe('Waiting for the first cloud save.');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:59:40.000Z' }), NOW, m)).toBe('Saved to the cloud · just now');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:48:00.000Z' }), NOW, m)).toBe('Saved to the cloud · 12 min ago');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:59:00.000Z' }), NOW, m)).toBe('Saved to the cloud · 1 min ago');
  });

  it('a device a class linked (403) is told a rescue code turns cloud saving on, not that the cloud is down (SEC-4)', () => {
    expect(cloudStatusLine(state({ status: 'error', lastError: 'http_403' }), NOW, m)).toBe('Saved on this device. A rescue code turns on cloud saving here.');
  });

  it('a timestamp from the future reads as just now, never a negative count', () => {
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T12:05:00.000Z' }), NOW, m)).toBe('Saved to the cloud · just now');
  });
});

describe('saveNowNote (sync/save-progress, after "Save now")', () => {
  it('reports the outcome of the save', () => {
    expect(saveNowNote(state({ status: 'synced', lastSyncedAt: '2026-10-09T12:00:00.000Z' }), m)).toBe('Saved to the cloud.');
    expect(saveNowNote(state({ status: 'off' }), m)).toBe('Cloud saving is not set up on this build.');
    expect(saveNowNote(state({ status: 'error', lastError: 'network' }), m)).toBe("Couldn't reach the cloud — try again later.");
    expect(saveNowNote(state({ status: 'idle', lastError: 'conflict' }), m)).toBe("Couldn't reach the cloud — try again later.");
    expect(saveNowNote(undefined, m)).toBe("Couldn't reach the cloud — try again later.");
  });

  it('a 403 says the device needs a rescue code', () => {
    expect(saveNowNote(state({ status: 'error', lastError: 'http_403' }), m)).toBe("This device can't save to the cloud yet. A rescue code turns it on.");
  });
});

describe('the status line takes its words from the message subtree (F-I18N-001 §3.4 rule 3)', () => {
  const other: Messages['caregiver']['sync'] = {
    status: {
      deviceOnly: 'Solo en este dispositivo.',
      needsRescueCode: 'Falta un codigo.',
      retrying: 'Reintentando.',
      saving: 'Guardando.',
      waiting: 'Esperando.',
      justNow: 'Ahora mismo.',
      minutesAgo: (minutes: number) => `Hace ${minutes} min`,
    },
    saveNow: { saved: 'Guardado.', off: 'Apagado.', needsRescueCode: 'Codigo.', unreachable: 'Sin nube.' },
  };

  it('renders each state from the subtree it is given', () => {
    expect(cloudStatusLine(undefined, NOW, other)).toBe('Solo en este dispositivo.');
    expect(cloudStatusLine(state({ status: 'error', lastError: 'http_403' }), NOW, other)).toBe('Falta un codigo.');
    expect(cloudStatusLine(state({ status: 'error' }), NOW, other)).toBe('Reintentando.');
    expect(cloudStatusLine(state({ status: 'syncing' }), NOW, other)).toBe('Guardando.');
    expect(cloudStatusLine(state(), NOW, other)).toBe('Esperando.');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: NOW.toISOString() }), NOW, other)).toBe('Ahora mismo.');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:55:00.000Z' }), NOW, other)).toBe('Hace 5 min');
    expect(saveNowNote(state({ status: 'synced' }), other)).toBe('Guardado.');
    expect(saveNowNote(state({ status: 'off' }), other)).toBe('Apagado.');
    expect(saveNowNote(state({ status: 'error', lastError: 'http_403' }), other)).toBe('Codigo.');
    expect(saveNowNote(state({ status: 'error' }), other)).toBe('Sin nube.');
  });

  for (const locale of LOCALES) {
    it(`${locale}: every state, minutes counted 1 and many, with no shaming word`, () => {
      const sync = getMessages(locale).caregiver.sync;
      const lines = [
        cloudStatusLine(undefined, NOW, sync),
        cloudStatusLine(state({ status: 'error', lastError: 'http_403' }), NOW, sync),
        cloudStatusLine(state({ status: 'error' }), NOW, sync),
        cloudStatusLine(state({ status: 'syncing' }), NOW, sync),
        cloudStatusLine(state(), NOW, sync),
        cloudStatusLine(state({ status: 'synced', lastSyncedAt: NOW.toISOString() }), NOW, sync),
        cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:59:00.000Z' }), NOW, sync),
        cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:48:00.000Z' }), NOW, sync),
        saveNowNote(state({ status: 'synced' }), sync),
        saveNowNote(state({ status: 'off' }), sync),
        saveNowNote(state({ status: 'error', lastError: 'http_403' }), sync),
        saveNowNote(state({ status: 'error' }), sync),
      ];
      for (const line of lines) {
        expect(line.trim().length, locale).toBeGreaterThan(0);
        expect(findBannedWord(line, locale, 'caregiver'), `${locale}: ${line}`).toBeNull();
      }
      expect(lines[6]).toContain('1');
      expect(lines[7]).toContain('12');
    });
  }
});
