import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsScrollSpy } from './useSettingsScrollSpy';

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

let observerCallbacks: ObserverCallback[] = [];

class MockIntersectionObserver {
  callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observerCallbacks.push(callback);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function emit(entries: { id: string; isIntersecting: boolean }[]) {
  const records = entries.map((entry) => {
    const target = document.getElementById(entry.id)!;
    return {
      target,
      isIntersecting: entry.isIntersecting,
    } as unknown as IntersectionObserverEntry;
  });
  for (const callback of observerCallbacks) {
    act(() => callback(records));
  }
}

// The spy is wired to the *real* react-router navigate so a clicked nav
// button performs a genuine URL change (and re-fires the section-param
// effect), exactly as the production sidebar does. `navigateMock` records
// the calls for assertions but also delegates, so the hook's own
// `replace` echoes are both observable and actually applied to the URL.
const navigateMock = vi.fn();
let realNavigate: (
  to: string,
  options?: { replace?: boolean },
) => void = () => {};
// A stable wrapper so the hook's effect dependency on `navigate` doesn't
// change every render. Records the call for assertions, then delegates to
// the live react-router navigate captured below.
function navigateWrapper(to: string, options?: { replace?: boolean }) {
  navigateMock(to, options);
  realNavigate(to, options);
}
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => {
      realNavigate = actual.useNavigate();
      return navigateWrapper;
    },
  };
});

function ScrollSpyHarness({ sectionIds }: { sectionIds: string[] }) {
  const { activeHash } = useSettingsScrollSpy({ sectionIds });
  return (
    <div>
      <div data-testid="active">{activeHash}</div>
      {sectionIds.map((id) => (
        <button
          key={id}
          data-testid={`navigate-${id}`}
          onClick={() => realNavigate(`/settings/${id}`)}
        >
          navigate {id}
        </button>
      ))}
    </div>
  );
}

function renderHarness(route: string, sectionIds: string[]) {
  for (const id of sectionIds) {
    const element = document.createElement('section');
    element.id = id;
    document.body.appendChild(element);
  }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/settings/:section?"
          element={<ScrollSpyHarness sectionIds={sectionIds} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  observerCallbacks = [];
  navigateMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom implements `focus` on `HTMLElement.prototype`, which shadows
  // anything assigned to `Element.prototype.focus` (a `<section>` resolves
  // the closer prototype first). Mock at the `HTMLElement` level so the
  // settings scroll helper's `element.focus(...)` is actually intercepted.
  HTMLElement.prototype.focus = vi.fn();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useSettingsScrollSpy', () => {
  it('defaults to the first section when there is no section param', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    expect(screen.getByTestId('active')).toHaveTextContent('account');
  });

  it('initialises to the URL section param when it matches a section', () => {
    renderHarness('/settings/integrations', [
      'account',
      'security',
      'integrations',
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('falls back to the first section when the param is not in the list', () => {
    renderHarness('/settings/unknown', ['account', 'security']);
    expect(screen.getByTestId('active')).toHaveTextContent('account');
  });

  it('updates activeHash when an observer entry intersects', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    emit([
      { id: 'security', isIntersecting: true },
      { id: 'account', isIntersecting: false },
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('security');
  });

  it('picks the first intersecting section in document order', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    emit([
      { id: 'integrations', isIntersecting: true },
      { id: 'security', isIntersecting: true },
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('security');
  });

  it('keeps the previous active value when nothing intersects', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    emit([{ id: 'security', isIntersecting: true }]);
    expect(screen.getByTestId('active')).toHaveTextContent('security');
    emit([{ id: 'security', isIntersecting: false }]);
    expect(screen.getByTestId('active')).toHaveTextContent('security');
  });

  it('snaps activeHash to a genuine navigation target', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('navigate-integrations').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('pins activeHash through subsequent observer entries after navigation', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('navigate-integrations').click();
    });
    // Observer fires mid-scroll claiming a different section is in view.
    // The intent pin must hold until the user actually scrolls.
    emit([
      { id: 'security', isIntersecting: true },
      { id: 'integrations', isIntersecting: false },
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('releases the intent pin when the user produces a wheel event', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('navigate-integrations').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
    // Pre-load intersection state with security in view.
    emit([{ id: 'security', isIntersecting: true }]);
    // Intent still active — observer call was ignored, activeHash stays.
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
    // User scrolls — release intent and recompute from intersection state.
    act(() => {
      fireEvent.wheel(window);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('security');
  });

  it('pins activeHash to the initial URL section param so observer cannot override', () => {
    renderHarness('/settings/integrations', [
      'account',
      'security',
      'integrations',
    ]);
    // Page just loaded with a section param — emulate the observer reporting
    // that a different section is currently in the band.
    emit([
      { id: 'security', isIntersecting: true },
      { id: 'integrations', isIntersecting: false },
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('calls navigate(/settings/<hash>, { replace: true }) when scroll changes the active section', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    emit([{ id: 'security', isIntersecting: true }]);
    expect(navigateMock).toHaveBeenCalledWith('/settings/security', {
      replace: true,
    });
  });

  it('does not push history entries on scroll-driven section changes', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    emit([{ id: 'security', isIntersecting: true }]);
    for (const call of navigateMock.mock.calls) {
      expect(call[1]).toEqual({ replace: true });
    }
  });

  it('keeps tracking the active section after its own URL echo (no sticky pin)', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    // First scroll-driven change mirrors the URL to `security` via `replace`.
    // The spy must consume that echo without re-pinning intent — a subsequent
    // scroll past `integrations` must still advance the active section.
    emit([{ id: 'security', isIntersecting: true }]);
    expect(screen.getByTestId('active')).toHaveTextContent('security');
    emit([
      { id: 'integrations', isIntersecting: true },
      { id: 'security', isIntersecting: false },
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('does not scroll the viewport on a scroll-driven (echo) section change', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    emit([{ id: 'security', isIntersecting: true }]);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls + focuses the target on a genuine navigation (deep link / sidebar click)', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    (HTMLElement.prototype.focus as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      screen.getByTestId('navigate-integrations').click();
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(HTMLElement.prototype.focus).toHaveBeenCalled();
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('suppresses an observer echo (no scroll/focus) yet honors a later genuine navigation', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    // Observer echo to `security`: mirrors the URL via `replace`, consumed as
    // a one-shot echo, so it must NOT scroll or focus the section.
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    (HTMLElement.prototype.focus as ReturnType<typeof vi.fn>).mockClear();
    emit([{ id: 'security', isIntersecting: true }]);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(HTMLElement.prototype.focus).not.toHaveBeenCalled();

    // A subsequent genuine navigation to a different section (not preceded by
    // a spy echo for it) has no pending echo to consume, so it must scroll +
    // focus the target. With the old name-based guard, a stale guard value
    // could wrongly swallow this; the one-shot echo counter cannot.
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    (HTMLElement.prototype.focus as ReturnType<typeof vi.fn>).mockClear();
    act(() => {
      screen.getByTestId('navigate-integrations').click();
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(HTMLElement.prototype.focus).toHaveBeenCalled();
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });
});
