'use client';

import type { UiLocale } from '@hangul-route/content-schema';
import { layout, spacing, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef } from 'react';
import { learnerHome } from '@/lib/console/grown-up-lock';
import { headRem } from '@/lib/console/rem';
import { clearGrownUpTab } from '@/lib/console/unlock';
import { LocaleProvider, useConsoleLocale, type LocaleProviderDeps } from '@/lib/i18n/locale-context';
import { Button, panelStyle } from './ui';

/**
 * The console's error page (AMENDMENTS-GROWNUP-UX GX-14, section 9 P5), drawn by `app/(console)/error.tsx` when a
 * grown-up page fails to draw, in place of the framework's white English "Application error". The boundary sits above
 * the pages' own `GrownUpLayout`, so the page brings its own `LocaleProvider`: the device's one display record decides
 * the language, as on every console page, and nothing paints until it is known (no English flash on a Korean or
 * Spanish device; the provider's wait is capped at `RECORD_WAIT_MS`). One heading that blames nobody, which takes
 * focus so a screen reader hears it, and the console's shipped **Try again**. No error text, no digest, no telemetry.
 * Below it, the frame's shipped **Learner app** way out (GX-14 review): a page that fails every time is never a dead
 * end, and on a shared device the grown-up can close the grown-up pages and hand it back.
 */
export function ConsoleErrorPage({ retry, leave = leaveToLearnerApp, deps }: { retry: () => void; leave?: (locale: UiLocale) => void; deps?: LocaleProviderDeps }): JSX.Element {
  return (
    <LocaleProvider deps={deps}>
      <ConsoleErrorBody retry={retry} leave={leave} />
    </LocaleProvider>
  );
}

/**
 * Learner app on the error page, as the frame's own exit does it: the grown-up unlock of this tab ends, then the
 * learner app opens in the page's language ("Who is using this?" when it is on). No id, name or error in the address.
 */
export function leaveToLearnerApp(locale: UiLocale): void {
  clearGrownUpTab();
  window.location.assign(learnerHome(window.location.origin, locale, { who: true }));
}

/**
 * Try again on the error page: the page loads again. Every read starts over and every part of the page starts fresh (a
 * soft re-render can draw a part that failed against what it still holds, and fail again outside the boundary). The
 * grown-up unlock and the session are kept per tab, so the lock does not ask again.
 */
export function reloadPage(): void {
  window.location.reload();
}

function ConsoleErrorBody({ retry, leave }: { retry: () => void; leave: (locale: UiLocale) => void }): JSX.Element {
  const { messages, locale, ready } = useConsoleLocale();
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (ready) heading.current?.focus();
  }, [ready]);
  if (!ready) return <div aria-busy="true" data-testid="console-error-pending" />;
  const c = messages.console;
  return (
    <main
      data-testid="console-error"
      style={{ boxSizing: 'border-box', maxWidth: layout.maxWidth.reading, margin: '0 auto', padding: `${spacing.xxl}px ${layout.gutter.compact}px` }}
    >
      <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.lg }}>
        <h1 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: headRem(typography.size.title), fontWeight: typography.weight.bold, lineHeight: typography.leading.tight, overflowWrap: 'anywhere', outline: 'none' }}>
          {c.errorPage.title}
        </h1>
        <Button tone="primary" onClick={retry} testId="console-error-retry">
          {c.tryAgain}
        </Button>
        <Button onClick={() => leave(locale)} testId="console-error-learner-app">
          {c.shell.backToLearning}
        </Button>
      </div>
    </main>
  );
}
