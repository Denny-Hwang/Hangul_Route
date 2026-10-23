import type { WriteFrameRound } from '@hangul-route/content-schema';
import {
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Icon,
  Spacer,
  borderWidth,
  colors,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
  useTypeScale,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, Ref } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { pageLine, storyLines, type StoryLine } from '../../logic/my-story/page';
import type { WrittenFrame } from '../../logic/write-frame/flow';
import { playPrompt } from '../../platform/audio';
import { focusForScreenReader } from '../../platform/screen-reader';
import type { MinigameHost } from './host';
import { koreanSpeech, type Focusable } from './TypeHangulGame';
import { WriteFrameGame, type WriteFrameChain } from './WriteFrameGame';

/**
 * My Story (F-CURR-002 §7.1 F8, OD-13; row CM-38; design/wireframes/minigame/my-story.md,
 * design/screens/minigame-variety/ board Y): 3-5 Write Frame rounds in a row make a short text. Each frame is played
 * by the shipped Write Frame (pick a word from the bank, any pick is right, then write it), and the sentences gather
 * above the next frame as "My story so far". The finished text is shown once as "My page", with the not-kept line
 * above it and no save, share, copy, download or print control, and it is gone when the step ends.
 *
 * The data rule (OD-13, test P-1 extended): the picks and the sentences live only in Write Frame's React state; this
 * component draws them from there and keeps none of them. Nothing here writes a store, storage, navigation params,
 * telemetry, crash reports or a log line; the host hears only each frame's index, whether it was right and the frame
 * id, the same whichever word was picked. Its only exit is the host's `complete()` (Done) or Skip.
 *
 * The device voice says each sentence once when it is written and again on Hear; the sentence is made only of
 * reviewed bank words (no free text), and a voice that cannot play shows the status panel under that sentence.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** The status panel's place: the finished sentence (`said`), or a sentence of My page by its index. */
type SoundAt = 'said' | number;

/** The audio source of My Story's sentences (telemetry `audio.fallback_shown`). */
export const MY_STORY_AUDIO_SOURCE = 'my-story';

