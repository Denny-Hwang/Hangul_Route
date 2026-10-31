'use client';

import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { memo, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AvatarChip } from '@/components/AvatarChip';
import { SourceConsent } from '@/components/console/ClassTransferParts';
import { inertOthers, tabTarget } from '@/components/console/ConfirmSheet';
import { DECIDED_HOLD_MS, IncomingCard, actionCardStyle, incomingKey, type IncomingApi } from '@/components/console/LearnerStatusParts';
import { MoveButton } from '@/components/console/TransferParts';
import type { ConsoleApi, TransferSourceView } from '@/lib/console/api';
import { minutesShown, type IncomingItem, type OutgoingItem } from '@/lib/console/learner-status';
import { relinkNoteText } from '@/lib/console/relink';
import { titleWithCount } from '@/lib/console/relink-popup';
import { rem } from '@/lib/console/rem';
import { announceRosterChange } from '@/lib/console/roster-broadcast';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

/**
 * The attention banner, the review sheet and the tab-title count of a class or family roster (AMENDMENTS-GROWNUP-UX GX-2,
 * sections 5.1, 5.2 and 5.4; wireframe `design/wireframes/console/approvals.md`, mocks `design/screens/approvals/mock/
 * class-*.html` and `sheet-*.html`; owner request 2026-10-31). Text always, colour second; amber (`feedback.nudge`) only
 * on what needs the grown-up's answer; never the danger colour. Nothing here closes or moves focus by itself.
 */

/** The address fragment that opens the review sheet on load (the teacher home's chip, GX-3). It carries no id. */
export const ATTENTION_HASH = '#attention';

/** Keys of the sheet's rows (opaque ids only): what the action chips open the sheet at. */
export const sheetKey = {
  device: (requestId: string): string => `device:${requestId}`,
  incoming: incomingKey,
  outgoing: (transferId: string): string => `outgoing:${transferId}`,
  family: (transferId: string): string => `family:${transferId}`,
};

// ---------------------------------------------------------------------------
// Banner (section 5.1)

export interface AttentionCounts {
  relinks: number;
  moves: number;
}

const bannerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing.md,
  margin: `0 0 ${spacing.lg}px`,
  padding: `${spacing.md}px ${spacing.lg}px`,
  borderRadius: radii.lg,
  backgroundColor: colors.feedback.nudgeLight,
  borderInlineStart: `${borderWidth.thick}px solid ${colors.feedback.nudge}`,
  color: colors.text.primary,
};

/** Whether two renders of the banner say the same thing: its text changes only when a count changes (section 5.1). */
export const sameCounts = (a: AttentionCounts, b: AttentionCounts): boolean => a.relinks === b.relinks && a.moves === b.moves;

function BannerView({ relinks, moves, onReview }: AttentionCounts & { onReview: () => void }): JSX.Element | null {
  const { messages } = useConsoleLocale();
  const t = messages.console.attention;
  const total = relinks + moves;
  if (total <= 0) return null;
  const parts = [relinks > 0 ? t.devices(relinks) : null, moves > 0 ? t.moves(moves) : null].filter((p): p is string => p !== null);
  return (
    <section style={bannerStyle} data-testid="attention-banner" aria-labelledby="attention-banner-title">
      <div role="status" aria-live="polite" style={{ minWidth: 0, flex: '1 1 14rem' }}>
        <p id="attention-banner-title" style={{ margin: 0, fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold, lineHeight: typography.leading.tight }}>
          {t.title(total)}
        </p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: rem(typography.size.bodySm), lineHeight: typography.leading.normal }} data-testid="attention-banner-parts">
          {parts.join(' · ')}
        </p>
      </div>
      <MoveButton primary onClick={onReview} testId="attention-review-now">
        {t.reviewNow.cta}
      </MoveButton>
    </section>
  );
}

/**
 * The banner under the class title while anything needs this space's answer: `role="status"`, never auto-dismissed, gone
 * at 0. It re-renders only when a count changes, so a 20 s read does not repeat the announcement; the page passes a
 * stable `onReview`. The locale is read through context, so a language change still redraws it.
 */
export const AttentionBanner = memo(BannerView, (a, b) => sameCounts(a, b) && a.onReview === b.onReview);

