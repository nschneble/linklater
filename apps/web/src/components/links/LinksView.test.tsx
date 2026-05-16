import { render } from '@testing-library/react';
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

function renderOnRoute(path: string) {
  vi.mocked(useLinks).mockReturnValue(makeUseLinksResult());
  render(
    <MemoryRouter initialEntries={[path]}>
      <LinksView />
    </MemoryRouter>,
  );
}

function fireKey(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

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
