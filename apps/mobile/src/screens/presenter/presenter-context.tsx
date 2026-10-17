import { KOREAN_LANGUAGE, colors, presenter, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { Messages, UiLocale } from '@hangul-route/i18n';
import React, { createContext, useContext } from 'react';
import { Text, type TextStyle } from 'react-native';
import { stageText } from '../../logic/lecture/stage-scale';
import { taughtKoreanFont } from '../../platform/presenter-font';
import { TEXT_FLOOR } from './stage-metrics';

/**
 * What every presenter component reads (F-TCH-004 PR 6): the dictionary of the presenter locale
 * (the deck's `options.uiLocale`, else the device locale; never a learner profile's), the stage
 * unit (window pixels per stage unit) and whether motion is reduced.
 */
export interface PresenterView {
  messages: Messages;
  locale: UiLocale;
  /** Window pixels per stage unit (`stageScale` on the stage box). */
  unit: number;
  reducedMotion: boolean;
  /** The browser blocked the last sound (a long idle): the speaker reads "Tap to hear" (section 3.7). */
  soundBlocked?: boolean;
  /** A phone window: a control on the stage floors at `touchTarget.min`, not `touchTarget.hero` (F-TCH-004 section 3.6 phone exception). */
  phone?: boolean;
}

/** The smallest a control drawn on the stage may be: `touchTarget.hero`, or `touchTarget.min` in a phone window. */
export function useStageControlFloor(): number {
  const { phone } = usePresenterView();
  return phone ? touchTarget.min : touchTarget.hero;
}

const PresenterViewContext = createContext<PresenterView | null>(null);

export function PresenterViewProvider({ value, children }: { value: PresenterView; children: React.ReactNode }): React.ReactElement {
  return <PresenterViewContext.Provider value={value}>{children}</PresenterViewContext.Provider>;
}

export function usePresenterView(): PresenterView {
  const view = useContext(PresenterViewContext);
  if (view === null) throw new Error('usePresenterView outside PresenterViewProvider');
  return view;
}

/** Stage text size in pixels for `n` units, never below the body floor (README D2). */
export function useStageText(): (n: number) => number {
  const { unit } = usePresenterView();
  return (n) => stageText(unit, n, TEXT_FLOOR);
}

// Speech language for assistive tech and `lang="ko"` on the web node (as KoreanText does); spread
// so the web-only prop needs no type the native Text props lack.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/**
 * Taught Korean on the stage, in the presenter font on web (section 3.6), always `lang="ko"`. The
 * caller sizes it; romanization and gloss are the caller's own lines (UI text, system stack).
 */
export function TaughtKo({ children, size, style, testID }: { children: string; size: number; style?: TextStyle; testID?: string }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK}
      {...koreanSpeech}
      testID={testID}
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * typography.leading.tight),
          fontWeight: typography.weight.bold,
          color: colors.text.primary,
        },
        taughtKoreanFont(presenter.font),
        style,
      ]}
    >
      {children}
    </Text>
  );
}
