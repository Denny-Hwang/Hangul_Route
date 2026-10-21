'use client';

import { APP_ROUTES, SCHOOL_ADMIN_CAP } from '@hangul-route/content-schema';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { Messages } from '@hangul-route/i18n';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ConsoleApi } from '@/lib/console/api';
import { acceptAnswer, clearAdminInvite, previewAnswer, readAdminInvite, type InviteAnswer, type InviteRefusal } from '@/lib/console/admin-invite';
import { writeConsoleFlash } from '@/lib/console/console-flash';
import { headRem, rem } from '@/lib/console/rem';
import { ROUTES } from '@/lib/console/routing';
import { signedOutTarget } from '@/lib/console/signin-flow';
import { SignInColumn } from './SignInParts';
import { buttonBase } from './ui';

/**
 * [SA] `/account/invite`: an administrator invite, from its link to Accept (AMENDMENTS-SEATS-ADMINS section 6.6 steps 5
 * to 8; wireframe design/wireframes/console/admin-invite-accept.md, mock design/screens/console/admin-invite-accept.md,
 * D15 and D17 of design/screens/console/README.md). The `/start` column with the brand mark, no tab row (an invitee
 * may hold no space yet). The token comes from this tab's stash only (`GrownUpGate` took it from the fragment); it is
 * sent in the JSON body of preview and accept and never shown, put in an address, a title or telemetry.
 *
 * - No stash: `reopen` and Go to my home.
 * - Preview: "Join {school} as an administrator?", who invited, Signed in as with Use another account, what the role can
 *   and cannot do, Accept and Not now.
 * - Accept: the school page with `adminInvite.done(school)` (a one-shot flash, never a query parameter).
 * - A final refusal: one calm line and Go to my home. A `429`, a network failure or a `503`: the line, Try again (the
 *   stash kept) and Go to my home. Go to my home and Not now always drop the stash.
 */

type Phase = { at: 'loading' } | { at: 'reopen' } | { at: 'accepting'; preview: Extract<InviteAnswer, { at: 'preview' }> } | Exclude<InviteAnswer, { at: 'accepted' }>;

/** What Try again repeats: the preview, or the accept of the preview it came from. */
type LastCall = { kind: 'preview' } | { kind: 'accept'; preview: Extract<InviteAnswer, { at: 'preview' }> };

const INVITE_CSS = `
.hr-inv{display:flex;flex-direction:column;gap:${spacing.lg}px;width:100%;text-align:left}
.hr-inv h1{margin:0;font-size:${headRem(typography.size.title)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};overflow-wrap:anywhere}
.hr-inv h1:focus{outline:none}
.hr-inv h1:focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
.hr-inv-mark{align-self:center}
.hr-inv-by{margin:0;color:${colors.text.secondary};font-size:${rem(typography.size.bodyLg)};overflow-wrap:anywhere}
.hr-inv-as{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:${spacing.md}px;row-gap:${spacing.xs}px;padding:${spacing.sm}px ${spacing.md}px;border-radius:${radii.md}px;background:${colors.surface.sunken}}
.hr-inv-as p{flex:1 1 12rem;min-width:0;margin:0;overflow-wrap:anywhere;color:${colors.text.primary}}
.hr-inv-consent{display:flex;flex-direction:column;gap:${spacing.md}px;padding:${spacing.lg}px;border-radius:${radii.md}px;background:${colors.surface.paper};border:${borderWidth.thin}px solid ${colors.border.subtle}}
.hr-inv-consent p{margin:0;line-height:${typography.leading.relaxed}}
.hr-inv-consent p+p{padding-top:${spacing.md}px;border-top:${borderWidth.thin}px solid ${colors.border.subtle}}
.hr-inv-line{margin:0;line-height:${typography.leading.relaxed};color:${colors.text.primary}}
.hr-inv-actions{display:flex;flex-direction:column;gap:${spacing.sm}px}
.hr-inv-actions>button{width:100%}
.hr-inv-btn:focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${borderWidth.base}px}
@media (min-width:${layout.maxWidth.reading / 16}em){.hr-inv-actions{flex-direction:row;flex-wrap:wrap}.hr-inv-actions>button{width:auto}.hr-inv-actions>.hr-inv-primary{padding-left:${spacing.xxl}px;padding-right:${spacing.xxl}px}}
`;

