import { Alert } from 'react-native';

/**
 * Confirm dialog wrapper — the only sanctioned entry to RN `Alert`, so the
 * web build can swap in a `dialog.web.ts` (roadmap web-pwa-offline §2)
 * without touching screens.
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Marks the confirm action as destructive on platforms that style it. */
  destructive?: boolean;
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: opts.confirmLabel,
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
