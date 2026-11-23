import { TAB_SCREEN_EDGES } from '@hangul-route/design-system';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentType, ReactElement } from 'react';
import { LearnerReadFailedScreen, useLearnerReadHeld } from '../screens/system/LearnerReadGate';
import type { RootStackParamList } from './types';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS owner decision OD-DP6 (row DP-1e): a learner tab (Home, Route, Journey, Library) that holds a learner whose
 * progress could not be read: the learner variant on the tab's edges, Choose another learner opening the manual chooser;
 * otherwise the tab's own screen, which mounts only once the read worked. A tab that is not in front holds the learner
 * too, and its title takes the screen reader's focus only when the tab comes to the front (`focusTitle`).
 */
export function learnerReadGated<P extends object>(Tab: ComponentType<P>): ComponentType<P> {
  function LearnerReadGated(props: P): ReactElement {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const focused = useIsFocused();
    const held = useLearnerReadHeld();
    // A new screen (and its first focus) for each learner held here.
    if (held !== null) return <LearnerReadFailedScreen key={held} profileId={held} edges={TAB_SCREEN_EDGES} focusTitle={focused} onChooseAnother={() => navigation.navigate('WhoIsUsing', { trigger: 'manual' })} />;
    return <Tab {...props} />;
  }
  LearnerReadGated.displayName = `LearnerReadGated(${Tab.displayName ?? Tab.name ?? 'Tab'})`;
  return LearnerReadGated;
}
