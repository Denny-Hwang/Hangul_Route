export interface SectionTabItem<T extends string> {
  id: T;
  /** Already-localised tab label. */
  label: string;
}

export interface SectionTabsProps<T extends string> {
  items: readonly SectionTabItem<T>[];
  /** The selected tab's id. */
  value: T;
  /** Fires with the tapped tab's id (also when it is already selected; the caller ignores a no-op). */
  onChange: (id: T) => void;
  /** Already-localised name of the tab row (the `tablist`). */
  accessibilityLabel: string;
  /** Row id; each tab gets `<testID>-<id>`. */
  testID?: string;
  /**
   * The id of the section body the tabs control (`role="tabpanel"`, drawn by the caller). Each tab
   * then has `aria-controls` and the id `sectionTabId(panelId, id)`, which the panel's
   * `aria-labelledby` names.
   */
  panelId?: string;
  /**
   * The selected tab takes keyboard and screen-reader focus when the row mounts (or when this turns
   * true). For a caller whose layout remounts the row on a switch, so the tab just pressed keeps focus.
   */
  focusSelected?: boolean;
}
