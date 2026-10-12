'use client';

import { Fragment } from 'react';
import type { ConsoleWord, StudentWords } from '@/lib/console/vocab-words';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { aroundSlot } from '@/lib/i18n/slot';

/**
 * The word lines of the console roster (F-VOC-005 P-4, section 3.8, behaviour 14; wireframe
 * `design/wireframes/console/roster.md` "Words lines"): a student card reads
 * "Words: N collected · M strong" and, when the learner's device sent any,
 * "Words to revisit: 사과 sagwa (apple) · 눈 nun (eye)"; the week reads the class's words to
 * revisit together. Plain text in the card's existing type, no chart, no rate, no ranking. The
 * Hangul stays outside the message and is marked `lang="ko"`; its romanization and its gloss in
 * the UI language travel with it (CLAUDE.md section 1). Every other word comes from the dictionary.
 */

/** One word kept on one line, so a gloss never wraps away from its Hangul ("눈 nun / (eye)"); the list wraps between words. */
const WORD_STYLE = { whiteSpace: 'nowrap' } as const;

function Word({ word }: { word: ConsoleWord }): JSX.Element {
  const { messages: m } = useConsoleLocale();
  if (word.ko === null || word.gloss === null) return <span style={WORD_STYLE}>{word.romanization}</span>;
  return (
    <span style={WORD_STYLE}>
      <span lang="ko">{word.ko}</span> {m.console.space.wordGloss(word.romanization, word.gloss)}
    </span>
  );
}

/** Words joined by " · ", as the jamo lists of the same page. */
function WordList({ words }: { words: readonly ConsoleWord[] }): JSX.Element {
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={word.id}>
          {i > 0 ? ' · ' : null}
          <Word word={word} />
        </Fragment>
      ))}
    </>
  );
}

/** A roster card's word lines; nothing when the roster carries no `summary.vocab`. */
export function StudentWordsLines({ words }: { words: StudentWords | null }): JSX.Element | null {
  const { messages: m } = useConsoleLocale();
  if (!words) return null;
  const s = m.console.space.learner;
  const revisit = aroundSlot(s.wordsRevisit);
  return (
    <>
      <div data-testid="student-words">{s.words(words.collected, words.strong)}</div>
      {words.revisit.length ? (
        <div data-testid="student-words-revisit">
          {revisit.before}
          <WordList words={words.revisit} />
          {revisit.after}
        </div>
      ) : null}
    </>
  );
}

/** The week's line: the up-to-three words most often on the students' lists, never who has them. */
export function WeekWordsRevisit({ words }: { words: readonly ConsoleWord[] }): JSX.Element | null {
  const { messages: m } = useConsoleLocale();
  if (!words.length) return null;
  const line = aroundSlot(m.console.space.week.wordsRevisit);
  return (
    <li data-testid="week-words-revisit">
      {line.before}
      <WordList words={words} />
      {line.after}
    </li>
  );
}
