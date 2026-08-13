/*
 * Tests for `BootInterstitial`, the visible boot screen.
 *
 * Three properties are pinned. The screen carries no live-region shape:
 * App's hoisted mirror is the sole announcer, and a second region that
 * appears and is removed again is where dropped and stale utterances come
 * from. The message pulses COLOR, not opacity, mirroring the link-card
 * migration; an opacity trough takes `--base-alt-text` on `--base-bg` under
 * the 4.5:1 floor on almost every palette.
 *
 * And the surface names its own palette. Inheriting one leaves the pulse
 * running in whatever the root is painted with, which for an editable
 * theme is a pair of foregrounds nothing has ever compared to each other.
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

  it('paints the branding palette rather than inheriting the root', () => {
    const { container } = render(<BootInterstitial />);

    const surface = container.querySelector('[data-theme="branding"]');
    expect(surface).not.toBeNull();
    // the pulsing message must resolve its two colors from that same block
    expect(
      screen
        .getByText('Defrosting Linklater in the microwave…')
        .closest('[data-theme="branding"]'),
    ).toBe(surface);
  });
});
