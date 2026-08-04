/*
 * Tests for CopyRevealPanel: shared one-shot secret reveal.
 *
 * Three contracts pinned here:
 * 1. Single-secret vs multi-secret rendering branches: `<code>` for one
 *    secret, `<ul>/<li>` grid for multiple. Each branch paints from the
 *    mount/orbit bundle tokens (lifted to `--orbit-bg`
 *    for the secret-containing surface, `--mount-border` for the panel
 *    edges, `--mount-text`/`--mount-alt-text` for the heading copy).
 * 2. Controlled vs uncontrolled copy state: when the parent passes
 *    `copied`, the parent owns reset; when omitted, the component owns
 *    state + reset (5000ms via useTransientState).
 * 3. focusOnMount focuses the panel and wires aria-labelledby so screen
 *    readers announce the reveal heading on mount.
 */

import CopyRevealPanel from './CopyRevealPanel';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const baseProps = {
  headingText: 'Your token has been created.',
  bodyText: "It'll only be shown once.",
  secretAriaLabel: 'Token – navigate to read character by character',
  copyButtonLabel: 'Copy to clipboard',
  copiedAnnouncement: 'Token copied',
};

describe('CopyRevealPanel', () => {
  it('renders single secret as <code>; multi-secret as <ul>', () => {
    const { rerender, container } = render(
      <CopyRevealPanel {...baseProps} secrets={['solo-secret']} />,
    );
    expect(container.querySelector('code')).toBeTruthy();
    expect(container.querySelector('ul')).toBeNull();

    rerender(<CopyRevealPanel {...baseProps} secrets={['code-a', 'code-b']} />);
    expect(container.querySelector('ul')).toBeTruthy();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('single-secret <code> paints from the orbit bundle (lifted off mount)', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['solo']} />,
    );
    const code = container.querySelector('code')!;
    expect(code.className).toContain('bg-[var(--orbit-bg)]');
    expect(code.className).toContain('border-[var(--orbit-border)]');
    expect(code.className).toContain('text-[var(--orbit-text)]');
  });

  it('multi-secret <li> paints from the orbit bundle (same as single-secret)', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['a', 'b']} />,
    );
    const item = container.querySelector('li')!;
    expect(item.className).toContain('bg-[var(--orbit-bg)]');
    expect(item.className).toContain('text-[var(--orbit-text)]');
  });

  it('heading paragraph paints from mount bundle: alt-text body, text bold lead', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['x']} />,
    );
    const paragraph = container.querySelector('[role="status"]')!;
    expect(paragraph.className).toContain('text-[var(--mount-alt-text)]');
    const bold = paragraph.querySelector('span')!;
    expect(bold.className).toContain('text-[var(--mount-text)]');
  });

  it('exposes secretAriaLabel on each rendered secret', () => {
    const { rerender, container } = render(
      <CopyRevealPanel {...baseProps} secrets={['solo']} />,
    );
    expect(container.querySelector('code')!.getAttribute('aria-label')).toBe(
      baseProps.secretAriaLabel,
    );

    rerender(<CopyRevealPanel {...baseProps} secrets={['a', 'b']} />);
    const items = container.querySelectorAll('li');
    for (const item of items) {
      expect(item.getAttribute('aria-label')).toBe(baseProps.secretAriaLabel);
    }
  });

  it('renders a sibling polite live region for the copy announcement', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['x']} copied />,
    );
    const liveRegions = container.querySelectorAll('[role="status"]');
    // two status regions: heading + the sr-only announcement region
    expect(liveRegions).toHaveLength(2);
    const announcer = liveRegions[1];
    expect(announcer.textContent).toBe(baseProps.copiedAnnouncement);
  });

  it('controlled mode – parent-supplied copied=false suppresses the announcement', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['x']} copied={false} />,
    );
    const liveRegions = container.querySelectorAll('[role="status"]');
    const announcer = liveRegions[1];
    expect(announcer.textContent).toBe('');
  });

  it('controlled mode – clicking copy invokes onCopy', () => {
    const handleCopy = vi.fn();
    render(
      <CopyRevealPanel
        {...baseProps}
        secrets={['x']}
        copied={false}
        onCopy={handleCopy}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    expect(handleCopy).toHaveBeenCalledTimes(1);
  });

  it('focusOnMount focuses the container and wires aria-labelledby', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['x']} focusOnMount />,
    );
    const panel = container.firstChild as HTMLElement;
    expect(panel.getAttribute('tabIndex')).toBe('-1');
    expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.activeElement).toBe(panel);
  });

  it('focusOnMount=false leaves the panel un-focused', () => {
    const { container } = render(
      <CopyRevealPanel {...baseProps} secrets={['x']} />,
    );
    const panel = container.firstChild as HTMLElement;
    expect(panel.getAttribute('tabIndex')).toBeNull();
    expect(panel.getAttribute('aria-labelledby')).toBeNull();
  });
});
