import { useCallback, useState } from 'react';
import { usePasteDetection } from './usePasteDetection';

interface UseLinksFormOptions {
  enabled?: boolean;
  onDirectSave: (url: string) => Promise<void>;
}

export interface UseLinksFormResult {
  handleToggleForm: () => void;
  showLinkForm: boolean;
}

export function useLinksForm({
  enabled = true,
  onDirectSave,
}: UseLinksFormOptions): UseLinksFormResult {
  const [showLinkForm, setShowLinkForm] = useState(false);

  usePasteDetection({ enabled, onSave: onDirectSave });

  const handleToggleForm = useCallback(() => {
    setShowLinkForm((open) => !open);
  }, []);

  return { handleToggleForm, showLinkForm };
}
