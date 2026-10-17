'use client';

import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useId, type CSSProperties } from 'react';
import type { LearnerReportBody } from '@/lib/console/api';
import { studentWords } from '@/lib/console/vocab-words';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { StudentWordsLines } from './VocabWordsParts';
import { rem } from '@/lib/console/rem';

/**
 * [TV] The learner report's Words and Settings blocks (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D2, TV-D12; wireframe
 * `design/wireframes/console/teacher-move-and-scope.md` screen 3). A student's detail view (F-VOC-005 section 3.8):
 * words collected and known well, the first-try rate, the words to look at again (Korean with romanization and its
 * gloss, `StudentWordsLines`), and the learner's class-notes setting. At base scope (a class before the family has
 * read the update) one muted line says why these are missing. No chart, no ranking, no comparison, never red.
 */

const block: CSSProperties = {
  backgroundColor: colors.surface.paper,
  border: `${borderWidth.thin}px solid ${colors.border.subtle}`,
  borderRadius: radii.md,
  padding: spacing.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xs,
  marginTop: spacing.lg,
  fontSize: rem(typography.size.body),
  color: colors.text.primary,
};
const heading: CSSProperties = { margin: `0 0 ${spacing.xs}px`, fontSize: rem(typography.size.bodyLg), fontWeight: typography.weight.bold };

export function ReportScopeBlock({ data }: { data: LearnerReportBody }): JSX.Element | null {
  const { messages, locale } = useConsoleLocale();
  const t = messages.console.reportScope;
  const wordsId = useId();
  const settingsId = useId();
  if (data.scope === 'base') {
    return (
      <p data-testid="report-base-scope" style={{ margin: `${spacing.lg}px 0 0`, color: colors.text.muted, fontSize: rem(typography.size.body) }}>
        {t.baseScope}
      </p>
    );
  }
  const vocab = data.summary?.vocab ?? null;
  const words = vocab ? studentWords({ vocab }, locale) : null;
  const rate = vocab?.firstTryRate ?? null;
  const classNotes = data.settings?.classNotes ?? null;
  if (!words && classNotes === null) return null;
  return (
    <>
      {words ? (
        <section aria-labelledby={wordsId} style={block} data-testid="report-words">
          <h2 id={wordsId} style={heading}>
            {t.words}
          </h2>
          <StudentWordsLines words={words} />
          {rate !== null ? <div data-testid="report-first-try">{t.firstTry(Math.round(rate * 100))}</div> : null}
        </section>
      ) : null}
      {classNotes !== null ? (
        <section aria-labelledby={settingsId} style={block} data-testid="report-settings">
          <h2 id={settingsId} style={heading}>
            {t.settings}
          </h2>
          <div>{t.classNotes[classNotes]}</div>
        </section>
      ) : null}
    </>
  );
}
