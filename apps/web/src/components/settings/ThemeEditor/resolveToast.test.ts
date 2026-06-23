/*
 * Tests for the editor's `resolveToast` message-key resolver (W6). The toast
 * holds only a string key; this resolver picks the <Toast> variant and visible
 * copy, including the `copied:<count>:<label>` string protocol (which stays
 * encoded this wave but is now covered – the generic-ization is deferred).
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

  it('maps "picker-visibility-failed" to an error toast', () => {
    expect(resolveToast('picker-visibility-failed')).toEqual({
      message: 'Could not update theme picker setting.',
      variant: 'error',
    });
  });

  it('decodes copied:<count>:<label> into a success toast', () => {
    expect(resolveToast('copied:12:Apollo 10½')).toEqual({
      message: 'Copied 12 tokens from Apollo 10½',
      variant: 'success',
    });
  });

  it('preserves a colon inside the copied label', () => {
    expect(resolveToast('copied:3:Before: Midnight')).toEqual({
      message: 'Copied 3 tokens from Before: Midnight',
      variant: 'success',
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
