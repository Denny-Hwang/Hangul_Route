import React, { useMemo, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { NO_INSETS, detailPaneWidth, layoutClassFor } from '../../layout';
import { layout } from '../../tokens';
import { LayoutProvider, useLayoutClass } from './LayoutProvider';

export interface SplitPaneProps {
  /** The list or grid. On one pane this is all that renders and the caller navigates as today. */
  master: React.ReactNode;
  /** The selected item's page (two panes only). */
  detail: React.ReactNode;
  /** Defaults to `layout.pane.master`. */
  masterWidth?: number;
  /** Landmark names (`role="region"`), passed in already localised: the design system has no i18n dependency. */
  masterLabel?: string;
  detailLabel?: string;
  /**
   * The detail pane scrolls by itself (default). Pass `false` when the detail content brings its own
   * scroll area (a `Screen`), so two scroll views are not nested.
   */
  detailScrolls?: boolean;
  testID?: string;
}

/**
 * Master and detail side by side when `useLayoutClass().panes === 2` (F-LAYOUT-001 §3.2, §3.7).
 * Put it in a non-scrolling `Screen width="full"`, which owns the safe-area padding once; the panes
 * therefore reset the insets for their subtree. Each pane scrolls on its own. The detail subtree gets its
 * own layout class (a 412 to 632 wide pane is `compact` or `regular` with `panes: 1`), so a nested
 * screen never tries to split again. With `panes === 1` only `master` renders.
 */
export function SplitPane({
  master,
  detail,
  masterWidth = layout.pane.master,
  masterLabel,
  detailLabel,
  detailScrolls = true,
  testID,
}: SplitPaneProps): React.ReactElement {
  const { panes, windowWidth, windowHeight } = useLayoutClass();
  const [measured, setMeasured] = useState<number | null>(null);
  // The measured width is exact (insets included); the formula covers the first frame.
  const paneWidth = measured ?? detailPaneWidth(windowWidth, masterWidth);
  const paneClass = useMemo(() => layoutClassFor({ width: paneWidth, height: windowHeight }), [paneWidth, windowHeight]);

  if (panes !== 2) return <>{master}</>;

  const onDetailLayout = (e: LayoutChangeEvent): void => {
    const w = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev === w ? prev : w));
  };

  return (
    <SafeAreaInsetsContext.Provider value={NO_INSETS}>
      <View testID={testID} style={{ flex: 1, flexDirection: 'row', gap: layout.pane.gap }}>
        <View role="region" aria-label={masterLabel} style={{ width: masterWidth, flexShrink: 0 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
            {master}
          </ScrollView>
        </View>
        <View role="region" aria-label={detailLabel} onLayout={onDetailLayout} style={{ flex: 1, minWidth: 0 }}>
          <LayoutProvider value={paneClass}>
            {detailScrolls ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
                {detail}
              </ScrollView>
            ) : (
              detail
            )}
          </LayoutProvider>
        </View>
      </View>
    </SafeAreaInsetsContext.Provider>
  );
}