/** "(3) " in front of the tab title while the page's total is above 0 (section 5.4): a count only, never a name. */
export function useTitleCount(count: number, locale: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.title = titleWithCount(document.title, count);
    return () => {
      document.title = titleWithCount(document.title, 0);
    };
    // The locale: the frame sets the plain title again on a language change (it draws first), so the count goes back on.
  }, [count, locale]);
}

// ---------------------------------------------------------------------------
// Review sheet (section 5.2)

export interface SheetDevice {
  id: string;
  learnerId: string;
  name: string;
  avatar: string | null;
  expiresAt: string;
}

export interface SheetOutgoing {
  item: OutgoingItem;
  /** The shipped source view, for its consent card; null when it is not in the list any more. */
  view: TransferSourceView | null;
}

/** A family's move that waits for the family's OK: its consent sheet is on the family's moves page. */
export interface SheetFamilyMove {
  id: string;
  learnerId: string;
  name: string;
  avatar: string | null;
  to: string | null;
  href: string;
}

export type SheetApi = Pick<ConsoleApi, 'decideRelink'> & IncomingApi & Parameters<typeof SourceConsent>[0]['api'];

export interface ReviewSheetProps {
  spaceId: string;
  api: SheetApi;
  online: boolean;
  readOnly: boolean;
  devices: readonly SheetDevice[];
  incoming: readonly IncomingItem[];
  outgoing: readonly SheetOutgoing[];
  familyMoves: readonly SheetFamilyMove[];
  /** Classes this account owns or teaches itself (Agree for both classes, T11). */
  direct: ReadonlySet<string>;
  /** The row to open at (an action chip's tap); null: the sheet's title. */
  focusKey: string | null;
  now: Date;
  onClose: () => void;
  /** After an answer: the page notes the learner's card line (when the learner is on the roster) and reads again. */
  onDecided: (decided: { learnerId: string | null; text: string }) => void;
}

const alphaHex = Math.round(shadows.modal.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const MODAL_SHADOW = `0 ${shadows.modal.shadowOffset.height}px ${shadows.modal.shadowRadius}px ${shadows.modal.shadowColor}${alphaHex}`;

// A bottom sheet on a phone, a centred dialog of the reading width from 45em (the ConfirmSheet frame; `max-height: 90vh`
// keeps a strip of the page in view above it, a viewport share and not a size token).
const SHEET_CSS = `
.hr-attn-scrim{position:fixed;inset:0;z-index:${z.modal};background:${colors.surface.overlay}}
.hr-attn{position:fixed;left:0;right:0;bottom:0;z-index:${z.modal};max-height:90vh;overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:${rem(spacing.md)};background:${colors.surface.paper};color:${colors.text.primary};border-radius:${radii.xl}px ${radii.xl}px 0 0;padding:${rem(spacing.lg)} ${layout.gutter.compact}px ${rem(spacing.xl)};box-shadow:${MODAL_SHADOW};text-align:left}
.hr-attn h2{margin:0;font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere}
.hr-attn h3{margin:0 0 ${rem(spacing.sm)};font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold}}
.hr-attn section+section{border-top:${borderWidth.thin}px solid ${colors.border.subtle};padding-top:${rem(spacing.md)}}
.hr-attn :focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
@media (min-width:45em){.hr-attn{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:calc(100% - ${2 * layout.gutter.regular}px);max-width:${layout.maxWidth.reading}px;max-height:85vh;border-radius:${radii.xl}px;padding:${rem(spacing.xl)} ${rem(spacing.xxl)}}}`;

const TABBABLE = 'button:not([disabled]), a[href]';
const hidden: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xs,
  padding: spacing.md,
  borderRadius: radii.lg,
  backgroundColor: colors.surface.paper,
  ...actionCardStyle,
};
const rowHead: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm };
const lineStyle: CSSProperties = { margin: 0, color: colors.text.primary, fontSize: rem(typography.size.bodySm), fontWeight: typography.weight.semibold };
const actions: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs };

/** A row answered a moment ago: its words stay in place for `DECIDED_HOLD_MS`, then it leaves (section 5.2). */
interface Held {
  section: 'devices' | 'incoming' | 'outgoing' | 'family';
  name: string;
  avatar: string | null;
  text: string;
}

