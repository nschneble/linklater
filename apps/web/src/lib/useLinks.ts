import {
  archiveLink,
  deleteLink,
  getLinks,
  getRandomLink,
  unarchiveLink,
  type Link,
  type PaginatedLinks,
} from './api';

import { useEffect, useRef, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';

type LinksFilter = 'active' | 'archived';

export interface UseLinksResult {
  handleCreated: (link: Link) => void;
  handleDelete: (id: string) => Promise<void>;
  handleLoadMore: () => void;
  handleRandom: () => Promise<void>;
  handleToggleArchive: (link: Link) => Promise<void>;
  handleToggleForm: () => void;
  initialLoad: boolean;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  randomError: string | null;
  randomLoading: boolean;
  showLinkForm: boolean;
}

export function useLinks(filter: LinksFilter, search: string): UseLinksResult {
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pick<
    PaginatedLinks,
    'total' | 'limit'
  > | null>(null);
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const hasFetchedOnce = useRef(false);

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((previous) =>
      previous.map((link) => (link.id === updatedLink.id ? updatedLink : link)),
    );
    setPendingMetaLinkId(null);
  });

  // resets to page 1 when the search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // loads links when the search, filter, or page changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingLinks(true);
      try {
        const result = await getLinks({
          search: search || undefined,
          archived: filter === 'archived',
          page,
        });
        if (!cancelled) {
          if (page === 1) {
            setLinks(result.data);
          } else {
            setLinks((previous) => [...previous, ...result.data]);
          }
          setPagination({ total: result.total, limit: result.limit });
        }
      } catch (error) {
        console.error('Failed to load links', error);
      } finally {
        if (!cancelled) {
          setLoadingLinks(false);
          hasFetchedOnce.current = true;
        }
      }
    };

    const timeout = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, filter, page]);

  const handleCreated = (link: Link) => {
    // only prepends when viewing active links
    if (filter === 'archived') {
      setShowLinkForm(false);
      return;
    }
    setLinks((previous) => [link, ...previous]);
    setShowLinkForm(false);
    setPendingMetaLinkId(link.id);
  };

  const handleToggleArchive = async (link: Link) => {
    try {
      const updated = link.archivedAt
        ? await unarchiveLink(link.id)
        : await archiveLink(link.id);

      setLinks((previous) => {
        if (filter === 'active' && updated.archivedAt) {
          return previous.filter((item) => item.id !== updated.id);
        }
        if (filter === 'archived' && !updated.archivedAt) {
          return previous.filter((item) => item.id !== updated.id);
        }
        return previous.map((item) =>
          item.id === updated.id ? updated : item,
        );
      });
    } catch (error: unknown) {
      console.error('Failed to toggle archive state', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id);
      setLinks((previous) => previous.filter((link) => link.id !== id));
    } catch (error: unknown) {
      console.error('Failed to delete link', error);
    }
  };

  const handleRandom = async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({ archived: filter === 'archived' });
      if (!link) {
        setRandomError('No links available');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', error);
    } finally {
      setRandomLoading(false);
    }
  };

  const handleLoadMore = () => {
    setPage((previous) => previous + 1);
  };

  const handleToggleForm = () => {
    setShowLinkForm((open) => !open);
  };

  return {
    handleCreated,
    handleDelete,
    handleLoadMore,
    handleRandom,
    handleToggleArchive,
    handleToggleForm,
    initialLoad: !hasFetchedOnce.current,
    links,
    loadingLinks,
    page,
    pagination,
    randomError,
    randomLoading,
    showLinkForm,
  };
}
