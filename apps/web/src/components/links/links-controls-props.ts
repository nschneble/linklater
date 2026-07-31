import type { LinksFilter } from '../../lib/hooks/useLinks';

/**
 * Shared props for the desktop (`LinksControls`) and mobile
 * (`LinksMobileControls`) action-button surfaces in the links toolbar.
 * Extracted so both stay in sync - `LinksToolbar` passes the identical set
 * of props to each variant.
 */
export interface LinksControlsProps {
  /** Drives which buttons are shown (unread tab shows Add/Stumble; read shows Remove all). */
  filter: LinksFilter;
  /** Disables the bulk-delete button while deletion is in progress. */
  isClearingRead: boolean;
  /** Hides the bulk-delete button when there are no read links to delete. */
  linksCount: number;
  /** Disables the random/stumble button while a random fetch is in flight. */
  randomLoading: boolean;
  /** Drives the `aria-expanded` state and label of the form toggle button. */
  showLinkForm: boolean;
  /** Called when the user requests to remove all read links. */
  onClearRead: () => void;
  /** Called when the user requests a random link. */
  onRandom: () => Promise<void>;
  /** Toggles the inline link creation form open or closed. */
  onToggleForm: () => void;
}
