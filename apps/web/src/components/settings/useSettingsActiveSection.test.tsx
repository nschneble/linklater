import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsActiveSection } from './useSettingsActiveSection';

// Exercises the hook through a tiny harness that mirrors how the production
// nav surfaces drive it: a button per section calls `activateSection`, and the
// current `activeSection` is surfaced for assertions. The hook attaches its
// clear listeners to `document`, so tests interact with real DOM nodes.
function ActiveSectionHarness({ sectionIds }: { sectionIds: string[] }) {
  const { activeSection, activateSection } = useSettingsActiveSection({
    sectionIds,
  });
  return (
    <div>
      <div data-testid="active">{activeSection}</div>
      {sectionIds.map((id) => (
        <button
          key={id}
          data-testid={`activate-${id}`}
          onClick={() => activateSection(id)}
        >
          activate {id}
        </button>
      ))}
      <button
        data-testid="activate-unknown"
        onClick={() => activateSection('nonexistent')}
      >
        activate unknown
      </button>
    </div>
  );
}

function renderHarness(sectionIds: string[]) {
  for (const id of sectionIds) {
    const element = document.createElement('section');
    element.id = id;
    // Stub a non-zero document offset so the scroll helper's "is this
    // section naturally close to the top?" branch defaults to the normal
    // `scrollIntoView` path. Tests that need the snap-to-0 path override
    // this for the section under test.
    element.getBoundingClientRect = () =>
      ({
        top: 1000,
        bottom: 1100,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
      }) as DOMRect;
    // A focusable child so `focusin`-inside vs -outside can be exercised.
    const input = document.createElement('input');
    input.setAttribute('data-testid', `field-${id}`);
    element.appendChild(input);
    document.body.appendChild(element);
  }
  return render(<ActiveSectionHarness sectionIds={sectionIds} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom defines `focus` on `HTMLElement.prototype`, which shadows
  // `Element.prototype.focus`; mock at the HTMLElement level so the scroll
  // helper's `element.focus(...)` is intercepted.
  HTMLElement.prototype.focus = vi.fn();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

afterEach(() => {
  // Flush any pending timers (e.g. the 5s safety-clear) inside act() so
  // React processes the resulting state updates without triggering act warnings.
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useSettingsActiveSection', () => {
  it('starts with no active section', () => {
    renderHarness(['account', 'security', 'integrations']);
    expect(screen.getByTestId('active')).toHaveTextContent('');
  });

  it('activates, scrolls, and focuses a section on activate', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start' }),
    );
    expect(HTMLElement.prototype.focus).toHaveBeenCalled();
  });

  it('ignores activation of an id not in the section list', () => {
    renderHarness(['account', 'security']);
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    act(() => {
      screen.getByTestId('activate-unknown').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('clears the active section on pointerdown outside it', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');

    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('');
  });

  it('keeps the active section on pointerdown inside it', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });

    act(() => {
      fireEvent.pointerDown(screen.getByTestId('field-integrations'));
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('clears the active section on focusin outside it', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });

    act(() => {
      fireEvent.focusIn(screen.getByTestId('field-account'));
    });
    expect(screen.getByTestId('active')).toHaveTextContent('');
  });

  it('keeps the active section on focusin inside it', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });

    act(() => {
      fireEvent.focusIn(screen.getByTestId('field-integrations'));
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('clears the active section on Escape', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.getByTestId('active')).toHaveTextContent('');
  });

  it('does not clear the active section on scroll/wheel', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });

    act(() => {
      fireEvent.wheel(window);
      fireEvent.scroll(window);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('clears the active section after the safety timeout', () => {
    renderHarness(['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('activate-integrations').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('');
  });
});
