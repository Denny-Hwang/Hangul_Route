'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, radii, shadows, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AdminRow, AdminsView, ConsoleApi, SpaceView } from '@/lib/console/api';
import { actionOutcome, adminDate, afterLeaving, adminDay, adminName, fullShown, historyLines, inviteShown, newAdminNotices, noticeId, panelViewer, readSeenNotices, rememberNotice, type PanelViewer } from '@/lib/console/admins-panel';
import { writeConsoleFlash } from '@/lib/console/console-flash';
import { rem } from '@/lib/console/rem';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { BillingStyles } from './BillingHomeParts';
import type { ConfirmAsk } from './ConfirmSheet';
import { StepUpDialog, useStepUp } from './StepUpDialog';
import { buttonBase } from './ui';

/**
 * [SA] The Administrators panel of the school page (AMENDMENTS-SEATS-ADMINS section 6.6; wireframe
 * design/wireframes/console/admins-panel.md, mock design/screens/console/admins-panel.md, decisions D9 to D17 of
 * design/screens/console/README.md). Under Invite a teacher, for the school's owner and its administrators.
 *
 * - Everyone: the owner row, one row per administrator ("joined {day}"), the count and `about`.
 * - The owner: each administrator's verified sign-in email, the new-admin notice for 7 days (Remove, Got it), Invite an
 *   administrator while places are free (step-up first, then the one-time link box), open invites with Revoke, Remove on
 *   each administrator, and the history. On an archived school only Invite is hidden.
 * - An administrator: Stop being an administrator, then the next home with `admins.left(school)` (one-shot flash).
 * - A Revoke, Remove or Stop answered `404`, `403` or `409` reloads the panel (focus on its heading); only a network
 *   failure or a `5xx` says `actionFailed`. The invite link lives in this component's state only: never in storage, a
 *   URL, a title or telemetry.
 */

const alphaHex = Math.round(shadows.card.shadowOpacity * 255)
  .toString(16)
  .padStart(2, '0');
const CARD_SHADOW = `0 ${shadows.card.shadowOffset.height}px ${shadows.card.shadowRadius}px ${shadows.card.shadowColor}${alphaHex}`;

