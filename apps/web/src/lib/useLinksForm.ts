import { useCallback, useState } from 'react';
import { usePasteDetection } from './usePasteDetection';

interface UseLinksFormOptions {
  onDirectSave: (url: string) => Promise<void>;
}

export interface UseLinksFormResult {
  handleToggleForm: () => void;
  showLinkForm: boolean;
}

export function useLinksForm({
  onDirectSave,
}: UseLinksFormOptions): UseLinksFormResult {
  const [showLinkForm, setShowLinkForm] = useState(false);

  usePasteDetection({ onSave: onDirectSave });

  const handleToggleForm = useCallback(() => {
    setShowLinkForm((open) => !open);
  }, []);

  return { handleToggleForm, showLinkForm };
}
