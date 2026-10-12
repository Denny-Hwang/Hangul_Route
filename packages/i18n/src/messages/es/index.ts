import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { consoleMsgs } from './console';
import { learner } from './learner';

/**
 * Spanish overlay: drafts for native review only (F-BILL-002 B-6 billing and Plan screen keys); the rest
 * falls back to English until the native-reviewed translation PR (F-I18N-001 PR 15).
 */
export const es = { a11y, learner, caregiver, console: consoleMsgs } satisfies DeepPartial<Messages>;
