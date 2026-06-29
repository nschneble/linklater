/*
 * Tests for the editor's `resolveToast` message-key resolver. The toast holds
 * only a string key; this resolver picks the <Toast> variant and visible copy.
 * Only the assertive FAILURE keys route here now — copy/undo success is
 * announced by the editor's polite live region, not a toast.
 */

import { describe, expect, it } from 'vitest';
import { resolveToast } from './index';

describe('resolveToast', () => {
  it('maps "save-failed" to an error toast', () => {
    expect(resolveToast('save-failed')).toEqual({
      message: 'Could not save custom theme.',
      variant: 'error',
    });
  });

  it('maps "custom-theme-toggle-failed" to an error toast', () => {
    expect(resolveToast('custom-theme-toggle-failed')).toEqual({
      message: 'Could not update the custom theme setting.',
      variant: 'error',
    });
  });

  it('returns null for a null message', () => {
    expect(resolveToast(null)).toBeNull();
  });

  it('falls back to a plain success toast for an unknown key', () => {
    expect(resolveToast('something-else')).toEqual({
      message: 'something-else',
      variant: 'success',
    });
  });
});
