import { Button, spacing } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { View } from 'react-native';

/**
 * [QB] The bottom buttons of a quest step (AMENDMENTS-QUEST-SOUND-BACK QB-1, QB-2): the step's main button, and
 * Previous beside it when there is a page or a step to show again.
 * Design: design/screens/quest-previous/spec.md (mock/quest-previous.html), wireframes quest/player.md and
 * quest/discover.md, section "[QB] Previous".
 *
 * Without `onPrevious` the main button is drawn alone, exactly as the step drew it before. With it: one row, Previous
 * on the left with one share and the main button on the right with two, both `lg` (80 high). When the two cannot
 * share a line (Largest text on a narrow window) the row wraps upward, so the main button is the first line; neither
 * button is ever narrower than the window allows, a long label wraps inside its button instead.
 */
export interface StepActionsProps {
  main: {
    label: string;
    onPress: () => void;
    /** The button's size when it stands alone; beside Previous it is `lg`. */
    size: 'lg' | 'hero';
    disabled?: boolean;
    testID?: string;
  };
  /** `learner.quest.previous.cta`. */
  previousLabel: string;
  /** Absent: no Previous (the first page of the first step). */
  onPrevious?: () => void;
}

export const PREVIOUS_TEST_ID = 'quest-previous';

export function StepActions({ main, previousLabel, onPrevious }: StepActionsProps): ReactElement {
  if (onPrevious === undefined) {
    return <Button label={main.label} tone="primary" size={main.size} fullWidth disabled={main.disabled} onPress={main.onPress} testID={main.testID} />;
  }
  return (
    <View testID="quest-step-actions" style={{ flexDirection: 'row', flexWrap: 'wrap-reverse', gap: spacing.sm }}>
      <View style={{ flexGrow: 1, flexShrink: 1, maxWidth: '100%' }}>
        <Button label={previousLabel} tone="secondary" size="lg" fullWidth onPress={onPrevious} testID={PREVIOUS_TEST_ID} />
      </View>
      <View style={{ flexGrow: 2, flexShrink: 1, maxWidth: '100%' }}>
        <Button label={main.label} tone="primary" size="lg" fullWidth disabled={main.disabled} onPress={main.onPress} testID={main.testID} />
      </View>
    </View>
  );
}
