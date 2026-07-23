/*
 * Tests for DyslexicFontToggle.
 *
 * The component delegates the actual font-state flip to ThemeContext
 * (`enableDyslexicFont` / `disableDyslexicFont`, exercised in
 * `useThemeState.test`). Its rendered switch state is owned by the
 * `user-toggles-dyslexic-font` Tuffgal story (mirroring CvdModeToggle, which
 * has no unit test at all), so this file keeps only the behaviors a story
 * can't observe: the exact `PATCH /users/me` payload on toggle (which must
 * carry `dyslexicFont` alone, with no `theme` field riding along, unlike CVD
 * mode) and the optimistic-flip rollback when that persist fails. The context
 * and api are mocked so the test can drive both directions and the error path
 * deterministically.
 */

import DyslexicFontToggle from './DyslexicFontToggle';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    isDyslexicFont: false,
    enableDyslexicFont: vi.fn(),
    disableDyslexicFont: vi.fn(),
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

describe('DyslexicFontToggle', () => {
  it('enables the font and persists it when toggled from off', async () => {
    render(<DyslexicFontToggle />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({ dyslexicFont: true });
    });
    expect(mockTheme.enableDyslexicFont).toHaveBeenCalledTimes(1);
    expect(mockTheme.disableDyslexicFont).not.toHaveBeenCalled();
  });

  it('disables the font and persists it when toggled from on', async () => {
    mockTheme.isDyslexicFont = true;
    render(<DyslexicFontToggle />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({ dyslexicFont: false });
    });
    expect(mockTheme.disableDyslexicFont).toHaveBeenCalledTimes(1);
    expect(mockTheme.enableDyslexicFont).not.toHaveBeenCalled();
  });

  it('reverts the optimistic flip and shows an error when the persist fails', async () => {
    vi.mocked(updateMe).mockRejectedValue(new Error('Network down'));
    render(<DyslexicFontToggle />);

    fireEvent.click(screen.getByRole('switch'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    // Optimistic enable, then a revert back to disabled.
    expect(mockTheme.enableDyslexicFont).toHaveBeenCalledTimes(1);
    expect(mockTheme.disableDyslexicFont).toHaveBeenCalledTimes(1);
  });

  it('disables the switch while the persist is in flight', async () => {
    let resolvePersist!: () => void;
    vi.mocked(updateMe).mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePersist = () => resolve();
      }),
    );
    render(<DyslexicFontToggle />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toBeDisabled());
    resolvePersist();
    await waitFor(() => expect(toggle).not.toBeDisabled());
  });
});
