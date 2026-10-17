import { borderWidth, colors, presenter, radii, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import type { KoLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { countRows, endLetters, fitShown } from '../../../logic/lecture/shell';
import { CODE_PANEL, END_MAX_ROWS, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

type EndBody = Extract<Slide, { kind: 'end' }>;

/**
 * End slide (design/screens/presenter/slide-end.md, README D7): "Today we met" with the letters
 * and words of the lesson, each list at most two rows and then one "+ n more" pill (rows are
 * measured, not counted; glosses are never dropped, fewer items show instead), the practice line,
 * and the class code panel when the deck has one. [ Finish ] beside the title ends the lesson
 * without the Exit confirm (owner report 2026-10-16 item 3): the lesson is over, so there is nothing
 * to keep going with. Next on this slide moves focus to it. When the column still does not fit (a
 * phone's small stage, where text keeps its 18 px floor), the words drop to one row, then the letters.
 */
export function EndSlide({
  slide,
  joinCta,
  onFinish,
  finishRef,
}: {
  slide: EndBody;
  joinCta: string;
  onFinish?: () => void;
  finishRef?: React.Ref<View>;
}): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.slide.end;
  // Memoised: a new array each render would restart the row fit on every bar hide or show (no flashing, section 3.13).
  const letters = useMemo(() => endLetters(slide.letters), [slide.letters]);
  const title = size(presenter.size.title);
  const gap = units(unit, STAGE_GAP_INNER);
  // The column's room and what its content needs (the content grows past the room, never shrinks).
  const [rows, setRows] = useState({ letters: END_MAX_ROWS, words: END_MAX_ROWS });
  const [room, setRoom] = useState(0);
  const [content, setContent] = useState(0);
  // Judged only once each list has fitted its rows (until then it draws every item).
  const [lettersFit, setLettersFit] = useState(false);
  const [wordsFit, setWordsFit] = useState(false);
  const settled = (letters.length === 0 || lettersFit) && (slide.words.length === 0 || wordsFit);
  useEffect(() => setRows({ letters: END_MAX_ROWS, words: END_MAX_ROWS }), [unit, slide]);
  useEffect(() => {
    if (!settled || room <= 0 || content <= room + 1) return;
    // The list that drops a row fits again from every item: not settled until it reports.
    if (slide.words.length > 0 && rows.words > 1) {
      setWordsFit(false);
      setRows({ ...rows, words: rows.words - 1 });
    } else if (letters.length > 0 && rows.letters > 1) {
      setLettersFit(false);
      setRows({ ...rows, letters: rows.letters - 1 });
    }
  }, [settled, room, content, rows, slide.words.length, letters.length]);
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: units(unit, STAGE_GAP) }}>
      <View onLayout={(e) => setRoom(e.nativeEvent.layout.height)} style={{ flex: 1 }}>
        <View onLayout={(e) => setContent(e.nativeEvent.layout.height)} style={{ flexGrow: 1, gap, justifyContent: 'space-between' }}>
          <View style={{ gap }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap }}>
              <Text {...KOREAN_LINE_BREAK} role="heading" style={{ flexShrink: 1, fontSize: title, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(title * typography.leading.tight) }}>
                {m.title}
              </Text>
              {onFinish ? <FinishButton ref={finishRef} label={m.finish.cta} onPress={onFinish} /> : null}
            </View>
            {/* Keyed by their row limit: a new limit fits the list again from every item. */}
            {letters.length > 0 ? (
              <EndList key={`letters-${rows.letters}`} label={m.letters} items={letters} moreLabel={m.more} maxRows={rows.letters} onFit={setLettersFit} testID="presenter-end-letters" />
            ) : null}
            {slide.words.length > 0 ? (
              <EndList key={`words-${rows.words}`} label={m.words} items={slide.words} moreLabel={m.more} maxRows={rows.words} onFit={setWordsFit} testID="presenter-end-words" />
            ) : null}
          </View>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.prompt), fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {m.practice}
          </Text>
        </View>
      </View>
      {slide.classCode !== undefined ? <CodePanel code={slide.classCode} joinCta={joinCta} /> : null}
    </View>
  );
}

