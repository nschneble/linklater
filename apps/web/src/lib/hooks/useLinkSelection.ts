import { useEffect, useState } from 'react';
import type { Link } from '../api';
import type { LinksFilter } from './types';

interface UseLinkSelectionOptions {
  /** The currently displayed links, in render order. */
  links: Link[];
  /** The active filter; changing it clears the selection. */
  filter: LinksFilter;
  /** The debounced search term; changing it clears the selection. */
  debouncedSearch: string;
  /** Called to mark a still-unread link as read after it is opened. */
  onToggleRead: (link: Link) => void;
}

export interface UseLinkSelectionResult {
  /** Index of the highlighted link, or `null` when nothing is selected. */
  selectedLinkIndex: number | null;
  /** Moves the highlight to the next link, clamped to the last one. */
  handleNavigateNextLink: () => void;
  /** Moves the highlight to the previous link, clamped to the first one. */
  handleNavigatePrevLink: () => void;
  /** Opens the selected link in a new tab, marking it read if unread. */
  handleOpenSelectedLink: () => void;
}

/**
 * Owns keyboard-driven selection over the links list: the highlighted index
 * and the next/previous/open handlers. The selection clears when the filter
 * or the debounced search changes, and clamps to the last link whenever the
 * list shrinks (e.g. after a link is marked as read).
 *
 * @param options - The current list, filter, search, and read-toggle handler.
 * @returns The selected index and the navigation handlers.
 */
export function useLinkSelection({
  links,
  filter,
  debouncedSearch,
  onToggleRead,
}: UseLinkSelectionOptions): UseLinkSelectionResult {
  const [selectedLinkIndex, setSelectedLinkIndex] = useState<number | null>(
    null,
  );

  function handleNavigateNextLink() {
    if (links.length === 0) return;
    setSelectedLinkIndex((previous) => {
      if (previous === null) return 0;
      return Math.min(previous + 1, links.length - 1);
    });
  }

  function handleNavigatePrevLink() {
    if (links.length === 0) return;
    setSelectedLinkIndex((previous) => {
      if (previous === null) return links.length - 1;
      return Math.max(previous - 1, 0);
    });
  }

  function handleOpenSelectedLink() {
    if (selectedLinkIndex === null) return;
    const link = links[selectedLinkIndex];
    if (!link) return;
    window.open(link.url, '_blank', 'noreferrer');
    if (!link.readAt) {
      onToggleRead(link);
    }
  }

  // Resets the selection whenever the filter changes (e.g. switching between
  // the unread and read tabs).
  useEffect(() => {
    setSelectedLinkIndex(null);
  }, [filter]);

  // Clamps selection when the list shrinks (e.g. after a link is marked as read).
  useEffect(() => {
    if (selectedLinkIndex !== null && selectedLinkIndex >= links.length) {
      setSelectedLinkIndex(links.length > 0 ? links.length - 1 : null);
    }
  }, [links.length, selectedLinkIndex]);

  // Resets selection when search changes, so the highlighted card matches the
  // new result set.
  useEffect(() => {
    setSelectedLinkIndex(null);
  }, [debouncedSearch]);

  return {
    selectedLinkIndex,
    handleNavigateNextLink,
    handleNavigatePrevLink,
    handleOpenSelectedLink,
  };
}