/**
 * The rows of one section: the current items in their order, and each held row (answered, not yet gone) back at the place
 * it had, so nothing jumps under the grown-up's thumb.
 */
export function withHeld<T>(current: readonly { key: string; item: T }[], held: ReadonlyArray<{ key: string }>, previous: readonly string[]): Array<{ key: string; item: T | null }> {
  const out: Array<{ key: string; item: T | null }> = current.map((c) => ({ key: c.key, item: c.item }));
  const present = new Set(out.map((r) => r.key));
  for (const h of held) {
    if (present.has(h.key)) continue;
    const at = previous.indexOf(h.key);
    out.splice(at < 0 ? out.length : Math.min(at, out.length), 0, { key: h.key, item: null });
    present.add(h.key);
  }
  return out;
}

export function ReviewSheet(props: ReviewSheetProps): JSX.Element {
  const { spaceId, api, online, readOnly, devices, incoming, outgoing, familyMoves, direct, focusKey, now, onClose, onDecided } = props;
  const { messages } = useConsoleLocale();
  const c = messages.console;
  const t = c.attention;
  const titleId = useId();
  const sheet = useRef<HTMLDivElement | null>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  const close = useRef<HTMLButtonElement | null>(null);
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const [held, setHeld] = useState<Record<string, Held>>({});
  const [said, setSaid] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const order = useRef<Record<Held['section'], string[]>>({ devices: [], incoming: [], outgoing: [], family: [] });

  // Focus: the row an action chip opened the sheet at, else the title; back to the opener when the sheet goes. The page
  // behind is inert meanwhile. Escape closes; Tab stays inside.
  useEffect(() => {
    const doc = typeof document === 'undefined' ? null : document;
    const opener = doc ? (doc.activeElement as HTMLElement | null) : null;
    const target = focusKey ? sheet.current?.querySelector?.<HTMLElement>(`[data-sheet-key="${focusKey}"]`) : null;
    if (target) {
      target.scrollIntoView?.({ block: 'center' });
      target.focus?.();
    } else title.current?.focus?.();
    const undoInert = inertOthers(sheet.current as Parameters<typeof inertOthers>[0], (doc?.body as Parameters<typeof inertOthers>[1] | undefined) ?? null);
    const all = timers.current;
    return () => {
      undoInert();
      for (const timer of all.values()) clearTimeout(timer);
      all.clear();
      opener?.focus?.();
    };
    // Once per opening: a chip opens a new sheet.
  }, []);

  const keyAction = useCallback((event: { key: string; shiftKey: boolean; defaultPrevented?: boolean; preventDefault: () => void }): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      latestClose.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(sheet.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? []);
    const active = typeof document === 'undefined' ? null : document.activeElement;
    const inside = active !== null && !!sheet.current?.contains?.(active);
    const next = inside ? tabTarget(items, active, event.shiftKey) : event.shiftKey ? (items[items.length - 1] ?? null) : (items[0] ?? null);
    if (next === null) return;
    event.preventDefault();
    next.focus();
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    const onDocumentKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      keyAction(event);
    };
    document.addEventListener('keydown', onDocumentKey);
    return () => document.removeEventListener('keydown', onDocumentKey);
  }, [keyAction]);

  /** A row answered: its line stays for 5 s, the sheet's polite region says it, the page reads again. */
  const answered = (key: string, row: Omit<Held, 'text'>, text: string, learnerId: string | null): void => {
    setHeld((prev) => ({ ...prev, [key]: { ...row, text } }));
    setSaid(text);
    if (reviewing === key) setReviewing(null);
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        setHeld((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, DECIDED_HOLD_MS),
    );
    onDecided({ learnerId, text });
  };

  const heldIn = (section: Held['section']): Array<{ key: string }> => Object.entries(held).filter(([, h]) => h.section === section).map(([key]) => ({ key }));
  const deviceRows = withHeld(devices.map((d) => ({ key: sheetKey.device(d.id), item: d })), heldIn('devices'), order.current.devices);
  const incomingRows = withHeld(incoming.map((i) => ({ key: sheetKey.incoming(i), item: i })), heldIn('incoming'), order.current.incoming);
  const outgoingRows = withHeld(outgoing.map((o) => ({ key: sheetKey.outgoing(o.item.id), item: o })), heldIn('outgoing'), order.current.outgoing);
  const familyRows = withHeld(familyMoves.map((f) => ({ key: sheetKey.family(f.id), item: f })), heldIn('family'), order.current.family);
  order.current = { devices: deviceRows.map((r) => r.key), incoming: incomingRows.map((r) => r.key), outgoing: outgoingRows.map((r) => r.key), family: familyRows.map((r) => r.key) };
  const empty = deviceRows.length + incomingRows.length + outgoingRows.length + familyRows.length === 0;

  // The last item cleared: the sheet stays open on its empty state, focus on Close (it never closes itself).
  const wasEmpty = useRef(empty);
  useEffect(() => {
    if (empty && !wasEmpty.current) close.current?.focus?.();
    wasEmpty.current = empty;
  }, [empty]);

  const heldRow = (key: string): JSX.Element | null => {
    const h = held[key];
    if (!h) return null;
    return (
      <article key={key} style={rowStyle} data-sheet-key={key} data-testid="sheet-row-decided" tabIndex={-1}>
        <span style={rowHead}>
          {h.avatar ? <AvatarChip avatar={h.avatar} /> : null}
          <strong>{h.name}</strong>
        </span>
        <p style={lineStyle}>{h.text}</p>
      </article>
    );
  };

  const section = (testId: string, heading: string, rows: ReactNode[]): JSX.Element | null =>
    rows.length === 0 ? null : (
      <section data-testid={testId} aria-label={heading}>
        <h3>{heading}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>{rows}</div>
      </section>
    );

  return (
    <>
      <style>{SHEET_CSS}</style>
      <div className="hr-attn-scrim" onClick={onClose} data-testid="attention-sheet-backdrop" aria-hidden="true" />
      <div ref={sheet} className="hr-attn" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyAction} data-testid="attention-sheet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <h2 id={titleId} ref={title} tabIndex={-1}>
            {t.sheetTitle}
          </h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            data-testid="attention-sheet-close"
            style={{
              minHeight: touchTarget.min,
              minWidth: touchTarget.min,
              padding: `${spacing.xs}px ${spacing.lg}px`,
              borderRadius: radii.pill,
              border: `${borderWidth.base}px solid ${colors.border.strong}`,
              backgroundColor: colors.surface.paper,
              color: colors.text.primary,
              fontSize: rem(typography.size.body),
              fontWeight: typography.weight.bold,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {messages.common.buttons.close}
          </button>
        </div>
        <p role="status" aria-live="polite" style={hidden} data-testid="attention-sheet-said">
          {said}
        </p>
        {empty ? (
          <p style={{ margin: 0, color: colors.text.secondary, fontSize: rem(typography.size.body) }} data-testid="attention-sheet-empty">
            {t.empty}
          </p>
        ) : null}
        {section(
          'sheet-devices',
          t.devicesHeading,
          deviceRows.map(({ key, item }) =>
            item === null ? heldRow(key) : (
              <DeviceRow
                key={key}
                rowKey={key}
                device={item}
                now={now}
                api={api}
                spaceId={spaceId}
                online={online && !readOnly}
                onAnswered={(text) => answered(key, { section: 'devices', name: item.name, avatar: item.avatar }, text, item.learnerId)}
              />
            ),
          ),
        )}
        {section(
          'sheet-incoming',
          t.incomingHeading,
          incomingRows.map(({ key, item }) =>
            item === null ? (
              heldRow(key)
            ) : (
              <IncomingCard
                key={key}
                item={item}
                api={api}
                spaceId={spaceId}
                online={online}
                readOnly={readOnly}
                chip={false}
                onDecided={(text) => answered(key, { section: 'incoming', name: item.alias, avatar: item.avatar }, text ?? c.transfer.a11y.updated, null)}
              />
            ),
          ),
        )}
        {section(
          'sheet-outgoing',
          t.outgoingHeading,
          outgoingRows.map(({ key, item }) =>
            item === null ? (
              heldRow(key)
            ) : (
              <article key={key} style={rowStyle} data-sheet-key={key} data-testid="sheet-outgoing-row" tabIndex={-1} aria-labelledby={`${key}-name`}>
                <span style={rowHead}>
                  {item.item.avatar ? <AvatarChip avatar={item.item.avatar} /> : null}
                  <strong id={`${key}-name`}>{item.item.name ?? ''}</strong>
                </span>
                {item.item.to ? <p style={lineStyle}>{c.status.moveTo(item.item.to)}</p> : null}
                {reviewing === key && item.view ? (
                  <SourceConsent
                    view={item.view}
                    spaceId={spaceId}
                    api={api}
                    online={online}
                    direct={direct}
                    onAnswered={(text) => answered(key, { section: 'outgoing', name: item.item.name ?? '', avatar: item.item.avatar }, text, item.item.learnerId)}
                  />
                ) : readOnly || !item.view ? null : (
                  <div style={actions}>
                    <MoveButton primary disabled={!online} describedBy={`${key}-name`} onClick={() => setReviewing(key)} testId="sheet-outgoing-review">
                      {c.status.review.cta}
                    </MoveButton>
                  </div>
                )}
              </article>
            ),
          ),
        )}
        {section(
          'sheet-family',
          c.transfer.groups.asked,
          familyRows.map(({ key, item }) =>
            item === null ? (
              heldRow(key)
            ) : (
              <article key={key} style={rowStyle} data-sheet-key={key} data-testid="sheet-family-row" tabIndex={-1}>
                <span style={rowHead}>
                  {item.avatar ? <AvatarChip avatar={item.avatar} /> : null}
                  <strong id={`${key}-name`}>{item.name}</strong>
                </span>
                {item.to ? <p style={lineStyle}>{c.status.moveTo(item.to)}</p> : null}
                <div style={actions}>
                  <Link href={item.href} aria-describedby={`${key}-name`} data-testid="sheet-family-review" style={linkButton}>
                    {c.status.review.cta}
                  </Link>
                </div>
              </article>
            ),
          ),
        )}
      </div>
    </>
  );
}

const linkButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  boxSizing: 'border-box',
  padding: `${spacing.sm}px ${spacing.xl}px`,
  borderRadius: radii.pill,
  border: `${borderWidth.base}px solid ${colors.brand.primary}`,
  backgroundColor: colors.brand.primary,
  color: colors.text.onPrimary,
  fontSize: rem(typography.size.body),
  fontWeight: typography.weight.bold,
  textDecoration: 'none',
};

/** One new device in the sheet: the name, "New device · {m} min left", **Approve** (primary) and **Deny**. */
function DeviceRow({
  rowKey,
  device,
  now,
  api,
  spaceId,
  online,
  onAnswered,
}: {
  rowKey: string;
  device: SheetDevice;
  now: Date;
  api: Pick<ConsoleApi, 'decideRelink'>;
  spaceId: string;
  online: boolean;
  onAnswered: (text: string) => void;
}): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const c = messages.console;
  const [busy, setBusy] = useState(false);
  const nameId = `${rowKey}-name`;
  const reasonId = `${rowKey}-reason`;
  const decide = async (approve: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const result = await api.decideRelink(spaceId, device.id, approve);
    setBusy(false);
    if (result.ok) {
      announceRosterChange();
      onAnswered(relinkNoteText({ kind: approve ? 'approved' : 'denied', name: device.name }, locale));
    } else onAnswered(relinkNoteText({ kind: 'decideFailed', result }, locale));
  };
  return (
    <article style={rowStyle} data-sheet-key={rowKey} data-testid="sheet-device-row" tabIndex={-1} aria-labelledby={nameId}>
      <span style={rowHead}>
        {device.avatar ? <AvatarChip avatar={device.avatar} /> : null}
        <strong id={nameId}>{device.name}</strong>
      </span>
      <p id={reasonId} style={lineStyle}>
        {c.status.newDevice(minutesShown(device.expiresAt, now))}
      </p>
      <div style={actions}>
        <MoveButton primary waiting={busy} disabled={!online} describedBy={`${nameId} ${reasonId}`} onClick={() => void decide(true)} testId="sheet-device-approve">
          {c.relink.approve.cta}
        </MoveButton>
        <MoveButton waiting={busy} disabled={!online} describedBy={`${nameId} ${reasonId}`} onClick={() => void decide(false)} testId="sheet-device-deny">
          {c.relink.deny.cta}
        </MoveButton>
      </div>
    </article>
  );
}
