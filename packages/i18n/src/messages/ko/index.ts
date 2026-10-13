import type { DeepPartial, Messages } from '../../types';
import { a11y } from './a11y';
import { caregiver } from './caregiver';
import { common } from './common';
import { consoleMsgs } from './console';
import { landing } from './landing';
import { learner } from './learner';
import { report } from './report';

/**
 * Korean overlay (F-I18N-001 PR 16): 해요체 on every app surface, 합니다체 only on legal and pricing text (§3.10
 * style guide), for any age. Every key is translated except the Privacy Policy and Terms, which stay
 * English-authoritative (decision L10). A name or any other argument never takes a particle that changes with the
 * final consonant; taught Korean is never typed into a message (it arrives as an argument or is drawn by
 * `KoreanText`).
 */
export const ko = { common, a11y, learner, caregiver, console: consoleMsgs, landing, report } satisfies DeepPartial<Messages>;
