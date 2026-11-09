import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../../config/app-version';

const track = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../telemetry', () => ({ track }));

import { reportCrash } from '../crash-report';

beforeEach(() => track.mockReset().mockResolvedValue(true));

describe('reportCrash', () => {
  it('sends app.crash with the root, route, error class and version, and no profile id', () => {
    reportCrash(new TypeError("Cannot read properties of undefined (reading 'x')"), 'learner', 'Home');
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      name: 'app.crash',
      payload: { surface: 'learner', route: 'Home', errorName: 'TypeError', message: "Cannot read properties of undefined (reading 'x')", chunk: false, appVersion: APP_VERSION },
    });
  });

  it('never throws, whether track rejects or throws', async () => {
    track.mockRejectedValueOnce(new Error('offline'));
    expect(() => reportCrash(new Error('a'), 'browse', 'BrowseApp')).not.toThrow();
    track.mockImplementationOnce(() => {
      throw new Error('sync');
    });
    expect(() => reportCrash(new Error('b'), 'presenter', 'PresenterApp')).not.toThrow();
    await Promise.resolve();
  });
});
