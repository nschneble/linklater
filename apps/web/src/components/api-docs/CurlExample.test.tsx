/*
 * Tests for CurlExample – the "Example request (cURL)" block.
 *
 * Contracts pinned here (consumer-owned behavior that stays in CurlExample
 * after the Wave 2 swap to the shared CopyButton; only `copied` + `onCopy`
 * cross the boundary):
 * 1. Clicking the copy button writes the built command to the clipboard.
 * 2. The `copied` state surfaces as `data-copied` on the button (the
 *    CSS-driven copy → check icon swap).
 * 3. The button's accessible name is the "Copy cURL command" override.
 * 4. A clipboard failure shows the manual-copy fallback in the status region.
 * 5. After a success the status clears so a repeat copy re-announces
 *    ('' → message → '').
 *
 * Clicks use `fireEvent.click`, NOT `userEvent`: userEvent.setup() installs its
 * own `navigator.clipboard` stub that always resolves, which would shadow the
 * writeText mock these tests assert on.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildCurlCommand } from '../../lib/apiDocs/buildCurlCommand';
import CurlExample from './CurlExample';

const props = {
  method: 'post',
  url: 'https://api.example.com/links',
  body: '{"url":"https://example.com"}',
  labelId: 'endpoint-post-links-request-curl',
};

// jsdom has no clipboard; define a writable mock once, then swap the spy
// behavior per test in beforeEach.
const writeText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  configurable: true,
});

function copyButton() {
  return screen.getByRole('button', { name: 'Copy cURL command' });
}

describe('CurlExample', () => {
  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
  });

  it('copies the built cURL command to the clipboard on click', async () => {
    render(<CurlExample {...props} />);
    fireEvent.click(copyButton());

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(buildCurlCommand(props));
  });

  it('reflects the copied state as data-copied on the button', async () => {
    render(<CurlExample {...props} />);
    const button = copyButton();
    expect(button.getAttribute('data-copied')).toBeNull();

    fireEvent.click(button);
    await waitFor(() =>
      expect(button.getAttribute('data-copied')).toBe('true'),
    );
  });

  it('names the copy button "Copy cURL command"', () => {
    render(<CurlExample {...props} />);
    expect(copyButton()).toBeInTheDocument();
  });

  it('exposes the command as a focusable, labelled scroll group named from the visible label', () => {
    render(<CurlExample {...props} />);
    // The <pre> matches the shared CodeBlock scroll contract: role=group,
    // tabIndex 0, and an accessible name sourced from the visible label (via
    // aria-labelledby to the label's id), never a hidden aria-label.
    const group = screen.getByRole('group', { name: 'Example request (cURL)' });
    expect(group.tagName).toBe('PRE');
    expect(group).toHaveAttribute('tabindex', '0');
    expect(group).toHaveAttribute('aria-labelledby', props.labelId);
    expect(document.getElementById(props.labelId)).toHaveTextContent(
      'Example request (cURL)',
    );
  });

  it('shows the manual-copy fallback when the clipboard write fails', async () => {
    writeText.mockRejectedValue(new Error('denied'));

    render(<CurlExample {...props} />);
    fireEvent.click(copyButton());

    const status = screen.getByRole('status');
    await waitFor(() =>
      expect(status.textContent).toBe(
        'Couldn’t copy. Select the command and copy it manually.',
      ),
    );
  });

  it('clears the status after a success so a repeat copy re-announces', async () => {
    render(<CurlExample {...props} />);
    const status = screen.getByRole('status');
    fireEvent.click(copyButton());

    await waitFor(() =>
      expect(status.textContent).toBe('Copied to clipboard.'),
    );

    // The status clears after COPIED_RESET_MS (1500ms) so the next copy is a
    // genuine '' → message transition that re-announces.
    await waitFor(() => expect(status.textContent).toBe(''), { timeout: 3000 });
  });
});
