/*
 * Tests for `BootInterstitial`, the visible boot screen.
 *
 * Two properties are pinned. The screen carries no live-region semantics:
 * App's hoisted mirror is the sole announcer, and a second region that
 * appears and is removed again is where dropped and stale utterances come
 * from. And the message pulses COLOR, not opacity, mirroring the link-card
 * migration; an opacity trough takes `--base-alt-text` on `--base-bg` under
 * the 4.5:1 floor on almost every palette.
 */

import BootInterstitial from './BootInterstitial';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('BootInterstitial', () => {
  it('shows the boot message', () => {
    render(<BootInterstitial />);

    expect(
      screen.getByText('Defrosting Linklater in the microwave…'),
    ).toBeInTheDocument();
  });

  it('carries no live-region role and is not hidden from the virtual cursor', () => {
    const { container } = render(<BootInterstitial />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('pulses the message color instead of its opacity', () => {
    const { container } = render(<BootInterstitial />);

    const message = screen.getByText('Defrosting Linklater in the microwave…');
    expect(message.className).toContain('animate-boot-pulse');
    expect(message.className).toContain('text-[var(--base-alt-text)]');
    expect(container.innerHTML).not.toContain('animate-pulse');
  });
});
