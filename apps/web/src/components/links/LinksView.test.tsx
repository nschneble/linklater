import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinks } from '../../lib/hooks/useLinks';
import LinksView from './LinksView';

vi.mock('../../lib/hooks/useLinks');

const mockHandleToggleForm = vi.fn();
const mockHandleRandom = vi.fn();

function makeUseLinksResult(): ReturnType<typeof useLinks> {
  return {
    fetchError: null,
    readError: null,
    deleteError: null,
    handleCreated: vi.fn(),
    handleDeleteAllRead: vi.fn().mockResolvedValue(undefined),
    handleDismissToast: vi.fn(),
    handleLoadMore: vi.fn(),
    handleRandom: mockHandleRandom,
    handleToggleRead: vi.fn().mockResolvedValue(undefined),
    handleToggleForm: mockHandleToggleForm,
    links: [],
    loadingLinks: false,
    page: 1,
    pagination: null,
    randomError: null,
    randomLoading: false,
    saveError: null,
    showLinkForm: false,
    toastMessage: null,
  };
}

function renderOnRoute(
  path: string,
  linksOverrides: Partial<ReturnType<typeof useLinks>> = {},
) {
  vi.mocked(useLinks).mockReturnValue({
    ...makeUseLinksResult(),
    ...linksOverrides,
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <LinksView />
    </MemoryRouter>,
  );
}

function fireKey(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('LinksView — link form dialog', () => {
  const formOpenOverrides = {
    showLinkForm: true,
    handleToggleForm: mockHandleToggleForm,
  };

  afterEach(() => vi.restoreAllMocks());

  it('renders a role="dialog" wrapper when the link form is open', () => {
    renderOnRoute('/unread', formOpenOverrides);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dialog has aria-modal="true"', () => {
    renderOnRoute('/unread', formOpenOverrides);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('dialog has aria-label "Save a link"', () => {
    renderOnRoute('/unread', formOpenOverrides);
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Save a link',
    );
  });

  it('Tab at the last focusable element wraps to the first', () => {
    renderOnRoute('/unread', formOpenOverrides);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    // Tab from last should wrap to first
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Tab' });
    });

    expect(document.activeElement).toBe(focusable[0]);
  });

  it('Shift+Tab at the first focusable element wraps to the last', () => {
    renderOnRoute('/unread', formOpenOverrides);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    const first = focusable[0];
    first.focus();
    expect(document.activeElement).toBe(first);

    act(() => {
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    });

    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });
});

describe('LinksView keyboard shortcuts', () => {
  beforeEach(() => {
    mockHandleToggleForm.mockReset();
    mockHandleRandom.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('on the unread tab', () => {
    it('A key opens the add link form', () => {
      renderOnRoute('/unread');
      fireKey('a');
      expect(mockHandleToggleForm).toHaveBeenCalledOnce();
    });

    it('D key stumbles', () => {
      renderOnRoute('/unread');
      fireKey('d');
      expect(mockHandleRandom).toHaveBeenCalledOnce();
    });
  });

  describe('on the read tab', () => {
    it('A key does not open the add link form', () => {
      renderOnRoute('/read');
      fireKey('a');
      expect(mockHandleToggleForm).not.toHaveBeenCalled();
    });

    it('D key does not stumble', () => {
      renderOnRoute('/read');
      fireKey('d');
      expect(mockHandleRandom).not.toHaveBeenCalled();
    });
  });
});
