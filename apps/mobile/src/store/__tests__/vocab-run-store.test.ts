import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordVocab = vi.fn();
vi.mock('../progress-store', () => ({
  useProgressStore: { getState: () => ({ recordVocab }) },
}));

const { useVocabRunStore, vocabHost } = await import('../vocab-run-store');

const NOW = new Date('2026-10-11T12:00:00.000Z');

describe('vocab-run-store (F-VOC-003 section 3.2, section 3.9)', () => {
  beforeEach(() => {
    recordVocab.mockReset();
    useVocabRunStore.getState().reset();
  });

  it('begin sets the run and reset clears it', () => {
    useVocabRunStore.getState().begin('p1', 'food', 'match');
    expect(useVocabRunStore.getState()).toMatchObject({ profileId: 'p1', topicKey: 'food', mode: 'match', answers: [] });
    useVocabRunStore.getState().reset();
    expect(useVocabRunStore.getState()).toMatchObject({ profileId: null, topicKey: null, mode: null, answers: [] });
  });

  it('is the vocab MinigameHost', () => {
    expect(vocabHost.mode).toBe('vocab');
  });

  it('buffers the first answer per round key and flushes answers and one session once', () => {
    useVocabRunStore.getState().begin('p1', 'food', 'match');
    vocabHost.answer(0, false, { itemId: 'vocab:sagwa-apple' });
    vocabHost.answer(0, true, { itemId: 'vocab:sagwa-apple' });
    vocabHost.answer('r1', true, { itemId: 'vocab:bap-rice' });
    expect(useVocabRunStore.getState().answers).toEqual([
      { key: '0', id: 'vocab:sagwa-apple', correct: false },
      { key: 'r1', id: 'vocab:bap-rice', correct: true },
    ]);
    expect(recordVocab).not.toHaveBeenCalled();

    useVocabRunStore.getState().complete(NOW);
    expect(recordVocab).toHaveBeenCalledTimes(1);
    expect(recordVocab).toHaveBeenCalledWith(
      'p1',
      [
        { type: 'answer', id: 'vocab:sagwa-apple', correct: false, source: 'match' },
        { type: 'answer', id: 'vocab:bap-rice', correct: true, source: 'match' },
        { type: 'session', topicKey: 'food', kind: 'match' },
      ],
      NOW,
    );
    vocabHost.complete();
    expect(recordVocab).toHaveBeenCalledTimes(1);
    expect(useVocabRunStore.getState().answers).toEqual([]);
  });

  it('the host complete uses the current clock', () => {
    useVocabRunStore.getState().begin('p1', 'food', 'match');
    vocabHost.answer(0, true, { itemId: 'vocab:a' });
    vocabHost.complete();
    expect(recordVocab).toHaveBeenCalledTimes(1);
    expect(recordVocab.mock.calls[0]![1]).toEqual([
      { type: 'answer', id: 'vocab:a', correct: true, source: 'match' },
      { type: 'session', topicKey: 'food', kind: 'match' },
    ]);
    expect(recordVocab.mock.calls[0]![2]).toBeInstanceOf(Date);
  });

  it('a match run with no answers (left early) records no session and ends the run', () => {
    useVocabRunStore.getState().begin('p1', 'food', 'match');
    useVocabRunStore.getState().complete(NOW);
    expect(recordVocab).not.toHaveBeenCalled();
    expect(useVocabRunStore.getState()).toMatchObject({ profileId: null, mode: null, answers: [] });
  });

  it('writes before it clears, and still ends the run when the write throws', () => {
    useVocabRunStore.getState().begin('p1', 'food', 'match');
    vocabHost.answer(0, true, { itemId: 'vocab:a' });
    let answersDuringWrite: unknown = null;
    recordVocab.mockImplementationOnce(() => {
      answersDuringWrite = useVocabRunStore.getState().answers;
      throw new Error('storage');
    });
    expect(() => useVocabRunStore.getState().complete(NOW)).toThrow('storage');
    expect(answersDuringWrite).toEqual([{ key: '0', id: 'vocab:a', correct: true }]);
    expect(useVocabRunStore.getState()).toMatchObject({ profileId: null, mode: null, answers: [] });
    useVocabRunStore.getState().complete(NOW);
    expect(recordVocab).toHaveBeenCalledTimes(1);
  });

  it('ignores an answer without an item id, outside a match run, or after completion', () => {
    vocabHost.answer(0, true, { itemId: 'vocab:a' });
    useVocabRunStore.getState().begin('p1', 'food', 'cards');
    vocabHost.answer(0, true, { itemId: 'vocab:a' });
    expect(useVocabRunStore.getState().answers).toEqual([]);
    useVocabRunStore.getState().begin('p1', 'food', 'match');
    vocabHost.answer(0, true);
    vocabHost.answer(1, true, {});
    expect(useVocabRunStore.getState().answers).toEqual([]);
    useVocabRunStore.getState().complete(NOW);
    vocabHost.answer(2, true, { itemId: 'vocab:a' });
    expect(useVocabRunStore.getState().answers).toEqual([]);
  });

  it('complete writes nothing without a match run', () => {
    useVocabRunStore.getState().complete(NOW);
    useVocabRunStore.getState().begin('p1', 'food', 'speed');
    useVocabRunStore.getState().complete(NOW);
    expect(recordVocab).not.toHaveBeenCalled();
  });

  it('a new begin starts a fresh buffer', () => {
    const { begin } = useVocabRunStore.getState();
    begin('p1', 'food', 'match');
    vocabHost.answer(0, true, { itemId: 'vocab:a' });
    begin('p2', 'animals', 'match');
    expect(useVocabRunStore.getState()).toMatchObject({ profileId: 'p2', topicKey: 'animals', answers: [] });
    vocabHost.answer(0, false, { itemId: 'vocab:b' });
    useVocabRunStore.getState().complete(NOW);
    expect(recordVocab).toHaveBeenCalledWith(
      'p2',
      [
        { type: 'answer', id: 'vocab:b', correct: false, source: 'match' },
        { type: 'session', topicKey: 'animals', kind: 'match' },
      ],
      NOW,
    );
  });
});
