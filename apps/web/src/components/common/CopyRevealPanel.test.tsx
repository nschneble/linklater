import CopyRevealPanel from './CopyRevealPanel';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const defaultProps = {
  headingText: 'Your new secret has been created.',
  bodyText: 'It will only be shown once.',
  secretAriaLabel: 'Secret — navigate to read it',
  copyButtonLabel: 'Copy to clipboard',
  copiedAnnouncement: 'Copied to clipboard',
};

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText },
  });
  writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CopyRevealPanel — single-secret render', () => {
  it('renders the heading and body inside a role="status" paragraph', () => {
    render(<CopyRevealPanel {...defaultProps} secrets={['secret-1']} />);

    const statuses = screen.getAllByRole('status');
    const heading = statuses.find((element) =>
      element.textContent?.includes('Your new secret has been created.'),
    );
    expect(heading).toBeDefined();
    expect(heading).toHaveTextContent('It will only be shown once.');
  });

  it('renders the single secret inside a <code> with the secretAriaLabel', () => {
    render(<CopyRevealPanel {...defaultProps} secrets={['secret-1']} />);

    const code = screen.getByLabelText('Secret — navigate to read it');
    expect(code.tagName).toBe('CODE');
    expect(code).toHaveTextContent('secret-1');
  });
});

describe('CopyRevealPanel — multi-secret render', () => {
  it('renders a <ul>/<li> grid when secrets has multiple entries', () => {
    render(
      <CopyRevealPanel
        {...defaultProps}
        secrets={['code-a', 'code-b', 'code-c']}
      />,
    );

    const items = screen.getAllByLabelText('Secret — navigate to read it');
    expect(items).toHaveLength(3);
    expect(items[0]?.tagName).toBe('LI');
    expect(items.map((item) => item.textContent)).toEqual([
      'code-a',
      'code-b',
      'code-c',
    ]);
  });
});

describe('CopyRevealPanel — uncontrolled mode', () => {
  it('writes joined secrets to the clipboard when the copy button is clicked', async () => {
    render(
      <CopyRevealPanel {...defaultProps} secrets={['code-a', 'code-b']} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('code-a\ncode-b');
    });
  });

  it('flips data-copied to "true" after a successful clipboard write', async () => {
    render(<CopyRevealPanel {...defaultProps} secrets={['secret-1']} />);

    const button = screen.getByRole('button', { name: 'Copy to clipboard' });
    expect(button.dataset['copied']).toBeUndefined();

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.dataset['copied']).toBe('true');
    });
  });

  it('populates the polite live region with copiedAnnouncement after copy', async () => {
    render(<CopyRevealPanel {...defaultProps} secrets={['secret-1']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    await waitFor(() => {
      const announcements = screen.getAllByRole('status');
      const announcement = announcements.find(
        (element) => element.textContent === 'Copied to clipboard',
      );
      expect(announcement).toBeDefined();
    });
  });

  it('does not throw when the clipboard write rejects', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));

    render(<CopyRevealPanel {...defaultProps} secrets={['secret-1']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });

    const button = screen.getByRole('button', { name: 'Copy to clipboard' });
    expect(button.dataset['copied']).toBeUndefined();
  });
});

describe('CopyRevealPanel — controlled mode', () => {
  it('uses the copied prop to drive data-copied (parent-owned state)', () => {
    const { rerender } = render(
      <CopyRevealPanel
        {...defaultProps}
        secrets={['secret-1']}
        copied={false}
        onCopy={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Copy to clipboard' });
    expect(button.dataset['copied']).toBeUndefined();

    rerender(
      <CopyRevealPanel
        {...defaultProps}
        secrets={['secret-1']}
        copied={true}
        onCopy={vi.fn()}
      />,
    );

    expect(button.dataset['copied']).toBe('true');
  });

  it('invokes the onCopy prop on button click instead of the internal clipboard write', () => {
    const onCopy = vi.fn();
    render(
      <CopyRevealPanel
        {...defaultProps}
        secrets={['secret-1']}
        copied={false}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('CopyRevealPanel — focusOnMount', () => {
  it('focuses the container on mount when focusOnMount is true', () => {
    const { container } = render(
      <CopyRevealPanel {...defaultProps} secrets={['secret-1']} focusOnMount />,
    );

    const panel = container.querySelector('div[tabindex="-1"]');
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
  });

  it('wires aria-labelledby to the heading id when focusOnMount is true', () => {
    const { container } = render(
      <CopyRevealPanel {...defaultProps} secrets={['secret-1']} focusOnMount />,
    );

    const panel = container.querySelector('div[tabindex="-1"]');
    const labelledBy = panel?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy ?? '');
    expect(heading).toHaveTextContent('Your new secret has been created.');
  });

  it('does not focus or wire aria-labelledby when focusOnMount is false (default)', () => {
    const { container } = render(
      <CopyRevealPanel {...defaultProps} secrets={['secret-1']} />,
    );

    expect(container.querySelector('div[tabindex="-1"]')).toBeNull();
    expect(container.querySelector('div[aria-labelledby]')).toBeNull();
  });
});
