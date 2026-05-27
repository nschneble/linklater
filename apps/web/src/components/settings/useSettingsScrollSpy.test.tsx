import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

function ScrollSpyHarness({ sectionIds }: { sectionIds: string[] }) {
  const { activeHash, markIntent } = useSettingsScrollSpy({ sectionIds });
  return (
    <div>
      <div data-testid="active">{activeHash}</div>
      {sectionIds.map((id) => (
        <button
          key={id}
          data-testid={`mark-${id}`}
          onClick={() => markIntent(id)}
        >
          mark {id}
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
      <ScrollSpyHarness sectionIds={sectionIds} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  observerCallbacks = [];
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
  it('defaults to the first section when there is no hash', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    expect(screen.getByTestId('active')).toHaveTextContent('account');
  });

  it('initialises to the URL hash when it matches a section', () => {
    renderHarness('/settings#integrations', [
      'account',
      'security',
      'integrations',
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('falls back to the first section when the hash is not in the list', () => {
    renderHarness('/settings#unknown', ['account', 'security']);
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

  it('snaps activeHash to the markIntent target', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('mark-integrations').click();
    });
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });

  it('pins activeHash through subsequent observer entries after markIntent', () => {
    renderHarness('/settings', ['account', 'security', 'integrations']);
    act(() => {
      screen.getByTestId('mark-integrations').click();
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
      screen.getByTestId('mark-integrations').click();
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

  it('pins activeHash to the initial URL hash so observer cannot override', () => {
    renderHarness('/settings#integrations', [
      'account',
      'security',
      'integrations',
    ]);
    // Page just loaded with a hash — emulate the observer reporting that
    // a different section is currently in the band (which can happen for
    // sections near the bottom of the page that cannot scroll to the top
    // of the viewport).
    emit([
      { id: 'security', isIntersecting: true },
      { id: 'integrations', isIntersecting: false },
    ]);
    expect(screen.getByTestId('active')).toHaveTextContent('integrations');
  });
});
