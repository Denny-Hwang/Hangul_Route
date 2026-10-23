import { KoreanText } from '@hangul-route/design-system';
import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { clozeFallbackScope, labelSentence, spokenGap } from '../../logic/cloze-pick/round';
import type { ClozePickStepProps } from './cloze-pick-entry';
import { ClozePickGame } from './ClozePickGame';
import { ClozeRealia } from './ClozeRealia';
import { ListenPickGame } from './ListenPickGame';

/**
 * A `cloze-pick` step once its chunk is in (F-CURR-002 row CM-30; `./cloze-pick-entry.tsx` decides `on`): the game,
 * or with `game.cloze-pick` off its fallback round (design/wireframes/minigame/cloze-pick.md, board C3).
 */
export function ClozePickStepBody({ on, onRendered, ...props }: ClozePickStepProps & { on: boolean }): ReactElement {
  useEffect(() => {
    onRendered?.(on ? 'cloze-pick' : 'listen-pick');
  }, [on, onRendered]);
  return on ? <ClozePickGame {...props} /> : <ClozePickFallback {...props} />;
}

/**
 * The fallback: the shipped Listen & Pick in its text prompt mode (no speaker, no sound before the answer), under the
 * Cloze heading, with the sentence, its gap and its meaning as the prompt and a value gap's card above it. The same
 * tiles, answer and scoring; the voice says the completed sentence once after the right tile.
 */
export function ClozePickFallback({ scope, host, onBack }: Omit<ClozePickStepProps, 'onRendered'>): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const a11y = m.a11y.minigame.clozePick;
  const fallback = useMemo(() => clozeFallbackScope(scope), [scope]);
  const realia = scope.clozePick?.realia;
  // A value gap's round shows its card above the prompt; the other rounds do not.
  const valueIds = new Set((scope.clozePick?.rounds ?? []).filter((r) => r.gapKind === 'value').map((r) => r.id));
  return (
    <ListenPickGame
      scope={fallback}
      host={host}
      onBack={onBack}
      textPrompt={{
        heading: copy.clozePick.heading,
        missLine: copy.clozePick.miss,
        prompt: (round, focusRef) => (
          <>
            {valueIds.has(round.id) && realia ? <ClozeRealia realia={realia} testID="cloze-pick-fallback-realia" /> : null}
            <View
              ref={focusRef}
              accessible
              accessibilityLabel={a11y.sentence(labelSentence(round.prompt.romanization, a11y.blank), spokenGap(round.prompt.en, a11y.blank))}
              style={{ alignItems: 'center' }}
              testID="listen-pick-text-prompt"
            >
              <KoreanText ko={round.prompt.ko} romanization={round.prompt.romanization} gloss={round.prompt.en} size="md" testID="listen-pick-prompt-text" />
            </View>
          </>
        ),
      }}
    />
  );
}
