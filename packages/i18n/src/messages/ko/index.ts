import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { consoleMsgs } from './console';
import { learner } from './learner';

/**
 * Korean overlay: drafts for the owner's review only (F-BILL-002 B-6 billing and Plan screen keys); the
 * rest falls back to English until the owner-reviewed translation PR (F-I18N-001 PR 16).
 */
export const ko = { a11y, learner, caregiver, console: consoleMsgs } satisfies DeepPartial<Messages>;
