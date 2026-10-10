// Build-time flags (F-I18N-001 §3.1, §3.11). Expo inlines `process.env.EXPO_PUBLIC_*`
// and Next inlines `process.env.NEXT_PUBLIC_*` when the literal expression is
// written out, so each flag is read with its full name. Where there is no
// `process` at all (some browsers/runtimes) the flag is simply off.
declare const process: { env: Record<string, string | undefined> };

export function showAllLocalesEnabled(): boolean {
  try {
    return (
      process.env.EXPO_PUBLIC_SHOW_ALL_LOCALES === '1' || process.env.NEXT_PUBLIC_SHOW_ALL_LOCALES === '1'
    );
  } catch {
    return false;
  }
}

export function pseudoLocaleEnabled(): boolean {
  try {
    return process.env.EXPO_PUBLIC_PSEUDO_LOCALE === '1' || process.env.NEXT_PUBLIC_PSEUDO_LOCALE === '1';
  } catch {
    return false;
  }
}