/** Layout and focus rules; every value is a token. */
const ADMINS_CSS = `
.hr-adm{display:flex;flex-direction:column;gap:${spacing.sm}px;padding:${spacing.lg}px;margin-bottom:${spacing.lg}px;background:${colors.surface.paper};border:${borderWidth.thin}px solid ${colors.border.subtle};border-radius:${radii.lg}px;overflow-wrap:anywhere}
.hr-adm-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;column-gap:${spacing.md}px;row-gap:${spacing.xxs}px}
.hr-adm-head h2{margin:0;font-size:${rem(typography.size.bodyLg)}}
.hr-adm-head h2:focus{outline:none}
.hr-adm-head h2:focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
.hr-adm-muted{margin:0;color:${colors.text.muted};font-size:${rem(typography.size.bodySm)}}
.hr-adm-people{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:${borderWidth.thin}px solid ${colors.border.subtle};border-radius:${radii.md}px}
.hr-adm-person{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:${spacing.md}px;row-gap:${spacing.xs}px;min-height:${touchTarget.min}px;box-sizing:border-box;padding:${spacing.sm}px ${spacing.md}px}
.hr-adm-person+.hr-adm-person{border-top:${borderWidth.thin}px solid ${colors.border.subtle}}
.hr-adm-person.hr-adm-you{background:${colors.surface.canvas}}
.hr-adm-name{flex:1 1 12rem;min-width:0}
.hr-adm-email{display:block;color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-adm-invite{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:${spacing.md}px;row-gap:${spacing.xs}px;padding:${spacing.sm}px ${spacing.md}px;border:${borderWidth.thin}px dashed ${colors.border.strong};border-radius:${radii.md}px}
.hr-adm-invite p{flex:1 1 12rem;min-width:0;margin:0;color:${colors.text.secondary}}
.hr-adm-about{margin:0;color:${colors.text.secondary};line-height:${typography.leading.relaxed}}
.hr-adm-full{margin:0;padding:${spacing.sm}px ${spacing.md}px;border-radius:${radii.md}px;background:${colors.surface.sunken};color:${colors.text.primary};line-height:${typography.leading.relaxed}}
.hr-adm-status{margin:0;min-height:${spacing.lg}px;color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-adm-status:empty{min-height:0}
.hr-adm-box{display:flex;flex-direction:column;gap:${spacing.sm}px;padding:${spacing.lg}px;border:${borderWidth.base}px solid ${colors.brand.secondaryDark};border-radius:${radii.lg}px;background:${colors.surface.paper};box-shadow:${CARD_SHADOW}}
.hr-adm-box:focus{outline:none}
.hr-adm-box:focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
.hr-adm-url{margin:0;padding:${spacing.sm}px ${spacing.md}px;border-radius:${radii.md}px;background:${colors.surface.sunken};color:${colors.text.primary};font-family:${typography.family.mono};font-size:${rem(typography.size.bodySm)};line-height:${typography.leading.normal};overflow-wrap:anywhere;user-select:all}
.hr-adm-warning{display:flex;align-items:flex-start;gap:${spacing.sm}px;margin:0;color:${colors.text.primary};line-height:${typography.leading.relaxed}}
.hr-adm-warning>span:first-child{flex:none;display:inline-flex;margin-top:${spacing.xxs}px}
.hr-adm-once{margin:0;color:${colors.text.secondary};line-height:${typography.leading.relaxed}}
.hr-adm-actions{display:flex;flex-wrap:wrap;gap:${spacing.sm}px}
.hr-adm-history{border-top:${borderWidth.thin}px solid ${colors.border.subtle};padding-top:${spacing.xs}px}
.hr-adm-history>summary{display:inline-flex;align-items:center;gap:${spacing.xs}px;min-height:${touchTarget.min}px;padding-inline:${spacing.xs}px ${spacing.sm}px;color:${colors.brand.secondaryDark};font-weight:${typography.weight.semibold};cursor:pointer;list-style:none}
.hr-adm-history>summary::-webkit-details-marker{display:none}
.hr-adm-history[open]>summary>span:first-child{transform:rotate(90deg)}
.hr-adm-history ol{list-style:none;margin:0;display:flex;flex-direction:column;gap:${spacing.xxs}px;padding:${spacing.xs}px ${spacing.md}px ${spacing.sm}px}
.hr-adm-history li{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};line-height:${typography.leading.relaxed}}
.hr-adm-skel{height:${spacing.lg}px;border-radius:${radii.sm}px;background:${colors.surface.sunken}}
.hr-adm-notice{display:flex;flex-direction:column;gap:${spacing.sm}px;margin-bottom:${spacing.md}px;padding:${spacing.md}px ${spacing.lg}px;border-radius:${radii.md}px;background:${colors.feedback.infoLight};color:${colors.text.primary};line-height:${typography.leading.relaxed}}
.hr-adm-notice p{margin:0}
.hr-adm-btn:focus-visible,.hr-adm-history>summary:focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
`;

const control: CSSProperties = { ...buttonBase, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: touchTarget.min, minWidth: touchTarget.min, boxSizing: 'border-box', flex: 'none', fontSize: rem(typography.size.body) };
const primary: CSSProperties = { ...control, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary };

function Btn({
  children,
  onClick,
  tone = 'secondary',
  busy = false,
  label,
  testId,
  innerRef,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'primary' | 'secondary';
  busy?: boolean;
  label?: string;
  testId?: string;
  innerRef?: (el: HTMLButtonElement | null) => void;
}): JSX.Element {
  return (
    <button
      ref={innerRef}
      type="button"
      className="hr-adm-btn"
      style={tone === 'primary' ? primary : control}
      aria-label={label}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onClick();
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** A line with the name in semibold where the dictionary put it (the translation may move it). */
function WithName({ text, name }: { text: string; name: string }): JSX.Element {
  const at = name === '' ? -1 : text.indexOf(name);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b style={{ fontWeight: typography.weight.semibold }}>{name}</b>
      {text.slice(at + name.length)}
    </>
  );
}

/** The panel's polite line: a key (worded at render, so it follows the language select), or a done line with a name. */
type PanelLine = { kind: 'revoked' } | { kind: 'removed'; name: string } | { kind: 'actionFailed' } | { kind: 'inviteFailed' } | { kind: 'stepUpCancelled' } | null;

export interface AdminsPanelProps {
  api: ConsoleApi;
  school: Pick<SpaceView, 'id' | 'name' | 'archivedAt'>;
  /** The signed-in grown-up. */
  accountId: string;
  confirm: (ask: ConfirmAsk) => Promise<boolean>;
  /** After Stop, or when a reload shows the viewer no longer runs the school: go to `href` (the flash already written). */
  onLeave: (href: string) => void;
  /** Injectable clock (tests); the browser's otherwise. */
  now?: () => Date;
}

export function AdminsPanel({ api, school, accountId, confirm, onLeave, now = () => new Date() }: AdminsPanelProps): JSX.Element {
  const { messages, locale } = useConsoleLocale();
  const a = messages.console.admins;
  const headingId = useId();
  const urlId = useId();
  const [view, setView] = useState<AdminsView | null>(null);
  const [failed, setFailed] = useState(false);
  // A Worker without the admin routes (older than SA-2) answers 404: the panel stays out of the page.
  const [absent, setAbsent] = useState(false);
  const [line, setLine] = useState<PanelLine>(null);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState<{ url: string; expiresAt: string; inviteId: string } | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [seen, setSeen] = useState<Set<string>>(() => readSeenNotices());
  const stepUp = useStepUp();
  const heading = useRef<HTMLHeadingElement | null>(null);
  const inviteButton = useRef<HTMLButtonElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const revokeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef<'heading' | 'invite' | 'box' | { revoke: string } | null>(null);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  /**
   * Reads the panel. `denied` is a `403` or `404`: the Worker answers so to someone who no longer runs the school (it
   * checks `space.manage` first), and on the first read a `404` is also a Worker older than the admin routes.
   */
  const load = useCallback(async (): Promise<{ kind: 'ok'; view: AdminsView } | { kind: 'denied' } | { kind: 'failed' } | null> => {
    const result = await api.admins(school.id);
    if (!live.current) return null;
    if (!result.ok) {
      if (result.status === 404) setAbsent(true);
      else setFailed(true);
      return result.status === 403 || result.status === 404 ? { kind: 'denied' } : { kind: 'failed' };
    }
    setFailed(false);
    setView(result.data);
    return { kind: 'ok', view: result.data };
  }, [api, school.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Focus after a change, once the panel has drawn it: the Invite button, the heading, the new box or an invite's Revoke.
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === 'box') boxRef.current?.focus();
    else if (target === 'invite') (inviteButton.current ?? heading.current)?.focus();
    else if (target === 'heading') heading.current?.focus();
    else (revokeButtons.current.get(target.revoke) ?? heading.current)?.focus();
  });

  const viewer: PanelViewer = view ? panelViewer(view, accountId) : 'none';
  const archived = !!school.archivedAt;

  /**
   * A reload after a stale action: a viewer who no longer runs the school goes to their grown-up home. That is a `200`
   * that leaves them out, or, for an administrator, the `403` or `404` the Worker gives someone without the role.
   */
  const reload = async (): Promise<void> => {
    const before = viewer;
    const next = await load();
    if (!next) return;
    if ((next.kind === 'ok' && panelViewer(next.view, accountId) === 'none') || (next.kind === 'denied' && before === 'admin')) onLeave(afterLeaving('none'));
    else focusNext.current = 'heading';
  };

  const settle = async (result: Awaited<ReturnType<ConsoleApi['revokeAdminInvite']>> | Awaited<ReturnType<ConsoleApi['removeAdmin']>>, done: PanelLine): Promise<boolean> => {
    const outcome = actionOutcome(result);
    if (outcome === 'failed') {
      setLine({ kind: 'actionFailed' });
      return false;
    }
    if (outcome === 'reload') {
      setLine(null);
      await reload();
      return false;
    }
    setLine(done);
    await load();
    focusNext.current = 'invite';
    return true;
  };

  const invite = async (): Promise<void> => {
    setBusy(true);
    setLine(null);
    const outcome = await stepUp.run(() => api.createAdminInvite(school.id));
    if (!live.current) return;
    setBusy(false);
    if (outcome.kind === 'cancelled') {
      setLine({ kind: 'stepUpCancelled' });
      return;
    }
    const result = outcome.result;
    if (result.ok && result.data.url) {
      setCopy('idle');
      setBox({ url: result.data.url, expiresAt: result.data.invite.expiresAt, inviteId: result.data.invite.id });
      focusNext.current = 'box';
      await load();
      return;
    }
    if (result.ok) {
      // The invite exists (it holds a place) but this build has no link for it: the panel shows it, with Revoke.
      await load();
      if (!live.current) return;
      setLine({ kind: 'inviteFailed' });
      return;
    }
    // Another tab took the last place, or the school was archived meanwhile: the panel shows what is true now.
    if (!result.ok && (result.code === 'admins_full' || result.code === 'archived')) {
      await reload();
      return;
    }
    setLine({ kind: 'inviteFailed' });
  };

  const doCopy = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  const revoke = async (inviteId: string): Promise<void> => {
    const yes = await confirm({ title: a.revokeAsk, confirmLabel: a.revoke.cta, cancelLabel: a.revokeKeep.cta });
    if (!yes) return;
    setBusy(true);
    setLine(null);
    const result = await api.revokeAdminInvite(school.id, inviteId);
    if (!live.current) return;
    setBusy(false);
    if (box?.inviteId === inviteId) setBox(null);
    await settle(result, { kind: 'revoked' });
  };

  const remove = async (admin: AdminRow): Promise<void> => {
    const name = adminName(admin.name, locale);
    const yes = await confirm({ title: a.removeAsk(name, school.name), message: admin.staysTeacher ? a.removeNote.staysTeacher : a.removeNote.leaves, confirmLabel: a.remove.cta });
    if (!yes) return;
    setBusy(true);
    setLine(null);
    const result = await api.removeAdmin(school.id, admin.accountId);
    if (!live.current) return;
    setBusy(false);
    await settle(result, { kind: 'removed', name });
  };

  const leave = async (self: AdminRow): Promise<void> => {
    const yes = await confirm({ title: a.leaveAsk(school.name), message: self.staysTeacher ? a.leaveNote.staysTeacher : a.leaveNote.leaves, confirmLabel: a.leave.cta });
    if (!yes) return;
    setBusy(true);
    setLine(null);
    const result = await api.leaveAdmin(school.id);
    if (!live.current) return;
    setBusy(false);
    const outcome = actionOutcome(result);
    if (outcome === 'failed') {
      setLine({ kind: 'actionFailed' });
      return;
    }
    if (outcome === 'reload' || !result.ok) {
      await reload();
      return;
    }
    // The next home says so (one-shot flash, the school's name in this tab only, never in an address).
    writeConsoleFlash({ kind: 'adminLeft', school: school.name });
    onLeave(afterLeaving(result.data.stays));
  };

  const closeBox = (): void => {
    const id = box?.inviteId;
    setBox(null);
    setCopy('idle');
    focusNext.current = id ? { revoke: id } : 'heading';
  };

  const statusText = (): string | null => {
    if (!line) return null;
    switch (line.kind) {
      case 'revoked':
        return a.revoked;
      case 'removed':
        return a.removed(line.name);
      case 'actionFailed':
        return a.actionFailed;
      case 'inviteFailed':
        return a.invite.failed;
      case 'stepUpCancelled':
        return messages.console.billing.stepUp.cancelled;
    }
  };

  const notices = view ? newAdminNotices(view.admins, viewer, now(), seen) : [];
  const history = viewer === 'owner' ? historyLines(view?.events, locale) : [];
  const self = view?.admins.find((x) => x.accountId === accountId) ?? null;

  if (absent && !view) return <></>;
  return (
    <>
      <style>{ADMINS_CSS}</style>
      {stepUp.dialog ? (
        <>
          <BillingStyles />
          <StepUpDialog {...stepUp.dialog} lines={{ body: a.invite.stepUp.body, reason: a.invite.stepUp.reason }} />
        </>
      ) : null}
      {notices.map((n) => {
        const name = adminName(n.name, locale);
        return (
          <div key={noticeId(n)} className="hr-adm-notice" role="status" data-testid="admins-new-notice">
            <p>{a.newAdmin(name, n.email)}</p>
            <div className="hr-adm-actions">
              <Btn onClick={() => void remove(n)} busy={busy} label={a.remove.a11y(name)} testId="admins-new-notice-remove">
                {a.remove.cta}
              </Btn>
              <Btn onClick={() => setSeen(rememberNotice(noticeId(n)))} testId="admins-new-notice-dismiss">
                {a.newAdminDismiss.cta}
              </Btn>
            </div>
          </div>
        );
      })}
      <section className="hr-adm" aria-labelledby={headingId} aria-busy={!view && !failed ? true : undefined} data-testid="admins-panel">
        <div className="hr-adm-head">
          <h2 id={headingId} ref={heading} tabIndex={-1}>
            {a.title}
          </h2>
          {view ? <p className="hr-adm-muted" data-testid="admins-count">{a.count(view.admins.length, view.limit)}</p> : null}
        </div>
        {failed && !view ? (
          <>
            <p style={{ margin: 0 }}>{messages.console.cantReach}</p>
            <div className="hr-adm-actions">
              <Btn onClick={() => void load()} testId="admins-retry">
                {messages.console.tryAgain}
              </Btn>
            </div>
          </>
        ) : !view ? (
          <>
            <div className="hr-adm-skel" />
            <div className="hr-adm-skel" />
          </>
        ) : (
          <>
            <ul className="hr-adm-people" data-testid="admins-list">
              <li className={view.owner.accountId === accountId ? 'hr-adm-person hr-adm-you' : 'hr-adm-person'} data-testid="admins-owner-row">
                <span className="hr-adm-name">
                  <WithName text={a.ownerRow(adminName(view.owner.name, locale))} name={adminName(view.owner.name, locale)} />
                </span>
              </li>
              {view.admins.map((admin) => {
                const name = adminName(admin.name, locale);
                return (
                  <li key={admin.accountId} className={admin.accountId === accountId ? 'hr-adm-person hr-adm-you' : 'hr-adm-person'} data-testid="admins-admin-row">
                    <span className="hr-adm-name">
                      <WithName text={a.adminRow(name, adminDay(admin.joinedAt, locale))} name={name} />
                      {viewer === 'owner' && typeof admin.email === 'string' && admin.email !== '' ? (
                        <span className="hr-adm-email" data-testid="admins-email">
                          {admin.email}
                        </span>
                      ) : null}
                    </span>
                    {viewer === 'owner' ? (
                      <Btn onClick={() => void remove(admin)} busy={busy} label={a.remove.a11y(name)} testId="admins-remove">
                        {a.remove.cta}
                      </Btn>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {box && viewer === 'owner' ? (
              <div ref={boxRef} className="hr-adm-box" role="group" aria-labelledby={urlId} tabIndex={-1} data-testid="admins-invite-box">
                <p id={urlId} className="hr-adm-url" data-testid="admins-invite-url">
                  {box.url}
                </p>
                <p className="hr-adm-warning">
                  <span aria-hidden="true">
                    <IconSvg name="lock" size={spacing.lg} color={colors.text.primary} />
                  </span>
                  <span>{a.invite.warning}</span>
                </p>
                <p className="hr-adm-once">{a.invite.once(adminDate(box.expiresAt, locale))}</p>
                <div className="hr-adm-actions">
                  <Btn onClick={() => void doCopy(box.url)} testId="admins-invite-copy">
                    {a.invite.copy.cta}
                  </Btn>
                  <Btn onClick={closeBox} testId="admins-invite-close">
                    {messages.common.buttons.close}
                  </Btn>
                </div>
                <p className="hr-adm-status" role="status" aria-live="polite" data-testid="admins-invite-status">
                  {copy === 'copied' ? a.invite.copied : copy === 'failed' ? a.invite.copyFailed : null}
                </p>
              </div>
            ) : null}
            {viewer === 'owner'
              ? (view.invites ?? []).map((row) => (
                  <div key={row.id} className="hr-adm-invite" data-testid="admins-open-invite">
                    <p>{a.openInvite(adminDay(row.createdAt, locale), adminDate(row.expiresAt, locale))}</p>
                    <Btn
                      onClick={() => void revoke(row.id)}
                      busy={busy}
                      testId="admins-revoke"
                      innerRef={(el) => {
                        if (el) revokeButtons.current.set(row.id, el);
                        else revokeButtons.current.delete(row.id);
                      }}
                    >
                      {a.revoke.cta}
                    </Btn>
                  </div>
                ))
              : null}
            <p className="hr-adm-about">{a.about(view.limit)}</p>
            {inviteShown(view, viewer, archived) ? (
              <div className="hr-adm-actions">
                <Btn
                  tone="primary"
                  onClick={() => void invite()}
                  busy={busy}
                  testId="admins-invite"
                  innerRef={(el) => {
                    inviteButton.current = el;
                  }}
                >
                  {a.invite.cta}
                </Btn>
              </div>
            ) : null}
            {fullShown(view, viewer, archived) ? (
              <p className="hr-adm-full" data-testid="admins-full">
                {a.full(view.limit)}
              </p>
            ) : null}
            {viewer === 'admin' && self ? (
              <div className="hr-adm-actions">
                <Btn onClick={() => void leave(self)} busy={busy} testId="admins-leave">
                  {a.leave.cta}
                </Btn>
              </div>
            ) : null}
            <p className="hr-adm-status" role="status" aria-live="polite" data-testid="admins-status">
              {statusText()}
            </p>
            {history.length > 0 ? (
              <details className="hr-adm-history" data-testid="admins-history">
                <summary>
                  <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                    <IconSvg name="arrow-right" size={spacing.lg} color={colors.brand.secondaryDark} />
                  </span>
                  <span>{a.history.title}</span>
                </summary>
                <ol>
                  {history.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ol>
              </details>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