export function MyStoryGame({ scope, host, onBack }: Props): ReactElement {
  const m = useMessages();
  const frames = useMemo(() => scope.myStory?.frames ?? [], [scope]);
  // Write Frame plays the frames as they are (each frame is a Write Frame round).
  const writeScope = useMemo<MinigameScope>(() => ({ kind: 'write-frame', rounds: frames.length, writeFrame: { rounds: frames as WriteFrameRound[] } }), [frames]);

  const slot = usePromptSlot({ source: MY_STORY_AUDIO_SOURCE, textOnScreen: true });
  const { play: slotPlay, reset: slotReset } = slot;
  const [soundAt, setSoundAt] = useState<SoundAt | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const lastSaid = useRef<string | null>(null);

  const say = (at: SoundAt, line: StoryLine): void => {
    slotReset();
    setSoundAt(at);
    lastSaid.current = line.ko;
    void slotPlay(() => playPrompt({ text: line.ko, kind: 'sentence', source: MY_STORY_AUDIO_SOURCE }));
  };
  const statusPanel = (at: SoundAt, testID: string): ReactElement => (
    <PromptPanel
      variant="status"
      view={soundAt === at ? slot.view : { ...slot.view, statusShown: false }}
      onAction={(action) =>
        slot.act(action, () => {
          const text = lastSaid.current;
          if (text !== null) void slotPlay(() => playPrompt({ text, kind: 'sentence', source: MY_STORY_AUDIO_SOURCE }));
        })
      }
      onHelp={() => setHelpOpen(true)}
      testID={testID}
    />
  );

  const chain: WriteFrameChain = {
    heading: m.learner.minigame.myStory.heading,
    soFar: (written, writing) => (
      <SoFar
        lines={storyLines(frames, written)}
        folded={writing && !open}
        onOpen={() => setOpen(true)}
        onNewFrame={() => setOpen(false)}
      />
    ),
    onSentence: (entry: WrittenFrame) => {
      const line = storyLines(frames, [entry])[0];
      if (line) say('said', line);
    },
    sentenceExtra: statusPanel('said', 'my-story-said-sound'),
    page: (written, finish) => (
      <MyPage
        lines={storyLines(frames, written)}
        complete={pageLine(written.length, frames.length) === 'done'}
        onHear={(line) => say(line.index, line)}
        statusFor={(line) => statusPanel(line.index, `my-story-sound-${line.index}`)}
        onDone={finish}
      />
    ),
  };

  return (
    <>
      <WriteFrameGame scope={writeScope} host={host} onBack={onBack} chain={chain} />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

interface SoFarProps {
  lines: readonly StoryLine[];
  /** While the learner writes: one line ("2 lines so far") that opens the list on a tap. */
  folded: boolean;
  onOpen: () => void;
  /** A new frame starts folded again. */
  onNewFrame: () => void;
}

/** "My story so far": read-only, no button on a line, so a stray tap cannot leave the current frame. */
function SoFar({ lines, folded, onOpen, onNewFrame }: SoFarProps): ReactElement | null {
  const m = useMessages();
  const textScale = useTypeScale();
  const count = lines.length;
  const newFrame = useRef(onNewFrame);
  newFrame.current = onNewFrame;
  useEffect(() => newFrame.current(), [count]);
  if (count === 0) return null;
  const box = {
    backgroundColor: colors.surface.sunken,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  } as const;
  if (folded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={m.a11y.minigame.myStory.soFar(count)}
        accessibilityState={{ expanded: false }}
        aria-expanded={false}
        onPress={onOpen}
        testID="my-story-so-far-folded"
        style={({ pressed }) => ({ ...box, minHeight: touchTarget.min, justifyContent: 'center', borderWidth: borderWidth.thin, borderColor: pressed ? colors.border.focus : colors.border.subtle })}
      >
        <Caption tone="secondary" weight="bold">
          {m.learner.minigame.myStory.soFarFolded(count)}
        </Caption>
      </Pressable>
    );
  }
  return (
    <View style={box} testID="my-story-so-far">
      <Caption tone="secondary" weight="bold">
        {m.learner.minigame.myStory.soFar}
      </Caption>
      <View role="list" aria-label={m.a11y.minigame.myStory.soFar(count)} style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {lines.map((line) => (
          <View
            key={line.index}
            role="listitem"
            accessible
            accessibilityLabel={m.a11y.koreanItem({ ko: line.ko, romanization: line.romanization, gloss: line.gloss })}
            testID="my-story-so-far-line"
          >
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {line.ko}
            </Text>
            <Caption tone="secondary">{line.romanization}</Caption>
            <Caption tone="secondary">{line.gloss}</Caption>
          </View>
        ))}
      </View>
    </View>
  );
}

interface MyPageProps {
  lines: readonly StoryLine[];
  /** Every frame of the chain was written ("You wrote a whole story!"); else the story so far (after Skip). */
  complete: boolean;
  onHear: (line: StoryLine) => void;
  statusFor: (line: StoryLine) => ReactElement;
  onDone: () => void;
}

/** My page (board Y1): the title, the not-kept line above the text, each sentence with its Hear button, Hoya, Done. */
function MyPage({ lines, complete, onHear, statusFor, onDone }: MyPageProps): ReactElement {
  const m = useMessages();
  const textScale = useTypeScale();
  const w = m.learner.minigame.writeFrame;
  const titleRef = useRef<Focusable | null>(null);
  useEffect(() => {
    const node = titleRef.current;
    if (node === null) return;
    if (Platform.OS === 'web') node.focus?.();
    else focusForScreenReader(node);
  }, []);
  return (
    <View testID="my-story-page">
      {/* Focus lands on the title; on the web the Heading is the heading itself (one heading, not two). */}
      <View ref={titleRef as Ref<View>} accessible focusable accessibilityRole={Platform.OS === 'web' ? undefined : 'header'}>
        <Heading level="title">{w.myPage.title}</Heading>
      </View>
      <Spacer size="xs" />
      {/* The not-kept line is read right after the title, above the text (D8). */}
      <Caption tone="secondary" testID="my-story-not-kept">
        {w.myPage.notKept}
      </Caption>
      <Spacer size="md" />
      <View
        testID="my-story-page-sheet"
        style={{
          backgroundColor: colors.surface.paper,
          borderRadius: radii.lg,
          borderWidth: borderWidth.thin,
          borderColor: colors.border.subtle,
          padding: spacing.lg,
          gap: spacing.lg,
          ...shadows.card,
        }}
      >
        {lines.map((line) => (
          <View key={line.index} role="group" style={{ gap: spacing.xxs }} testID="my-story-page-line">
            <View accessible accessibilityLabel={m.a11y.koreanItem({ ko: line.ko, romanization: line.romanization, gloss: line.gloss })} style={{ gap: spacing.xxs }}>
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                {line.ko}
              </Text>
              <Caption tone="secondary">{line.romanization}</Caption>
              <Caption tone="secondary">{line.gloss}</Caption>
            </View>
            <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
              <Button
                label={m.learner.audio.hearIt.cta}
                tone="secondary"
                size="sm"
                leading={<Icon name="speaker" size={spacing.lg} color={colors.text.onSecondary} />}
                accessibilityLabel={m.a11y.minigame.hear(line.romanization)}
                onPress={() => onHear(line)}
                testID={`my-story-hear-${line.index}`}
              />
            </View>
            {statusFor(line)}
          </View>
        ))}
      </View>
      <Spacer size="md" />
      <HoyaBubble tone="cheering" message={complete ? m.learner.minigame.myStory.done : m.learner.minigame.myStory.donePartial} testID="my-story-hoya" />
      <Spacer size="lg" />
      <Button label={m.common.buttons.done} tone="primary" size="lg" fullWidth onPress={onDone} testID="my-story-done" />
    </View>
  );
}
