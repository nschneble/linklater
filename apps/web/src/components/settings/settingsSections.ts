export interface SettingsSection {
  /** URL hash (without `#`) and DOM id of the group element. */
  hash: string;
  /** Visible label shown in the sidebar and chip row. */
  label: string;
  /** Font Awesome solid icon name (without the `fa-` prefix's `solid` part). */
  icon: string;
}
