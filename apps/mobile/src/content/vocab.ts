import { flags } from '../config/flags';
import { createVocabCatalog } from '../logic/vocab/catalog';
import { VOCAB_ITEMS, VOCAB_TOPICS } from './__generated__/vocab';

// Draft topics reach the catalogue only in a dev build with `flags.vocabShowDrafts` on (F-VOC-001 section 3.7).
export const { vocabTopics, vocabTopic, topicItems, vocabItem, visibleItems } = createVocabCatalog(VOCAB_TOPICS, VOCAB_ITEMS, {
  showDrafts: flags.vocabShowDrafts,
});
export { localizedGloss, pictureKind, sameSense } from '../logic/vocab/catalog';
