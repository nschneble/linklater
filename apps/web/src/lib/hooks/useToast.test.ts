import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useToast } from './useToast';

describe('useToast', () => {
  it('starts with a null message', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.message).toBeNull();
  });

  it('show(message) sets the message', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show('Saved.'));
    expect(result.current.message).toBe('Saved.');
  });

  it('dismiss() clears the message back to null', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show('Saved.'));
    expect(result.current.message).toBe('Saved.');
    act(() => result.current.dismiss());
    expect(result.current.message).toBeNull();
  });

  it('show(message) overwrites an existing message', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show('First.'));
    act(() => result.current.show('Second.'));
    expect(result.current.message).toBe('Second.');
  });
});
