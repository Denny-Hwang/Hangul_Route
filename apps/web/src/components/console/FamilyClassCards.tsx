'use client';

import { CLASS_SCOPE_LINE_IDS, CLASS_SCOPE_TEXT, classScopeItems, isTransferConsentLocale, type TransferConsentLocale } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import type { ConsoleApi } from '@/lib/console/api';
import type { ClassScopeState, MoveNotice } from '@/lib/console/class-moves';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { MoveButton } from './TransferParts';

/**
 * [TV] The family's cards on the parent home (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4, TV-D5, TV-D10; wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 4, mock notes `design/screens/class-moves/README.md`).
 *
 * - One card per learner of the family who is in a class and has not read the class-scope update: the keyed lines
 *   of content-schema `CLASS_SCOPE_TEXT` in the console's language (the same ids, in the same order, as the app's
 *   screen), the list of what a teacher sees always open, and **OK**, which records the acknowledgement. Until then
 *   teachers keep the earlier scope for that learner.
 * - One card per move a teacher made in the last 30 days that no grown-up has dismissed: "{name} moved to a new
 *   class: {class}." and **OK**. Only while class moves are on (`movesShown`).
 * Neither card is red; neither goes away on its own.
 */

export type FamilyClassCardsApi = Pick<ConsoleApi, 'classScope' | 'acknowledgeClassScope' | 'moveNotices' | 'markMoveSeen'>;

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
const line: CSSProperties = { margin: 0, fontSize: typography.size.body, color: colors.text.primary, lineHeight: typography.leading.relaxed };

const fill = (text: string, name: string): string => text.split('{learner}').join(name);

export function FamilyClassCards({ familyId, api, movesShown }: { familyId: string; api: FamilyClassCardsApi; movesShown: boolean }): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.classScope;
  const textLocale: TransferConsentLocale = isTransferConsentLocale(locale) ? locale : 'en';
  const text = CLASS_SCOPE_TEXT[textLocale];
  const items = classScopeItems(textLocale);
  const listId = useId();
  const [scope, setScope] = useState<ClassScopeState | null>(null);
  const [notices, setNotices] = useState<MoveNotice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // A failure of either read (network, an older API) leaves the cards hidden; the page itself never breaks.
  const load = useCallback(async (): Promise<void> => {
    try {
      const [s, n] = await Promise.all([api.classScope(familyId), movesShown ? api.moveNotices(familyId) : null]);
      if (s.ok) setScope(s.data);
      if (n?.ok) setNotices(n.data);
    } catch {
      // stay hidden
    }
  }, [api, familyId, movesShown]);

  useEffect(() => {
    void load();
  }, [load]);

  const acknowledge = async (learnerId: string): Promise<void> => {
    if (!scope || busy) return;
    setBusy(learnerId);
    setFailed(null);
    const r = await api.acknowledgeClassScope(familyId, learnerId, scope.current);
    setBusy(null);
    if (r.ok) setScope({ ...scope, learners: scope.learners.map((l) => (l.learnerId === learnerId ? { ...l, needed: false } : l)) });
    else if (r.code === 'class_scope_stale') await load();
    else setFailed(learnerId);
  };

  const seen = async (moveId: string): Promise<void> => {
    if (busy) return;
    setBusy(moveId);
    setFailed(null);
    const r = await api.markMoveSeen(familyId, moveId);
    setBusy(null);
    if (r.ok) setNotices((prev) => prev.filter((n) => n.id !== moveId));
    else setFailed(moveId);
  };

  const needed = scope?.learners.filter((l) => l.needed) ?? [];
  if (needed.length === 0 && notices.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }} data-testid="family-class-cards">
      {notices.map((n) => (
        <section key={n.id} style={card} data-testid="move-notice" aria-label={t.notice(n.learnerName, n.to.name)}>
          <p style={{ ...line, fontWeight: typography.weight.semibold }}>{t.notice(n.learnerName, n.to.name)}</p>
          {failed === n.id ? (
            <p role="alert" style={{ ...line, color: colors.text.secondary }}>
              {t.failed}
            </p>
          ) : null}
          <div>
            <MoveButton primary waiting={busy === n.id} onClick={() => void seen(n.id)} testId="move-notice-ok">
              {messages.common.buttons.ok}
            </MoveButton>
          </div>
        </section>
      ))}
      {needed.map((l) => (
        <section key={l.learnerId} style={card} data-testid="class-scope-card" lang={textLocale} aria-labelledby={`${listId}-${l.learnerId}`}>
          <h3 id={`${listId}-${l.learnerId}`} style={{ margin: 0, fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold }}>
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
