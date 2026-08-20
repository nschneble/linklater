import { hasRecentLocalChange, readPersistedValue } from './storage';
import { useEffect } from 'react';

interface ServerBooleanPrefStorageKeys {
  /** `localStorage` key holding the timestamp of the last local toggle. */
  updatedAtKey: string;
  /** `localStorage` key holding the current `'on'`/absent local value. */
  valueKey: string;
}

/**
 * Syncs a boolean user preference from the server into ThemeContext after
 * login, so a change made on one device shows up on another.
 *
 * A 30s guard skips the sync right after an optimistic local toggle: if the
 * local timestamp is newer than `RECENT_LOCAL_CHANGE_MS`, the server value is
 * ignored this pass. When disabling, the stored value only overrules
 * `isEnabled` if the store is the newest copy of it this tab knows of.
 *
 * Both the CVD-mode and dyslexic-font syncs in `App` run through this hook;
 * only the storage keys and enable/disable actions differ.
 */
export function useServerBooleanPrefSync(
  serverValue: boolean | undefined,
  isEnabled: boolean,
  enable: () => void,
  disable: () => void,
  storageKeys: ServerBooleanPrefStorageKeys,
) {
  const { updatedAtKey, valueKey } = storageKeys;

  useEffect(() => {
    if (serverValue === undefined) return;

    if (hasRecentLocalChange(updatedAtKey)) return;

    if (serverValue && !isEnabled) {
      enable();
    } else if (!serverValue && isEnabled) {
      if (readPersistedValue(valueKey, 'on') !== 'on') {
        disable();
      }
    }
  }, [serverValue, isEnabled, enable, disable, updatedAtKey, valueKey]);
}
