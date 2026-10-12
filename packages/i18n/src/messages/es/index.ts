import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleMsgs } from './console';
import { landing } from './landing';
import { learner } from './learner';
import { report } from './report';

/**
 * Spanish overlay (F-I18N-001 PR 15): neutral Latin-American Spanish, informal "tú", for any age. The
 * Privacy Policy and Terms stay English-authoritative (decision L10); every other key is translated.
 */
export const es = { common, a11y, learner, caregiver, console: consoleMsgs, landing, report } satisfies DeepPartial<Messages>;
