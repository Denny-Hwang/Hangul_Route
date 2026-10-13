import { CommonActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { notesReturnRoutes } from '../../logic/notes/screens';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Leave a note for My notes in one navigation action (Put this note away; Done on the report sheet
 * from the note page): the note page and what sits over it go, the My notes below is reused (never
 * stacked twice), and `params` reach it so it can say what just happened.
 */
export function backToNotes(navigation: Pick<NavigationProp<ParamListBase>, 'dispatch'>, params?: RootStackParamList['Notes']): void {
  navigation.dispatch((state) => {
    const routes = notesReturnRoutes(state.routes.slice(0, state.index + 1));
    const last = routes.length - 1;
    return CommonActions.reset({
      ...state,
      routes: routes.map((route, i) => (i === last ? { ...route, params } : route)),
      index: last,
    });
  });
}
