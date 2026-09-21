import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Text file in/out — F-SYNC-002 §3.4. Native: write to the cache directory
 * and hand it to the OS share sheet; pick through the document picker.
 * The web variant (`file.web.ts`) downloads / uses an <input type=file>.
 */
export type SaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'failed' };
export type PickResult = { ok: true; name: string; text: string } | { ok: false; reason: 'canceled' | 'failed' };

export async function saveTextFile(name: string, text: string, mimeType = 'application/json'): Promise<SaveResult> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir || !(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };
    const uri = `${dir}${name}`;
    await FileSystem.writeAsStringAsync(uri, text);
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Save your backup' });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function pickTextFile(): Promise<PickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return { ok: false, reason: 'canceled' };
    const asset = result.assets[0];
    const text = await FileSystem.readAsStringAsync(asset.uri);
    return { ok: true, name: asset.name, text };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
