import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDeviceUses } from '../device-uses';

/** F-AUTH-004 sections 7.1 and 13.1 (row NS-4; CS-N13): the known grown-up uses on iOS and Android. */

const env = vi.hoisted(() => ({ enabled: true, record: ['family'] as string[] | null }));
vi.mock('../../config/native-signin', () => ({ nativeSignInConfig: () => ({ enabled: env.enabled }) }));
vi.mock('../account-records', () => ({ readUsesRecord: async () => env.record }));

beforeEach(() => {
  env.enabled = true;
  env.record = ['family'];
});

describe('readDeviceUses (native)', () => {
  it('the native account on: the uses record (a known use makes a PIN device shared, OA-D6)', async () => {
    expect(await readDeviceUses()).toEqual(['family']);
  });

  it('no record: none', async () => {
    env.record = null;
    expect(await readDeviceUses()).toEqual([]);
  });

  it('CS-N13: the native account off: none, exactly as at the basis', async () => {
    env.enabled = false;
    expect(await readDeviceUses()).toEqual([]);
  });
});
