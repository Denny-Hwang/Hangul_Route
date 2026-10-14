import { colors, presenter, radii, spacing, typography } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import type { KoLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { countRows, endLetters, fitShown } from '../../../logic/lecture/shell';
import { CODE_PANEL, END_MAX_ROWS, STAGE_BORDER, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS, units } from '../../../logic/lecture/stage-constants';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

type EndBody = Extract<Slide, { kind: 'end' }>;

/**
 * End slide (design/screens/presenter/slide-end.md, README D7): "Today we met" with the letters
 * and words of the lesson, each list at most two rows and then one "+ n more" pill (rows are
 * measured, not counted; glosses are never dropped, fewer items show instead), the practice line,
 * and the class code panel when the deck has one.
 */
export function EndSlide({ slide, joinCta }: { slide: EndBody; joinCta: string }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.slide.end;
  const letters = endLetters(slide.letters);
  const title = size(presenter.size.title);
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: units(unit, STAGE_GAP) }}>
      <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER), justifyContent: 'space-between' }}>
        <View style={{ gap: units(unit, STAGE_GAP_INNER) }}>
          <Text role="heading" style={{ fontSize: title, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(title * typography.leading.tight) }}>
            {m.title}
          </Text>
          {letters.length > 0 ? <EndList label={m.letters} items={letters} moreLabel={m.more} testID="presenter-end-letters" /> : null}
          {slide.words.length > 0 ? <EndList label={m.words} items={slide.words} moreLabel={m.more} testID="presenter-end-words" /> : null}
        </View>
        <Text style={{ fontSize: size(presenter.size.prompt), fontWeight: typography.weight.bold, color: colors.text.primary }}>{m.practice}</Text>
      </View>
      {slide.classCode !== undefined ? <CodePanel code={slide.classCode} joinCta={joinCta} /> : null}
    </View>
  );
}

function EndList({
  label,
  items,
  moreLabel,
  testID,
}: {
  label: string;
  items: readonly KoLine[];
  moreLabel: (n: number) => string;
  testID: string;
}): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const [shown, setShown] = useState(items.length);
  const boxes = useRef(new Map<number, { y: number; height: number }>());
  // A new window size or list starts again from every item.
  useEffect(() => {
    boxes.current.clear();
    setShown(items.length);
  }, [unit, items]);
  const measured = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      boxes.current.set(index, { y, height });
      // Once every drawn child (label, items, pill) reported, count the rows and drop one item if they overflow.
      const children = shown + 1 + (shown < items.length ? 1 : 0);
      if (boxes.current.size < children) return;
      const rows = countRows([...boxes.current.values()]);
      const next = fitShown(shown, rows, END_MAX_ROWS);
      if (next !== shown) {
        boxes.current.clear();
        setShown(next);
      }
    },
    [shown, items.length],
  );
  const caption = size(presenter.size.caption);
  const body = size(presenter.size.body);
  const hidden = items.length - shown;
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.xxl), rowGap: units(unit, spacing.md) }}>
      <Text key={`label-${shown}`} onLayout={measured(-1)} style={{ fontSize: caption, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
        {label}
      </Text>
      {items.slice(0, shown).map((item, i) => (
        <View key={`${item.ko}-${shown}`} onLayout={measured(i)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: units(unit, spacing.sm) }}>
          <TaughtKo size={body}>{item.ko}</TaughtKo>
          <Text style={{ fontSize: caption, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{item.romanization}</Text>
          {item.gloss !== undefined ? <Text style={{ fontSize: caption, color: colors.text.primary }}>{item.gloss}</Text> : null}
        </View>
      ))}
      {hidden > 0 ? (
        <View
          key={`more-${shown}`}
          onLayout={measured(items.length)}
          style={{
            paddingHorizontal: units(unit, spacing.md),
            borderWidth: Math.max(2, units(unit, STAGE_BORDER)),
            borderColor: colors.border.strong,
            borderRadius: radii.pill,
          }}
        >
          <Text style={{ fontSize: caption, fontWeight: typography.weight.bold, color: colors.text.primary }}>{moreLabel(hidden)}</Text>
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
        borderWidth: Math.max(2, units(unit, STAGE_BORDER)),
        borderColor: colors.border.strong,
      }}
    >
      <Text style={{ fontSize: prompt, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(prompt * typography.leading.tight) }}>{m.codeTitle}</Text>
      {/* The code is read letter by letter. */}
      <Text
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
      <Text style={{ fontSize: size(presenter.size.caption), color: colors.text.secondary, lineHeight: Math.round(size(presenter.size.caption) * typography.leading.normal) }}>
        {m.howToJoin(joinCta)}
      </Text>
    </View>
  );
}
