import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Link, PaginatedLinks } from '../api';

type Pagination = Pick<PaginatedLinks, 'total' | 'limit'> | null;

interface UseLinksMutationsOptions {
  setLinks: Dispatch<SetStateAction<Link[]>>;
  setPagination: Dispatch<SetStateAction<Pagination>>;
}

/** Local list/count mutation helpers consumed by `useLinksActions`. */
export interface UseLinksMutationsResult {
  adjustTotal: (delta: number) => void;
  clearLinks: () => void;
  prependLink: (link: Link) => void;
  removeLink: (linkId: string) => void;
  resetTotal: () => void;
  updateLink: (link: Link) => void;
}

/**
 * In-memory mutations over the cached links list and pagination total. These
 * keep the rendered list in sync after create/update/delete without a full
 * refetch; none of them round-trip to the server.
 */
export function useLinksMutations({
  setLinks,
  setPagination,
}: UseLinksMutationsOptions): UseLinksMutationsResult {
  const prependLink = useCallback(
    (link: Link) => {
      // Deduplicate by id in case the link was already in the list, e.g.
      // from a polling update that arrived before the create callback ran.
      setLinks((previous) => [
        link,
        ...previous.filter((item) => item.id !== link.id),
      ]);
    },
    [setLinks],
  );

  const updateLink = useCallback(
    (link: Link) => {
      setLinks((previous) =>
        previous.map((item) => (item.id === link.id ? link : item)),
      );
    },
    [setLinks],
  );

  const removeLink = useCallback(
    (linkId: string) => {
      setLinks((previous) => previous.filter((item) => item.id !== linkId));
    },
    [setLinks],
  );

  const clearLinks = useCallback(() => {
    setLinks([]);
  }, [setLinks]);

  const adjustTotal = useCallback(
    (delta: number) => {
      setPagination((previous) =>
        previous ? { ...previous, total: previous.total + delta } : previous,
      );
    },
    [setPagination],
  );

  const resetTotal = useCallback(() => {
    setPagination((previous) =>
      previous ? { ...previous, total: 0 } : previous,
    );
  }, [setPagination]);

  return {
    adjustTotal,
    clearLinks,
    prependLink,
    removeLink,
    resetTotal,
    updateLink,
  };
}
