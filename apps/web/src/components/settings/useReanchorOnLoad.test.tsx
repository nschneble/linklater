import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReanchorOnLoad } from './useReanchorOnLoad';

function ReanchorHarness({ loaded }: { loaded: boolean }) {
  useReanchorOnLoad(loaded);
  return null;
}

function harnessTree(route: string, loaded: boolean) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/settings/:section?"
          element={<ReanchorHarness loaded={loaded} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderHarness(route: string, loaded: boolean) {
  return render(harnessTree(route, loaded));
}

let scrollIntoViewMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  scrollIntoViewMock = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  const target = document.createElement('section');
  target.id = 'integrations';
  document.body.appendChild(target);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useReanchorOnLoad', () => {
  it('re-anchors the active section instantly when loaded transitions false to true', () => {
    const { rerender } = renderHarness('/settings/integrations', false);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    rerender(harnessTree('/settings/integrations', true));

    // A re-anchor is always a correction of an already-settled position, so it
    // must scroll instantly — a smooth scroll would read as a visible lurch.
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto', block: 'start' }),
    );
  });

  it('fires only once on the false to true edge, not on subsequent re-renders', () => {
    const { rerender } = renderHarness('/settings/integrations', false);
    rerender(harnessTree('/settings/integrations', true));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    // `loaded` stays true across later re-renders (e.g. a regenerate flow that
    // updates unrelated state). The re-anchor must not fire again.
    rerender(harnessTree('/settings/integrations', true));
    rerender(harnessTree('/settings/integrations', true));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-anchor when there is no section param', () => {
    const { rerender } = renderHarness('/settings', false);
    rerender(harnessTree('/settings', true));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not re-anchor when the section param has no matching element', () => {
    const { rerender } = renderHarness('/settings/danger', false);
    rerender(harnessTree('/settings/danger', true));
    // Only an `#integrations` element exists in the DOM; `#danger` does not, so
    // the helper has nothing to scroll and must no-op.
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not re-anchor if the user has already scrolled (wheel)', () => {
    const { rerender } = renderHarness('/settings/integrations', false);
    act(() => {
      fireEvent.wheel(window);
    });
    rerender(harnessTree('/settings/integrations', true));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not re-anchor if the user has already scrolled (touchmove)', () => {
    const { rerender } = renderHarness('/settings/integrations', false);
    act(() => {
      fireEvent.touchMove(window);
    });
    rerender(harnessTree('/settings/integrations', true));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not move focus on re-anchor', () => {
    const focusTarget = document.createElement('button');
    document.body.appendChild(focusTarget);
    focusTarget.focus();

    const { rerender } = renderHarness('/settings/integrations', false);
    rerender(harnessTree('/settings/integrations', true));

    expect(document.activeElement).toBe(focusTarget);
  });
});
