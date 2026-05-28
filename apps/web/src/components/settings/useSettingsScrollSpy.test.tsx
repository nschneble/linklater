import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateToSettingsSection } from './settingsScroll';
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

// The harness drives navigation through the real `navigateToSettingsSection`
// helper (with the live react-router navigate), exactly as the production
// sidebar/chip/skip-link do. There is no navigate mock: the spy no longer
// calls navigate itself, so navigation is purely an *input* here. `pathname`
// is surfaced so tests can assert the URL never changes on a scroll-driven
// (observer) update.
function ScrollSpyHarness({ sectionIds }: { sectionIds: string[] }) {
  const { activeHash } = useSettingsScrollSpy({ sectionIds });
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <div data-testid="active">{activeHash}</div>
      <div data-testid="pathname">{location.pathname}</div>
      {sectionIds.map((id) => (
        <button
          key={id}
          data-testid={`navigate-${id}`}
          onClick={() => navigateToSettingsSection(navigate, id)}
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
  describe('initial active section', () => {
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
  });

  describe('scroll-spy (IntersectionObserver)', () => {
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

    it('keeps tracking as the user scrolls past multiple sections', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      emit([{ id: 'security', isIntersecting: true }]);
      expect(screen.getByTestId('active')).toHaveTextContent('security');
      emit([
        { id: 'integrations', isIntersecting: true },
        { id: 'security', isIntersecting: false },
      ]);
      expect(screen.getByTestId('active')).toHaveTextContent('integrations');
    });

    it('never navigates on a scroll-driven change (URL is unchanged)', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      expect(screen.getByTestId('pathname')).toHaveTextContent('/settings');
      emit([{ id: 'security', isIntersecting: true }]);
      expect(screen.getByTestId('active')).toHaveTextContent('security');
      // The spy mirrors nothing into the URL — the path stays put.
      expect(screen.getByTestId('pathname')).toHaveTextContent('/settings');
    });

    it('does not scroll the viewport on a scroll-driven change', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      (
        Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
      ).mockClear();
      emit([{ id: 'security', isIntersecting: true }]);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('genuine navigation (intent token)', () => {
    it('snaps activeHash to a navigation target', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      act(() => {
        screen.getByTestId('navigate-integrations').click();
      });
      expect(screen.getByTestId('active')).toHaveTextContent('integrations');
    });

    it('scrolls + focuses the target on navigation', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      (
        Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
      ).mockClear();
      (HTMLElement.prototype.focus as ReturnType<typeof vi.fn>).mockClear();

      act(() => {
        screen.getByTestId('navigate-integrations').click();
      });

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(HTMLElement.prototype.focus).toHaveBeenCalled();
      expect(screen.getByTestId('active')).toHaveTextContent('integrations');
    });

    it('re-scrolls on a repeat click of the already-active section', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      act(() => {
        screen.getByTestId('navigate-integrations').click();
      });
      // A fresh intent token is minted per click, so navigating to the
      // section the user is already on still re-fires the scroll. This is the
      // case the old echo-counter could swallow.
      (
        Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
      ).mockClear();
      act(() => {
        screen.getByTestId('navigate-integrations').click();
      });
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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
  });

  describe('deep link', () => {
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

    it('scrolls + focuses the deep-linked section on mount', () => {
      renderHarness('/settings/integrations', [
        'account',
        'security',
        'integrations',
      ]);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      );
      expect(HTMLElement.prototype.focus).toHaveBeenCalled();
    });

    it('does not scroll on mount when there is no section param', () => {
      renderHarness('/settings', ['account', 'security', 'integrations']);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
