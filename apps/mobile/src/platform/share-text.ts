import { Share } from 'react-native';

/**
 * Share a short text (the Rescue Code) — F-RESTORE-001 §3.3. Native and
 * react-native-web both implement `Share.share`; when the browser has no
 * Web Share API the caller falls back to the clipboard.
 */
export async function shareText(message: string, title?: string): Promise<boolean> {
  try {
    const result = await Share.share({ message, title });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
