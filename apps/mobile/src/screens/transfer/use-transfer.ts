import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useOpenMoveWith, type MoveTarget } from './use-transfer-facts';

export * from './use-transfer-facts';

/**
 * Opens a move screen: directly only on a self-only device with no PIN, otherwise through the PIN screen
 * every time (`moveEntry`: the card and the Home line are learner surfaces, so a lingering grown-up session
 * never carries a move). A managed device with no PIN gets the existing PIN setup first (`initialPinMode`),
 * then the screen (D24).
 */
export function useOpenMove(): (target: MoveTarget) => void {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return useOpenMoveWith(navigation);
}
