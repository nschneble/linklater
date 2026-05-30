import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CvdModeToggle from './CvdModeToggle';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: vi.fn(),
  useThemeStyling: () => ({ baseTheme: 'scanner-darkly', mode: 'light' }),
}));

vi.mock('../../lib/api', () => ({
  updateMe: vi.fn(),
}));

import { useTheme } from '../../theme/ThemeContext';
import { updateMe } from '../../lib/api';

function makeThemeContext(overrides = {}) {
  return {
    baseTheme: 'scanner-darkly',
    mode: 'dark',
    isCvdMode: false,
    enableCvdMode: vi.fn().mockReturnValue('apollo-10-1-2'),
    disableCvdMode: vi.fn().mockReturnValue('scanner-darkly'),
    setBaseTheme: vi.fn(),
    setMode: vi.fn(),
    toggleMode: vi.fn(),
    applyServerTheme: vi.fn(),
    applyServerMode: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTheme).mockReturnValue(makeThemeContext());
  vi.mocked(updateMe).mockResolvedValue({ id: 'user-1', email: 'u@e.com' });
});

describe('CvdModeToggle', () => {
  it('renders the toggle button with role="switch"', () => {
    render(<CvdModeToggle />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('has aria-checked="false" when CVD mode is off', () => {
    render(<CvdModeToggle />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('has aria-checked="true" when CVD mode is on', () => {
    vi.mocked(useTheme).mockReturnValue(makeThemeContext({ isCvdMode: true }));
    render(<CvdModeToggle />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls enableCvdMode and updateMe when toggled on', async () => {
    const enableCvdMode = vi.fn().mockReturnValue('apollo-10-1-2');
    vi.mocked(useTheme).mockReturnValue(
      makeThemeContext({ isCvdMode: false, enableCvdMode }),
    );

    render(<CvdModeToggle />);
    fireEvent.click(screen.getByRole('switch'));

    expect(enableCvdMode).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith(
        expect.objectContaining({ cvdMode: true }),
      );
    });
  });

  it('calls disableCvdMode and updateMe when toggled off', async () => {
    const disableCvdMode = vi.fn().mockReturnValue('scanner-darkly');
    vi.mocked(useTheme).mockReturnValue(
      makeThemeContext({ isCvdMode: true, disableCvdMode }),
    );

    render(<CvdModeToggle />);
    fireEvent.click(screen.getByRole('switch'));

    expect(disableCvdMode).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith(
        expect.objectContaining({ cvdMode: false }),
      );
    });
  });

  it('renders the descriptive text for CVD mode', () => {
    render(<CvdModeToggle />);
    expect(screen.getByText(/apollo 10½/i)).toBeInTheDocument();
  });

  it('shows "On" as sr-only text when enabled', () => {
    vi.mocked(useTheme).mockReturnValue(makeThemeContext({ isCvdMode: true }));
    render(<CvdModeToggle />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('shows "Off" as sr-only text when disabled', () => {
    render(<CvdModeToggle />);
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('renders an Alert with the error message when updateMe rejects', async () => {
    const enableCvdMode = vi.fn().mockReturnValue('apollo-10-1-2');
    const disableCvdMode = vi.fn().mockReturnValue('scanner-darkly');
    vi.mocked(useTheme).mockReturnValue(
      makeThemeContext({
        isCvdMode: false,
        enableCvdMode,
        disableCvdMode,
      }),
    );
    vi.mocked(updateMe).mockRejectedValue(new Error('Network error'));

    render(<CvdModeToggle />);
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toContain('Network error');
    // Should revert the local toggle on failure
    expect(disableCvdMode).toHaveBeenCalled();
  });
});
