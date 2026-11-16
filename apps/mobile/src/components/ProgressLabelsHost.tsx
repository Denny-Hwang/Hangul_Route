import { ProgressLabelsContext } from '@hangul-route/design-system';
import type { ReactElement, ReactNode } from 'react';
import { useMessages } from '../i18n/use-messages';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17d (audit A11Y-3): `App` and `BrowseApp` mount one host, and every design-system
 * `Progress` under it (a lesson's step dots, a game's round bar, a collection meter) is named and read in the UI
 * language: "Progress", "2 of 6". The numbers are the ones the meter draws.
 */
export function ProgressLabelsHost({ children }: { children: ReactNode }): ReactElement {
  const messages = useMessages();
  return <ProgressLabelsContext.Provider value={messages.a11y.progress}>{children}</ProgressLabelsContext.Provider>;
}
