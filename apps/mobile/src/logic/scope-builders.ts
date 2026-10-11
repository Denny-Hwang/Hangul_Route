import {
  ListenPickRoundSchema,
  PicWordRoundSchema,
  decomposeSyllable,
  romanizeWord,
  type KoText,
  type ListenPickRound,
  type PicWordPair,
  type PicWordRound,
  type PictureRef,
} from '@hangul-route/content-schema';
import { cardById } from '../content/heritage-cards';
import { findJamo } from '../content/jamo';
import { checkOptionIds } from './stage1/confusables';
import { spokenFormFor } from './stage1/spoken';

/**
 * Scope builders (F-QUEST-002 §3.7): short, validated constructors for the
 * rounds of Listen & Pick (`lp.*`) and the board of Pic-Word Match (`pw`), so a
 * scope entry stays one line per round. Every builder puts the answer FIRST;
 * the game shuffles per mount (`shuffleOptions`). A builder throws on bad
 * input, which the content test turns into a failing test, never a dead round.
 * Re-exported from `minigame-config.ts`.
 */

function romanizeOne(syllable: string): string {
  const out = romanizeWord(syllable);
  if (out === null) throw new Error(`Cannot romanize "${syllable}"`);
  return out;
}

function syllableText(ko: string, gloss?: string): KoText {
  if (!decomposeSyllable(ko)) throw new Error(`"${ko}" is not one Hangul syllable`);
  const romanization = romanizeOne(ko);
  return { ko, romanization, en: gloss ?? `the syllable ${romanization}` };
}

const parseRound = (round: ListenPickRound): ListenPickRound => ListenPickRoundSchema.parse(round);

export const lp = {
  /** Sound -> written symbol (a consonant or vowel). Options: the symbol and its taught confusables. */
  sym(jamoId: string, taughtIds: readonly string[]): ListenPickRound {
    const jamo = findJamo(jamoId);
    const spoken = jamo && spokenFormFor(jamo);
    if (!jamo || !spoken) throw new Error(`Unknown symbol ${jamoId}`);
    const options = checkOptionIds(jamoId, taughtIds).map((id) => {
      const option = findJamo(id)!;
      return { id, text: { ko: option.char, romanization: option.romanization, en: `the letter ${option.nameEn}` } };
    });
    return parseRound({
      id: `lp:sym:${jamoId}`,
      prompt: { ko: spoken.ko, romanization: spoken.romanization, en: `the letter ${jamo.nameEn}` },
      options,
      answerId: jamoId,
    });
  },

  /**
   * Syllable -> written syllable. Every option is one block with the same
   * initial and vowel as `syllable`, so they differ only in the final.
   * `gloss` is the target's meaning, when it has one.
   */
  syl(syllable: string, distractors: readonly string[], gloss?: string): ListenPickRound {
    const target = decomposeSyllable(syllable);
    if (!target) throw new Error(`"${syllable}" is not one Hangul syllable`);
    for (const d of distractors) {
      const parts = decomposeSyllable(d);
      if (!parts) throw new Error(`"${d}" is not one Hangul syllable`);
      if (parts.initial !== target.initial || parts.medial !== target.medial) {
        throw new Error(`"${d}" must differ from "${syllable}" only in the final`);
      }
    }
    const prompt = syllableText(syllable, gloss);
    return parseRound({
      id: `lp:syl:${syllable}`,
      prompt,
      options: [
        { id: syllable, text: prompt },
        ...distractors.map((d) => ({ id: d, text: syllableText(d) })),
      ],
      answerId: syllable,
    });
  },

  /** Word -> written word. */
  word(target: KoText, distractors: readonly KoText[]): ListenPickRound {
    return parseRound({
      id: `lp:word:${target.ko}`,
      prompt: target,
      options: [target, ...distractors].map((text) => ({ id: text.ko, text })),
      answerId: target.ko,
    });
  },

  /**
   * Word -> picture. A card picture is labelled with its card title; any other
   * picture needs `{ pictureRef, labelEn }`. The first picture is the answer.
   */
  pic(
    target: KoText,
    pictures: ReadonlyArray<PictureRef | { pictureRef: PictureRef; labelEn?: string }>,
  ): ListenPickRound {
    const options = pictures.map((p) => {
      const pictureRef = typeof p === 'string' ? p : p.pictureRef;
      const labelEn = (typeof p === 'string' ? undefined : p.labelEn) ?? cardById(pictureRef)?.titleEn;
      if (!labelEn) throw new Error(`Picture ${pictureRef} needs a label`);
      return { id: pictureRef, pictureRef, labelEn };
    });
    return parseRound({
      id: `lp:pic:${target.ko}`,
      prompt: target,
      options,
      answerId: options[0]?.id ?? '',
    });
  },
};

export interface PicWordPairInput {
  /** Defaults to the word's romanization. */
  id?: string;
  word: KoText;
  picture?: PictureRef;
}

/** One Pic-Word Match board of 3-5 pairs. A scope holds `{ boards: [pw(...)] }`. */
export function pw(pairs: readonly PicWordPairInput[]): PicWordRound {
  const board: PicWordPair[] = pairs.map((p) => ({
    id: p.id ?? p.word.romanization,
    word: p.word,
    ...(p.picture ? { pictureRef: p.picture } : {}),
  }));
  return PicWordRoundSchema.parse({ pairs: board });
}
