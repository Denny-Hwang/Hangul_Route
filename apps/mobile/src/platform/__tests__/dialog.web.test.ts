import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirm, setConfirmPresenter } from '../dialog.web';

describe('platform/dialog.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('with a ConfirmHost mounted, the question and both labels go to its sheet (AMENDMENTS-DISPLAY-NAV section 8)', async () => {
    const browserConfirm = vi.fn(() => true);
    vi.stubGlobal('confirm', browserConfirm);
    const presenter = vi.fn(async () => false);
    const release = setConfirmPresenter(presenter);
    const opts = { title: 'Leave?', message: 'Sure?', confirmLabel: 'Leave', cancelLabel: 'Stay' };
    await expect(confirm(opts)).resolves.toBe(false);
    expect(presenter).toHaveBeenCalledWith(opts);
    expect(browserConfirm).not.toHaveBeenCalled();
    release();
  });

  it('a release only clears its own presenter', async () => {
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    const releaseFirst = setConfirmPresenter(first);
    const releaseSecond = setConfirmPresenter(second);
    releaseFirst();
    await confirm({ title: 'A', confirmLabel: 'Ok', cancelLabel: 'No' });
    expect(second).toHaveBeenCalledTimes(1);
    releaseSecond();
  });

  it('before a host is mounted: joins title and message in the browser confirm and returns its answer', async () => {
    const c = vi.fn(() => true);
    vi.stubGlobal('confirm', c);
    await expect(confirm({ title: 'Leave?', message: 'Sure?', confirmLabel: 'Leave', cancelLabel: 'Stay' })).resolves.toBe(true);
    expect(c).toHaveBeenCalledWith('Leave?\n\nSure?');
    await expect(confirm({ title: 'Only a title', confirmLabel: 'Ok', cancelLabel: 'No' })).resolves.toBe(true);
    expect(c).toHaveBeenLastCalledWith('Only a title');
  });

  it('[DP] before a host is mounted, a second line (`detail`) follows the message', async () => {
    const c = vi.fn(() => false);
    vi.stubGlobal('confirm', c);
    await expect(confirm({ title: 'Damaged', message: 'Kept a copy.', detail: 'Learners come back.', confirmLabel: 'Start', cancelLabel: 'Not now' })).resolves.toBe(false);
    expect(c).toHaveBeenCalledWith('Damaged\n\nKept a copy.\n\nLearners come back.');
  });

  it('resolves false when confirm is unavailable', async () => {
    vi.stubGlobal('confirm', undefined);
    await expect(confirm({ title: 'A', confirmLabel: 'Ok', cancelLabel: 'No' })).resolves.toBe(false);
  });
});
