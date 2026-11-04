'use client';

import { CLASS_SCOPE_LINE_IDS, CLASS_SCOPE_TEXT, classScopeItems, isTransferConsentLocale, type TransferConsentLocale } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useId, useState, type CSSProperties } from 'react';
import type { ConsoleApi } from '@/lib/console/api';
import type { ClassScopeState, MoveNotice as MoveNoticeView } from '@/lib/console/class-moves';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { MoveButton } from './TransferParts';
import { rem } from '@/lib/console/rem';

/**
 * [TV] The family's cards on the parent home (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4, TV-D5, TV-D10; wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 4, mock notes `design/screens/class-moves/README.md`).
 *
 * - One card per learner of the family who is in a class and has not read the class-scope update: the keyed lines
 *   of content-schema `CLASS_SCOPE_TEXT` in the console's language (the same ids, in the same order, as the app's
 *   screen), the list of what a teacher sees always open, and **OK**, which records the acknowledgement. Until then
 *   teachers keep the earlier scope for that learner. The card is unchanged by GX-4; the Needs you strip's **Read and
 *   OK** scrolls to it and focuses it (`scopeCardDomId`) until the owner answers GX-OD-3 (row GX-5b).
 * - The notice of a move a teacher made in the last 30 days that no grown-up has dismissed: "{name} moved to a new
 *   class: {class}." and **OK** (`MoveNotice`). GX-4 (AMENDMENTS-GROWNUP-UX section 7.1) draws it inside the card of the
 *   child it is about, after the child's lines and before the buttons.
 * The page holds the reads (its quiet load), so a new update or notice appears without a reload.
 * Neither card is red; neither goes away on its own.
 */

export type FamilyClassCardsApi = Pick<ConsoleApi, 'acknowledgeClassScope'>;
export type MoveNoticeApi = Pick<ConsoleApi, 'markMoveSeen'>;

const card: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderInlineStart: `${borderWidth.thick}px solid ${colors.brand.secondary}`,
  borderRadius: radii.md,
  padding: spacing.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.sm,
};
const line: CSSProperties = { margin: 0, fontSize: rem(typography.size.body), color: colors.text.primary, lineHeight: typography.leading.relaxed };
/** The notice inside a child card (mock `.notice`): the info fill, text and OK on one row that wraps. */
const noticeBox: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing.sm,
  padding: `${spacing.md}px ${spacing.lg}px`,
  borderRadius: radii.md,
  backgroundColor: colors.feedback.infoLight,
};

const fill = (text: string, name: string): string => text.split('{learner}').join(name);

/** The DOM id of a learner's class-scope card, so the Needs you strip can scroll to it (an id, never in a URL). */
export function scopeCardDomId(familyId: string, learnerId: string): string {
  return `class-scope-${familyId}-${learnerId}`;
}

export function FamilyClassCards({
  familyId,
  api,
  scope,
  onScope,
  onStale,
}: {
  familyId: string;
  api: FamilyClassCardsApi;
  /** The page's read of `GET /:familyId/class-scope`; null before it answers or when it failed (no card). */
  scope: ClassScopeState | null;
  onScope: (next: ClassScopeState) => void;
  /** The version moved on meanwhile: the page reads again. */
  onStale: () => void;
}): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.classScope;
  const textLocale: TransferConsentLocale = isTransferConsentLocale(locale) ? locale : 'en';
  const text = CLASS_SCOPE_TEXT[textLocale];
  const items = classScopeItems(textLocale);
  const listId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const acknowledge = async (learnerId: string): Promise<void> => {
    if (!scope || busy) return;
    setBusy(learnerId);
    setFailed(null);
    const r = await api.acknowledgeClassScope(familyId, learnerId, scope.current);
    setBusy(null);
    if (r.ok) onScope({ ...scope, learners: scope.learners.map((l) => (l.learnerId === learnerId ? { ...l, needed: false } : l)) });
    else if (r.code === 'class_scope_stale') onStale();
    else setFailed(learnerId);
  };

  const needed = scope?.learners.filter((l) => l.needed) ?? [];
  if (needed.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }} data-testid="family-class-cards">
      {needed.map((l) => (
        <section
          key={l.learnerId}
          id={scopeCardDomId(familyId, l.learnerId)}
          tabIndex={-1}
          style={card}
          data-testid="class-scope-card"
          lang={textLocale}
          aria-labelledby={`${listId}-${l.learnerId}`}
        >
          <h3 id={`${listId}-${l.learnerId}`} style={{ margin: 0, fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold }}>
            {t.title(l.name)}
          </h3>
          {CLASS_SCOPE_LINE_IDS.map((id) =>
            id === 'list' ? (
              <div key={id} data-line={id}>
                <p style={{ ...line, fontWeight: typography.weight.semibold }}>{text.lines.list}</p>
                <ul style={{ margin: `${spacing.xs}px 0 0`, paddingInlineStart: spacing.lg, color: colors.text.primary, lineHeight: typography.leading.relaxed }}>
                  {items.map((item) => (
                    <li key={item.id} data-item={item.id}>
                      {fill(item.text, l.name)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p key={id} data-line={id} style={line}>
                {fill(text.lines[id], l.name)}
              </p>
            ),
          )}
          {failed === l.learnerId ? (
            <p role="alert" style={{ ...line, color: colors.text.secondary }}>
              {t.failed}
            </p>
          ) : null}
          <div>
            <MoveButton primary waiting={busy === l.learnerId} onClick={() => void acknowledge(l.learnerId)} testId="class-scope-ok">
              {busy === l.learnerId ? t.saving.cta : messages.common.buttons.ok}
            </MoveButton>
          </div>
        </section>
      ))}
    </div>
  );
}

/** TV-D10's one-time notice, inside the card of the child it is about (GX-4): the same text, the same **OK**, the same seen write. */
export function MoveNotice({ familyId, notice, api, onSeen }: { familyId: string; notice: MoveNoticeView; api: MoveNoticeApi; onSeen: (moveId: string) => void }): JSX.Element {
  const { messages } = useConsoleLocale();
  const t = messages.console.classScope;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const seen = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const r = await api.markMoveSeen(familyId, notice.id).catch(() => null);
    setBusy(false);
    if (r?.ok) onSeen(notice.id);
    else setFailed(true);
  };
  const words = t.notice(notice.learnerName, notice.to.name);
  return (
    <section style={noticeBox} data-testid="move-notice" aria-label={words}>
      <p style={{ ...line, flex: '1 1 12rem', fontWeight: typography.weight.semibold }}>{words}</p>
      {failed ? (
        <p role="alert" style={{ ...line, flexBasis: '100%', color: colors.text.secondary }}>
          {t.failed}
        </p>
      ) : null}
      <MoveButton primary waiting={busy} onClick={() => void seen()} testId="move-notice-ok">
        {messages.common.buttons.ok}
      </MoveButton>
    </section>
  );
}
