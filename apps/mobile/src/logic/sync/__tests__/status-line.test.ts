import { describe, expect, it } from 'vitest';
import { cloudStatusLine } from '../status-line';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const state = (patch: Partial<Parameters<typeof cloudStatusLine>[0] & object> = {}) => ({ status: 'idle' as const, lastError: null, lastSyncedAt: null, ...patch });

describe('cloudStatusLine (F-SYNC-002 §3.3)', () => {
  it('describes each sync state in one calm line', () => {
    expect(cloudStatusLine(undefined, NOW)).toBe('Saved on this device only.');
    expect(cloudStatusLine(state({ status: 'off' }), NOW)).toBe('Saved on this device only.');
    expect(cloudStatusLine(state({ status: 'error', lastError: 'network' }), NOW)).toBe("Couldn't reach the cloud — will retry.");
    expect(cloudStatusLine(state({ status: 'syncing' }), NOW)).toBe('Saving to the cloud…');
    expect(cloudStatusLine(state(), NOW)).toBe('Waiting for the first cloud save.');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:59:40.000Z' }), NOW)).toBe('Saved to the cloud · just now');
    expect(cloudStatusLine(state({ status: 'synced', lastSyncedAt: '2026-10-09T11:48:00.000Z' }), NOW)).toBe('Saved to the cloud · 12 min ago');
  });

  it('a class-linked device is told what turns cloud saving on, not that the cloud is down (SEC-4)', () => {
    expect(cloudStatusLine(state({ status: 'error', lastError: 'http_403' }), NOW)).toBe('Saved on this device. A rescue code turns on cloud saving here.');
  });
});
