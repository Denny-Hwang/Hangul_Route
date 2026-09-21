import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Share: { share: vi.fn(), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
}));

import { Share } from 'react-native';
import { shareText } from '../share-text';

describe('platform/share-text', () => {
  beforeEach(() => vi.clearAllMocks());

  it('true when shared, false when dismissed or unsupported', async () => {
    vi.mocked(Share.share).mockResolvedValueOnce({ action: 'sharedAction' } as never);
    expect(await shareText('TIGER-MOON-4821', 'Rescue code')).toBe(true);
    expect(Share.share).toHaveBeenCalledWith({ message: 'TIGER-MOON-4821', title: 'Rescue code' });
    vi.mocked(Share.share).mockResolvedValueOnce({ action: 'dismissedAction' } as never);
    expect(await shareText('x')).toBe(false);
    vi.mocked(Share.share).mockRejectedValueOnce(new Error('unsupported'));
    expect(await shareText('x')).toBe(false);
  });
});
