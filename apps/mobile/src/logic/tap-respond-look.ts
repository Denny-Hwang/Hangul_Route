/**
 * What a Tap Respond turn draws, before and after the right reply (AMENDMENTS-STAGE1-DECODING-CHECK section 3.3, row DC-1c).
 * Pure: the game and the romanization-only bot read the same view, so what the bot is shown is what the screen draws.
 *
 * Tap Respond is mounted without a host (it records through the run store itself), so a quest Check passes it a `hold`
 * boolean. While a Check's turn is open (no right reply yet; a missed reply stays locked and does not end it) the NPC line's
 * romanization and every reply's romanization and meaning are held: a held line keeps its room, draws nothing and is off the
 * accessibility tree (the screen-reader names keep the romanization). The NPC line's meaning is the stimulus the replies are
 * chosen from and stays; the line is also said aloud. A right reply ends the hold and every line shows. Practice never holds.
 */
export interface TapRespondTurnInput {
  npcKo: string;
  npcRomanization?: string;
  npcEn: string;
  options: ReadonlyArray<{ ko: string; romanization?: string; en: string }>;
}

export interface TapRespondTurnView {
  /** The turn's romanization lines are held while the turn is open. */
  held: boolean;
  npc: { ko: string; en: string; romanization: string; romanizationHeld: string };
  options: Array<{ ko: string; romanization: string; romanizationHeld: boolean; gloss: string; glossHeld: boolean }>;
}

export function tapRespondTurnView(turn: TapRespondTurnInput, { hold, answered }: { hold: boolean; answered: boolean }): TapRespondTurnView {
  const held = hold && !answered;
  const npcRomanization = turn.npcRomanization ?? '';
  return {
    held,
    npc: { ko: turn.npcKo, en: turn.npcEn, romanization: held ? '' : npcRomanization, romanizationHeld: held ? npcRomanization : '' },
    options: turn.options.map((option) => ({
      ko: option.ko,
      romanization: held ? '' : (option.romanization ?? ''),
      romanizationHeld: held && (option.romanization ?? '') !== '',
      gloss: held ? '' : option.en,
      glossHeld: held && option.en.trim() !== '',
    })),
  };
}
