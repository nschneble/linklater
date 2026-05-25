import { act, render, screen } from '@testing-library/react';
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
  const { activeHash } = useSettingsScrollSpy({ sectionIds });
  return <div data-testid="active">{activeHash}</div>;
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
});
