/*
 * The switch's rendered state is owned by the `toggle-cvd-mode` Tuffgal
 * story, so this file keeps only what a story can't observe: the
 * `PATCH /users/me` payload carries both `cvdMode` and the resolved `theme`,
 * and the optimistic flip rolls back when the persist fails.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CvdModeToggle from './CvdModeToggle';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateMe } from '../../lib/api';

vi.mock('../../lib/api', () => ({ updateMe: vi.fn() }));

const mockTheme = makeMockTheme();

vi.mock('../../theme/ThemeContext', async (importActual) => {
  const actual =
    await importActual<typeof import('../../theme/ThemeContext')>();
  return { ...actual, useTheme: () => mockTheme };
});

function makeMockTheme() {
  return {
    isCvdMode: false,
    enableCvdMode: vi.fn(() => 'apollo'),
    disableCvdMode: vi.fn(() => 'default'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mockTheme, makeMockTheme());
  vi.mocked(updateMe).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CvdModeToggle', () => {
  it('enables CVD mode and persists it when toggled from off', async () => {
    render(<CvdModeToggle />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({
        cvdMode: true,
        theme: 'apollo',
      });
    });
    expect(mockTheme.enableCvdMode).toHaveBeenCalledTimes(1);
    expect(mockTheme.disableCvdMode).not.toHaveBeenCalled();
  });

  it('disables CVD mode and persists it when toggled from on', async () => {
    mockTheme.isCvdMode = true;
    render(<CvdModeToggle />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({
        cvdMode: false,
        theme: 'default',
      });
    });
    expect(mockTheme.disableCvdMode).toHaveBeenCalledTimes(1);
    expect(mockTheme.enableCvdMode).not.toHaveBeenCalled();
  });

  it('reverts the optimistic flip and shows an error when the persist fails', async () => {
    vi.mocked(updateMe).mockRejectedValue(new Error('Network down'));
    render(<CvdModeToggle />);

    fireEvent.click(screen.getByRole('switch'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    // optimistic enable, then a revert back to disabled
    expect(mockTheme.enableCvdMode).toHaveBeenCalledTimes(1);
    expect(mockTheme.disableCvdMode).toHaveBeenCalledTimes(1);
  });

  it('refuses a second flip while the persist is in flight, without dropping focus', async () => {
    let resolvePersist!: () => void;
    vi.mocked(updateMe).mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePersist = () => resolve();
      }),
    );
    render(<CvdModeToggle />);
    const toggle = screen.getByRole('switch');
    toggle.focus();

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(toggle).toHaveAttribute('aria-disabled', 'true'),
    );
    expect(toggle).not.toBeDisabled();
    expect(document.activeElement).toBe(toggle);

    fireEvent.click(toggle);
    expect(updateMe).toHaveBeenCalledTimes(1);

    resolvePersist();
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-disabled'));
  });
});
