import { getDocumentAsync } from 'expo-document-picker';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

/**
 * Text file in/out — F-SYNC-002 §3.4. Native: write to the cache directory
 * and hand it to the OS share sheet; pick through the document picker.
 * The web variant (`file.web.ts`) downloads / uses an <input type=file>.
 */
export type SaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'failed' };
export type PickResult = { ok: true; name: string; text: string } | { ok: false; reason: 'canceled' | 'failed' };

export async function saveTextFile(name: string, text: string, mimeType = 'application/json'): Promise<SaveResult> {
  try {
    const dir = cacheDirectory;
    if (!dir || !(await isAvailableAsync())) return { ok: false, reason: 'unavailable' };
    const uri = `${dir}${name}`;
    await writeAsStringAsync(uri, text);
    await shareAsync(uri, { mimeType, dialogTitle: 'Save your backup' });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function pickTextFile(): Promise<PickResult> {
  try {
    const result = await getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return { ok: false, reason: 'canceled' };
    const asset = result.assets[0];
    const text = await readAsStringAsync(asset.uri);
    return { ok: true, name: asset.name, text };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
