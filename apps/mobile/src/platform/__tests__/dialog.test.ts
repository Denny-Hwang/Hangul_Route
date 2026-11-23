import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

import { Alert } from 'react-native';
import { confirm, setConfirmPresenter } from '../dialog';

type Buttons = Array<{ text: string; style?: string; onPress?: () => void }>;
type Options = { cancelable?: boolean; onDismiss?: () => void };

function lastCall(): { title: string; message?: string; buttons: Buttons; options: Options } {
  const call = vi.mocked(Alert.alert).mock.calls.at(-1) as unknown as [string, string?, Buttons?, Options?];
  return { title: call[0], message: call[1], buttons: call[2] ?? [], options: call[3] ?? {} };
}

describe('platform/dialog confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves true when the confirm button is pressed', async () => {
    const p = confirm({ title: 'Leave?', message: 'Sure?', confirmLabel: 'Leave', cancelLabel: 'Stay', destructive: true });
    const { title, message, buttons } = lastCall();
    expect(title).toBe('Leave?');
    expect(message).toBe('Sure?');
    expect(buttons.map((b) => b.text)).toEqual(['Stay', 'Leave']);
    expect(buttons[1]?.style).toBe('destructive');
    buttons[1]?.onPress?.();
    await expect(p).resolves.toBe(true);
  });

  it('resolves false on cancel and on dismiss', async () => {
    const a = confirm({ title: 'A', confirmLabel: 'Ok', cancelLabel: 'No' });
    lastCall().buttons[0]?.onPress?.();
    await expect(a).resolves.toBe(false);

    const b = confirm({ title: 'B', confirmLabel: 'Ok', cancelLabel: 'No' });
    expect(lastCall().buttons[1]?.style).toBe('default');
    lastCall().options.onDismiss?.();
    await expect(b).resolves.toBe(false);
  });

  it('[DP] a second line (`detail`) follows the message in the Alert, after a blank line', async () => {
    const p = confirm({ title: 'Damaged', message: 'Kept a copy.', detail: 'Learners come back with a code.', confirmLabel: 'Start', cancelLabel: 'Not now' });
    expect(lastCall().message).toBe('Kept a copy.\n\nLearners come back with a code.');
    lastCall().buttons[0]?.onPress?.();
    await expect(p).resolves.toBe(false);
    const q = confirm({ title: 'Only a detail', detail: 'One line.', confirmLabel: 'Ok', cancelLabel: 'No' });
    expect(lastCall().message).toBe('One line.');
    lastCall().buttons[0]?.onPress?.();
    await expect(q).resolves.toBe(false);
  });

  it('native keeps the platform Alert: there is no sheet host to register', () => {
    expect(setConfirmPresenter(async () => true)()).toBeUndefined();
  });
});
