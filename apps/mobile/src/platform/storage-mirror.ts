/**
 * Native variant of `storage-mirror.web.ts`: the web keeps a synchronous copy for the HTML shell's static splash
 * (AMENDMENTS-FINISH-2026-11 FN-2); a native app has no HTML shell, so there is nothing to keep.
 */
export function writeMirror(_key: string, _value: string): void {}
