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
}
