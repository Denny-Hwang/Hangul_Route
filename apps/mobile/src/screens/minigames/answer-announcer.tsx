import { KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Platform, Text, View } from 'react-native';
import type { AnswerSegment } from '../../logic/answer-feedback';
import { srOnly } from './sr-only';

/**
 * The answer announcer (F-A11Y-001 §3.3; design/components/AnswerFeedback/spec.md, "The answer announcer"): one hidden
 * polite region per game screen, mounted for the screen's whole life and empty until the first result. Behaviour only,
 * no look. Its line comes from `useAnswerAnnouncement` (`use-answer-announcement.ts`).
 *
 * - `accessibilityLiveRegion="polite"` and `aria-live="polite"`; never `assertive`, never focusable.
 * - iOS: hidden from VoiceOver, because its channel there is one queued announcement call per result.
 * - Android and the web: the region is the channel; it can be reached by swiping and is emptied each round.
 * - One `Text` per segment. A new result gets a new key, so the same line twice in a row is read again.
 */

/** What the announcer shows: the line's segments, and a key that changes with every result and every clear. */
export interface AnnouncerLine {
  segments: readonly AnswerSegment[];
  key: number;
}

export const EMPTY_ANNOUNCER_LINE: AnnouncerLine = { segments: [], key: 0 };

export interface AnswerAnnouncerProps {
  line: AnnouncerLine;
  testID?: string;
}

export function AnswerAnnouncer({ line, testID = 'answer-announcer' }: AnswerAnnouncerProps): ReactElement {
  const ios = Platform.OS === 'ios';
  return (
    <View
      testID={testID}
      style={srOnly}
      accessibilityLiveRegion="polite"
      {...{ 'aria-live': 'polite' }}
      {...(ios ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const } : {})}
    >
      {line.segments.map((segment, i) => (
        <Text key={`${line.key}-${i}`} {...KOREAN_LINE_BREAK} {...(segment.lang ? { lang: segment.lang, accessibilityLanguage: segment.lang } : {})}>
          {segment.text}
        </Text>
      ))}
    </View>
  );
}
