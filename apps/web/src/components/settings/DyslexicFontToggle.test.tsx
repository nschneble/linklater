/*
 * The switch's rendered state is owned by the `user-toggles-dyslexic-font`
 * Tuffgal story, so this file keeps only what a story can't observe: the
 * `PATCH /users/me` payload carries `dyslexicFont` alone (no `theme`,
 * unlike CVD mode), the optimistic flip rolls back when the persist
 * fails, and the busy window tracks that persist.
 *
 * What a busy switch does - refusing a second activation, keeping focus,
 * never going natively disabled - belongs to the shared control and is
 * pinned in `SettingSwitch.busy.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DyslexicFontToggle from './DyslexicFontToggle';
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
    // optimistic enable, then a revert back to disabled
    expect(mockTheme.enableDyslexicFont).toHaveBeenCalledTimes(1);
    expect(mockTheme.disableDyslexicFont).toHaveBeenCalledTimes(1);
  });

  it('holds the switch busy for as long as its own persist runs', async () => {
    let resolvePersist!: () => void;
    vi.mocked(updateMe).mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePersist = () => resolve();
      }),
    );
    render(<DyslexicFontToggle />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute('aria-busy', 'true'));

    resolvePersist();
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'));
  });
});
