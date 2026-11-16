import { createContext } from 'react';
import { DEFAULT_PROGRESS_LABELS, type ProgressLabels } from '../../labels';

/**
 * The localised name and value words of every `Progress` under it ([AU] AMENDMENTS-AUDIT-2026-11 AU-17d). The app
 * provides its UI language's pair once at its root; with no provider the English default is read.
 */
export const ProgressLabelsContext = createContext<ProgressLabels>(DEFAULT_PROGRESS_LABELS);
