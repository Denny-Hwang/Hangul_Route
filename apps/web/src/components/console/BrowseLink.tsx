'use client';

import type { BrowseSource, BrowseTarget } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  browseLinksShown,
  browseUrl,
  isPlainClick,
  openBrowse,
  openFreeLessons,
  scopeReader,
  type BrowseLinkDeps,
  type ClickLike,
  type OpenBrowseResult,
} from '@/lib/console/browse-link';
import { browserStorage, type KeyValueStorage } from '@/lib/i18n/safe-storage';
import { letterLabel } from '@/lib/console/report-view';
import { useConsole } from './use-console';

/**
 * Console entries to All lessons (F-BROWSE-001 sections 4.3 and 4.11; wireframe
 * design/wireframes/browse/entry-points.md, panels 1-5). Each entry is a real link to `/browse…` in the same tab:
 * a plain click checks the account's plan, writes the tab's pass and goes; a modifier click, a middle click or a
 * long-press is left to the browser, so that tab opens with no pass and All lessons shows its Access screen.
 * When the check fails or the browser blocks this page's storage, the line sits beside the control (a status
 * region, present from the first render so a screen reader announces the line when it appears) and nothing navigates. Callers render an entry only while `browseLinksShown()` is true.
 */

/** Everything an entry touches in the browser, injectable for tests. */
export interface BrowseOpenerEnv {
  origin: () => string;
  now: () => number;
  storage: () => KeyValueStorage | null;
  assign: (url: string) => void;
}

export function browserOpenerEnv(): BrowseOpenerEnv {
  const win = typeof window === 'undefined' ? null : window;
  return {
    origin: () => win?.location.origin ?? '',
    now: () => Date.now(),
    storage: () => browserStorage('session'),
    assign: (url) => win?.location.assign(url),
  };
}

export type BrowseNotice = 'check_failed' | 'storage_blocked' | null;

export interface BrowseOpener {
  notice: BrowseNotice;
  /** True while the plan check is in flight (the entry is `aria-busy`; further clicks wait for it). */
  checking: boolean;
  /** A plain click opens through `openBrowse`; any other click is the browser's. */
  onClick: (event: MouseEvent<HTMLAnchorElement> | ClickLike & { preventDefault: () => void }) => void;
  retry: () => void;
  openFree: () => void;
}

/** One entry's hand-off: its target and source, and the line it shows when it cannot open. */
export function useBrowseOpener(target: BrowseTarget | undefined, source: BrowseSource, env?: BrowseOpenerEnv): BrowseOpener {
  const { api, locale, session } = useConsole();
  const [browser] = useState<BrowseOpenerEnv>(() => env ?? browserOpenerEnv());
  const [notice, setNotice] = useState<BrowseNotice>(null);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);

  const deps = (): BrowseLinkDeps => ({
    origin: browser.origin(),
    now: browser.now,
    storage: browser.storage(),
    locale,
    assign: browser.assign,
    readScope: scopeReader(api, session?.accountId ?? null),
  });
  const settle = (result: OpenBrowseResult): void => {
    setNotice(result === 'opened' ? null : result);
  };
  const open = (): void => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    void openBrowse(target, source, deps())
      .then(settle)
      .finally(() => {
        busy.current = false;
        setChecking(false);
      });
  };

  return {
    notice,
    checking,
    onClick: (event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      open();
    },
    retry: open,
    openFree: () => settle(openFreeLessons(target, source, deps())),
  };
}

const actionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  padding: `${spacing.xs}px ${spacing.lg}px`,
  borderRadius: radii.pill,
  border: `${borderWidth.thin}px solid ${colors.border.strong}`,
  backgroundColor: colors.surface.paper,
  color: colors.text.primary,
  fontSize: typography.size.bodySm,
  fontWeight: typography.weight.bold,
  cursor: 'pointer',
};

