import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAggregatedError } from './useAggregatedError';

type Errors = Parameters<typeof useAggregatedError>[0];

const noErrors: Errors = {
  deleteError: null,
  fetchError: null,
  randomError: null,
  readError: null,
  saveError: null,
};

describe('useAggregatedError', () => {
  it('starts with no error', () => {
    const { result } = renderHook(() => useAggregatedError(noErrors));
    expect(result.current).toBeNull();
  });

  it('surfaces a newly set error', () => {
    const { result, rerender } = renderHook(
      (errors: Errors) => useAggregatedError(errors),
      { initialProps: noErrors },
    );

    rerender({ ...noErrors, saveError: 'Save failed' });

    expect(result.current).toBe('Save failed');
  });

  it('applies last-write-wins when two fields fail in the same transition', () => {
    const { result, rerender } = renderHook(
      (errors: Errors) => useAggregatedError(errors),
      { initialProps: noErrors },
    );

    // deleteError is iterated before saveError, so saveError wins.
    rerender({
      ...noErrors,
      deleteError: 'Delete failed',
      saveError: 'Save failed',
    });

    expect(result.current).toBe('Save failed');
  });

  it('re-announces when the same field fails again with a new message', () => {
    const { result, rerender } = renderHook(
      (errors: Errors) => useAggregatedError(errors),
      { initialProps: { ...noErrors, fetchError: 'First failure' } },
    );

    expect(result.current).toBe('First failure');

    rerender({ ...noErrors, fetchError: 'Second failure' });

    expect(result.current).toBe('Second failure');
  });

  it('keeps the current error when an unchanged field is re-reported', () => {
    const { result, rerender } = renderHook(
      (errors: Errors) => useAggregatedError(errors),
      { initialProps: { ...noErrors, readError: 'Read failed' } },
    );

    expect(result.current).toBe('Read failed');

    // no field changed value; the aggregated error must hold steady
    rerender({ ...noErrors, readError: 'Read failed' });

    expect(result.current).toBe('Read failed');
  });

  it('clears the error once every field is null again', () => {
    const { result, rerender } = renderHook(
      (errors: Errors) => useAggregatedError(errors),
      { initialProps: { ...noErrors, randomError: 'Stumble failed' } },
    );

    expect(result.current).toBe('Stumble failed');

    rerender(noErrors);

    expect(result.current).toBeNull();
  });
});
