import { createVocabCatalog } from '../logic/vocab/catalog';
import { VOCAB_ITEMS, VOCAB_TOPICS } from './__generated__/vocab';

// `showDrafts` stays false until F-VOC-003 PR C-3 registers `flags.vocabShowDrafts`.
export const { vocabTopics, vocabTopic, topicItems, vocabItem } = createVocabCatalog(VOCAB_TOPICS, VOCAB_ITEMS);
export { localizedGloss, pictureKind, sameSense } from '../logic/vocab/catalog';
