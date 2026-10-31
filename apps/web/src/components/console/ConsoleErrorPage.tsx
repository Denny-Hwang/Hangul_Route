'use client';

import { layout, spacing, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useRef } from 'react';
import { headRem } from '@/lib/console/rem';
import { LocaleProvider, useConsoleLocale, type LocaleProviderDeps } from '@/lib/i18n/locale-context';
import { Button, panelStyle } from './ui';

/**
 * The console's error page (AMENDMENTS-GROWNUP-UX GX-14, section 9 P5), drawn by `app/(console)/error.tsx` when a
 * grown-up page fails to draw, in place of the framework's white English "Application error". The boundary sits above
 * the pages' own `GrownUpLayout`, so the page brings its own `LocaleProvider`: the device's one display record decides
 * the language, as on every console page, and nothing paints until it is known (no English flash on a Korean or
 * Spanish device; the provider's wait is capped at `RECORD_WAIT_MS`). One heading that blames nobody, which takes
 * focus so a screen reader hears it, and the console's shipped **Try again**. No error text, no digest, no telemetry.
 */
export function ConsoleErrorPage({ retry, deps }: { retry: () => void; deps?: LocaleProviderDeps }): JSX.Element {
  return (
    <LocaleProvider deps={deps}>
      <ConsoleErrorBody retry={retry} />
    </LocaleProvider>
  );
}

/**
 * Try again on the error page: the page loads again. Every read starts over and every part of the page starts fresh (a
 * soft re-render can draw a part that failed against what it still holds, and fail again outside the boundary). The
 * grown-up unlock and the session are kept per tab, so the lock does not ask again.
 */
export function reloadPage(): void {
  window.location.reload();
}

function ConsoleErrorBody({ retry }: { retry: () => void }): JSX.Element {
  const { messages, ready } = useConsoleLocale();
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
      </div>
    </main>
  );
}
