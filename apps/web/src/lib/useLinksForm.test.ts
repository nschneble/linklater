import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLinksForm } from './useLinksForm';

afterEach(() => vi.restoreAllMocks());

describe('useLinksForm', () => {
  it('showLinkForm starts as false', () => {
    const { result } = renderHook(() =>
      useLinksForm({ onDirectSave: vi.fn() }),
    );
    expect(result.current.showLinkForm).toBe(false);
  });

  it('handleToggleForm sets showLinkForm to true', () => {
    const { result } = renderHook(() =>
      useLinksForm({ onDirectSave: vi.fn() }),
    );
    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(true);
  });

  it('handleToggleForm toggles showLinkForm back to false', () => {
    const { result } = renderHook(() =>
      useLinksForm({ onDirectSave: vi.fn() }),
    );
    act(() => result.current.handleToggleForm());
    act(() => result.current.handleToggleForm());
    expect(result.current.showLinkForm).toBe(false);
  });
});
