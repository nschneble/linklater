import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import Toast from './Toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => vi.runOnlyPendingTimers());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message="Link saved!" onDismiss={vi.fn()} />);
    expect(screen.getByText('Link saved!')).toBeInTheDocument();
  });

  it('has role="status" for accessibility when variant is success', () => {
    render(<Toast message="Link saved!" onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has role="alert" when variant is error', () => {
    render(
      <Toast message="Something failed" onDismiss={vi.fn()} variant="error" />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a dismiss button', () => {
    render(<Toast message="Link saved!" onDismiss={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /dismiss/i }),
    ).toBeInTheDocument();
  });

  it('calls onDismiss after clicking the dismiss button and the animation delay', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Link saved!" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(150));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after 3 seconds plus the animation delay', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Link saved!" onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(3000 + 150));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  describe('variant icons', () => {
    it('renders fa-circle-check icon for success variant', () => {
      const { container } = render(
        <Toast message="Saved" onDismiss={vi.fn()} variant="success" />,
      );
      const icons = container.querySelectorAll('i.fa-solid');
      const iconClasses = Array.from(icons).map((icon) => icon.className);
      expect(iconClasses.some((cls) => cls.includes('fa-circle-check'))).toBe(
        true,
      );
    });

    it('renders fa-circle-exclamation icon for error variant', () => {
      const { container } = render(
        <Toast message="Failed" onDismiss={vi.fn()} variant="error" />,
      );
      const icons = container.querySelectorAll('i.fa-solid');
      const iconClasses = Array.from(icons).map((icon) => icon.className);
      expect(
        iconClasses.some((cls) => cls.includes('fa-circle-exclamation')),
      ).toBe(true);
    });

    it('defaults to the success icon when no variant is provided', () => {
      const { container } = render(
        <Toast message="Done" onDismiss={vi.fn()} />,
      );
      const icons = container.querySelectorAll('i.fa-solid');
      const iconClasses = Array.from(icons).map((icon) => icon.className);
      expect(iconClasses.some((cls) => cls.includes('fa-circle-check'))).toBe(
        true,
      );
    });
  });
});