/** The line beside an entry (section 4.3 steps 3 and 4); an empty status region until it has something to say. */
export function BrowseNoticeLine({
  opener,
  testId,
  inline = false,
}: {
  opener: BrowseOpener;
  testId: string;
  /** A link inside a sentence (the report's letters and quest title): the empty region does not break the line. */
  inline?: boolean;
}): JSX.Element {
  const t = useConsole().m.console.browse;
  return (
    <span role="status" aria-live="polite" data-testid={`${testId}-notice`} style={inline && opener.notice === null ? { display: 'inline' } : { display: 'block', flexBasis: '100%' }}>
      {opener.notice === 'storage_blocked' ? (
        <span style={{ display: 'block', margin: `${spacing.xs}px 0`, color: colors.text.primary, fontSize: typography.size.bodySm }}>{t.storageBlocked}</span>
      ) : opener.notice === 'check_failed' ? (
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, margin: `${spacing.xs}px 0` }}>
          <span style={{ display: 'block', margin: 0, flexBasis: '100%', color: colors.text.primary, fontSize: typography.size.bodySm }}>{t.checkFailed}</span>
          <button type="button" style={actionStyle} onClick={opener.retry} data-testid={`${testId}-retry`}>
            {t.tryAgain.cta}
          </button>
          <button type="button" style={actionStyle} onClick={opener.openFree} data-testid={`${testId}-free`}>
            {t.openFree.cta}
          </button>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Whether this page draws its All lessons deep links (BR-11): `browseLinksShown()` for the page's origin, read after
 * mount so the static export and the first client render agree (both draw none).
 */
export function useBrowseLinksShown(origin: () => string = () => (typeof window === 'undefined' ? '' : window.location.origin)): boolean {
  const [shown, setShown] = useState(false);
  const [read] = useState(() => origin);
  useEffect(() => {
    setShown(browseLinksShown(read()));
  }, [read]);
  return shown;
}

/** The look of a deep-link entry: a small secondary button (plan rows, report slot, route rows) or a letter chip. */
const linkStyle: CSSProperties = { ...actionStyle, textDecoration: 'none' };

/**
 * A deep link into All lessons (BR-11 rows): the link and, under it, its line. `children` replaces the label for a
 * richer face (a letter chip); `ariaLabel` names what it opens when the label alone is ambiguous.
 */
export function BrowseLink({
  target,
  source,
  label,
  ariaLabel,
  describedBy,
  testId,
  env,
  className,
  style,
  children,
}: {
  target: BrowseTarget;
  source: BrowseSource;
  label?: string;
  ariaLabel?: string;
  /** The id of the text that says what this link opens (a row title, a report line). */
  describedBy?: string;
  testId: string;
  env?: BrowseOpenerEnv;
  /** A host's own link class (the report's ghost button); the default look is then left out. */
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}): JSX.Element {
  const opener = useBrowseOpener(target, source, env);
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center' }}>
      <a
        href={browseUrl('', target, source)}
        onClick={opener.onClick}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-busy={opener.checking || undefined}
        className={className}
        data-testid={testId}
        style={className ? style : { ...linkStyle, ...style }}
      >
        {children ?? label}
      </a>
      <BrowseNoticeLine opener={opener} testId={testId} />
    </span>
  );
}

/**
 * The roster's "Revisit together" letters (`classRollup().revisit`, up to three; F-BROWSE-001 section 4.11 item 5):
 * with All lessons on, each letter is a chip that opens the lesson teaching it (`{ kind: 'char' }`, source `roster`;
 * no learner name in the link); otherwise the letters as text. The letters are marked Korean either way.
 */
export function RevisitLetterLinks({ chars, shown }: { chars: readonly string[]; /** Omitted, `browseLinksShown()` decides. */ shown?: boolean }): JSX.Element {
  const linksShown = useBrowseLinksShown();
  const t = useConsole().m.console.browse;
  const describedId = useId();
  if (!(shown ?? linksShown)) return <span lang="ko">{chars.join(' · ')}</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, verticalAlign: 'middle' }}>
      <span id={describedId} hidden>
        {t.preview.cta}
      </span>
      {chars.map((char, index) => {
        const { romanization } = letterLabel(char);
        return (
          <BrowseLink key={char} target={{ kind: 'char', char }} source="roster" describedBy={describedId} testId={`roster-revisit-${index}`} style={{ gap: spacing.xs }}>
            <span lang="ko" style={{ fontSize: typography.size.bodyLg }}>{char}</span>
            {romanization ? <span style={{ color: colors.text.secondary, fontWeight: typography.weight.regular }}>{romanization}</span> : null}
          </BrowseLink>
        );
      })}
    </span>
  );
}
