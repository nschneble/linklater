import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveSettingsSection } from './settingsScroll';
import { useReanchorOnLoad } from './useReanchorOnLoad';

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

let scrollIntoViewMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // The active section is module-level state shared across tests – reset it so
  // a value set by one test can't leak into the next.
  setActiveSettingsSection('');
  scrollIntoViewMock = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  const target = document.createElement('section');
  target.id = 'integrations';
  // Stub a non-zero document offset so the scroll helper takes the normal
  // `scrollIntoView` path (its snap-to-0 branch fires only when a section
  // naturally sits within its own scroll-margin of the page top).
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

    // A re-anchor is always a correction of an already-settled position, so it
    // must scroll instantly – a smooth scroll would read as a visible lurch.
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto', block: 'start' }),
    );
  });

  it('fires only once on the false to true edge, not on subsequent re-renders', () => {
    setActiveSettingsSection('integrations');
    const { rerender } = renderHarness(false);
    rerender(harnessTree(true));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    // `loaded` stays true across later re-renders (e.g. a regenerate flow that
    // updates unrelated state). The re-anchor must not fire again.
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
    // Only an `#integrations` element exists in the DOM; `#danger` does not, so
    // the helper has nothing to scroll and must no-op.
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
