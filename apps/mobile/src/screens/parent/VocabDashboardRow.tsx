import type { VocabProgress } from '@hangul-route/content-schema';
import { Body, Caption, KoreanText, borderWidth, colors, spacing } from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { vocabItem } from '../../content/vocab';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { caregiverWordsRow } from '../../logic/vocab/caregiver-row';

/**
 * The Words row of a learner's dashboard card (F-VOC-005 section 3.8, PR P-3; a copy change on the
 * existing screen, no new wireframe): "N collected, M strong", the first-try rate, and up to three
 * words to look at together, each a `KoreanText` with its romanization and gloss. The same caregiver
 * typography as the Starting spot row; plain text, never a chart or a rank. A learner with no word
 * draws nothing. The caller renders it only while Words is offered (`wordsOffered`, the flag).
 */
export function VocabDashboardRow({
  snapshot,
  testID,
}: {
  snapshot: { vocab?: VocabProgress } | undefined;
  testID: string;
}): React.ReactElement | null {
  const messages = useMessages();
  const m = messages.caregiver.dashboard.words;
  const locale = useLocale();
  const row = useMemo(() => caregiverWordsRow(snapshot, new Date(), vocabItem, locale), [snapshot, locale]);
  if (row === null) return null;
  return (
    <View testID={testID} style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle }}>
      <Caption tone="muted">{m.label}</Caption>
      <Body weight="semibold">{m.counts(row.collected, row.strong)}</Body>
      {row.firstTryPercent === null ? null : <Caption tone="muted">{m.firstTry(row.firstTryPercent)}</Caption>}
      {row.together.length > 0 ? (
        <>
          <Caption tone="muted">{m.together}</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
            {row.together.map((w) => (
              <KoreanText key={w.id} ko={w.ko} romanization={w.romanization} gloss={w.gloss} size="sm" testID={`${testID}-word-${w.id}`} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
