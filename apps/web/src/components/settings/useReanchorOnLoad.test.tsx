import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveSettingsSection } from './settingsScroll';
import { useReanchorOnLoad } from './useReanchorOnLoad';
import type { Mock } from 'vitest';

function ReanchorHarness({ loaded }: { loaded: boolean }) {
  useReanchorOnLoad(loaded);
  return null;
}

function harnessTree(loaded: boolean) {
  return <ReanchorHarness loaded={loaded} />;
}

function renderHarness(loaded: boolean) {
  return render(harnessTree(loaded));
}

let scrollIntoViewMock: Mock<typeof Element.prototype.scrollIntoView>;

beforeEach(() => {
  vi.clearAllMocks();
  // active section is module-level state; reset so it can't leak across tests
  setActiveSettingsSection('');
  scrollIntoViewMock = vi.fn(() => undefined);
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  const target = document.createElement('section');
  target.id = 'integrations';
  // non-zero offset routes through scrollIntoView, not the snap-to-0 branch
  target.getBoundingClientRect = () =>
    ({
      top: 1000,
      bottom: 1100,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
    }) as DOMRect;
  document.body.appendChild(target);
});

afterEach(() => {
  document.body.innerHTML = '';
  setActiveSettingsSection('');
  vi.restoreAllMocks();
});

describe('useReanchorOnLoad', () => {
  it('re-anchors the active section instantly when loaded transitions false to true', () => {
    setActiveSettingsSection('integrations');
    const { rerender } = renderHarness(false);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    rerender(harnessTree(true));

    // re-anchor corrects a settled position; instant avoids a visible lurch
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto', block: 'start' }),
    );
  });

  it('fires only once on the false to true edge, not on subsequent re-renders', () => {
    setActiveSettingsSection('integrations');
    const { rerender } = renderHarness(false);
    rerender(harnessTree(true));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    // `loaded` stays true on later re-renders; re-anchor must not fire again
    rerender(harnessTree(true));
    rerender(harnessTree(true));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-anchor when there is no active section', () => {
    const { rerender } = renderHarness(false);
    rerender(harnessTree(true));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not re-anchor when the active section has no matching element', () => {
    setActiveSettingsSection('danger');
    const { rerender } = renderHarness(false);
    rerender(harnessTree(true));
    // only `#integrations` exists in the DOM; `#danger` has nothing to scroll
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not re-anchor if the user has already scrolled (wheel)', () => {
    setActiveSettingsSection('integrations');
    const { rerender } = renderHarness(false);
    act(() => {
      fireEvent.wheel(window);
    });
    rerender(harnessTree(true));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not re-anchor if the user has already scrolled (touchmove)', () => {
    setActiveSettingsSection('integrations');
    const { rerender } = renderHarness(false);
    act(() => {
      fireEvent.touchMove(window);
    });
    rerender(harnessTree(true));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('does not move focus on re-anchor', () => {
    setActiveSettingsSection('integrations');
    const focusTarget = document.createElement('button');
    document.body.appendChild(focusTarget);
    focusTarget.focus();

    const { rerender } = renderHarness(false);
    rerender(harnessTree(true));

    expect(document.activeElement).toBe(focusTarget);
  });
});
