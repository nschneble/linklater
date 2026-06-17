/**
 * Wave 6 co-located coverage (a11y-lead wave-5 Minor 2). This wave swaps
 * ResponsePanel's color SOURCE from brand literals to the alert/success bundle
 * tokens; these tests pin the contracts that must survive that swap:
 *
 *   - the status icon stays `aria-hidden` (it is decorative; the status text
 *     and the persistent sr-only announcer carry the meaning — CONSTRAINT §5);
 *   - success vs error stay distinguishable by ICON + TEXT, not color alone
 *     (SC 1.4.1) — so the panel reads correctly in grayscale / under CVD;
 *   - the region carries its `aria-label="Response"` and no second live region.
 */

import ResponsePanel from './ResponsePanel';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('ResponsePanel', () => {
  it('labels the region "Response" and carries no live-region role', () => {
    render(<ResponsePanel ok statusLine="200 OK" body="{}" />);
    const region = screen.getByRole('region', { name: 'Response' });
    expect(region).toBeInTheDocument();
    // The single announcer is RequestForm's sr-only role="status"; this panel
    // must not add a second live region.
    expect(region.querySelector('[role="status"]')).toBeNull();
    expect(region.querySelector('[aria-live]')).toBeNull();
  });

  it('marks the status icon aria-hidden (decorative)', () => {
    const { container } = render(
      <ResponsePanel ok statusLine="200 OK" body="{}" />,
    );
    const icon = container.querySelector('i');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the check icon for success and the exclamation icon for error (1.4.1)', () => {
    const { container: okContainer } = render(
      <ResponsePanel ok statusLine="201 Created" body="{}" />,
    );
    expect(okContainer.querySelector('i')?.className).toContain(
      'fa-circle-check',
    );

    const { container: errorContainer } = render(
      <ResponsePanel ok={false} statusLine="404 Not Found" body="{}" />,
    );
    expect(errorContainer.querySelector('i')?.className).toContain(
      'fa-circle-exclamation',
    );
  });

  it('renders the status text so meaning survives without color', () => {
    render(
      <ResponsePanel ok={false} statusLine="500 Server Error" body="{}" />,
    );
    expect(screen.getByText('500 Server Error')).toBeInTheDocument();
  });

  it('wraps the region in the matching state-bundle surface tokens', () => {
    const { container: okContainer } = render(
      <ResponsePanel ok statusLine="200 OK" body="{}" />,
    );
    const okRegion = okContainer.querySelector('section');
    expect(okRegion?.className).toContain('bg-[var(--success-bg)]');
    expect(okRegion?.className).toContain('text-[var(--success-text)]');

    const { container: errorContainer } = render(
      <ResponsePanel ok={false} statusLine="404 Not Found" body="{}" />,
    );
    const errorRegion = errorContainer.querySelector('section');
    expect(errorRegion?.className).toContain('bg-[var(--alert-bg)]');
    expect(errorRegion?.className).toContain('text-[var(--alert-text)]');
  });

  it('shows the response body in a <pre>', () => {
    const { container } = render(
      <ResponsePanel ok statusLine="200 OK" body='{"id":"abc"}' />,
    );
    const pre = container.querySelector('pre');
    expect(pre).toHaveTextContent('{"id":"abc"}');
  });
});
