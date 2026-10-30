import type { Realia } from '@hangul-route/content-schema';
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { lineSpeech, lineViews, sheetKind, sheetSummary, startRealiaRead, titleView } from '../../logic/realia-read-flow';
import { playPrompt } from '../../platform/audio';
import { RealiaSheetView } from './realia-kinds-entry';

/**
 * The card a Cloze Pick value gap is read from (F-CURR-002 row CM-30; design/wireframes/minigame/cloze-pick.md,
 * Realia gap), drawn as Realia Read draws it: a line tap says the line, and no line is ever an answer. The same card
 * sits above the Cloze Pick sentence and above the Listen & Pick text prompt of its fallback, so the value can be
 * read either way. In the start bundle with the fallback; the Cloze Pick chunk reaches it from there.
 */
export function ClozeRealia({ realia, testID }: { realia: Realia; testID?: string }): ReactElement {
  const m = useMessages();
  const a11y = m.a11y.minigame;
  const romanizationMode = useRomanizationMode();
  const context = { romanizationMode };
  const lines = useMemo(() => lineViews(realia, undefined, startRealiaRead(0), { romanizationMode }, a11y), [realia, romanizationMode, a11y]);
  const title = titleView(realia, context);
  const say = (entryId: string): void => {
    const entry = realia.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const { text, audioRef } = lineSpeech(entry);
    void playPrompt({ text, kind: 'word', source: 'cloze-pick', ...(audioRef !== undefined ? { audioRef } : {}) });
  };
  return (
    <RealiaSheetView
      testID={testID}
      kind={sheetKind(realia)}
      title={title ? { ko: title.ko, romanization: title.romanization } : undefined}
      titleLabel={title?.label}
      lines={lines}
      accessibilityLabel={sheetSummary(realia, a11y)}
      lineHint={a11y.realia.lineHint}
      onPressLine={say}
    />
  );
}
