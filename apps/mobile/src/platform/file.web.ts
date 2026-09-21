import type { PickResult, SaveResult } from './file';

export type { PickResult, SaveResult };

/** Web: trigger a download for the backup file. */
export async function saveTextFile(name: string, text: string, mimeType = 'application/json'): Promise<SaveResult> {
  const d = (globalThis as { document?: Document }).document;
  const U = (globalThis as { URL?: typeof URL }).URL;
  if (!d || !U?.createObjectURL) return { ok: false, reason: 'unavailable' };
  try {
    const url = U.createObjectURL(new Blob([text], { type: mimeType }));
    const a = d.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    d.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => U.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Web: open the browser's file chooser and read the chosen file as text. */
export function pickTextFile(): Promise<PickResult> {
  const d = (globalThis as { document?: Document }).document;
  if (!d) return Promise.resolve({ ok: false, reason: 'failed' });
  return new Promise((resolve) => {
    const input = d.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.setAttribute('data-testid', 'backup-file-input');
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve({ ok: false, reason: 'canceled' });
      try {
        resolve({ ok: true, name: file.name, text: await file.text() });
      } catch {
        resolve({ ok: false, reason: 'failed' });
      }
    };
    input.oncancel = () => {
      input.remove();
      resolve({ ok: false, reason: 'canceled' });
    };
    d.body.appendChild(input);
    input.click();
  });
}