const control: CSSProperties = { ...buttonBase, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: touchTarget.min, boxSizing: 'border-box', fontSize: rem(typography.size.body) };
const primary: CSSProperties = { ...control, backgroundColor: colors.brand.primary, borderColor: colors.brand.primary, color: colors.text.onPrimary };
const markStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: spacing.xxxl,
  height: spacing.xxxl,
  borderRadius: radii.circle,
  backgroundColor: colors.brand.primary,
  color: colors.text.inverse,
  fontSize: rem(typography.size.bodyLg),
  fontWeight: typography.weight.bold,
  flex: 'none',
};

function Act({ children, onClick, tone = 'secondary', busy = false, unavailable = false, testId }: { children: ReactNode; onClick: () => void; tone?: 'primary' | 'secondary'; busy?: boolean; unavailable?: boolean; testId: string }): JSX.Element {
  const off = busy || unavailable;
  return (
    <button
      type="button"
      className={tone === 'primary' ? 'hr-inv-btn hr-inv-primary' : 'hr-inv-btn'}
      style={tone === 'primary' ? primary : { ...control, ...(unavailable ? { color: colors.text.muted, cursor: 'default' } : null) }}
      aria-busy={busy || undefined}
      aria-disabled={off || undefined}
      onClick={() => {
        if (!off) onClick();
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** The calm line of a final refusal. */
export function refusalLine(reason: InviteRefusal, invite: Messages['console']['adminInvite'], school?: string): string {
  switch (reason) {
    case 'used':
      return invite.used;
    case 'expired':
      return invite.expired;
    case 'revoked':
      return invite.revoked;
    case 'full':
      return invite.full(SCHOOL_ADMIN_CAP);
    case 'owner':
      return invite.owner;
    case 'alreadyAdmin':
      return invite.alreadyAdmin(school ?? '');
    case 'notFound':
      return invite.notFound;
    case 'emailUnverified':
      return invite.emailUnverified;
  }
}

export interface AdminInviteViewProps {
  api: ConsoleApi | null;
  /** The signed-in account: its own email from Clerk (`useUser`, through the auth context), else its display name. */
  who: string;
  m: Messages;
  /** Same-tab navigation (the router's `replace`). */
  go: (href: string) => void;
  /** Signs out and keeps the stash, then `/signin?next=/account/invite` (Use another account). */
  switchAccount: (signInUrl: string) => void;
}

export function AdminInviteView({ api, who, m, go, switchAccount }: AdminInviteViewProps): JSX.Element {
  const c = m.console;
  const t = c.adminInvite;
  // The token, read once from this tab's stash: an expired or missing stash reads as none.
  const [token] = useState<string | null>(() => readAdminInvite());
  const [phase, setPhase] = useState<Phase>(() => (token ? { at: 'loading' } : { at: 'reopen' }));
  const last = useRef<LastCall>({ kind: 'preview' });
  const heading = useRef<HTMLHeadingElement | null>(null);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  // The tab title is the page's own in every state: never the school's name (D15).
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = t.pageTitle;
  }, [t.pageTitle]);

  const preview = useCallback(async (): Promise<void> => {
    last.current = { kind: 'preview' };
    if (!token) return;
    if (!api) {
      setPhase({ at: 'retry', reason: 'cantReach' });
      return;
    }
    setPhase({ at: 'loading' });
    const answer = previewAnswer(await api.previewAdminInvite(token));
    if (!live.current) return;
    setPhase(answer.at === 'accepted' ? { at: 'retry', reason: 'cantReach' } : answer);
  }, [api, token]);

  useEffect(() => {
    void preview();
  }, [preview]);

  // On arrival and after each change, focus goes to the h1, so the new state is read from its top.
  useEffect(() => {
    heading.current?.focus();
  }, [phase.at]);

  const accept = async (from: Extract<InviteAnswer, { at: 'preview' }>): Promise<void> => {
    last.current = { kind: 'accept', preview: from };
    if (!token || !api) {
      setPhase({ at: 'retry', reason: 'cantReach' });
      return;
    }
    setPhase({ at: 'accepting', preview: from });
    const answer = acceptAnswer(await api.acceptAdminInvite(token));
    if (!live.current) return;
    if (answer.at === 'accepted') {
      clearAdminInvite();
      writeConsoleFlash({ kind: 'adminJoined', school: answer.school });
      go(ROUTES.space(answer.spaceId, 'school'));
      return;
    }
    setPhase(answer);
  };

  const tryAgain = (): void => {
    const call = last.current;
    if (call.kind === 'accept') void accept(call.preview);
    else void preview();
  };

  /** Not now and Go to my home: the stash goes in every state (the link itself still works), then the router's home. */
  const home = (): void => {
    clearAdminInvite();
    go(APP_ROUTES.teacherIndex);
  };

  const homeButton = (
    <Act onClick={home} testId="invite-home">
      {t.home.cta}
    </Act>
  );

  let body: ReactNode;
  if (phase.at === 'preview' || phase.at === 'accepting') {
    const p = phase.at === 'preview' ? phase : phase.preview;
    const accepting = phase.at === 'accepting';
    body = (
      <>
        <h1 ref={heading} tabIndex={-1} data-testid="invite-title">
          {t.title(p.school)}
        </h1>
        <p className="hr-inv-by" data-testid="invite-by">
          {p.invitedBy ? t.invitedBy(p.invitedBy) : t.invitedByOwner}
        </p>
        <div className="hr-inv-as" data-testid="invite-signed-in">
          <p>{t.signedInAs(who)}</p>
          <Act onClick={() => switchAccount(signedOutTarget(APP_ROUTES.adminInvite, ''))} unavailable={accepting} testId="invite-switch">
            {t.switchAccount.cta}
          </Act>
        </div>
        <div className="hr-inv-consent" data-testid="invite-consent">
          <p>{t.can}</p>
          <p>{t.cannot}</p>
          <p>{t.leave}</p>
        </div>
        <div className="hr-inv-actions">
          <Act tone="primary" onClick={() => void accept(p)} busy={accepting} testId="invite-accept">
            {t.accept.cta}
          </Act>
          <Act onClick={home} unavailable={accepting} testId="invite-not-now">
            {t.notNow.cta}
          </Act>
        </div>
      </>
    );
  } else {
    const line =
      phase.at === 'reopen'
        ? t.reopen
        : phase.at === 'loading'
          ? c.space.loading
          : phase.at === 'refused'
            ? refusalLine(phase.reason, t, phase.school)
            : phase.reason === 'tooMany'
              ? m.caregiver.retry.tooManyAttempts
              : c.cantReach;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1} data-testid="invite-title">
          {t.pageTitle}
        </h1>
        <p className="hr-inv-line" role="status" aria-busy={phase.at === 'loading' || undefined} data-testid={`invite-${phase.at}`}>
          {line}
        </p>
        {phase.at === 'loading' ? null : (
          <div className="hr-inv-actions">
            {phase.at === 'retry' ? (
              <Act tone="primary" onClick={tryAgain} testId="invite-try-again">
                {c.tryAgain}
              </Act>
            ) : null}
            {homeButton}
          </div>
        )}
      </>
    );
  }

  return (
    <SignInColumn>
      <style>{INVITE_CSS}</style>
      <div className="hr-inv" data-testid="admin-invite">
        <span aria-hidden="true" className="hr-inv-mark" style={markStyle}>
          {m.landing.brand.mark}
        </span>
        {body}
      </div>
    </SignInColumn>
  );
}
