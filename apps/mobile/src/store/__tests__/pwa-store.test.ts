import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { INSTALL_GUIDE_SNOOZE_VISITS } from '../../logic/pwa/install-guide';
import { usePwaStore } from '../pwa-store';

describe('pwa-store', () => {
  beforeEach(() => {
    mem.clear();
    usePwaStore.setState({ visits: 0, snoozedUntilVisit: 0, installed: false, hydrated: false, forced: false });
  });

  it('counts each open and persists it', async () => {
    await usePwaStore.getState().hydrateAndCountVisit();
    await usePwaStore.getState().hydrateAndCountVisit();
    expect(usePwaStore.getState().visits).toBe(2);
    expect(usePwaStore.getState().hydrated).toBe(true);
    expect((mem.get('pwa:install-guide') as { visits: number }).visits).toBe(2);
  });

  it('dismiss snoozes relative to the current visit and clears force', async () => {
    mem.set('pwa:install-guide', { visits: 4, snoozedUntilVisit: 0, installed: false });
    await usePwaStore.getState().hydrateAndCountVisit();
    usePwaStore.getState().force();
    expect(usePwaStore.getState().forced).toBe(true);
    usePwaStore.getState().dismiss();
    expect(usePwaStore.getState().snoozedUntilVisit).toBe(5 + INSTALL_GUIDE_SNOOZE_VISITS);
    expect(usePwaStore.getState().forced).toBe(false);
  });

  it('markInstalled persists the flag', () => {
    usePwaStore.getState().markInstalled();
    expect(usePwaStore.getState().installed).toBe(true);
    expect((mem.get('pwa:install-guide') as { installed: boolean }).installed).toBe(true);
  });
});