function EndList({
  label,
  items,
  moreLabel,
  maxRows,
  onFit,
  testID,
}: {
  label: string;
  items: readonly KoLine[];
  moreLabel: (n: number) => string;
  /** At most this many rows (`END_MAX_ROWS`, fewer when the column does not fit). */
  maxRows: number;
  /** Whether the list has fitted its rows (false while it is still dropping items). */
  onFit: (fit: boolean) => void;
  testID: string;
}): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const [shown, setShown] = useState(items.length);
  const boxes = useRef(new Map<number, { y: number; height: number }>());
  // A new window size or list starts again from every item (a new row limit remounts the list).
  useEffect(() => {
    boxes.current.clear();
    setShown(items.length);
    onFit(false);
  }, [unit, items, onFit]);
  const measured = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      boxes.current.set(index, { y, height });
      // Once every drawn child (label, items, pill) reported, count the rows and drop one item if they overflow.
      const children = shown + 1 + (shown < items.length ? 1 : 0);
      if (boxes.current.size < children) return;
      const rows = countRows([...boxes.current.values()]);
      const next = fitShown(shown, rows, maxRows);
      if (next !== shown) {
        boxes.current.clear();
        setShown(next);
        onFit(false);
      } else onFit(true);
    },
    [shown, items.length, maxRows, onFit],
  );
  const caption = size(presenter.size.caption);
  const body = size(presenter.size.body);
  const hidden = items.length - shown;
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.xxl), rowGap: units(unit, spacing.md) }}>
      <Text {...KOREAN_LINE_BREAK} key={`label-${shown}`} onLayout={measured(-1)} style={{ fontSize: caption, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
        {label}
      </Text>
      {items.slice(0, shown).map((item, i) => (
        <View key={`${i}-${item.ko}-${shown}`} onLayout={measured(i)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: units(unit, spacing.sm) }}>
          <TaughtKo size={body}>{item.ko}</TaughtKo>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: caption, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{item.romanization}</Text>
          {item.gloss !== undefined ? <Text {...KOREAN_LINE_BREAK} style={{ fontSize: caption, color: colors.text.primary }}>{item.gloss}</Text> : null}
        </View>
      ))}
      {hidden > 0 ? (
        <View
          key={`more-${shown}`}
          onLayout={measured(items.length)}
          style={{
            paddingHorizontal: units(unit, spacing.md),
            borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
            borderColor: colors.border.strong,
            borderRadius: radii.pill,
          }}
        >
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: caption, fontWeight: typography.weight.bold, color: colors.text.primary }}>{moreLabel(hidden)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CodePanel({ code, joinCta }: { code: string; joinCta: string }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.slide.end;
  const title = size(presenter.size.title);
  const prompt = size(presenter.size.prompt);
  return (
    <View
      style={{
        width: units(unit, CODE_PANEL),
        flexShrink: 0,
        alignSelf: 'flex-start',
        gap: units(unit, STAGE_GAP_INNER),
        padding: units(unit, spacing.xxl),
        borderRadius: units(unit, STAGE_RADIUS),
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
        borderColor: colors.border.strong,
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: prompt, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(prompt * typography.leading.tight) }}>{m.codeTitle}</Text>
      {/* The code is read letter by letter. */}
      <Text {...KOREAN_LINE_BREAK}
        testID="presenter-class-code"
        accessibilityLabel={code.split('').join(' ')}
        style={{
          fontSize: title,
          fontWeight: typography.weight.bold,
          fontFamily: typography.family.mono,
          letterSpacing: units(unit, spacing.xs),
          color: colors.text.primary,
        }}
      >
        {code}
      </Text>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.caption), color: colors.text.secondary, lineHeight: Math.round(size(presenter.size.caption) * typography.leading.normal) }}>
        {m.howToJoin(joinCta)}
      </Text>
    </View>
  );
}

/** [ Finish ]: a teacher control in real pixels (`touchTarget.min` tall), so it never pushes the title row taller on a projector. */
const FinishButton = React.forwardRef<View, { label: string; onPress: () => void }>(function FinishButton({ label, onPress }, ref) {
  return (
    <Pressable
      ref={ref}
      testID="presenter-finish"
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => {
        const focused = (state as { focused?: boolean }).focused === true;
        return {
          minHeight: touchTarget.min,
          paddingHorizontal: spacing.xl,
          borderRadius: radii.pill,
          borderWidth: borderWidth.thick,
          borderColor: colors.brand.primaryDark,
          backgroundColor: colors.brand.primaryDark,
          alignItems: 'center',
          justifyContent: 'center',
          outlineStyle: focused ? 'solid' : undefined,
          outlineWidth: focused ? borderWidth.thick : undefined,
          outlineColor: focused ? colors.border.focus : undefined,
          outlineOffset: focused ? borderWidth.base : undefined,
        };
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, color: colors.text.onPrimary, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
});
