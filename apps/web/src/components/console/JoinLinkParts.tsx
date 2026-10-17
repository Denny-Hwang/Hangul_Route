'use client';

import { colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { Messages } from '@hangul-route/i18n';
import { useId, useMemo, useState } from 'react';
import { buttonBase } from '@/components/console/ui';
import { joinLinkText, qrModules, qrPath, qrViewSize } from '@/lib/console/join-link';
import { rem } from '@/lib/console/rem';

type JoinLinkCopy = Messages['console']['space']['joinLink'];

/** The QR code's drawn side: large enough to scan from a few desks away on a projected roster, never wider than the panel. */
const QR_SIDE = touchTarget.min * 4;

/**
 * The class join link and its QR code under the class code (owner decision 2026-10-17; wireframe
 * `design/wireframes/console/roster.md` Panel J, screen spec `design/screens/app-shell/join-link.md`): the link as
 * text, Copy link, and Show QR code, which draws the link as a QR image in place. The link holds the code alone, in
 * the address fragment, never a learner's name. Dark modules in `text.primary` on `surface.paper` with the quiet zone
 * the QR specification asks for, so a phone camera reads it on a screen, a projector or a printout.
 */
export function JoinLinkPanel({ url, copy, centered = false }: { url: string; copy: JoinLinkCopy; centered?: boolean }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const qrId = useId();
  const doCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div data-testid="join-link" style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.border.subtle}` }}>
      <div style={{ fontSize: rem(typography.size.caption), color: colors.text.muted, textTransform: 'uppercase' }}>{copy.title}</div>
      <p data-testid="join-link-url" style={{ margin: `${spacing.xs}px 0`, fontFamily: typography.family.mono, fontSize: rem(typography.size.body), overflowWrap: 'anywhere', color: colors.text.primary }}>
        {joinLinkText(url)}
      </p>
      <p style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm), margin: `0 0 ${spacing.sm}px` }}>{copy.note}</p>
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', justifyContent: centered ? 'center' : 'flex-start' }}>
        <button type="button" data-testid="join-link-copy" onClick={() => void doCopy()} style={{ ...buttonBase, minHeight: touchTarget.min }}>
          {copied ? copy.copied.cta : copy.copy.cta}
        </button>
        <button
          type="button"
          data-testid="join-link-qr-toggle"
          aria-expanded={qrOpen}
          aria-controls={qrId}
          onClick={() => setQrOpen((open) => !open)}
          style={{ ...buttonBase, minHeight: touchTarget.min }}
        >
          {qrOpen ? copy.qr.hide.cta : copy.qr.show.cta}
        </button>
      </div>
      <div id={qrId} hidden={!qrOpen}>
        {qrOpen ? <JoinLinkQr url={url} label={copy.qr.label} caption={copy.qr.caption} centered={centered} /> : null}
      </div>
    </div>
  );
}

/** The QR image of the join link: one SVG path of the dark modules, named for screen readers. */
export function JoinLinkQr({ url, label, caption, centered = false }: { url: string; label: string; caption: string; centered?: boolean }): JSX.Element {
  const modules = useMemo(() => qrModules(url), [url]);
  const view = qrViewSize(modules.length);
  return (
    <figure style={{ margin: `${spacing.md}px 0 0`, display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'flex-start', gap: spacing.xs }}>
      <svg
        data-testid="join-link-qr"
        role="img"
        aria-label={label}
        viewBox={`0 0 ${view} ${view}`}
        width={QR_SIDE}
        height={QR_SIDE}
        shapeRendering="crispEdges"
        style={{ maxWidth: '100%', height: 'auto', borderRadius: radii.md, border: `1px solid ${colors.border.subtle}` }}
      >
        <rect width={view} height={view} fill={colors.surface.paper} />
        <path d={qrPath(modules)} fill={colors.text.primary} />
      </svg>
      <figcaption style={{ color: colors.text.muted, fontSize: rem(typography.size.bodySm) }}>{caption}</figcaption>
    </figure>
  );
}
