import { archiveLink, getRandomLink } from './api';
import { useCallback, useState } from 'react';

type LinksFilter = 'active' | 'archived';

interface UseRandomLinkOptions {
  filter: LinksFilter;
  onDecrementTotal: () => void;
  onRemoveLink: (linkId: string) => void;
}

export interface UseRandomLinkResult {
  handleRandom: () => Promise<void>;
  randomError: string | null;
  randomLoading: boolean;
}

export function useRandomLink({
  filter,
  onDecrementTotal,
  onRemoveLink,
}: UseRandomLinkOptions): UseRandomLinkResult {
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);

  const handleRandom = useCallback(async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({ archived: filter === 'archived' });
      if (!link) {
        setRandomError('No links available');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
        if (!link.archivedAt) {
          await archiveLink(link.id);
          onRemoveLink(link.id);
          onDecrementTotal();
        }
      }
    } catch (error: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', error);
    } finally {
      setRandomLoading(false);
    }
  }, [filter, onDecrementTotal, onRemoveLink]);

  return { handleRandom, randomError, randomLoading };
}
