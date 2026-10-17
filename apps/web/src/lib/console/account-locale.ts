import { AccountLocaleSchema, mergeAccountLocale, type DeviceSettings, type LocaleMergeResult } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';

/**
 * A signed-in grown-up's language on the account (owner items 6 and 7): Clerk `unsafeMetadata`
 * `{ uiLocale, uiLocaleAt }`. Clerk's `user.update({ unsafeMetadata })` replaces the whole object,
 * so every write here merges into what the account already holds (the sign-up's
 * `adultAffirmedAt`, F-APP-001 OD-13, and anything else). Pure; `auth-context.tsx` calls Clerk.
 */
export type UnsafeMetadata = Readonly<Record<string, unknown>>;

/** The account's language as stored, or null when it holds none (or a damaged one). */
export function accountLocaleOf(metadata: UnsafeMetadata | null | undefined): { uiLocale?: UiLocale; uiLocaleAt?: string } | null {
  const parsed = AccountLocaleSchema.safeParse(metadata ?? {});
  if (!parsed.success || parsed.data.uiLocale === undefined) return null;
  return parsed.data;
}

/** The whole metadata object to send: the existing keys kept, the language and its time replaced. */
export function withAccountLocale(metadata: UnsafeMetadata | null | undefined, choice: { uiLocale: UiLocale; uiLocaleAt: string }): Record<string, unknown> {
  return { ...(metadata ?? {}), uiLocale: choice.uiLocale, uiLocaleAt: choice.uiLocaleAt };
}

/** The newer-wins merge of the device record and the account right after a sign-in. */
export function signInMerge(device: DeviceSettings | null, metadata: UnsafeMetadata | null | undefined, now: string): LocaleMergeResult {
  return mergeAccountLocale(device ?? {}, accountLocaleOf(metadata), now);
}
