import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  reanchorSettingsSection,
  scrollToSettingsSection,
} from './settingsScroll';

function createSection(
  id: string,
  options: { top: number; scrollMarginTop?: number },
) {
  const element = document.createElement('section');
  element.id = id;
  if (options.scrollMarginTop !== undefined) {
    element.style.scrollMarginTop = `${options.scrollMarginTop}px`;
  }
  element.getBoundingClientRect = () =>
    ({
      top: options.top,
      bottom: options.top + 100,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
    }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

let scrollIntoViewMock: ReturnType<typeof vi.fn>;
let scrollToMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollIntoViewMock = vi.fn();
  scrollToMock = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  // jsdom defines `focus` on `HTMLElement.prototype`; stub it so the
  // helper's focus call is a no-op in tests.
  HTMLElement.prototype.focus = vi.fn();
  window.scrollTo = scrollToMock as unknown as typeof window.scrollTo;
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    writable: true,
    value: 0,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('scrollToSettingsSection', () => {
  it('uses scrollIntoView when the section sits below its scroll-margin', () => {
    createSection('security', { top: 800, scrollMarginTop: 96 });

    expect(scrollToSettingsSection('security')).toBe(true);

    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start' }),
    );
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('snaps to the top of the page when the resulting scrollY would be smaller than the scroll-margin', () => {
    // Mirrors the production first-section case: Account naturally sits
    // ~111px down with scroll-mt-24 (96px). scrollIntoView would scroll
    // the page 15px to anchor it at viewport y=96, drifting from the
    // fresh-load position. The helper must snap to 0 instead.
    createSection('account', { top: 111, scrollMarginTop: 96 });

    expect(scrollToSettingsSection('account')).toBe(true);

    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ top: 69 }),
    );
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('snaps to the top when the section already sits above its scroll-margin', () => {
    createSection('account', { top: 15, scrollMarginTop: 96 });

    scrollToSettingsSection('account');

    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ top: 69 }),
    );
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('snaps to the top at the boundary where the resulting scrollY equals the scroll-margin minus one', () => {
    // naturalTop = 2 * scrollMt - 1 -> targetScrollY = scrollMt - 1,
    // which is strictly less than scrollMt and must take the snap path.
    createSection('account', { top: 191, scrollMarginTop: 96 });

    scrollToSettingsSection('account');

    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ top: 69 }),
    );
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('uses scrollIntoView at the boundary where the resulting scrollY equals the scroll-margin', () => {
    // naturalTop = 2 * scrollMt -> targetScrollY = scrollMt; the snap
    // condition is strict (`<`), so this case must take the anchored path.
    createSection('section', { top: 192, scrollMarginTop: 96 });

    scrollToSettingsSection('section');

    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('returns false and does not scroll when the section does not exist', () => {
    expect(scrollToSettingsSection('missing')).toBe(false);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('moves focus to the section in both scroll paths', () => {
    const section = createSection('security', {
      top: 800,
      scrollMarginTop: 96,
    });
    scrollToSettingsSection('security');
    expect(section.focus).toHaveBeenCalled();

    (section.focus as ReturnType<typeof vi.fn>).mockClear();
    const firstSection = createSection('account', {
      top: 15,
      scrollMarginTop: 96,
    });
    scrollToSettingsSection('account');
    expect(firstSection.focus).toHaveBeenCalled();
  });
});

describe('reanchorSettingsSection', () => {
  it('skips focus when re-anchoring', () => {
    const section = createSection('security', {
      top: 800,
      scrollMarginTop: 96,
    });

    reanchorSettingsSection('security');

    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto', block: 'start' }),
    );
    expect(section.focus).not.toHaveBeenCalled();
  });

  it('also takes the snap-to-0 path for sections in the first-section regime', () => {
    createSection('account', { top: 111, scrollMarginTop: 96 });

    reanchorSettingsSection('account');

    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ top: 69, behavior: 'auto' }),
    );
  });
});
