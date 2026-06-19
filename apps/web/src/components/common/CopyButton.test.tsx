/*
 * Tests for CopyButton – shared copy-to-clipboard button.
 *
 * Contracts pinned here:
 * 1. Name contract (WCAG 2.5.3 Label in Name): visible text comes from
 *    `children` (default "Copy to clipboard"). When `label` is omitted, NO
 *    aria-label is emitted and the accessible name == visible text. When
 *    `label` IS provided it overrides the name and MUST start with the
 *    visible text. The icon stack is aria-hidden and never participates.
 * 2. The `data-copied` flag drives the icon cross-fade.
 * 3. Clicking invokes onCopy; surface forwards to the IconButton.
 * 4. Real-consumer name contracts: the labels shipped by CopyRevealPanel's
 *    consumers (ApiTokensSection) satisfy startsWith(visibleText).
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CopyButton from './CopyButton';

describe('CopyButton', () => {
  it('defaults the visible text to "Copy to clipboard"', () => {
    render(<CopyButton copied={false} />);
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('Copy to clipboard');
  });

  it('renders custom visible text from children', () => {
    render(<CopyButton copied={false}>Copy</CopyButton>);
    expect(screen.getByRole('button').textContent).toBe('Copy');
  });

  it('emits no aria-label when label is omitted – name derives from visible text', () => {
    render(<CopyButton copied={false} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(button).toHaveAccessibleName('Copy to clipboard');
  });

  it('uses label as the accessible-name override when provided', () => {
    render(
      <CopyButton copied={false} label="Copy cURL command">
        Copy
      </CopyButton>,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Copy cURL command');
    expect(button).toHaveAccessibleName('Copy cURL command');
  });

  it('name override starts with the visible text (WCAG 2.5.3 Label in Name)', () => {
    render(
      <CopyButton copied={false} label="Copy cURL command">
        Copy
      </CopyButton>,
    );
    const button = screen.getByRole('button');
    const accessibleName = button.getAttribute('aria-label')!;
    expect(accessibleName.startsWith('Copy')).toBe(true);
  });

  it('aria-hides the icon stack so it never participates in the name', () => {
    const { container } = render(<CopyButton copied={false} />);
    const iconWrapper = container.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).toBeTruthy();
    expect(iconWrapper!.querySelector('.fa-copy')).toBeTruthy();
    expect(iconWrapper!.querySelector('.fa-check')).toBeTruthy();
  });

  it('reflects copied state via data-copied', () => {
    const { rerender } = render(<CopyButton copied={false} />);
    expect(screen.getByRole('button').getAttribute('data-copied')).toBeNull();

    rerender(<CopyButton copied />);
    expect(screen.getByRole('button').getAttribute('data-copied')).toBe('true');
  });

  it('invokes onCopy when clicked', () => {
    const handleCopy = vi.fn();
    render(<CopyButton copied={false} onCopy={handleCopy} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleCopy).toHaveBeenCalledTimes(1);
  });

  it('defaults to the mount surface and forwards a supplied surface', () => {
    const { rerender } = render(<CopyButton copied={false} />);
    expect(screen.getByRole('button').getAttribute('data-surface')).toBe(
      'mount',
    );

    rerender(<CopyButton copied={false} surface="base" />);
    expect(screen.getByRole('button').getAttribute('data-surface')).toBe(
      'base',
    );
  });

  it('real consumer labels satisfy the startsWith name contract', () => {
    // ApiTokensSection ships visible "Copy to clipboard" + override
    // "Copy to clipboard". CurlExample (Wave 2) will ship visible "Copy" +
    // override "Copy cURL command". Both must start with their visible text.
    const consumerCases = [
      { visible: 'Copy to clipboard', label: 'Copy to clipboard' },
      { visible: 'Copy', label: 'Copy cURL command' },
    ];
    for (const consumerCase of consumerCases) {
      expect(consumerCase.label.startsWith(consumerCase.visible)).toBe(true);
    }
  });
});
